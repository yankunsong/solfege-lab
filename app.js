// jianpu digit → solfège syllable (7 is si or ti, chosen by the user)
const SYLLABLES = { 1: "do", 2: "re", 3: "mi", 4: "fa", 5: "sol", 6: "la" };
// C major, 1 = C4
const FREQ = { 1: 261.63, 2: 293.66, 3: 329.63, 4: 349.23, 5: 392.0, 6: 440.0, 7: 493.88 };

const STORAGE_KEY = "jianpu-trainer:settings";
const LANG_KEY = "jianpu-trainer:lang";
// sevenName: null = follow the language (ti for English, si elsewhere) until the user picks one
const DEFAULTS = { digits: [1, 2, 3, 5], minLen: 2, maxLen: 3, allowRepeat: false, playSound: true, sevenName: null };

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const staff = $("staff");
const prompt = $("prompt");
const chips = $("chips");
const minLenEl = $("minLen");
const maxLenEl = $("maxLen");
const allowRepeatEl = $("allowRepeat");
const playSoundEl = $("playSound");
const statsEl = $("stats");
const langSelect = $("langSelect");
const sevenGroup = $("sevenGroup");

let settings = loadSettings();
let lang = pickLanguage();
let current = [];
let revealed = false;
let count = 0;

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.digits)) return { ...DEFAULTS, ...saved };
  } catch {}
  return { ...DEFAULTS };
}
function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

// ---------- language ----------
function pickLanguage() {
  const fromUrl = matchLanguage(new URLSearchParams(location.search).get("lang"));
  if (fromUrl) return fromUrl;
  try {
    const saved = matchLanguage(localStorage.getItem(LANG_KEY));
    if (saved) return saved;
  } catch {}
  for (const tag of navigator.languages || [navigator.language]) {
    const m = matchLanguage(tag);
    if (m) return m;
  }
  return "en";
}

const t = (key) => STRINGS[lang][key] ?? STRINGS.en[key];
const kbd = () => `<kbd>${t("space")}</kbd>`;
const withSpace = (s) => s.replace("{space}", kbd());

function seven() {
  return settings.sevenName || (lang === "en" ? "ti" : "si");
}
function syllable(d) {
  return d === 7 ? seven() : SYLLABLES[d];
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.title = t("docTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = withSpace(t(el.dataset.i18nHtml))));
  $("controls").setAttribute("aria-label", t("settings"));
  minLenEl.setAttribute("aria-label", t("min"));
  maxLenEl.setAttribute("aria-label", t("max"));
  langSelect.value = lang;
  updateSevenUI();
  updateStats();
  updatePrompt();
}

function setLanguage(code) {
  lang = code;
  try { localStorage.setItem(LANG_KEY, code); } catch {}
  const url = new URL(location.href);
  url.searchParams.set("lang", code);
  history.replaceState(null, "", url);
  applyLanguage();
  relabelNotes();
}

// ---------- si / ti ----------
function updateSevenUI() {
  const s = seven();
  sevenGroup.querySelectorAll("button").forEach((b) => {
    const on = b.dataset.seven === s;
    b.setAttribute("aria-checked", on);
    b.tabIndex = on ? 0 : -1;
  });
  const all = [1, 2, 3, 4, 5, 6, 7].map(syllable).join(" ");
  $("aboutBody").innerHTML = t("aboutBody").replace("{syllables}", all);
  chips.querySelectorAll(".chip").forEach((c) => {
    const d = Number(c.textContent);
    c.setAttribute("aria-label", `${d} (${syllable(d)})`);
  });
}

function setSeven(name) {
  settings.sevenName = name;
  saveSettings();
  updateSevenUI();
  relabelNotes();
}

// Update syllables on screen without re-rendering (so nothing re-animates).
function relabelNotes() {
  staff.querySelectorAll(".note").forEach((n, i) => {
    n.querySelector(".en").textContent = syllable(current[i]);
  });
}

// ---------- practice ----------
const rand = (n) => Math.floor(Math.random() * n);

function generate() {
  const pool = settings.digits;
  if (pool.length === 0) return [];
  const len = settings.minLen + rand(settings.maxLen - settings.minLen + 1);
  // with a single note selected, sequences longer than 1 must repeat
  const allowRepeat = settings.allowRepeat || pool.length === 1;
  const prevKey = current.join("");

  for (let attempt = 0; attempt < 20; attempt++) {
    const seq = [];
    while (seq.length < len) {
      const d = pool[rand(pool.length)];
      if (!allowRepeat && d === seq[seq.length - 1]) continue;
      seq.push(d);
    }
    if (seq.join("") !== prevKey) return seq;
  }
  return current.slice();
}

function updatePrompt() {
  if (current.length === 0) prompt.textContent = t("empty");
  else prompt.innerHTML = withSpace(t(revealed ? "next" : "show"));
}
function updateStats() {
  statsEl.textContent = t("stats")(count);
}

function render() {
  staff.innerHTML = "";
  stage.classList.toggle("revealed", revealed);
  for (const d of current) {
    const note = document.createElement("div");
    note.className = `note n${d}`;
    note.innerHTML = `<span class="digit">${d}</span><span class="syllable"><span class="en"></span></span>`;
    note.querySelector(".en").textContent = syllable(d);
    staff.appendChild(note);
  }
  updatePrompt();
}

function next() {
  current = generate();
  revealed = false;
  render();
}

function reveal() {
  revealed = true;
  count++;
  updateStats();
  // keep the existing notes so the entry animation doesn't replay
  stage.classList.add("revealed");
  updatePrompt();
  if (settings.playSound) playSequence(current);
}

function advance() {
  if (current.length === 0) return next();
  revealed ? next() : reveal();
}

// ---------- sound ----------
let audioCtx = null;
function playSequence(seq) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch { return; }

  const step = 0.42;
  const start = audioCtx.currentTime + 0.05;
  const notes = staff.querySelectorAll(".note");
  seq.forEach((d, i) => {
    const time = start + i * step;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = FREQ[d];
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.35, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + step * 0.95);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + step);

    const el = notes[i];
    if (el) {
      setTimeout(() => el.classList.add("playing"), (i * step + 0.05) * 1000);
      setTimeout(() => el.classList.remove("playing"), (i + 1) * step * 1000);
    }
  });
}

// ---------- settings ----------
function buildChips() {
  chips.innerHTML = "";
  for (let d = 1; d <= 7; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = d;
    b.setAttribute("aria-pressed", settings.digits.includes(d));
    b.addEventListener("click", () => {
      const has = settings.digits.includes(d);
      settings.digits = has ? settings.digits.filter((x) => x !== d) : [...settings.digits, d].sort();
      b.setAttribute("aria-pressed", !has);
      saveSettings();
      next();
    });
    chips.appendChild(b);
  }
}

function clampLen(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(8, Math.max(1, n)) : 1;
}

function onLenChange(e) {
  let min = clampLen(minLenEl.value);
  let max = clampLen(maxLenEl.value);
  if (min > max) {
    if (e.target === minLenEl) max = min; else min = max;
  }
  minLenEl.value = min;
  maxLenEl.value = max;
  settings.minLen = min;
  settings.maxLen = max;
  saveSettings();
  next();
}

function initControls() {
  buildChips();
  minLenEl.value = settings.minLen;
  maxLenEl.value = settings.maxLen;
  allowRepeatEl.checked = settings.allowRepeat;
  playSoundEl.checked = settings.playSound;

  for (const l of LANGUAGES) langSelect.add(new Option(l.name, l.code));
  langSelect.addEventListener("change", () => setLanguage(langSelect.value));

  sevenGroup.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-seven]");
    if (b) setSeven(b.dataset.seven);
  });
  sevenGroup.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const name = seven() === "si" ? "ti" : "si";
    setSeven(name);
    sevenGroup.querySelector(`[data-seven="${name}"]`).focus();
  });

  minLenEl.addEventListener("change", onLenChange);
  maxLenEl.addEventListener("change", onLenChange);
  allowRepeatEl.addEventListener("change", () => {
    settings.allowRepeat = allowRepeatEl.checked;
    saveSettings();
  });
  playSoundEl.addEventListener("change", () => {
    settings.playSound = playSoundEl.checked;
    saveSettings();
  });
}

// ---------- input ----------
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat) return;
  // don't hijack Space while typing in a field or using the language menu
  if (e.target instanceof Element && e.target.matches("input[type=number], input[type=text], textarea, select")) return;
  e.preventDefault();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  advance();
});
stage.addEventListener("click", advance);

initControls();
next();
applyLanguage();
