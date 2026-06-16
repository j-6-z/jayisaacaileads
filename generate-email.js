/* ============================================================
   JAYISAAC AI — Cold Email Writer
   ============================================================
   POST /api/generate-email
   Body: {
     idToken: "<Firebase ID token>",
     contactId: "abc123",                  // optional — for unlocked records
     contact: {                            // contact info to personalize for
       name:     "Sarah Mitchell",
       title:    "Owner",
       company:  "Acme HVAC",
       industry: "HVAC",
       location: "Calgary, AB"
     },
     sender: {                             // who's sending the email
       name:        "Jay Turner",
       company:     "JAYISAAC AI",
       productPitch: "B2B contact intelligence for sales teams",
       tone:        "direct" | "friendly" | "casual" | "formal",
       length:      "short" | "medium" | "long",
       cta:         "book a 15-min call"   // optional
     }
   }

   Returns:
   {
     ok: true,
     subject: "Quick question about Acme HVAC's lead pipeline",
     body:    "Hi Sarah,\n\n...",
     credits_remaining: 245
   }

   Pricing: 5 credits per email (configurable below)
   Cost:    ~$0.001 per email (Claude Haiku)
   Margin:  ~99% at typical credit pricing

   ENV VARS REQUIRED:
   - ANTHROPIC_API_KEY
   - FIREBASE_PRIVATE_KEY_B64        (base64-encoded service account private key)
   - FIREBASE_PROJECT_ID             (jayisaac-ai)
   - FIREBASE_CLIENT_EMAIL           (firebase-adminsdk@...iam.gserviceaccount.com)
   ============================================================ */

import admin from "firebase-admin";

/* ── Init Firebase Admin (once per cold start) ── */
if (!admin.apps.length) {
  const privateKey = Buffer.from(
    process.env.FIREBASE_PRIVATE_KEY_B64 || "",
    "base64"
  ).toString("utf8");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  privateKey,
    }),
  });
}

const db = admin.firestore();

/* ── Constants ── */
const CREDIT_COST = 5;
const MAX_BODY_LEN = 800; // sanity caps
const MAX_CONTACT_FIELD_LEN = 120;

/* ── Length presets ── */
const LENGTH_PRESETS = {
  short:  { tokens: 200, target: "60-80 words, 3-4 sentences max" },
  medium: { tokens: 400, target: "100-130 words, 5-6 sentences" },
  long:   { tokens: 600, target: "150-180 words, full pitch" },
};

/* ── Tone presets ── */
const TONE_PRESETS = {
  direct: {
    voice: "Direct, no-nonsense. Get to the point in sentence one. No flowery openers. Treat the reader like an adult.",
    no:    "No 'I hope this finds you well.' No 'I came across your company.' No corporate jargon."
  },
  friendly: {
    voice: "Warm but professional. Reads like a peer reaching out, not a salesperson pitching.",
    no:    "No fake personalization. No exclamation points. No 'Hope you're crushing it!' energy."
  },
  casual: {
    voice: "Conversational, slightly informal. The kind of message that gets a reply because it feels human.",
    no:    "Still keep it grammatical. No emojis. No slang that could miss."
  },
  formal: {
    voice: "Polished and professional. Appropriate for enterprise, finance, legal, or executive contacts.",
    no:    "Avoid stuffy Victorian English. Modern formal — clear, respectful, concise."
  },
};

export default async function handler(req, res) {
  /* CORS */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { idToken, contact, sender } = req.body || {};

    /* ── Validate inputs ── */
    if (!idToken) return res.status(401).json({ ok: false, error: "Missing auth token" });
    if (!contact || !contact.name || !contact.company) {
      return res.status(400).json({ ok: false, error: "Missing contact info" });
    }
    if (!sender || !sender.productPitch) {
      return res.status(400).json({ ok: false, error: "Missing sender info" });
    }

    /* Length cap on free-text fields (defense against prompt injection size) */
    const cap = (s) => (typeof s === "string" ? s.slice(0, MAX_CONTACT_FIELD_LEN) : "");
    const c = {
      name:     cap(contact.name),
      title:    cap(contact.title),
      company:  cap(contact.company),
      industry: cap(contact.industry),
      location: cap(contact.location),
    };
    const s = {
      name:         cap(sender.name) || "the sender",
      company:      cap(sender.company) || "our company",
      productPitch: cap(sender.productPitch),
      tone:         (sender.tone || "direct").toLowerCase(),
      length:       (sender.length || "medium").toLowerCase(),
      cta:          cap(sender.cta) || "a quick 15-minute call to see if it makes sense to keep talking",
    };
    if (!TONE_PRESETS[s.tone])     s.tone   = "direct";
    if (!LENGTH_PRESETS[s.length]) s.length = "medium";

    /* ── Verify Firebase ID token ── */
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ ok: false, error: "Invalid auth token" });
    }
    const uid = decoded.uid;

    /* ── Check credits via Firestore transaction (atomic decrement on success) ── */
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(403).json({ ok: false, error: "User profile not found" });
    }
    const userData = userSnap.data() || {};
    const credits = typeof userData.credits === "number" ? userData.credits : 0;
    if (credits < CREDIT_COST) {
      return res.status(402).json({
        ok: false,
        error: "insufficient_credits",
        message: `You need ${CREDIT_COST} credits to generate an email. You have ${credits}.`,
        credits,
      });
    }

    /* ── Anthropic API key check ── */
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY missing");
      return res.status(500).json({ ok: false, error: "Server not configured" });
    }

    /* ── Build system prompt ── */
    const tone = TONE_PRESETS[s.tone];
    const length = LENGTH_PRESETS[s.length];

    const systemPrompt = `You are an expert cold email writer who has written thousands of B2B outreach emails that actually get replies. You write for sales reps who want to book meetings without sounding like a robot or a desperate vendor.

Your output is ONLY a JSON object with this exact schema (no markdown, no code fences, no preamble):

{
  "subject": "string — 30-50 chars, lowercase except names, no spam-trigger words",
  "body":    "string — the email body, plain text, line breaks as \\n\\n between paragraphs"
}

THE PROSPECT YOU'RE EMAILING:
- Name: ${c.name}
- Role: ${c.title || "(role unknown)"}
- Company: ${c.company}
- Industry: ${c.industry || "(industry unknown)"}
- Location: ${c.location || "(location unknown)"}

THE SENDER:
- Name: ${s.name}
- Company: ${s.company}
- Value prop: ${s.productPitch}
- Desired CTA: ${s.cta}

TONE: ${s.tone}
${tone.voice}
${tone.no}

LENGTH: ${s.length}
Target ${length.target}.

RULES OF THE CRAFT:
1. Subject lines that get opened look like internal emails — lowercase, casual, specific. Examples: "quick question about [Company]", "[Company] + [SenderCompany]", "saw your [Industry] work in [City]".
2. NEVER use these spam words in the subject: "FREE", "ACT NOW", "GUARANTEED", "URGENT", "OPPORTUNITY", "LIMITED TIME".
3. Open with one specific observation about the prospect's company/industry/role — show you did your homework. Don't fake it; if you don't know specifics, lead with the industry pain.
4. State the value prop in ONE sentence — what problem you solve for someone like them.
5. Soft CTA. Never demand a meeting. Phrase it as a question or low-friction ask.
6. Sign off naturally. Just "${s.name}" or "${s.name}\\n${s.company}".
7. NO P.S. lines. NO calendar links. NO image references.
8. Use \\n\\n between paragraphs. Use plain text only.
9. Use the prospect's first name only (e.g. "Hi ${c.name.split(" ")[0]},").
10. NEVER write: "I hope this finds you well", "I came across your company", "I wanted to reach out", "circle back", "touch base", "synergy".

Return ONLY the JSON object. Nothing else.`;

    /* ── Call Claude Haiku ── */
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: length.tokens,
        system:     systemPrompt,
        messages: [
          { role: "user", content: "Write the cold email now." }
        ],
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("Anthropic API error:", apiResponse.status, errText);
      return res.status(502).json({ ok: false, error: "AI service error", status: apiResponse.status });
    }

    const data = await apiResponse.json();
    const text = data?.content?.[0]?.text || "";
    const cleanText = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    let email;
    try {
      email = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error("Failed to parse Claude response:", text);
      return res.status(502).json({ ok: false, error: "AI returned invalid format" });
    }

    if (!email.subject || !email.body) {
      return res.status(502).json({ ok: false, error: "Email missing subject or body" });
    }

    /* Final sanity caps */
    email.subject = String(email.subject).slice(0, 120);
    email.body    = String(email.body).slice(0, MAX_BODY_LEN);

    /* ── ATOMIC CREDIT DEDUCTION (only on success) ── */
    let creditsRemaining = credits - CREDIT_COST;
    try {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(userRef);
        const freshCredits = (fresh.data() || {}).credits || 0;
        if (freshCredits < CREDIT_COST) {
          throw new Error("RACE_INSUFFICIENT_CREDITS");
        }
        tx.update(userRef, {
          credits: admin.firestore.FieldValue.increment(-CREDIT_COST),
          emailsGenerated: admin.firestore.FieldValue.increment(1),
          lastEmailGenAt:  admin.firestore.FieldValue.serverTimestamp(),
        });
        creditsRemaining = freshCredits - CREDIT_COST;
      });
    } catch (txErr) {
      if (String(txErr.message).includes("RACE_INSUFFICIENT_CREDITS")) {
        return res.status(402).json({ ok: false, error: "insufficient_credits" });
      }
      console.error("Credit deduction transaction failed:", txErr);
      return res.status(500).json({ ok: false, error: "Credit sync failed", email });
    }

    /* ── Return the email ── */
    res.status(200).json({
      ok: true,
      subject: email.subject,
      body:    email.body,
      credits_remaining: creditsRemaining,
    });
  } catch (err) {
    console.error("generate-email handler crashed:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
}