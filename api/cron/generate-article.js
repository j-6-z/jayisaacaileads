// api/cron/generate-article.js
import { getFirebaseAdmin } from '../../lib/firebaseAdmin.js';
import { generateArticle } from '../../lib/generateArticle.js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

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

    const article = await generateArticle(keyword);

    await db.collection('blog_posts').doc(article.slug).set({
      ...article,
      keyword,
      status: 'published',
      published_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    await keywordDoc.ref.update({
      status: 'used',
      used_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: 'Article published', slug: article.slug, keyword });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
