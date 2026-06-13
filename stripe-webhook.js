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

/* Pull credits + plan from a line item's product metadata.
   Works for both checkout sessions and invoices. */
async function creditsFromLineItem(item) {
  // item.price.product may be an id (string) or an expanded object
  let product = item?.price?.product;
  if (typeof product === "string") {
    product = await stripe.products.retrieve(product);
  }
  const md = product?.metadata || {};
  const credits = parseInt(md.credits, 10);
  return {
    credits: Number.isFinite(credits) ? credits : 0,
    plan: md.plan || null,
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
    // 500 so Stripe retries — the transaction is idempotent so retries are safe
    return res.status(500).json({ error: "Grant failed" });
  }
}