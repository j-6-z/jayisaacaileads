/* ============================================================
   JAYISAAC AI — Google Connect (OAuth start)
   ============================================================
   POST /api/google-connect
   Body: { idToken: "<Firebase ID token>" }
   Returns: { ok: true, url: "https://accounts.google.com/o/oauth2/v2/auth?..." }

   The client redirects the user to `url`. Google sends them back to
   /api/google-callback, which stores the refresh token.

   WHY OUR OWN OAUTH (and not Firebase's Google sign-in):
   Firebase hands back a short-lived access token at sign-in only, with
   no refresh token. The Chief of Staff has to read mail and calendar at
   7:00am while the user is asleep, so we need OFFLINE access — that
   means access_type=offline + prompt=consent + a stored refresh token.

   ENV VARS REQUIRED:
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET        (used by the callback)
   - GOOGLE_REDIRECT_URI         (https://www.jayisaac.io/api/google-callback)
   - FIREBASE_PRIVATE_KEY_B64 / FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL
   ============================================================ */

import admin from "firebase-admin";
import crypto from "crypto";

function resolvePrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (b64 && b64.trim()) return Buffer.from(b64, "base64").toString("utf8");
  let k = process.env.FIREBASE_PRIVATE_KEY || "";
  return k.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
}

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

/* Scopes: read-only, least privilege.
   gmail.readonly is a RESTRICTED scope (Google verification + CASA needed
   for general availability; up to 100 test users work immediately).
   calendar.readonly is SENSITIVE (verification, no security assessment). */
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
].join(" ");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(401).json({ ok: false, error: "Missing auth token" });

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ ok: false, error: "Invalid auth token" });
    }
    const uid = decoded.uid;

    const clientId    = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      console.error("Google OAuth env vars missing");
      return res.status(500).json({ ok: false, error: "Server not configured" });
    }

    /* Opaque, single-use state tied to this uid. Expires in 10 minutes.
       Prevents anyone from binding their Google account to another uid. */
    const nonce = crypto.randomBytes(24).toString("hex");
    await db.collection("oauth_states").doc(nonce).set({
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: Date.now() + 10 * 60 * 1000,
      used: false,
    });

    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: "code",
      scope:         SCOPES,
      access_type:   "offline",   // <- gives us the refresh token
      prompt:        "consent",   // <- forces refresh token even on re-auth
      include_granted_scopes: "true",
      state:         nonce,
    });

    return res.status(200).json({
      ok: true,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    });
  } catch (err) {
    console.error("google-connect crashed:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}