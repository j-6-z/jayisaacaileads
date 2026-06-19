// ============================================================
// MIGRATE CONTACTS -> people + companies (with PII separation)
// ============================================================
// What it does:
//   1. Reads every doc in `contacts` (and matching `contacts_private`)
//   2. Classifies as PERSON (n is filled) or COMPANY (n is null)
//   3. Moves to:
//        - `people` + `people_private`   (for person records)
//        - `companies` + `companies_private`  (for company-only records)
//   4. Renames abbreviated fields to readable names
//   5. DRY RUN by default - shows what it WOULD do without writing
//
// Usage:
//   1. Make sure serviceAccountKey.json is in this folder
//   2. Verify DRY_RUN = true (line below)
//   3. Run:  node migrate-contacts.cjs
//   4. Review output
//   5. Set DRY_RUN = false, run again to commit
// ============================================================

const DRY_RUN = false;   // <-- Set to false when ready to write
const DELETE_OLD = false;  // <-- Set to true to delete from `contacts` after copying (do this LAST)

// ============================================================

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Field rename map: abbreviated -> readable
const PUBLIC_FIELD_MAP = {
  c: 'companyName',
  n: 'personName',
  t: 'title',
  i: 'industry',
  l: 'location',
  ce: 'employeeCount',
  country: 'country',
  eDomain: 'emailDomain',
  website: 'website',
  rating: 'rating',
  reviewCount: 'reviewCount',
  foundedYear: 'foundedYear',
  revenue: 'revenue',
  verified: 'verified',
  dataQuality: 'dataQuality',
  importedAt: 'importedAt'
};

const PRIVATE_FIELD_MAP = {
  e: 'email',
  emailStatus: 'emailStatus',
  linkedin: 'linkedin',
  p: 'phone'
};

// Helper: rename keys in an object based on a map
function remapFields(data, fieldMap) {
  const out = {};
  for (const [oldKey, value] of Object.entries(data)) {
    const newKey = fieldMap[oldKey] || oldKey;  // unknown fields keep their name
    out[newKey] = value;
  }
  return out;
}

// Helper: detect if a value is "really null/empty"
function isEmpty(val) {
  return val === null || val === undefined || val === '' ||
         (typeof val === 'string' && val.trim() === '');
}

async function migrate() {
  console.log('============================================');
  console.log('  CONTACT MIGRATION');
  console.log(`  DRY_RUN: ${DRY_RUN}`);
  console.log(`  DELETE_OLD: ${DELETE_OLD}`);
  console.log('============================================');
  console.log('');

  console.log('Loading contacts collection...');
  const contactsSnap = await db.collection('contacts').get();
  console.log(`  Found ${contactsSnap.size} contacts`);

  console.log('Loading contacts_private collection...');
  const privateSnap = await db.collection('contacts_private').get();
  console.log(`  Found ${privateSnap.size} private records`);

  // Build a lookup map for private records by doc ID
  const privateMap = new Map();
  privateSnap.forEach(doc => {
    privateMap.set(doc.id, doc.data());
  });
  console.log('');

  // Stats
  const stats = {
    total: 0,
    people: 0,
    companies: 0,
    skipped_empty: 0,
    has_private: 0,
    missing_private: 0
  };

  const samples = { people: [], companies: [], skipped: [] };

  // Batches for writes (Firestore batch limit = 500)
  let batchPeople = db.batch();
  let batchPeoplePriv = db.batch();
  let batchCompanies = db.batch();
  let batchCompaniesPriv = db.batch();
  let batchDelete = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 400;  // safety margin under 500

  async function commitBatches() {
    if (DRY_RUN || batchCount === 0) return;
    await Promise.all([
      batchPeople.commit(),
      batchPeoplePriv.commit(),
      batchCompanies.commit(),
      batchCompaniesPriv.commit(),
      DELETE_OLD ? batchDelete.commit() : Promise.resolve()
    ]);
    batchPeople = db.batch();
    batchPeoplePriv = db.batch();
    batchCompanies = db.batch();
    batchCompaniesPriv = db.batch();
    batchDelete = db.batch();
    batchCount = 0;
  }

  console.log('Processing...');
  console.log('');

  for (const doc of contactsSnap.docs) {
    stats.total++;
    const data = doc.data();
    const docId = doc.id;
    const privateData = privateMap.get(docId);

    if (privateData) stats.has_private++;
    else stats.missing_private++;

    // Skip totally empty records (no name AND no company)
    if (isEmpty(data.n) && isEmpty(data.c)) {
      stats.skipped_empty++;
      if (samples.skipped.length < 3) {
        samples.skipped.push({ id: docId, data });
      }
      continue;
    }

    // Classify
    const isPerson = !isEmpty(data.n);

    // Remap public fields
    const newPublic = remapFields(data, PUBLIC_FIELD_MAP);
    newPublic.recordType = isPerson ? 'person' : 'company';
    newPublic.migratedAt = admin.firestore.FieldValue.serverTimestamp();

    // Remap private fields if any
    const newPrivate = privateData ? remapFields(privateData, PRIVATE_FIELD_MAP) : null;

    if (isPerson) {
      stats.people++;
      if (samples.people.length < 3) {
        samples.people.push({ id: docId, public: newPublic, private: newPrivate });
      }

      if (!DRY_RUN) {
        batchPeople.set(db.collection('people').doc(docId), newPublic);
        if (newPrivate) {
          batchPeoplePriv.set(db.collection('people_private').doc(docId), newPrivate);
        }
      }
    } else {
      stats.companies++;
      if (samples.companies.length < 3) {
        samples.companies.push({ id: docId, public: newPublic, private: newPrivate });
      }

      if (!DRY_RUN) {
        batchCompanies.set(db.collection('companies').doc(docId), newPublic);
        if (newPrivate) {
          batchCompaniesPriv.set(db.collection('companies_private').doc(docId), newPrivate);
        }
      }
    }

    if (DELETE_OLD && !DRY_RUN) {
      batchDelete.delete(db.collection('contacts').doc(docId));
      if (privateData) {
        batchDelete.delete(db.collection('contacts_private').doc(docId));
      }
    }

    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await commitBatches();
      process.stdout.write(`  Processed ${stats.total}...\r`);
    }
  }

  await commitBatches();

  console.log('');
  console.log('');
  console.log('============================================');
  console.log('  RESULTS');
  console.log('============================================');
  console.log(`  Total processed:    ${stats.total}`);
  console.log(`  -> People:          ${stats.people}`);
  console.log(`  -> Companies:       ${stats.companies}`);
  console.log(`  -> Skipped (empty): ${stats.skipped_empty}`);
  console.log('');
  console.log(`  Had private data:    ${stats.has_private}`);
  console.log(`  Missing private:     ${stats.missing_private}`);
  console.log('');

  console.log('============================================');
  console.log('  SAMPLE PERSON RECORDS (first 3)');
  console.log('============================================');
  samples.people.forEach((s, i) => {
    console.log(`\n  [${i+1}] ID: ${s.id}`);
    console.log('  Public:', JSON.stringify(s.public, null, 2).split('\n').map(l => '    ' + l).join('\n').trim());
    if (s.private) {
      console.log('  Private:', JSON.stringify(s.private, null, 2).split('\n').map(l => '    ' + l).join('\n').trim());
    }
  });

  console.log('');
  console.log('============================================');
  console.log('  SAMPLE COMPANY RECORDS (first 3)');
  console.log('============================================');
  samples.companies.forEach((s, i) => {
    console.log(`\n  [${i+1}] ID: ${s.id}`);
    console.log('  Public:', JSON.stringify(s.public, null, 2).split('\n').map(l => '    ' + l).join('\n').trim());
    if (s.private) {
      console.log('  Private:', JSON.stringify(s.private, null, 2).split('\n').map(l => '    ' + l).join('\n').trim());
    }
  });

  if (samples.skipped.length > 0) {
    console.log('');
    console.log('============================================');
    console.log('  SAMPLE SKIPPED (empty)');
    console.log('============================================');
    samples.skipped.forEach((s, i) => {
      console.log(`\n  [${i+1}] ID: ${s.id}`);
      console.log('  Data:', JSON.stringify(s.data, null, 2).split('\n').map(l => '    ' + l).join('\n').trim());
    });
  }

  console.log('');
  console.log('============================================');
  if (DRY_RUN) {
    console.log('  DRY RUN COMPLETE - no writes made');
    console.log('  Review the samples above');
    console.log('  If they look correct, set DRY_RUN = false');
    console.log('  Keep DELETE_OLD = false for the first real run');
    console.log('  After verifying in Firestore Console, set DELETE_OLD = true and run once more');
  } else {
    console.log('  MIGRATION COMPLETE');
    if (!DELETE_OLD) {
      console.log('  Old `contacts` collection NOT deleted (DELETE_OLD = false)');
      console.log('  Verify new collections in Firestore Console');
      console.log('  Then set DELETE_OLD = true and run again to clean up');
    } else {
      console.log('  Old contacts records deleted');
    }
  }
  console.log('============================================');

  process.exit(0);
}

migrate().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
