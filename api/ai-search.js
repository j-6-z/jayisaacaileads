/* ============================================================
   JAYISAAC AI — AI Search Serverless Function
   ============================================================
   POST /api/ai-search
   Body: { query: "HVAC owners in Calgary under 20 employees" }

   Returns:
   {
     ok: true,
     filters: {
       industry, role, location, city,
       maxEmployees, minEmployees, summary
     }
   }

   ENV VARS REQUIRED (set in Vercel dashboard):
   - ANTHROPIC_API_KEY

   MODEL: claude-haiku-4-5-20251001 (~$0.001/query)
   ============================================================ */

export default async function handler(req, res) {
  /* CORS — allow your own domain to call this */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const { query } = req.body || {};
  if (!query || typeof query !== "string" || query.length > 500) {
    res.status(400).json({ ok: false, error: "Invalid query" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY missing in env");
    res.status(500).json({ ok: false, error: "Server not configured" });
    return;
  }

  const systemPrompt = `You are a B2B lead-search query parser for JAYISAAC AI, a Canadian-first B2B contact intelligence platform.

Parse the user's natural-language search query into structured filters. Return ONLY a JSON object with NO markdown, NO code fences, NO explanation — just the raw JSON.

Schema:
{
  "industry":     string | null,
  "role":         string | null,
  "location":     string | null,
  "city":         string | null,
  "maxEmployees": number | null,
  "minEmployees": number | null,
  "summary":      string
}

INDUSTRY (normalize to one of these): "HVAC", "Plumbing", "Roofing", "Electrical", "Construction", "Landscaping", "Cleaning", "Moving", "Pest Control", "Painting", "Property Maintenance", "Dental", "Insurance", "Financial Services", "Marketing", "Real Estate", "Legal", "IT Services", "Healthcare", "Veterinary", "Chiropractic", "Other"

ROLE: "Owner", "CEO", "President", "Founder", "Manager", "General Manager", "Office Manager", "Director", "VP", "Operations"

LOCATION (2-letter state/province): "AB", "BC", "SK", "MB", "ON", "QC", "NS", "TX", "AZ", "CO", "MN", "CA", "NY", "WA", "IL", "FL", "OH", "GA", "NC", "PA", "MI", "NV", "UT", "NM", "OK", "LA", "TN", "MA", "CT", "NJ", "OR", "MO"

CITY: any Canadian or US city name in title case (e.g. "Calgary", "Saskatoon", "Dallas")

SUMMARY: a one-sentence rephrasing of the search intent.

Examples:

Query: "HVAC owners in Calgary"
{ "industry": "HVAC", "role": "Owner", "location": "AB", "city": "Calgary", "maxEmployees": null, "minEmployees": null, "summary": "HVAC business owners in Calgary, Alberta" }

Query: "plumbing companies under 20 employees in Texas"
{ "industry": "Plumbing", "role": null, "location": "TX", "city": null, "maxEmployees": 20, "minEmployees": null, "summary": "Small plumbing companies in Texas with under 20 employees" }

Query: "marketing agency CEOs in Vancouver"
{ "industry": "Marketing", "role": "CEO", "location": "BC", "city": "Vancouver", "maxEmployees": null, "minEmployees": null, "summary": "Marketing agency CEOs in Vancouver, BC" }

Query: "law firms"
{ "industry": "Legal", "role": null, "location": null, "city": null, "maxEmployees": null, "minEmployees": null, "summary": "Law firms across the database" }

Query: "large dental practices in Toronto"
{ "industry": "Dental", "role": null, "location": "ON", "city": "Toronto", "maxEmployees": null, "minEmployees": 50, "summary": "Larger dental practices in Toronto, Ontario" }

If a field can't be determined from the query, set it to null. Always include all fields in the response.`;

  try {
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: query }],
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("Anthropic API error:", apiResponse.status, errText);
      res.status(502).json({ ok: false, error: "AI service error", status: apiResponse.status });
      return;
    }

    const data = await apiResponse.json();
    const text = data?.content?.[0]?.text || "";

    /* Strip markdown code fences if Claude wraps them anyway */
    const cleanText = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    let filters;
    try {
      filters = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error("Failed to parse Claude response:", text);
      res.status(502).json({ ok: false, error: "AI returned invalid format" });
      return;
    }

    /* Sanity defaults — make sure all fields exist with correct types */
    const safeFilters = {
      industry:     typeof filters.industry === "string" ? filters.industry : null,
      role:         typeof filters.role === "string" ? filters.role : null,
      location:     typeof filters.location === "string" ? filters.location : null,
      city:         typeof filters.city === "string" ? filters.city : null,
      maxEmployees: typeof filters.maxEmployees === "number" ? filters.maxEmployees : null,
      minEmployees: typeof filters.minEmployees === "number" ? filters.minEmployees : null,
      summary:      typeof filters.summary === "string" ? filters.summary : null,
    };

    res.status(200).json({ ok: true, filters: safeFilters });
  } catch (err) {
    console.error("ai-search handler crashed:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
}