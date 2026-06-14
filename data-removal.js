/* ── JAYISAAC AI — Data Removal Request endpoint ──────────────
   Stores opt-out/removal requests in Firestore so the team can
   track and action them. No auth required — the person requesting
   removal may not be a platform user (they're a contact IN the DB).
   Reuses the same Firebase Admin init pattern as stripe-webhook.
   ──────────────────────────────────────────────────────────── */

import admin from "firebase-admin";

export const config = { api: { bodyParser: true } };

/* ── Firebase Admin init (lazy, same pattern as webhook) ─── */
function resolvePrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (b64 && b64.trim()) return Buffer.from(b64.trim(), "base64").toString("utf8");
  let k = process.env.FIREBASE_PRIVATE_KEY;
  if (!k) return k;
  k = k.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  k = k.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, reason } = req.body || {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    console.error("Firebase init failed:", err.message);
    return res.status(500).json({ error: "Server configuration error." });
  }

  try {
    await db.collection("removal_requests").add({
      name: (name || "").trim().slice(0, 200),
      email: email.trim().toLowerCase().slice(0, 200),
      reason: (reason || "").trim().slice(0, 1000),
      status: "pending",
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, message: "Your removal request has been received." });
  } catch (err) {
    console.error("Failed to store removal request:", err);
    return res.status(500).json({ error: "Could not process your request. Please try again." });
  }
}