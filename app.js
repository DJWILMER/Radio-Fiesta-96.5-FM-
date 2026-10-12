"use strict";

/* =========================================================================
   RADIO FIESTA 96.5 FM - Tacna, Perú
   Player PWA (PC y Móvil)
   ========================================================================= */

const CONFIG = {
  name: "Radio Fiesta 96.5 FM",
  city: "Tacna, Perú",
  streamUrl: "https://sp.oyotunstream.com/8116/;",
  metaUrl: "https://sp.oyotunstream.com/cp/get_info.php?p=8116",
  metaShoutcast: "https://sp.oyotunstream.com/8116/7.html",
  metaProxy: "proxy.php?p=8116",
  logo: "assets/logo.jpg",
  metaInterval: 12000,

  /* ---- REDES SOCIALES (edita los enlaces "url" con los reales) ---- */
  socials: [
    { name: "Facebook",  handle: "@RadioFiesta965", url: "https://www.facebook.com/profile.php?id=61552470795943", icon: "f",  color: "#1877f2" },
    { name: "WhatsApp",  handle: "Compartir",       url: "https://wa.link/ui95ol", icon: "\uD83D\uDCAC", color: "#25d366" },
    { name: "Instagram", handle: "Buscar",          url: "https://www.instagram.com", icon: "\uD83D\uDCF7", color: "#e1306c" },
    { name: "TikTok",    handle: "Buscar",          url: "https://www.tiktok.com", icon: "\u266A", color: "#111111" },
    { name: "YouTube",   handle: "Buscar",          url: "https://www.youtube.com/", icon: "\u25B6", color: "#ff0000" },
    { name: "Sitio Web ",         handle: " En Vvivo",          url: "https://radiofiestatacnaperu.blogspot.com/", icon: "\uD835\uDD4F", color: "#111111" }
  ]
};

const STORAGE = {
  volume: "rf.volume",
  muted: "rf.muted",
  history: "rf.history"
};

const els = {
  play: document.getElementById("playBtn"),
  playIcon: document.getElementById("playIcon"),
  prev: document.getElementById("prevBtn"),
  next: document.getElementById("nextBtn"),
  volume: document.getElementById("volume"),
  mute: document.getElementById("muteBtn"),
  muteIcon: document.getElementById("muteIcon"),
  share: document.getElementById("shareBtn"),
  npTitle: document.getElementById("npTitle"),
  npArtist: document.getElementById("npArtist"),
  npMeta: document.getElementById("npMeta"),
  quality: document.getElementById("qualityTag"),
  status: document.getElementById("statusMsg"),
  install: document.getElementById("installBtn"),
  net: document.getElementById("netStatus"),
  historyList: document.getElementById("historyList"),
  historyEmpty: document.getElementById("historyEmpty"),
  clearHistory: document.getElementById("clearHistory"),
  socialGrid: document.getElementById("socialGrid"),
  particles: document.getElementById("particles"),
  year: document.getElementById("year")
};

const audio = new Audio();
audio.preload = "none";
audio.volume = 0.9;

let deferredPrompt = null;
let metaTimer = null;
let lastNowPlaying = "";
let history = [];

/* ------------------------------ Storage ------------------------------ */
function save(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
function load(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }

/* ------------------------------ Helpers ------------------------------ */
function setStatus(msg) { els.status.textContent = msg || ""; }

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return "hace " + m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return "hace " + h + " h";
  return new Date(ts).toLocaleDateString();
}

/* ------------------------------ Player ------------------------------ */
function setPlaying(playing) {
  document.body.classList.toggle("playing", playing);
  els.playIcon.classList.toggle("pause", playing);
  if (!("mediaSession" in navigator)) return;
  try { navigator.mediaSession.playbackState = playing ? "playing" : "paused"; } catch (_) {}
}

function playStream() {
  els.play.classList.add("loading");
  setStatus("");
  audio.src = CONFIG.streamUrl;
  audio.load();
  const p = audio.play();
  if (p && typeof p.catch === "function") {
    p.catch(err => {
      els.play.classList.remove("loading");
      setStatus("No se pudo iniciar la reproducción: " + err.message + ". Toca de nuevo.");
    });
  }
}

function togglePlay() {
  if (audio.paused || audio.ended) playStream();
  else audio.pause();
}

function changeVolume(delta) {
  const v = Math.min(1, Math.max(0, Math.round((audio.volume + delta) * 10) / 10));
  applyVolume(v);
  if (v > 0 && audio.muted) setMuted(false);
}

function applyVolume(v) {
  const val = Math.min(1, Math.max(0, Number(v)));
  audio.volume = val;
  els.volume.value = String(val);
  save(STORAGE.volume, String(val));
}

function setMuted(muted) {
  audio.muted = muted;
  els.muteIcon.innerHTML = muted ? "&#128263;" : "&#128266;";
  els.mute.setAttribute("aria-label", muted ? "Activar sonido" : "Silenciar");
  save(STORAGE.muted, muted ? "1" : "0");
}

/* ------------------------------ Metadata API ------------------------------ */
function extractMeta(data) {
  // Normaliza la respuesta de la API a { title, artist }
  let obj = data;
  if (typeof obj === "string") {
    const txt = obj.trim();
    if (!txt) return null;
    try { obj = JSON.parse(txt); } catch (_) { return splitTitle(txt); }
  }
  if (Array.isArray(obj)) obj = obj[0];
  if (!obj || typeof obj !== "object") return null;

  const pick = (...keys) => {
    for (const k of keys) {
      if (obj[k] != null && String(obj[k]).trim() !== "") return String(obj[k]).trim();
    }
    return "";
  };

  let title = pick("title", "songtitle", "song", "track", "nowplaying", "now_playing", "currentsong", "current");
  let artist = pick("artist", "artista", "author", "singer");

  if (!title) return null;
  if (!artist) {
    const sp = splitTitle(title);
    if (sp.artist) { artist = sp.artist; title = sp.title; }
  }
  return cleanMeta(artist, title);
}

function splitTitle(text) {
  const seps = [" - ", " – ", " — ", " | "];
  for (const sep of seps) {
    const i = text.indexOf(sep);
    if (i > 0) return { artist: text.slice(0, i).trim(), title: text.slice(i + sep.length).trim() };
  }
  return { title: text, artist: "" };
}

function cleanMeta(artist, title) {
  let t = String(title || "").replace(/^[\s?？!¡¿*:：.]+/, "").trim();
  if (artist) {
    const e = String(artist).trim().split(/\s+/).map(esc).join("\\s+");
    t = t.replace(new RegExp("^" + e + "\\s*[-–—·|]\\s*", "i"), "").trim();
  }
  const a = String(artist || "").trim();
  return { title: t || "En el aire", artist: a };
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function parseShoutcast(text) {
  // Formato 7.html: oyentes,estado,peak,max,uniques,bitrate,titulo
  const s = String(text || "").replace(/<[^>]+>/g, "").trim();
  if (!s || /offline/i.test(s)) return { offline: true };
  if (!/^\d/.test(s)) return { offline: true };
  const parts = s.split(",");
  const status = Number(parts[1]);
  if (status !== 1) return { offline: true };
  const meta = { listeners: parts[0], bitrate: parts[5] || "", offline: false };
  const song = (parts[6] || "").trim();
  if (!song) return meta;
  const sp = splitTitle(song);
  return Object.assign(meta, cleanMeta(sp.artist, sp.title));
}

function showMetaLine(meta) {
  const bits = [];
  const lst = Number(meta && meta.listeners);
  if (lst > 0) bits.push("🎧 " + lst + " oyentes");
  if (meta && meta.bitrate) bits.push(meta.bitrate + " kbps");
  els.npMeta.textContent = bits.join("   ·   ");
}

function showNowPlaying(meta) {
  if (!meta || !meta.title) {
    els.npMeta.textContent = "";
    return;
  }
  els.npTitle.textContent = meta.title;
  els.npArtist.textContent = meta.artist || CONFIG.name;
  els.npArtist.classList.toggle("muted", !meta.artist);

  const key = (meta.artist + " - " + meta.title).toLowerCase();
  if (key !== lastNowPlaying) {
    lastNowPlaying = key;
    addToHistory(meta);
  }
  updateMediaSession(meta);
}

async function fetchJson() {
  try {
    const res = await fetch(CONFIG.metaUrl + "&_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    const meta = extractMeta(text);
    return meta && meta.title && meta.title !== "En el aire" ? meta : null;
  } catch (_) { return null; }
}

async function fetchShoutcast(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (text.includes("\uFFFD")) text = new TextDecoder("windows-1252").decode(buf);
    const meta = parseShoutcast(text);
    if (!meta.offline && meta.title) {
      return { listeners: meta.listeners, bitrate: meta.bitrate, title: meta.title, artist: meta.artist };
    }
    return null;
  } catch (_) { return null; }
}

async function fetchMeta() {
  let meta = await fetchJson();                            // API oficial (con CORS)
  if (!meta) meta = await fetchShoutcast(CONFIG.metaShoutcast); // 7.html directo (mismo origen)
  if (!meta) meta = await fetchShoutcast(CONFIG.metaProxy);     // proxy.php (puente PHP)

  if (!meta) {
    if (!lastNowPlaying) {
      els.npTitle.textContent = "Transmitiendo en vivo";
      els.npArtist.textContent = CONFIG.name;
      els.npArtist.classList.add("muted");
      els.npMeta.textContent = "";
    }
    return;
  }
  showNowPlaying(meta);
  showMetaLine(meta);
}

/* ------------------------------ Historial ------------------------------ */
function addToHistory(meta) {
  history.unshift({ title: meta.title, artist: meta.artist || "", ts: Date.now() });
  history = history.slice(0, 40);
  save(STORAGE.history, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  els.historyList.innerHTML = "";
  els.historyEmpty.classList.toggle("hidden", history.length > 0);
  history.forEach(item => {
    const li = document.createElement("li");

    const img = document.createElement("img");
    img.className = "h-cover";
    img.src = CONFIG.logo;
    img.alt = "";
    img.loading = "lazy";

    const body = document.createElement("div");
    body.className = "h-body";
    const t = document.createElement("div");
    t.className = "h-title";
    t.textContent = item.title;
    const a = document.createElement("div");
    a.className = "h-artist";
    a.textContent = item.artist || CONFIG.name;
    body.appendChild(t);
    body.appendChild(a);

    const time = document.createElement("div");
    time.className = "h-time";
    time.textContent = timeAgo(item.ts);
    time.title = new Date(item.ts).toLocaleString();

    li.appendChild(img);
    li.appendChild(body);
    li.appendChild(time);
    els.historyList.appendChild(li);
  });
}

function loadHistory() {
  try { history = JSON.parse(load(STORAGE.history) || "[]"); } catch (_) { history = []; }
  if (!Array.isArray(history)) history = [];
  renderHistory();
}

/* ------------------------------ Redes sociales ------------------------------ */
function renderSocials() {
  els.socialGrid.innerHTML = "";
  CONFIG.socials.forEach(s => {
    const a = document.createElement("a");
    a.className = "social";
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const ic = document.createElement("span");
    ic.className = "s-icon";
    ic.style.background = s.color;
    ic.textContent = s.icon;

    const body = document.createElement("div");
    const nm = document.createElement("div");
    nm.className = "s-name";
    nm.textContent = s.name;
    const hd = document.createElement("div");
    hd.className = "s-handle";
    hd.textContent = s.handle;
    body.appendChild(nm);
    body.appendChild(hd);

    a.appendChild(ic);
    a.appendChild(body);
    els.socialGrid.appendChild(a);
  });
}

/* ------------------------------ Media Session ------------------------------ */
function updateMediaSession(meta) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: meta && meta.title ? meta.title : CONFIG.name,
    artist: meta && meta.artist ? meta.artist : CONFIG.city,
    album: CONFIG.name,
    artwork: [
      { src: CONFIG.logo, sizes: "512x512", type: "image/jpeg" },
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  });
}

function setupMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const handlers = {
    play: () => playStream(),
    pause: () => audio.pause(),
    stop: () => { audio.pause(); audio.removeAttribute("src"); setPlaying(false); },
    previoustrack: () => changeVolume(-0.1),
    nexttrack: () => changeVolume(0.1)
  };
  for (const [action, fn] of Object.entries(handlers)) {
    try { navigator.mediaSession.setActionHandler(action, fn); } catch (_) {}
  }
}

/* ------------------------------ Instalación ------------------------------ */
function setupInstall() {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    els.install.classList.remove("hidden");
  });
  els.install.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.install.classList.add("hidden");
  });
  window.addEventListener("appinstalled", () => els.install.classList.add("hidden"));
}

/* ------------------------------ Conexión ------------------------------ */
function setupNetwork() {
  const update = () => {
    const on = navigator.onLine;
    els.net.classList.toggle("online", on);
    els.net.classList.toggle("offline", !on);
    els.net.title = on ? "En línea" : "Sin conexión";
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

/* ------------------------------ Efectos (partículas) ------------------------------ */
function setupParticles() {
  const n = window.innerWidth < 600 ? 22 : 44;
  let html = "";
  for (let i = 0; i < n; i++) {
    const size = (Math.random() * 3 + 2).toFixed(1);
    const left = (Math.random() * 100).toFixed(1);
    const dur = (Math.random() * 12 + 10).toFixed(1);
    const delay = (Math.random() * 14).toFixed(1);
    const hue = ["#4a94ff", "#37e39c", "#ffe37a"][i % 3];
    html += `<i style="left:${left}%;width:${size}px;height:${size}px;background:${hue};animation-duration:${dur}s;animation-delay:${delay}s"></i>`;
  }
  els.particles.innerHTML = html;
}

/* ------------------------------ Compartir ------------------------------ */
async function share() {
  const data = {
    title: CONFIG.name,
    text: "Escucha " + CONFIG.name + " en vivo desde " + CONFIG.city,
    url: location.href
  };
  try {
    if (navigator.share) { await navigator.share(data); return; }
    await navigator.clipboard.writeText(data.text + " " + location.href);
    setStatus("Enlace copiado al portapapeles.");
  } catch (_) {}
}

/* ------------------------------ Init ------------------------------ */
function init() {
  els.year.textContent = new Date().getFullYear();
  renderSocials();
  setupParticles();
  loadHistory();

  if (!("mediaSession" in navigator)) { /* sin soporte: ok */ }
  updateMediaSession(null);

  els.play.addEventListener("click", togglePlay);
  els.prev.addEventListener("click", () => changeVolume(-0.1));
  els.next.addEventListener("click", () => changeVolume(0.1));
  els.share.addEventListener("click", share);
  els.clearHistory.addEventListener("click", () => {
    history = []; save(STORAGE.history, "[]"); renderHistory();
  });

  els.volume.addEventListener("input", e => applyVolume(e.target.value));
  els.mute.addEventListener("click", () => setMuted(!audio.muted));

  audio.addEventListener("playing", () => {
    els.play.classList.remove("loading");
    setPlaying(true);
    setStatus("");
  });
  audio.addEventListener("waiting", () => { els.play.classList.add("loading"); setStatus("Conectando…"); });
  audio.addEventListener("pause", () => { els.play.classList.remove("loading"); setPlaying(false); });
  audio.addEventListener("ended", () => { els.play.classList.remove("loading"); setPlaying(false); });
  audio.addEventListener("error", () => {
    els.play.classList.remove("loading");
    setPlaying(false);
    setStatus("Señal no disponible. Verifica tu conexión e inténtalo de nuevo.");
  });

  const savedVol = load(STORAGE.volume);
  applyVolume(savedVol != null ? savedVol : 0.9);
  if (load(STORAGE.muted) === "1") setMuted(true);

  setupMediaSession();
  setupInstall();
  setupNetwork();

  // Actualiza "hace X" del historial cada minuto
  setInterval(renderHistory, 60000);

  // Refresca metadatos
  fetchMeta();
  metaTimer = setInterval(fetchMeta, CONFIG.metaInterval);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) fetchMeta();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
}

init();
