// Liel Orgad site: static assets + contact form endpoint.
// Canonical host: lielorgad.com. Every other host (www, workers.dev, previews)
// either redirects to it or is served with noindex.

const CANONICAL_HOST = "lielorgad.com";
const DEFAULT_TO = "lielorgad@outlook.com";
const FROM_ADDRESS = "website@lielorgad.com";

const TOPICS = {
  buy: "קנייה של דירה",
  "first-home": "דירה ראשונה",
  sell: "מכירה של דירה",
  "sell-and-buy": "מוכרים וקונים",
  prenup: "הסכם ממון",
  epa: "ייפוי כוח מתמשך",
  will: "צוואה",
  other: "נושא אחר",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // www -> apex, permanent
    if (url.hostname === "www." + CANONICAL_HOST) {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    // Clean URLs: /about.html -> /about, /index.html -> /
    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname === "/index.html" ? "/" : url.pathname.slice(0, -5);
      return Response.redirect(url.toString(), 301);
    }

    const res = await env.ASSETS.fetch(request);

    // Keep preview hosts (workers.dev etc.) out of Google
    if (url.hostname !== CANONICAL_HOST) {
      const h = new Headers(res.headers);
      h.set("X-Robots-Tag", "noindex, nofollow");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }
    return res;
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clean(v, max) {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

async function handleContact(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);

  // Same-origin only
  const origin = request.headers.get("origin");
  const reqHost = new URL(request.url).host;
  if (!origin || new URL(origin).host !== reqHost) return json({ ok: false, error: "origin" }, 403);

  // Rate limit per IP (binding optional)
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (env.FORM_LIMITER) {
    const { success } = await env.FORM_LIMITER.limit({ key: ip });
    if (!success) return json({ ok: false, error: "rate" }, 429);
  }

  let data;
  try {
    if ((request.headers.get("content-length") | 0) > 10000) throw new Error("big");
    data = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  // Honeypot and minimum fill time: pretend success for bots, send nothing
  const elapsed = Date.now() - Number(data.ts || 0);
  if (clean(data.company, 200) !== "" || !(elapsed > 2500)) {
    return json({ ok: true });
  }

  const topic = clean(data.topic, 30);
  const name = clean(data.name, 80);
  const phone = clean(data.phone, 20);
  const email = clean(data.email, 120);
  const message = clean(data.message, 1500);
  const consent = data.consent === "yes";

  const errors = {};
  if (!TOPICS[topic]) errors.topic = "יש לבחור נושא";
  if (name.length < 2) errors.name = "יש למלא שם";
  const digits = phone.replace(/\D/g, "");
  if (!/^[\d\s()+\-]+$/.test(phone) || digits.length < 9 || digits.length > 13) errors.phone = "מספר הטלפון לא תקין";
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) errors.email = "כתובת המייל לא תקינה";
  if (!consent) errors.consent = "יש לאשר את מדיניות הפרטיות";
  if (Object.keys(errors).length) return json({ ok: false, error: "validation", fields: errors }, 422);

  if (!env.EMAIL) return json({ ok: false, error: "not_configured" }, 503);

  const recipients = String(env.FORM_TO || DEFAULT_TO)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const when = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  const rows = [
    ["נושא", TOPICS[topic]],
    ["שם", name],
    ["טלפון", phone],
    ["מייל", email || "לא נמסר"],
    ["הודעה", message || "לא נכתבה הודעה"],
    ["התקבל", when],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html =
    `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;color:#08245D">` +
    `<h2 style="margin:0 0 12px">פנייה חדשה מהאתר</h2><table cellpadding="6" style="border-collapse:collapse">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="font-weight:bold;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`
      )
      .join("") +
    `</table><p style="margin-top:16px"><a href="tel:+972${digits.replace(/^0/, "")}">חיוג</a> · ` +
    `<a href="https://wa.me/972${digits.replace(/^0/, "")}">וואטסאפ</a></p></div>`;

  const msg = {
    to: recipients,
    from: { email: env.FORM_FROM || FROM_ADDRESS, name: "אתר ליאל אורגד" },
    subject: `פנייה חדשה מהאתר: ${TOPICS[topic]}, ${name}`,
    text,
    html,
  };
  if (email) msg.replyTo = { email, name };

  try {
    await env.EMAIL.send(msg);
  } catch (e) {
    console.error("send failed", e && e.code, e && e.message);
    return json({ ok: false, error: "send_failed" }, 502);
  }
  return json({ ok: true });
}
