// seed-keywords.mjs
// One-time script to bulk-import seo-keywords-seed.json into Firestore.
// Run once with: node seed-keywords.mjs
// Safe to run again later if you add more keywords to the JSON file —
// it won't duplicate existing ones since it checks first.

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seedKeywords() {
  const keywords = JSON.parse(readFileSync('./seo-keywords-seed.json', 'utf8'));

  const existingSnap = await db.collection('seo_keywords').get();
  const existingKeywords = new Set(existingSnap.docs.map((d) => d.data().keyword));

  let added = 0;
  let skipped = 0;

  for (const kw of keywords) {
    if (existingKeywords.has(kw.keyword)) {
      skipped++;
      continue;
    }
    await db.collection('seo_keywords').add(kw);
    added++;
    console.log(`Added: ${kw.keyword}`);
  }

  console.log(`\nDone. Added ${added}, skipped ${skipped} (already existed).`);
  process.exit(0);
}

seedKeywords().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
