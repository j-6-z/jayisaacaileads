/* ============================================================
   JAYISAAC AI — Stripe webhook → Firestore credit grant
   Deploy on Vercel at:  /api/stripe-webhook
   ------------------------------------------------------------
   In the Stripe dashboard (Developers → Webhooks → Add endpoint):
     Endpoint URL:  https://YOUR-DOMAIN.vercel.app/api/stripe-webhook
     Events to send:
       checkout.session.completed     (first payment — subs + one-time packs)
       invoice.paid                   (recurring renewals on subscriptions)

   Stripe gives you a signing secret (starts with whsec_...) when you
   create the endpoint. That goes in Vercel as STRIPE_WEBHOOK_SECRET.

   REQUIRED ENV VARS (Vercel → Settings → Environment Variables):
     STRIPE_SECRET_KEY      = sk_test_... (test) / sk_live_... (live)
     STRIPE_WEBHOOK_SECRET  = whsec_... (from the webhook endpoint)
     FIREBASE_PROJECT_ID    = jayisaac-ai
     FIREBASE_CLIENT_EMAIL  = from the service account JSON
     FIREBASE_PRIVATE_KEY   = from the service account JSON (keep the \n escapes)

   NEVER hardcode these in the file. They live only in Vercel.

   HOW CREDITS ARE DETERMINED:
     Each Stripe Product carries metadata you set:
       credits = 500 | 2000 | 7500 | 250 | 1000 | 3500
       plan    = starter_monthly | pro_annual | pack_1000 | ...
     The webhook reads `credits` off the purchased line item's product.
     No hardcoded price-ID map to maintain — add a product, set its
     metadata, and it just works.
   ============================================================ */

import Stripe from "stripe";
import admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ── Firebase Admin init (lazy, fault-tolerant) ─────────────
   The private key is the #1 source of pain in serverless because
   newlines get mangled in env vars. We support TWO formats:
     1. FIREBASE_PRIVATE_KEY_B64  — the key base64-encoded (BULLETPROOF,
        no newline issues possible). Preferred.
     2. FIREBASE_PRIVATE_KEY      — raw PEM, with literal \n or real
        newlines. We normalize both.
   Init runs lazily inside the handler so a bad key returns a clear
   error instead of crashing the whole function on load. */
function resolvePrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (b64 && b64.trim()) {
    return Buffer.from(b64.trim(), "base64").toString("utf8");
  }
  let k = process.env.FIREBASE_PRIVATE_KEY;
  if (!k) return k;
  k = k.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  k = k.replace(/\\n/g, "\n");   // literal \n  → real newline
  k = k.replace(/\r\n/g, "\n");  // CRLF         → LF
  return k;
}

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  resolvePrivateKey(),
      }),
    });
  }
  return admin.firestore();
}

/* Vercel: need the raw body to verify the Stripe signature, so disable
   the automatic JSON body parser. */
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/* Fallback map: if a product/price is missing the `credits` metadata
   (e.g. it didn't carry over from test to live), we can still resolve
   credits from the plan key. This is a safety net so a missing metadata
   field never silently grants 0 credits to a paying customer. */
const PLAN_CREDITS = {
  starter_monthly: 500,  starter_annual: 500,
  pro_monthly:     2000, pro_annual:     2000,
  agency_monthly:  7500, agency_annual:  7500,
  pack_250:        250,
  pack_1000:       1000,
  pack_3500:       3500,
};

/* Pull credits + plan from a line item.
   Reads in priority order:
     1. product.metadata.credits
     2. price.metadata.credits
     3. plan-name lookup (PLAN_CREDITS) using product/price plan metadata
   Plan is read from product, then price metadata. */
async function creditsFromLineItem(item) {
  let product = item?.price?.product;
  if (typeof product === "string") {
    product = await stripe.products.retrieve(product);
  }
  const pmd = product?.metadata || {};
  const prmd = item?.price?.metadata || {};

  const plan = pmd.plan || prmd.plan || null;

  // 1 + 2: explicit credits metadata on product or price
  let credits = parseInt(pmd.credits, 10);
  if (!Number.isFinite(credits)) credits = parseInt(prmd.credits, 10);

  // 3: fall back to plan-name lookup
  if (!Number.isFinite(credits) && plan && PLAN_CREDITS[plan] != null) {
    credits = PLAN_CREDITS[plan];
  }

  return {
    credits: Number.isFinite(credits) ? credits : 0,
    plan: plan,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  /* 1 ── verify the Stripe signature ───────────────────────── */
  const raw = await readRawBody(req);
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET env var");
    return res.status(500).json({ error: "Server not configured" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.warn("Rejected webhook: bad signature —", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  /* init Firebase now (lazy) — if the key is malformed we get a clear
     error here instead of a silent function-load crash. */
  let db;
  try {
    db = getDb();
  } catch (err) {
    console.error("Firebase init failed — check FIREBASE_PRIVATE_KEY(_B64):", err.message);
    return res.status(500).json({ error: "Firebase init failed", detail: err.message });
  }

  /* We grant credits on:
       checkout.session.completed → first payment (subs + one-time packs)
       invoice.paid               → recurring subscription renewals
     For invoice.paid we SKIP the very first invoice, because
     checkout.session.completed already granted those credits — this
     avoids double-granting on the first cycle.                        */
  const GRANTING = ["checkout.session.completed", "invoice.paid"];
  if (!GRANTING.includes(event.type)) {
    return res.status(200).json({ ok: true, ignored: event.type });
  }

  try {
    let email = "";
    let lineItems = [];
    let isRenewal = false;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      // only act on actually-paid sessions
      if (session.payment_status && session.payment_status !== "paid") {
        return res.status(200).json({ ok: true, note: "session not paid" });
      }
      email = (session.customer_details?.email || session.customer_email || "").toLowerCase().trim();
      // fetch the line items (not included on the session object by default)
      const li = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 10,
        expand: ["data.price.product"],
      });
      lineItems = li.data;
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      // skip the first invoice of a subscription — checkout.session.completed
      // handles the initial grant. billing_reason === "subscription_create"
      // marks that first invoice.
      if (invoice.billing_reason === "subscription_create") {
        return res.status(200).json({ ok: true, note: "first invoice — handled by checkout" });
      }
      isRenewal = true;
      email = (invoice.customer_email || "").toLowerCase().trim();
      lineItems = (invoice.lines?.data || []).map(l => ({
        price: l.price,
        quantity: l.quantity || 1,
      }));
    }

    if (!email) {
      console.error("No email on event", event.type);
      return res.status(200).json({ ok: true, note: "no email" });
    }

    /* sum up credits across all purchased line items */
    let totalCredits = 0;
    let planName = null;
    for (const item of lineItems) {
      const { credits, plan } = await creditsFromLineItem(item);
      const qty = item.quantity || 1;
      totalCredits += credits * qty;
      if (plan) planName = plan;
    }

    if (totalCredits <= 0) {
      console.warn("No credits resolved from line items. Check product metadata. event:", event.type);
      return res.status(200).json({ ok: true, note: "no credits in metadata" });
    }

    /* 2 ── find the user by email via Firebase Auth ──────────── */
    let uid;
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
    } catch {
      console.warn("No Firebase user for email:", email);
      // 200 so Stripe doesn't hammer retries; reconcile manually if needed
      return res.status(200).json({ ok: true, note: "no matching user yet" });
    }

    const userRef  = db.collection("users").doc(uid);
    // idempotency: Stripe event.id is unique per event, so a retry of the
    // same event won't double-grant.
    const eventRef = userRef.collection("ledger").doc(event.id);

    await db.runTransaction(async (tx) => {
      const already = await tx.get(eventRef);
      if (already.exists) return; // already processed

      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        tx.set(userRef, { credits: 0, revealed: [], email });
      }

      tx.update(userRef, {
        credits: admin.firestore.FieldValue.increment(totalCredits),
        ...(planName ? { plan: planName } : {}),
        lastPurchaseAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(eventRef, {
        event: event.type,
        plan: planName,
        creditsGranted: totalCredits,
        renewal: isRenewal,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log(`Granted ${totalCredits} credits to ${email} (${event.type}${isRenewal ? " · renewal" : ""})`);
    return res.status(200).json({ ok: true, granted: totalCredits });
  } catch (err) {
    console.error("Grant failed:", err);
    // TEMP DEBUG: return the real error so it shows in Stripe's delivery log.
    // Revert to a generic message once the webhook is confirmed working.
    return res.status(500).json({
      error: "Grant failed",
      debug: String(err && err.message ? err.message : err),
      code: err && err.code ? err.code : null,
    });
  }
}