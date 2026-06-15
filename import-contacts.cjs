/* ============================================================
   JAYISAAC AI — Universal Import Script (v2)
   ============================================================
   Handles TWO formats automatically:
     1. Outscraper (111 or 81 cols) — full enrichment
     2. D7 / JAYISAAC Reports (8 cols) — basic fields only

   Writes to Firestore:
     - contacts          (public)
     - contacts_private  (email + phone, gated by credits)

   USAGE:
     node import-contacts.js ./folder
     node import-contacts.js file1.xlsx file2.csv ...
   ============================================================ */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const admin = require("firebase-admin");

/* ── CONFIG ───────────────────────────────────────────────── */
const DRY_RUN = false;
const SKIP_CHAINS = true;
const BATCH_SIZE = 450;
const MAX_RECORDS = 100000;

/* ── OUTSCRAPER COLUMN MAP (full-enrichment format) ──────── */
const OUTSCRAPER_MAP = {
  name: "businessName", category: "category", type: "type", subtypes: "subtypes",
  phone: "phone", website: "website", address: "address", city: "city",
  state: "state", state_code: "stateCode", postal_code: "postalCode",
  country: "country", country_code: "countryCode", domain: "domain",
  full_name: "ownerFullName", first_name: "ownerFirstName", last_name: "ownerLastName",
  title: "ownerTitle", email: "email",
  "email.emails_validator.status": "emailStatus",
  contact_phone: "contactPhone", contact_linkedin: "linkedin",
  company_linkedin: "companyLinkedin", rating: "rating", reviews: "reviewCount",
  verified: "googleVerified",
  "company_insights.employees": "employees",
  "company_insights.revenue": "revenue",
  "company_insights.founded_year": "foundedYear",
  "company_insights.industry": "industryNorm",
  "chain_info.chain": "chainName",
  place_id: "placeId", cid: "googleCid", latitude: "lat", longitude: "lng",
};

/* ── D7 REPORT COLUMN MAP (basic format) ─────────────────── */
const D7_MAP = {
  BusinessName: "businessName",
  Telephone:    "phone",
  WebsiteURL:   "website",
  MainCategory: "category",
  Address:      "address",
  City:         "city",
  State:        "state",
  ZIP:          "postalCode",
};

const INDUSTRY_NORMALIZE = {
  "Roofing contractor": "Roofing", "Roofer": "Roofing",
  "HVAC contractor": "HVAC", "Heating contractor": "HVAC",
  "Air conditioning contractor": "HVAC", "Air conditioning repair service": "HVAC",
  "Heating equipment supplier": "HVAC", "Hvac": "HVAC", "HVAC": "HVAC",
  "Plumber": "Plumbing", "Plumbing": "Plumbing", "Drainage service": "Plumbing",
  "Electrician": "Electrical", "Electrical installation service": "Electrical",
  "Electrical contractor": "Electrical",
  "Construction company": "Construction", "General contractor": "Construction",
  "Building construction": "Construction",
  "Landscaper": "Landscaping", "Landscape designer": "Landscaping",
  "Lawn care service": "Landscaping", "Landscaping": "Landscaping",
  "Painter": "Painting", "Pest control service": "Pest Control",
  "Cleaning service": "Cleaning", "Janitorial service": "Cleaning",
  "House cleaning service": "Cleaning", "Moving company": "Moving",
  "Dentist": "Dental", "Dental clinic": "Dental",
  "Cosmetic dentist": "Dental", "Dental implants periodontist": "Dental",
  "Insurance agency": "Insurance", "Insurance broker": "Insurance",
  "Auto insurance agency": "Insurance",
  "Financial consultant": "Financial Services", "Financial planner": "Financial Services",
  "Financial institution": "Financial Services", "Investment service": "Financial Services",
  "Marketing agency": "Marketing", "Advertising agency": "Marketing",
  "Internet marketing service": "Marketing", "Marketing consultant": "Marketing",
  "Real estate agency": "Real Estate", "Real estate consultant": "Real Estate",
  "Commercial real estate agency": "Real Estate",
  "Law firm": "Legal", "Personal injury attorney": "Legal",
  "Attorney": "Legal", "Legal services": "Legal", "Lawyer": "Legal",
  "Software company": "IT Services", "Computer support and services": "IT Services",
  "IT services": "IT Services", "Website designer": "IT Services",
  "Medical clinic": "Healthcare", "Veterinarian": "Veterinary",
  "Animal hospital": "Veterinary", "Chiropractor": "Chiropractic",
  "Physical therapist": "Physical Therapy",
};

function normalizeIndustry(category, type, subtypes) {
  for (const raw of [category, type, subtypes]) {
    if (!raw) continue;
    const tokens = String(raw).split(/[,/]/).map(t => t.trim());
    for (const tok of tokens) {
      if (INDUSTRY_NORMALIZE[tok]) return INDUSTRY_NORMALIZE[tok];
    }
  }
  return category || "Other";
}

if (!DRY_RUN) {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = DRY_RUN ? null : admin.firestore();

function clean(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
}
function cleanNum(val) { const n = parseInt(val); return isNaN(n) ? null : n; }
function genId(businessName, city) {
  const base = (businessName + "-" + city).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const hash = Math.abs(base.split("").reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)).toString(36);
  return base + "-" + hash;
}

/* Detect which format the file is in by looking at headers */
function detectFormat(headers) {
  const headerSet = new Set(headers);
  if (headerSet.has("BusinessName") && headerSet.has("Telephone") && headerSet.has("WebsiteURL")) {
    return "d7";
  }
  if (headerSet.has("name") && headerSet.has("category") && (headerSet.has("phone") || headerSet.has("email"))) {
    return "outscraper";
  }
  return "unknown";
}

function mapRow(rawRow, format) {
  const map = format === "d7" ? D7_MAP : OUTSCRAPER_MAP;
  const out = { _source: format };
  for (const [srcCol, ourField] of Object.entries(map)) {
    out[ourField] = rawRow[srcCol];
  }
  return out;
}

function parseFile(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  let rawRows;

  if (ext === ".xlsx") {
    const wb = XLSX.readFile(filepath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(ws, { defval: null });
  } else if (ext === ".csv") {
    const wb = XLSX.readFile(filepath, { type: "string" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(ws, { defval: null });
  } else {
    console.log(`   ⏭️  Skipping ${path.basename(filepath)} (unsupported extension)`);
    return [];
  }

  if (!rawRows.length) {
    console.log(`   ⚠️  Empty file: ${path.basename(filepath)}`);
    return [];
  }

  const headers = Object.keys(rawRows[0]);
  const format = detectFormat(headers);

  if (format === "unknown") {
    console.log(`   ⏭️  Skipping ${path.basename(filepath)} (format not recognized — ${headers.length} cols)`);
    return [];
  }

  const tag = format === "outscraper" ? "🔥 RICH" : "📞 BASIC";
  console.log(`   ${tag} ${path.basename(filepath)} — ${rawRows.length.toLocaleString()} rows`);

  return rawRows.map(r => mapRow(r, format));
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: node import-contacts.js <file | folder> [more...]");
    process.exit(1);
  }

  const files = [];
  for (const a of args) {
    const stat = fs.statSync(a);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(a).filter(f => f.endsWith(".xlsx") || f.endsWith(".csv"));
      entries.forEach(e => files.push(path.join(a, e)));
    } else {
      files.push(a);
    }
  }

  console.log("=".repeat(60));
  console.log(`JAYISAAC AI — Universal Import (v2)`);
  console.log("=".repeat(60));
  console.log(`Files: ${files.length} | Dry run: ${DRY_RUN}`);
  console.log("=".repeat(60));

  let allRows = [];
  let richCount = 0, basicCount = 0;
  for (const f of files) {
    const rows = parseFile(f);
    allRows = allRows.concat(rows);
    rows.forEach(r => r._source === "outscraper" ? richCount++ : basicCount++);
  }
  console.log(`\n📊 Total raw: ${allRows.length.toLocaleString()}`);
  console.log(`   🔥 Rich:  ${richCount.toLocaleString()}`);
  console.log(`   📞 Basic: ${basicCount.toLocaleString()}`);

  /* Dedup — when same business in both, keep the RICH one */
  const seen = new Map();
  let duplicates = 0;
  for (const r of allRows) {
    const key = `${(r.businessName || "").toLowerCase()}::${(r.city || "").toLowerCase()}`;
    if (seen.has(key)) {
      duplicates++;
      const existing = seen.get(key);
      // Always prefer rich format over basic
      if (r._source === "outscraper" && existing._source === "d7") {
        seen.set(key, r);
      } else if (r._source === existing._source) {
        // Same format — keep the one with more data
        const newScore = (r.email?1:0)+(r.phone?1:0)+(r.ownerFullName?1:0)+(r.employees?1:0);
        const oldScore = (existing.email?1:0)+(existing.phone?1:0)+(existing.ownerFullName?1:0)+(existing.employees?1:0);
        if (newScore > oldScore) seen.set(key, r);
      }
    } else {
      seen.set(key, r);
    }
  }
  const dedupedRows = Array.from(seen.values());
  console.log(`🔁 Duplicates removed: ${duplicates.toLocaleString()}`);
  console.log(`✅ After dedup: ${dedupedRows.length.toLocaleString()}`);

  /* Filter */
  let kept = 0, skippedChain = 0, skippedNoContact = 0, skippedNoName = 0;
  const filtered = dedupedRows.filter(r => {
    if (!clean(r.businessName)) { skippedNoName++; return false; }
    if (SKIP_CHAINS && clean(r.chainName)) { skippedChain++; return false; }
    if (!clean(r.email) && !clean(r.phone) && !clean(r.contactPhone)) {
      skippedNoContact++;
      return false;
    }
    kept++;
    return true;
  });
  console.log(`\n🚫 Filtered out: chains=${skippedChain}, no-contact=${skippedNoContact}, no-name=${skippedNoName}`);
  console.log(`✅ Final: ${kept.toLocaleString()}`);

  if (DRY_RUN) {
    console.log("\n🟡 DRY RUN — no writes. Sample of first 5:");
    filtered.slice(0, 5).forEach((r, i) => {
      console.log(`\n--- ${i+1} (${r._source.toUpperCase()}) ---`);
      console.log(`  Business: ${r.businessName}`);
      console.log(`  Owner:    ${r.ownerFullName || "(none)"}`);
      console.log(`  Industry: ${normalizeIndustry(r.category, r.type, r.subtypes)}`);
      console.log(`  Location: ${r.city || "?"}, ${r.stateCode || r.state || "?"}`);
      console.log(`  Email:    ${r.email || "(none)"}`);
      console.log(`  Phone:    ${r.phone || "(none)"}`);
    });
    process.exit(0);
  }

  console.log(`\n🔥 Writing to Firestore in batches of ${BATCH_SIZE}...`);
  const start = Date.now();
  let written = 0;

  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = filtered.slice(i, i + BATCH_SIZE);

    for (const r of slice) {
      const id = genId(r.businessName, r.city || "unknown");
      const industry = normalizeIndustry(r.category, r.type, r.subtypes);
      const isRich = r._source === "outscraper";

      const publicDoc = {
        n: clean(r.ownerFullName) || null,
        t: clean(r.ownerTitle) || null,
        c: clean(r.businessName),
        ce: cleanNum(r.employees) || 0,
        l: [clean(r.city), clean(r.stateCode || r.state)].filter(Boolean).join(", ") || "Unknown",
        i: industry,
        eDomain: clean(r.domain) || null,
        website: clean(r.website) || null,
        rating: r.rating ? parseFloat(r.rating) : null,
        reviewCount: cleanNum(r.reviewCount),
        revenue: cleanNum(r.revenue),
        foundedYear: cleanNum(r.foundedYear),
        verified: !!r.googleVerified,
        country: clean(r.countryCode) || (r.state ? "US" : null),
        dataQuality: isRich ? "rich" : "basic",
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const privateDoc = {
        e: clean(r.email) || null,
        p: clean(r.phone) || clean(r.contactPhone) || null,
        linkedin: clean(r.linkedin) || clean(r.companyLinkedin) || null,
        emailStatus: clean(r.emailStatus) || null,
      };

      batch.set(db.collection("contacts").doc(id), publicDoc);
      batch.set(db.collection("contacts_private").doc(id), privateDoc);
      written++;
    }

    await batch.commit();
    const pct = Math.round((i + slice.length) / filtered.length * 100);
    process.stdout.write(`\r   ${pct}% — ${written.toLocaleString()} / ${filtered.length.toLocaleString()}`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n\n✅ DONE — ${written.toLocaleString()} contacts written in ${elapsed}s`);
  console.log(`🎉 Open: https://jayisaacai.com/app.html`);
}

main().catch(err => {
  console.error("\n❌ Import failed:", err);
  process.exit(1);
});