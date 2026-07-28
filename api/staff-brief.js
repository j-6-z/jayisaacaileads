/* ============================================================
   JAYISAAC AI — Chief of Staff: Daily Brief (REAL DATA)
   ============================================================
   POST /api/staff-brief
   Body: { idToken: "<Firebase ID token>" }

   Returns:
   {
     ok: true,
     brief: {
       greeting: "Good morning. Here's Tuesday.",
       summary:  "3 need a decision · 2 meetings · 6 handled",
       decisions: [ { title, why, source, urgency } ],
       meetings:  [ { time, title, with, prep } ],
       handled:   [ "..." ],
       quiet:     [ { who, subject, daysQuiet } ]
     },
     counts: { emails: 41, events: 4 },
     credits_remaining: 248
   }

   PIPELINE:
   1. Verify Firebase ID token            -> uid
   2. Load stored Google refresh token    -> users/{uid}/integrations/google
   3. Mint a fresh Google access token
   4. Pull last 24h of Gmail (METADATA ONLY: headers + snippet, no bodies)
      and today's Calendar events
   5. Send the digest to Claude -> structured JSON brief
   6. Charge credits atomically (only after success)

   PRIVACY NOTE: we request format=metadata on Gmail, so message BODIES
   are never fetched, never sent to the model, and never stored. Only
   From / Subject / Date headers and Gmail's own snippet.

   COST: 2 credits (matches ACTION_COSTS.staff_brief in app-charge.js)

   ENV VARS REQUIRED:
   - ANTHROPIC_API_KEY
   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
   - FIREBASE_PRIVATE_KEY_B64 / FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL
   ============================================================ */

import admin from "firebase-admin";

function resolvePrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (b64 && b64.trim()) return Buffer.from(b64, "base64").toString("utf8");
  let k = process.env.FIREBASE_PRIVATE_KEY || "";
  return k.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  resolvePrivateKey(),
    }),
  });
}

const db = admin.firestore();

const CREDIT_COST   = 2;
const MAX_EMAILS    = 30;   // cap tokens + latency
const MAX_EVENTS    = 12;
const DEFAULT_TZ    = "America/Regina";  // Saskatchewan: UTC-6 year round, no DST

/* ── Timezone helpers ──────────────────────────────────────────
   Vercel functions run in UTC. Without this, "today" is the SERVER'S
   today: at 6pm Monday in Saskatoon it is already Tuesday 00:10 UTC,
   so the brief says "Tuesday" and the calendar window covers Monday
   6pm -> Tuesday 6pm, missing the actual working day entirely.
   Everything below is computed in the USER'S timezone.            */

function tzOffsetMs(date, tz) {
  /* how far tz is from UTC at this instant, in ms */
  const utc   = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  return utc - local;
}

function localDayBounds(tz) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now).split("-").map(Number);
  const [y, m, d] = parts;
  const off = tzOffsetMs(now, tz);
  return {
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + off),
    end:   new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) + off),
  };
}

function localDayLabel(tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, weekday: "long", month: "long", day: "numeric",
  }).format(new Date());
}

function localHour(tz) {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", hour12: false,
  }).format(new Date()));
}

/* ── Mint a fresh Google access token from the stored refresh token ── */
async function getAccessToken(refreshToken) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    const err = new Error("google_refresh_failed");
    err.detail = `${r.status} ${txt}`;
    throw err;
  }
  const j = await r.json();
  return j.access_token;
}

/* ── Gmail: last 24h, METADATA ONLY (no bodies ever fetched) ── */
async function fetchGmail(accessToken) {
  const listUrl =
    "https://gmail.googleapis.com/gmail/v1/users/me/messages" +
    `?q=${encodeURIComponent("newer_than:1d -in:chats -category:promotions")}` +
    `&maxResults=${MAX_EMAILS}`;

  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!listRes.ok) throw new Error(`gmail_list_failed ${listRes.status}`);
  const list = await listRes.json();
  const ids = (list.messages || []).map((m) => m.id);
  if (!ids.length) return [];

  const msgs = await Promise.all(
    ids.map(async (id) => {
      const u =
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
        "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date";
      const r = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!r.ok) return null;
      const m = await r.json();
      const h = {};
      (m.payload?.headers || []).forEach((x) => { h[x.name.toLowerCase()] = x.value; });
      return {
        from:    (h.from || "").slice(0, 120),
        subject: (h.subject || "(no subject)").slice(0, 160),
        date:    h.date || "",
        snippet: (m.snippet || "").slice(0, 220),
        unread:  (m.labelIds || []).includes("UNREAD"),
      };
    })
  );
  return msgs.filter(Boolean);
}

/* ── Calendar: today's events ── */
async function fetchCalendar(accessToken, tz) {
  const { start, end } = localDayBounds(tz);

  const u =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
    `?timeMin=${encodeURIComponent(start.toISOString())}` +
    `&timeMax=${encodeURIComponent(end.toISOString())}` +
    `&singleEvents=true&orderBy=startTime&maxResults=${MAX_EVENTS}`;

  const r = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`calendar_failed ${r.status}`);
  const j = await r.json();

  return (j.items || []).map((e) => ({
    title:     (e.summary || "(untitled)").slice(0, 140),
    start:     e.start?.dateTime || e.start?.date || "",
    tz,
    end:       e.end?.dateTime || e.end?.date || "",
    attendees: (e.attendees || []).slice(0, 8).map((a) => a.email).join(", ").slice(0, 200),
    location:  (e.location || "").slice(0, 120),
    allDay:    !e.start?.dateTime,
  }));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { idToken, tz: tzRaw } = req.body || {};

    /* user's IANA timezone, e.g. "America/Regina". Validated, safe fallback. */
    let tz = DEFAULT_TZ;
    if (typeof tzRaw === "string" && tzRaw.length < 64) {
      try { new Intl.DateTimeFormat("en-CA", { timeZone: tzRaw }); tz = tzRaw; }
      catch (e) { tz = DEFAULT_TZ; }
    }
    if (!idToken) return res.status(401).json({ ok: false, error: "Missing auth token" });

    /* ── 1. Verify user ── */
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ ok: false, error: "Invalid auth token" });
    }
    const uid = decoded.uid;

    /* ── 2. Credits pre-check ── */
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(403).json({ ok: false, error: "User profile not found" });
    const credits = typeof (userSnap.data() || {}).credits === "number" ? userSnap.data().credits : 0;
    if (credits < CREDIT_COST) {
      return res.status(402).json({
        ok: false, error: "insufficient_credits",
        message: `You need ${CREDIT_COST} credits to build a brief. You have ${credits}.`,
        credits,
      });
    }

    /* ── 3. Google integration ── */
    const intSnap = await userRef.collection("integrations").doc("google").get();
    if (!intSnap.exists || !(intSnap.data() || {}).refreshToken) {
      return res.status(428).json({ ok: false, error: "google_not_connected" });
    }

    let accessToken;
    try {
      accessToken = await getAccessToken(intSnap.data().refreshToken);
    } catch (e) {
      console.error("Google refresh failed:", e.detail || e.message);
      await userRef.collection("integrations").doc("google")
        .set({ status: "reauth_required" }, { merge: true }).catch(() => {});
      return res.status(428).json({ ok: false, error: "google_reauth_required" });
    }

    /* ── 4. Pull real data (parallel) ── */
    let emails = [], events = [];
    try {
      [emails, events] = await Promise.all([
        fetchGmail(accessToken),
        fetchCalendar(accessToken, tz),
      ]);
    } catch (e) {
      console.error("Google data fetch failed:", e.message);
      return res.status(502).json({ ok: false, error: "google_fetch_failed" });
    }

    /* ── 5. Claude builds the brief ── */
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY missing");
      return res.status(500).json({ ok: false, error: "Server not configured" });
    }

    const today     = localDayLabel(tz);
    const hour      = localHour(tz);
    const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

    const systemPrompt = `You are an elite chief of staff writing your executive's morning brief. You are ruthless about what deserves their attention and what does not.

Output ONLY a JSON object with this exact schema. No markdown, no code fences, no preamble:

{
  "greeting": "string - a time-appropriate greeting followed by the ACTUAL weekday from TODAY below. Never copy an example verbatim.",
  "summary": "string - one line, e.g. '3 need a decision · 2 meetings · 6 handled'",
  "decisions": [{ "title": "string", "why": "string - one short sentence on why it needs them", "source": "string - who/where it came from", "urgency": "high" | "medium" }],
  "meetings": [{ "time": "string - e.g. '9:00 AM'", "title": "string", "with": "string", "prep": "string - one line of what to know walking in" }],
  "handled": ["string - things that needed no action, phrased as already dealt with"],
  "quiet": [{ "who": "string", "subject": "string", "daysQuiet": number }]
}

RULES:
1. MAXIMUM 4 items in "decisions". Only things a human must personally decide or approve. If nothing qualifies, return an empty array.
2. "handled" is for routine noise (newsletters, notifications, automated reports, FYI threads). Summarize in groups, e.g. "6 newsletters and automated reports filed".
3. "quiet" = threads where the executive is likely waiting on someone or someone is waiting on them. Estimate daysQuiet from dates. Empty array if none evident.
4. Be specific. Use real names, companies, and subjects from the data. Never invent details that are not present.
5. Tone: direct, calm, competent. No filler, no hype, no "I hope this helps".
6. If there is little data, say so honestly in the summary rather than padding.

TODAY: ${today}
TIME OF DAY: ${partOfDay} — greet with "Good ${partOfDay}" and use the real weekday from TODAY above. The user's timezone is ${tz}.`;

    const userContent = `Here is the raw data for today's brief.

CALENDAR (${events.length} events today):
${events.length ? events.map((e, i) =>
  `${i + 1}. ${e.allDay ? "All day" : new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })} — ${e.title}${e.attendees ? ` | with: ${e.attendees}` : ""}${e.location ? ` | ${e.location}` : ""}`
).join("\n") : "(no events today)"}

EMAIL — last 24 hours (${emails.length} messages, metadata only):
${emails.length ? emails.map((m, i) =>
  `${i + 1}. From: ${m.from}\n   Subject: ${m.subject}\n   ${m.unread ? "[UNREAD] " : ""}${m.snippet}`
).join("\n") : "(no recent mail)"}

Write the brief now. Return only the JSON object.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userContent }],
      }),
    });

    if (!aiRes.ok) {
      console.error("Anthropic error:", aiRes.status, await aiRes.text());
      return res.status(502).json({ ok: false, error: "AI service error" });
    }

    const data = await aiRes.json();
    const raw = data?.content?.[0]?.text || "";
    const clean = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    let brief;
    try {
      brief = JSON.parse(clean);
    } catch (e) {
      console.error("Brief parse failed:", raw.slice(0, 400));
      return res.status(502).json({ ok: false, error: "AI returned invalid format" });
    }

    /* Greeting is computed here, not trusted to the model. Whatever it
       returns is overwritten with the real weekday and time of day. */
    brief.greeting = `Good ${partOfDay}. Here's ${localDayLabel(tz).split(",")[0]}.`;

    /* shape guard */
    brief.decisions = Array.isArray(brief.decisions) ? brief.decisions.slice(0, 4) : [];
    brief.meetings  = Array.isArray(brief.meetings)  ? brief.meetings.slice(0, 8)  : [];
    brief.handled   = Array.isArray(brief.handled)   ? brief.handled.slice(0, 8)   : [];
    brief.quiet     = Array.isArray(brief.quiet)     ? brief.quiet.slice(0, 5)     : [];

    /* ── 6. Charge credits (only after success) ── */
    let creditsRemaining = credits - CREDIT_COST;
    try {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(userRef);
        const freshCredits = (fresh.data() || {}).credits || 0;
        if (freshCredits < CREDIT_COST) throw new Error("RACE_INSUFFICIENT_CREDITS");
        tx.update(userRef, {
          credits:      admin.firestore.FieldValue.increment(-CREDIT_COST),
          briefsRun:    admin.firestore.FieldValue.increment(1),
          lastBriefAt:  admin.firestore.FieldValue.serverTimestamp(),
        });
        creditsRemaining = freshCredits - CREDIT_COST;
      });
    } catch (txErr) {
      if (String(txErr.message).includes("RACE_INSUFFICIENT_CREDITS")) {
        return res.status(402).json({ ok: false, error: "insufficient_credits" });
      }
      console.error("Brief credit deduction failed:", txErr);
      /* still return the brief — we'd rather deliver than double-charge */
    }

    /* store the latest brief so the app can show it without re-spending */
    await userRef.collection("briefs").add({
      brief,
      counts: { emails: emails.length, events: events.length },
      at: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return res.status(200).json({
      ok: true,
      brief,
      counts: { emails: emails.length, events: events.length },
      credits_remaining: creditsRemaining,
    });
  } catch (err) {
    console.error("staff-brief crashed:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}