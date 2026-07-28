// api/cron/generate-article.js
/* ============================================================
   JAYISAAC AI — Daily SEO article cron
   ============================================================
   Runs once a day via vercel.json:
     { "path": "/api/cron/generate-article", "schedule": "0 13 * * *" }

   WHAT CHANGED vs the original:
   1. Passes the FULL keyword document (type, city, province, industry,
      angle, competitor, data_required) into generateArticle, so the
      generator can write a page that is specific instead of generic.
   2. Randomizes among equal-priority keywords, so the queue does not
      publish sixteen Saskatoon posts in a row before touching Regina.
   3. Slug collision check. Never silently overwrites a live post.
   4. Thin-content guard. A post under MIN_WORDS is rejected, the keyword
      is requeued, and nothing gets published. Thin AI pages are the
      single fastest way to get a domain demoted.
   5. Failure handling. A keyword that throws is marked 'failed' with the
      error instead of sitting 'pending' forever and blocking the queue.
   6. Optional IndexNow ping so Bing indexes the post within hours.
      (Google retired its sitemap ping endpoint in 2023 and only reads
      the sitemap on its own schedule, so there is nothing to ping there.
      Keep the sitemap submitted in Search Console.)
   7. ?dry=1 support for testing without publishing.

   ENV:
   - CRON_SECRET            (Vercel sends this automatically as a Bearer)
   - INDEXNOW_KEY           (optional; see note at the bottom)
   - SITE_URL               (optional; defaults to https://www.jayisaac.io)
   ============================================================ */

import { getFirebaseAdmin } from '../../lib/firebaseAdmin.js';
import { generateArticle } from '../../lib/generateArticle.js';

const SITE_URL   = process.env.SITE_URL || 'https://www.jayisaac.io';
const MIN_WORDS  = 700;   // below this we do not publish
const MAX_TRIES  = 3;     // try up to 3 keywords before giving up for the day

/* Pull a batch at the top priority tier, then pick randomly within it.
   Without this the cron marches alphabetically through one city at a time. */
async function pickKeyword(db, skipIds = []) {
  const snap = await db
    .collection('seo_keywords')
    .where('status', '==', 'pending')
    .orderBy('priority', 'desc')
    .limit(40)
    .get();

  if (snap.empty) return null;

  const docs = snap.docs.filter(d => !skipIds.includes(d.id));
  if (!docs.length) return null;

  const topPriority = docs[0].data().priority;
  const tier = docs.filter(d => d.data().priority === topPriority);
  return tier[Math.floor(Math.random() * tier.length)];
}

function countWords(article) {
  const text = [article.html, article.body, article.content, article.markdown]
    .filter(v => typeof v === 'string')
    .join(' ')
    .replace(/<[^>]*>/g, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/* IndexNow: free, no signup. Bing, Yandex, Seznam and Naver consume it.
   Requires a key file hosted at https://yourdomain/<key>.txt containing
   the key. Skipped silently if INDEXNOW_KEY is not set. */
async function pingIndexNow(url) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return { skipped: true };
  try {
    const host = new URL(SITE_URL).host;
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${SITE_URL}/${key}.txt`,
        urlList: [url],
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err.message) };
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dryRun = req.query?.dry === '1';
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const attempted = [];

  try {
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const keywordDoc = await pickKeyword(db, attempted);

      if (!keywordDoc) {
        return res.status(200).json({
          message: attempted.length
            ? 'No usable keywords left after retries'
            : 'No pending keywords. Reseed seo_keywords.',
          attempted,
        });
      }

      attempted.push(keywordDoc.id);
      const kw = keywordDoc.data();
      const keyword = kw.keyword;

      /* Everything the generator needs to make this page specific. */
      const brief = {
        keyword,
        type:          kw.type          || 'howto',
        city:          kw.city          || null,
        province:      kw.province      || null,
        industry:      kw.industry      || null,
        competitor:    kw.competitor    || null,
        angle:         kw.angle         || null,
        dataRequired:  kw.data_required === true,
      };

      let article;
      try {
        /* Pass the brief as a second arg. Older generators that only accept
           a string still work; new ones can use the metadata. */
        article = await generateArticle(keyword, brief);
      } catch (genErr) {
        console.error(`[seo] generation failed for "${keyword}":`, genErr);
        await keywordDoc.ref.update({
          status: 'failed',
          error: String(genErr.message).slice(0, 500),
          failed_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        continue; /* try the next keyword rather than losing the day */
      }

      if (!article || !article.slug) {
        console.error(`[seo] generator returned no slug for "${keyword}"`);
        await keywordDoc.ref.update({
          status: 'failed',
          error: 'generator returned no slug',
          failed_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        continue;
      }

      /* Thin content guard. Publishing 400-word AI filler daily is how a
         domain gets demoted, so we requeue instead of shipping it. */
      const words = countWords(article);
      if (words < MIN_WORDS) {
        console.warn(`[seo] "${keyword}" produced only ${words} words, requeueing`);
        await keywordDoc.ref.update({
          status: 'pending',
          last_attempt_words: words,
          last_attempt_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        continue;
      }

      /* Never overwrite a published post. */
      const existing = await db.collection('blog_posts').doc(article.slug).get();
      if (existing.exists) {
        console.warn(`[seo] slug collision on "${article.slug}"`);
        await keywordDoc.ref.update({
          status: 'skipped_duplicate',
          duplicate_of: article.slug,
          used_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        continue;
      }

      if (dryRun) {
        return res.status(200).json({
          dryRun: true, keyword, slug: article.slug, words,
          title: article.title || null, brief,
        });
      }

      await db.collection('blog_posts').doc(article.slug).set({
        ...article,
        keyword,
        seo_type:   brief.type,
        seo_city:   brief.city,
        seo_industry: brief.industry,
        word_count: words,
        status: 'published',
        published_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      await keywordDoc.ref.update({
        status: 'used',
        slug: article.slug,
        word_count: words,
        used_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const url = `${SITE_URL}/blog/${article.slug}`;
      const indexNow = await pingIndexNow(url);

      /* How much runway is left in the queue. */
      const remaining = await db.collection('seo_keywords')
        .where('status', '==', 'pending').count().get()
        .then(s => s.data().count).catch(() => null);

      console.log(`[seo] published "${article.slug}" (${words} words) for "${keyword}"`);

      return res.status(200).json({
        message: 'Article published',
        slug: article.slug,
        url,
        keyword,
        type: brief.type,
        words,
        indexNow,
        keywords_remaining: remaining,
        attempts: attempted.length,
      });
    }

    return res.status(200).json({
      message: `Gave up after ${MAX_TRIES} attempts`,
      attempted,
    });
  } catch (err) {
    console.error('[seo] cron crashed:', err);
    return res.status(500).json({ error: err.message });
  }
}