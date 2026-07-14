# JAYISAAC AI — three-category restructure

## What this does
Turns the root homepage into a **hub** that routes to three product categories, each in its own folder:

```
/                         (hub — new index.html)
  nav.js  footer.js       shared, stay at root
  cookie-consent.js       shared, stays at root
  public/  my-favicon/    shared assets, stay at root
  login.html  account.html  app.html  thank-you.html   shared app/auth, stay at root
  pricing.html  privacy.html  terms.html  trust.html  contact.html  … shared, stay at root
  /lead-generation/index.html   ← your CURRENT homepage, moved here
  /chief-of-staff/index.html    ← new product page (filled)
  /cybersecurity/index.html     ← new product page (placeholder for now)
```

## Why it doesn't break
Every page now references shared stuff by **root-absolute** path (`/nav.js`, `/public/…`, `/login.html`).
A root-absolute path resolves the same no matter how deep the page is nested, so pages work
identically at root or inside a folder. No `vercel.json` change is required — Vercel serves
`/chief-of-staff/` → `/chief-of-staff/index.html` automatically.

## Files in this drop
- `index.html`                     → new hub. Replaces your current root index.html.
- `nav.js`                         → your nav.js + a new **Products** menu linking the 3 folders. Replaces root nav.js.
- `footer.js`                      → unchanged copy of yours (included for completeness).
- `lead-generation/index.html`     → your current homepage, path-fixed to root-absolute.
- `chief-of-staff/index.html`      → the filled Chief of Staff page.
- `cybersecurity/index.html`       → Cybersecurity placeholder (fill later).

## Deploy steps
1. In your repo, create folders: `lead-generation/`, `chief-of-staff/`, `cybersecurity/`.
2. Copy the three `*/index.html` files into their matching folders.
3. Replace root `index.html` with the new hub, and root `nav.js` with the new nav.js.
4. Leave `footer.js`, `public/`, `my-favicon/`, `login.html`, `app.html`, `pricing.html`, and
   all other shared pages exactly where they are at root.
5. Commit and push — Vercel deploys on push. Nothing in `vercel.json`, the Stripe block,
   `package.json`, `api/`, or `lib/` is touched.

## IMPORTANT — SEO / the moved homepage
Your lead-gen page currently lives at `/` (root) and is what ranks. After this change it lives at
`/lead-generation/`. To keep that link equity, add a 301 redirect from the old root to the new path
**only if** you want the hub at root. Merge this into `vercel.json` `redirects` (additive — do NOT
touch your existing `outputDirectory`, `buildCommand`, `functions`, or `headers` blocks):

```json
"redirects": [
  { "source": "/index.html", "destination": "/lead-generation/", "permanent": true }
]
```

If you'd rather NOT move your ranking homepage yet: keep your current lead-gen page at root as `index.html`,
skip the `/lead-generation/` folder, and just add the `/chief-of-staff/` and `/cybersecurity/` folders +
the Products nav. You lose the neutral hub but keep your SEO exactly as-is. Your call.

## Sorting the rest later (optional, incremental)
The lead-gen sub-pages currently at root (`people-search.html`, `company-search.html`,
`cold-calling-lists.html`, `sales-teams.html`, `agencies.html`, `data.html`, `api.html`, `pricing.html`)
can move into `/lead-generation/` over time. If you move any of them:
- update its links in `nav.js` / `footer.js` (their `href`s point at root paths today), and
- add a redirect from the old root path to the new folder path.
Do these one page at a time so a bad link never takes down the live site.
