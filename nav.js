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
    label: "Platform",
    href:  "/app.html",
    mega: {
      cols: [
        {
          heading: "Prospect",
          items: [
            { label: "Prospect Search",      sub: "Find decision-makers fast",  href: "/app.html"                 },
            { label: "People Search",        sub: "Owners, GMs, buyers",        href: "/people-search.html"       },
            { label: "Company Search",       sub: "Filter by industry & size",  href: "/company-search.html"      },
            { label: "Cold Calling Lists",   sub: "Dial-ready exports",         href: "/cold-calling-lists.html"  },
          ]
        },
        {
          heading: "Solutions",
          items: [
            { label: "For Sales Teams",      sub: "Pipeline without grunt work",href: "/sales-teams.html"         },
            { label: "For Agencies",         sub: "Multi-client campaigns",     href: "/agencies.html"            },
            { label: "Verified Contacts",    sub: "Emails & phones that work",  href: "/data.html#verified"       },
            { label: "Free Trial",           sub: "100 credits, no card",       href: "/login.html"               },
          ]
        }
      ]
    }
  },
  {
    label: "Our Data",
    href:  "/data.html",
    mega: {
      cols: [
        {
          heading: "Data Coverage",
          items: [
            { label: "Data Overview",        sub: "What's in the database",     href: "/data.html"                },
            { label: "North America-Wide",   sub: "Every province & state",     href: "/data.html#coverage"       },
            { label: "Real-Time Updates",    sub: "Rolling re-verification",    href: "/data.html#updates"        },
            { label: "Verified Contacts",    sub: "Validated emails & phones",  href: "/data.html#verified"       },
          ]
        },
        {
          heading: "For Developers",
          items: [
            { label: "API Access",           sub: "Pull contact data",          href: "/api.html"                 },
            { label: "Data as a Service",    sub: "Bulk exports & feeds",       href: "/api.html#daas"            },
          ]
        }
      ]
    }
  },
  { label: "Pricing",     href: "/pricing.html"       },
  { label: "Resources",   href: "/support.html",
    mega: {
      cols: [
        {
          heading: "Learn",
          items: [
            { label: "How It Works",         sub: "Step by step",               href: "/support.html"             },
            { label: "Case Studies",         sub: "Real results",               href: "/case-studies.html"        },
            { label: "Help Center",          sub: "FAQs & support docs",        href: "/support.html"             },
          ]
        },
        {
          heading: "Company",
          items: [
            { label: "About Us",             sub: "Built in Saskatoon, SK",     href: "/about.html"               },
            { label: "Contact",              sub: "Talk to the team",           href: "/contact.html"             },
            { label: "Trust Center",         sub: "Security & privacy",         href: "/trust.html"               },
          ]
        }
      ]
    }
  },
];

const LOGO_SRC = "/public/new-logo1.jpg";

/* ── CSS ─────────────────────────────────────────────────── */
const CSS = `
:root {
  --jia-orange:      #C95E1A;
  --jia-orange-h:    #E06B1E;
  --jia-orange-dim:  rgba(201,94,26,.13);
  --jia-orange-edge: rgba(201,94,26,.38);
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
.jia-brand:hover { text-decoration: none; filter: drop-shadow(0 0 8px rgba(201,94,26,.45)); }

/* corner logo — hidden until scrolled, then swaps in for the shield */
.jia-brand-logo {
  width: 0; height: 36px; border-radius: 50%;
  object-fit: cover; opacity: 0;
  border: 1.5px solid var(--jia-orange-edge);
  box-shadow: 0 0 0 3px rgba(201,94,26,.1);
  transition: width .3s cubic-bezier(.34,1.56,.64,1), opacity .25s, margin-right .3s;
  margin-right: 0; flex-shrink: 0;
}
.jia-hdr.scrolled .jia-brand-logo {
  width: 36px; opacity: 1; margin-right: .2rem;
}
.jia-brand-ai {
  background: linear-gradient(135deg, #E8742E, #FF9A55);
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
.jia-links > li.has-mega:hover .jia-chev { transform:rotate(180deg); opacity:.9; }

/* ── mega panel ── */
.jia-mega {
  position: absolute;
  top: 100%;                    /* sit flush against the nav so no hover gap */
  left: 50%; transform: translateX(-50%) translateY(8px);
  background: var(--jia-card);
  border: 1px solid var(--jia-b);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0,0,0,.65), 0 1px 0 rgba(255,255,255,.04);
  padding: 1.1rem;
  display: flex; gap: .5rem;
  opacity:0; visibility:hidden; pointer-events:none;
  /* slow leave transition prevents the menu from disappearing if user briefly drifts off */
  transition: opacity .18s ease, transform .18s ease, visibility .18s ease;
  transition-delay: .15s;       /* delay on close so user has time to reach the menu */
  min-width: 520px;
  margin-top: 12px;             /* visual gap kept via margin, not actual gap */
}

/* invisible "bridge" between trigger link and dropdown — kills the hover gap.
   Must be as wide as the dropdown itself, not just the link. */
.jia-links > li.has-mega::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 560px;                 /* wider than .jia-mega min-width (520px) */
  height: 24px;                 /* covers the 12px gap + 12px breathing room */
  background: transparent;
  pointer-events: none;
}
.jia-links > li.has-mega:hover::after,
.jia-links > li.has-mega.mega-open::after {
  pointer-events: auto;         /* only active during hover, keeps the bridge alive */
}

.jia-links > li.has-mega:hover .jia-mega,
.jia-links > li.has-mega.mega-open .jia-mega {
  opacity:1; visibility:visible; pointer-events:auto;
  transform: translateX(-50%) translateY(0);
  transition-delay: 0s;         /* open instantly */
}

/* arrow tip */
.jia-mega::before {
  content:''; position:absolute;
  top:-5px; left:50%; transform:translateX(-50%) rotate(45deg);
  width:9px; height:9px;
  background:var(--jia-card);
  border-left:1px solid var(--jia-b);
  border-top:1px solid var(--jia-b);
}

/* single col */
.jia-mega-col { flex:1; min-width:0; }

/* col heading */
.jia-mega-head {
  font-size:.68rem; font-weight:700;
  color: var(--jia-orange);
  text-transform:uppercase; letter-spacing:.1em;
  padding: .35rem .85rem .6rem;
  display:block;
}

/* mega row */
.jia-mega-row {
  display:flex; flex-direction:column; gap:.18rem;
  padding: .65rem .85rem;
  border-radius:9px; text-decoration:none;
  transition: background .12s ease;  /* faster, snappier hover feedback */
  cursor: pointer;
}
.jia-mega-row:hover { background:rgba(255,255,255,.05); }
.jia-mega-row:hover .jia-ml { color:var(--jia-orange-h); }
.jia-ml {
  font-size:.855rem; font-weight:600;
  color:var(--jia-white); transition:color .17s;
  white-space:nowrap;
}
.jia-ms {
  font-size:.74rem; color:var(--jia-mute); line-height:1.35;
}

/* col divider */
.jia-mega-col + .jia-mega-col {
  border-left: 1px solid var(--jia-b);
  padding-left:.5rem;
}

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
.jia-acct-toggle:hover { background:rgba(201,94,26,.22); }
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
  border-image:linear-gradient(180deg,rgba(201,94,26,0) 0%,rgba(201,94,26,.5) 55%,rgba(201,94,26,0) 100%) 1;
  pointer-events:none;
}
.jia-shield img {
  height:54px; width:54px; border-radius:50%;
  border:2px solid var(--jia-orange-edge);
  box-shadow: 0 0 0 4px rgba(201,94,26,.1), 0 4px 18px rgba(0,0,0,.5);
  object-fit:cover;
  transition:transform .45s cubic-bezier(.34,1.56,.64,1), box-shadow .3s;
  display:block;
}
.jia-shield img:hover {
  transform:scale(1.1) rotate(3deg);
  box-shadow:0 0 0 7px rgba(201,94,26,.18), 0 6px 24px rgba(0,0,0,.55);
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

/* hide shield when a mega dropdown is open (hovering Platform / Our Data / Resources) */
.jia-nav:has(.jia-links > li.has-mega:hover) .jia-shield,
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
  return LINKS.map(l => {
    const active = activePath(l.href) ? " class=\"active\"" : "";
    if (l.mega) {
      const cols = l.mega.cols.map(col => {
        const rows = col.items.map(it => `
          <a href="${it.href}" class="jia-mega-row">
            <span class="jia-ml">${it.label}</span>
            <span class="jia-ms">${it.sub}</span>
          </a>`).join("");
        return `<div class="jia-mega-col">
          <span class="jia-mega-head">${col.heading}</span>
          ${rows}
        </div>`;
      }).join("");
      return `
        <li class="has-mega">
          <a href="${l.href}"${active}>
            ${l.label}
            <svg class="jia-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </a>
          <div class="jia-mega">${cols}</div>
        </li>`;
    }
    return `<li><a href="${l.href}"${active}>${l.label}</a></li>`;
  }).join("");
}

function buildMobileLinks() {
  return LINKS.map(l => {
    if (l.mega) {
      const section = `<span class="jia-mob-section">${l.label}</span>`;
      const items = l.mega.cols.flatMap(c => c.items).map(it =>
        `<a href="${it.href}" class="jia-mob-link">${it.label}</a>`
      ).join("");
      return section + items;
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

/* ── BULLETPROOF MEGA-MENU HOVER ──────────────────────────
   CSS :hover handles 95% of cases, but the 12px gap between
   the trigger link and dropdown can cause flickering closes.
   The JS layer below uses a 300ms close timer that any movement
   onto the dropdown cancels. Three layers of defense:
   1. Wide invisible bridge (CSS, 560px)
   2. CSS :hover with transition-delay
   3. JS class toggle with timeout (this) */
hdr.querySelectorAll(".jia-links > li.has-mega").forEach(li => {
  let closeTimer = null;
  const open = () => {
    clearTimeout(closeTimer);
    closeTimer = null;
    li.classList.add("mega-open");
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      li.classList.remove("mega-open");
      closeTimer = null;
    }, 300);
  };
  /* mouseenter/leave do NOT bubble, so they fire correctly when
     transitioning between the link and the mega panel inside the li */
  li.addEventListener("mouseenter", open);
  li.addEventListener("mouseleave", scheduleClose);
  /* Also bind directly to the mega panel so quick mouse jumps work */
  const mega = li.querySelector(".jia-mega");
  if(mega){
    mega.addEventListener("mouseenter", open);
    mega.addEventListener("mouseleave", scheduleClose);
  }
});

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