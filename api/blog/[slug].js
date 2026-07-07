// api/blog/[slug].js
import { getFirebaseAdmin } from '../../lib/firebaseAdmin.js';

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPage(post) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  const sectionsHtml = post.body_sections
    .map(
      (s) => `
    <h2>${escapeHtml(s.heading)}</h2>
    ${s.content
      .split('\n\n')
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join('\n')}`
    )
    .join('\n');

  const faqHtml = post.faq
    .map(
      (f) => `
    <div class="faq-item">
      <h3>${escapeHtml(f.question)}</h3>
      <p>${escapeHtml(f.answer)}</p>
    </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(post.title)}</title>
  <meta name="description" content="${escapeHtml(post.meta_description)}">
  <link rel="canonical" href="https://jayisaacai.com/blog/${escapeHtml(post.slug)}">
  <meta property="og:title" content="${escapeHtml(post.title)}">
  <meta property="og:description" content="${escapeHtml(post.meta_description)}">
  <meta property="og:type" content="article">
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.4rem; margin-top: 2rem; }
    .direct-answer { font-size: 1.1rem; padding: 1rem; background: #f5f5f7; border-left: 4px solid #6a3aff; border-radius: 4px; }
    .faq-item { margin-bottom: 1.25rem; }
    .cta { margin-top: 2.5rem; padding: 1.5rem; background: #f0edff; border-radius: 8px; text-align: center; }
    .cta a { display: inline-block; margin-top: 0.75rem; padding: 0.6rem 1.4rem; background: #6a3aff; color: white; text-decoration: none; border-radius: 6px; }
    a.back { display: inline-block; margin-bottom: 1.5rem; color: #6a3aff; text-decoration: none; }
  </style>
</head>
<body>
  <a class="back" href="/blog">&larr; Back to all articles</a>
  <h1>${escapeHtml(post.h1)}</h1>
  <p class="direct-answer">${escapeHtml(post.direct_answer)}</p>
  ${sectionsHtml}
  <h2>Frequently asked questions</h2>
  ${faqHtml}
  <div class="cta">
    <p>${escapeHtml(post.cta_text)}</p>
    <a href="https://jayisaacai.com">Try JAYISAAC AI</a>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  const { slug } = req.query;

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const doc = await db.collection('blog_posts').doc(slug).get();

    if (!doc.exists) {
      res.status(404).send('<h1>Post not found</h1>');
      return;
    }

    const post = doc.data();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(renderPage(post));
  } catch (err) {
    console.error(err);
    res.status(500).send('<h1>Something went wrong</h1>');
  }
}
