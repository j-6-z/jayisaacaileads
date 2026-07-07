// api/cron/generate-article.js
// Triggered daily by Vercel Cron (see vercel.json).
// Pulls the next pending keyword from Firestore, generates an article via
// Claude, saves it as a published blog post, marks the keyword as used.

const { getFirebaseAdmin } = require('../../lib/firebaseAdmin');
const { generateArticle } = require('../../lib/generateArticle');

module.exports = async (req, res) => {
  // Protect the endpoint so randoms on the internet can't trigger it
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // 1. Get next pending keyword
    const keywordSnap = await db
      .collection('seo_keywords')
      .where('status', '==', 'pending')
      .orderBy('priority', 'desc')
      .limit(1)
      .get();

    if (keywordSnap.empty) {
      return res.status(200).json({ message: 'No pending keywords. Add more to seo_keywords collection.' });
    }

    const keywordDoc = keywordSnap.docs[0];
    const keyword = keywordDoc.data().keyword;

    // 2. Generate the article
    const article = await generateArticle(keyword);

    // 3. Save as a published blog post
    await db.collection('blog_posts').doc(article.slug).set({
      ...article,
      keyword,
      status: 'published',
      published_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Mark keyword as used
    await keywordDoc.ref.update({
      status: 'used',
      used_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: 'Article published', slug: article.slug, keyword });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
