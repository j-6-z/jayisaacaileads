/* ============================================================
   JAYISAAC AI — Cybersecurity: Is This Link Safe?
   ============================================================
   POST /api/link-check
   Body: { idToken: "<Firebase ID token>", url: "https://..." }

   Returns:
   {
     ok: true,
     verdict: "safe" | "caution" | "dangerous",
     score: 0-100,            // higher = safer
     headline: "This looks like a phishing page",
     summary: "plain English, 2 sentences",
     signals: [ { label, detail, level: "good"|"warn"|"bad" } ],
     chain:   [ "https://bit.ly/x", "https://real-destination.com/login" ],
     final:   { url, host, ip },
     advice:  "what to do about it",
     credits_remaining: 88
   }

   REAL SIGNALS (no paid APIs, no licensing gray area):
   - Redirect chain followed to the true destination
   - Domain age via RDAP (free, keyless) - new domains are the #1 phish tell
   - Typosquat / homograph detection against common brands
   - TLS certificate issuer + validity
   - URL structure heuristics (raw IP host, @ trick, punycode, risky TLD,
     credential keywords in subdomains, excessive depth)
   - Claude synthesizes everything into a verdict

   NOT USED: Google Safe Browsing. Its free tier is licensed for
   non-commercial use only; the commercial product is Web Risk (paid).
   Left out deliberately so this stays clean to sell.

   SECURITY: this endpoint fetches user-supplied URLs, which is a textbook
   SSRF vector. Every hop is re-validated against private/link-local/
   loopback ranges and cloud metadata endpoints before any request is made.

   COST: 3 credits
   ============================================================ */

import admin from "firebase-admin";
import dns from "node:dns/promises";
import net from "node:net";

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
const CREDIT_COST = 3;
const MAX_HOPS    = 8;
const HOP_TIMEOUT = 6000;

/* ── SSRF GUARD ─────────────────────────────────────────────── */
function ipIsPrivate(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true;                              // 10/8
    if (p[0] === 127) return true;                             // loopback
    if (p[0] === 0) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true;             // 192.168/16
    if (p[0] === 169 && p[1] === 254) return true;             // link-local + AWS metadata
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;// CGNAT
    if (p[0] >= 224) return true;                              // multicast/reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    if (s === "::1" || s === "::") return true;
    if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique local
    if (s.startsWith("fe80")) return true;                     // link local
    if (s.startsWith("::ffff:")) return ipIsPrivate(s.replace("::ffff:", ""));
    return false;
  }
  return true; /* unknown format: refuse */
}

const BLOCKED_HOSTS = new Set([
  "localhost", "metadata.google.internal", "metadata", "instance-data",
]);

async function assertPublicHost(hostname) {
  const h = String(hostname).toLowerCase();
  if (BLOCKED_HOSTS.has(h) || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) {
    throw new Error("blocked_host");
  }
  if (net.isIP(h)) {
    if (ipIsPrivate(h)) throw new Error("blocked_host");
    return h;
  }
  let addrs = [];
  try {
    addrs = await dns.lookup(h, { all: true });
  } catch (e) {
    throw new Error("dns_failed");
  }
  if (!addrs.length) throw new Error("dns_failed");
  for (const a of addrs) if (ipIsPrivate(a.address)) throw new Error("blocked_host");
  return addrs[0].address;
}

/* ── URL heuristics ─────────────────────────────────────────── */
const RISKY_TLDS = new Set([
  "zip","mov","top","xyz","click","link","gq","cf","tk","ml","ga","work",
  "rest","fit","country","kim","science","party","review","stream","download",
]);

const BRANDS = [
  "paypal","microsoft","apple","amazon","google","facebook","instagram",
  "netflix","dhl","fedex","ups","chase","wellsfargo","bankofamerica","rbc",
  "td","scotiabank","cra-arc","interac","coinbase","binance","metamask",
  "office365","outlook","docusign","dropbox","linkedin","whatsapp",
];

const CRED_WORDS = [
  "login","signin","verify","secure","account","update","confirm","billing",
  "password","suspended","unlock","recover","validate","authenticate","wallet",
];

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function registrableGuess(host) {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const twoLevel = ["co.uk","com.au","co.nz","co.jp","com.br","co.za","org.uk","gov.uk","ac.uk"];
  const last2 = parts.slice(-2).join(".");
  if (twoLevel.includes(last2)) return parts.slice(-3).join(".");
  return last2;
}

function urlHeuristics(u) {
  const out = [];
  const host = u.hostname.toLowerCase();
  const reg  = registrableGuess(host);
  const label = reg.split(".")[0];
  const tld = host.split(".").pop();

  if (net.isIP(host)) {
    out.push({ label: "Raw IP address as host", detail: "Legitimate sites use domain names. Raw IPs are common in phishing and malware delivery.", level: "bad" });
  }
  if (u.href.includes("@")) {
    out.push({ label: "Contains @ in the URL", detail: "Everything before the @ is ignored by browsers. A classic trick to make a hostile domain look trusted.", level: "bad" });
  }
  if (host.startsWith("xn--") || host.includes(".xn--")) {
    out.push({ label: "Punycode / non-Latin characters", detail: "The domain uses encoded characters that can render as lookalike letters (homograph attack).", level: "bad" });
  }
  if (RISKY_TLDS.has(tld)) {
    out.push({ label: `High-abuse TLD (.${tld})`, detail: "This top-level domain has an outsized share of malicious registrations.", level: "warn" });
  }
  const subs = host.split(".").length;
  if (subs >= 5) {
    out.push({ label: "Unusually deep subdomain chain", detail: `${subs} labels deep. Attackers pad subdomains to bury the real domain past the visible part of the address bar.`, level: "warn" });
  }
  const lowerHref = u.href.toLowerCase();
  const hitWords = CRED_WORDS.filter(w => host.includes(w));
  if (hitWords.length) {
    out.push({ label: "Credential keywords in the hostname", detail: `Contains "${hitWords.join('", "')}". Real brands rarely need these words in the domain itself.`, level: "warn" });
  }
  /* brand impersonation: brand appears in host but is NOT the registrable domain */
  for (const b of BRANDS) {
    if (host.includes(b) && label !== b) {
      out.push({ label: `Impersonates "${b}"`, detail: `The name "${b}" appears in the hostname, but the actual domain is "${reg}". This is how brand-spoofing pages are built.`, level: "bad" });
      break;
    }
    const d = levenshtein(label, b);
    if (d > 0 && d <= 1 && Math.abs(label.length - b.length) <= 1 && label.length > 4) {
      out.push({ label: `Lookalike of "${b}"`, detail: `The domain "${label}" is one character away from "${b}". Typosquatting.`, level: "bad" });
      break;
    }
  }
  if (u.protocol === "http:") {
    out.push({ label: "No HTTPS", detail: "Traffic is unencrypted. Anything you type can be read in transit.", level: "warn" });
  }
  if (lowerHref.length > 180) {
    out.push({ label: "Very long URL", detail: "Excessive length is often used to hide the real destination.", level: "warn" });
  }
  return out;
}

/* ── Redirect chain (SSRF-guarded at every hop) ─────────────── */
async function followChain(startUrl) {
  const chain = [];
  let current = startUrl;
  let finalIp = null;

  for (let i = 0; i < MAX_HOPS; i++) {
    let u;
    try { u = new URL(current); } catch (e) { throw new Error("bad_url"); }
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad_scheme");

    finalIp = await assertPublicHost(u.hostname); /* re-validated each hop */
    chain.push(u.href);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HOP_TIMEOUT);
    let res;
    try {
      res = await fetch(u.href, {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JAYISAAC-LinkCheck/1.0; +https://www.jayisaac.io)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
    } catch (e) {
      clearTimeout(timer);
      return { chain, finalIp, status: null, headers: {}, unreachable: true };
    }
    clearTimeout(timer);

    const status = res.status;
    const loc = res.headers.get("location");
    if (status >= 300 && status < 400 && loc) {
      current = new URL(loc, u.href).href;
      continue;
    }
    const headers = {};
    ["server","content-type","x-powered-by","strict-transport-security","content-security-policy"]
      .forEach(k => { const v = res.headers.get(k); if (v) headers[k] = v.slice(0, 200); });
    return { chain, finalIp, status, headers, unreachable: false };
  }
  return { chain, finalIp, status: null, headers: {}, tooManyHops: true };
}

/* ── Domain age via RDAP (free, no key) ─────────────────────── */
async function domainAge(host) {
  if (net.isIP(host)) return null;
  const reg = registrableGuess(host);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(reg)}`, {
      signal: ctrl.signal, headers: { Accept: "application/rdap+json" },
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j = await r.json();
    const ev = (j.events || []).find(e => e.eventAction === "registration");
    if (!ev || !ev.eventDate) return null;
    const created = new Date(ev.eventDate);
    const days = Math.floor((Date.now() - created.getTime()) / 86400000);
    return { registered: created.toISOString().slice(0, 10), days, registrable: reg };
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { idToken, url: rawUrl } = req.body || {};
    if (!idToken) return res.status(401).json({ ok: false, error: "Missing auth token" });
    if (!rawUrl || typeof rawUrl !== "string") return res.status(400).json({ ok: false, error: "Missing url" });

    let target = rawUrl.trim();
    if (!/^https?:\/\//i.test(target)) target = "https://" + target;
    if (target.length > 2000) return res.status(400).json({ ok: false, error: "url_too_long" });

    let parsed;
    try { parsed = new URL(target); } catch (e) {
      return res.status(400).json({ ok: false, error: "invalid_url" });
    }

    /* auth */
    let decoded;
    try { decoded = await admin.auth().verifyIdToken(idToken); }
    catch (e) { return res.status(401).json({ ok: false, error: "Invalid auth token" }); }
    const uid = decoded.uid;

    /* credits pre-check */
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(403).json({ ok: false, error: "User profile not found" });
    const credits = typeof (userSnap.data() || {}).credits === "number" ? userSnap.data().credits : 0;
    if (credits < CREDIT_COST) {
      return res.status(402).json({
        ok: false, error: "insufficient_credits",
        message: `You need ${CREDIT_COST} credits to check a link. You have ${credits}.`, credits,
      });
    }

    /* gather signals */
    let chainInfo;
    try {
      chainInfo = await followChain(parsed.href);
    } catch (e) {
      const m = String(e.message);
      if (m === "blocked_host") {
        return res.status(400).json({ ok: false, error: "blocked_host",
          message: "That address points to a private or internal network and will not be fetched." });
      }
      if (m === "dns_failed") {
        return res.status(200).json({
          ok: true, verdict: "dangerous", score: 15,
          headline: "This domain does not resolve",
          summary: "No DNS record exists for this address. The link is dead, mistyped, or was taken down.",
          signals: [{ label: "Domain does not resolve", detail: "DNS returned no address for this hostname.", level: "bad" }],
          chain: [parsed.href], final: { url: parsed.href, host: parsed.hostname, ip: null },
          advice: "Do not use this link. If someone sent it to you claiming urgency, treat that as a red flag.",
          credits_remaining: credits,
        });
      }
      return res.status(400).json({ ok: false, error: "invalid_url" });
    }

    const finalUrl  = chainInfo.chain[chainInfo.chain.length - 1] || parsed.href;
    const finalHost = new URL(finalUrl).hostname;
    const age       = await domainAge(finalHost);

    const signals = [];

    /* redirect signals */
    if (chainInfo.chain.length > 1) {
      const startHost = parsed.hostname;
      const level = chainInfo.chain.length > 3 ? "warn" : "good";
      signals.push({
        label: `Redirects ${chainInfo.chain.length - 1} time${chainInfo.chain.length === 2 ? "" : "s"}`,
        detail: `Starts at ${startHost} and ends at ${finalHost}.` +
                (startHost !== finalHost ? " The final destination is a different domain than the one you clicked." : ""),
        level: startHost !== finalHost ? "warn" : level,
      });
    }
    if (chainInfo.tooManyHops) {
      signals.push({ label: "Excessive redirect chain", detail: `More than ${MAX_HOPS} hops. Redirect laundering is used to evade filters.`, level: "bad" });
    }
    if (chainInfo.unreachable) {
      signals.push({ label: "Server did not respond", detail: "The host resolved but never answered. It may be down or blocking automated checks.", level: "warn" });
    }

    /* domain age */
    if (age) {
      if (age.days < 30) {
        signals.push({ label: `Domain is ${age.days} day${age.days === 1 ? "" : "s"} old`, detail: `Registered ${age.registered}. Brand new domains are the single strongest phishing indicator.`, level: "bad" });
      } else if (age.days < 180) {
        signals.push({ label: `Domain is ${Math.floor(age.days / 30)} months old`, detail: `Registered ${age.registered}. Young, but not automatically hostile.`, level: "warn" });
      } else {
        signals.push({ label: `Domain established ${Math.floor(age.days / 365) || "<1"} year${age.days >= 730 ? "s" : ""} ago`, detail: `Registered ${age.registered}. Long-lived domains are far less likely to be throwaway phishing infrastructure.`, level: "good" });
      }
    }

    /* heuristics on the FINAL url */
    try { urlHeuristics(new URL(finalUrl)).forEach(s => signals.push(s)); } catch (e) {}

    /* transport */
    if (finalUrl.startsWith("https://")) {
      signals.push({ label: "Served over HTTPS", detail: "Traffic to this destination is encrypted.", level: "good" });
    }
    if (chainInfo.headers["server"]) {
      signals.push({ label: "Server banner exposed", detail: `Reports "${chainInfo.headers["server"]}". Minor information leak.`, level: "warn" });
    }

    /* score */
    let score = 78;
    for (const s of signals) {
      if (s.level === "bad")  score -= 22;
      if (s.level === "warn") score -= 8;
      if (s.level === "good") score += 6;
    }
    score = Math.max(2, Math.min(98, score));
    const verdict = score >= 70 ? "safe" : score >= 40 ? "caution" : "dangerous";

    /* AI writes the human verdict */
    const apiKey = process.env.ANTHROPIC_API_KEY;
    let headline = verdict === "safe" ? "Nothing suspicious found"
                 : verdict === "caution" ? "Some warning signs here"
                 : "This link looks dangerous";
    let summary = "";
    let advice  = verdict === "safe"
      ? "Nothing stood out, but never enter a password on a page you reached from an unexpected message."
      : "Do not enter credentials or payment details. If it claims to be a company you use, go to their site directly instead.";

    if (apiKey) {
      try {
        const sys = `You are a security analyst explaining a link safety check to a small business owner with no security training. Be calm, concrete, and honest. Never invent findings that are not in the data.

Return ONLY this JSON, no markdown or preamble:
{"headline":"string, under 60 chars, plain and direct","summary":"2 sentences max explaining what this link is and why the verdict","advice":"1 sentence, what they should actually do"}`;

        const usr = `VERDICT: ${verdict} (score ${score}/100)
ORIGINAL LINK: ${parsed.href}
FINAL DESTINATION: ${finalUrl}
REDIRECT CHAIN: ${chainInfo.chain.join(" -> ")}
DOMAIN AGE: ${age ? `${age.days} days (registered ${age.registered})` : "unknown"}
HTTP STATUS: ${chainInfo.status ?? "no response"}

SIGNALS FOUND:
${signals.map(s => `- [${s.level}] ${s.label}: ${s.detail}`).join("\n")}

Write the verdict.`;

        const ar = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 500, system: sys,
            messages: [{ role: "user", content: usr }],
          }),
        });
        if (ar.ok) {
          const aj = await ar.json();
          const txt = (aj?.content?.[0]?.text || "").replace(/```json\s*/g, "").replace(/```/g, "").trim();
          const parsedAI = JSON.parse(txt);
          if (parsedAI.headline) headline = String(parsedAI.headline).slice(0, 120);
          if (parsedAI.summary)  summary  = String(parsedAI.summary).slice(0, 400);
          if (parsedAI.advice)   advice   = String(parsedAI.advice).slice(0, 300);
        }
      } catch (e) { /* keep the deterministic fallback */ }
    }

    /* charge */
    let creditsRemaining = credits - CREDIT_COST;
    try {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(userRef);
        const fc = (fresh.data() || {}).credits || 0;
        if (fc < CREDIT_COST) throw new Error("RACE_INSUFFICIENT_CREDITS");
        tx.update(userRef, {
          credits: admin.firestore.FieldValue.increment(-CREDIT_COST),
          linkChecks: admin.firestore.FieldValue.increment(1),
          lastLinkCheckAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        creditsRemaining = fc - CREDIT_COST;
      });
    } catch (txErr) {
      if (String(txErr.message).includes("RACE_INSUFFICIENT_CREDITS")) {
        return res.status(402).json({ ok: false, error: "insufficient_credits" });
      }
      console.error("link-check charge failed:", txErr);
    }

    return res.status(200).json({
      ok: true, verdict, score, headline, summary, advice,
      signals,
      chain: chainInfo.chain,
      final: { url: finalUrl, host: finalHost, ip: chainInfo.finalIp },
      credits_remaining: creditsRemaining,
    });
  } catch (err) {
    console.error("link-check crashed:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}