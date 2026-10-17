// Sugar Rush Heroes — designed by the Sugar Rush Kids
'use strict';
(() => {

// ================================================================
// Setup
// ================================================================
const T = 32;          // tile size
const ROWS = 15;
const VH = 450;        // view height (game pixels)
const SIZES = { normal: { w: 24, h: 40 }, bat: { w: 28, h: 34 }, tiny: { w: 14, h: 18 } };
const HERO_NAMES = { vamp: 'Vampire', axo: 'Axolotl' };
const CANDY_COLORS = ['#ff5fa2', '#4fc8ff', '#ffc93f', '#9b6bff', '#4fdc84', '#ff8a3d'];

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let VW = 800, scale = 1, dpr = 1;
const DEBUG = /[?&]debug/.test(location.search);

// ================================================================
// Save data
// ================================================================
const SAVE_KEY = 'sugar-rush-heroes-v1';
let save = { unlocked: 1, stars: [false, false, false], candies: [0, 0, 0], won: false, muted: false, hero: 'vamp' };
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (s && typeof s === 'object') save = Object.assign(save, s);
} catch (e) { /* no saved game */ }
if (DEBUG) save.unlocked = 3;
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ }
}

// ================================================================
// Screen size
// ================================================================
function resize() {
  const ww = window.innerWidth, wh = window.innerHeight;
  VW = Math.round(Math.max(600, Math.min(1000, VH * ww / wh)));
  scale = Math.min(ww / VW, wh / VH);
  const cssW = Math.floor(VW * scale), cssH = Math.floor(VH * scale);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = cssW + 'px';
  cv.style.height = cssH + 'px';
  cv.width = Math.floor(cssW * dpr);
  cv.height = Math.floor(cssH * dpr);
  const portrait = wh > ww * 1.1;
  document.body.classList.toggle('portrait', portrait);
  cv.style.left = Math.floor((ww - cssW) / 2) + 'px';
  const top = portrait ? Math.floor(Math.max(64, (wh - 230 - cssH) / 2)) : Math.floor((wh - cssH) / 2);
  cv.style.top = top + 'px';
  document.getElementById('rotateHint').style.top = (top + cssH + 18) + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ================================================================
// Input
// ================================================================
const keyState = {};
let touchState = {};
let inp = {}, prev = {};
let touchMode = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  KeyX: 'power', KeyJ: 'power', ShiftLeft: 'power', ShiftRight: 'power',
  KeyC: 'swap', KeyK: 'swap',
  Escape: 'pause', KeyP: 'pause', Enter: 'enter', NumpadEnter: 'enter',
};
window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.code === 'KeyM' && !e.repeat) toggleMute();
  const k = KEYS[e.code];
  if (k) {
    keyState[k] = true;
    e.preventDefault();
    if (touchMode) { touchMode = false; updateTouchUI(); }
  }
  if (DEBUG && state === 'play' && e.code === 'KeyN') finishLevel();
  if (DEBUG && state === 'play' && e.code === 'KeyB' && L.boss) { L.player.x = L.boss.triggerX + 10; L.player.y = 300; }
});
window.addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) keyState[k] = false; });
window.addEventListener('blur', () => { for (const k in keyState) keyState[k] = false; touchPointers.clear(); touchState = {}; });

function pollInput() {
  prev = inp;
  inp = {};
  for (const k of ['left', 'right', 'jump', 'down', 'power', 'swap', 'pause', 'enter']) {
    inp[k] = !!(keyState[k] || touchState[k]);
  }
}
const hit = (k) => inp[k] && !prev[k];

// Touch buttons: we track every finger and check which buttons it is over,
// so sliding a finger from ◀ to ▶ works.
const touchEl = document.getElementById('touch');
const touchBtns = [...touchEl.querySelectorAll('[data-k]')];
const touchPointers = new Map();
function refreshTouch() {
  touchState = {};
  const rects = touchBtns.map((b) => [b, b.getBoundingClientRect()]);
  for (const p of touchPointers.values()) {
    for (const [b, r] of rects) {
      const pad = 6;
      if (p.x >= r.left - pad && p.x <= r.right + pad && p.y >= r.top - pad && p.y <= r.bottom + pad) {
        touchState[b.dataset.k] = true;
      }
    }
  }
  for (const b of touchBtns) b.classList.toggle('on', !!touchState[b.dataset.k]);
}
touchEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  refreshTouch();
});
touchEl.addEventListener('pointermove', (e) => {
  if (!touchPointers.has(e.pointerId)) return;
  touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  refreshTouch();
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  touchEl.addEventListener(ev, (e) => { touchPointers.delete(e.pointerId); refreshTouch(); });
}
touchEl.addEventListener('contextmenu', (e) => e.preventDefault());

function updateTouchUI() {
  const show = touchMode && state === 'play';
  touchEl.classList.toggle('show', show);
  if (!show) { touchPointers.clear(); touchState = {}; for (const b of touchBtns) b.classList.remove('on'); }
  document.getElementById('pauseBtn').classList.toggle('hide', state !== 'play');
  document.getElementById('powIcon').textContent = hero === 'vamp' ? '🦇' : '✨';
  document.getElementById('powLabel').textContent = hero === 'vamp' ? 'BAT' : 'TINY';
}

// Menu taps on the canvas
cv.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (e.pointerType === 'touch' && !touchMode) { touchMode = true; updateTouchUI(); }
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
  for (const b of uiButtons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { sfx.click(); b.cb(); return; }
  }
  if (state === 'title') { sfx.click(); setState('hero'); }
});
document.body.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && !touchMode) { touchMode = true; updateTouchUI(); }
  unlockAudio();
});

document.getElementById('pauseBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (state === 'play') { sfx.click(); setState('pause'); }
});
document.getElementById('muteBtn').addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); toggleMute(); });
document.getElementById('pauseBtn').addEventListener('pointerdown', (e) => e.stopPropagation());
document.getElementById('muteBtn').addEventListener('pointerdown', (e) => e.stopPropagation());

// ================================================================
// Sound & music (all made with code — no sound files needed)
// ================================================================
let actx = null, master = null, musicBus = null, noiseBuf = null;
let pendingSong = null;
function unlockAudio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { actx = new AC(); } catch (e) { return; }
    master = actx.createGain();
    master.gain.value = save.muted ? 0 : 0.55;
    master.connect(actx.destination);
    musicBus = actx.createGain();
    musicBus.gain.value = 0.16;
    musicBus.connect(master);
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.6, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingSong) { const s = pendingSong; pendingSong = null; playSong(s); }
  }
  if (actx.state === 'suspended') actx.resume();
}
function toggleMute() {
  save.muted = !save.muted;
  persist();
  if (master) master.gain.value = save.muted ? 0 : 0.55;
  document.getElementById('muteBtn').textContent = save.muted ? '🔇' : '🔊';
}
document.getElementById('muteBtn').textContent = save.muted ? '🔇' : '🔊';

function tone(freq, dur, type = 'square', vol = 0.1, slideTo = null, when = 0, dest = null) {
  if (!actx) return;
  const t = actx.currentTime + when;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || master);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, freq = 1200, when = 0) {
  if (!actx || !noiseBuf) return;
  const t = actx.currentTime + when;
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  const f = actx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = freq;
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}
function arp(notes, step, type = 'square', vol = 0.08) {
  notes.forEach((n, i) => tone(n, step * 1.6, type, vol, null, i * step));
}
const sfx = {
  jump: () => tone(300, 0.14, 'square', 0.07, 620),
  candy: () => { tone(1047, 0.07, 'square', 0.06); tone(1568, 0.12, 'square', 0.06, null, 0.06); },
  stomp: () => { tone(260, 0.16, 'square', 0.1, 70); noise(0.1, 0.15, 2000); },
  hurt: () => tone(420, 0.3, 'sawtooth', 0.09, 110),
  key: () => arp([784, 988, 1175, 1568], 0.07, 'triangle', 0.15),
  door: () => { tone(196, 0.35, 'square', 0.08, 392); noise(0.3, 0.1, 900); },
  star: () => arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.07, 'square', 0.07),
  heart: () => { tone(660, 0.1, 'sine', 0.2); tone(880, 0.16, 'sine', 0.2, null, 0.08); },
  bat: () => { tone(900, 0.2, 'square', 0.05, 300); tone(1200, 0.15, 'triangle', 0.08, 500, 0.06); },
  shrink: () => tone(500, 0.3, 'sine', 0.15, 1900),
  grow: () => tone(1600, 0.3, 'sine', 0.15, 450),
  swap: () => { tone(523, 0.08, 'triangle', 0.18); tone(784, 0.14, 'triangle', 0.18, null, 0.07); },
  check: () => arp([523, 659, 784, 1047], 0.08, 'triangle', 0.18),
  splash: () => { noise(0.45, 0.25, 700); tone(320, 0.3, 'sine', 0.15, 90); },
  bounce: () => tone(170, 0.35, 'sine', 0.3, 720),
  spit: () => { noise(0.1, 0.12, 3000); tone(700, 0.1, 'square', 0.04, 300); },
  giggle: () => { for (let i = 0; i < 7; i++) tone(i % 2 ? 640 : 860, 0.07, 'triangle', 0.16, null, i * 0.07); },
  thump: () => { tone(95, 0.3, 'sine', 0.4, 40); noise(0.15, 0.15, 400); },
  win: () => arp([523, 659, 784, 1047, 784, 1047, 1319], 0.1, 'square', 0.08),
  nope: () => tone(220, 0.14, 'square', 0.06, 160),
  click: () => tone(720, 0.06, 'triangle', 0.15),
  boom: () => { tone(70, 0.7, 'sine', 0.5, 30); noise(0.6, 0.35, 600); },
  firework: () => noise(0.35, 0.06, 2600),
  poof: () => { noise(0.15, 0.1, 1800); tone(900, 0.12, 'sine', 0.08, 1500); },
};

// Music: [midi note, length in eighth notes] — 0 means rest
const SONGS = {
  choco: {
    bpm: 132,
    mel: [[76,1],[76,1],[79,1],[76,1],[72,1],[74,1],[76,2],[77,1],[77,1],[81,1],[77,1],[74,1],[76,1],[77,2],
          [79,1],[79,1],[76,1],[72,1],[81,1],[79,1],[76,1],[72,1],[74,1],[76,1],[77,1],[74,1],[72,4]],
    bass: [[48,2],[43,2],[48,2],[43,2],[41,2],[48,2],[41,2],[48,2],[48,2],[43,2],[45,2],[40,2],[43,2],[50,2],[48,2],[48,2]],
  },
  ice: {
    bpm: 120, melType: 'triangle',
    mel: [[79,1],[83,1],[86,1],[83,1],[81,2],[78,2],[79,1],[83,1],[86,1],[91,1],[90,4],
          [88,1],[86,1],[83,1],[79,1],[81,1],[83,1],[84,1],[81,1],[83,1],[79,1],[81,1],[78,1],[79,4]],
    bass: [[43,2],[50,2],[43,2],[50,2],[43,2],[50,2],[47,2],[50,2],[48,2],[52,2],[45,2],[50,2],[43,2],[50,2],[43,4]],
  },
  pumpkin: {
    bpm: 128,
    mel: [[69,1],[72,1],[76,1],[81,1],[80,2],[76,2],[77,1],[76,1],[74,1],[72,1],[71,2],[64,2],
          [69,1],[72,1],[76,1],[81,1],[83,1],[81,1],[80,1],[76,1],[77,1],[74,1],[71,1],[68,1],[69,4]],
    bass: [[45,2],[52,2],[45,2],[52,2],[41,2],[48,2],[40,2],[47,2],[45,2],[52,2],[45,2],[52,2],[41,2],[40,2],[45,4]],
  },
};
SONGS.title = SONGS.choco;
SONGS.boss = Object.assign({}, SONGS.pumpkin, { bpm: 168 });
SONGS.party = Object.assign({}, SONGS.choco, { bpm: 170 });

let song = null, seq = null;
function playSong(name) {
  if (!actx) { pendingSong = name; return; }
  if (song === SONGS[name] && seq) return;
  song = SONGS[name];
  seq = { t: [actx.currentTime + 0.1, actx.currentTime + 0.1], i: [0, 0] };
}
function stopMusic() { song = null; seq = null; pendingSong = null; }
setInterval(() => {
  if (!actx || !song || !seq) return;
  const eighth = 60 / song.bpm / 2;
  const now = actx.currentTime;
  [song.mel, song.bass].forEach((track, v) => {
    if (seq.t[v] < now - 0.3) seq.t[v] = now + 0.05;
    while (seq.t[v] < now + 0.2) {
      const [n, len] = track[seq.i[v] % track.length];
      if (n) {
        const f = 440 * Math.pow(2, (n - 69) / 12);
        const when = seq.t[v] - now;
        if (v === 0) tone(f, len * eighth * 0.9, song.melType || 'square', 0.35, null, when, musicBus);
        else tone(f, len * eighth * 0.95, 'triangle', 0.7, null, when, musicBus);
      }
      seq.t[v] += len * eighth;
      seq.i[v]++;
    }
  });
}, 40);

// ================================================================
// Helpers
// ================================================================
const rand = (n) => Math.random() * n;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function font(sz, w = 700) { return `${w} ${sz}px Fredoka, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`; }
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); }
function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2); }
function text(s, x, y, sz, col, align = 'center', stroke = null, sw = 5, weight = 700) {
  ctx.font = font(sz, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}
function wrap(str, maxW, sz) {
  ctx.font = font(sz, 600);
  const lines = [];
  let cur = '';
  for (const w of str.split(' ')) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
function overlap(a, b, inset = 0) {
  return a.x < b.x + b.w - inset && a.x + a.w > b.x + inset && a.y < b.y + b.h - inset && a.y + a.h > b.y + inset;
}
function heartPath(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.1, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x - s * 0.1, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x + s * 0.1, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.1, x, y, x, y + s * 0.35);
  ctx.closePath();
}
function starPath(x, y, ro, ri, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot - Math.PI / 2 + i * Math.PI / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
function signText(s) {
  if (typeof s === 'string') return s;
  return touchMode ? s.touch : s.keys;
}

// ================================================================
// Game state
// ================================================================
let state = 'title';     // title, hero, map, play, pause, clear, ending
let L = null;            // the current level
let hero = save.hero === 'axo' ? 'axo' : 'vamp';
let globalT = 0;
let uiButtons = [];
let uiFocus = 0;
let E = null;            // ending scene

function setState(s) {
  state = s;
  uiFocus = 0;
  if (s === 'title' || s === 'hero' || s === 'map') playSong('title');
  updateTouchUI();
}

// ================================================================
// Tiles & collisions
// ================================================================
function tileAt(tx, ty) {
  if (!L || ty < 0 || ty >= ROWS) return '.';
  if (tx < 0 || tx >= L.W) return '#';
  return L.grid[ty][tx];
}
const isSolidCh = (c) => c === '#' || c === '=' || c === 'I' || c === 'J' || c === 'D';
function isSolid(tx, ty) {
  if (tx < 0 || tx >= L.W) return true;
  if (ty < 0 || ty >= ROWS) return false;
  return isSolidCh(L.grid[ty][tx]);
}
function rectHitsSolid(x, y, w, h) {
  const l = Math.floor(x / T), r = Math.floor((x + w - 0.001) / T);
  const t = Math.floor(y / T), b = Math.floor((y + h - 0.001) / T);
  for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++) if (isSolid(tx, ty)) return true;
  return false;
}
// Move sideways, stop at walls. Returns true if we bumped something.
function moveX(e, dx) {
  if (!dx) return false;
  e.x += dx;
  const top = Math.floor(e.y / T), bot = Math.floor((e.y + e.h - 0.001) / T);
  if (dx > 0) {
    const tx = Math.floor((e.x + e.w - 0.001) / T);
    for (let ty = top; ty <= bot; ty++) {
      if (isSolid(tx, ty)) { e.x = tx * T - e.w; e.bumpTile = [tx, ty]; return true; }
    }
  } else {
    const tx = Math.floor(e.x / T);
    for (let ty = top; ty <= bot; ty++) {
      if (isSolid(tx, ty)) { e.x = (tx + 1) * T; e.bumpTile = [tx, ty]; return true; }
    }
  }
  return false;
}
// Move up/down, land on floors (and thin platforms when falling).
function moveY(e, dy, oneWay = true) {
  const prevBottom = e.y + e.h;
  e.onGround = false;
  e.groundIce = false;
  e.groundJelly = null;
  e.y += dy;
  const l = Math.floor(e.x / T), r = Math.floor((e.x + e.w - 0.001) / T);
  if (dy > 0) {
    const ty = Math.floor((e.y + e.h - 0.001) / T);
    let landed = false;
    for (let tx = l; tx <= r; tx++) {
      const c = tileAt(tx, ty);
      if (isSolid(tx, ty) || (oneWay && c === '-' && prevBottom <= ty * T + 0.01)) {
        landed = true;
        if (c === 'I') e.groundIce = true;
        if (c === 'J') e.groundJelly = [tx, ty];
      }
    }
    if (landed) { e.y = ty * T - e.h; e.vy = 0; e.onGround = true; }
    if (e.isPlayer && !landed) {
      for (const pl of L.plats) {
        if (e.x + e.w > pl.x + 2 && e.x < pl.x + pl.w - 2 && prevBottom <= pl.y + 0.5 && e.y + e.h >= pl.y) {
          e.y = pl.y - e.h; e.vy = 0; e.onGround = true; e.onPlat = pl;
          break;
        }
      }
    }
  } else if (dy < 0) {
    const ty = Math.floor(e.y / T);
    for (let tx = l; tx <= r; tx++) {
      if (isSolid(tx, ty)) { e.y = (ty + 1) * T; e.vy = 0; return; }
    }
    if (e.y < -8) { e.y = -8; e.vy = 0; }
  }
}

// ================================================================
// Level loading
// ================================================================
function loadLevel(i) {
  const def = LEVELS[i];
  const rows = Array(ROWS).fill('');
  for (const s of def.segments) s.forEach((row, r) => { rows[r] += row; });
  const W = rows[0].length;
  L = {
    i, def, W, theme: def.theme,
    grid: [], items: [], enemies: [], shots: [], plats: [], parts: [], texts: [], signs: [],
    checkpoints: [], exit: null, boss: null, total: 0, got: 0, keys: 0, star: false, squished: 0,
    time: 0, camX: 0, camY: 0, spawn: null, shake: 0, done: false, doneT: 0, gateX: null,
    introT: 170, jelly: {}, msg: null, doorHintT: 0,
  };
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < W; c++) {
      const ch = rows[r][c];
      let tile = '.';
      const cx = c * T + 16, bottom = (r + 1) * T;
      if ('#=I-~^JD'.includes(ch)) tile = ch;
      else if (ch === 'c') { L.items.push({ type: 'candy', x: cx, y: r * T + 16, color: CANDY_COLORS[(c + r) % CANDY_COLORS.length] }); L.total++; }
      else if (ch === 'K') L.items.push({ type: 'key', x: cx, y: r * T + 14 });
      else if (ch === 'R') L.items.push({ type: 'star', x: cx, y: r * T + 14 });
      else if (ch === 'H') L.items.push({ type: 'heart', x: cx, y: r * T + 16 });
      else if (ch === 'L') L.enemies.push(makeLemon(cx, bottom, false));
      else if (ch === 'O') L.enemies.push(makeLemon(cx, bottom, true));
      else if (ch === 'M' || ch === 'N' || ch === 'V') {
        tile = rows[r + 1] && rows[r + 1][c] === '~' ? '~' : '.';
        L.plats.push({ kind: ch, x0: c * T, y0: r * T, x: c * T, y: r * T, w: 3 * T, h: 14, dx: 0, dy: 0 });
      }
      else if (ch === 'F') L.checkpoints.push({ x: c * T, y: bottom, on: false });
      else if (ch === 'E') L.exit = { x: cx, y: bottom };
      else if (ch === 'B') L.boss = makeBoss(c, r);
      else if (ch === 'P') L.spawn = { x: cx, y: bottom };
      else if (ch >= '1' && ch <= '9') L.signs.push({ x: cx, y: bottom, text: def.signs[ch] || '' });
      row.push(tile);
    }
    L.grid.push(row);
  }
  L.player = makePlayer();
  respawn(true);
  L.camX = clamp(L.player.x - VW / 3, 0, L.W * T - VW);
  L.camY = ROWS * T - VH;
  playSong(def.song);
  setState('play');
}

function makePlayer() {
  return {
    isPlayer: true, x: 0, y: 0, w: SIZES.normal.w, h: SIZES.normal.h, vx: 0, vy: 0, face: 1,
    onGround: false, coyote: 0, jumpBuf: 0, form: 'normal', batFuel: 1, hearts: 3, inv: 0,
    anim: 0, onPlat: null, dead: 0, hidden: false, faint: false,
  };
}
function makeLemon(cx, bottom, hopper) {
  return {
    kind: 'lemon', hopper, x: cx - 13, y: bottom - 24, w: 26, h: 24,
    vx: hopper ? 0 : -0.7, vy: 0, face: -1, timer: 60 + Math.floor(rand(120)),
    state: 'walk', squishT: 0, anim: rand(100), onGround: false,
  };
}
function makeBoss(c, r) {
  const b = {
    x: c * T + 16 - 46, y: (r + 1) * T - 74, w: 92, h: 74, vx: 0, vy: 0, face: -1,
    state: 'sleep', t: 0, giggles: 0, actions: 0, say: null, sayT: 0, anim: 0, squash: 0,
    onGround: true, gateX: (c - 18) * T, triggerX: (c - 14) * T,
  };
  return b;
}

// ================================================================
// Player
// ================================================================
function setForm(p, form, force = false) {
  const s = SIZES[form];
  const cx = p.x + p.w / 2, bottom = p.y + p.h;
  const tries = [[0, 0], [-6, 0], [6, 0], [-12, 0], [12, 0], [0, s.h - p.h], [-6, s.h - p.h], [6, s.h - p.h]];
  for (const [ox, oy] of tries) {
    const nx = cx - s.w / 2 + ox, ny = bottom - s.h + oy;
    if (force || !rectHitsSolid(nx, ny, s.w, s.h)) {
      p.x = nx; p.y = ny; p.w = s.w; p.h = s.h; p.form = form;
      return true;
    }
  }
  return false;
}

function respawn(first = false) {
  const p = L.player;
  setForm(p, 'normal', true);
  p.x = L.spawn.x - p.w / 2;
  p.y = L.spawn.y - p.h;
  p.vx = 0; p.vy = 0;
  p.hidden = false; p.faint = false; p.dead = 0;
  p.onPlat = null;
  p.batFuel = 1;
  if (p.hearts <= 0 || first) p.hearts = 3;
  p.inv = first ? 0 : 90;
}

function floatText(x, y, s, color = '#fff', size = 18) {
  L.texts.push({ x, y, s, color, size, life: 70 });
}
function burst(x, y, colors, n = 12, speed = 3, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(Math.PI * 2), sp = speed * (0.4 + rand(0.8));
    L.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0),
      life: 30 + rand(25), max: 55, color: Array.isArray(colors) ? pick(colors) : colors,
      size: opts.size || 2 + rand(3), grav: opts.grav ?? 0.12, shape: opts.shape || 'circle',
    });
  }
  if (L.parts.length > 500) L.parts.splice(0, L.parts.length - 500);
}

function hurt(p, srcX) {
  if (p.inv > 0 || p.dead || L.done) return;
  p.hearts--;
  sfx.hurt();
  L.shake = 8;
  p.inv = 100;
  p.vx = (p.x + p.w / 2 < srcX ? -1 : 1) * 4;
  p.vy = -7;
  p.onPlat = null;
  burst(p.x + p.w / 2, p.y + p.h / 2, ['#ff5f7a', '#fff'], 10, 3);
  if (p.hearts <= 0) {
    p.dead = 80; p.faint = true; p.vx = 0; p.vy = -6;
    floatText(p.x + p.w / 2, p.y - 10, 'Oopsie! Try again!', '#fff', 20);
  }
}
function fallIn(p, what) {
  if (p.dead || L.done) return;
  sfx.splash();
  const colors = { choco: ['#6b3416', '#8f4a22'], ice: ['#ff9ec4', '#fff'], pumpkin: ['#5fd13a', '#a5f57a'] }[L.theme];
  burst(p.x + p.w / 2, p.y + p.h - 6, colors, 22, 4, { up: 3, size: 4 });
  p.hearts--;
  p.dead = 55; p.hidden = true; p.vx = 0; p.vy = 0;
  const words = { choco: 'SPLASH! 🍫', ice: 'SPLOOSH! 🥛', pumpkin: 'SLIME! 🟢' };
  floatText(p.x + p.w / 2, p.y - 20, what === 'fall' ? 'Wheee! Try again!' : words[L.theme], '#fff', 22);
}

function usePower(p) {
  if (hero === 'vamp') {
    if (p.form === 'bat') {
      if (setForm(p, 'normal')) { sfx.swap(); burst(p.x + p.w / 2, p.y + p.h / 2, ['#7a4bb0', '#2b1340'], 10, 2.5); }
      else { sfx.nope(); floatText(p.x + p.w / 2, p.y - 10, 'No room!'); }
    } else if (p.batFuel > 0.15) {
      setForm(p, 'bat', true);
      if (rectHitsSolid(p.x, p.y, p.w, p.h)) setForm(p, 'normal', true);
      else {
        p.vy = Math.min(p.vy, -2);
        sfx.bat();
        burst(p.x + p.w / 2, p.y + p.h / 2, ['#7a4bb0', '#2b1340', '#c4213a'], 16, 3);
      }
    } else {
      sfx.nope();
      floatText(p.x + p.w / 2, p.y - 10, 'Bat power is resting...');
    }
  } else {
    if (p.form === 'tiny') {
      if (setForm(p, 'normal')) { sfx.grow(); burst(p.x + p.w / 2, p.y + p.h / 2, ['#fff59d', '#ffb3d4', '#fff'], 14, 2.5, { shape: 'star' }); }
      else { sfx.nope(); floatText(p.x + p.w / 2, p.y - 12, 'No room to grow!'); }
    } else {
      setForm(p, 'tiny', true);
      sfx.shrink();
      burst(p.x + p.w / 2, p.y + p.h / 2, ['#fff59d', '#ffb3d4', '#fff'], 18, 3, { shape: 'star' });
    }
  }
}

function swapHero(p) {
  if (p.dead) return;
  if (p.form !== 'normal' && !setForm(p, 'normal')) {
    sfx.nope();
    floatText(p.x + p.w / 2, p.y - 10, 'No room to swap!');
    return;
  }
  hero = hero === 'vamp' ? 'axo' : 'vamp';
  save.hero = hero;
  persist();
  sfx.swap();
  burst(p.x + p.w / 2, p.y + p.h / 2, CANDY_COLORS, 20, 3.5, { shape: 'star' });
  floatText(p.x + p.w / 2, p.y - 14, HERO_NAMES[hero] + '!', '#fff', 20);
  updateTouchUI();
}

function updatePlayer(p) {
  p.anim++;
  if (p.inv > 0) p.inv--;
  if (p.dead > 0) {
    if (p.faint) { p.vy += 0.4; p.y += p.vy; }
    p.dead--;
    if (p.dead === 0) respawn();
    return;
  }

  // ride moving platforms
  if (p.onPlat) {
    const pl = p.onPlat;
    moveX(p, pl.dx);
    p.y = pl.y - p.h;
    if (rectHitsSolid(p.x, p.y, p.w, p.h)) { p.y += pl.dy > 0 ? 0 : 2; p.onPlat = null; }
  }

  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const bat = p.form === 'bat', tiny = p.form === 'tiny';
  const maxV = tiny ? 3.1 : bat ? 3.4 : 3.6;
  let accel, decel;
  if (p.onGround && p.groundIce) { accel = 0.09; decel = 0.03; }
  else if (p.onGround) { accel = 0.6; decel = 0.6; }
  else { accel = 0.4; decel = 0.15; }
  if (dir) {
    p.vx += dir * accel;
    p.vx = clamp(p.vx, -maxV, maxV);
    p.face = dir;
  } else if (p.vx > 0) p.vx = Math.max(0, p.vx - decel);
  else if (p.vx < 0) p.vx = Math.min(0, p.vx + decel);

  if (hit('jump')) p.jumpBuf = 8; else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.onGround) p.coyote = 6; else if (p.coyote > 0) p.coyote--;

  if (bat) {
    if (p.batFuel > 0 && inp.jump) p.vy = Math.max(p.vy - 0.7, -4.2);
    else p.vy = Math.min(p.vy + 0.22, 1.7);
    if (!p.onGround) p.batFuel = Math.max(0, p.batFuel - 1 / 210);
    if (p.batFuel <= 0 && setForm(p, 'normal')) {
      floatText(p.x + p.w / 2, p.y - 10, 'Bat time is up!');
      sfx.swap();
    }
  } else {
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = tiny ? -9.6 : -11.5;
      p.jumpBuf = 0; p.coyote = 0; p.onGround = false; p.onPlat = null; p.boost = false;
      sfx.jump();
    }
    if (p.boost && p.vy >= 0) p.boost = false;
    if (!inp.jump && !p.boost && p.vy < -3) p.vy += 0.7;   // short hop when you let go
    p.vy = Math.min(p.vy + 0.6, 11);
  }

  if (hit('power')) usePower(p);
  if (hit('swap')) swapHero(p);

  p.onPlat = null;
  const wasGround = p.onGround;
  if (moveX(p, p.vx)) {
    const [tx, ty] = p.bumpTile;
    if (tileAt(tx, ty) === 'D') touchDoor(p, tx, ty);
    p.vx = 0;
  }
  const vyBefore = p.vy;
  moveY(p, p.vy, true);
  if (L.gateX !== null && p.x < L.gateX) { p.x = L.gateX; p.vx = 0; }

  if (p.onGround) {
    if (p.groundJelly) {
      const [jx, jy] = p.groundJelly;
      L.jelly[jx + ',' + jy] = 20;
      p.vy = p.form === 'bat' ? -7 : -16;
      p.boost = true;
      p.onGround = false;
      sfx.bounce();
      burst(jx * T + 16, jy * T, ['#7ef0a0', '#fff'], 8, 2);
    } else if (!wasGround && vyBefore > 4) {
      burst(p.x + p.w / 2, p.y + p.h, ['rgba(255,255,255,.8)'], 5, 1.5, { grav: 0 });
    }
    if (p.form !== 'bat') p.batFuel = Math.min(1, p.batFuel + 0.02);
    if (p.form === 'bat' && p.batFuel <= 0.02) {
      if (setForm(p, 'normal')) sfx.swap();
    }
  }

  // hazards
  const l = Math.floor((p.x + 3) / T), r = Math.floor((p.x + p.w - 3) / T);
  const liquidRow = Math.floor((p.y + p.h - 6) / T);
  for (let tx = l; tx <= r; tx++) {
    if (tileAt(tx, liquidRow) === '~') { fallIn(p, 'liquid'); return; }
  }
  const t0 = Math.floor((p.y + 4) / T), t1 = Math.floor((p.y + p.h - 1) / T);
  const sl = Math.floor((p.x + 6) / T), sr = Math.floor((p.x + p.w - 6) / T);
  for (let ty = t0; ty <= t1; ty++) {
    for (let tx = sl; tx <= sr; tx++) {
      if (tileAt(tx, ty) === '^' && p.y + p.h > ty * T + 20) {
        hurt(p, p.vx > 0 ? p.x + p.w + 10 : p.vx < 0 ? p.x - 10 : tx * T + 16);
        if (!p.dead) p.vy = -9;
      }
    }
  }
  if (p.y > ROWS * T + 30) fallIn(p, 'fall');
}

function touchDoor(p, tx, ty) {
  if (L.keys > 0) {
    L.keys--;
    const st = [[tx, ty]];
    while (st.length) {
      const [x, y] = st.pop();
      if (tileAt(x, y) !== 'D') continue;
      L.grid[y][x] = '.';
      burst(x * T + 16, y * T + 16, ['#ffd34d', '#fff', '#8a4b2a'], 14, 3);
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    sfx.door();
    floatText(tx * T + 16, ty * T - 30, 'Secret door opened!', '#ffe066', 22);
  } else if (L.doorHintT <= 0) {
    sfx.nope();
    L.doorHintT = 120;
    floatText(tx * T + 16, ty * T - 30, 'Locked! Find a 🔑 key!', '#fff', 18);
  }
}

// ================================================================
// Level update
// ================================================================
function updatePlats() {
  for (const pl of L.plats) {
    const speed = pl.kind === 'V' ? 0.9 : 1.0;
    const range = (pl.kind === 'V' ? 6 : 5) * T;
    const travel = range / speed, pause = 40;
    const period = 2 * (travel + pause);
    const ph = L.time % period;
    let off;
    if (ph < pause) off = 0;
    else if (ph < pause + travel) off = (ph - pause) * speed;
    else if (ph < 2 * pause + travel) off = range;
    else off = range - (ph - 2 * pause - travel) * speed;
    const ox = pl.x, oy = pl.y;
    if (pl.kind === 'M') pl.x = pl.x0 + off;
    else if (pl.kind === 'N') pl.x = pl.x0 - off;
    else pl.y = pl.y0 - off;
    pl.dx = pl.x - ox; pl.dy = pl.y - oy;
  }
}

function updateEnemies() {
  const p = L.player;
  for (const e of L.enemies) {
    if (e.squishT > 0) { e.squishT--; if (e.squishT === 0) e.remove = true; continue; }
    if (!e.minion && Math.abs(e.x - (L.camX + VW / 2)) > VW + 120) continue;
    e.anim++;
    e.vy = Math.min(e.vy + 0.5, 10);
    if (e.hopper) {
      if (e.onGround) {
        e.vx = 0;
        if (--e.timer <= 0) {
          const dir = Math.sign(p.x - e.x) || e.face;
          e.face = dir; e.vy = -8; e.vx = dir * 1.3;
          e.timer = 60 + Math.floor(rand(60));
        }
      }
    } else if (e.state === 'puff') {
      e.vx = 0;
      if (--e.timer <= 0) {
        L.shots.push({ x: e.x + e.w / 2 + e.face * 12, y: e.y + 12, vx: e.face * 3.2, vy: -3.2, r: 5, life: 220 });
        sfx.spit();
        e.state = 'walk';
        e.timer = 150 + Math.floor(rand(90));
        e.vx = 0.7 * e.face;
      }
    } else {
      if (e.onGround) {
        if (e.vx === 0) e.vx = 0.7 * e.face;
        const ahead = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const tx = Math.floor(ahead / T);
        const below = tileAt(tx, Math.floor((e.y + e.h + 2) / T));
        const at = tileAt(tx, Math.floor((e.y + e.h - 4) / T));
        if (!(isSolidCh(below) || below === '-') || at === '^') e.vx = -e.vx;
      }
      if (e.vx) e.face = Math.sign(e.vx);
      if (--e.timer <= 0) {
        const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h / 2) - (e.y + e.h / 2);
        if (Math.abs(dx) < 330 && Math.abs(dy) < 150 && !p.dead && !L.done) {
          e.state = 'puff'; e.timer = 40; e.face = Math.sign(dx) || e.face;
        } else e.timer = 60;
      }
    }
    if (moveX(e, e.vx)) { e.vx = -e.vx; e.face = -e.face; }
    moveY(e, e.vy, true);
    if (L.gateX !== null && e.x < L.gateX) { e.x = L.gateX; e.vx = Math.abs(e.vx); }
    if (e.y > ROWS * T + 40 || tileAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h - 4) / T)) === '~') {
      e.remove = true;
      burst(e.x + e.w / 2, e.y + e.h / 2, ['#ffe14d', '#fff'], 10, 2);
      continue;
    }

    if (!p.dead && !L.done && overlap(p, e, 3)) {
      if (p.vy > 0 && (p.y + p.h) - e.y < 14 + p.vy) {
        e.squishT = 30;
        L.squished++;
        sfx.stomp();
        p.vy = inp.jump ? -11 : -7.5;
        p.y = e.y - p.h;
        burst(e.x + e.w / 2, e.y + e.h / 2, ['#ffe14d', '#fff7a8', '#fff'], 14, 3, { shape: 'star' });
        floatText(e.x + e.w / 2, e.y - 10, pick(['SQUISH!', 'SPLAT!', 'POP!', 'BOING!', 'SQUASH!']), '#fff36b', 20);
      } else {
        hurt(p, e.x + e.w / 2);
      }
    }
  }
  L.enemies = L.enemies.filter((e) => !e.remove);
}

function updateShots() {
  const p = L.player;
  for (const s of L.shots) {
    s.vy += s.seed ? 0.25 : 0.15;
    s.x += s.vx; s.y += s.vy;
    s.life--;
    if (isSolid(Math.floor(s.x / T), Math.floor(s.y / T)) || s.y > ROWS * T) {
      s.life = 0;
      burst(s.x, s.y, s.seed ? ['#fff3c4', '#f5d77a'] : ['#d4f542', '#fff36b'], 6, 1.5);
    }
    if (s.life > 0 && !p.dead && s.x > p.x - s.r && s.x < p.x + p.w + s.r && s.y > p.y - s.r && s.y < p.y + p.h + s.r) {
      s.life = 0;
      hurt(p, s.x);
    }
    if (L.time % 3 === 0 && !s.seed) L.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 14, max: 14, color: '#e6ff6b', size: 2.5, grav: 0, shape: 'circle' });
  }
  L.shots = L.shots.filter((s) => s.life > 0);
}

function updateItems() {
  const p = L.player;
  if (p.dead) return;
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
  for (const it of L.items) {
    if (it.taken) continue;
    if (Math.abs(pcx - it.x) < p.w / 2 + 12 && Math.abs(pcy - it.y) < p.h / 2 + 12) {
      it.taken = true;
      if (it.type === 'candy') {
        L.got++;
        sfx.candy();
        burst(it.x, it.y, [it.color, '#fff'], 6, 2, { shape: 'star' });
      } else if (it.type === 'key') {
        L.keys++;
        sfx.key();
        burst(it.x, it.y, ['#ffd34d', '#fff'], 20, 3.5, { shape: 'star' });
        floatText(it.x, it.y - 24, 'Golden lollipop key! 🔑', '#ffe066', 22);
      } else if (it.type === 'star') {
        L.star = true;
        sfx.star();
        L.shake = 6;
        burst(it.x, it.y, ['#ff5f5f', '#ffb84d', '#fff35f', '#5fe08a', '#5fc8ff', '#b77bff'], 50, 5, { shape: 'star', size: 4 });
        floatText(it.x, it.y - 30, '🌈 RAINBOW STAR! 🌈', '#fff', 26);
      } else if (it.type === 'heart') {
        p.hearts = Math.min(3, p.hearts + 1);
        sfx.heart();
        burst(it.x, it.y, ['#ff5f7a', '#fff'], 12, 2.5);
        floatText(it.x, it.y - 20, '+❤️', '#fff', 20);
      }
    }
  }
  for (const cp of L.checkpoints) {
    if (!cp.on && pcx > cp.x + 10 && pcy > cp.y - 160 && pcy < cp.y + 20) {
      cp.on = true;
      L.spawn = { x: cp.x + 16, y: cp.y };
      p.hearts = 3;
      sfx.check();
      burst(cp.x + 16, cp.y - 60, CANDY_COLORS, 20, 3, { shape: 'star' });
      floatText(cp.x + 16, cp.y - 80, 'Checkpoint! ❤️❤️❤️', '#fff', 20);
    }
  }
  for (const s of L.signs) s.near = Math.abs(pcx - s.x) < 70 && Math.abs(p.y + p.h - s.y) < 90;
  if (L.exit && !L.done && Math.abs(pcx - L.exit.x) < 26 && p.y + p.h > L.exit.y - 110) finishLevel();
}

function finishLevel() {
  if (L.done) return;
  L.done = true;
  L.doneT = 0;
  stopMusic();
  sfx.win();
  const p = L.player;
  if (p.form !== 'normal') setForm(p, 'normal', true);
  if (p.dead) respawn();
  burst(p.x + p.w / 2, p.y, CANDY_COLORS, 40, 5, { shape: 'star', size: 4 });
}

function updateVictory(p) {
  L.doneT++;
  p.anim++;
  p.vx = 0;
  p.vy = Math.min(p.vy + 0.6, 11);
  moveY(p, p.vy, true);
  if (p.onGround && L.doneT % 30 === 0 && L.doneT < 120) p.vy = -8;
  if (L.doneT % 12 === 0) burst(p.x + p.w / 2 + rand(200) - 100, p.y - 40 - rand(80), CANDY_COLORS, 10, 3, { shape: 'star' });
  if (L.doneT === 160) {
    save.unlocked = Math.max(save.unlocked, Math.min(3, L.i + 2));
    if (L.star) save.stars[L.i] = true;
    save.candies[L.i] = Math.max(save.candies[L.i] || 0, L.got);
    persist();
    setState('clear');
  }
}

function updateParticles() {
  for (const q of L.parts) { q.x += q.vx; q.y += q.vy; q.vy += q.grav; q.vx *= 0.98; q.life--; }
  L.parts = L.parts.filter((q) => q.life > 0);
  for (const t of L.texts) { t.y -= 0.8; t.life--; }
  L.texts = L.texts.filter((t) => t.life > 0);
  for (const k in L.jelly) { if (--L.jelly[k] <= 0) delete L.jelly[k]; }
  if (L.doorHintT > 0) L.doorHintT--;
}

function updateCamera(snap = false) {
  const p = L.player;
  const tx = clamp(p.x + p.w / 2 - VW / 2 + p.face * 50, 0, Math.max(0, L.W * T - VW));
  const ty = clamp(p.y + p.h / 2 - VH / 2 - 20, 0, ROWS * T - VH);
  if (snap) { L.camX = tx; L.camY = ty; return; }
  L.camX += (tx - L.camX) * 0.1;
  L.camY += (ty - L.camY) * 0.1;
  if (L.gateX !== null) L.camX = Math.max(L.camX, Math.min(L.gateX - 40, L.W * T - VW));
}

// ================================================================
// Sir Pumpkin Pants (the boss)
// ================================================================
const BOSS_INTRO = [
  "Hee hee hee! I'm SIR PUMPKIN PANTS! 🎃 King of the Pumpkin Patch!",
  "Nobody can tickle ME! I'm NOT ticklish! ...Probably.",
];
const BOSS_TAUNTS = [
  "I'm the gourd-geous king of Candy World!",
  'My breath smells like candy corn! HAAAH!',
  "Boing boing! I'm a bouncy pumpkin!",
  'Lemon drops, ATTACK! ...Please?',
  "Don't you DARE tickle my stem!",
  'I ate 47 candies for breakfast. And a sock.',
  "I'm not round! I'm PUMPKIN-SHAPED!",
  'Nyeh nyeh! You can\'t catch me!',
];
const BOSS_TICKLES = [
  'Hee! STOP! That was just a hiccup!',
  'Ha ha ha! My seeds are giggling!',
  "HAHAHA! I'm laughing so hard my stem is spinning!",
  'HOO HOO HEE! I think I just tooted pumpkin pie!',
  "BWAHAHA! OKAY OKAY! YOU WIN! I'll be NICE!",
];
const BOSS_BUMPS = ["Tag! You're IT!", 'Oopsie doodle!', 'Pumpkin bump!', 'Excuse me!'];
const BOSS_NICE = [
  "Can we be friends? I'm a big softie inside!",
  "Like, REALLY soft. I'm full of goo. 🎃",
  "LET'S HAVE A CANDY PARTY!!!",
];

function bossSay(b, s, t = 150) { b.say = s; b.sayT = t; }

function updateBoss() {
  const b = L.boss;
  if (!b) return;
  const p = L.player;
  b.anim++;
  if (b.sayT > 0) b.sayT--;
  if (b.state === 'sleep') {
    if (p.x > b.triggerX && !p.dead) {
      b.state = 'intro'; b.t = 0;
      L.gateX = b.gateX;
      L.spawn = { x: b.gateX + T * 2 + 16, y: 12 * T };
      bossSay(b, BOSS_INTRO[0], 150);
      playSong('boss');
      sfx.thump();
      L.shake = 10;
    }
    return;
  }
  b.t++;
  const wasAir = !b.onGround;
  b.vy = Math.min(b.vy + 0.5, 12);
  if (moveX(b, b.vx)) b.vx = -b.vx * 0.6;
  moveY(b, b.vy, false);
  if (b.x < L.gateX) { b.x = L.gateX; b.vx = Math.abs(b.vx); }
  if (b.onGround && wasAir) {
    L.shake = 7;
    sfx.thump();
    b.squash = 12;
    burst(b.x + b.w / 2, b.y + b.h, ['#7a5a3a', '#a07850'], 12, 3, { up: 1 });
    if (b.state === 'air') { b.state = 'idle'; b.t = 0; }
    b.vx = 0;
  }
  if (b.squash > 0) b.squash--;
  const dirToPlayer = Math.sign((p.x + p.w / 2) - (b.x + b.w / 2)) || -1;

  switch (b.state) {
    case 'intro':
      b.face = dirToPlayer;
      if (b.t === 150) bossSay(b, BOSS_INTRO[1], 160);
      if (b.t >= 300) { b.state = 'idle'; b.t = 0; }
      break;
    case 'idle': {
      b.face = dirToPlayer;
      const wait = Math.max(40, 95 - b.giggles * 12);
      if (b.t >= wait && b.onGround) {
        b.actions++;
        b.t = 0;
        if (b.actions % 3 === 0) b.state = 'spit';
        else {
          b.state = 'air';
          b.vy = -(10 + b.giggles * 0.5);
          b.vx = dirToPlayer * (1.8 + b.giggles * 0.35 + rand(0.8));
          b.onGround = false;
          sfx.bounce();
        }
      } else if (b.sayT <= 0 && Math.random() < 0.006) bossSay(b, pick(BOSS_TAUNTS), 140);
      break;
    }
    case 'spit':
      b.face = dirToPlayer;
      if (b.t === 45) {
        const minions = L.enemies.filter((e) => e.minion && !e.squishT).length;
        if (minions < 2) {
          const e = makeLemon(b.x + b.w / 2, b.y + 50, false);
          e.minion = true; e.vx = b.face * 1.2; e.vy = -6; e.face = b.face; e.timer = 120;
          L.enemies.push(e);
        } else {
          for (const k of [-1, 0, 1]) L.shots.push({ x: b.x + b.w / 2, y: b.y + 45, vx: b.face * (2.6 + k * 0.9), vy: -6 + Math.abs(k), r: 5, seed: true, life: 240 });
        }
        sfx.spit();
      }
      if (b.t >= 80) { b.state = 'idle'; b.t = 0; }
      break;
    case 'laugh':
      if (b.t % 20 === 0) floatText(b.x + b.w / 2 + rand(80) - 40, b.y - 10, pick(['HA!', 'HEE!', 'HO HO!', 'HA HA!']), '#ffe066', 18);
      if (b.t >= 110) { b.state = 'idle'; b.t = 0; }
      break;
    case 'nice':
      if (b.t % 15 === 0) burst(b.x + b.w / 2 + rand(120) - 60, b.y + rand(60), ['#ff8fc7', '#ffe066', '#fff'], 6, 2, { shape: 'star' });
      if (b.t === 160) bossSay(b, BOSS_NICE[0], 150);
      if (b.t === 310) bossSay(b, BOSS_NICE[1], 140);
      if (b.t === 450) bossSay(b, BOSS_NICE[2], 150);
      if (b.t >= 600) startEnding();
      break;
  }

  if (p.dead || L.done || b.state === 'nice') return;
  if (overlap(p, b, 6)) {
    const feet = p.y + p.h;
    const fromAbove = p.vy > 0 && feet < b.y + b.h * 0.55;
    if (fromAbove) {
      p.vy = -12;
      p.boost = true;
      p.y = b.y - p.h;
      p.vx = (p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1) * 3;
      if (b.state === 'laugh') return;
      b.giggles++;
      sfx.giggle();
      L.shake = 6;
      burst(b.x + b.w / 2, b.y + 10, ['#ffe066', '#ff8a1f', '#fff'], 20, 4, { shape: 'star' });
      if (b.giggles >= 5) {
        b.state = 'nice'; b.t = 0; b.vx = 0;
        bossSay(b, BOSS_TICKLES[4], 160);
        stopMusic();
        sfx.win();
        for (const e of L.enemies) {
          if (!e.squishT) { e.remove = true; burst(e.x + e.w / 2, e.y + e.h / 2, ['#ff8fc7', '#fff'], 10, 2); }
        }
        L.shots = [];
      } else {
        b.state = 'laugh'; b.t = 0; b.vx *= 0.3;
        bossSay(b, BOSS_TICKLES[b.giggles - 1], 130);
      }
    } else if (b.state !== 'laugh' && p.inv <= 0) {
      hurt(p, b.x + b.w / 2);
      if (b.sayT <= 0 || Math.random() < 0.5) bossSay(b, pick(BOSS_BUMPS), 90);
    }
  }
}

// ================================================================
// The ending party!
// ================================================================
function startEnding() {
  save.won = true;
  save.unlocked = 3;
  if (L.star) save.stars[L.i] = true;
  save.candies[L.i] = Math.max(save.candies[L.i] || 0, L.got);
  persist();
  E = { t: 0, parts: [], rockets: [], cakeY: -260, cakeVy: 0, cakeLanded: false, shake: 0 };
  playSong('party');
  setState('ending');
}
function updateEnding() {
  E.t++;
  if (E.shake > 0) E.shake--;
  if (E.t % 28 === 0) {
    E.rockets.push({ x: 60 + rand(VW - 120), y: VH, vy: -7 - rand(3), boomY: 60 + rand(150), color: pick(CANDY_COLORS) });
  }
  for (const r of E.rockets) {
    r.y += r.vy;
    if (r.y <= r.boomY) {
      r.done = true;
      sfx.firework();
      const n = 36;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, sp = 2.5 + rand(1.5);
        E.parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 60 + rand(20), color: i % 3 ? r.color : '#fff', size: 3, shape: i % 4 ? 'circle' : 'star' });
      }
    } else E.parts.push({ x: r.x, y: r.y, vx: 0, vy: 0.5, life: 14, color: '#ffe9a8', size: 2, shape: 'circle' });
  }
  E.rockets = E.rockets.filter((r) => !r.done);
  if (E.t >= 330 && !E.cakeLanded) {
    E.cakeVy += 0.5;
    E.cakeY += E.cakeVy;
    if (E.cakeY >= 0) {
      E.cakeY = 0;
      if (E.cakeVy > 3) { E.cakeVy = -E.cakeVy * 0.35; E.shake = 18; sfx.boom(); for (let i = 0; i < 40; i++) E.parts.push({ x: VW * 0.62 + rand(140) - 70, y: 330, vx: rand(8) - 4, vy: -rand(8), life: 70, color: pick(CANDY_COLORS), size: 4, shape: 'rect' }); }
      else { E.cakeLanded = true; E.cakeVy = 0; }
    }
  }
  if (E.t === 140) arp([784, 988, 1175, 1568, 1975], 0.08, 'triangle', 0.15);
  for (const q of E.parts) { q.x += q.vx; q.y += q.vy; q.vy += 0.06; q.vx *= 0.985; q.life--; }
  E.parts = E.parts.filter((q) => q.life > 0);
  if (E.parts.length > 700) E.parts.splice(0, E.parts.length - 700);
}

// ================================================================
// Main loop
// ================================================================
function update() {
  pollInput();
  globalT++;
  if (hit('pause')) {
    if (state === 'play') { setState('pause'); return; }
    if (state === 'pause') { setState('play'); return; }
  }
  if (state === 'play') {
    L.time++;
    if (L.introT > 0) L.introT--;
    updatePlats();
    if (L.done) updateVictory(L.player); else updatePlayer(L.player);
    updateEnemies();
    updateShots();
    updateItems();
    updateBoss();
    updateParticles();
    if (state === 'play') updateCamera();
    if (L && L.shake > 0) L.shake--;
  } else {
    if (state === 'ending') updateEnding();
    updateMenuInput();
  }
}

function updateMenuInput() {
  if (state === 'title') {
    if (hit('jump') || hit('enter')) { sfx.click(); setState('hero'); }
    return;
  }
  const n = uiButtons.length;
  if (!n) return;
  if (hit('left')) uiFocus = (uiFocus - 1 + n) % n;
  if (hit('right') || hit('down')) uiFocus = (uiFocus + 1) % n;
  if (hit('enter') || hit('jump')) {
    const b = uiButtons[clamp(uiFocus, 0, n - 1)];
    if (b) { sfx.click(); b.cb(); }
  }
}

let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(100, now - last);
  last = now;
  try {
    while (acc >= 1000 / 60) { if (!window.__srh.freeze) update(); acc -= 1000 / 60; }
    render();
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'play') setState('pause');
    if (actx) actx.suspend();
  } else if (actx) actx.resume();
});

// ================================================================
// Drawing — characters
// ================================================================
function drawVampire(x, y, face, t, run, air, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * s * 0.86, s * 0.86);
  const sw = run ? Math.sin(t * 0.3) * 5 : 0;
  const flap = run ? Math.sin(t * 0.3) * 3 : Math.sin(t * 0.05) * 1;
  // cape
  ctx.fillStyle = '#c4213a';
  ctx.beginPath(); ctx.moveTo(-8, -31); ctx.lineTo(7, -31); ctx.lineTo(5, -4); ctx.lineTo(-15 - flap, -2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2b1340';
  ctx.beginPath(); ctx.moveTo(-7, -31); ctx.lineTo(7, -31); ctx.lineTo(4, -5); ctx.lineTo(-13 - flap, -4); ctx.closePath(); ctx.fill();
  // legs
  ctx.fillStyle = '#26263a';
  if (air) { rr(-6, -12, 5, 9, 2); ctx.fill(); rr(1, -13, 5, 9, 2); ctx.fill(); }
  else { rr(-6 + sw * 0.6, -12, 5, 12, 2); ctx.fill(); rr(1 - sw * 0.6, -12, 5, 12, 2); ctx.fill(); }
  ctx.fillStyle = '#111';
  if (!air) { rr(-7 + sw * 0.6, -3, 7, 3, 1.5); ctx.fill(); rr(0 - sw * 0.6, -3, 7, 3, 1.5); ctx.fill(); }
  // body
  ctx.fillStyle = '#33334d'; rr(-8, -29, 16, 19, 5); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-3, -29); ctx.lineTo(4, -29); ctx.lineTo(0.5, -20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e0233f'; ctx.beginPath(); ctx.moveTo(0.5, -26); ctx.lineTo(-3, -28); ctx.lineTo(-3, -24); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0.5, -26); ctx.lineTo(4, -28); ctx.lineTo(4, -24); ctx.closePath(); ctx.fill();
  // arm
  ctx.fillStyle = '#33334d'; rr(3 - sw * 0.4, -26, 5, 11, 2.5); ctx.fill();
  ctx.fillStyle = '#eef0ff'; circle(5.5 - sw * 0.4, -14.5, 2.6); ctx.fill();
  // collar
  ctx.fillStyle = '#c4213a';
  ctx.beginPath(); ctx.moveTo(-11, -29); ctx.lineTo(-13, -45); ctx.lineTo(-5, -33); ctx.closePath(); ctx.fill();
  // head
  ctx.fillStyle = '#eef0ff'; circle(1, -39, 11); ctx.fill();
  ctx.strokeStyle = '#c9c9e8'; ctx.lineWidth = 1; ctx.stroke();
  // hair
  ctx.fillStyle = '#1b1b2b';
  ctx.beginPath();
  ctx.moveTo(-10.5, -40);
  ctx.arc(1, -40, 11.6, Math.PI, Math.PI * 2);
  ctx.lineTo(12.6, -41); ctx.lineTo(6, -43); ctx.lineTo(2, -36.5); ctx.lineTo(-2, -43); ctx.lineTo(-10.5, -38);
  ctx.closePath(); ctx.fill();
  // eyes
  const blink = (Math.floor(t / 6) % 40) === 0;
  for (const ex of [0, 6.5]) {
    if (blink) { ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ex - 2.5, -38); ctx.lineTo(ex + 2.5, -38); ctx.stroke(); continue; }
    ctx.fillStyle = '#fff'; circle(ex, -38, 3.3); ctx.fill();
    ctx.fillStyle = '#8a1030'; circle(ex + 0.9, -37.6, 1.9); ctx.fill();
    ctx.fillStyle = '#fff'; circle(ex + 1.5, -38.5, 0.7); ctx.fill();
  }
  // cheeks + smile + fangs
  ctx.fillStyle = 'rgba(255,120,170,.45)'; circle(9.5, -34, 2.2); ctx.fill(); circle(-3, -34, 2); ctx.fill();
  ctx.strokeStyle = '#4a2340'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(3.5, -34, 3.2, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(1.6, -31.3); ctx.lineTo(2.6, -29); ctx.lineTo(3.4, -31.1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4.2, -31.1); ctx.lineTo(5, -29); ctx.lineTo(6, -31.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBat(x, y, face, t, fuel, s = 1) {
  ctx.save();
  ctx.translate(x, y - 17 * s);
  ctx.scale(face * s, s);
  const flap = Math.sin(t * 0.5);
  ctx.fillStyle = '#5b3a7d';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 5, -4);
    ctx.quadraticCurveTo(side * 16, -14 - flap * 8, side * 27, -8 - flap * 12);
    ctx.quadraticCurveTo(side * 23, -1 - flap * 6, side * 20, 2 - flap * 4);
    ctx.quadraticCurveTo(side * 16, -2, side * 13, 4 - flap * 2);
    ctx.quadraticCurveTo(side * 9, 0, side * 5, 5);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#3b2457'; ellipse(0, 0, 10, 11); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-7, -16); ctx.lineTo(-2, -9); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(7, -16); ctx.lineTo(2, -9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; circle(-3.5, -2, 3.2); ctx.fill(); circle(4, -2, 3.2); ctx.fill();
  ctx.fillStyle = '#c4213a'; circle(-2.7, -1.6, 1.7); ctx.fill(); circle(4.8, -1.6, 1.7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(-1, 7); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1.5, 4); ctx.lineTo(2.5, 7); ctx.lineTo(3.5, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  // fuel ring
  if (fuel !== undefined && fuel < 1) {
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y - 52, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = fuel > 0.3 ? '#b88aff' : '#ff6b8a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y - 52, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fuel); ctx.stroke();
  }
}

function drawAxolotl(x, y, face, t, run, air, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * s * 0.9, s * 0.9);
  const sw = run ? Math.sin(t * 0.3) * 4 : 0;
  const wig = Math.sin(t * 0.12) * 0.15;
  const pink = '#ffb3d4', dark = '#ff5c9e';
  // tail
  ctx.fillStyle = '#ff9ec9';
  ctx.beginPath();
  ctx.moveTo(-6, -16);
  ctx.quadraticCurveTo(-22, -16 + Math.sin(t * 0.15) * 4, -24, -6);
  ctx.quadraticCurveTo(-16, -6, -5, -7);
  ctx.closePath(); ctx.fill();
  // legs
  ctx.fillStyle = '#ff9ec9';
  if (air) { ellipse(-4, -4, 4, 3); ctx.fill(); ellipse(5, -4, 4, 3); ctx.fill(); }
  else { ellipse(-4 + sw, -2.5, 4.5, 3); ctx.fill(); ellipse(5 - sw, -2.5, 4.5, 3); ctx.fill(); }
  // body
  ctx.fillStyle = pink; ellipse(0, -14, 10, 11); ctx.fill();
  ctx.fillStyle = '#ffe0ee'; ellipse(2, -12, 6, 7); ctx.fill();
  // arm
  ctx.fillStyle = '#ff9ec9'; ellipse(6 - sw * 0.4, -14, 3, 5, 0.4); ctx.fill();
  // gills
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const gy = -40 + i * 6;
      const ang = side * (0.5 - i * 0.45) + wig * side;
      ctx.save();
      ctx.translate(2 + side * 13, gy);
      ctx.rotate(ang + (side < 0 ? Math.PI : 0));
      ctx.fillStyle = dark; ellipse(5, 0, 6.5, 2.6); ctx.fill();
      ctx.fillStyle = '#ff86b8'; circle(9, 0, 1.6); ctx.fill(); circle(5, 0, 1.3); ctx.fill();
      ctx.restore();
    }
  }
  // head
  ctx.fillStyle = pink; ellipse(2, -33, 14.5, 11.5); ctx.fill();
  // eyes
  const blink = (Math.floor(t / 7) % 35) === 0;
  for (const ex of [-4, 8]) {
    if (blink) { ctx.strokeStyle = '#3a1028'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ex - 2.5, -35); ctx.lineTo(ex + 2.5, -35); ctx.stroke(); continue; }
    ctx.fillStyle = '#2a0f20'; circle(ex, -35, 2.9); ctx.fill();
    ctx.fillStyle = '#fff'; circle(ex + 0.9, -36, 1.1); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,100,160,.5)'; circle(-7, -30, 2.4); ctx.fill(); circle(12, -30, 2.4); ctx.fill();
  ctx.strokeStyle = '#c2185b'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(2, -32, 5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  ctx.restore();
}

function drawLemon(e) {
  const cx = e.x + e.w / 2, by = e.y + e.h;
  ctx.save();
  ctx.translate(cx, by);
  if (e.squishT > 0) {
    ctx.scale(1.3, 0.35);
    ctx.globalAlpha = Math.min(1, e.squishT / 15);
  } else {
    const bob = e.onGround ? Math.abs(Math.sin(e.anim * 0.2)) * 1.5 : 0;
    ctx.translate(0, -bob);
    if (e.state === 'puff') { const k = 1 + (40 - e.timer) / 160; ctx.scale(k, 1 / k * 1.05); }
  }
  ctx.scale(e.face, 1);
  if (e.hopper) {
    ctx.fillStyle = '#4fbf3a';
    ctx.beginPath(); ctx.ellipse(-2, -24, 6, 3, -0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#f2c200'; circle(-14, -12, 3.2); ctx.fill(); circle(14, -12, 3.2); ctx.fill();
  ctx.fillStyle = '#ffe14d'; ellipse(0, -12, 14, 11.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ellipse(-5, -17, 5, 2.5, -0.4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < 5; i++) { circle(-8 + i * 4, -4 - (i % 2) * 14, 0.8); ctx.fill(); }
  if (e.squishT > 0) {
    ctx.strokeStyle = '#5a3a00'; ctx.lineWidth = 2;
    for (const ex of [-4, 5]) { ctx.beginPath(); ctx.moveTo(ex - 3, -16); ctx.lineTo(ex + 3, -10); ctx.moveTo(ex + 3, -16); ctx.lineTo(ex - 3, -10); ctx.stroke(); }
  } else {
    ctx.fillStyle = '#fff'; circle(-1, -13, 3.6); ctx.fill(); circle(7, -13, 3.6); ctx.fill();
    ctx.fillStyle = '#3a2a00'; circle(0.3, -12.5, 2); ctx.fill(); circle(8.3, -12.5, 2); ctx.fill();
    ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4.5, -19); ctx.lineTo(2, -16.5); ctx.moveTo(10.5, -19); ctx.lineTo(4.5, -16.5); ctx.stroke();
    if (e.state === 'puff') { ctx.fillStyle = '#7a4a00'; circle(4, -6, 2.5); ctx.fill(); }
    else { ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(4, -3.5, 3.5, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
  }
  ctx.restore();
}

function drawHappyLemon(x, y, t, phase, s = 1) {
  const hop = Math.abs(Math.sin(t * 0.12 + phase)) * 22;
  ctx.save();
  ctx.translate(x, y - hop);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(t * 0.12 + phase) * 0.25);
  ctx.fillStyle = '#f2c200'; circle(-14, -12, 3.2); ctx.fill(); circle(14, -12, 3.2); ctx.fill();
  ctx.fillStyle = '#ffe14d'; ellipse(0, -12, 14, 11.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ellipse(-5, -17, 5, 2.5, -0.4); ctx.fill();
  ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-4, -13, 2.5, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(4, -13, 2.5, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -8, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,150,.5)'; circle(-8, -9, 2.2); ctx.fill(); circle(8, -9, 2.2); ctx.fill();
  // party hat
  ctx.fillStyle = CANDY_COLORS[Math.floor(phase * 10) % CANDY_COLORS.length];
  ctx.beginPath(); ctx.moveTo(-6, -21); ctx.lineTo(6, -21); ctx.lineTo(1, -36); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; circle(1, -36, 2.5); ctx.fill();
  ctx.restore();
}

function drawPumpkin(cx, by, mood, t, opts = {}) {
  // mood: 'mean' | 'puff' | 'laugh' | 'nice'
  ctx.save();
  ctx.translate(cx, by);
  let sx = 1, sy = 1;
  if (opts.squash) { sx = 1 + opts.squash * 0.02; sy = 1 - opts.squash * 0.02; }
  if (mood === 'puff') { sx *= 1.08; sy *= 0.96; }
  if (mood === 'laugh') { ctx.rotate(Math.sin(t * 0.8) * 0.06); sy *= 1 + Math.sin(t * 0.9) * 0.04; }
  const sz = opts.size || 1;
  ctx.scale(sx * (opts.face || 1) * sz, sy * sz);
  const glow = mood === 'nice' ? '#fff3a0' : '#ffe866';
  // body lobes
  ctx.fillStyle = '#d9600a';
  ellipse(-30, -42, 20, 38); ctx.fill(); ellipse(30, -42, 20, 38); ctx.fill();
  ctx.fillStyle = '#f07a16';
  ellipse(-18, -43, 26, 42); ctx.fill(); ellipse(18, -43, 26, 42); ctx.fill();
  ctx.fillStyle = '#ff8f22';
  ellipse(0, -44, 26, 44); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ellipse(-12, -66, 8, 14, -0.3); ctx.fill();
  // stem + leaf
  ctx.fillStyle = '#4c8a2a'; rr(-6, -98, 12, 18, 4); ctx.fill();
  ctx.fillStyle = '#6cc04a';
  ctx.beginPath(); ctx.ellipse(16, -90, 12, 6, -0.4 + Math.sin(t * 0.1) * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6cc04a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -84); ctx.bezierCurveTo(-18, -86, -20, -100, -10, -104); ctx.stroke();
  // face
  ctx.fillStyle = glow;
  ctx.shadowColor = glow; ctx.shadowBlur = mood === 'nice' ? 6 : 14;
  if (mood === 'laugh') {
    ctx.strokeStyle = glow; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-15, -54, 8, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(15, -54, 8, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-24, -36); ctx.quadraticCurveTo(0, -36, 24, -36); ctx.quadraticCurveTo(0, 2, -24, -36); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff6b8a'; ellipse(0, -22, 9, 5); ctx.fill();
  } else if (mood === 'nice') {
    ctx.strokeStyle = '#7a2d00'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(-15, -52, 7, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(15, -52, 7, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -38, 15, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,90,140,.55)'; circle(-26, -38, 6); ctx.fill(); circle(26, -38, 6); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-24, -48); ctx.lineTo(-6, -48); ctx.lineTo(-14, -64); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, -48); ctx.lineTo(6, -48); ctx.lineTo(14, -64); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, -38); ctx.lineTo(4, -38); ctx.lineTo(0, -45); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-26, -30);
    const teeth = [[-20, -26], [-15, -32], [-9, -24], [-3, -31], [3, -24], [9, -31], [15, -24], [20, -31], [26, -30]];
    for (const [tx, ty] of teeth) ctx.lineTo(tx, ty);
    ctx.quadraticCurveTo(0, mood === 'puff' ? -2 : -8, -26, -30);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ================================================================
// Drawing — world
// ================================================================
const THEMES = {
  choco: {
    sky: ['#ffc8e4', '#fff0d6'], ground: '#9a5530', groundDark: '#7a3f20', top: '#ff8cc6', drip: '#ff6fb5',
    block: '#ff7eb9', blockHi: '#ffd1e8', liquid: '#6b3416', liquidTop: '#94512a', plank: '#f2c27a', plankLine: '#c9944a',
    plat: '#5a2a10', platTop: '#7a3d1c', jelly: '#7ef0a0',
  },
  ice: {
    sky: ['#9fd8ff', '#effaff'], ground: '#9ff0cf', groundDark: '#74d8b0', top: '#fffaf0', drip: '#ffffff',
    block: '#ffb3c7', blockHi: '#ffe3ec', liquid: '#ff8fbd', liquidTop: '#ffc4dc', plank: '#e8b46a', plankLine: '#b9813b',
    plat: '#d99b4e', platTop: '#f0c27b', jelly: '#8fd8ff',
  },
  pumpkin: {
    sky: ['#1a0f3a', '#4d2468'], ground: '#4f2f2c', groundDark: '#3a201e', top: '#3fa34d', drip: '#2e7d3a',
    block: '#e8772e', blockHi: '#ffb067', liquid: '#4fc232', liquidTop: '#a5f57a', plank: '#9a6a40', plankLine: '#6b4424',
    plat: '#6b3f22', platTop: '#9a6a40', jelly: '#c18bff',
  },
};

function drawBackground(theme, camX, t) {
  const th = THEMES[theme];
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);
  const each = (factor, spacing, fn) => {
    const off = camX * factor;
    const i0 = Math.floor((off - 200) / spacing), i1 = Math.floor((off + VW + 200) / spacing);
    for (let i = i0; i <= i1; i++) fn(i * spacing - off, i);
  };
  const hills = (factor, base, amp, freq, color) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, VH);
    for (let x = 0; x <= VW + 20; x += 20) {
      const wx = x + camX * factor;
      ctx.lineTo(x, base - Math.sin(wx * freq) * amp - Math.sin(wx * freq * 2.3 + 1) * amp * 0.4);
    }
    ctx.lineTo(VW + 20, VH); ctx.closePath(); ctx.fill();
  };
  if (theme === 'choco') {
    each(0.08, 320, (x, i) => {
      const y = 50 + hash(i, 3) * 80;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let k = 0; k < 4; k++) { circle(x + k * 22, y + (k % 2) * -8, 20 - Math.abs(k - 1.5) * 3); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,190,225,.6)'; circle(x + 30, y + 8, 14); ctx.fill();
    });
    hills(0.15, 300, 40, 0.006, '#f2b3dd');
    hills(0.3, 340, 30, 0.01, '#e895c8');
    each(0.45, 230, (x, i) => {
      const h = 90 + hash(i, 5) * 60, r = 20 + hash(i, 6) * 10;
      const bx = x + hash(i, 7) * 80;
      ctx.fillStyle = '#fff'; ctx.fillRect(bx - 3, 380 - h, 6, h);
      ctx.fillStyle = CANDY_COLORS[Math.abs(i) % CANDY_COLORS.length];
      circle(bx, 380 - h, r); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.3) ctx.lineTo(bx + Math.cos(a + t * 0.01) * a * r / 12, 380 - h + Math.sin(a + t * 0.01) * a * r / 12);
      ctx.stroke();
    });
  } else if (theme === 'ice') {
    each(0.12, 260, (x, i) => {
      const h = 160 + hash(i, 2) * 90, w = 150 + hash(i, 9) * 60;
      ctx.fillStyle = '#c9e6ff';
      ctx.beginPath(); ctx.moveTo(x - w / 2, 420); ctx.lineTo(x, 420 - h); ctx.lineTo(x + w / 2, 420); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(x - w * 0.17, 420 - h * 0.66);
      for (let k = 0; k <= 4; k++) ctx.lineTo(x - w * 0.17 + k * w * 0.085, 420 - h * 0.66 + (k % 2 ? 10 : 0));
      ctx.lineTo(x, 420 - h); ctx.closePath(); ctx.fill();
    });
    hills(0.25, 350, 25, 0.008, '#dff1ff');
    each(0.4, 300, (x, i) => {
      const bx = x + hash(i, 4) * 100, top = 250 + hash(i, 8) * 40;
      ctx.fillStyle = '#f0c27b';
      ctx.beginPath(); ctx.moveTo(bx - 26, top); ctx.lineTo(bx + 26, top); ctx.lineTo(bx, top + 120); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d29b52'; ctx.lineWidth = 2;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(bx - 26 + k * 10, top); ctx.lineTo(bx - 4 + k * 3, top + 60); ctx.stroke(); }
      const cols = ['#ffb3c7', '#b5f2d6', '#fff4d6', '#d9c2ff'];
      ctx.fillStyle = cols[Math.abs(i) % 4]; circle(bx, top - 8, 30); ctx.fill();
      ctx.fillStyle = cols[Math.abs(i + 1) % 4]; circle(bx, top - 40, 24); ctx.fill();
      ctx.fillStyle = '#e8304a'; circle(bx, top - 66, 7); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let k = 0; k < 45; k++) {
      const x = ((hash(k, 1) * VW * 1.3 + t * (0.3 + hash(k, 2) * 0.5) - camX * 0.2) % (VW + 20) + VW + 20) % (VW + 20) - 10;
      const y = (hash(k, 3) * VH + t * (0.6 + hash(k, 4) * 0.8)) % VH;
      circle(x, y, 1.5 + hash(k, 5) * 2); ctx.fill();
    }
  } else {
    for (let k = 0; k < 60; k++) {
      const x = ((hash(k, 11) * VW * 2 - camX * 0.03) % VW + VW) % VW, y = hash(k, 12) * 260;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.03 + k));
      ctx.fillStyle = '#fff'; circle(x, y, 1 + hash(k, 13) * 1.4); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const mx = VW * 0.78 - camX * 0.02;
    ctx.fillStyle = 'rgba(255,250,210,.15)'; circle(mx, 90, 70); ctx.fill();
    ctx.fillStyle = '#fff6cf'; circle(mx, 90, 42); ctx.fill();
    ctx.fillStyle = 'rgba(220,210,170,.6)'; circle(mx - 12, 80, 7); ctx.fill(); circle(mx + 14, 100, 5); ctx.fill();
    hills(0.15, 320, 35, 0.006, '#2b1747');
    hills(0.3, 360, 25, 0.011, '#231238');
    each(0.45, 210, (x, i) => {
      const bx = x + hash(i, 4) * 90, s = 0.5 + hash(i, 6) * 0.35;
      ctx.save(); ctx.translate(bx, 395); ctx.scale(s, s);
      ctx.fillStyle = '#1a0d2b';
      ellipse(-22, -36, 18, 34); ctx.fill(); ellipse(22, -36, 18, 34); ctx.fill(); ellipse(0, -38, 26, 38); ctx.fill();
      ctx.fillRect(-4, -84, 8, 14);
      ctx.fillStyle = `rgba(255,200,60,${0.5 + 0.4 * Math.sin(t * 0.05 + i)})`;
      ctx.beginPath(); ctx.moveTo(-18, -44); ctx.lineTo(-6, -44); ctx.lineTo(-12, -56); ctx.fill();
      ctx.beginPath(); ctx.moveTo(18, -44); ctx.lineTo(6, -44); ctx.lineTo(12, -56); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18, -28); ctx.lineTo(18, -28); ctx.quadraticCurveTo(0, -10, -18, -28); ctx.fill();
      ctx.restore();
    });
    for (let k = 0; k < 14; k++) {
      const x = ((hash(k, 21) * VW + Math.sin(t * 0.01 + k) * 40 - camX * 0.5) % VW + VW) % VW;
      const y = 200 + hash(k, 22) * 160 + Math.sin(t * 0.02 + k * 2) * 15;
      ctx.fillStyle = `rgba(220,255,120,${0.3 + 0.5 * Math.abs(Math.sin(t * 0.04 + k))})`;
      circle(x, y, 2.5); ctx.fill();
    }
  }
}

function drawTile(c, tx, ty, th, t) {
  const x = tx * T, y = ty * T;
  const above = tileAt(tx, ty - 1);
  const openAbove = !isSolidCh(above) || above === 'J' || above === 'D';
  switch (c) {
    case '#': {
      ctx.fillStyle = th.ground; ctx.fillRect(x - 0.5, y - 0.5, T + 1, T + 1);
      ctx.fillStyle = th.groundDark;
      for (let k = 0; k < 3; k++) {
        const hx = x + 4 + hash(tx * 3 + k, ty) * 22, hy = y + 6 + hash(tx, ty * 3 + k) * 20;
        if (L.theme === 'ice') { ctx.fillStyle = CANDY_COLORS[(tx + ty + k) % 6]; ctx.fillRect(hx, hy, 5, 2); }
        else { circle(hx, hy, 2.5); ctx.fill(); }
      }
      if (openAbove) {
        ctx.fillStyle = th.top; ctx.fillRect(x, y, T, 9);
        ctx.fillStyle = th.drip;
        const d = hash(tx, 99);
        circle(x + 8 + d * 6, y + 9, 3.5 + d * 2); ctx.fill();
        circle(x + 22 + d * 4, y + 9, 2.5 + d * 1.5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, T, 3);
      }
      break;
    }
    case '=': {
      ctx.fillStyle = th.block; rr(x + 1, y + 1, T - 2, T - 2, 6); ctx.fill();
      ctx.fillStyle = th.blockHi; rr(x + 4, y + 4, T - 14, 5, 2.5); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; rr(x + 1, y + 1, T - 2, T - 2, 6); ctx.stroke();
      break;
    }
    case 'I': {
      ctx.fillStyle = '#bfe9ff'; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = '#e8f8ff'; ctx.fillRect(x, y, T, 6);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 6, y + 24); ctx.lineTo(x + 16, y + 12); ctx.moveTo(x + 18, y + 28); ctx.lineTo(x + 26, y + 18); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,160,220,.35)'; ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      break;
    }
    case '-': {
      ctx.fillStyle = th.plank; rr(x, y, T, 12, 3); ctx.fill();
      ctx.strokeStyle = th.plankLine; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 6; k < T; k += 8) { ctx.moveTo(x + k, y + 2); ctx.lineTo(x + k, y + 10); }
      ctx.stroke();
      break;
    }
    case '~': {
      ctx.fillStyle = th.liquid; ctx.fillRect(x - 0.5, y - 0.5, T + 1, T + 1);
      if (tileAt(tx, ty - 1) !== '~') {
        ctx.fillStyle = th.liquidTop;
        ctx.beginPath(); ctx.moveTo(x, y + 8);
        for (let k = 0; k <= T; k += 4) ctx.lineTo(x + k, y + 5 + Math.sin((x + k) * 0.15 + t * 0.08) * 3);
        ctx.lineTo(x + T, y + 12); ctx.lineTo(x, y + 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = th.liquid; ctx.fillRect(x, y + 11, T, 2);
        if (hash(tx, 5) > 0.6) {
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          circle(x + 10 + hash(tx, 6) * 12, y + 18 + Math.sin(t * 0.05 + tx) * 3, 2.5); ctx.fill();
        }
      }
      break;
    }
    case '^': {
      for (let k = 0; k < 2; k++) {
        const sx = x + k * 16;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(sx + 8, y + 12); ctx.lineTo(sx + 11, y + 18); ctx.lineTo(sx + 5, y + 18); ctx.fill();
        ctx.fillStyle = '#ffc93f'; ctx.beginPath(); ctx.moveTo(sx + 5, y + 18); ctx.lineTo(sx + 11, y + 18); ctx.lineTo(sx + 13.5, y + 25); ctx.lineTo(sx + 2.5, y + 25); ctx.fill();
        ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(sx + 2.5, y + 25); ctx.lineTo(sx + 13.5, y + 25); ctx.lineTo(sx + 15, y + 32); ctx.lineTo(sx + 1, y + 32); ctx.fill();
      }
      break;
    }
    case 'J': {
      const w = L.jelly[tx + ',' + ty] || 0;
      const sq = Math.sin(w * 0.6) * w * 0.25;
      ctx.fillStyle = th.jelly;
      rr(x + 1 - sq / 2, y + 2 + sq, T - 2 + sq, T - 2 - sq, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; rr(x + 5, y + 5 + sq, 10, 5, 2.5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)'; circle(x + 11, y + 18 + sq, 2); ctx.fill(); circle(x + 21, y + 18 + sq, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + 16, y + 21 + sq, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      break;
    }
    case 'D': {
      if (tileAt(tx, ty - 1) === 'D') break;
      let n = 1; while (tileAt(tx, ty + n) === 'D') n++;
      const h = n * T;
      ctx.fillStyle = '#c99a00'; rr(x, y, T, h, 8); ctx.fill();
      ctx.fillStyle = '#6b3416'; rr(x + 4, y + 4, T - 8, h - 6, 6); ctx.fill();
      ctx.strokeStyle = '#8f4a22'; ctx.lineWidth = 2;
      for (let k = 1; k < n * 2; k++) { ctx.beginPath(); ctx.moveTo(x + 6, y + k * 16); ctx.lineTo(x + T - 6, y + k * 16); ctx.stroke(); }
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.08);
      ctx.fillStyle = `rgba(255,211,77,${pulse})`;
      circle(x + T / 2, y + h / 2 - 3, 5); ctx.fill();
      ctx.fillRect(x + T / 2 - 2, y + h / 2, 4, 9);
      break;
    }
  }
}

function drawPlatform(pl) {
  const th = THEMES[L.theme];
  ctx.fillStyle = th.plat; rr(pl.x, pl.y, pl.w, pl.h, 4); ctx.fill();
  ctx.fillStyle = th.platTop; rr(pl.x + 2, pl.y + 2, pl.w - 4, 5, 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 1; k < 6; k++) { ctx.moveTo(pl.x + k * pl.w / 6, pl.y + 3); ctx.lineTo(pl.x + k * pl.w / 6, pl.y + pl.h - 2); }
  ctx.stroke();
  if (pl.kind === 'V') {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.moveTo(pl.x + pl.w / 2 - 6, pl.y + pl.h + 10); ctx.lineTo(pl.x + pl.w / 2 + 6, pl.y + pl.h + 10); ctx.lineTo(pl.x + pl.w / 2, pl.y + pl.h + 3); ctx.fill();
  }
}

function drawCandy(x, y, color, t) {
  y += Math.sin(t * 0.08 + x * 0.05) * 2.5;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 13, y - 6); ctx.lineTo(x - 13, y + 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 13, y - 6); ctx.lineTo(x + 13, y + 6); ctx.closePath(); ctx.fill();
  circle(x, y, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 4.5, 0.2 + t * 0.03, 2.4 + t * 0.03); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; circle(x - 3, y - 3, 1.8); ctx.fill();
}
function drawKey(x, y, t) {
  y += Math.sin(t * 0.07) * 3;
  ctx.save();
  ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 16;
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(x - 2, y + 4, 4, 18);
  ctx.fillRect(x + 2, y + 14, 5, 3); ctx.fillRect(x + 2, y + 19, 7, 3);
  circle(x, y - 2, 10); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#c98a00'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let a = 0; a < 10; a += 0.3) ctx.lineTo(x + Math.cos(a + t * 0.05) * a * 0.75, y - 2 + Math.sin(a + t * 0.05) * a * 0.75);
  ctx.stroke();
  ctx.restore();
}
function drawRainbowStar(x, y, t, r = 15) {
  y += Math.sin(t * 0.06) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.04) * 0.25);
  ctx.shadowColor = `hsl(${(t * 4) % 360},100%,70%)`;
  ctx.shadowBlur = 22;
  const g = ctx.createLinearGradient(-r, -r, r, r);
  const hues = [0, 35, 55, 130, 200, 275];
  hues.forEach((h, i) => g.addColorStop(i / (hues.length - 1), `hsl(${(h + t * 3) % 360},95%,62%)`));
  ctx.fillStyle = g;
  starPath(0, 0, r, r * 0.45);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  for (let k = 0; k < 3; k++) {
    const a = t * 0.05 + k * 2.1;
    ctx.fillStyle = '#fff';
    starPath(x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10), 3, 1.2);
    ctx.fill();
  }
}
function drawHeart(x, y, s, col = '#ff4d6d') {
  ctx.fillStyle = col;
  heartPath(x, y - s / 2, s);
  ctx.fill();
}
function drawCheckpoint(cp, t) {
  const x = cp.x + 16, y = cp.y;
  ctx.save();
  ctx.fillStyle = '#fff'; rr(x - 3, y - 70, 6, 70, 3); ctx.fill();
  ctx.save(); rr(x - 3, y - 70, 6, 70, 3); ctx.clip();
  ctx.fillStyle = '#e8304a';
  for (let k = -70; k < 0; k += 12) { ctx.beginPath(); ctx.moveTo(x - 4, y + k); ctx.lineTo(x + 4, y + k - 6); ctx.lineTo(x + 4, y + k - 1); ctx.lineTo(x - 4, y + k + 5); ctx.fill(); }
  ctx.restore();
  const wave = Math.sin(t * 0.12) * 3;
  ctx.fillStyle = cp.on ? '#ff5fa2' : '#b8a8c0';
  ctx.beginPath(); ctx.moveTo(x + 3, y - 68); ctx.quadraticCurveTo(x + 18, y - 64 + wave, x + 30, y - 58 + wave); ctx.lineTo(x + 3, y - 48); ctx.closePath(); ctx.fill();
  if (cp.on) { ctx.fillStyle = '#fff'; starPath(x + 13, y - 58 + wave / 2, 4.5, 2); ctx.fill(); }
  ctx.restore();
}
function drawExit(ex, t) {
  const x = ex.x, y = ex.y;
  ctx.fillStyle = '#fff'; rr(x - 4, y - 90, 8, 90, 4); ctx.fill();
  ctx.save();
  ctx.translate(x, y - 110);
  ctx.rotate(t * 0.03);
  const n = 12;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = CANDY_COLORS[i % CANDY_COLORS.length];
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, 30, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#fff'; circle(0, 0, 6); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; circle(x, y - 110, 30); ctx.stroke();
  text('GOAL!', x, y - 155 + Math.sin(t * 0.1) * 3, 18, '#fff', 'center', '#ff5fa2', 5);
}
function drawSign(s) {
  const x = s.x, y = s.y;
  ctx.fillStyle = '#8a5a3b'; ctx.fillRect(x - 3, y - 28, 6, 28);
  ctx.fillStyle = '#f2c27a'; rr(x - 16, y - 46, 32, 24, 5); ctx.fill();
  ctx.strokeStyle = '#b9813b'; ctx.lineWidth = 2; ctx.stroke();
  text('!', x, y - 34, 18, '#c2185b');
}

function bubble(sx, sy, str, sz = 15, maxW = 240) {
  const lines = wrap(str, maxW, sz);
  ctx.font = font(sz, 600);
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  w += 26;
  const lh = sz * 1.3, h = lines.length * lh + 16;
  const bx = clamp(sx - w / 2, 6, VW - w - 6);
  const by = clamp(sy - h - 14, 50, VH - h - 6);
  ctx.fillStyle = 'rgba(40,20,60,.25)'; rr(bx + 3, by + 4, w, h, 14); ctx.fill();
  ctx.fillStyle = '#fff'; rr(bx, by, w, h, 14); ctx.fill();
  ctx.strokeStyle = '#5b2a86'; ctx.lineWidth = 2.5; ctx.stroke();
  const tx = clamp(sx, bx + 16, bx + w - 16);
  if (by + h < sy) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(tx - 8, by + h - 1.5); ctx.lineTo(tx + 8, by + h - 1.5); ctx.lineTo(tx, by + h + 11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5b2a86';
    ctx.beginPath(); ctx.moveTo(tx - 8, by + h); ctx.lineTo(tx, by + h + 11); ctx.lineTo(tx + 8, by + h); ctx.stroke();
  }
  lines.forEach((l, i) => text(l, bx + w / 2, by + 8 + lh / 2 + i * lh, sz, '#3a1a52', 'center', null, 0, 600));
}

function drawParticle(q) {
  ctx.globalAlpha = Math.max(0, Math.min(1, q.life / 20));
  ctx.fillStyle = q.color;
  if (q.shape === 'star') { starPath(q.x, q.y, q.size * 1.6, q.size * 0.7, q.life * 0.1); ctx.fill(); }
  else if (q.shape === 'rect') { ctx.fillRect(q.x, q.y, q.size * 1.5, q.size * 0.8); }
  else { circle(q.x, q.y, q.size); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function drawPlayer(p, t) {
  if (p.hidden) return;
  if (p.inv > 0 && !p.dead && Math.floor(p.inv / 4) % 2 === 0) return;
  const cx = p.x + p.w / 2, by = p.y + p.h;
  const run = p.onGround && Math.abs(p.vx) > 0.4;
  ctx.save();
  if (p.faint) { ctx.translate(cx, by - p.h / 2); ctx.rotate(p.dead * 0.2); ctx.translate(-cx, -(by - p.h / 2)); }
  if (p.form === 'bat') drawBat(cx, by, p.face, p.anim, p.batFuel);
  else if (hero === 'vamp') drawVampire(cx, by, p.face, p.anim, run, !p.onGround);
  else drawAxolotl(cx, by, p.face, p.anim, run, !p.onGround, p.form === 'tiny' ? 0.42 : 1);
  ctx.restore();
  if (p.form === 'tiny') {
    for (let k = 0; k < 3; k++) {
      const a = t * 0.08 + k * 2.1;
      ctx.fillStyle = k % 2 ? '#fff59d' : '#fff';
      starPath(cx + Math.cos(a) * 14, by - 10 + Math.sin(a) * 10, 3, 1.2);
      ctx.fill();
    }
  }
  if (hero === 'vamp' && p.form === 'normal' && p.batFuel < 1) {
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, by - 56, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#b88aff';
    ctx.beginPath(); ctx.arc(cx, by - 56, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.batFuel); ctx.stroke();
  }
}

function drawBoss(b, t) {
  const mood = b.state === 'laugh' ? 'laugh' : b.state === 'nice' ? 'nice' : b.state === 'spit' && b.t < 45 ? 'puff' : 'mean';
  const bob = b.state === 'idle' || b.state === 'intro' ? Math.sin(t * 0.1) * 2 : 0;
  if (b.state === 'nice') {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 0.1);
    ctx.fillStyle = '#fff3a0'; circle(b.x + b.w / 2, b.y + b.h / 2, 70); ctx.fill();
    ctx.restore();
  }
  drawPumpkin(b.x + b.w / 2, b.y + b.h + bob, mood, t, { squash: b.squash, face: b.face > 0 ? -1 : 1, size: 0.86 });
}

// ================================================================
// Drawing — screens
// ================================================================
function button(x, y, w, h, label, cb, color = '#ff5fa2', size = 24) {
  const idx = uiButtons.length;
  uiButtons.push({ x, y, w, h, cb });
  const focused = idx === uiFocus && !touchMode;
  ctx.fillStyle = 'rgba(40,10,60,.35)'; rr(x, y + 5, w, h, 18); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.08, color); g.addColorStop(1, color);
  ctx.fillStyle = g; rr(x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = focused ? '#ffe066' : '#fff'; ctx.lineWidth = focused ? 5 : 3; rr(x, y, w, h, 18); ctx.stroke();
  text(label, x + w / 2, y + h / 2 + 1, size, '#fff', 'center', 'rgba(60,10,60,.5)', 4);
}

function drawTitleLogo(cx, y, t) {
  const words = [['Sugar Rush', 58, y], ['HEROES', 70, y + 66]];
  const cols = ['#ff5fa2', '#ffc93f', '#4fc8ff', '#9b6bff', '#4fdc84', '#ff8a3d'];
  for (const [w, sz, wy] of words) {
    ctx.font = font(sz, 700);
    const total = ctx.measureText(w).width;
    let x = cx - total / 2;
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      const cw = ctx.measureText(ch).width;
      const yy = wy + Math.sin(t * 0.07 + i * 0.6) * 5;
      ctx.lineJoin = 'round';
      ctx.font = font(sz, 700);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 14; ctx.strokeStyle = '#4a1a6b'; ctx.strokeText(ch, x, yy + 3);
      ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.strokeText(ch, x, yy);
      ctx.fillStyle = cols[i % cols.length]; ctx.fillText(ch, x, yy);
      x += cw;
    }
  }
}

function drawTitle(t) {
  drawBackground('choco', t * 1.2, t);
  ctx.fillStyle = '#9a5530'; ctx.fillRect(0, 400, VW, 50);
  ctx.fillStyle = '#ff8cc6'; ctx.fillRect(0, 400, VW, 9);
  drawTitleLogo(VW / 2, 82, t);
  text('A game designed by the Sugar Rush Kids', VW / 2, 200, 22, '#fff', 'center', '#7a2d8a', 6);
  const hop1 = Math.abs(Math.sin(t * 0.08)) * 26, hop2 = Math.abs(Math.sin(t * 0.08 + 1.5)) * 26;
  drawVampire(VW / 2 - 150, 400 - hop1, 1, t, false, hop1 > 4, 1.8);
  drawAxolotl(VW / 2 + 150, 400 - hop2, -1, t, false, hop2 > 4, 1.8);
  drawHappyLemon(VW / 2 - 270, 400, t, 0.3, 1.6);
  ctx.save(); ctx.globalAlpha = 0.95;
  drawPumpkin(VW / 2 + 280, 400, 'mean', t, { face: 1 });
  ctx.restore();
  uiButtons = [];
  const pulse = 1 + Math.sin(t * 0.1) * 0.04;
  ctx.save();
  ctx.translate(VW / 2, 275); ctx.scale(pulse, pulse); ctx.translate(-VW / 2, -275);
  button(VW / 2 - 110, 245, 220, 62, '▶  PLAY', () => setState('hero'), '#ff5fa2', 30);
  ctx.restore();
  if (save.won) text('👑 You beat the game! 👑', VW / 2, 330, 16, '#fff', 'center', '#7a2d8a', 5);
}

function drawHeroPick(t) {
  drawBackground('choco', t * 0.6, t);
  text('Who wants to play?', VW / 2, 52, 38, '#fff', 'center', '#7a2d8a', 8);
  uiButtons = [];
  const cw = Math.min(250, VW * 0.4), ch = 280, gap = 30;
  const x1 = VW / 2 - cw - gap / 2, x2 = VW / 2 + gap / 2, y = 92;
  const cards = [
    { id: 'vamp', x: x1, name: 'VAMPIRE', power: '🦇 Turns into a bat!', col: '#7a4bb0' },
    { id: 'axo', x: x2, name: 'AXOLOTL', power: '✨ Sparkle shrink!', col: '#ff5fa2' },
  ];
  cards.forEach((c, i) => {
    uiButtons.push({ x: c.x, y, w: cw, h: ch, cb: () => { hero = c.id; save.hero = hero; persist(); updateTouchUI(); setState('map'); } });
    const focused = uiFocus === i && !touchMode;
    const sel = hero === c.id;
    ctx.fillStyle = 'rgba(40,10,60,.3)'; rr(c.x, y + 6, cw, ch, 24); ctx.fill();
    ctx.fillStyle = '#fff'; rr(c.x, y, cw, ch, 24); ctx.fill();
    ctx.strokeStyle = focused ? '#ffe066' : c.col; ctx.lineWidth = focused || sel ? 7 : 4; rr(c.x, y, cw, ch, 24); ctx.stroke();
    ctx.fillStyle = c.col + '22'; rr(c.x + 12, y + 12, cw - 24, 150, 18); ctx.fill();
    const hop = Math.abs(Math.sin(t * 0.09 + i)) * 12;
    if (c.id === 'vamp') {
      if (Math.floor(t / 90) % 2 === 0) drawVampire(c.x + cw / 2, y + 155 - hop, 1, t, false, false, 2.3);
      else drawBat(c.x + cw / 2, y + 120 - hop, 1, t, undefined, 2.2);
    } else {
      const tiny = Math.floor(t / 90) % 2 === 1;
      drawAxolotl(c.x + cw / 2, y + 155 - hop, 1, t, false, false, tiny ? 1 : 2.3);
      if (tiny) for (let k = 0; k < 4; k++) { ctx.fillStyle = '#ffd34d'; starPath(c.x + cw / 2 + Math.cos(t * 0.08 + k * 1.6) * 34, y + 135 + Math.sin(t * 0.08 + k * 1.6) * 20, 5, 2); ctx.fill(); }
    }
    text(c.name, c.x + cw / 2, y + 196, 30, c.col);
    text(c.power, c.x + cw / 2, y + 234, 18, '#5b2a86', 'center', null, 0, 600);
  });
  text('Psst... you can SWAP heroes any time! 🔄', VW / 2, 412, 18, '#fff', 'center', '#7a2d8a', 5);
  ctx.save();
  button(14, 12, 96, 40, '◀ Back', () => setState('title'), '#9b6bff', 18);
  ctx.restore();
}

function drawMap(t) {
  drawBackground('choco', 0, t);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 0, VW, VH);
  text('Candy World Map', VW / 2, 44, 36, '#fff', 'center', '#7a2d8a', 8);
  uiButtons = [];
  const nodes = [
    { x: VW * 0.2, y: 220 }, { x: VW * 0.5, y: 175 }, { x: VW * 0.8, y: 220 },
  ];
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.setLineDash([2, 18]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(nodes[0].x, nodes[0].y);
  ctx.quadraticCurveTo(VW * 0.35, 120, nodes[1].x, nodes[1].y);
  ctx.quadraticCurveTo(VW * 0.65, 280, nodes[2].x, nodes[2].y);
  ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
  const cols = ['#8a4b2a', '#7fd8ff', '#ff8a1f'];
  LEVELS.forEach((lv, i) => {
    const n = nodes[i];
    const locked = i + 1 > save.unlocked;
    const r = 50;
    uiButtons.push({ x: n.x - r, y: n.y - r, w: r * 2, h: r * 2 + 40, cb: () => {
      if (locked) { sfx.nope(); return; }
      loadLevel(i);
    } });
    const focused = uiFocus === i && !touchMode;
    const bob = locked ? 0 : Math.sin(t * 0.07 + i) * 4;
    ctx.fillStyle = 'rgba(40,10,60,.3)'; circle(n.x, n.y + 6 + bob, r); ctx.fill();
    ctx.fillStyle = locked ? '#b8a8c0' : cols[i]; circle(n.x, n.y + bob, r); ctx.fill();
    ctx.strokeStyle = focused ? '#ffe066' : '#fff'; ctx.lineWidth = focused ? 7 : 5; ctx.stroke();
    text(locked ? '🔒' : lv.icon, n.x, n.y + bob + 2, 44, '#fff');
    text(lv.name, n.x, n.y + r + 24, 19, '#fff', 'center', '#7a2d8a', 6);
    if (!locked) {
      if (save.stars[i]) drawRainbowStar(n.x + r * 0.75, n.y - r * 0.75 + bob, t, 13);
      else { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(80,40,100,.5)'; starPath(n.x + r * 0.75, n.y - r * 0.75 + bob, 13, 6); ctx.fill(); ctx.stroke(); }
      const best = save.candies[i] || 0;
      if (best) text(`🍬 ${best}`, n.x, n.y + r + 48, 15, '#fff', 'center', '#7a2d8a', 4);
    } else text(`World ${i + 1}`, n.x, n.y + r + 48, 15, '#fff', 'center', '#7a2d8a', 4);
  });
  const starCount = save.stars.filter(Boolean).length;
  text(`🌈⭐ ${starCount} / 3 rainbow stars`, VW / 2, 345, 20, '#fff', 'center', '#7a2d8a', 6);
  button(14, 12, 96, 40, '◀ Back', () => setState('hero'), '#9b6bff', 18);
  const hb = 230;
  button(VW / 2 - hb / 2, 375, hb, 50, (hero === 'vamp' ? '🧛 ' : '🦎 ') + 'Hero: ' + HERO_NAMES[hero], () => setState('hero'), '#7a4bb0', 20);
}

function drawHUD(t) {
  const p = L.player;
  ctx.fillStyle = 'rgba(255,255,255,.82)'; rr(10, 10, 250, 46, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(91,42,134,.4)'; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 3; i++) drawHeart(32 + i * 26, 33, 20, i < p.hearts ? '#ff4d6d' : '#d9c8de');
  drawCandy(120, 33, '#ff5fa2', 0);
  text(`${L.got}/${L.total}`, 138, 34, 18, '#5b2a86', 'left');
  if (L.star) drawRainbowStar(232, 33, t, 11);
  else { ctx.fillStyle = '#d9c8de'; starPath(232, 33, 11, 5); ctx.fill(); }
  if (L.keys > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.82)'; rr(266, 10, 64, 46, 16); ctx.fill();
    drawKey(286, 28, 0);
    text(`×${L.keys}`, 310, 34, 18, '#5b2a86', 'center');
  }
  const b = L.boss;
  if (b && b.state !== 'sleep') {
    const w = Math.min(260, VW * 0.4), x = VW / 2 - w / 2 + 40, y = 66;
    text('Giggle Meter', VW / 2 + 40, y - 2, 15, '#fff', 'center', '#4a1a6b', 4);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(x, y + 8, w, 16, 8); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#ff5fa2');
    ctx.fillStyle = g; rr(x, y + 8, Math.max(16, w * b.giggles / 5), 16, 8); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rr(x, y + 8, w, 16, 8); ctx.stroke();
    text('😂', x + w + 16, y + 16, 20, '#fff');
  }
  if (L.introT > 0) {
    const a = Math.min(1, L.introT / 30);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(60,20,90,.65)'; rr(VW / 2 - 200, VH / 2 - 70, 400, 120, 24); ctx.fill();
    text(`World ${L.i + 1}`, VW / 2, VH / 2 - 38, 22, '#ffe066');
    text(`${L.def.icon} ${L.def.name}`, VW / 2, VH / 2 + 4, 36, '#fff', 'center', '#7a2d8a', 6);
    ctx.globalAlpha = 1;
  }
}

function drawPlay(t) {
  const sh = L.shake > 0 ? L.shake : 0;
  const ox = sh ? rand(sh) - sh / 2 : 0, oy = sh ? rand(sh) - sh / 2 : 0;
  drawBackground(L.theme, L.camX, t);
  ctx.save();
  ctx.translate(Math.round(-L.camX + ox), Math.round(-L.camY + oy));
  const th = THEMES[L.theme];
  const c0 = Math.max(0, Math.floor(L.camX / T) - 1), c1 = Math.min(L.W - 1, Math.floor((L.camX + VW) / T) + 1);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = c0; tx <= c1; tx++) {
      const c = L.grid[ty][tx];
      if (c !== '.') drawTile(c, tx, ty, th, t);
    }
  }
  if (L.gateX !== null) {
    for (let y = 0; y < 12 * T; y += 24) {
      ctx.fillStyle = (y / 24) % 2 ? '#e8304a' : '#fff';
      ctx.fillRect(L.gateX - 8, y, 8, 24);
    }
  }
  for (const pl of L.plats) drawPlatform(pl);
  for (const s of L.signs) drawSign(s);
  for (const cp of L.checkpoints) drawCheckpoint(cp, t);
  if (L.exit) drawExit(L.exit, t);
  for (const it of L.items) {
    if (it.taken) continue;
    if (it.x < L.camX - 40 || it.x > L.camX + VW + 40) continue;
    if (it.type === 'candy') drawCandy(it.x, it.y, it.color, t);
    else if (it.type === 'key') drawKey(it.x, it.y, t);
    else if (it.type === 'star') drawRainbowStar(it.x, it.y, t);
    else if (it.type === 'heart') drawHeart(it.x, it.y + Math.sin(t * 0.1) * 2, 22);
  }
  if (L.boss) drawBoss(L.boss, t);
  for (const e of L.enemies) drawLemon(e);
  for (const s of L.shots) {
    ctx.fillStyle = s.seed ? '#fff3c4' : '#d4f542';
    if (s.seed) { ellipse(s.x, s.y, 4, 6, s.life * 0.2); ctx.fill(); ctx.strokeStyle = '#c9a54a'; ctx.lineWidth = 1; ctx.stroke(); }
    else { circle(s.x, s.y, s.r); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; circle(s.x - 1.5, s.y - 1.5, 1.5); ctx.fill(); }
  }
  drawPlayer(L.player, t);
  for (const q of L.parts) drawParticle(q);
  for (const tx of L.texts) {
    ctx.globalAlpha = Math.min(1, tx.life / 20);
    text(tx.s, tx.x, tx.y, tx.size, tx.color, 'center', '#4a1a6b', 5);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // speech bubbles (screen space)
  const toScreen = (x, y) => [x - L.camX, y - L.camY];
  for (const s of L.signs) if (s.near) { const [sx, sy] = toScreen(s.x, s.y - 48); bubble(sx, sy, signText(s.text), 15, 250); }
  const b = L.boss;
  if (b && b.sayT > 0 && b.say) { const [sx, sy] = toScreen(b.x + b.w / 2, b.y - 16); bubble(sx, sy, b.say, 17, 280); }
  drawHUD(t);
}

function drawPanel(w, h) {
  const x = VW / 2 - w / 2, y = VH / 2 - h / 2;
  ctx.fillStyle = 'rgba(30,10,50,.55)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(40,10,60,.35)'; rr(x, y + 8, w, h, 28); ctx.fill();
  ctx.fillStyle = '#fff7fb'; rr(x, y, w, h, 28); ctx.fill();
  ctx.strokeStyle = '#ff5fa2'; ctx.lineWidth = 6; ctx.stroke();
  return [x, y];
}

function drawPause(t) {
  drawPlay(t);
  uiButtons = [];
  const [x, y] = drawPanel(340, 300);
  text('Paused', VW / 2, y + 46, 38, '#5b2a86');
  button(x + 50, y + 85, 240, 54, '▶ Keep Playing', () => setState('play'), '#4fdc84', 22);
  button(x + 50, y + 150, 240, 54, '↺ Start Over', () => loadLevel(L.i), '#ffb02e', 22);
  button(x + 50, y + 215, 240, 54, '🗺️ Map', () => setState('map'), '#9b6bff', 22);
}

function drawClear(t) {
  drawPlay(t);
  uiButtons = [];
  const [x, y] = drawPanel(420, 330);
  text('LEVEL CLEAR! 🎉', VW / 2, y + 44, 36, '#ff5fa2', 'center', '#fff', 6);
  text(L.def.name, VW / 2, y + 84, 22, '#5b2a86');
  drawCandy(VW / 2 - 100, y + 126, '#ff5fa2', t);
  text(`Candy: ${L.got} / ${L.total}`, VW / 2 - 80, y + 127, 22, '#5b2a86', 'left');
  if (L.got === L.total) text('ALL OF THEM!', VW / 2 + 140, y + 127, 14, '#4fbf3a');
  if (L.star) { drawRainbowStar(VW / 2 - 100, y + 166, t, 13); text('Rainbow star found!', VW / 2 - 80, y + 167, 22, '#5b2a86', 'left'); }
  else { ctx.fillStyle = '#d9c8de'; starPath(VW / 2 - 100, y + 166, 13, 6); ctx.fill(); text('Rainbow star is still hiding...', VW / 2 - 80, y + 167, 19, '#8a6a9a', 'left'); }
  text(`🍋 Lemons squished: ${L.squished}`, VW / 2, y + 205, 18, '#8a6a9a');
  const next = L.i + 1 < LEVELS.length;
  if (next) button(x + 30, y + 240, 170, 58, 'NEXT ▶', () => loadLevel(L.i + 1), '#4fdc84', 24);
  else button(x + 30, y + 240, 170, 58, '🗺️ Map', () => setState('map'), '#4fdc84', 22);
  button(x + 220, y + 240, 170, 58, '↺ Again', () => loadLevel(L.i), '#ffb02e', 22);
}

function drawCake(cx, by, t) {
  ctx.save();
  ctx.translate(cx, by);
  const tiers = [[110, 34, '#ff9ec9'], [84, 30, '#fff1f7'], [58, 28, '#b77bff']];
  let y = 0;
  tiers.forEach(([w, h, c], i) => {
    ctx.fillStyle = c; rr(-w / 2, y - h, w, h, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-w / 2, y - h + 6);
    for (let k = 0; k <= 8; k++) ctx.lineTo(-w / 2 + (k * w) / 8, y - h + 6 + (k % 2 ? 7 : 0));
    ctx.lineTo(w / 2, y - h); ctx.lineTo(-w / 2, y - h); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 6; k++) { ctx.fillStyle = CANDY_COLORS[(k + i) % 6]; ctx.fillRect(-w / 2 + 8 + hash(k, i) * (w - 16), y - h / 2 + hash(i, k) * 8, 5, 2); }
    y -= h;
  });
  for (let k = -1; k <= 1; k++) {
    ctx.fillStyle = CANDY_COLORS[k + 2]; ctx.fillRect(k * 16 - 2, y - 16, 4, 16);
    ctx.fillStyle = '#ffd34d'; ellipse(k * 16, y - 20 + Math.sin(t * 0.3 + k) * 1, 3, 5); ctx.fill();
  }
  ctx.fillStyle = '#e8304a'; circle(0, y - 4, 7); ctx.fill();
  ctx.restore();
}
function drawCrown(cx, y) {
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(cx - 14, y); ctx.lineTo(cx - 16, y - 16); ctx.lineTo(cx - 7, y - 8); ctx.lineTo(cx, y - 20);
  ctx.lineTo(cx + 7, y - 8); ctx.lineTo(cx + 16, y - 16); ctx.lineTo(cx + 14, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c98a00'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ff5fa2'; circle(cx, y - 6, 3); ctx.fill();
  ctx.fillStyle = '#4fc8ff'; circle(cx - 9, y - 4, 2); ctx.fill(); circle(cx + 9, y - 4, 2); ctx.fill();
}

function drawEnding(t) {
  const et = E.t;
  const ox = E.shake ? rand(E.shake) - E.shake / 2 : 0;
  ctx.save();
  ctx.translate(ox, 0);
  drawBackground('pumpkin', et * 0.5, t);
  // lanterns
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(VW / 2, 110, VW, 30); ctx.stroke();
  for (let k = 1; k < 12; k++) {
    const x = (k / 12) * VW, y = 30 + Math.sin((k / 12) * Math.PI) * 40;
    ctx.fillStyle = CANDY_COLORS[k % 6];
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.1 + k);
    circle(x, y + 10, 9); ctx.fill();
    ctx.globalAlpha = 1;
  }
  const ground = 395;
  ctx.fillStyle = '#ff8cc6'; ctx.fillRect(0, ground, VW, VH - ground);
  ctx.fillStyle = '#ffb3d9'; ctx.fillRect(0, ground, VW, 8);
  for (const q of E.parts) drawParticle(q);
  // dancers
  [0.06, 0.29, 0.73, 0.94].forEach((f, i) => drawHappyLemon(VW * f, ground, et, i * 1.3 + 0.2, 1.5));
  const vx = VW * 0.17, ax = VW * 0.84;
  const hop1 = Math.abs(Math.sin(et * 0.11)) * 30, hop2 = Math.abs(Math.sin(et * 0.11 + 1.6)) * 30;
  drawVampire(vx, ground - hop1, 1, et, false, hop1 > 5, 1.6);
  drawAxolotl(ax, ground - hop2, -1, et, false, hop2 > 5, 1.6);
  if (et > 120) {
    const k = Math.min(1, (et - 120) / 60);
    const ease = 1 - Math.pow(1 - k, 3);
    drawCrown(vx + 2, -40 + (ground - hop1 - 72 + 40) * ease);
    drawCrown(ax - 3, -40 + (ground - hop2 - 68 + 40) * ease);
  }
  if (et >= 330) drawCake(VW * 0.62, ground + E.cakeY, t);
  // the pumpkin dance
  const dance = et > 420 ? 2 : 1;
  ctx.save();
  const px = VW * 0.42 + Math.sin(et * 0.05) * 20 * dance, py = ground - Math.abs(Math.sin(et * 0.15)) * 18 * dance;
  ctx.translate(px, py);
  ctx.rotate(Math.sin(et * 0.15) * 0.18 * dance);
  ctx.translate(-px, -py);
  drawPumpkin(px, py, 'nice', t, {});
  ctx.restore();
  // words
  if (et > 20 && et < 640) text('🎉 CANDY PARTY! 🎉', VW / 2, 120, 40, '#fff', 'center', '#ff5fa2', 8);
  if (et > 140 && et < 330) text('Crowns for the ROYAL HEROES! 👑', VW / 2, 170, 24, '#ffe066', 'center', '#4a1a6b', 6);
  if (et > 345 && et < 440) text('BOOM! A GIANT CAKE! 🍰', VW / 2, 170, 26, '#fff', 'center', '#4a1a6b', 6);
  if (et > 30 && et < 170) bubble(px, py - 110, 'Thanks for tickling me! Best day EVER!', 16, 260);
  if (et > 440 && et < 640) bubble(px, py - 110, 'Time for my famous SQUASH DANCE! Get it? SQUASH?! 🎃', 16, 280);
  ctx.restore();

  uiButtons = [];
  if (et > 640) {
    const a = Math.min(1, (et - 640) / 40);
    ctx.globalAlpha = a;
    const w = Math.min(460, VW - 40), h = 300, x = VW / 2 - w / 2, y = 70;
    ctx.fillStyle = 'rgba(40,10,60,.75)'; rr(x, y, w, h, 28); ctx.fill();
    ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 4; ctx.stroke();
    text('THE END', VW / 2, y + 46, 48, '#ffe066', 'center', '#ff5fa2', 6);
    text('Sugar Rush Heroes', VW / 2, y + 92, 22, '#fff');
    text('Designed by the Sugar Rush Kids 💗', VW / 2, y + 124, 22, '#ffb3d9');
    const stars = save.stars.filter(Boolean).length;
    text(`🌈⭐ Rainbow stars: ${stars} / 3`, VW / 2, y + 162, 20, '#fff');
    text(stars < 3 ? 'Can you find them ALL?' : 'You found them ALL! WOW!', VW / 2, y + 190, 17, '#ffe066');
    if (a >= 1) {
      button(x + 24, y + 222, w / 2 - 36, 54, '🎉 Party again', () => { E = { t: 0, parts: [], rockets: [], cakeY: -260, cakeVy: 0, cakeLanded: false, shake: 0 }; }, '#ff5fa2', 20);
      button(x + w / 2 + 12, y + 222, w / 2 - 36, 54, '🗺️ Map', () => setState('map'), '#9b6bff', 20);
    }
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  const t = globalT;
  if (state !== 'play' && state !== 'pause' && state !== 'clear' && state !== 'ending') {
    if (state === 'title') { uiButtons = []; drawTitle(t); }
    else if (state === 'hero') drawHeroPick(t);
    else if (state === 'map') drawMap(t);
  } else if (state === 'play') { uiButtons = []; drawPlay(t); }
  else if (state === 'pause') drawPause(t);
  else if (state === 'clear') drawClear(t);
  else if (state === 'ending') drawEnding(t);
  if (uiFocus >= uiButtons.length) uiFocus = 0;
}

// for testing in the browser console
window.__srh = {
  get L() { return L; }, get state() { return state; }, get E() { return E; },
  loadLevel, setState, finishLevel, startEnding,
  get hero() { return hero; }, set hero(h) { hero = h; },
  freeze: false,
  // run the game for n frames with the given keys held down (used by tests)
  sim(n, keys = {}) {
    for (const k in keyState) keyState[k] = false;
    for (let i = 0; i < n; i++) {
      for (const k of ['left', 'right', 'jump', 'down', 'power', 'swap']) keyState[k] = !!(typeof keys[k] === 'function' ? keys[k](i) : keys[k]);
      update();
    }
    for (const k in keyState) keyState[k] = false;
    update();
  },
};

setState('title');
requestAnimationFrame(frame);
})();
