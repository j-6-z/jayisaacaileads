// api/sitemap.xml.js
// Auto-updating sitemap. Submit this URL once in Google Search Console:
// https://jayisaacai.com/sitemap.xml

const { getFirebaseAdmin } = require('../lib/firebaseAdmin');

module.exports = async (req, res) => {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const snap = await db.collection('blog_posts').where('status', '==', 'published').get();

    const urls = snap.docs
      .map((d) => {
        const p = d.data();
        const lastmod = p.published_at?.toDate?.().toISOString?.() || new Date().toISOString();
        return `  <url>\n    <loc>https://jayisaacai.com/blog/${p.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating sitemap');
  }
};
