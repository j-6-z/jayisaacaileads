/* ============================================================
   JAYISAAC AI — shared site navigation
   <script type="module" src="/nav.js"></script>
   ZoomInfo-style: logo left · mega links center · Log In +
   Contact Sales + Free Trial right · floating shield · Firebase
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
        text:    "Sell, run, and defend your business from a single account — shared data, one flat bill.",
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
        eyebrow: "Built in Canada",
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
            { label: "About Us",     sub: "Built in Saskatoon, SK", href: "/about.html"   },
            { label: "Contact",      sub: "Talk to the team",       href: "/contact.html" },
            { label: "Careers",      sub: "Join the team",          href: "/careers.html" },
            { label: "Trust Center", sub: "Security & privacy",     href: "/trust.html"   },
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
  --jia-orange:      #6366F1;
  --jia-orange-h:    #818CF8;
  --jia-orange-dim:  rgba(99,102,241,.13);
  --jia-orange-edge: rgba(99,102,241,.38);
  --jia-bg:          #0C0C0C;
  --jia-surface:     #141414;
  --jia-card:        #191919;
  --jia-b:           #2A2A2A;
  --jia-bl:          rgba(255,255,255,.07);
  --jia-white:       #F2F2F2;
  --jia-mute:        rgba(242,242,242,.5);
  --jia-faint:       rgba(242,242,242,.28);
  --jia-h: 66px;
}

body { padding-top: var(--jia-h); }
@media(max-width:900px){ body { padding-top: var(--jia-h); } }

/* ── bar ── */
.jia-hdr {
  position: fixed; top:0; left:0; width:100%; z-index:1000;
  height: var(--jia-h);
  background: rgba(10,10,12,.97);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border-bottom: 1px solid var(--jia-bl);
  font-family: 'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  transition: background .25s, box-shadow .25s;
}
.jia-hdr.scrolled {
  background: rgba(10,10,12,.97);
  box-shadow: 0 1px 0 rgba(255,255,255,.04), 0 8px 30px rgba(0,0,0,.55);
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
  font-size: 1.05rem; font-weight: 800; letter-spacing: .14em;
  color: var(--jia-white); text-decoration: none;
  display: flex; align-items: center; gap: .55rem; flex-shrink:0;
  z-index: 2; text-transform: uppercase;
  transition: filter .3s;
}
.jia-brand:hover { text-decoration: none; filter: drop-shadow(0 0 8px rgba(99,102,241,.45)); }

/* corner logo — hidden until scrolled, then swaps in for the shield */
.jia-brand-logo {
  width: 0; height: 36px; border-radius: 50%;
  object-fit: cover; opacity: 0;
  border: 1.5px solid var(--jia-orange-edge);
  box-shadow: 0 0 0 3px rgba(99,102,241,.1);
  transition: width .3s cubic-bezier(.34,1.56,.64,1), opacity .25s, margin-right .3s;
  margin-right: 0; flex-shrink: 0;
}
.jia-hdr.scrolled .jia-brand-logo {
  width: 36px; opacity: 1; margin-right: .2rem;
}
.jia-brand-ai {
  background: linear-gradient(135deg, #818CF8, #A5B4FC);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 800;
}
.jia-dot {
  width:8px; height:8px; border-radius:50%;
  background: var(--jia-orange);
  box-shadow: 0 0 8px var(--jia-orange-dim);
  flex-shrink:0;
  animation: jia-pulse 2.5s infinite;
}
@keyframes jia-pulse { 0%,100%{opacity:1} 50%{opacity:.25} }

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
}
.jia-links > li { position:relative; }

.jia-links > li > a {
  display: flex; align-items: center; gap:.28rem;
  padding: .5rem .82rem;
  border-radius: 7px;
  color: var(--jia-mute);
  text-decoration: none;
  font-size: .855rem; font-weight: 500;
  white-space: nowrap;
  transition: color .17s, background .17s;
}
.jia-links > li > a:hover,
.jia-links > li.has-mega:hover > a,
.jia-links > li > a.active {
  color: var(--jia-white);
  background: rgba(255,255,255,.05);
}
.jia-chev {
  width:10px; height:10px; stroke:currentColor; fill:none;
  stroke-width:2; stroke-linecap:round; stroke-linejoin:round;
  opacity:.45; transition:transform .2s, opacity .2s; flex-shrink:0;
}
.jia-links > li.has-mega.mega-open .jia-chev { transform:rotate(180deg); opacity:.9; }

/* ── full-width mega panel (immersive, itransition-style) ── */
.jia-mega-wrap { position: static; }
.jia-mega {
  position: absolute;
  top: 100%; left: 0; right: 0;
  background: linear-gradient(180deg, #141414 0%, #0E0E0E 100%);
  border-top: 1px solid var(--jia-bl);
  border-bottom: 1px solid var(--jia-b);
  box-shadow: 0 30px 70px rgba(0,0,0,.6);
  opacity: 0; visibility: hidden; pointer-events: none;
  transform: translateY(-10px);
  transition: opacity .2s ease, transform .24s cubic-bezier(.16,1,.3,1), visibility .2s;
  z-index: 999;
}
.jia-mega.open { opacity: 1; visibility: visible; pointer-events: auto; transform: none; }

.jia-mega-inner { max-width: 1380px; margin: 0 auto; padding: 2.25rem 2rem 2.6rem; }
.jia-mega-inner.has-feature { display: grid; grid-template-columns: 300px 1fr; gap: 3rem; align-items: stretch; }

.jia-mega-feature {
  display: flex; flex-direction: column; justify-content: center;
  padding: 1.7rem 1.6rem; border-radius: 16px; text-decoration: none;
  background: linear-gradient(160deg, rgba(99,102,241,.18), rgba(168,85,247,.07));
  border: 1px solid var(--jia-orange-edge);
  transition: border-color .2s, transform .2s;
}
.jia-mega-feature:hover { border-color: rgba(129,140,248,.6); transform: translateY(-2px); }
.jmf-eyebrow { font-size: .64rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; color: var(--jia-orange-h); margin-bottom: .7rem; }
.jmf-title { font-size: 1.4rem; font-weight: 800; color: #fff; line-height: 1.15; letter-spacing: -.01em; margin-bottom: .65rem; }
.jmf-text { font-size: .82rem; color: var(--jia-mute); line-height: 1.6; margin-bottom: 1.1rem; }
.jmf-cta { display: inline-flex; align-items: center; gap: .45rem; font-size: .82rem; font-weight: 700; color: var(--jia-orange-h); }
.jmf-cta svg { width: 14px; height: 14px; fill: none; stroke: currentColor; }

.jia-mega-cols { display: grid; gap: 2rem; }
.jia-mega-col { min-width: 0; }

.jia-mega-colhead { display: flex; align-items: center; gap: .7rem; padding: .3rem .35rem .85rem; margin-bottom: .5rem; border-bottom: 1px solid var(--jia-b); text-decoration: none; }
.jmc-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.jmc-icon svg { width: 18px; height: 18px; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.jia-mega-colhead.lead  .jmc-icon { background: linear-gradient(135deg,#818CF8,#6366F1); box-shadow: 0 6px 16px rgba(99,102,241,.4); }
.jia-mega-colhead.staff .jmc-icon { background: linear-gradient(135deg,#C084FC,#A855F7); box-shadow: 0 6px 16px rgba(168,85,247,.4); }
.jia-mega-colhead.cyber .jmc-icon { background: linear-gradient(135deg,#67E8F9,#0891B2); box-shadow: 0 6px 16px rgba(34,211,238,.35); }
.jmc-txt b { display: block; font-size: .88rem; font-weight: 800; color: #fff; }
.jmc-txt i { display: block; font-size: .72rem; font-style: normal; color: var(--jia-mute); margin-top: .05rem; }
.jia-mega-colhead:hover .jmc-txt b { color: var(--jia-orange-h); }

.jia-mega-head { display: block; font-size: .68rem; font-weight: 700; color: var(--jia-orange); text-transform: uppercase; letter-spacing: .1em; padding: .3rem .35rem .95rem; border-bottom: 1px solid var(--jia-b); margin-bottom: .5rem; }

.jia-mega-row { display: block; padding: .5rem .5rem; border-radius: 8px; text-decoration: none; transition: background .12s; }
.jia-mega-row:hover { background: rgba(255,255,255,.05); }
.jia-ml { display: block; font-size: .845rem; font-weight: 600; color: rgba(242,242,242,.82); transition: color .15s; }
.jia-mega-row:hover .jia-ml { color: var(--jia-orange-h); }
.jia-ms { display: block; font-size: .72rem; color: var(--jia-mute); margin-top: .08rem; }

@media(max-width:1100px){ .jia-mega { display: none !important; } }

/* ── right buttons — Log In · Contact Sales · Free Trial ── */
.jia-right {
  display:flex; align-items:center; gap:.6rem; flex-shrink:0; z-index:2;
}

/* Log In — plain text */
.jia-btn-login {
  color: var(--jia-mute);
  text-decoration:none;
  font-size:.855rem; font-weight:500;
  padding:.5rem .75rem;
  border-radius:7px;
  transition:color .17s, background .17s;
  white-space:nowrap;
}
.jia-btn-login:hover { color:var(--jia-white); background:rgba(255,255,255,.05); }

/* Contact Sales — ghost outlined */
.jia-btn-sales {
  color: var(--jia-white);
  text-decoration:none;
  font-size:.855rem; font-weight:600;
  padding:.5rem 1.1rem;
  border-radius:8px;
  border:1px solid var(--jia-b);
  background:transparent;
  transition:border-color .17s, background .17s, color .17s;
  white-space:nowrap;
}
.jia-btn-sales:hover {
  border-color: rgba(255,255,255,.25);
  background: rgba(255,255,255,.05);
}

/* Free Trial — solid orange */
.jia-btn-trial {
  color: var(--jia-white);
  text-decoration:none;
  font-size:.855rem; font-weight:700;
  padding:.52rem 1.2rem;
  border-radius:8px;
  background: var(--jia-orange);
  border:none; cursor:pointer;
  display:inline-flex; align-items:center; gap:.35rem;
  transition:background .17s, transform .12s;
  white-space:nowrap; font-family:inherit;
}
.jia-btn-trial:hover { background:var(--jia-orange-h); transform:translateY(-1px); }
.jia-btn-trial:active { transform:scale(.98); }

/* ── auth account dropdown (shown when signed in) ── */
.jia-acct { position:relative; display:none; }
.jia-acct-toggle {
  display:flex; align-items:center; gap:.5rem; cursor:pointer;
  padding:.38rem .8rem .38rem .45rem;
  border-radius:9px;
  border:1px solid var(--jia-orange-edge);
  background:var(--jia-orange-dim);
  font-family:inherit;
  transition:background .17s;
}
.jia-acct-toggle:hover { background:rgba(99,102,241,.22); }
.jia-acct-photo {
  width:26px; height:26px; border-radius:50%;
  object-fit:cover; border:1.5px solid var(--jia-orange-edge);
}
.jia-acct-name { font-size:.83rem; font-weight:600; color:var(--jia-white); }
.jia-acct-arr  { font-size:.54rem; color:var(--jia-mute); transition:transform .2s; }
.jia-acct.open .jia-acct-arr { transform:rotate(180deg); }

.jia-acct-menu {
  position:absolute; top:calc(100% + .75rem); right:0;
  background:var(--jia-card); border:1px solid var(--jia-b);
  border-radius:14px; box-shadow:0 20px 50px rgba(0,0,0,.65);
  min-width:220px; overflow:hidden;
  opacity:0; visibility:hidden; transform:translateY(6px);
  transition:opacity .2s, transform .2s, visibility .2s;
}
.jia-acct.open .jia-acct-menu { opacity:1; visibility:visible; transform:translateY(0); }

.jia-acct-head {
  padding:.9rem 1.15rem; border-bottom:1px solid var(--jia-b);
}
.jia-acct-head .nm {
  font-size:.88rem; font-weight:700; color:var(--jia-white);
  display:block; margin-bottom:.12rem;
}
.jia-acct-head .em { font-size:.74rem; color:var(--jia-faint); word-break:break-all; }

.jia-acct-menu a,
.jia-acct-menu button {
  display:flex; align-items:center; gap:.7rem;
  padding:.78rem 1.15rem;
  color:rgba(242,242,242,.8); text-decoration:none;
  border:none; background:none; width:100%;
  font-size:.845rem; cursor:pointer;
  border-bottom:1px solid var(--jia-b);
  font-family:inherit; text-align:left;
  transition:background .17s, color .17s;
}
.jia-acct-menu a:last-child,
.jia-acct-menu button:last-child { border-bottom:none; }
.jia-acct-menu a:hover,
.jia-acct-menu button:hover { background:rgba(255,255,255,.04); color:var(--jia-orange-h); }
.jia-acct-menu svg {
  width:15px; height:15px; stroke:currentColor; fill:none;
  stroke-width:1.75; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0;
}
.jia-signout { color:#f87171!important; }
.jia-signout:hover { background:rgba(248,113,113,.07)!important; color:#fca5a5!important; }

/* ── floating shield ── */
.jia-shield {
  position:absolute;
  left:50%; transform:translateX(-50%);
  top:100%; z-index:1002;
  display:flex; justify-content:center; align-items:flex-start;
  clip-path: polygon(0 0,100% 0,100% 62%,50% 100%,0 62%);
  background: linear-gradient(180deg,rgba(18,18,20,.98),rgba(10,10,12,.98));
  padding:.65rem .75rem 1.9rem;
  box-shadow: 0 14px 36px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05);
}
.jia-shield::after {
  content:''; position:absolute; inset:0;
  clip-path: polygon(0 0,100% 0,100% 62%,50% 100%,0 62%);
  border:1.5px solid transparent;
  border-image:linear-gradient(180deg,rgba(99,102,241,0) 0%,rgba(99,102,241,.5) 55%,rgba(99,102,241,0) 100%) 1;
  pointer-events:none;
}
.jia-shield img {
  height:54px; width:54px; border-radius:50%;
  border:2px solid var(--jia-orange-edge);
  box-shadow: 0 0 0 4px rgba(99,102,241,.1), 0 4px 18px rgba(0,0,0,.5);
  object-fit:cover;
  transition:transform .45s cubic-bezier(.34,1.56,.64,1), box-shadow .3s;
  display:block;
}
.jia-shield img:hover {
  transform:scale(1.1) rotate(3deg);
  box-shadow:0 0 0 7px rgba(99,102,241,.18), 0 6px 24px rgba(0,0,0,.55);
}
.jia-shield.hide { display:none; }

/* shield disappears on scroll — corner logo takes over */
.jia-hdr.scrolled .jia-shield {
  opacity: 0; transform: translateX(-50%) translateY(-12px) scale(.8);
  pointer-events: none;
}
.jia-shield {
  transition: opacity .3s, transform .3s;
}

/* hide shield when a mega dropdown is open (Platform / Our Data / Resources) */
.jia-nav:has(.jia-links > li.has-mega.mega-open) .jia-shield {
  opacity: 0; transform: translateX(-50%) translateY(-12px) scale(.8);
  pointer-events: none;
}

/* ── burger ── */
.jia-burger {
  display:none; flex-direction:column; gap:5px;
  background:none; border:none; cursor:pointer; padding:.5rem; z-index:1001;
}
.jia-burger span {
  width:22px; height:1.5px; background:var(--jia-white);
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
  .jia-shield img { height:46px; width:46px; }
  /* corner logo stays hidden on mobile — the wordmark already anchors the corner */
  .jia-hdr.scrolled .jia-brand-logo { width: 0; opacity: 0; margin-right: 0; }

  .jia-mob {
    position:fixed;
    top:var(--jia-h); left:0; right:0;
    background:rgba(10,10,12,.97);
    backdrop-filter:blur(20px);
    border-bottom:1px solid var(--jia-b);
    padding:1.25rem 1.5rem 2rem;
    display:none; flex-direction:column; gap:.15rem;
    z-index:998; max-height:calc(100vh - var(--jia-h));
    overflow-y:auto;
    box-shadow:0 20px 40px rgba(0,0,0,.5);
  }
  .jia-mob.open { display:flex; }

  .jia-mob-section {
    font-size:.67rem; font-weight:700;
    color:var(--jia-orange);
    text-transform:uppercase; letter-spacing:.1em;
    padding:.9rem .4rem .3rem; display:block;
  }
  .jia-mob-link {
    color:var(--jia-mute); text-decoration:none;
    font-size:.9rem; font-weight:500;
    padding:.7rem .4rem;
    border-bottom:1px solid var(--jia-b);
    display:block; transition:color .17s;
  }
  .jia-mob-link:hover { color:var(--jia-white); }

  .jia-mob-btns {
    display:flex; flex-direction:column; gap:.7rem;
    margin-top:1.1rem; padding-top:1.1rem;
    border-top:1px solid var(--jia-b);
  }
  .jia-mob-btns a {
    width:100%; text-align:center;
    padding:.82rem; border-radius:9px;
    font-size:.9rem; font-weight:600;
    text-decoration:none; display:block;
  }
  .jia-mob-login {
    color:var(--jia-mute);
    border:1px solid var(--jia-b);
    background:transparent;
    transition:color .17s, border-color .17s;
  }
  .jia-mob-login:hover { color:var(--jia-white); border-color:rgba(255,255,255,.2); }
  .jia-mob-sales {
    color:var(--jia-white);
    border:1px solid var(--jia-b);
    background:transparent;
    transition:background .17s;
  }
  .jia-mob-sales:hover { background:rgba(255,255,255,.05); }
  .jia-mob-trial {
    color:var(--jia-white)!important;
    background:var(--jia-orange);
    font-weight:700!important;
    transition:background .17s;
  }
  .jia-mob-trial:hover { background:var(--jia-orange-h); }
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
        const section  = `<span class="jia-mob-section">${c.head}</span>`;
        const overview = c.href ? `<a href="${c.href}" class="jia-mob-link">Overview</a>` : "";
        const items    = c.items.map(it => `<a href="${it.href}" class="jia-mob-link">${it.label}</a>`).join("");
        return section + overview + items;
      }).join("");
    }
    return `<a href="${l.href}" class="jia-mob-link">${l.label}</a>`;
  }).join("");
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

    <!-- floating shield -->
    <div class="jia-shield" id="jiaShield">
      <img src="${LOGO_SRC}" alt="JAYISAAC AI logo">
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

/* ── behaviour ────────────────────────────────────────────── */
const burger   = hdr.querySelector(".jia-burger");
const shield   = hdr.querySelector(".jia-shield");
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
  shield.classList.remove("hide");
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
  shield.classList.toggle("hide", isOpen);
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
    shield.classList.remove("hide");
  }
});

/* escape */
document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });

/* close on mobile link tap */
mobEl.querySelectorAll("a").forEach(a => a.addEventListener("click", closeAll));

/* scroll shadow */
addEventListener("scroll", () =>
  hdr.classList.toggle("scrolled", scrollY > 40), { passive: true });

/* ── MEGA-MENU HOVER — single source of truth ─────────────
   Panels open ONLY when JS adds the .mega-open class (CSS no
   longer reacts to raw :hover). open() force-closes every
   other mega first, so exactly one can be open at a time.
   A 300ms close timer on leave lets the mouse cross the gap
   onto the panel without it snapping shut. */
const megaPanels = hdr.querySelectorAll(".jia-mega");
function closeAllMega() {
  hdr.querySelectorAll(".jia-links > li.has-mega.mega-open").forEach(o => o.classList.remove("mega-open"));
  megaPanels.forEach(p => p.classList.remove("open"));
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
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { li.classList.remove("mega-open"); panel.classList.remove("open"); closeTimer = null; }, 220);
  };
  li.addEventListener("mouseenter", open);
  li.addEventListener("mouseleave", scheduleClose);
  panel.addEventListener("mouseenter", open);
  panel.addEventListener("mouseleave", scheduleClose);
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
      "&background=C95E1A&color=fff&size=80";
    if (emailEl) emailEl.textContent = user.email || "";
  } else {
    /* show the three public buttons, hide account pill */
    loginShow.forEach(el => el.style.display = "");
    acct.style.display = "none";
  }
});