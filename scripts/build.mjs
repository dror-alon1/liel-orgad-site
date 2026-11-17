// Build for lielorgad.com
// templates/*.html  + content/pages/*.json  -> dist/*.html
// content/blog/*.json                       -> dist/blog/<slug>.html + list on dist/blog.html
// public/                                   -> dist/ (static assets, copied as is)
// Runs with plain Node (no dependencies). If "sharp" is installed, JPG/PNG
// images used in content are resized and converted to WebP; otherwise they are copied as is.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = "https://lielorgad.com";
const DIST = path.join(ROOT, "dist");
const PUBLIC = path.join(ROOT, "public");
const TPL = path.join(ROOT, "templates");
const PAGES = path.join(ROOT, "content", "pages");
const BLOG = path.join(ROOT, "content", "blog");
const MAX_W = 1600;

let sharp = null;
try { sharp = (await import("sharp")).default; } catch { /* optional */ }

// ---------- helpers ----------
const escHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escHtml(s).replace(/"/g, "&quot;");
const escJson = (s) => JSON.stringify(String(s ?? "")).slice(1, -1).replace(/</g, "\\u003c");
const textHtml = (s) => escHtml(String(s ?? "").trim()).replace(/\r?\n/g, "<br/>");
const get = (obj, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const today = () => new Date().toISOString().slice(0, 10);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

// Image size from file header (PNG, JPEG, WebP, GIF), no dependencies
function imageSize(file) {
  try {
    const b = fs.readFileSync(file);
    if (b.slice(0, 8).toString("hex") === "89504e470d0a1a0a") return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b.slice(0, 6).toString() === "GIF89a" || b.slice(0, 6).toString() === "GIF87a") return [b.readUInt16LE(6), b.readUInt16LE(8)];
    if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") {
      const t = b.slice(12, 16).toString();
      if (t === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      if (t === "VP8L") { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
      if (t === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1], len = b.readUInt16BE(i + 2);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        i += 2 + len;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// Images used in content: JPG/PNG -> WebP (max 1600px) when sharp is available
const imageMap = new Map();
async function img(url) {
  if (!url || typeof url !== "string" || !url.startsWith("/")) return url;
  if (imageMap.has(url)) return imageMap.get(url);
  let out = url;
  const src = path.join(PUBLIC, url);
  if (sharp && url.startsWith("/images/") && /\.(jpe?g|png)$/i.test(url) && fs.existsSync(src)) {
    out = url.replace(/\.(jpe?g|png)$/i, ".webp");
    const dst = path.join(DIST, out);
    await sharp(src).rotate().resize({ width: MAX_W, withoutEnlargement: true }).webp({ quality: 82 }).toFile(dst);
  }
  imageMap.set(url, out);
  return out;
}
function size(url) { return imageSize(path.join(DIST, url)); }

async function prepareImages(data) {
  // walk content and convert every image path once
  const walk = async (o) => {
    for (const k of Object.keys(o)) {
      if (o[k] && typeof o[k] === "object") await walk(o[k]);
      else if (typeof o[k] === "string" && /^\/images\/.+\.(jpe?g|png|webp|gif)$/i.test(o[k])) o[k] = await img(o[k]);
    }
  };
  await walk(data);
}

function render(tpl, data, extra = {}) {
  return tpl.replace(/\{\{(h|a|j|w|hh):([\w.\-]+)\}\}|\{\{(\w+)\}\}/g, (m, kind, key, plain) => {
    if (plain) return extra[plain] ?? "";
    const v = get(data, key);
    if (v === undefined) throw new Error(`Missing content field: ${key}`);
    if (kind === "h") return textHtml(v);
    if (kind === "a") return escAttr(String(v).trim());
    if (kind === "j") return escJson(String(v).trim());
    const s = size(v);
    if (!s) return kind === "w" ? "" : "";
    return String(kind === "w" ? s[0] : s[1]);
  });
}

// ---------- blog ----------
function slugify(s) {
  return String(s || "").toLowerCase().trim()
    .replace(/[^a-z0-9\u0590-\u05ff\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
function heDate(d) {
  const x = new Date(d); if (isNaN(x)) return "";
  return `${x.getDate()} ב${HE_MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}
function sanitizeBody(html) {
  // Content is written by the site owner in the CMS; still strip scripts, styles and inline handlers.
  return String(html || "")
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "").replace(/\son\w+='[^']*'/gi, "")
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"');
}
function loadPosts() {
  if (!fs.existsSync(BLOG)) return [];
  const posts = [];
  for (const f of fs.readdirSync(BLOG).filter((f) => f.endsWith(".json")).sort()) {
    const p = readJson(path.join(BLOG, f));
    if (p.draft === true || !p.title) continue;
    const base = f.replace(/\.json$/, "");
    p.slug = slugify(p.slug) || slugify(base.replace(/^\d{4}-\d{2}-\d{2}-?/, "")) || base;
    p.date = p.date || base.slice(0, 10);
    p.file = f;
    posts.push(p);
  }
  const seen = new Set();
  for (const p of posts) { let s = p.slug, i = 2; while (seen.has(s)) s = `${p.slug}-${i++}`; p.slug = s; seen.add(s); }
  return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

const BLOG_CSS = `<style id="blog-css">.post-grid{list-style:none;margin:4rem 0 0;padding:0;display:grid;gap:1.5rem}@media(min-width:768px){.post-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1100px){.post-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}.post-card{display:flex;flex-direction:column;height:100%;border-radius:1.5rem;background:#fff;box-shadow:0 0 0 1px #d9e3f1 inset;overflow:hidden;text-decoration:none;color:inherit;transition:box-shadow .3s,transform .3s}.post-card:hover{transform:translateY(-3px);box-shadow:0 0 0 1px #c9daf2 inset,0 18px 40px -24px rgb(10 33 96/.35)}.post-card img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#eef3fa}.post-card .pc-body{padding:1.75rem;display:flex;flex-direction:column;gap:.75rem;flex:1}.post-card time{font-size:.9rem;color:#475672}.post-card h2{margin:0;font-family:var(--font-display);font-size:1.6rem;line-height:1.3;color:#0a2160}.post-card p{margin:0;color:#475672;line-height:1.75}.post-card .pc-more{margin-top:auto;padding-top:.5rem;color:#2c5bc7;font-weight:500}.post{max-width:46rem}.post-meta{color:#475672;margin:0 0 2.5rem}.post-cover{display:block;width:100%;height:auto;border-radius:1.5rem;margin:0 0 3rem}.post-body{font-size:1.15rem;line-height:1.9;color:#0a2160}.post-body>*{margin:0 0 1.4rem}.post-body h2{font-family:var(--font-display);font-size:2rem;line-height:1.3;margin:3rem 0 1rem}.post-body h3{font-family:var(--font-display);font-size:1.5rem;line-height:1.35;margin:2.25rem 0 .75rem}.post-body ul,.post-body ol{padding-inline-start:1.4rem}.post-body ul{list-style:disc}.post-body ol{list-style:decimal}.post-body li{margin:.4rem 0}.post-body a{color:#2c5bc7;text-decoration:underline;text-underline-offset:3px}.post-body img{max-width:100%;height:auto;border-radius:1rem}.post-body blockquote{margin:2rem 0;padding:1rem 1.5rem;border-inline-start:3px solid #2c5bc7;background:#eef3fa;border-radius:.75rem}.post-back{display:inline-block;margin-top:3rem}</style>`;

function postCard(p) {
  return `<li><a class="post-card" href="/blog/${p.slug}">` +
    (p.cover ? `<img src="${escAttr(p.cover)}" alt="${escAttr(p.cover_alt || "")}" loading="lazy"${(() => { const s = size(p.cover); return s ? ` width="${s[0]}" height="${s[1]}"` : ""; })()}/>` : "") +
    `<div class="pc-body"><time datetime="${escAttr(p.date)}">${escHtml(heDate(p.date))}</time><h2>${escHtml(p.title)}</h2>` +
    (p.description ? `<p>${textHtml(p.description)}</p>` : "") + `<span class="pc-more">לקריאה</span></div></a></li>`;
}

function postPage(shell, p) {
  const url = `${SITE}/blog/${p.slug}`;
  const title = `${p.title} | ליאל אורגד, עורכת דין`;
  const desc = p.description || "";
  const ogImg = p.cover ? SITE + p.cover : `${SITE}/images/og-default.jpg`;
  let head = shell.head;
  const setMeta = (re, val) => { head = head.replace(re, (m, a, b) => a + escAttr(val) + b); };
  head = head.replace(/<title>[\s\S]*?<\/title>/, `<title>${escHtml(title)}</title>`);
  setMeta(/(<meta name="description" content=")[^"]*(")/, desc);
  setMeta(/(<meta name="robots" content=")[^"]*(")/, "index, follow");
  setMeta(/(<meta property="og:title" content=")[^"]*(")/, p.title);
  setMeta(/(<meta property="og:description" content=")[^"]*(")/, desc);
  setMeta(/(<meta property="og:type" content=")[^"]*(")/, "article");
  setMeta(/(<meta property="og:url" content=")[^"]*(")/, url);
  setMeta(/(<meta name="twitter:title" content=")[^"]*(")/, p.title);
  setMeta(/(<meta name="twitter:description" content=")[^"]*(")/, desc);
  setMeta(/(<link rel="canonical" href=")[^"]*(")/, url);
  if (p.cover) {
    setMeta(/(<meta property="og:image" content=")[^"]*(")/, ogImg);
    setMeta(/(<meta name="twitter:image" content=")[^"]*(")/, ogImg);
    head = head.replace(/<meta (property="og:image|name="twitter:image):(width|height)" content="[^"]*"\/>/g, "");
    setMeta(/(<meta property="og:image:alt" content=")[^"]*(")/, p.cover_alt || p.title);
    setMeta(/(<meta name="twitter:image:alt" content=")[^"]*(")/, p.cover_alt || p.title);
  }
  head = head.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
  const ld = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: desc,
    datePublished: p.date, dateModified: p.updated || p.date, inLanguage: "he", mainEntityOfPage: url,
    image: ogImg, author: { "@type": "Person", name: "ליאל אורגד", url: `${SITE}/about` },
    publisher: { "@type": "LegalService", name: "ליאל אורגד, עורכת דין", url: SITE },
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "דף הבית", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "בלוג", item: `${SITE}/blog` },
    { "@type": "ListItem", position: 3, name: p.title, item: url } ] };
  head += `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` +
    `<script type="application/ld+json">${JSON.stringify(crumbs).replace(/</g, "\\u003c")}</script>` + BLOG_CSS;
  const coverSize = p.cover ? size(p.cover) : null;
  const main = `<main id="main"><article class="container-x py-16 lg:py-24"><div class="post">` +
    `<p class="kicker mb-6"><a href="/blog" class="no-underline">בלוג</a></p>` +
    `<h1 class="display-l mb-6">${escHtml(p.title)}</h1>` +
    `<p class="post-meta"><time datetime="${escAttr(p.date)}">${escHtml(heDate(p.date))}</time></p>` +
    (p.cover ? `<img class="post-cover" src="${escAttr(p.cover)}" alt="${escAttr(p.cover_alt || "")}"${coverSize ? ` width="${coverSize[0]}" height="${coverSize[1]}"` : ""} fetchpriority="high"/>` : "") +
    `<div class="post-body">${sanitizeBody(p.body)}</div>` +
    `<a href="/blog" class="btn btn-ghost post-back">לכל המאמרים</a></div></article></main>`;
  return head + shell.mid + main + shell.tail;
}

// ---------- main ----------
async function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  copyDir(PUBLIC, DIST);

  const pages = fs.readdirSync(TPL).filter((f) => f.endsWith(".html"));
  const posts = loadPosts();
  for (const p of posts) { if (p.cover) p.cover = await img(p.cover); p.body = await rewriteBodyImages(p.body); }

  for (const f of pages) {
    const name = f.replace(/\.html$/, "");
    const tpl = fs.readFileSync(path.join(TPL, f), "utf8");
    const data = readJson(path.join(PAGES, name + ".json"));
    await prepareImages(data);
    let html = render(tpl, data, { robots: posts.length ? "index, follow" : "noindex, follow" });
    if (name === "blog") {
      if (posts.length) {
        html = html.replace(/<!--posts:empty-->[\s\S]*?<!--\/posts:empty-->/, "")
          .replace("<!--posts:list-->", `<ul class="post-grid">${posts.map(postCard).join("")}</ul>`)
          .replace("</head>", BLOG_CSS + "</head>");
      }
      html = html.replace(/<!--\/?posts:[a-z]+-->/g, "");
      const i = html.indexOf("</head>"), a = html.indexOf('<main id="main">'), b = html.indexOf("</main>") + 7;
      const shell = { head: html.slice(0, i).replace(BLOG_CSS, ""), mid: html.slice(i, a), tail: html.slice(b) };
      fs.mkdirSync(path.join(DIST, "blog"), { recursive: true });
      for (const p of posts) fs.writeFileSync(path.join(DIST, "blog", p.slug + ".html"), postPage(shell, p));
    }
    if (/\{\{[^}]*\}\}/.test(html)) throw new Error(`Unfilled placeholder in ${f}`);
    fs.writeFileSync(path.join(DIST, f), html);
  }

  // sitemap: keep the existing entries, add the blog index and posts
  const smFile = path.join(DIST, "sitemap.xml");
  if (fs.existsSync(smFile) && posts.length) {
    let sm = fs.readFileSync(smFile, "utf8");
    const extra = [`  <url><loc>${SITE}/blog</loc><lastmod>${posts[0].date}</lastmod><priority>0.6</priority></url>`]
      .concat(posts.map((p) => `  <url><loc>${SITE}/blog/${p.slug}</loc><lastmod>${p.updated || p.date}</lastmod><priority>0.6</priority></url>`));
    sm = sm.replace("</urlset>", extra.join("\n") + "\n</urlset>");
    fs.writeFileSync(smFile, sm);
  }
  console.log(`Built ${pages.length} pages, ${posts.length} blog posts${sharp ? "" : " (sharp not installed: images copied as is)"}.`);
}

async function rewriteBodyImages(body) {
  const urls = [...String(body || "").matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  let out = String(body || "");
  for (const u of urls) { const n = await img(u); if (n !== u) out = out.split(`src="${u}"`).join(`src="${n}"`); }
  return out;
}

build().catch((e) => { console.error(e); process.exit(1); });
