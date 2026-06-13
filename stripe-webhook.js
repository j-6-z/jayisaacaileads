/* ============================================================
   JAYISAAC AI — Lemon Squeezy webhook → Firestore credit grant
   Deploy on Vercel at:  /api/lemon-webhook
   ------------------------------------------------------------
   Set the LS webhook callback URL to:
     https://YOUR-DOMAIN.vercel.app/api/lemon-webhook
   and subscribe to events:
     order_created, subscription_created, subscription_payment_success

   REQUIRED ENV VARS (set in Vercel → Settings → Environment Variables):
     LEMON_WEBHOOK_SECRET   = the signing secret you set on the LS webhook
     FIREBASE_PROJECT_ID    = jayisaac-ai
     FIREBASE_CLIENT_EMAIL  = from the service account JSON
     FIREBASE_PRIVATE_KEY   = from the service account JSON (keep the \n escapes)

   NEVER hardcode these in the file. They live only in Vercel.
   ============================================================ */

import crypto from "crypto";
import admin from "firebase-admin";

/* ── variant → credits map ──────────────────────────────────
   Subscriptions grant their monthly allotment per payment.
   One-time packs grant the pack size, once.                    */
const VARIANT_CREDITS = {
  "1778380": 500,   // Starter monthly
  "1778429": 500,   // Starter annual  (monthly allotment per cycle)
  "1778424": 2000,  // Pro monthly
  "1778431": 2000,  // Pro annual
  "1778427": 7500,  // Agency monthly
  "1778435": 7500,  // Agency annual
  "1778436": 250,   // 250 credit pack (one-time)
  "1778439": 1000,  // 1,000 credit pack (one-time)
  "1778441": 3500,  // 3,500 credit pack (one-time)
};

/* plan name for the user doc (subscriptions only) */
const VARIANT_PLAN = {
  "1778380": "starter", "1778429": "starter",
  "1778424": "pro",     "1778431": "pro",
  "1778427": "agency",  "1778435": "agency",
};

/* ── Firebase Admin init (once per cold start) ─────────────── */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

/* Vercel: need the raw body to verify the signature, so disable
   the automatic JSON body parser. */
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  /* 1 ── read raw body + verify HMAC signature ─────────────── */
  const raw = await readRawBody(req);
  const secret = process.env.LEMON_WEBHOOK_SECRET;
  const signature = req.headers["x-signature"];

  if (!secret) {
    console.error("Missing LEMON_WEBHOOK_SECRET env var");
    return res.status(500).json({ error: "Server not configured" });
  }

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");

  // timing-safe compare; reject anything that isn't a genuine LS signature
  const sigOk =
    typeof signature === "string" &&
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!sigOk) {
    console.warn("Rejected webhook: bad signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  /* 2 ── parse the verified payload ────────────────────────── */
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: "Bad JSON" });
  }

  const eventName = event?.meta?.event_name;
  const attrs     = event?.data?.attributes || {};

  /* We grant credits on these events:
       order_created               → one-time credit packs
       subscription_payment_success → recurring plan payments (incl. first)
     We deliberately ignore subscription_created on its own to avoid
     double-granting alongside the first payment_success.               */
  const GRANTING_EVENTS = ["order_created", "subscription_payment_success"];
  if (!GRANTING_EVENTS.includes(eventName)) {
    // acknowledge so LS doesn't retry, but do nothing
    return res.status(200).json({ ok: true, ignored: eventName });
  }

  /* 3 ── figure out which variant was purchased ────────────── */
  let variantId =
    attrs.variant_id ??
    attrs.first_order_item?.variant_id ??
    attrs.order_item?.variant_id ??
    null;
  variantId = variantId != null ? String(variantId) : null;

  const credits = VARIANT_CREDITS[variantId];
  if (!credits) {
    console.warn("Unknown or unmapped variant:", variantId, "event:", eventName);
    return res.status(200).json({ ok: true, note: "variant not mapped" });
  }

  /* 4 ── identify the user ─────────────────────────────────────
     We match by the email LS has on the order. The checkout must
     carry the buyer's account email. The user doc id is the Firebase
     uid, so we look the uid up by email.                            */
  const email = (attrs.user_email || attrs.customer_email || "").toLowerCase().trim();
  if (!email) {
    console.error("No email on event", eventName);
    return res.status(200).json({ ok: true, note: "no email" });
  }

  /* idempotency: each LS event has a unique id we record so a retry
     can't grant twice. */
  const eventId =
    event?.meta?.event_id ||
    attrs.identifier ||
    `${eventName}:${attrs.order_number || attrs.first_subscription_item?.id || raw.length}`;

  try {
    // find the user by email via Firebase Auth
    let uid;
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
    } catch {
      console.warn("No Firebase user for email:", email);
      // still 200 so LS doesn't hammer retries; you can reconcile manually
      return res.status(200).json({ ok: true, note: "no matching user yet" });
    }

    const userRef  = db.collection("users").doc(uid);
    const eventRef = userRef.collection("ledger").doc(eventId);

    await db.runTransaction(async (tx) => {
      const already = await tx.get(eventRef);
      if (already.exists) return; // idempotent: already processed

      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        // create a minimal doc if somehow missing
        tx.set(userRef, { credits: 0, revealed: [], email });
      }

      tx.update(userRef, {
        credits: admin.firestore.FieldValue.increment(credits),
        ...(VARIANT_PLAN[variantId] ? { plan: VARIANT_PLAN[variantId] } : {}),
        lastPurchaseAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(eventRef, {
        event: eventName,
        variantId,
        creditsGranted: credits,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log(`Granted ${credits} credits to ${email} (variant ${variantId})`);
    return res.status(200).json({ ok: true, granted: credits });
  } catch (err) {
    console.error("Grant failed:", err);
    // 500 so LS retries — the transaction is idempotent so retries are safe
    return res.status(500).json({ error: "Grant failed" });
  }
}