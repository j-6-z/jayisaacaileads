/* ============================================================
   JAYISAAC AI — shared site navigation
   <script type="module" src="/nav.js"></script>
   Light warm bar · mega links center · Log In + Contact Sales
   + Free Trial right · Firebase auth · matches site design v16
   ============================================================ */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider,
         signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

/* ── nav link config ─────────────────────────────────────── */
const LINKS = [
  {
    label: "Products",
    href:  "/",
    mega: {
      feature: {
        eyebrow: "The Platform",
        title:   "Three AI products,<br>one login.",
        text:    "Sell, run, and defend your business from a single account. Shared data, one flat bill.",
        cta:     "Compare all products",
        href:    "/"
      },
      cols: [
        {
          head: "AI Lead Generation", href: "/lead-generation/", accent: "lead",
          sub:  "Find your next customer", icon: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
          items: [
            { label: "Prospect Search",    sub: "Open the app",              href: "/app.html"                                },
            { label: "People Search",      sub: "Owners, GMs, buyers",       href: "/lead-generation/people-search.html"      },
            { label: "Company Search",     sub: "Filter by industry & size", href: "/lead-generation/company-search.html"     },
            { label: "Cold Calling Lists", sub: "Dial-ready exports",        href: "/lead-generation/cold-calling-lists.html" },
            { label: "Pricing",            sub: "Flat monthly plans",        href: "/lead-generation/pricing.html"            },
          ]
        },
        {
          head: "AI Chief of Staff", href: "/chief-of-staff/", accent: "staff",
          sub:  "Run the operation", icon: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
          items: [
            { label: "Briefings",    sub: "Your day, decided",  href: "/chief-of-staff/briefings.html"    },
            { label: "Delegation",   sub: "Nothing slips",      href: "/chief-of-staff/delegation.html"   },
            { label: "Meeting Prep", sub: "Walk in ready",      href: "/chief-of-staff/meeting-prep.html" },
            { label: "Pricing",      sub: "Flat monthly plans", href: "/chief-of-staff/pricing.html"      },
          ]
        },
        {
          head: "AI Cybersecurity", href: "/cybersecurity/", accent: "cyber",
          sub:  "Defend the business", icon: `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
          items: [
            { label: "Threat Detection",    sub: "Caught before it lands", href: "/cybersecurity/threat-detection.html"    },
            { label: "Incident Response",   sub: "Contain & remediate",    href: "/cybersecurity/incident-response.html"   },
            { label: "Vulnerability Scans", sub: "Know your gaps",         href: "/cybersecurity/vulnerability-scans.html" },
            { label: "Pricing",             sub: "Flat monthly plans",     href: "/cybersecurity/pricing.html"             },
          ]
        }
      ]
    }
  },
  {
    label: "Pricing",
    href:  "/lead-generation/pricing.html",
    mega: {
      feature: {
        eyebrow: "Pricing",
        title:   "Flat, honest<br>pricing.",
        text:    "No per-seat fees, no credit traps, no annual lock-in. Start free on any product.",
        cta:     "Start free",
        href:    "/login.html"
      },
      cols: [
        {
          head: "Lead Generation", href: "/lead-generation/pricing.html", accent: "lead",
          sub: "Prospecting plans", icon: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
          items: [ { label: "See Lead Gen plans", sub: "Verified contacts & AI outreach", href: "/lead-generation/pricing.html" } ]
        },
        {
          head: "Chief of Staff", href: "/chief-of-staff/pricing.html", accent: "staff",
          sub: "Operations plans", icon: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
          items: [ { label: "See Chief of Staff plans", sub: "Briefings, delegation & more", href: "/chief-of-staff/pricing.html" } ]
        },
        {
          head: "Cybersecurity", href: "/cybersecurity/pricing.html", accent: "cyber",
          sub: "Security plans", icon: `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
          items: [ { label: "See Cybersecurity plans", sub: "Detection, response & scans", href: "/cybersecurity/pricing.html" } ]
        }
      ]
    }
  },
  {
    label: "Resources",
    href:  "/support.html",
    mega: {
      feature: {
        eyebrow: "The Company",
        title:   "Serious AI,<br>honestly priced.",
        text:    "Production-grade AI products for the businesses the big vendors overcharge and overlook.",
        cta:     "About JAYISAAC AI",
        href:    "/about.html"
      },
      cols: [
        {
          head: "Learn",
          items: [
            { label: "How It Works", sub: "Step by step",        href: "/support.html"      },
            { label: "Case Studies", sub: "Real results",        href: "/case-studies.html" },
            { label: "Help Center",  sub: "FAQs & support docs", href: "/support.html"      },
          ]
        },
        {
          head: "Company",
          items: [
            { label: "About Us",     sub: "Who we are",         href: "/about.html"   },
            { label: "Contact",      sub: "Talk to the team",   href: "/contact.html" },
            { label: "Careers",      sub: "Join the team",      href: "/careers.html" },
            { label: "Trust Center", sub: "Security & privacy", href: "/trust.html"   },
          ]
        }
      ]
    }
  },
];

const LOGO_SRC = "/public/new-logo2.jpg";

/* ── CSS ─────────────────────────────────────────────────── */
const CSS = `
:root {
  --jia-blue:      #4F46E5;
  --jia-blue-h:    #4338CA;
  --jia-blue-lt:   #818CF8;
  --jia-blue-soft: #EEF0FF;
  --jia-blue-line: #C9CDFA;
  --jia-paper:     #FFFCF6;
  --jia-cream:     #F5F0E7;
  --jia-line:      #E9E2D6;
  --jia-ink:       #1C1822;
  --jia-soft:      #4E4856;
  --jia-faint:     #8E8896;
  --jia-h: 66px;
}

body { padding-top: var(--jia-h); }

/* ── bar ── */
.jia-hdr {
  position: fixed; top:0; left:0; width:100%; z-index:1000;
  height: var(--jia-h);
  background: rgba(255,252,246,.92);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  border-bottom: 1px solid var(--jia-line);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  transition: background .25s, box-shadow .25s;
}
.jia-hdr.scrolled {
  background: rgba(255,252,246,.97);
  box-shadow: 0 8px 30px rgba(28,24,34,.07);
}

.jia-nav {
  max-width: 1380px; margin: 0 auto;
  height: var(--jia-h); padding: 0 2rem;
  display: flex; align-items: center;
  justify-content: space-between;
  position: relative;
}

/* ── logo left ── */
.jia-brand {
  font-size: 1rem; font-weight: 700; letter-spacing: .12em;
  color: var(--jia-ink); text-decoration: none;
  display: flex; align-items: center; gap: .6rem; flex-shrink:0;
  z-index: 2; text-transform: uppercase;
}
.jia-brand:hover { text-decoration: none; }
.jia-brand-logo {
  width: 34px; height: 34px; border-radius: 50%;
  object-fit: cover; flex-shrink: 0;
  border: 1.5px solid var(--jia-blue-line);
  box-shadow: 0 0 0 3px rgba(79,70,229,.08);
  transition: box-shadow .25s;
}
.jia-brand:hover .jia-brand-logo { box-shadow: 0 0 0 4px rgba(79,70,229,.16); }
.jia-brand-ai { color: var(--jia-blue); font-weight: 700; }
.jia-dot {
  width: 7px; height: 7px; border-radius: 2px;
  background: var(--jia-blue);
  flex-shrink: 0;
  animation: jia-pulse 2.5s infinite;
}
@keyframes jia-pulse { 0%,100%{opacity:1} 50%{opacity:.25} }

/* smart hide on scroll down, reveal on scroll up */
.jia-hdr { transition: background .25s, box-shadow .25s, transform .32s cubic-bezier(.22,.8,.3,1); }
.jia-hdr.nav-hidden { transform: translateY(-100%); }

/* page veil behind open mega */
.jia-veil {
  position: fixed; inset: 0; z-index: 990;
  background: rgba(28,24,34,.22);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  opacity: 0; pointer-events: none;
  transition: opacity .28s ease;
}
.jia-veil.on { opacity: 1; }

/* ── center links ── */
.jia-center {
  position: absolute; left:50%; transform:translateX(-50%);
  display: flex; align-items: center;
  max-width: calc(100vw - 540px);
}
.jia-links {
  display:flex; align-items:center; gap:.1rem;
  list-style:none; margin:0; padding:0;
  flex-wrap: nowrap;
  position: relative;
}
/* gliding hover pill */
.jia-pill {
  position: absolute; top: 50%; left: 0;
  height: 34px; width: 0;
  transform: translateY(-50%);
  background: rgba(28,24,34,.06);
  border-radius: 8px;
  opacity: 0;
  transition: transform .28s cubic-bezier(.3,.9,.35,1), width .28s cubic-bezier(.3,.9,.35,1), opacity .2s;
  pointer-events: none;
}
.jia-pill.on { opacity: 1; }
.jia-links > li { position:relative; }

.jia-links > li > a {
  display: flex; align-items: center; gap:.28rem;
  padding: .5rem .82rem;
  border-radius: 8px;
  color: var(--jia-soft);
  text-decoration: none;
  font-size: .87rem; font-weight: 500;
  white-space: nowrap;
  transition: color .17s, background .17s;
}
.jia-links > li > a:hover,
.jia-links > li.has-mega:hover > a,
.jia-links > li.has-mega.mega-open > a {
  color: var(--jia-ink);
}
.jia-links > li > a.active { color: var(--jia-blue); }
.jia-chev {
  width:10px; height:10px; stroke:currentColor; fill:none;
  stroke-width:2; stroke-linecap:round; stroke-linejoin:round;
  opacity:.45; transition:transform .2s, opacity .2s; flex-shrink:0;
}
.jia-links > li.has-mega.mega-open .jia-chev { transform:rotate(180deg); opacity:.9; }

/* ── full-width mega panel (light) ── */
.jia-mega-wrap { position: static; }
.jia-mega {
  position: absolute;
  top: 100%; left: 0; right: 0;
  background: #FFFFFF;
  border-top: 1px solid var(--jia-line);
  border-bottom: 1px solid var(--jia-line);
  box-shadow: 0 40px 90px rgba(28,24,34,.14), 0 12px 30px rgba(28,24,34,.06);
  opacity: 0; visibility: hidden; pointer-events: none;
  transform: translateY(-10px);
  transition: opacity .2s ease, transform .24s cubic-bezier(.16,1,.3,1), visibility .2s;
  z-index: 999;
}
.jia-mega.open { opacity: 1; visibility: visible; pointer-events: auto; transform: none; }

/* choreographed entrance: feature first, columns cascade */
.jia-mega .jia-mega-feature,
.jia-mega .jia-mega-col {
  opacity: 0; transform: translateY(10px);
  transition: opacity .32s ease, transform .38s cubic-bezier(.22,.8,.3,1);
}
.jia-mega.open .jia-mega-feature { opacity: 1; transform: none; transition-delay: .04s; }
.jia-mega.open .jia-mega-col { opacity: 1; transform: none; }
.jia-mega.open .jia-mega-col:nth-child(1) { transition-delay: .09s; }
.jia-mega.open .jia-mega-col:nth-child(2) { transition-delay: .15s; }
.jia-mega.open .jia-mega-col:nth-child(3) { transition-delay: .21s; }

.jia-mega-inner { max-width: 1380px; margin: 0 auto; padding: 2.25rem 2rem 2.6rem; }
.jia-mega-inner.has-feature { display: grid; grid-template-columns: 300px 1fr; gap: 3rem; align-items: stretch; }

/* feature card — cream panel, serif title (site accent face) */
.jia-mega-feature {
  display: flex; flex-direction: column; justify-content: center;
  padding: 1.7rem 1.6rem; border-radius: 16px; text-decoration: none;
  background: var(--jia-cream);
  border: 1px solid var(--jia-line);
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.jia-mega-feature:hover {
  border-color: var(--jia-blue-line);
  transform: translateY(-2px);
  box-shadow: 0 14px 34px rgba(79,70,229,.1);
}
.jmf-eyebrow {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: .64rem; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--jia-blue); margin-bottom: .7rem;
}
.jmf-eyebrow::before { content: ''; width: 7px; height: 7px; border-radius: 2px; background: var(--jia-blue); }
.jmf-title {
  font-family: 'Newsreader', Georgia, serif;
  font-size: 1.55rem; font-weight: 500; color: var(--jia-ink);
  line-height: 1.12; letter-spacing: -.012em; margin-bottom: .65rem;
}
.jmf-text { font-size: .82rem; color: var(--jia-soft); line-height: 1.6; margin-bottom: 1.1rem; }
.jmf-cta { display: inline-flex; align-items: center; gap: .45rem; font-size: .82rem; font-weight: 600; color: var(--jia-blue); }
.jmf-cta svg { width: 14px; height: 14px; fill: none; stroke: currentColor; transition: transform .15s; }
.jia-mega-feature:hover .jmf-cta svg { transform: translateX(3px); }

.jia-mega-cols { display: grid; gap: 2rem; }
.jia-mega-col { min-width: 0; }

.jia-mega-colhead { display: flex; align-items: center; gap: .7rem; padding: .3rem .35rem .85rem; margin-bottom: .5rem; border-bottom: 1px solid var(--jia-line); text-decoration: none; }
.jmc-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.jmc-icon svg { width: 18px; height: 18px; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.jia-mega-colhead.lead  .jmc-icon { background: linear-gradient(135deg,#818CF8,#4F46E5); box-shadow: 0 6px 16px rgba(79,70,229,.3); }
.jia-mega-colhead.staff .jmc-icon { background: linear-gradient(135deg,#C084FC,#7C3AED); box-shadow: 0 6px 16px rgba(124,58,237,.3); }
.jia-mega-colhead.cyber .jmc-icon { background: linear-gradient(135deg,#67E8F9,#0E92A8); box-shadow: 0 6px 16px rgba(14,146,168,.28); }
.jmc-txt b { display: block; font-size: .88rem; font-weight: 700; color: var(--jia-ink); transition: color .15s; }
.jmc-txt i { display: block; font-size: .72rem; font-style: normal; color: var(--jia-faint); margin-top: .05rem; }
.jia-mega-colhead:hover .jmc-txt b { color: var(--jia-blue); }

.jia-mega-head { display: block; font-size: .66rem; font-weight: 700; color: var(--jia-blue); text-transform: uppercase; letter-spacing: .12em; padding: .3rem .35rem .95rem; border-bottom: 1px solid var(--jia-line); margin-bottom: .5rem; }

.jia-mega-row { display: block; padding: .5rem .5rem; border-radius: 8px; text-decoration: none; transition: background .12s; }
.jia-mega-row:hover { background: var(--jia-cream); }
.jia-ml { display: block; font-size: .845rem; font-weight: 600; color: var(--jia-ink); transition: color .15s; }
.jia-mega-row:hover .jia-ml { color: var(--jia-blue); }
.jia-ms { display: block; font-size: .72rem; color: var(--jia-faint); margin-top: .08rem; }

@media(max-width:1100px){ .jia-mega { display: none !important; } }

/* ── right buttons — Log In · Contact Sales · Free Trial ── */
.jia-right {
  display:flex; align-items:center; gap:.6rem; flex-shrink:0; z-index:2;
}

.jia-btn-login {
  color: var(--jia-soft);
  text-decoration:none;
  font-size:.87rem; font-weight:500;
  padding:.5rem .75rem;
  border-radius:8px;
  transition:color .17s, background .17s;
  white-space:nowrap;
}
.jia-btn-login:hover { color:var(--jia-ink); background:rgba(28,24,34,.05); }

.jia-btn-sales {
  color: var(--jia-ink);
  text-decoration:none;
  font-size:.87rem; font-weight:600;
  padding:.5rem 1.1rem;
  border-radius:9px;
  border:1px solid #D9D4C8;
  background:#fff;
  transition:border-color .17s, background .17s;
  white-space:nowrap;
}
.jia-btn-sales:hover { border-color: var(--jia-ink); }

.jia-btn-trial {
  color: #fff;
  text-decoration:none;
  font-size:.87rem; font-weight:600;
  padding:.55rem 1.2rem;
  border-radius:9px;
  background: var(--jia-blue);
  border:none; cursor:pointer;
  display:inline-flex; align-items:center; gap:.35rem;
  transition:background .17s, transform .12s, box-shadow .17s;
  white-space:nowrap; font-family:inherit;
  box-shadow: 0 6px 16px rgba(79,70,229,.22);
}
.jia-btn-trial svg { transition: transform .18s cubic-bezier(.3,.9,.35,1); }
.jia-btn-trial:hover { background:var(--jia-blue-h); transform:translateY(-1px); box-shadow: 0 8px 20px rgba(79,70,229,.3); }
.jia-btn-trial:hover svg { transform: translateX(3px); }
.jia-btn-trial:active { transform:scale(.98); }

/* ── auth account dropdown (shown when signed in) ── */
.jia-acct { position:relative; display:none; }
.jia-acct-toggle {
  display:flex; align-items:center; gap:.5rem; cursor:pointer;
  padding:.38rem .8rem .38rem .45rem;
  border-radius:10px;
  border:1px solid var(--jia-blue-line);
  background:var(--jia-blue-soft);
  font-family:inherit;
  transition:background .17s;
}
.jia-acct-toggle:hover { background:#E3E6FD; }
.jia-acct-photo {
  width:26px; height:26px; border-radius:50%;
  object-fit:cover; border:1.5px solid var(--jia-blue-line);
}
.jia-acct-name { font-size:.83rem; font-weight:600; color:var(--jia-ink); }
.jia-acct-arr  { font-size:.54rem; color:var(--jia-faint); transition:transform .2s; }
.jia-acct.open .jia-acct-arr { transform:rotate(180deg); }

.jia-acct-menu {
  position:absolute; top:calc(100% + .75rem); right:0;
  background:#fff; border:1px solid var(--jia-line);
  border-radius:14px; box-shadow:0 24px 60px rgba(28,24,34,.16);
  min-width:220px; overflow:hidden;
  opacity:0; visibility:hidden; transform:translateY(6px);
  transition:opacity .2s, transform .2s, visibility .2s;
}
.jia-acct.open .jia-acct-menu { opacity:1; visibility:visible; transform:translateY(0); }

.jia-acct-head { padding:.9rem 1.15rem; border-bottom:1px solid var(--jia-line); }
.jia-acct-head .nm { font-size:.88rem; font-weight:700; color:var(--jia-ink); display:block; margin-bottom:.12rem; }
.jia-acct-head .em { font-size:.74rem; color:var(--jia-faint); word-break:break-all; }

.jia-acct-menu a,
.jia-acct-menu button {
  display:flex; align-items:center; gap:.7rem;
  padding:.78rem 1.15rem;
  color:var(--jia-soft); text-decoration:none;
  border:none; background:none; width:100%;
  font-size:.845rem; cursor:pointer;
  border-bottom:1px solid var(--jia-line);
  font-family:inherit; text-align:left;
  transition:background .17s, color .17s;
}
.jia-acct-menu a:last-child,
.jia-acct-menu button:last-child { border-bottom:none; }
.jia-acct-menu a:hover,
.jia-acct-menu button:hover { background:var(--jia-cream); color:var(--jia-blue); }
.jia-acct-menu svg {
  width:15px; height:15px; stroke:currentColor; fill:none;
  stroke-width:1.75; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0;
}
.jia-signout { color:#DC2626!important; }
.jia-signout:hover { background:#FEF2F2!important; color:#B91C1C!important; }

/* ── burger ── */
.jia-burger {
  display:none; flex-direction:column; gap:5px;
  background:none; border:none; cursor:pointer; padding:.5rem; z-index:1001;
}
.jia-burger span {
  width:22px; height:1.5px; background:var(--jia-ink);
  border-radius:2px; display:block;
  transition:transform .25s, opacity .25s;
}
.jia-burger.open span:nth-child(1){ transform:rotate(45deg) translate(4.5px,4.5px); }
.jia-burger.open span:nth-child(2){ opacity:0; }
.jia-burger.open span:nth-child(3){ transform:rotate(-45deg) translate(4.5px,-4.5px); }

/* ── mobile menu ── */
@media(max-width:1100px){
  .jia-center { display:none; }
  .jia-btn-login, .jia-btn-sales, .jia-btn-trial { display:none; }
  .jia-burger { display:flex; }

  .jia-mob {
    position:fixed;
    top:var(--jia-h); left:0; right:0;
    background:rgba(255,252,246,.98);
    backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
    border-bottom:1px solid var(--jia-line);
    padding:1.25rem 1.5rem 2rem;
    display:none; flex-direction:column; gap:.15rem;
    z-index:998; max-height:calc(100vh - var(--jia-h));
    overflow-y:auto;
    box-shadow:0 24px 50px rgba(28,24,34,.12);
  }
  .jia-mob.open { display:flex; animation: jia-mob-in .28s cubic-bezier(.22,.8,.3,1); }
  @keyframes jia-mob-in { from { opacity: 0; transform: translateY(-10px); } }

  /* accordion sections */
  .jia-mob-acc {
    display:flex; align-items:center; gap:.7rem; width:100%;
    background:none; border:none; cursor:pointer;
    font-family:inherit; text-align:left;
    padding:.85rem .4rem;
    border-bottom:1px solid var(--jia-line);
  }
  .jia-mob-acc .jmc-icon { width:32px; height:32px; border-radius:9px; }
  .jia-mob-acc .jmc-icon svg { width:16px; height:16px; }
  .jia-mob-acc b { flex:1; font-size:.92rem; font-weight:600; color:var(--jia-ink); }
  .jia-mob-acc .jia-chev { width:12px; height:12px; opacity:.5; }
  .jia-mob-group.open .jia-mob-acc .jia-chev { transform:rotate(180deg); opacity:.9; }
  .jia-mob-body {
    max-height:0; overflow:hidden;
    transition:max-height .3s cubic-bezier(.22,.8,.3,1);
  }
  .jia-mob-body .jia-mob-link { padding-left:1.2rem; }

  .jia-mob-section {
    font-size:.65rem; font-weight:700;
    color:var(--jia-blue);
    text-transform:uppercase; letter-spacing:.12em;
    padding:.9rem .4rem .3rem; display:block;
  }
  .jia-mob-link {
    color:var(--jia-soft); text-decoration:none;
    font-size:.9rem; font-weight:500;
    padding:.7rem .4rem;
    border-bottom:1px solid var(--jia-line);
    display:block; transition:color .17s;
  }
  .jia-mob-link:hover { color:var(--jia-ink); }

  .jia-mob-btns {
    display:flex; flex-direction:column; gap:.7rem;
    margin-top:1.1rem; padding-top:1.1rem;
    border-top:1px solid var(--jia-line);
  }
  .jia-mob-btns a {
    width:100%; text-align:center;
    padding:.82rem; border-radius:9px;
    font-size:.9rem; font-weight:600;
    text-decoration:none; display:block;
  }
  .jia-mob-login {
    color:var(--jia-soft);
    border:1px solid var(--jia-line);
    background:#fff;
    transition:color .17s, border-color .17s;
  }
  .jia-mob-login:hover { color:var(--jia-ink); border-color:var(--jia-ink); }
  .jia-mob-sales {
    color:var(--jia-ink);
    border:1px solid #D9D4C8;
    background:#fff;
    transition:border-color .17s;
  }
  .jia-mob-sales:hover { border-color:var(--jia-ink); }
  .jia-mob-trial {
    color:#fff!important;
    background:var(--jia-blue);
    font-weight:600!important;
    transition:background .17s;
  }
  .jia-mob-trial:hover { background:var(--jia-blue-h); }
}

@media (prefers-reduced-motion: reduce) {
  .jia-hdr *, .jia-hdr *::before, .jia-hdr *::after,
  .jia-mob *, .jia-dot { animation: none !important; transition: none !important; }
}
`;

/* ── helpers ──────────────────────────────────────────────── */
const isHome = () =>
  location.pathname === "/" || /\/index\.html?$/.test(location.pathname);

function activePath(href) {
  return location.pathname.replace(/\/$/, "") === href.replace(/\/$/, "");
}

function buildDesktopLinks() {
  let mi = -1;
  return LINKS.map(l => {
    const active = activePath(l.href) ? ' class="active"' : '';
    if (l.mega) {
      mi++;
      return `
        <li class="has-mega" data-mega="${mi}">
          <a href="${l.href}"${active}>
            ${l.label}
            <svg class="jia-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </a>
        </li>`;
    }
    return `<li><a href="${l.href}"${active}>${l.label}</a></li>`;
  }).join("");
}

function buildMega(l) {
  const f = l.mega.feature;
  const feat = f ? `
    <a class="jia-mega-feature" href="${f.href}">
      <span class="jmf-eyebrow">${f.eyebrow}</span>
      <span class="jmf-title">${f.title}</span>
      <span class="jmf-text">${f.text}</span>
      <span class="jmf-cta">${f.cta}
        <svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </span>
    </a>` : "";
  const cols = l.mega.cols.map(col => {
    const head = col.href
      ? `<a class="jia-mega-colhead ${col.accent || ''}" href="${col.href}">
           ${col.icon ? `<span class="jmc-icon">${col.icon}</span>` : ""}
           <span class="jmc-txt"><b>${col.head}</b>${col.sub ? `<i>${col.sub}</i>` : ""}</span>
         </a>`
      : `<span class="jia-mega-head">${col.head}</span>`;
    const rows = col.items.map(it => `
      <a href="${it.href}" class="jia-mega-row">
        <span class="jia-ml">${it.label}</span>
        ${it.sub ? `<span class="jia-ms">${it.sub}</span>` : ""}
      </a>`).join("");
    return `<div class="jia-mega-col">${head}${rows}</div>`;
  }).join("");
  return `<div class="jia-mega-inner${f ? ' has-feature' : ''}">
    ${feat}
    <div class="jia-mega-cols" style="grid-template-columns:repeat(${l.mega.cols.length},minmax(0,1fr))">${cols}</div>
  </div>`;
}

function buildMegaPanels() {
  let mi = -1;
  return LINKS.filter(l => l.mega).map(l => {
    mi++;
    return `<div class="jia-mega" data-mega="${mi}">${buildMega(l)}</div>`;
  }).join("");
}

function buildMobileLinks() {
  return LINKS.map(l => {
    if (l.mega) {
      return l.mega.cols.map(c => {
        const overview = c.href ? `<a href="${c.href}" class="jia-mob-link">Overview</a>` : "";
        const items    = c.items.map(it => `<a href="${it.href}" class="jia-mob-link">${it.label}</a>`).join("");
        if (c.href && c.icon) {
          /* product group → collapsible accordion */
          return `
            <div class="jia-mob-group">
              <button type="button" class="jia-mob-acc" aria-expanded="false">
                <span class="jmc-icon ${c.accent ? '' : ''}" style="${accIconBg(c.accent)}">${c.icon}</span>
                <b>${c.head}</b>
                <svg class="jia-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="jia-mob-body">${overview}${items}</div>
            </div>`;
        }
        /* plain section (Learn / Company) */
        return `<span class="jia-mob-section">${c.head}</span>${overview}${items}`;
      }).join("");
    }
    return `<a href="${l.href}" class="jia-mob-link">${l.label}</a>`;
  }).join("");
}

function accIconBg(accent) {
  if (accent === 'lead')  return 'background:linear-gradient(135deg,#818CF8,#4F46E5)';
  if (accent === 'staff') return 'background:linear-gradient(135deg,#C084FC,#7C3AED)';
  if (accent === 'cyber') return 'background:linear-gradient(135deg,#67E8F9,#0E92A8)';
  return 'background:linear-gradient(135deg,#818CF8,#4F46E5)';
}

/* ── markup ───────────────────────────────────────────────── */
const MARKUP = `
<header class="jia-hdr" role="banner">
  <nav class="jia-nav" aria-label="Primary">

    <!-- left: brand -->
    <a href="/" class="jia-brand">
      <img src="${LOGO_SRC}" alt="" class="jia-brand-logo">
      <span class="jia-dot"></span>
      JAYISAAC&nbsp;<span class="jia-brand-ai">AI</span>
    </a>

    <!-- center: nav links with mega dropdowns -->
    <div class="jia-center">
      <ul class="jia-links">${buildDesktopLinks()}</ul>
    </div>

    <!-- right: Log In · Contact Sales · Free Trial + auth -->
    <div class="jia-right">

      <a href="/login.html" class="jia-btn-login jia-login-show">Log In</a>

      <a href="/contact.html" class="jia-btn-sales jia-login-show">Contact sales</a>

      <a href="/login.html" class="jia-btn-trial jia-login-show">
        Free trial
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </a>

      <!-- account dropdown — visible when signed in -->
      <div class="jia-acct" id="jiaAcct">
        <button type="button" class="jia-acct-toggle"
          aria-expanded="false" aria-haspopup="true">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
            alt="" class="jia-acct-photo">
          <span class="jia-acct-name">Account</span>
          <span class="jia-acct-arr">&#9660;</span>
        </button>
        <div class="jia-acct-menu">
          <div class="jia-acct-head">
            <span class="nm">Account</span>
            <span class="em"></span>
          </div>
          <a href="/app.html">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Prospect Search
          </a>
          <a href="/account.html">
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            My Account
          </a>
          <a href="/pricing.html">
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            Plans &amp; Credits
          </a>
          <a href="/support.html">
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Support
          </a>
          <button type="button" class="jia-signout">
            <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </div>

      <!-- burger (mobile only) -->
      <button type="button" class="jia-burger"
        aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>

    </div>

  </nav>
  <div class="jia-mega-wrap">${buildMegaPanels()}</div>
</header>

<!-- mobile drawer -->
<div class="jia-mob" id="jiaMob" style="display:none">
  ${buildMobileLinks()}
  <div class="jia-mob-btns">
    <a href="/login.html"   class="jia-mob-login">Log In</a>
    <a href="/contact.html" class="jia-mob-sales">Contact Sales</a>
    <a href="/login.html" class="jia-mob-trial">Free Trial &rarr;</a>
  </div>
</div>
`;

/* ── inject ───────────────────────────────────────────────── */
/* site fonts — guaranteed on every page the nav loads on */
if (!document.querySelector('link[href*="Newsreader"]')) {
  const fontEl = document.createElement("link");
  fontEl.rel = "stylesheet";
  fontEl.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap";
  document.head.appendChild(fontEl);
}

/* favicon — pulled from /my-favicon/ on every page unless the page sets its own */
if (!document.querySelector('link[rel*="icon"]')) {
  [
    { rel: "icon",             href: "/my-favicon/favicon.ico",          sizes: "any" },
    { rel: "icon",             href: "/my-favicon/favicon.svg",          type: "image/svg+xml" },
    { rel: "icon",             href: "/my-favicon/favicon-96x96.png",    type: "image/png", sizes: "96x96" },
    { rel: "apple-touch-icon", href: "/my-favicon/apple-touch-icon.png", sizes: "180x180" },
  ].forEach(({ rel, href, type, sizes }) => {
    const l = document.createElement("link");
    l.rel = rel; l.href = href;
    if (type) l.type = type;
    if (sizes) l.sizes = sizes;
    document.head.appendChild(l);
  });
}
/* webmanifest — for PWA / home-screen icons */
if (!document.querySelector('link[rel="manifest"]')) {
  const m = document.createElement("link");
  m.rel = "manifest"; m.href = "/my-favicon/site.webmanifest";
  document.head.appendChild(m);
}

const styleEl = document.createElement("style");
styleEl.textContent = CSS;
document.head.appendChild(styleEl);

const tmp = document.createElement("div");
tmp.innerHTML = MARKUP.trim();
const hdr = tmp.children[0];
const mob = tmp.children[1];
document.body.insertBefore(mob,  document.body.firstChild);
document.body.insertBefore(hdr,  mob);

/* page veil behind open mega */
const veil = document.createElement("div");
veil.className = "jia-veil";
document.body.appendChild(veil);
function syncVeil() {
  veil.classList.toggle("on", !!hdr.querySelector(".jia-mega.open"));
}

/* ── behaviour ────────────────────────────────────────────── */
const burger   = hdr.querySelector(".jia-burger");
const acct     = hdr.querySelector(".jia-acct");
const acctBtn  = hdr.querySelector(".jia-acct-toggle");
const signout  = hdr.querySelector(".jia-signout");
const mobEl    = document.getElementById("jiaMob");

/* login-show elements: Log In, Contact Sales, Free Trial */
const loginShow = hdr.querySelectorAll(".jia-login-show");

function closeAll() {
  mobEl.classList.remove("open");
  mobEl.style.display = "none";
  burger.classList.remove("open");
  burger.setAttribute("aria-expanded", "false");
  acct.classList.remove("open");
  acctBtn.setAttribute("aria-expanded", "false");
}

/* burger toggle */
burger.addEventListener("click", e => {
  e.stopPropagation();
  const isOpen = !mobEl.classList.contains("open");
  if (isOpen) {
    mobEl.style.display = "flex";
    mobEl.classList.add("open");
  } else {
    mobEl.classList.remove("open");
    mobEl.style.display = "none";
  }
  burger.classList.toggle("open", isOpen);
  burger.setAttribute("aria-expanded", isOpen);
});

/* account toggle */
acctBtn.addEventListener("click", e => {
  e.stopPropagation();
  const isOpen = acct.classList.toggle("open");
  acctBtn.setAttribute("aria-expanded", isOpen);
});

/* click outside */
document.addEventListener("click", e => {
  if (!acct.contains(e.target)) acct.classList.remove("open");
  if (!mobEl.contains(e.target) && !burger.contains(e.target)) {
    mobEl.classList.remove("open");
    burger.classList.remove("open");
  }
});

/* escape */
document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });

/* close on mobile link tap */
mobEl.querySelectorAll("a").forEach(a => a.addEventListener("click", closeAll));

/* scroll shadow */
addEventListener("scroll", () =>
  hdr.classList.toggle("scrolled", scrollY > 40), { passive: true });

/* ── gliding hover pill under center links ── */
(function () {
  const ul = hdr.querySelector(".jia-links");
  if (!ul) return;
  const pill = document.createElement("span");
  pill.className = "jia-pill";
  ul.appendChild(pill);
  const rest = ul.querySelector("a.active");
  function moveTo(a) {
    const ur = ul.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    pill.style.width = ar.width + "px";
    pill.style.transform = `translate(${ar.left - ur.left}px, -50%)`;
    pill.classList.add("on");
  }
  function settle() {
    if (rest) moveTo(rest);
    else pill.classList.remove("on");
  }
  ul.querySelectorAll("li > a").forEach(a => {
    a.addEventListener("mouseenter", () => moveTo(a));
    a.addEventListener("focus", () => moveTo(a));
  });
  ul.addEventListener("mouseleave", settle);
  settle();
})();

/* ── smart hide: bar tucks away scrolling down, returns scrolling up ── */
(function () {
  const reducedNav = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedNav) return;
  let lastY = window.scrollY;
  addEventListener("scroll", () => {
    const y = window.scrollY;
    const megaOpen = hdr.querySelector(".jia-mega.open");
    const mobOpen = mobEl.classList.contains("open");
    if (!megaOpen && !mobOpen && y > 160 && y > lastY + 4) {
      hdr.classList.add("nav-hidden");
    } else if (y < lastY - 4 || y <= 160) {
      hdr.classList.remove("nav-hidden");
    }
    lastY = y;
  }, { passive: true });
  /* reveal when the cursor approaches the top edge */
  addEventListener("mousemove", e => {
    if (e.clientY < 70) hdr.classList.remove("nav-hidden");
  }, { passive: true });
})();

/* ── mobile accordion toggles ── */
mobEl.querySelectorAll(".jia-mob-acc").forEach(btn => {
  btn.addEventListener("click", () => {
    const group = btn.parentElement;
    const body = group.querySelector(".jia-mob-body");
    const opening = !group.classList.contains("open");
    group.classList.toggle("open", opening);
    btn.setAttribute("aria-expanded", opening);
    body.style.maxHeight = opening ? body.scrollHeight + "px" : "0px";
  });
});

/* ── MEGA-MENU HOVER — single source of truth ─────────────
   Panels open ONLY when JS adds the .mega-open class.
   open() force-closes every other mega first, so exactly one
   can be open at a time. A close timer on leave lets the
   mouse cross the gap onto the panel without it snapping shut. */
const megaPanels = hdr.querySelectorAll(".jia-mega");
function closeAllMega() {
  hdr.querySelectorAll(".jia-links > li.has-mega.mega-open").forEach(o => o.classList.remove("mega-open"));
  megaPanels.forEach(p => p.classList.remove("open"));
  syncVeil();
}
hdr.querySelectorAll(".jia-links > li.has-mega").forEach(li => {
  const idx = li.getAttribute("data-mega");
  const panel = hdr.querySelector(`.jia-mega[data-mega="${idx}"]`);
  if (!panel) return;
  let closeTimer = null;
  const open = () => {
    clearTimeout(closeTimer); closeTimer = null;
    hdr.querySelectorAll(".jia-links > li.has-mega.mega-open").forEach(o => { if (o !== li) o.classList.remove("mega-open"); });
    megaPanels.forEach(p => { if (p !== panel) p.classList.remove("open"); });
    li.classList.add("mega-open"); panel.classList.add("open");
    syncVeil();
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { li.classList.remove("mega-open"); panel.classList.remove("open"); closeTimer = null; syncVeil(); }, 220);
  };
  li.addEventListener("mouseenter", open);
  li.addEventListener("mouseleave", scheduleClose);
  panel.addEventListener("mouseenter", open);
  panel.addEventListener("mouseleave", scheduleClose);
  /* keyboard: open on focus, close when focus leaves both */
  li.addEventListener("focusin", open);
  panel.addEventListener("focusin", open);
  li.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      if (!li.contains(document.activeElement) && !panel.contains(document.activeElement)) scheduleClose();
    });
  });
  panel.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      if (!li.contains(document.activeElement) && !panel.contains(document.activeElement)) scheduleClose();
    });
  });
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeAllMega(); });
addEventListener("scroll", closeAllMega, { passive: true });

/* smooth scroll on homepage */
if (isHome()) {
  hdr.querySelectorAll('a[href*="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const id = a.getAttribute("href").split("#")[1];
      const target = id && document.getElementById(id);
      if (target) {
        e.preventDefault();
        scrollTo({
          top: target.getBoundingClientRect().top + pageYOffset - hdr.offsetHeight - 20,
          behavior: "smooth"
        });
        closeAll();
      }
    });
  });
}

/* ── Firebase auth ────────────────────────────────────────── */
const app = initializeApp({
  apiKey:            "AIzaSyDHs92C3ariQ285KUkodOHV04sEVKr_dQ8",
  authDomain:        "jayisaac-ai.firebaseapp.com",
  projectId:         "jayisaac-ai",
  storageBucket:     "jayisaac-ai.firebasestorage.app",
  messagingSenderId: "967801239356",
  appId:             "1:967801239356:web:0df3f35af72ce6e79b9039",
  measurementId:     "G-V91DS21PGE"
});

/* ── Cookie consent + Firebase Analytics (lazy-loaded after consent) ── */
import("/cookie-consent.js").then(({ initCookieConsent }) => {
  initCookieConsent({ firebaseApp: app });
}).catch(e => console.warn("[nav] cookie-consent module failed:", e?.message));

const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

window.firebaseAuth = {
  signInWithGoogle: async () => {
    try   { return (await signInWithPopup(auth, provider)).user; }
    catch (e) { alert("Sign in failed: " + e.message); }
  },
  signOut: async () => {
    try   { await signOut(auth); }
    catch (e) { console.error(e.message); }
  },
  getCurrentUser: () => auth.currentUser
};

const photoEl   = hdr.querySelector(".jia-acct-photo");
const nameEls   = hdr.querySelectorAll(".jia-acct-name, .jia-acct-head .nm");
const emailEl   = hdr.querySelector(".jia-acct-head .em");

signout.addEventListener("click", () => { window.firebaseAuth.signOut(); closeAll(); });

onAuthStateChanged(auth, user => {
  if (user) {
    /* hide the three public buttons, show account pill */
    loginShow.forEach(el => el.style.display = "none");
    acct.style.display = "flex";
    nameEls.forEach(el =>
      el.textContent = user.displayName ? user.displayName.split(" ")[0] : "Account");
    photoEl.src = user.photoURL ||
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(user.displayName || "User") +
      "&background=4F46E5&color=fff&size=80";
    if (emailEl) emailEl.textContent = user.email || "";
  } else {
    /* show the three public buttons, hide account pill */
    loginShow.forEach(el => el.style.display = "");
    acct.style.display = "none";
  }
});