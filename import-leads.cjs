const DRY_RUN = false;
const SKIP_EXISTING_CHECK = false;

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const SCRAPE_DIR = path.join(__dirname, 'scrape');
const FILES = ['canada_master.csv', 'texas_master.csv', 'florida_master.csv'];

const INDUSTRY_MAP = {
  landscaping: 'Landscaping', construction: 'Construction', contruction: 'Construction',
  hvac: 'HVAC', dental: 'Dental', roofing: 'Roofing', electrical: 'Electrical',
  electrician: 'Electrical', electricians: 'Electrical', cleaning: 'Cleaning',
  law: 'Legal', lawyers: 'Legal', plumbing: 'Plumbing', plumber: 'Plumbing',
  painting: 'Painting', doctor: 'Medical', restaraunts: 'Restaurants',
  restaurants: 'Restaurants', hauling: 'Hauling',
};
const CITY_REGION = {
  victoria:'BC', vancouver:'BC', calgary:'AB', edmonton:'AB', winnipeg:'MB',
  winnepeg:'MB', saskatoon:'SK', regina:'SK', toronto:'ON', ottawa:'ON', montreal:'QC',
};
const STATE_ABBR = { texas:'TX', florida:'FL' };

function parseCSV(text){
  const rows=[]; let row=[],field='',inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],nx=text[i+1];
    if(inQ){ if(c==='"'&&nx==='"'){field+='"';i++;} else if(c==='"'){inQ=false;} else {field+=c;} }
    else { if(c==='"'){inQ=true;} else if(c===','){row.push(field);field='';}
      else if(c==='\r'){} else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else {field+=c;} }
  }
  if(field.length||row.length){row.push(field);rows.push(row);}
  return rows;
}
function titleCase(s){ return s.replace(/\w\S*/g,t=>t.charAt(0).toUpperCase()+t.slice(1).toLowerCase()); }
function industryFromSourceFile(sf){
  const m=(sf||'').match(/bing-maps\s+\S+\s+([a-zA-Z]+)\.csv/i);
  if(!m) return 'Other';
  return INDUSTRY_MAP[m[1].toLowerCase()] || 'Other';
}
function buildLocation(city,state){
  const cp = city ? titleCase(city.replace(/_/g,' ')) : '';
  let r=''; if(state){ r=STATE_ABBR[state.toLowerCase()]||state; } else { r=CITY_REGION[(city||'').toLowerCase()]||''; }
  if(cp&&r) return cp+', '+r; return cp||r||'';
}
function normPhone(p){ return (p||'').replace(/\D/g,''); }
function makeDocId(name,city){
  const base=(name+'-'+city).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  let h=0; for(const ch of (name+city)) h=(h*31+ch.charCodeAt(0))>>>0;
  return base+'-'+h.toString(36);
}

async function run(){
  console.log('============================================');
  console.log('  LEAD IMPORT -> companies');
  console.log('  DRY_RUN: '+DRY_RUN);
  console.log('============================================\n');
  const all=[];
  for(const file of FILES){
    const full=path.join(SCRAPE_DIR,file);
    if(!fs.existsSync(full)){ console.log('  !! missing: '+file); continue; }
    const rows=parseCSV(fs.readFileSync(full,'utf8'));
    const header=rows.shift().map(h=>h.trim());
    const idx=n=>header.indexOf(n);
    let count=0;
    for(const r of rows){
      if(!r.length||!r[idx('Name')]) continue;
      all.push({
        name:(r[idx('Name')]||'').trim(), address:(r[idx('Address')]||'').trim(),
        phone:(r[idx('Phone')]||'').trim(), website:(r[idx('Website')]||'').trim(),
        rating:(r[idx('Rating')]||'').trim(), reviews:(r[idx('Reviews')]||'').trim(),
        source:(r[idx('SourceFile')]||'').trim(), city:(r[idx('City')]||'').trim(),
        state: idx('State')>=0 ? (r[idx('State')]||'').trim() : '',
      });
      count++;
    }
    console.log('  '+file+': '+count+' rows');
  }
  console.log('\n  Total raw rows: '+all.length+'\n');

  const seen=new Set(); const records=[]; const industryCounts={}; let dupInBatch=0;
  for(const r of all){
    const industry=industryFromSourceFile(r.source);
    const location=buildLocation(r.city,r.state);
    const key=normPhone(r.phone) || (r.name+'|'+r.city).toLowerCase();
    if(seen.has(key)){ dupInBatch++; continue; }
    seen.add(key);
    industryCounts[industry]=(industryCounts[industry]||0)+1;
    const docId=makeDocId(r.name,r.city);
    const pub={
      companyName:r.name, personName:null, title:null, industry, location,
      employeeCount:0, website:r.website||'',
      rating:r.rating?(parseFloat(r.rating)||r.rating):'',
      reviewCount:r.reviews?(parseInt(r.reviews)||0):0,
      country:r.state?'US':'CA', recordType:'company', verified:false,
      dataQuality:'scraped', importedAt:admin.firestore.FieldValue.serverTimestamp(),
    };
    const priv=r.phone?{phone:r.phone,email:null,emailStatus:null,linkedin:null}:null;
    records.push({docId,pub,priv});
  }
  console.log('  After in-batch dedupe: '+records.length+' unique  ('+dupInBatch+' dupes removed)\n');
  console.log('  Industry breakdown:');
  Object.entries(industryCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('    '+k.padEnd(14)+v));
  console.log('');

  let existing=new Set();
  if(!SKIP_EXISTING_CHECK){
    console.log('  Loading existing companies for cross-dedupe...');
    const snap=await db.collection('companies').get();
    snap.forEach(d=>{ const x=d.data(); existing.add(((x.companyName||'').toLowerCase())+'|'+((x.location||'').toLowerCase())); });
    console.log('  Existing companies: '+snap.size+'\n');
  }
  let willWrite=0,skipExisting=0; const toWrite=[];
  for(const rec of records){
    const nl=rec.pub.companyName.toLowerCase()+'|'+(rec.pub.location||'').toLowerCase();
    if(existing.has(nl)){ skipExisting++; continue; }
    toWrite.push(rec); willWrite++;
  }
  console.log('  New to write: '+willWrite+'   (skipping '+skipExisting+' already in DB)\n');
  console.log('  SAMPLE RECORDS (first 3):');
  toWrite.slice(0,3).forEach((rec,i)=>{
    console.log('\n  ['+(i+1)+'] id: '+rec.docId);
    console.log('    public :',JSON.stringify({...rec.pub,importedAt:'<ts>'}));
    console.log('    private:',JSON.stringify(rec.priv));
  });
  console.log('');
  if(DRY_RUN){
    console.log('============================================');
    console.log('  DRY RUN COMPLETE - nothing written.');
    console.log('  If counts look right, set DRY_RUN = false and run again.');
    console.log('============================================');
    process.exit(0);
  }
  console.log('  Writing to Firestore...');
  let batch=db.batch(),n=0,written=0;
  for(const rec of toWrite){
    batch.set(db.collection('companies').doc(rec.docId),rec.pub);
    if(rec.priv) batch.set(db.collection('companies_private').doc(rec.docId),rec.priv);
    n++;
    if(n>=400){ await batch.commit(); written+=n; process.stdout.write('  ...'+written+'\r'); batch=db.batch(); n=0; }
  }
  if(n>0){ await batch.commit(); written+=n; }
  console.log('\n\n  DONE - wrote '+written+' companies.');
  process.exit(0);
}
run().catch(e=>{ console.error('ERROR:',e); process.exit(1); });