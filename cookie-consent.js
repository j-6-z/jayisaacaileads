/* ============================================================
   JAYISAAC AI — Cookie Consent + Analytics Loader
   ============================================================
   Self-contained module that:
   1. Shows a consent banner on first visit
   2. Stores choice in localStorage
   3. Only loads Firebase Analytics if user accepts
   4. Re-shown via window.jiaCookieConsent.reopen()

   USAGE (in nav.js or app.html):

   import { initCookieConsent, loadAnalytics, logAnalyticsEvent }
     from "/cookie-consent.js";

   // After firebase initializeApp():
   initCookieConsent({
     firebaseApp: app,
     onAccept: () => logAnalyticsEvent("page_view"),
   });
   ============================================================ */

const CONSENT_KEY = "jia_cookie_consent_v1";
const VERSION = "v1";

let _firebaseApp = null;
let _analytics = null;
let _logEvent = null;

/* ── Public API ────────────────────────────────────────── */

export function getConsent() {
  try { return localStorage.getItem(CONSENT_KEY); }
  catch(_) { return null; }
}

export function setConsent(value) {
  try { localStorage.setItem(CONSENT_KEY, value); }
  catch(_) {}
}

/* Dynamically load Firebase Analytics only when consent is granted.
   Returns true if loaded, false otherwise. */
export async function loadAnalytics(firebaseApp) {
  if (getConsent() !== "accepted") return false;
  if (_analytics) return true;          /* already loaded */
  try {
    const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js");
    _analytics = mod.getAnalytics(firebaseApp);
    _logEvent  = mod.logEvent;
    return true;
  } catch (e) {
    console.warn("[cookie-consent] Analytics module failed to load:", e?.message);
    return false;
  }
}

/* Track an event. Safe to call at any time — no-op if not loaded. */
export function logAnalyticsEvent(name, params = {}) {
  if (!_analytics || !_logEvent) return;
  try {
    _logEvent(_analytics, name, {
      page_location: location.href,
      page_title:    document.title,
      ...params,
    });
  } catch (e) {
    /* swallow — analytics failures should never break the app */
  }
}

/* Main init — call this from nav.js / app.html after Firebase initializeApp() */
export function initCookieConsent(opts = {}) {
  _firebaseApp = opts.firebaseApp || null;
  injectStyles();

  const choice = getConsent();
  if (choice === "accepted") {
    /* already accepted — silently load analytics + fire page_view */
    if (_firebaseApp) {
      loadAnalytics(_firebaseApp).then(loaded => {
        if (loaded) logAnalyticsEvent("page_view");
        if (loaded && opts.onAccept) opts.onAccept();
      });
    }
    return;
  }
  if (choice === "declined") {
    /* user opted out — do nothing */
    return;
  }
  /* No choice yet — show banner */
  renderBanner(opts);
}

/* Re-open the banner manually (e.g. from a "Cookie Settings" link in footer) */
export function reopenBanner(opts = {}) {
  const existing = document.getElementById("jia-cc-banner");
  if (existing) existing.remove();
  renderBanner(opts);
}

if (typeof window !== "undefined") {
  window.jiaCookieConsent = { reopen: reopenBanner, getConsent, setConsent };
}

/* ── Internals ─────────────────────────────────────────── */

function injectStyles() {
  if (document.getElementById("jia-cc-styles")) return;
  const css = `
.jia-cc-banner{
  position:fixed; bottom:20px; left:50%; transform:translateX(-50%) translateY(140%);
  width:calc(100% - 40px); max-width:920px; z-index:9998;
  background:#141414; border:1px solid rgba(99,102,241,.3);
  border-radius:14px; padding:18px 22px;
  box-shadow:0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04);
  font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  display:flex; align-items:center; gap:18px;
  transition:transform .35s cubic-bezier(.34,1.56,.64,1), opacity .25s;
  opacity:0;
}
.jia-cc-banner.show{ transform:translateX(-50%) translateY(0); opacity:1; }
.jia-cc-banner.hide{ transform:translateX(-50%) translateY(140%); opacity:0; }
.jia-cc-icon{
  flex-shrink:0; width:38px; height:38px; border-radius:10px;
  background:rgba(99,102,241,.12); border:1px solid rgba(99,102,241,.3);
  display:flex; align-items:center; justify-content:center;
}
.jia-cc-icon svg{ width:18px; height:18px; color:#6366F1; filter:drop-shadow(0 0 6px rgba(99,102,241,.55)); }
.jia-cc-body{ flex:1; min-width:0; }
.jia-cc-title{
  font-size:13.5px; font-weight:800; color:#F2F2F2;
  margin-bottom:3px; letter-spacing:-.01em;
}
.jia-cc-text{
  font-size:12px; color:rgba(242,242,242,.7); line-height:1.5;
}
.jia-cc-text a{ color:#6366F1; text-decoration:none; font-weight:600; }
.jia-cc-text a:hover{ text-decoration:underline; }
.jia-cc-btns{ display:flex; gap:8px; flex-shrink:0; }
.jia-cc-btn{
  font-family:inherit; font-size:12px; font-weight:700;
  padding:9px 16px; border-radius:9px; cursor:pointer; border:none;
  transition:all .15s ease; white-space:nowrap;
}
.jia-cc-decline{
  background:transparent; color:rgba(242,242,242,.7);
  border:1px solid rgba(255,255,255,.12);
}
.jia-cc-decline:hover{ color:#F2F2F2; border-color:rgba(255,255,255,.2); background:rgba(255,255,255,.03); }
.jia-cc-accept{
  background:linear-gradient(135deg, #818CF8, #4F46E5);
  color:#fff; box-shadow:0 0 18px rgba(99,102,241,.3);
}
.jia-cc-accept:hover{ transform:translateY(-1px); box-shadow:0 0 26px rgba(99,102,241,.5); }
.jia-cc-accept:active{ transform:scale(.97); }
@media(max-width:680px){
  .jia-cc-banner{
    flex-direction:column; align-items:flex-start; gap:14px;
    padding:16px 18px; bottom:12px;
    width:calc(100% - 24px);
  }
  .jia-cc-btns{ width:100%; }
  .jia-cc-btn{ flex:1; }
}`;
  const el = document.createElement("style");
  el.id = "jia-cc-styles";
  el.textContent = css;
  document.head.appendChild(el);
}

function renderBanner(opts) {
  if (document.getElementById("jia-cc-banner")) return;

  const banner = document.createElement("div");
  banner.className = "jia-cc-banner";
  banner.id = "jia-cc-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Cookie consent");
  banner.innerHTML = `
    <div class="jia-cc-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a10 10 0 109.95 11A4 4 0 0117 9a4 4 0 01-4-4 4 4 0 01-1-2.95A10 10 0 0012 2z"/>
        <circle cx="8.5" cy="9" r="1" fill="currentColor"/>
        <circle cx="15" cy="14" r="1" fill="currentColor"/>
        <circle cx="9" cy="16" r="1" fill="currentColor"/>
      </svg>
    </div>
    <div class="jia-cc-body">
      <div class="jia-cc-title">Cookies &amp; analytics</div>
      <div class="jia-cc-text">
        We use cookies for essential features (sign-in, billing) and, with your permission, anonymous analytics
        to improve JAYISAAC AI. Read our <a href="/policies.html#cookies">Cookie Policy</a>.
      </div>
    </div>
    <div class="jia-cc-btns">
      <button class="jia-cc-btn jia-cc-decline" type="button">Decline</button>
      <button class="jia-cc-btn jia-cc-accept" type="button">Accept all</button>
    </div>
  `;
  document.body.appendChild(banner);
  /* trigger entry animation on the next frame */
  requestAnimationFrame(() => banner.classList.add("show"));

  const dismiss = () => {
    banner.classList.remove("show");
    banner.classList.add("hide");
    setTimeout(() => banner.remove(), 400);
  };

  banner.querySelector(".jia-cc-accept").addEventListener("click", async () => {
    setConsent("accepted");
    dismiss();
    if (_firebaseApp) {
      const loaded = await loadAnalytics(_firebaseApp);
      if (loaded) {
        logAnalyticsEvent("consent_granted");
        logAnalyticsEvent("page_view");
      }
      if (opts.onAccept) opts.onAccept();
    }
  });

  banner.querySelector(".jia-cc-decline").addEventListener("click", () => {
    setConsent("declined");
    dismiss();
    if (opts.onDecline) opts.onDecline();
  });
}