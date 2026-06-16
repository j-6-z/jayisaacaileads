/* ============================================================
   JAYISAAC AI — shared site footer
   Single source of truth. Include on every page with:
     <script type="module" src="/footer.js"></script>
   Injects a full ZoomInfo-style footer automatically.
   Edit columns in ONE place: the COLS array below.
   ============================================================ */

/* ── link columns config ──────────────────────────────────── */
const COLS = [
  {
    heading: "Platform",
    links: [
      { label: "Prospect Search",       href: "/app.html"               },
      { label: "People Search",        href: "/people-search.html"     },
      { label: "Company Search",       href: "/company-search.html"    },
      { label: "CSV Export",           href: "/app.html"               },
      { label: "Free Trial",           href: "/login.html"             },
      { label: "Log In",               href: "/login.html"             },
    ]
  },
  {
    heading: "Our Data",
    links: [
      { label: "Data Overview",        href: "/data.html"              },
      { label: "Coverage",             href: "/data.html#coverage"     },
      { label: "Real-Time Updates",    href: "/data.html#updates"      },
      { label: "Verified Contacts",    href: "/data.html#verified"     },
      { label: "API Access",           href: "/api.html"               },
      { label: "Data as a Service",    href: "/api.html#daas"          },
    ]
  },
  {
    heading: "Solutions",
    links: [
      { label: "For Sales Teams",      href: "/sales-teams.html"       },
      { label: "For Agencies",         href: "/agencies.html"          },
      { label: "Cold Calling Lists",   href: "/cold-calling-lists.html"},
      { label: "AI Enrichment",        href: "/data.html"              },
      { label: "Lead Packages",        href: "/pricing.html#leads"     },
      { label: "Pricing",              href: "/pricing.html"           },
    ]
  },
  {
    heading: "Resources",
    links: [
      { label: "How It Works",         href: "/support.html"           },
      { label: "Case Studies",         href: "/case-studies.html"      },
      { label: "Help Center",          href: "/support.html"           },
      { label: "Contact Support",      href: "/contact.html"           },
    ]
  },
  {
    heading: "Company",
    links: [
      { label: "About Us",             href: "/about.html"             },
      { label: "Careers",              href: "/careers.html"           },
      { label: "Contact",              href: "/contact.html"           },
      { label: "Trust Center",         href: "/trust.html"             },
      { label: "Privacy Policy",       href: "/privacy.html"           },
      { label: "Terms of Use",         href: "/terms.html"             },
    ]
  },
];

/* compliance badges — link into the Trust Center */
const BADGES = [
  { label: "PIPEDA",   title: "Personal Information Protection and Electronic Documents Act", href: "/trust.html" },
  { label: "GDPR",     title: "General Data Protection Regulation",                           href: "/trust.html" },
  { label: "CCPA",     title: "California Consumer Privacy Act",                              href: "/trust.html" },
];

const YEAR = new Date().getFullYear();
const LOGO_SRC = "/public/new-logo2.jpg";

/* ── CSS ──────────────────────────────────────────────────── */
const CSS = `
/* prevent white gap below the dark footer on short pages / mobile */
html { background: #0C0C0C; }

.jia-footer {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0C0C0C;
  border-top: 1px solid #2A2A2A;
  color: #F2F2F2;
  margin: 0;
  padding-bottom: 0;
}

/* ── CTA band above footer ── */
.jia-ft-cta {
  background: #141414;
  border-bottom: 1px solid #2A2A2A;
  padding: 2.25rem 5vw;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}
.jia-ft-cta-text {
  font-size: clamp(1rem, 2vw, 1.2rem);
  font-weight: 700;
  color: #F2F2F2;
  letter-spacing: -.02em;
}
.jia-ft-cta-text span { color: #6366F1; }
.jia-ft-cta-btns {
  display: flex; gap: .75rem; flex-wrap: wrap;
}
.jia-ft-btn-trial {
  background: #6366F1;
  color: #F2F2F2;
  text-decoration: none;
  padding: .62rem 1.4rem;
  border-radius: 8px;
  font-size: .875rem;
  font-weight: 700;
  transition: background .18s;
  white-space: nowrap;
  display: inline-block;
}
.jia-ft-btn-trial:hover { background: #818CF8; }
.jia-ft-btn-sales {
  color: #F2F2F2;
  text-decoration: none;
  padding: .62rem 1.4rem;
  border-radius: 8px;
  border: 1px solid #2A2A2A;
  font-size: .875rem;
  font-weight: 600;
  background: transparent;
  transition: border-color .18s, background .18s;
  white-space: nowrap;
  display: inline-block;
}
.jia-ft-btn-sales:hover {
  border-color: rgba(255,255,255,.25);
  background: rgba(255,255,255,.05);
}

/* ── main body ── */
.jia-ft-body {
  max-width: 1380px;
  margin: 0 auto;
  padding: 3.5rem 5vw 2rem;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 3rem;
}

/* brand col */
.jia-ft-brand {}
.jia-ft-logo {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: .14em;
  color: #F2F2F2;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: .55rem;
  margin-bottom: 1rem;
  text-transform: uppercase;
  transition: filter .3s;
}
.jia-ft-logo:hover { text-decoration: none; filter: drop-shadow(0 0 8px rgba(99,102,241,.45)); }
.jia-ft-logo span {
  background: linear-gradient(135deg, #818CF8, #A5B4FC);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.jia-ft-logo-img {
  width: 34px; height: 34px; border-radius: 50%;
  object-fit: cover; flex-shrink: 0;
  border: 1.5px solid rgba(99,102,241,.38);
  box-shadow: 0 0 0 3px rgba(99,102,241,.1);
}
.jia-ft-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #6366F1;
  flex-shrink: 0;
}
.jia-ft-tagline {
  font-size: .82rem;
  color: rgba(242,242,242,.48);
  line-height: 1.7;
  margin-bottom: 1.5rem;
  max-width: 220px;
}

/* compliance badges */
.jia-ft-badges {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}
.jia-ft-badge {
  background: #1A1A1A;
  border: 1px solid #2A2A2A;
  border-radius: 6px;
  padding: .28rem .65rem;
  font-size: .68rem;
  font-weight: 700;
  color: rgba(242,242,242,.45);
  letter-spacing: .04em;
  text-transform: uppercase;
  text-decoration: none;
  display: inline-block;
  transition: border-color .18s, color .18s;
}
.jia-ft-badge:hover {
  border-color: rgba(99,102,241,.35);
  color: rgba(242,242,242,.7);
}

/* link columns */
.jia-ft-cols {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
}
.jia-ft-col-head {
  font-size: .7rem;
  font-weight: 700;
  color: #F2F2F2;
  text-transform: uppercase;
  letter-spacing: .09em;
  margin-bottom: .9rem;
  display: block;
}
.jia-ft-col ul {
  list-style: none;
  margin: 0; padding: 0;
  display: flex;
  flex-direction: column;
  gap: .5rem;
}
.jia-ft-col a {
  font-size: .82rem;
  color: rgba(242,242,242,.45);
  text-decoration: none;
  transition: color .17s;
  display: block;
  line-height: 1.4;
}
.jia-ft-col a:hover { color: #F2F2F2; }

/* ── bottom bar ── */
.jia-ft-bottom {
  border-top: 1px solid #2A2A2A;
  padding: 1.25rem 5vw;
  max-width: 1380px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}
.jia-ft-copy {
  font-size: .75rem;
  color: rgba(242,242,242,.35);
}
.jia-ft-copy span { color: #6366F1; }
.jia-ft-legal {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.jia-ft-legal a {
  font-size: .75rem;
  color: rgba(242,242,242,.35);
  text-decoration: none;
  transition: color .17s;
}
.jia-ft-legal a:hover { color: rgba(242,242,242,.7); }

/* ── responsive ── */
@media(max-width:1100px){
  .jia-ft-cols { grid-template-columns: repeat(3, 1fr); }
}
@media(max-width:800px){
  .jia-ft-body {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .jia-ft-tagline { max-width: 100%; }
  .jia-ft-cols { grid-template-columns: repeat(2, 1fr); }
  .jia-ft-cta { flex-direction: column; align-items: flex-start; }
  .jia-ft-bottom { flex-direction: column; align-items: flex-start; }
}
@media(max-width:480px){
  .jia-ft-cols { grid-template-columns: 1fr 1fr; }
  .jia-ft-cta-btns { flex-direction: column; width: 100%; }
  .jia-ft-btn-trial,
  .jia-ft-btn-sales { text-align: center; }
}
`;

/* ── markup builder ───────────────────────────────────────── */
function buildCols() {
  return COLS.map(col => `
    <div class="jia-ft-col">
      <span class="jia-ft-col-head">${col.heading}</span>
      <ul>
        ${col.links.map(l => `<li><a href="${l.href}">${l.label}</a></li>`).join("")}
      </ul>
    </div>`).join("");
}

function buildBadges() {
  return BADGES.map(b =>
    `<a class="jia-ft-badge" href="${b.href}" title="${b.title}">${b.label}</a>`
  ).join("");
}

const FOOTER_HTML = `
<footer class="jia-footer" role="contentinfo">

  <!-- CTA band -->
  <div class="jia-ft-cta">
    <div class="jia-ft-cta-text">
      JAYISAAC AI — Verified B2B contacts for teams that<br>
      <span>sell to real businesses.</span>
    </div>
    <div class="jia-ft-cta-btns">
      <a href="/login.html" class="jia-ft-btn-trial">Free trial &rarr;</a>
      <a href="/contact.html"   class="jia-ft-btn-sales">Contact sales</a>
    </div>
  </div>

  <!-- main body -->
  <div class="jia-ft-body">

    <!-- brand / badges -->
    <div class="jia-ft-brand">
      <a href="/" class="jia-ft-logo">
        <img src="${LOGO_SRC}" alt="JAYISAAC AI logo" class="jia-ft-logo-img">
        JAYISAAC&nbsp;<span>AI</span>
      </a>
      <p class="jia-ft-tagline">
        North American B2B contact intelligence. Find the decision-makers who actually pick up.
      </p>

      <div class="jia-ft-badges">${buildBadges()}</div>
    </div>

    <!-- link columns -->
    <div class="jia-ft-cols">${buildCols()}</div>

  </div>

  <!-- bottom bar -->
  <div class="jia-ft-bottom">
    <span class="jia-ft-copy">
      &copy; ${YEAR} <span>JAYISAAC AI</span>. All rights reserved.
      Built in Saskatoon, SK.
    </span>
    <nav class="jia-ft-legal" aria-label="Legal links">
      <a href="/privacy.html">Privacy Policy</a>
      <a href="/terms.html">Terms of Use</a>
      <a href="/trust.html">Trust Center</a>
      <a href="/data-removal.html">Do Not Sell My Information</a>
      <a href="/privacy.html#cookies">Cookies</a>
    </nav>
  </div>

</footer>
`;

/* ── inject ───────────────────────────────────────────────── */
const styleEl = document.createElement("style");
styleEl.textContent = CSS;
document.head.appendChild(styleEl);

const tmp = document.createElement("div");
tmp.innerHTML = FOOTER_HTML.trim();
document.body.appendChild(tmp.firstChild);