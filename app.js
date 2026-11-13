// jianpu digit → solfège syllable
const SOLFEGE = {
  1: "do",
  2: "re",
  3: "mi",
  4: "fa",
  5: "sol",
  6: "la",
  7: "si",
};
// C major, 1 = C4
const FREQ = { 1: 261.63, 2: 293.66, 3: 329.63, 4: 349.23, 5: 392.0, 6: 440.0, 7: 493.88 };

const STORAGE_KEY = "jianpu-trainer:settings";
const DEFAULTS = { digits: [1, 2, 3, 5], minLen: 2, maxLen: 3, allowRepeat: false, playSound: true };

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

let settings = loadSettings();
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

function render() {
  staff.innerHTML = "";
  stage.classList.toggle("revealed", revealed);

  if (current.length === 0) {
    prompt.textContent = "Pick at least one note below";
    return;
  }

  for (const d of current) {
    const note = document.createElement("div");
    note.className = `note n${d}`;
    note.innerHTML = `
      <span class="digit">${d}</span>
      <span class="syllable"><span class="en">${SOLFEGE[d]}</span></span>`;
    staff.appendChild(note);
  }
  prompt.innerHTML = revealed ? "Press <kbd>Space</kbd> for the next one" : "Press <kbd>Space</kbd> to show the answer";
}

function next() {
  current = generate();
  revealed = false;
  render();
}

function reveal() {
  revealed = true;
  count++;
  statsEl.textContent = `${count} sequence${count === 1 ? "" : "s"} practiced`;
  render();
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
    const t = start + i * step;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = FREQ[d];
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + step * 0.95);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + step);

    const el = notes[i];
    if (el) {
      setTimeout(() => el.classList.add("playing"), (i * step + 0.05) * 1000);
      setTimeout(() => el.classList.remove("playing"), ((i + 1) * step) * 1000);
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
    b.setAttribute("aria-label", `${d} (${SOLFEGE[d]})`);
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
  // don't hijack Space while typing in a field
  if (e.target.matches("input[type=number], input[type=text], textarea")) return;
  e.preventDefault();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  advance();
});
stage.addEventListener("click", advance);

initControls();
next();
