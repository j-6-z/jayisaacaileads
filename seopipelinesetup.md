# JAYISAAC AI — Automated SEO/GEO Content Pipeline

Generates one SEO + AI-answer-engine (GEO) optimized article per day, publishes it
as a real server-rendered page, and keeps a sitemap updated. Built to run on the
stack you already have: Vercel + Firebase, no new services, no monthly SaaS fee —
just Claude API tokens (a few cents per article).

## What it does daily
1. Vercel Cron hits `/api/cron/generate-article` once a day (13:00 UTC = 7am CST)
2. Pulls the next pending keyword from Firestore (`seo_keywords` collection)
3. Calls Claude API with an SEO+GEO prompt (direct-answer opening, FAQ block, schema.org markup)
4. Saves the article to Firestore (`blog_posts` collection)
5. `/blog/[slug]` renders it as full server-side HTML (crawlers see real content, not a JS shell)
6. `/sitemap.xml` auto-updates so Google discovers new posts fast

## Setup steps

### 1. Install the one new dependency
```bash
npm install firebase-admin
```

### 2. Get a Firebase service account key
Firebase Console → Project Settings → Service Accounts → Generate new private key.
This gives you `project_id`, `client_email`, `private_key`.

### 3. Set environment variables in Vercel
Project Settings → Environment Variables:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` — paste the whole key including `-----BEGIN PRIVATE KEY-----`
- `ANTHROPIC_API_KEY` — your Claude API key
- `CRON_SECRET` — any long random string you make up (protects the cron endpoint from randoms hitting it)

### 4. Copy these files into your existing Vercel project
Drop the `api/`, `lib/`, and `vercel.json` into your project root. If you already
have a `vercel.json`, merge the `crons` and `rewrites` arrays in rather than
overwriting.

### 5. Seed your keyword list
Open Firebase Console → Firestore → create collection `seo_keywords`, and add
documents matching `seo-keywords-seed.json` (one doc per keyword). You can paste
these in manually the first time — 15 keywords = about 2 weeks of daily posts to start.
Add more anytime; the cron just pulls whichever pending keyword has the highest `priority`.

### 6. Deploy
```bash
vercel --prod
```

### 7. Test it manually before waiting a day
```bash
curl -X POST https://jayisaacai.com/api/cron/generate-article \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Check Firestore for a new doc in `blog_posts`, then visit
`https://jayisaacai.com/blog/the-slug-it-generated` to see the rendered page.

### 8. Submit to Google
Google Search Console → Sitemaps → add `https://jayisaacai.com/sitemap.xml`.
That's it — Google will start crawling new posts within a day or two of each publish.

## Why this gets picked up by ChatGPT/AI answers, not just Google
The article prompt forces every piece to open with a direct 2-3 sentence answer
before any fluff, and closes with a dedicated FAQ section written as self-contained
Q&A pairs. That structure is what AI answer engines pull from — they favor content
that answers a specific question cleanly over long narrative blog posts. The
FAQPage schema.org markup on each post also makes it eligible for Google's FAQ
rich results.

## Cost
Each article run is one Claude API call (~2-3k output tokens). At current Sonnet
pricing that's a few cents per article, once a day. Basically free compared to
what tools like Soro charge monthly for the same output.

## Scaling it up later
- Add more keywords to `seo_keywords` as you find them (Google Search Console,
  once you have traffic, will show you exactly what people are searching to find you)
- Bump the cron to run twice a day if one article/day isn't enough volume
- Reuse this exact pipeline for Omacree — just point it at a different Firestore
  project/collection and swap the business context in the prompt
