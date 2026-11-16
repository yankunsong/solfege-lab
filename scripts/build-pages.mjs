// Writes one static HTML page per language so crawlers that don't run JavaScript
// (Bing, most AI crawlers) see translated text, titles and descriptions.
//
//   node scripts/build-pages.mjs
//
// Source: index.html (layout) + i18n.js (strings). Output: index.html (English, rewritten
// in place), <lang>/index.html for every other language, and sitemap.xml.
// Run it after changing index.html or i18n.js, and commit the results.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE_URL = "https://solfegelab.com/";

const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8") + "\nthis.LANGUAGES = LANGUAGES; this.STRINGS = STRINGS;", ctx);
const { LANGUAGES, STRINGS } = ctx;

const langPath = (code) => (code === "en" ? "" : `${code}/`);
const pageUrl = (code) => SITE_URL + langPath(code);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function render(template, code) {
  const t = (key) => STRINGS[code][key] ?? STRINGS.en[key];
  const kbd = (s) =>
    s.replace("{space}", `<kbd>${t("space")}</kbd>`).replace("{left}", "<kbd>←</kbd>").replace("{right}", "<kbd>→</kbd>");
  const syllables = ["do", "re", "mi", "fa", "sol", "la", code === "en" ? "ti" : "si"].join(" ");
  let html = template;
  const sub = (re, fn) => {
    if (!re.test(html)) throw new Error(`build-pages: pattern not found in index.html: ${re}`);
    html = html.replace(re, fn);
  };

  // head
  sub(/<html lang="[^"]*">/, `<html lang="${code}">`);
  sub(/<title>[^<]*<\/title>/, `<title>${esc(t("docTitle"))}</title>`);
  sub(/(<meta name="description" content=")[^"]*/, `$1${esc(t("docDesc"))}`);
  html = html.replace(/\n *<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>/g, "");
  const alternates = [
    `<link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`,
    ...LANGUAGES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${pageUrl(l.code)}" />`),
  ];
  sub(/( *)<link rel="canonical" href="[^"]*" \/>/, (_, ind) =>
    [`<link rel="canonical" href="${pageUrl(code)}" />`, ...alternates].map((l) => ind + l).join("\n"));
  sub(/(<meta property="og:title" content=")[^"]*/, `$1${esc(t("docTitle"))}`);
  sub(/(<meta property="og:description" content=")[^"]*/, `$1${esc(t("docDesc"))}`);
  sub(/(<meta property="og:url" content=")[^"]*/, `$1${pageUrl(code)}`);
  sub(/(<meta property="og:locale" content=")[^"]*/, `$1${LANGUAGES.find((l) => l.code === code).locale}`);
  if (code !== "en") html = html.replace(/(href|src)="((?:style\.css|i18n\.js|app\.js)[^"]*)"/g, `$1="../$2"`);

  // body
  sub(/(<(\w+)[^>]*\sdata-i18n="(\w+)"[^>]*>)[^<]*(<\/\2>)/g, (_, open, _tag, key, close) => open + esc(t(key)) + close);
  sub(/(<(\w+)[^>]*\sdata-i18n-html="(\w+)"[^>]*>)[\s\S]*?(<\/\2>)/g, (_, open, _tag, key, close) => open + kbd(t(key)) + close);
  sub(/(<p class="prompt" id="prompt">)[\s\S]*?(<\/p>)/, `$1${kbd(t("show"))}$2`);
  sub(/(<p class="stats" id="stats">)[^<]*(<\/p>)/, `$1${esc(t("stats")(0))}$2`);
  sub(/(<p id="aboutBody">)[\s\S]*?(<\/p>)/, `$1${t("aboutBody").replace("{syllables}", syllables)}$2`);
  const label = (id, key) => sub(new RegExp(`(id="${id}"[^>]*aria-label=")[^"]*`), `$1${esc(t(key))}`);
  sub(/(id="controls" aria-label=")[^"]*/, `$1${esc(t("settings"))}`);
  label("prevBtn", "prev");
  label("nextBtn", "nextBtn");
  label("minLen", "min");
  label("maxLen", "max");
  // language menu: real links to every language page, as <option>s the script switches between
  sub(/(<select id="langSelect">)[\s\S]*?(<\/select>)/, (_, open, close) =>
    open + LANGUAGES.map((l) => `<option value="${l.code}"${l.code === code ? " selected" : ""}>${l.name}</option>`).join("") + close);
  return html;
}

const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
for (const { code } of LANGUAGES) {
  const file = path.join(ROOT, langPath(code), "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, render(template, code));
}

const links = [`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`,
  ...LANGUAGES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${pageUrl(l.code)}" />`)].join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGUAGES.map((l) => `  <url>\n    <loc>${pageUrl(l.code)}</loc>\n${links}\n  </url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);
console.log(`Wrote ${LANGUAGES.length} pages and sitemap.xml`);
