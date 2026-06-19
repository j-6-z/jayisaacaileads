# ============================================================
# patch-app.ps1
# Updates app.html to read the NEW Firestore collections
# (people / people_private / companies) instead of `contacts`.
#
# Run from:  C:\Users\jaytu\OneDrive\Desktop\jayisaacaileads
#   .\patch-app.ps1
# Makes a timestamped backup first. Safe + reversible.
# ============================================================

$ErrorActionPreference = "Stop"
$file = ".\app.html"

if (-not (Test-Path $file)) {
    Write-Host "ERROR: app.html not found in this folder." -ForegroundColor Red
    Write-Host "cd into C:\Users\jaytu\OneDrive\Desktop\jayisaacaileads first." -ForegroundColor Yellow
    exit 1
}

# --- Backup ---
$stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = ".\app.html.bak-$stamp"
Copy-Item $file $backup
Write-Host "Backup saved: $backup" -ForegroundColor Cyan

# Read whole file as one string
$html = Get-Content $file -Raw

$changes = 0

# ============================================================
# EDIT 1 - replace the whole loadContacts() function
# ============================================================
$loadOld = @'
async function loadContacts(user){
  try {
    /* Race the query against a 4s timeout — never block the UI on Firestore */
    const queryPromise = getDocs(query(collection(db, "contacts"), limit(MAX_LOAD)));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("contacts query timeout")), 4000)
    );
    const snap = await Promise.race([queryPromise, timeoutPromise]);
    if (snap.empty) {
      toast("Demo dataset active — import contacts to go live");
      return; /* keep demo arrays */
    }
    realMode = true;
    window.fbReveal = fbRevealImpl;
    /* replace demo data in place so all existing logic keeps working */
    PEOPLE.length = 0;
    snap.forEach(d => {
      const x = d.data();
      PEOPLE.push({
        id: d.id, n: x.n, t: x.t, c: x.c, ce: x.ce || 0, l: x.l, i: x.i,
        eDomain: x.eDomain || "", e: null, p: null,
        website: x.website || "", revenue: x.revenue || "",
      });
    });
    /* rebuild companies tab by grouping */
    const byCo = new Map();
    PEOPLE.forEach(p => {
      if(!byCo.has(p.c)) byCo.set(p.c, { c:p.c, ce:p.ce, l:p.l, i:p.i, rev:p.revenue||"—", site:p.website||"—" });
    });
    COMPANIES.length = 0;
    byCo.forEach(v => COMPANIES.push(v));
    /* hydrate contacts this user already paid for */
    await hydrateRevealed();
    toast(PEOPLE.length.toLocaleString() + " contacts loaded");
  } catch (e) {
    console.error("Contact load failed:", e);
    toast("Couldn't load the contact database — running demo data");
  }
}
'@

$loadNew = @'
async function loadContacts(user){
  try {
    /* Load people + companies in parallel, race against a 6s timeout */
    const peopleQ = getDocs(query(collection(db, "people"), limit(MAX_LOAD)));
    const compQ   = getDocs(query(collection(db, "companies"), limit(MAX_LOAD)));
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("query timeout")), 6000)
    );
    const [peopleSnap, compSnap] = await Promise.race([
      Promise.all([peopleQ, compQ]),
      timeout
    ]);

    if (peopleSnap.empty && compSnap.empty) {
      toast("Demo dataset active — import contacts to go live");
      return; /* keep demo arrays */
    }
    realMode = true;
    window.fbReveal = fbRevealImpl;

    /* PEOPLE — map new readable field names -> app's internal short keys */
    PEOPLE.length = 0;
    peopleSnap.forEach(d => {
      const x = d.data();
      PEOPLE.push({
        id: d.id,
        n: x.personName || null,
        t: x.title || "",
        c: x.companyName || "",
        ce: x.employeeCount || 0,
        l: x.location || "",
        i: x.industry || "",
        eDomain: x.emailDomain || "",
        e: null, p: null,
        website: x.website || "", revenue: x.revenue || "",
      });
    });

    /* COMPANIES — load the real companies collection directly */
    COMPANIES.length = 0;
    compSnap.forEach(d => {
      const x = d.data();
      COMPANIES.push({
        id: d.id,
        c: x.companyName || "",
        ce: x.employeeCount || 0,
        l: x.location || "",
        i: x.industry || "",
        rev: x.revenue || "—",
        site: x.website || "—",
      });
    });

    /* hydrate contacts this user already paid for */
    await hydrateRevealed();
    toast(PEOPLE.length.toLocaleString() + " people · " + COMPANIES.length.toLocaleString() + " companies loaded");
  } catch (e) {
    console.error("Contact load failed:", e);
    toast("Couldn't load the contact database — running demo data");
  }
}
'@

if ($html.Contains($loadOld)) {
    $html = $html.Replace($loadOld, $loadNew)
    $changes++
    Write-Host "[1/3] loadContacts() updated." -ForegroundColor Green
} else {
    Write-Host "[1/3] loadContacts() block NOT matched (already patched or edited?)." -ForegroundColor Yellow
}

# ============================================================
# EDIT 2 - hydrateRevealed(): contacts_private -> people_private, e/p -> email/phone
# ============================================================
$hydOld = @'
async function hydrateRevealed(){
  const ids = [...state.revealed].filter(id => PEOPLE.some(p => p.id === id)).slice(0, 300);
  await Promise.all(ids.map(async id => {
    try {
      const ps = await getDoc(doc(db, "contacts_private", id));
      if (ps.exists()) {
        const p = PEOPLE.find(x => x.id === id);
        if (p) { p.e = ps.data().e || null; p.p = ps.data().p || null; }
      }
    } catch(_) { /* not entitled or missing — leave locked */ }
  }));
}
'@

$hydNew = @'
async function hydrateRevealed(){
  const ids = [...state.revealed].filter(id => PEOPLE.some(p => p.id === id)).slice(0, 300);
  await Promise.all(ids.map(async id => {
    try {
      const ps = await getDoc(doc(db, "people_private", id));
      if (ps.exists()) {
        const p = PEOPLE.find(x => x.id === id);
        if (p) { p.e = ps.data().email || null; p.p = ps.data().phone || null; }
      }
    } catch(_) { /* not entitled or missing — leave locked */ }
  }));
}
'@

if ($html.Contains($hydOld)) {
    $html = $html.Replace($hydOld, $hydNew)
    $changes++
    Write-Host "[2/3] hydrateRevealed() updated." -ForegroundColor Green
} else {
    Write-Host "[2/3] hydrateRevealed() block NOT matched." -ForegroundColor Yellow
}

# ============================================================
# EDIT 3 - fbRevealImpl(): contacts_private -> people_private, e/p -> email/phone
# ============================================================
$revOld = @'
    const ps = await getDoc(doc(db, "contacts_private", id));
    const p = PEOPLE.find(x => x.id === id);
    if (p && ps.exists()) { p.e = ps.data().e || null; p.p = ps.data().p || null; }
'@

$revNew = @'
    const ps = await getDoc(doc(db, "people_private", id));
    const p = PEOPLE.find(x => x.id === id);
    if (p && ps.exists()) { p.e = ps.data().email || null; p.p = ps.data().phone || null; }
'@

if ($html.Contains($revOld)) {
    $html = $html.Replace($revOld, $revNew)
    $changes++
    Write-Host "[3/3] fbRevealImpl() reveal read updated." -ForegroundColor Green
} else {
    Write-Host "[3/3] fbRevealImpl() block NOT matched." -ForegroundColor Yellow
}

# ============================================================
# Write back
# ============================================================
if ($changes -gt 0) {
    Set-Content -Path $file -Value $html -Encoding UTF8 -NoNewline
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  DONE - $changes of 3 edits applied." -ForegroundColor Green
    Write-Host "  Backup: $backup" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Green
    if ($changes -lt 3) {
        Write-Host "  Some blocks weren't matched. Paste the script output to Claude." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "No changes made - nothing matched. File untouched." -ForegroundColor Red
    Write-Host "It may already be patched, or the source differs. Tell Claude." -ForegroundColor Yellow
    Remove-Item $backup   # no point keeping an identical backup
}