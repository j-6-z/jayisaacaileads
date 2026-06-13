/* ============================================================
   JAYISAAC AI — contact database importer
   Loads a CSV of business contacts into Firestore using the
   split public/private schema that app.html + firestore.rules expect.

   SETUP (one time):
     1. Firebase Console → Project Settings → Service accounts
        → "Generate new private key" → save as serviceAccountKey.json
        in this folder. NEVER commit this file (add to .gitignore).
     2. npm init -y
     3. npm install firebase-admin csv-parse

   RUN:
     node import-contacts.js ./my-outscraper-export.csv

   Re-running is safe: doc IDs are deterministic (hash of company+name),
   so the same row updates in place instead of duplicating.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parse } = require("csv-parse/sync");
const admin = require("firebase-admin");

/* ── 1. COLUMN MAPPING — edit these to match your CSV headers ──
   Left side = our field. Right side = list of header names to try,
   in priority order (covers Outscraper + Apollo + generic exports). */
const COLUMN_MAP = {
  name:     ["name", "full_name", "contact_name", "owner_name", "first_and_last"],
  title:    ["title", "job_title", "position", "role"],
  company:  ["company", "company_name", "business_name", "organization", "query"],
  email:    ["email", "email_1", "contact_email", "work_email"],
  phone:    ["phone", "phone_1", "phone_number", "contact_phone", "mobile"],
  city:     ["city", "locality", "town"],
  region:   ["region", "state", "province", "us_state", "state_code", "province_code"],
  industry: ["industry", "category", "type", "subtypes", "vertical"],
  employees:["employees", "employee_count", "headcount", "staff_count", "company_size"],
  website:  ["website", "site", "domain", "url", "company_website"],
  revenue:  ["revenue", "estimated_revenue", "annual_revenue", "revenue_range"],
};

/* ── 2. NORMALIZERS ── */
const PROVINCE_CODES = {
  "alberta":"AB","british columbia":"BC","manitoba":"MB","new brunswick":"NB",
  "newfoundland and labrador":"NL","nova scotia":"NS","ontario":"ON",
  "prince edward island":"PE","quebec":"QC","saskatchewan":"SK",
  "northwest territories":"NT","nunavut":"NU","yukon":"YT",
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA",
  "colorado":"CO","connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA",
  "hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS",
  "kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA",
  "michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT",
  "nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM",
  "new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK",
  "oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC",
  "south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT",
  "virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
};
function normProvince(raw){
  if(!raw) return "";
  const t = String(raw).trim();
  if(/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return PROVINCE_CODES[t.toLowerCase()] || t.slice(0,2).toUpperCase();
}

const INDUSTRY_RULES = [
  [/plumb|drain|sewer/i,            "Plumbing"],
  [/hvac|heating|cooling|air condition|furnace|mechanical/i, "HVAC"],
  [/roof|shingle|exterior/i,        "Roofing"],
  [/electric/i,                     "Electrical"],
  [/landscap|lawn|snow|tree service/i, "Landscaping"],
  [/construct|contractor|builder|renovat/i, "Construction"],
  [/mover|moving/i,                 "Moving"],
  [/clean|janitor|restoration/i,    "Cleaning"],
  [/auto|mechanic|towing|tire/i,    "Automotive"],
  [/real estate|property/i,         "Real Estate"],
];
function normIndustry(raw){
  const t = String(raw || "").trim();
  for(const [re, label] of INDUSTRY_RULES) if(re.test(t)) return label;
  return t ? t.split(",")[0].trim().replace(/\b\w/g, c=>c.toUpperCase()).slice(0,40) : "Other";
}

const TITLE_RULES = [
  [/owner|founder|proprietor/i,                       "owner"],
  [/president|chief executive|ceo/i,                  "president_ceo"],
  [/operations|coo|general manager|^gm$|branch manager/i, "operations"],
  [/office manager|office admin|administrator/i,      "office_manager"],
  [/sales|business development|account exec/i,        "sales"],
];
function normTitleCategory(raw){
  const t = String(raw || "");
  for(const [re, cat] of TITLE_RULES) if(re.test(t)) return cat;
  return "other";
}

function sizeBucket(n){
  if(!n || isNaN(n)) return "unknown";
  if(n <= 10) return "1-10";
  if(n <= 50) return "11-50";
  return "51-200";
}

function cleanPhone(raw){
  if(!raw) return "";
  const d = String(raw).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if(d.length !== 10) return String(raw).trim();
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

function pick(row, keys){
  for(const k of keys){
    /* case-insensitive header match */
    const hit = Object.keys(row).find(h => h.trim().toLowerCase() === k);
    if(hit && String(row[hit]).trim()) return String(row[hit]).trim();
  }
  return "";
}

/* ── 3. MAIN ── */
async function main(){
  const csvPath = process.argv[2];
  if(!csvPath){ console.error("Usage: node import-contacts.js <file.csv>"); process.exit(1); }

  const keyPath = path.join(__dirname, "serviceAccountKey.json");
  if(!fs.existsSync(keyPath)){
    console.error("Missing serviceAccountKey.json — download it from Firebase Console → Project Settings → Service accounts.");
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
  const db = admin.firestore();

  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true, bom: true });
  console.log(`Parsed ${rows.length} rows from ${csvPath}`);

  let written = 0, skipped = 0;
  let batch = db.batch(), inBatch = 0;

  for(const row of rows){
    const name    = pick(row, COLUMN_MAP.name);
    const company = pick(row, COLUMN_MAP.company);
    const email   = pick(row, COLUMN_MAP.email).toLowerCase();
    const phone   = cleanPhone(pick(row, COLUMN_MAP.phone));

    /* a record needs a company and at least one channel to be sellable */
    if(!company || (!email && !phone)){ skipped++; continue; }

    const title    = pick(row, COLUMN_MAP.title) || "Owner";
    const city     = pick(row, COLUMN_MAP.city);
    const province = normProvince(pick(row, COLUMN_MAP.region));
    const industry = normIndustry(pick(row, COLUMN_MAP.industry));
    const empRaw   = parseInt(pick(row, COLUMN_MAP.employees), 10);
    const employees= isNaN(empRaw) ? 0 : empRaw;
    const website  = pick(row, COLUMN_MAP.website).replace(/^https?:\/\//,"").replace(/\/$/,"");
    const revenue  = pick(row, COLUMN_MAP.revenue);

    /* deterministic ID so re-imports update instead of duplicate */
    const id = crypto.createHash("sha1")
      .update((company + "|" + (name || email || phone)).toLowerCase())
      .digest("hex").slice(0, 20);

    const publicDoc = {
      n: name || "Decision Maker",
      t: title,
      c: company,
      ce: employees,
      l: city && province ? `${city}, ${province}` : (city || province || "North America"),
      i: industry,
      province,
      sizeBucket: sizeBucket(employees),
      titleCategory: normTitleCategory(title),
      eDomain: email ? email.split("@")[1] : "",
      hasEmail: !!email,
      hasPhone: !!phone,
      website,
      revenue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const privateDoc = { e: email, p: phone };

    batch.set(db.collection("contacts").doc(id), publicDoc, { merge: true });
    batch.set(db.collection("contacts_private").doc(id), privateDoc, { merge: true });
    inBatch += 2; written++;

    if(inBatch >= 480){           /* Firestore batch limit is 500 ops */
      await batch.commit();
      console.log(`  committed ${written} contacts…`);
      batch = db.batch(); inBatch = 0;
    }
  }
  if(inBatch > 0) await batch.commit();

  console.log(`\nDONE — imported/updated: ${written}, skipped (no company or no channel): ${skipped}`);
  console.log("Collections written: contacts (public fields) + contacts_private (email/phone).");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });