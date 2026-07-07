// api/blog/index.js
import { getFirebaseAdmin } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const snap = await db
      .collection('blog_posts')
      .where('status', '==', 'published')
      .orderBy('published_at', 'desc')
      .limit(100)
      .get();

    const items = snap.docs
      .map((d) => {
        const p = d.data();
        return `<li><a href="/blog/${p.slug}">${p.title}</a><p>${p.meta_description}</p></li>`;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Blog | JAYISAAC AI</title>
  <meta name="description" content="Guides on B2B lead generation, contact intelligence, and finding customers in Canada.">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
    li { margin-bottom: 1.5rem; list-style: none; }
    a { color: #6a3aff; text-decoration: none; font-size: 1.1rem; font-weight: 600; }
    p { color: #555; margin: 0.25rem 0 0; }
  </style>
</head>
<body>
  <h1>Blog</h1>
  <ul>${items || '<p>No posts yet.</p>'}</ul>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('<h1>Something went wrong</h1>');
  }
}
