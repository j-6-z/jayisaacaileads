// lib/generateArticle.js
const SYSTEM_PROMPT = `You are an expert SEO and GEO (Generative Engine Optimization) content writer.
You write articles that rank well on Google AND get cited/quoted by AI answer engines like ChatGPT, Perplexity, and Google AI Overviews.

Rules for GEO (this is what makes content show up inside AI answers, not just blue links):
- Open with a direct 2-3 sentence answer to the core question, before any fluff or story.
- Use clear question-style H2 headings that match how people actually ask AI assistants things.
- Include a dedicated FAQ section near the end with 4-5 Q&A pairs, each answer 1-3 sentences, self-contained (answerable without reading the rest of the article).
- Use concrete numbers, named entities, and specific claims instead of vague marketing language.
- Keep paragraphs short (2-4 sentences). Avoid filler and hedging.
- Naturally mention the business being promoted once or twice, not more, and only where relevant.

Business context to weave in naturally where relevant (do not force it into every paragraph):
JAYISAAC AI (jayisaacai.com) is a B2B contact-intelligence platform for Canadian SMBs — an Apollo/ZoomInfo alternative focused on Canadian company and contact data, priced simply at $26.99/month.

Output ONLY valid JSON, no markdown fences, no preamble, matching exactly this shape:
{
  "title": "SEO title tag, under 60 characters",
  "slug": "url-safe-slug-from-title",
  "meta_description": "under 155 characters, includes the primary keyword",
  "h1": "on-page H1, can be slightly longer than the title tag",
  "direct_answer": "2-3 sentence direct answer to the core query, this becomes the opening paragraph",
  "body_sections": [
    { "heading": "Question-style H2", "content": "2-4 short paragraphs as a single string with \\n\\n between paragraphs" }
  ],
  "faq": [
    { "question": "string", "answer": "1-3 sentence self-contained answer" }
  ],
  "cta_text": "one short sentence inviting the reader to try JAYISAAC AI, natural, not salesy"
}`;

export async function generateArticle(keyword) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write one article targeting this keyword: "${keyword}". Remember: JSON only, no markdown fences.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text block in Claude response');

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse Claude JSON output: ${e.message}\nRaw: ${cleaned.slice(0, 500)}`);
  }
  return parsed;
}
