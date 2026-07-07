// lib/firebaseAdmin.js
// Shared Firebase Admin SDK initializer for serverless functions.
// Requires these env vars in Vercel:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste with \n literal newlines, this file handles the conversion)

const admin = require('firebase-admin');

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  return admin;
}

module.exports = { getFirebaseAdmin };
