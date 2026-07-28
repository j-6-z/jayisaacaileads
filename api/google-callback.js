/* ============================================================
   JAYISAAC AI — Google Connect (OAuth callback)
   ============================================================
   GET /api/google-callback?code=...&state=...

   Google redirects here after consent. We:
   1. Validate the state nonce (single use, 10-min expiry) -> uid
   2. Exchange the code for tokens
   3. Store the REFRESH TOKEN in Firestore at
      users/{uid}/integrations/google
   4. Redirect the user back into the app

   The refresh token is what lets the 7:00am brief run while the
   user is asleep. Access tokens are minted from it on demand and
   never stored long-term.
   ============================================================ */

import admin from "firebase-admin";

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

const APP_URL = "/app/chief-of-staff.html";

function bounce(res, status) {
  res.writeHead(302, { Location: `${APP_URL}?google=${status}` });
  return res.end();
}

export default async function handler(req, res) {
  try {
    const { code, state, error } = req.query || {};

    if (error) return bounce(res, "denied");
    if (!code || !state) return bounce(res, "missing_code");

    /* ── Validate state nonce ── */
    const stateRef = db.collection("oauth_states").doc(String(state));
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) return bounce(res, "bad_state");

    const s = stateSnap.data() || {};
    if (s.used || !s.expiresAt || Date.now() > s.expiresAt) {
      await stateRef.delete().catch(() => {});
      return bounce(res, "expired");
    }
    const uid = s.uid;
    if (!uid) return bounce(res, "bad_state");

    /* burn the nonce immediately (single use) */
    await stateRef.set({ used: true }, { merge: true });

    /* ── Exchange the code for tokens ── */
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code:          String(code),
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("Google token exchange failed:", tokenRes.status, await tokenRes.text());
      return bounce(res, "exchange_failed");
    }

    const tok = await tokenRes.json();
    /* tok: { access_token, expires_in, refresh_token, scope, token_type, id_token } */

    if (!tok.refresh_token) {
      /* Happens if the user already granted before and Google withheld it.
         prompt=consent in the start step should prevent this. */
      console.error("No refresh_token returned for uid", uid);
      return bounce(res, "no_refresh_token");
    }

    /* ── Store the integration ── */
    await db.collection("users").doc(uid)
      .collection("integrations").doc("google")
      .set({
        refreshToken: tok.refresh_token,
        scope:        tok.scope || "",
        connectedAt:  admin.firestore.FieldValue.serverTimestamp(),
        status:       "connected",
      }, { merge: true });

    /* convenience flag on the user doc so the UI can check cheaply */
    await db.collection("users").doc(uid).set({
      googleConnected: true,
      googleConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await stateRef.delete().catch(() => {});

    return bounce(res, "connected");
  } catch (err) {
    console.error("google-callback crashed:", err);
    return bounce(res, "error");
  }
}