// lib/generateArticle.js
/* ============================================================
   JAYISAAC AI — SEO/GEO article generator
   ============================================================
   generateArticle(keyword, brief)

   brief (from api/cron/generate-article.js):
   {
     keyword, type: 'local'|'comparison'|'howto',
     city, province, industry, competitor, angle, dataRequired
   }

   WHAT CHANGED vs the previous version:
   - Domain fixed to jayisaac.io (the old prompt still said jayisaacai.com,
     so every article published since the migration cited a dead domain).
   - Accepts the brief. A "local" page now gets written as a page about
     that city and that trade, not a template with a name swapped in.
   - Pulls REAL contact counts from Firestore for local pages. If the
     lookup fails it returns null and the prompt adapts. It never guesses.
   - Hard anti-fabrication rule. The model may only cite numbers that
     appear in the VERIFIED FACTS block. Everything else must be written
     qualitatively. This is the difference between a useful page and a
     liability.
   - max_tokens raised 3000 -> 8000. The old ceiling truncated longer
     articles mid-JSON, which is almost certainly the source of parse errors.
   - Emits JSON-LD (Article + FAQPage) and internal links to the matching
     product page.
   - Retries once on a malformed JSON response before giving up.

   ENV:
   - ANTHROPIC_API_KEY
   - CONTACTS_COLLECTION   (optional, defaults to 'contacts')
   ============================================================ */

import { getFirebaseAdmin } from './firebaseAdmin.js';

const SITE = 'https://www.jayisaac.io';

const PRODUCT_LINKS = {
  leadgen:  `${SITE}/lead-generation/`,
  people:   `${SITE}/lead-generation/people-search.html`,
  company:  `${SITE}/lead-generation/company-search.html`,
  calling:  `${SITE}/lead-generation/cold-calling-lists.html`,
  pricing:  `${SITE}/pricing.html`,
  staff:    `${SITE}/chief-of-staff/`,
  cyber:    `${SITE}/cybersecurity/`,
};

/* Numbers the model is allowed to state. Everything here is from our own
   pricing page or a competitor's published pricing. Nothing else gets cited. */
const VERIFIED_FACTS = `
JAYISAAC AI pricing (from our own public pricing page):
- Starter: $26.99/month, or $263.88/year. 250 credits per month.
- Pro: $74.99/month, or $719.88/year. 1,000 credits per month.
- Agency: $199/month, or $1,908/year. 3,500 credits per month.
- One-time credit packs: 250 for $14.99, 1,000 for $49, 3,500 for $149. Pack credits do not expire.
- No per-seat fees on any plan. No annual lock-in. Cancel anytime.
- Platform: three products on one account (AI Lead Generation, AI Chief of Staff, AI Cybersecurity), one shared credit balance, one bill.
- Built in Canada. Powered by Claude. Aligned to PIPEDA, GDPR and CCPA.

Apollo.io comparison (from Apollo's published pricing page):
- Apollo Basic is $59 per user per month, or $49 per user per month billed annually.
- Apollo charges 8 mobile credits per phone number reveal.
- Apollo Basic includes 75 mobile credits per month, which works out to roughly 9 phone numbers per month.
- That is about $6.56 per phone number on Apollo Basic.
- Apollo export credits reset monthly and do not roll over.
- Apollo's AI email writing sits on their $99/month tier.
`.trim();

const ANTI_FABRICATION = `
CRITICAL ACCURACY RULES. Breaking these makes the article a liability:
1. You may ONLY state specific numbers, prices, percentages, counts or statistics that appear in the VERIFIED FACTS or LOCAL DATA blocks below. 
2. If you do not have a number for something, write about it qualitatively. Never estimate, never approximate, never invent a plausible-sounding figure.
3. Do NOT invent statistics about industries, cities, market sizes, response rates, or "studies show" claims. No fake citations.
4. Do NOT state pricing for any competitor unless that competitor's pricing appears in VERIFIED FACTS.
5. Do NOT claim JAYISAAC AI has features, integrations, certifications or coverage that are not listed in VERIFIED FACTS.
6. Write from operator experience and reasoning rather than fabricated data. Specific and honest beats specific and invented.
`.trim();

const BASE_RULES = `
You write for small business owners and small sales teams. Direct, concrete, no filler, no hype, no "in today's fast-paced world" openers.

GEO rules (this is what gets content cited inside AI answers, not just ranked):
- Open with a direct 2-3 sentence answer to the core question. No throat-clearing.
- H2 headings phrased the way people actually ask the question.
- A dedicated FAQ near the end, 4-6 pairs, each answer self-contained and 1-3 sentences.
- Short paragraphs, 2-4 sentences. Concrete nouns. Named entities.
- Mention JAYISAAC AI once or twice where it genuinely fits, never more.

LENGTH: 1,000 to 1,500 words across all body sections combined. Substantial enough to be useful, short enough to stay dense.
`.trim();

function typeGuidance(brief) {
  if (brief.type === 'local' && brief.city && brief.industry) {
    return `
THIS IS A LOCAL PAGE: "${brief.industry}" businesses in ${brief.city}${brief.province ? ', ' + brief.province : ''}.

This page competes against dozens of near-identical pages. It only wins if it is genuinely specific. Required:
- Name the actual job title that owns the buying decision at a ${brief.industry} business (owner, operations manager, service manager) and explain why that role and not another.
- Explain what is DIFFERENT about reaching ${brief.industry} businesses specifically: when they are reachable, what their busy season does to response rates, whether they answer phones or email, who screens their calls.
- Be regionally real about ${brief.city}. Reference actual regional context you are confident about (climate driving seasonal demand, whether the market is dominated by small independents or franchises, proximity to larger metros). If you are not confident about a specific fact regarding ${brief.city}, write around it rather than inventing it.
- Give a concrete outreach approach: what to say in the first sentence of a call or email to this specific trade.
${brief.angle ? `- Angle to lead with: ${brief.angle}` : ''}

Do NOT write a generic "here are 5 ways to find leads" article with the city name inserted. That page already exists a hundred times and will not rank.`.trim();
  }

  if (brief.type === 'comparison' && brief.competitor) {
    return `
THIS IS A COMPARISON PAGE: ${brief.competitor} vs JAYISAAC AI.

- Be fair. Name what ${brief.competitor} is genuinely good at. A hit piece reads as untrustworthy and converts worse than an honest comparison.
- Use ONLY pricing that appears in VERIFIED FACTS. If ${brief.competitor} is not Apollo.io, you do not have their pricing, so compare on approach, positioning and structure instead of inventing numbers.
- Be explicit about who should pick the competitor instead. That honesty is the reason this page gets trusted and cited.
- Close on the specific buyer JAYISAAC AI fits: small North American teams who want flat pricing without per-seat fees.
${brief.angle ? `- Angle: ${brief.angle}` : ''}`.trim();
  }

  return `
THIS IS A HOW-TO / EXPERTISE PAGE.

- Answer the actual question completely in the first section. Do not withhold the answer to drive scroll depth.
- Be opinionated. Take a position and defend it. Generic both-sides content does not get cited.
- Include at least one concrete example, script, checklist or step sequence the reader can act on immediately.
- Write like an operator who has actually done this, not a marketer describing it.
${brief.angle ? `- Angle: ${brief.angle}` : ''}`.trim();
}

/* Real contact counts from Firestore. Returns null on any failure so the
   prompt degrades to qualitative rather than inventing numbers. */
async function getLocalStats(brief) {
  if (brief.type !== 'local' || !brief.city) return null;
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const col = process.env.CONTACTS_COLLECTION || 'contacts';

    const cityCount = await db.collection(col)
      .where('city', '==', brief.city)
      .count().get()
      .then(s => s.data().count)
      .catch(() => null);

    if (cityCount === null) return null;

    const withPhone = await db.collection(col)
      .where('city', '==', brief.city)
      .where('has_phone', '==', true)
      .count().get()
      .then(s => s.data().count)
      .catch(() => null);

    if (!cityCount) return null;
    return { city: brief.city, total: cityCount, withPhone };
  } catch (err) {
    console.warn('[seo] local stats lookup failed:', err.message);
    return null;
  }
}

function buildSystem(brief, stats) {
  const localData = stats
    ? `\nLOCAL DATA (real counts from our own database, safe to cite):\n- ${stats.total.toLocaleString()} verified business contacts in ${stats.city}${stats.withPhone ? `\n- ${stats.withPhone.toLocaleString()} of them include a direct phone number` : ''}`
    : `\nLOCAL DATA: none available. Do NOT state any contact counts, database sizes or coverage numbers for this city.`;

  return `You are an expert SEO and GEO content writer for JAYISAAC AI (${SITE}), a B2B contact intelligence platform for small North American businesses.

${BASE_RULES}

${typeGuidance(brief)}

VERIFIED FACTS:
${VERIFIED_FACTS}
${localData}

${ANTI_FABRICATION}

Output ONLY valid JSON, no markdown fences, no preamble, exactly this shape:
{
  "title": "SEO title tag, under 60 characters",
  "slug": "url-safe-slug-from-title",
  "meta_description": "under 155 characters, includes the primary keyword",
  "h1": "on-page H1",
  "direct_answer": "2-3 sentence direct answer, becomes the opening paragraph",
  "body_sections": [
    { "heading": "Question-style H2", "content": "2-4 short paragraphs, \\n\\n between them" }
  ],
  "faq": [ { "question": "string", "answer": "1-3 sentence self-contained answer" } ],
  "key_takeaways": ["3-5 single-sentence takeaways, each one useful on its own"],
  "cta_text": "one short natural sentence inviting the reader to try JAYISAAC AI"
}`;
}

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/^-|-$/g, '');
}

function internalLinksFor(brief) {
  const links = [{ label: 'AI Lead Generation', url: PRODUCT_LINKS.leadgen }];
  if (brief.type === 'local') {
    links.push({ label: 'People Search', url: PRODUCT_LINKS.people });
    links.push({ label: 'Cold Calling Lists', url: PRODUCT_LINKS.calling });
  } else if (brief.type === 'comparison') {
    links.push({ label: 'Pricing', url: PRODUCT_LINKS.pricing });
    links.push({ label: 'Company Search', url: PRODUCT_LINKS.company });
  } else {
    links.push({ label: 'People Search', url: PRODUCT_LINKS.people });
    links.push({ label: 'Pricing', url: PRODUCT_LINKS.pricing });
  }
  return links;
}

function buildSchema(article, brief) {
  const url = `${SITE}/blog/${article.slug}`;
  const now = new Date().toISOString();
  const graph = [{
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: String(article.h1 || article.title).slice(0, 110),
    description: article.meta_description,
    datePublished: now,
    dateModified: now,
    inLanguage: 'en-CA',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author:    { '@type': 'Organization', name: 'JAYISAAC AI', url: SITE },
    publisher: { '@type': 'Organization', name: 'JAYISAAC AI', url: SITE },
  }];

  if (Array.isArray(article.faq) && article.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: article.faq.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function wordCount(article) {
  const parts = [article.direct_answer || ''];
  (article.body_sections || []).forEach(s => parts.push(s.heading || '', s.content || ''));
  (article.faq || []).forEach(f => parts.push(f.question || '', f.answer || ''));
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}

async function callClaude(system, user) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,          /* was 3000 — too low, truncated longer articles mid-JSON */
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  if (data.stop_reason === 'max_tokens') {
    throw new Error('Response hit max_tokens and was truncated');
  }
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text block in Claude response');

  let cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  const first = cleaned.indexOf('{');
  const last  = cleaned.lastIndexOf('}');
  if (first > 0 || last < cleaned.length - 1) cleaned = cleaned.slice(first, last + 1);
  return JSON.parse(cleaned);
}

export async function generateArticle(keyword, brief = {}) {
  const b = {
    keyword,
    type:       brief.type       || 'howto',
    city:       brief.city       || null,
    province:   brief.province   || null,
    industry:   brief.industry   || null,
    competitor: brief.competitor || null,
    angle:      brief.angle      || null,
  };

  const stats  = await getLocalStats(b);
  const system = buildSystem(b, stats);
  const user   = `Write one article targeting this exact search query: "${keyword}".

${b.city ? `City: ${b.city}${b.province ? ', ' + b.province : ''}\n` : ''}${b.industry ? `Industry: ${b.industry}\n` : ''}${b.competitor ? `Competitor: ${b.competitor}\n` : ''}
Return JSON only. No markdown fences, no preamble.`;

  let parsed;
  try {
    parsed = await callClaude(system, user);
  } catch (err) {
    /* One retry with an explicit correction before giving up on the keyword */
    console.warn('[seo] first attempt failed, retrying:', err.message);
    parsed = await callClaude(
      system,
      user + '\n\nIMPORTANT: your previous response was not valid JSON or was cut off. Return ONLY the JSON object, complete and parseable, and keep it within the length limit.'
    );
  }

  if (!parsed || !parsed.title) throw new Error('Generated article missing a title');

  parsed.slug = slugify(parsed.slug || parsed.title);
  if (!parsed.slug) throw new Error('Could not derive a slug');

  parsed.faq           = Array.isArray(parsed.faq) ? parsed.faq.slice(0, 6) : [];
  parsed.body_sections = Array.isArray(parsed.body_sections) ? parsed.body_sections : [];
  parsed.key_takeaways = Array.isArray(parsed.key_takeaways) ? parsed.key_takeaways.slice(0, 5) : [];

  parsed.internal_links = internalLinksFor(b);
  parsed.schema         = buildSchema(parsed, b);
  parsed.word_count     = wordCount(parsed);
  parsed.used_real_data = !!stats;
  parsed.canonical      = `${SITE}/blog/${parsed.slug}`;

  return parsed;
}