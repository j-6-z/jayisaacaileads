const DRY_RUN = false;

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// full name -> 2-letter code
const FIX = {
  'British Columbia': 'BC',
  'Alberta': 'AB',
  'Ontario': 'ON',
  'Saskatchewan': 'SK',
  'Manitoba': 'MB',
  'Quebec': 'QC',
  'Nova Scotia': 'NS',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Prince Edward Island': 'PE',
};

async function run(){
  console.log('DRY_RUN:', DRY_RUN);
  const snap = await db.collection('companies').get();
  console.log('Scanning', snap.size, 'companies...\n');

  let fixed = 0;
  let batch = db.batch(), n = 0;
  const samples = [];

  for (const doc of snap.docs) {
    const loc = doc.data().location || '';
    const parts = loc.split(', ');
    if (parts.length === 2 && FIX[parts[1]]) {
      const newLoc = parts[0] + ', ' + FIX[parts[1]];
      if (samples.length < 8) samples.push(loc + '  ->  ' + newLoc);
      fixed++;
      if (!DRY_RUN) {
        batch.set(doc.ref, { location: newLoc }, { merge: true });
        n++;
        if (n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
      }
    }
  }
  if (!DRY_RUN && n > 0) await batch.commit();

  console.log('Sample fixes:');
  samples.forEach(s => console.log('  ' + s));
  console.log('\nTotal to fix:', fixed);
  console.log(DRY_RUN ? '\nDRY RUN - nothing written. Set DRY_RUN=false to apply.' : '\nDONE - locations normalized.');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });