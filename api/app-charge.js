/* ============================================================
   JAYISAAC AI — Unified App Credit Charge
   ============================================================
   POST /api/app-charge
   The ONE endpoint every in-app feature calls to spend credits.
   Shared by the Cybersecurity app (/app/security.html) and the
   Chief of Staff app (/app/chief-of-staff.html). Mirrors the
   token-verify + atomic-decrement pattern of generate-email.js.

   Body: {
     idToken: "<Firebase ID token>",   // REQUIRED — identifies the user
     app:     "cybersecurity" | "chief-of-staff",
     action:  "cyber_scan" | "staff_draft" | ...,  // REQUIRED
     cost:    2,                        // client HINT only — server decides
     meta:    { ... }                   // optional, logged with the charge
   }

   Returns:
   {
     ok: true,
     action: "cyber_scan",
     charged: 10,
     credits_remaining: 235
   }

   On failure:
   { ok: false, error: "insufficient_credits", message: "...", credits }

   SECURITY MODEL (same philosophy as stripe-webhook.js):
   - The uid comes from the VERIFIED token, never from the client.
   - The cost comes from the SERVER cost table below, never from the
     client. The client's `cost` field is ignored for charging — it's
     only echoed back for debugging. A user editing devtools cannot
     give themselves a cheaper action or a negative charge.
   - The decrement is atomic inside a transaction, so two rapid
     actions can't race past the balance.

   ENV VARS REQUIRED (already set in prod — same as generate-email.js):
   - FIREBASE_PRIVATE_KEY_B64   (base64 service-account private key)
   - FIREBASE_PROJECT_ID        (jayisaac-ai)
   - FIREBASE_CLIENT_EMAIL      (firebase-adminsdk@...iam.gserviceaccount.com)
   ============================================================ */

import admin from "firebase-admin";

/* Resolve the Firebase private key exactly like generate-email.js /
   stripe-webhook.js: prefer FIREBASE_PRIVATE_KEY_B64 (base64), fall back
   to raw FIREBASE_PRIVATE_KEY with literal \n escapes. */
function resolvePrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (b64 && b64.trim()) {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  let k = process.env.FIREBASE_PRIVATE_KEY || "";
  k = k.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  return k;
}

/* ── Init Firebase Admin (once per cold start) ── */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  resolvePrivateKey(),
    }),
  });
}

const db = admin.firestore();

/* ============================================================
   SERVER-AUTHORITATIVE COST TABLE
   This — not the client — decides what an action costs. Keep the
   keys in sync with the COST objects in the two app HTML files.
   Any action not listed here is rejected (fail closed), so a typo
   or a spoofed action name can never grant a free or wrong charge.
   ============================================================ */
const ACTION_COSTS = {
  /* ── Cybersecurity app ── */
  cyber_scan:    10,  // run a vulnerability scan
  cyber_contain:  2,  // execute a containment playbook

  /* ── Chief of Staff app ── */
  staff_draft:    1,  // generate / redraft a follow-up
  staff_send:     1,  // send a drafted follow-up
  staff_brief:    2,  // rebuild the daily brief
  staff_nudge:    1,  // draft & send a delegation nudge
  staff_prep:     1,  // generate a meeting prep sheet
};

export default async function handler(req, res) {
  /* CORS — same as generate-email.js */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { idToken, action, app, meta } = req.body || {};

    /* ── Validate inputs ── */
    if (!idToken) return res.status(401).json({ ok: false, error: "Missing auth token" });
    if (!action || typeof action !== "string") {
      return res.status(400).json({ ok: false, error: "Missing action" });
    }

    /* ── Resolve the cost SERVER-SIDE (ignore any client-sent cost) ── */
    const cost = ACTION_COSTS[action];
    if (typeof cost !== "number") {
      /* unknown action → fail closed, never charge or grant */
      return res.status(400).json({ ok: false, error: "unknown_action", action });
    }

    /* ── Verify Firebase ID token ── */
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ ok: false, error: "Invalid auth token" });
    }
    const uid = decoded.uid;

    /* ── Pre-check credits (fast path) ── */
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(403).json({ ok: false, error: "User profile not found" });
    }
    const userData = userSnap.data() || {};
    const credits = typeof userData.credits === "number" ? userData.credits : 0;
    if (credits < cost) {
      return res.status(402).json({
        ok: false,
        error: "insufficient_credits",
        message: `You need ${cost} credits for this action. You have ${credits}.`,
        credits,
      });
    }

    /* ── ATOMIC CREDIT DEDUCTION (same pattern as generate-email.js) ── */
    let creditsRemaining = credits - cost;
    try {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(userRef);
        const freshCredits = (fresh.data() || {}).credits || 0;
        if (freshCredits < cost) {
          throw new Error("RACE_INSUFFICIENT_CREDITS");
        }
        tx.update(userRef, {
          credits:       admin.firestore.FieldValue.increment(-cost),
          actionsRun:    admin.firestore.FieldValue.increment(1),
          lastActionAt:  admin.firestore.FieldValue.serverTimestamp(),
          lastAction:    action,
        });
        creditsRemaining = freshCredits - cost;
      });
    } catch (txErr) {
      if (String(txErr.message).includes("RACE_INSUFFICIENT_CREDITS")) {
        return res.status(402).json({ ok: false, error: "insufficient_credits" });
      }
      console.error("app-charge transaction failed:", txErr);
      return res.status(500).json({ ok: false, error: "Credit sync failed" });
    }

    /* ── Optional: write a lightweight charge log (best-effort, non-blocking) ── */
    try {
      await userRef.collection("charges").add({
        app:    typeof app === "string" ? app.slice(0, 40) : null,
        action,
        charged: cost,
        meta:   meta && typeof meta === "object" ? meta : null,
        at:     admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (logErr) {
      /* never fail the charge just because the audit write hiccuped */
      console.warn("charge log write skipped:", logErr?.message);
    }

    /* ── Success ── */
    return res.status(200).json({
      ok: true,
      action,
      charged: cost,
      credits_remaining: creditsRemaining,
    });
  } catch (err) {
    console.error("app-charge handler crashed:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}