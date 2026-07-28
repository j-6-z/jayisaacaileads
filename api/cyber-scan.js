/* ============================================================
   JAYISAAC AI — Cybersecurity: External Attack Surface Scan
   ============================================================
   POST /api/cyber-scan
   Body: { idToken: "<Firebase ID token>", domain: "example.com" }

   Returns:
   {
     ok: true,
     domain: "example.com",
     score: 0-100,
     grade: "A" | "B" | "C" | "D" | "F",
     headline: "...",
     summary: "...",
     findings: [ { title, severity, why, fix, category } ],
     passed:   [ "HSTS enabled", ... ],
     meta: { tls: {...}, email: {...}, https: {...} },
     credits_remaining: 80
   }

   WHAT IS ACTUALLY CHECKED (all real, no paid APIs):
   - HTTP security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
     Referrer-Policy, Permissions-Policy
   - HTTPS enforcement: does http:// redirect to https://
   - TLS certificate: issuer, expiry, days remaining, protocol version
   - Email spoofing protection: SPF, DMARC, DKIM (common selectors), MX
   - Cookie flags: Secure, HttpOnly, SameSite
   - Information disclosure: Server / X-Powered-By version banners
   Then Claude ranks findings by real exploitability and writes each fix.

   SCOPE NOTE: this is EXTERNAL, unauthenticated, non-intrusive assessment.
   It sends ordinary web requests and DNS queries, nothing more. It does not
   port scan, does not attempt exploitation, and requires no authorization
   beyond what any browser already does.

   COST: 10 credits (matches ACTION_COSTS.cyber_scan)
   ============================================================ */

import admin from "firebase-admin";
import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";

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
const CREDIT_COST = 10;
const TIMEOUT     = 8000;

/* ── SSRF guard (same posture as link-check) ────────────────── */
function ipIsPrivate(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    if (p[0] >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    if (s === "::1" || s === "::") return true;
    if (s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe80")) return true;
    if (s.startsWith("::ffff:")) return ipIsPrivate(s.replace("::ffff:", ""));
    return false;
  }
  return true;
}

async function assertPublicHost(host) {
  const h = String(host).toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) {
    throw new Error("blocked_host");
  }
  if (net.isIP(h)) { if (ipIsPrivate(h)) throw new Error("blocked_host"); return h; }
  let addrs;
  try { addrs = await dns.lookup(h, { all: true }); }
  catch (e) { throw new Error("dns_failed"); }
  if (!addrs || !addrs.length) throw new Error("dns_failed");
  for (const a of addrs) if (ipIsPrivate(a.address)) throw new Error("blocked_host");
  return addrs[0].address;
}

/* ── TLS certificate inspection (real socket) ───────────────── */
function inspectTLS(host) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const socket = tls.connect(
        { host, port: 443, servername: host, rejectUnauthorized: false, timeout: TIMEOUT },
        () => {
          try {
            const cert = socket.getPeerCertificate();
            const proto = socket.getProtocol();
            const authorized = socket.authorized;
            const authError = socket.authorizationError ? String(socket.authorizationError) : null;
            let daysLeft = null, validTo = null, issuer = null, subject = null;
            if (cert && cert.valid_to) {
              validTo = cert.valid_to;
              daysLeft = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000);
            }
            if (cert && cert.issuer) issuer = cert.issuer.O || cert.issuer.CN || null;
            if (cert && cert.subject) subject = cert.subject.CN || null;
            socket.end();
            finish({ ok: true, protocol: proto, authorized, authError, daysLeft, validTo, issuer, subject });
          } catch (e) { try { socket.destroy(); } catch (_) {} finish({ ok: false, error: "cert_read_failed" }); }
        }
      );
      socket.on("error", (e) => finish({ ok: false, error: String(e.code || e.message || "tls_error") }));
      socket.on("timeout", () => { try { socket.destroy(); } catch (_) {} finish({ ok: false, error: "timeout" }); });
    } catch (e) {
      finish({ ok: false, error: "tls_connect_failed" });
    }
  });
}

/* ── Email auth records ─────────────────────────────────────── */
const DKIM_SELECTORS = ["google", "default", "selector1", "selector2", "k1", "s1", "mail", "dkim", "zoho", "mandrill"];

async function inspectEmail(domain) {
  const out = { spf: null, dmarc: null, dkim: [], mx: [] };
  try {
    const txt = await dns.resolveTxt(domain);
    const flat = txt.map(r => r.join(""));
    out.spf = flat.find(r => r.toLowerCase().startsWith("v=spf1")) || null;
  } catch (e) {}
  try {
    const d = await dns.resolveTxt(`_dmarc.${domain}`);
    const flat = d.map(r => r.join(""));
    out.dmarc = flat.find(r => r.toLowerCase().startsWith("v=dmarc1")) || null;
  } catch (e) {}
  try {
    const mx = await dns.resolveMx(domain);
    out.mx = mx.sort((a, b) => a.priority - b.priority).slice(0, 5).map(m => m.exchange);
  } catch (e) {}
  await Promise.all(DKIM_SELECTORS.map(async (sel) => {
    try {
      const r = await dns.resolveTxt(`${sel}._domainkey.${domain}`);
      const flat = r.map(x => x.join(""));
      if (flat.some(x => x.toLowerCase().includes("v=dkim1") || x.toLowerCase().includes("p="))) out.dkim.push(sel);
    } catch (e) {}
  }));
  return out;
}

/* ── HTTP surface ───────────────────────────────────────────── */
async function fetchSurface(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      method: "GET", redirect: "manual", signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JAYISAAC-Scan/1.0; +https://www.jayisaac.io)" },
    });
    clearTimeout(timer);
    const h = {};
    res.headers.forEach((v, k) => { h[k.toLowerCase()] = v.slice(0, 400); });
    const cookies = [];
    if (typeof res.headers.getSetCookie === "function") {
      res.headers.getSetCookie().forEach(c => cookies.push(c.slice(0, 300)));
    } else {
      const sc = res.headers.get("set-cookie");
      if (sc) cookies.push(sc.slice(0, 300));
    }
    return { ok: true, status: res.status, headers: h, cookies, location: res.headers.get("location") };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: String(e.name === "AbortError" ? "timeout" : e.message) };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { idToken, domain: rawDomain } = req.body || {};
    if (!idToken) return res.status(401).json({ ok: false, error: "Missing auth token" });
    if (!rawDomain || typeof rawDomain !== "string") return res.status(400).json({ ok: false, error: "Missing domain" });

    /* normalize: accept a full URL or a bare domain */
    let domain = rawDomain.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^www\./, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return res.status(400).json({ ok: false, error: "invalid_domain" });
    }

    let decoded;
    try { decoded = await admin.auth().verifyIdToken(idToken); }
    catch (e) { return res.status(401).json({ ok: false, error: "Invalid auth token" }); }
    const uid = decoded.uid;

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(403).json({ ok: false, error: "User profile not found" });
    const credits = typeof (userSnap.data() || {}).credits === "number" ? userSnap.data().credits : 0;
    if (credits < CREDIT_COST) {
      return res.status(402).json({ ok: false, error: "insufficient_credits",
        message: `You need ${CREDIT_COST} credits to run a scan. You have ${credits}.`, credits });
    }

    try { await assertPublicHost(domain); }
    catch (e) {
      const m = String(e.message);
      if (m === "dns_failed") return res.status(400).json({ ok: false, error: "domain_not_found", message: "That domain does not resolve." });
      return res.status(400).json({ ok: false, error: "blocked_host", message: "That address points to a private network." });
    }

    /* run everything in parallel */
    const [httpsRes, httpRes, tlsRes, email] = await Promise.all([
      fetchSurface(`https://${domain}/`),
      fetchSurface(`http://${domain}/`),
      inspectTLS(domain),
      inspectEmail(domain),
    ]);

    const findings = [];
    const passed   = [];
    const H = (httpsRes.ok ? httpsRes.headers : {}) || {};

    /* ── headers ── */
    const hasCSP = !!H["content-security-policy"];
    hasCSP ? passed.push("Content-Security-Policy present")
           : findings.push({ category: "Headers", title: "No Content-Security-Policy", severity: "medium",
               why: "Without a CSP, injected scripts run freely. It is the main defense against cross-site scripting.",
               fix: "Add a Content-Security-Policy header. Start in report-only mode to find breakage, then enforce." });

    const hsts = H["strict-transport-security"];
    if (hsts) {
      passed.push("HSTS enabled");
      const m = /max-age=(\d+)/i.exec(hsts);
      if (m && Number(m[1]) < 15552000) {
        findings.push({ category: "Transport", title: "HSTS max-age is short", severity: "low",
          why: `Set to ${m[1]} seconds. Under six months leaves a longer downgrade window.`,
          fix: "Raise max-age to at least 15552000 (180 days) and add includeSubDomains." });
      }
    } else {
      findings.push({ category: "Transport", title: "No HSTS header", severity: "medium",
        why: "Browsers can be downgraded to plain HTTP on the first visit, enabling interception on hostile networks.",
        fix: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains" });
    }

    (H["x-frame-options"] || (hasCSP && /frame-ancestors/i.test(H["content-security-policy"] || "")))
      ? passed.push("Clickjacking protection present")
      : findings.push({ category: "Headers", title: "No clickjacking protection", severity: "medium",
          why: "The site can be loaded in an invisible iframe and overlaid to trick users into clicking things they cannot see.",
          fix: "Add X-Frame-Options: DENY, or frame-ancestors 'none' in your CSP." });

    H["x-content-type-options"]
      ? passed.push("MIME sniffing disabled")
      : findings.push({ category: "Headers", title: "No X-Content-Type-Options", severity: "low",
          why: "Browsers may guess content types and execute an uploaded file as script.",
          fix: "Add: X-Content-Type-Options: nosniff" });

    H["referrer-policy"]
      ? passed.push("Referrer-Policy set")
      : findings.push({ category: "Headers", title: "No Referrer-Policy", severity: "low",
          why: "Full URLs, including any tokens in them, leak to third-party sites in the Referer header.",
          fix: "Add: Referrer-Policy: strict-origin-when-cross-origin" });

    /* ── information disclosure ── */
    ["server", "x-powered-by", "x-aspnet-version"].forEach((k) => {
      const v = H[k];
      if (v && /[0-9]+\.[0-9]/.test(v)) {
        findings.push({ category: "Disclosure", title: `Version disclosed in ${k}`, severity: "low",
          why: `Reports "${v}". Attackers use exact versions to match known exploits without probing.`,
          fix: `Suppress or genericize the ${k} header at your web server or CDN.` });
      }
    });

    /* ── HTTPS enforcement ── */
    if (httpRes.ok) {
      const loc = httpRes.location || "";
      if (httpRes.status >= 300 && httpRes.status < 400 && /^https:/i.test(loc)) {
        passed.push("HTTP redirects to HTTPS");
      } else if (httpRes.status === 200) {
        findings.push({ category: "Transport", title: "Plain HTTP is served without redirect", severity: "high",
          why: "The site answers on unencrypted HTTP. Credentials and session cookies can be read or modified in transit.",
          fix: "Force a 301 redirect from all HTTP traffic to HTTPS, then enable HSTS." });
      }
    }

    /* ── TLS ── */
    if (tlsRes.ok) {
      if (tlsRes.daysLeft !== null) {
        if (tlsRes.daysLeft < 0) {
          findings.push({ category: "Transport", title: "TLS certificate has EXPIRED", severity: "critical",
            why: `Expired ${Math.abs(tlsRes.daysLeft)} days ago. Visitors see a full-page browser warning and most will leave.`,
            fix: "Renew immediately and set up auto-renewal." });
        } else if (tlsRes.daysLeft < 21) {
          findings.push({ category: "Transport", title: `TLS certificate expires in ${tlsRes.daysLeft} days`, severity: "high",
            why: "An expired certificate takes the whole site down from a user's perspective.",
            fix: "Renew now and confirm automated renewal is actually running." });
        } else {
          passed.push(`TLS certificate valid (${tlsRes.daysLeft} days left)`);
        }
      }
      if (tlsRes.protocol && /TLSv1(\.0|\.1)?$/.test(tlsRes.protocol)) {
        findings.push({ category: "Transport", title: `Obsolete ${tlsRes.protocol} negotiated`, severity: "high",
          why: "TLS 1.0 and 1.1 are deprecated and have known weaknesses. They also fail modern compliance checks.",
          fix: "Disable TLS below 1.2 and prefer 1.3." });
      } else if (tlsRes.protocol) {
        passed.push(`Modern ${tlsRes.protocol}`);
      }
      if (tlsRes.authorized === false && tlsRes.authError) {
        findings.push({ category: "Transport", title: "Certificate does not validate", severity: "high",
          why: `Validation failed: ${tlsRes.authError}. Browsers will warn or block.`,
          fix: "Install the full certificate chain including intermediates, and confirm the hostname matches." });
      }
    } else {
      findings.push({ category: "Transport", title: "Could not establish TLS", severity: "high",
        why: `HTTPS connection failed (${tlsRes.error}). The site may not support HTTPS at all.`,
        fix: "Install a TLS certificate. Let's Encrypt is free and automatable." });
    }

    /* ── email spoofing ── */
    if (email.spf) {
      passed.push("SPF record published");
      if (/[~?]all\s*$/.test(email.spf)) {
        findings.push({ category: "Email", title: "SPF is not enforcing", severity: "low",
          why: "Ends in a soft-fail, so forged mail is marked rather than rejected.",
          fix: "Once you have confirmed all legitimate senders, move to -all." });
      }
    } else {
      findings.push({ category: "Email", title: "No SPF record", severity: "high",
        why: "Anyone can send email that appears to come from your domain. This is how invoice fraud against your customers starts.",
        fix: "Publish a TXT record listing your legitimate mail senders, e.g. v=spf1 include:_spf.google.com -all" });
    }

    if (email.dmarc) {
      const pol = /p=(none|quarantine|reject)/i.exec(email.dmarc);
      if (pol && pol[1].toLowerCase() === "none") {
        findings.push({ category: "Email", title: "DMARC is set to monitor only", severity: "medium",
          why: "p=none reports spoofing but does not stop it. Forged mail still lands in inboxes.",
          fix: "After reviewing reports, move to p=quarantine, then p=reject." });
      } else {
        passed.push(`DMARC enforcing (${pol ? pol[1] : "policy set"})`);
      }
    } else {
      findings.push({ category: "Email", title: "No DMARC record", severity: "high",
        why: "Without DMARC, receiving servers have no instruction on what to do with mail that fails authentication. Your domain can be impersonated.",
        fix: "Publish _dmarc TXT starting at v=DMARC1; p=none; rua=mailto:you@yourdomain, then tighten to reject." });
    }

    if (email.dkim.length) passed.push(`DKIM found (${email.dkim.join(", ")})`);
    else if (email.mx.length) {
      findings.push({ category: "Email", title: "No DKIM detected", severity: "medium",
        why: "Mail is not cryptographically signed, so recipients cannot verify it truly came from you.",
        fix: "Enable DKIM signing in your mail provider and publish the selector record it gives you." });
    }

    /* ── cookies ── */
    const allCookies = (httpsRes.ok && httpsRes.cookies) ? httpsRes.cookies : [];
    allCookies.forEach((c) => {
      const name = (c.split("=")[0] || "cookie").slice(0, 40);
      const low = c.toLowerCase();
      const miss = [];
      if (!low.includes("secure")) miss.push("Secure");
      if (!low.includes("httponly")) miss.push("HttpOnly");
      if (!low.includes("samesite")) miss.push("SameSite");
      if (miss.length) {
        findings.push({ category: "Cookies", title: `Cookie "${name}" missing ${miss.join(", ")}`, severity: miss.includes("Secure") ? "medium" : "low",
          why: "Cookies without these flags can be sent over plain HTTP, read by JavaScript, or sent on cross-site requests.",
          fix: `Set the ${miss.join(", ")} attribute${miss.length > 1 ? "s" : ""} on this cookie.` });
      }
    });
    if (allCookies.length && !findings.some(f => f.category === "Cookies")) passed.push("Cookies correctly flagged");

    /* ── score ── */
    const W = { critical: 30, high: 18, medium: 9, low: 3 };
    let score = 100;
    findings.forEach(f => { score -= (W[f.severity] || 3); });
    score = Math.max(5, Math.min(100, score));
    const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

    /* ── AI headline + summary ── */
    let headline = `${findings.length} issue${findings.length === 1 ? "" : "s"} found on ${domain}`;
    let summary  = "";
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const sys = `You are a security consultant reporting an external scan to a small business owner. Direct, calm, no jargon without explanation, no scare tactics. Never invent findings.

Return ONLY this JSON:
{"headline":"under 70 chars, the single most important takeaway","summary":"2-3 sentences: overall posture, the one thing to fix first, and why it matters in business terms"}`;
        const usr = `DOMAIN: ${domain}
SCORE: ${score}/100 (grade ${grade})
FINDINGS (${findings.length}):
${findings.map(f => `- [${f.severity}] ${f.title}: ${f.why}`).join("\n") || "(none)"}

PASSING (${passed.length}): ${passed.join("; ") || "(none)"}

Write it.`;
        const ar = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 600, system: sys,
            messages: [{ role: "user", content: usr }] }),
        });
        if (ar.ok) {
          const aj = await ar.json();
          const txt = (aj?.content?.[0]?.text || "").replace(/```json\s*/g, "").replace(/```/g, "").trim();
          const p = JSON.parse(txt);
          if (p.headline) headline = String(p.headline).slice(0, 140);
          if (p.summary)  summary  = String(p.summary).slice(0, 500);
        }
      } catch (e) {}
    }

    /* severity order for display */
    const ord = { critical: 0, high: 1, medium: 2, low: 3 };
    findings.sort((a, b) => (ord[a.severity] ?? 9) - (ord[b.severity] ?? 9));

    /* ── charge ── */
    let creditsRemaining = credits - CREDIT_COST;
    try {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(userRef);
        const fc = (fresh.data() || {}).credits || 0;
        if (fc < CREDIT_COST) throw new Error("RACE_INSUFFICIENT_CREDITS");
        tx.update(userRef, {
          credits: admin.firestore.FieldValue.increment(-CREDIT_COST),
          scansRun: admin.firestore.FieldValue.increment(1),
          lastScanAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        creditsRemaining = fc - CREDIT_COST;
      });
    } catch (txErr) {
      if (String(txErr.message).includes("RACE_INSUFFICIENT_CREDITS")) {
        return res.status(402).json({ ok: false, error: "insufficient_credits" });
      }
      console.error("cyber-scan charge failed:", txErr);
    }

    await userRef.collection("scans").add({
      domain, score, grade, findingCount: findings.length,
      at: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return res.status(200).json({
      ok: true, domain, score, grade, headline, summary,
      findings, passed,
      meta: {
        tls: tlsRes.ok ? { protocol: tlsRes.protocol, issuer: tlsRes.issuer, daysLeft: tlsRes.daysLeft, validTo: tlsRes.validTo } : { error: tlsRes.error },
        email: { spf: !!email.spf, dmarc: !!email.dmarc, dkim: email.dkim, mx: email.mx },
        https: { reachable: httpsRes.ok, status: httpsRes.status || null },
      },
      credits_remaining: creditsRemaining,
    });
  } catch (err) {
    console.error("cyber-scan crashed:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}