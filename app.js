/**
 * @name YLIONLanding
 * @description Runtime autónomo de la landing YLION SIEF (dirección 1a "Constelación"),
 *   compilado desde el canvas de Claude Design. Gestiona idioma (6), tema claro/oscuro,
 *   animaciones de aparición, fondo Three.js de partículas y el formulario de contacto
 *   (validación, honeypot, rate-limit, captcha propio y envío al backend ./contacto.php).
 */
(function () {
  "use strict";
  var D = window.YLION_DATA || { content: {}, themeVars: {}, conPalette: {}, capIcons: {} };
  var content = D.content, themeVars = D.themeVars, conPalette = D.conPalette, capIcons = D.capIcons;

  /** Configuración fija (props del diseño original). */
  var CFG = { defaultLang: "es", defaultTheme: "dark", contactEmail: "soporte@ylion.net", motion: "calm", density: 1.6 };
  var LANGS = [
    { code: "es", name: "Español", flag: "es" },
    { code: "en", name: "English", flag: "gb" },
    { code: "pt", name: "Português", flag: "pt" },
    { code: "fr", name: "Français", flag: "fr" },
    { code: "zh", name: "中文", flag: "cn" },
    { code: "ar", name: "العربية", flag: "sa" }
  ];

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var state = {
    lang: ls("ylion-lang") || CFG.defaultLang,
    theme: ls("ylion-theme") || CFG.defaultTheme,
    langOpen: false,
    fStatus: "idle", cool: 0, fTried: false, fErrSend: false,
    capOpen: false, capTarget: "wrench", capTiles: [], capSel: [], capFails: 0, capErrShown: false
  };
  var _fTouch = 0, _coolT = null, con = null, speed = 0, density = 1.6, reduced = false, mouse = { x: 0, y: 0 };

  function getLang() { return (content[state.lang] ? state.lang : CFG.defaultLang); }
  function t() { return content[getLang()] || content.es || {}; }
  function isLight() { return state.theme === "light"; }

  /* ---------- Tema ---------- */
  function applyTheme() {
    var vars = themeVars[isLight() ? "light" : "dark"] || {};
    var root = document.documentElement;
    for (var k in vars) root.style.setProperty(k, vars[k]);
    root.setAttribute("data-theme", isLight() ? "light" : "dark");
    $("iconMoon").style.display = isLight() ? "none" : "";
    $("iconSun").style.display = isLight() ? "" : "none";
    themeConstellation(isLight());
  }
  function setTheme(th) { state.theme = th; save("ylion-theme", th); applyTheme(); }
  function toggleTheme() { setTheme(isLight() ? "dark" : "light"); }

  /* ---------- Idioma ---------- */
  function setLang(code) { state.lang = code; save("ylion-lang", code); state.langOpen = false; renderLangMenu(); applyLang(); }
  function toggleLangOpen() { state.langOpen = !state.langOpen; renderLangMenu(); }
  function closeLang() { state.langOpen = false; renderLangMenu(); }

  function renderLangMenu() {
    var menu = $("langMenu"), scrim = $("langScrim"), lang = getLang();
    menu.style.display = state.langOpen ? "flex" : "none";
    scrim.style.display = state.langOpen ? "block" : "none";
    if (!state.langOpen && menu.__built) return;
    menu.innerHTML = LANGS.map(function (l) {
      var dot = l.code === lang ? '<span style="width:6px;height:6px;border-radius:50%;background:#F18F01;flex:none;"></span>' : "";
      return '<button type="button" data-code="' + l.code + '" data-hv="background:var(--ctl-hover);" style="display:flex;align-items:center;gap:11px;width:100%;padding:9px 11px;background:transparent;border:none;border-radius:9px;cursor:pointer;color:var(--ctl-fg);font:500 13.5px \'IBM Plex Sans\',system-ui,sans-serif;text-align:left;transition:background .18s;">' +
        '<span style="width:21px;height:21px;flex:none;box-shadow:0 0 0 1px var(--ctl-border);border-radius:50%;overflow:hidden;display:flex;"><img data-code="' + l.flag + '" alt="" style="width:21px;height:21px;object-fit:cover;display:block;"></span>' +
        '<span style="flex:1;white-space:nowrap;">' + esc(l.name) + '</span>' + dot + '</button>';
    }).join("");
    menu.__built = true;
    Array.prototype.forEach.call(menu.querySelectorAll("button[data-code]"), function (b) {
      b.addEventListener("click", function () { setLang(b.getAttribute("data-code")); });
    });
    bindStateStyles(menu);
    applyFlags();
  }

  function applyFlags() {
    var imgs = document.querySelectorAll("img[data-code]");
    for (var i = 0; i < imgs.length; i++) {
      var c = imgs[i].getAttribute("data-code"); if (!c) continue;
      var url = "./flags/" + c + ".svg";
      if (imgs[i].getAttribute("src") !== url) imgs[i].setAttribute("src", url);
    }
  }

  function applyLang() {
    var lang = getLang(), tt = t(), dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang; document.documentElement.dir = dir; $("site").dir = dir;
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i], key = el.getAttribute("data-i18n"), v = tt[key];
      if (v == null) continue;
      var suf = el.getAttribute("data-i18n-suffix");
      el.textContent = suf ? (v + suf) : v;
    }
    var phs = document.querySelectorAll("[data-i18n-ph]");
    for (var j = 0; j < phs.length; j++) { var pv = tt[phs[j].getAttribute("data-i18n-ph")]; if (pv != null) phs[j].setAttribute("placeholder", pv); }
    $("langCode").textContent = (lang || "es").toUpperCase();
    renderModules(tt); renderBenefits(tt);
    registerReveals($("modulesGrid")); registerReveals($("benefitsGrid"));
    updateMsgCount(); updateFormUI(); updateErrors();
    if (state.capOpen) { $("capTargetName").textContent = (tt.capNames && tt.capNames[state.capTarget]) || ""; }
  }

  function renderModules(tt) {
    var grid = $("modulesGrid");
    grid.innerHTML = (tt.modules || []).map(function (m) {
      return '<div data-reveal="scale"><div class="mod-card">' +
        '<div style="display:inline-flex;font:500 11px/1 \'IBM Plex Mono\',monospace;letter-spacing:.1em;color:#F18F01;background:rgba(241,143,1,.1);padding:6px 9px;border-radius:7px;margin-bottom:20px;">' + esc(m.n) + '</div>' +
        '<h3 style="margin:0 0 10px;font:600 18px/1.2 \'Sora\',sans-serif;letter-spacing:-.01em;color:var(--heading-2);">' + esc(m.title) + '</h3>' +
        '<p style="margin:0;font:400 14px/1.6 \'IBM Plex Sans\',sans-serif;color:var(--muted-3);">' + esc(m.desc) + '</p></div></div>';
    }).join("");
    bindStateStyles(grid);
  }

  function renderBenefits(tt) {
    var grid = $("benefitsGrid");
    grid.innerHTML = (tt.benefits || []).map(function (b) {
      return '<div data-reveal="1"><div style="width:12px;height:12px;border-radius:50%;background:#F18F01;margin:0 auto 22px;box-shadow:0 0 0 6px rgba(241,143,1,.12);"></div>' +
        '<h3 style="margin:0 0 12px;font:600 21px/1.25 \'Sora\',sans-serif;letter-spacing:-.01em;color:var(--heading-2);">' + esc(b.title) + '</h3>' +
        '<p style="margin:0 auto;font:400 15px/1.65 \'IBM Plex Sans\',sans-serif;color:var(--muted-3);max-width:36ch;">' + esc(b.desc) + '</p></div>';
    }).join("");
  }

  /* ---------- Hover/focus shim (replica style-hover / style-focus del diseño) ---------- */
  function parseDecls(s) { return String(s || "").split(";").map(function (d) { return d.trim(); }).filter(Boolean).map(function (d) { var i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; }); }
  function bindStateStyles(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-hv]"), function (el) {
      if (el.__hv) return; el.__hv = true;
      var decls = parseDecls(el.getAttribute("data-hv"));
      el.addEventListener("mouseenter", function () { el.__hvSaved = {}; decls.forEach(function (d) { el.__hvSaved[d[0]] = el.style.getPropertyValue(d[0]); el.style.setProperty(d[0], d[1]); }); });
      el.addEventListener("mouseleave", function () { if (el.__hvSaved) { decls.forEach(function (d) { el.style.setProperty(d[0], el.__hvSaved[d[0]]); }); el.__hvSaved = null; } });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-fc]"), function (el) {
      if (el.__fc) return; el.__fc = true;
      var decls = parseDecls(el.getAttribute("data-fc"));
      el.addEventListener("focus", function () { el.__fcSaved = {}; decls.forEach(function (d) { el.__fcSaved[d[0]] = el.style.getPropertyValue(d[0]); el.style.setProperty(d[0], d[1]); }); });
      el.addEventListener("blur", function () { if (el.__fcSaved) { decls.forEach(function (d) { el.style.setProperty(d[0], el.__fcSaved[d[0]]); }); el.__fcSaved = null; } });
    });
  }

  /* ---------- Formulario ---------- */
  function fields() { return { name: $("fName").value, email: $("fEmail").value, phone: $("fPhone").value, msg: $("fMsg").value }; }
  function updateMsgCount() { $("msgCount").textContent = ($("fMsg").value || "").length + "/1000"; }

  function validateF() {
    var f = fields(), e = {};
    if (f.name.trim().length < 2) e.name = f.name.trim() ? "eName" : "eReq";
    var em = f.email.trim();
    if (!em) e.email = "eReq"; else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em) || em.length > 120) e.email = "eEmail";
    var ph = f.phone.trim();
    if (ph && !/^[+\d][\d\s().\-]{6,18}$/.test(ph)) e.phone = "ePhone";
    var mg = f.msg.trim();
    if (!mg) e.msg = "eReq"; else if (mg.length < 10) e.msg = "eMsg";
    if (!$("fPrivacy").checked) e.privacy = "ePrivacy";
    return e;
  }
  function setErr(id, key) { var el = $(id), tt = t(); if (key) { el.textContent = tt[key] || ""; el.style.display = ""; } else { el.style.display = "none"; } }
  function updateErrors() {
    var e = state.fTried ? validateF() : {};
    setErr("errName", e.name); setErr("errEmail", e.email); setErr("errPhone", e.phone); setErr("errMsg", e.msg); setErr("errPrivacy", e.privacy);
  }

  function updateFormUI() {
    var tt = t(), fs = state.fStatus, cool = state.cool || 0;
    $("formFields").style.display = fs === "sent" ? "none" : "";
    $("sentBlock").style.display = fs === "sent" ? "block" : "none";
    var btn = $("sendBtn");
    btn.disabled = (fs === "sending" || fs === "limited" || cool > 0);
    btn.style.opacity = btn.disabled ? ".6" : "1";
    btn.style.cursor = btn.disabled ? "not-allowed" : "pointer";
    btn.textContent = fs === "sending" ? tt.fSending : tt.fSend;
    var coolOn = cool > 0 && fs !== "limited";
    $("coolNote").style.display = coolOn ? "" : "none";
    if (coolOn) $("coolNote").textContent = tt.fCooldown + " " + cool + " s";
    $("limitMsg").style.display = fs === "limited" ? "" : "none";
    if (fs === "limited") $("limitMsg").textContent = tt.fLimit;
    $("sendFailMsg").style.display = state.fErrSend ? "" : "none";
  }

  function sendLog() { try { var a = JSON.parse(ls("ylion-contact-log") || "[]"); return Array.isArray(a) ? a.filter(function (x) { return typeof x === "number"; }) : []; } catch (e) { return []; } }
  function pushSend(ti) { var a = sendLog(); a.push(ti); save("ylion-contact-log", JSON.stringify(a.slice(-10))); }

  function syncCool() {
    var log = sendLog(), now = Date.now();
    var hour = log.filter(function (x) { return now - x < 3600000; });
    var last = hour.length ? Math.max.apply(null, hour) : 0;
    var sendRem = last ? Math.ceil(Math.max(0, 60000 - (now - last)) / 1000) : 0;
    var capLock = parseInt(ls("ylion-cap-lock") || "0", 10) || 0;
    var capRem = Math.ceil(Math.max(0, capLock - now) / 1000);
    var rem = Math.max(sendRem, capRem);
    var limited = hour.length >= 3;
    var st = state.fStatus;
    if (st !== "sent" && st !== "sending") st = limited ? "limited" : (st === "limited" ? "idle" : st);
    state.cool = rem; state.fStatus = st;
    updateFormUI();
    if ((rem > 0 || limited) && !_coolT) _coolT = setInterval(syncCool, 1000);
    if (rem <= 0 && !limited && _coolT) { clearInterval(_coolT); _coolT = null; }
  }

  /* ---------- Captcha ---------- */
  function genCap() {
    var types = Object.keys(capIcons);
    var target = types[Math.floor(Math.random() * types.length)];
    var count = 3 + Math.floor(Math.random() * 2);
    var others = types.filter(function (x) { return x !== target; });
    var tiles = [], i;
    for (i = 0; i < count; i++) tiles.push(target);
    while (tiles.length < 9) tiles.push(others[Math.floor(Math.random() * others.length)]);
    for (i = tiles.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = tiles[i]; tiles[i] = tiles[j]; tiles[j] = tmp; }
    state.capTarget = target; state.capTiles = tiles; state.capSel = tiles.map(function () { return false; });
  }
  function renderCaptcha() {
    var modal = $("capModal"), tt = t();
    modal.style.display = state.capOpen ? "flex" : "none";
    if (!state.capOpen) return;
    $("capTargetName").textContent = (tt.capNames && tt.capNames[state.capTarget]) || "";
    $("capErr").style.display = state.capErrShown ? "" : "none";
    if (state.capErrShown) $("capErr").textContent = tt.capErr || "";
    var grid = $("capGrid");
    grid.innerHTML = state.capTiles.map(function (tp, i) {
      var sel = !!state.capSel[i];
      var bc = sel ? "#F18F01" : "rgba(255,255,255,.12)", bg = sel ? "rgba(241,143,1,.14)" : "rgba(255,255,255,.03)";
      var check = sel ? '<span style="position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:50%;background:#F18F01;display:flex;align-items:center;justify-content:center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0A0B0E" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span>' : "";
      return '<button type="button" data-i="' + i + '" style="position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:12px;cursor:pointer;color:#C9CFD8;border:2px solid ' + bc + ';background:' + bg + ';transition:border-color .15s,background .15s;">' +
        '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="' + capIcons[tp] + '"></path></svg>' + check + '</button>';
    }).join("");
    Array.prototype.forEach.call(grid.querySelectorAll("button[data-i]"), function (b) {
      b.addEventListener("click", function () { var i = +b.getAttribute("data-i"); state.capSel[i] = !state.capSel[i]; renderCaptcha(); });
    });
  }
  function cancelCap() { state.capOpen = false; state.capErrShown = false; renderCaptcha(); }
  function verifyCap() {
    var s = state;
    var ok = s.capTiles.length > 0 && s.capTiles.every(function (tp, i) { return !!s.capSel[i] === (tp === s.capTarget); });
    if (ok) { s.capOpen = false; s.capErrShown = false; s.capFails = 0; renderCaptcha(); doSend(); return; }
    var fails = (s.capFails || 0) + 1;
    if (fails >= 3) { save("ylion-cap-lock", String(Date.now() + 90000)); s.capOpen = false; s.capErrShown = false; s.capFails = 0; renderCaptcha(); syncCool(); return; }
    s.capFails = fails; s.capErrShown = true; genCap(); renderCaptcha();
  }

  /* ---------- Envío ---------- */
  function doSend() {
    state.fStatus = "sending"; state.fErrSend = false; updateFormUI();
    var f = fields();
    var payload = {
      name: f.name.trim().slice(0, 80),
      email: f.email.trim().slice(0, 120),
      phone: f.phone.trim().slice(0, 20) || "-",
      message: f.msg.trim().slice(0, 1000),
      website: $("hp").value
    };
    var done = function (okr) {
      if (okr) { pushSend(Date.now()); state.fStatus = "sent"; state.fTried = false; }
      else { state.fStatus = "idle"; state.fErrSend = true; }
      updateFormUI(); syncCool();
    };
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
    fetch("contacto.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      r.json().then(
        function (j) { done(!!j && j.success === true); },
        function () { done(false); }
      );
    }).catch(function () { clearTimeout(timer); done(false); });
  }

  function submitF(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var s = state;
    if (s.fStatus === "sending" || s.fStatus === "sent" || s.fStatus === "limited" || s.cool > 0 || s.capOpen) return;
    var errs = validateF();
    if (Object.keys(errs).length) { s.fTried = true; updateErrors(); return; }
    var hp = $("hp").value;
    var tooFast = !_fTouch || Date.now() - _fTouch < 2500;
    if (hp || tooFast) { s.fStatus = "sent"; s.fTried = false; updateFormUI(); return; }
    var log = sendLog(), now = Date.now();
    var hour = log.filter(function (x) { return now - x < 3600000; });
    if (hour.length >= 3 || (hour.length && now - Math.max.apply(null, hour) < 60000)) { syncCool(); return; }
    s.capOpen = true; s.capErrShown = false; s.capFails = 0; s.fErrSend = false; genCap(); renderCaptcha();
  }

  function resetF() {
    state.fStatus = "idle"; state.fTried = false; state.fErrSend = false; state.capOpen = false; state.capErrShown = false;
    $("fName").value = ""; $("fEmail").value = ""; $("fPhone").value = ""; $("fMsg").value = ""; $("fPrivacy").checked = false;
    _fTouch = 0; updateMsgCount(); updateErrors(); renderCaptcha(); updateFormUI(); syncCool();
  }

  /* ---------- Aparición/desaparición al hacer scroll (bidireccional y continua) ----------
     Los elementos [data-reveal] se animan al entrar en la franja central del viewport y se
     "deshacen" al salir, en ambos sentidos del scroll, con cascada escalonada entre hermanos.
     Se reevalúa en cada scroll (no es de una sola vez), así la página respira todo el tiempo. */
  var revealVariants = { up: "translateY(34px)", left: "translateX(-46px)", right: "translateX(46px)", scale: "translateY(22px) scale(.93)", fade: "none" };
  var revealEls = [], revealRaf = 0;

  function prepReveal(el) {
    if (el.__revInit) return;
    el.__revInit = true;
    var raw = el.getAttribute("data-reveal");
    el.__revHidden = revealVariants[raw] || revealVariants.up;
    var sibs = Array.prototype.slice.call(el.parentElement.children).filter(function (c) { return c.hasAttribute("data-reveal"); });
    var idx = sibs.indexOf(el);
    el.__revDelay = idx > 0 ? idx * 80 : 0;
    el.__revShown = null;
    el.style.transition = "opacity .8s cubic-bezier(.22,.7,.2,1), transform .8s cubic-bezier(.22,.7,.2,1)";
    el.style.willChange = "opacity, transform";
    el.style.opacity = "0";
    el.style.transform = el.__revHidden;
    revealEls.push(el);
  }

  function registerReveals(root) {
    if (reduced) return;
    var els = (root || document).querySelectorAll("[data-reveal]");
    for (var i = 0; i < els.length; i++) prepReveal(els[i]);
  }

  function applyRevealState(el, show) {
    if (el.__revShown === show) return;
    el.__revShown = show;
    if (show) { el.style.transitionDelay = (el.__revDelay || 0) + "ms"; el.style.opacity = "1"; el.style.transform = "none"; }
    else { el.style.transitionDelay = "0ms"; el.style.opacity = "0"; el.style.transform = el.__revHidden; }
  }

  function checkReveals() {
    var H = window.innerHeight, states = [], i;
    // En los extremos del documento la franja se extiende hasta el borde real del viewport,
    // para que el footer (pegado abajo) y el hero (pegado arriba) — que no pueden desplazarse
    // más allá de la banda — también se revelen. Al alejarse vuelven a ocultarse.
    var atBottom = (window.innerHeight + window.pageYOffset) >= (document.documentElement.scrollHeight - 2);
    var atTop = window.pageYOffset <= 2;
    var topB = atTop ? 0 : H * 0.08, botB = atBottom ? H : H * 0.92;
    for (i = 0; i < revealEls.length; i++) {           // lecturas (sin escrituras: evita thrash de layout)
      var el = revealEls[i];
      if (!el.isConnected) { states.push(null); continue; }
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) { states.push(null); continue; }
      states.push(r.top < botB && r.bottom > topB);
    }
    for (i = 0; i < revealEls.length; i++) { if (states[i] !== null) applyRevealState(revealEls[i], states[i]); }
  }

  function setupReveal() {
    if (reduced) { var all = document.querySelectorAll("[data-reveal]"); for (var i = 0; i < all.length; i++) { all[i].style.opacity = "1"; all[i].style.transform = "none"; } return; }
    registerReveals(document);
    var onScroll = function () { if (revealRaf) return; revealRaf = requestAnimationFrame(function () { revealRaf = 0; checkReveals(); }); };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    checkReveals();
    setInterval(checkReveals, 300);
  }

  /* ---------- Fondo Three.js (constelación) ---------- */
  function waitForThree(cb) { var n = 0; (function c() { if (window.THREE) cb(); else if (n++ < 200) setTimeout(c, 50); else console.warn("[YLION] THREE no cargó; fondo estático."); })(); }

  function dotTex() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var x = c.getContext("2d");
    var gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fill();
    var tx = new THREE.Texture(c); tx.needsUpdate = true; return tx;
  }

  function initConstellation() {
    var canvas = $("conCanvas"), wrap = canvas.parentElement;
    var w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    renderer.setSize(w, h, false);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 300);
    camera.position.set(0, 0, 42);
    var group = new THREE.Group(); scene.add(group);
    var N = Math.round(820 * density), R = 34;
    var pos = new Float32Array(N * 3), col = new Float32Array(N * 3), base = new Float32Array(N * 3);
    var twk = new Float32Array(N), kind = new Uint8Array(N), P = [];
    var pal = isLight() ? conPalette.light : conPalette.dark, i, j;
    for (i = 0; i < N; i++) {
      var x = (Math.random() * 2 - 1) * R, y = (Math.random() * 2 - 1) * R * 0.6, z = (Math.random() * 2 - 1) * R * 0.72;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; P.push(x, y, z);
      var r = Math.random(), kd = r < 0.17 ? 0 : (r < 0.62 ? 1 : 2); kind[i] = kd;
      var cc = kd === 0 ? pal.or : (kd === 1 ? pal.st : pal.dm);
      base[i * 3] = cc[0]; base[i * 3 + 1] = cc[1]; base[i * 3 + 2] = cc[2];
      col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2];
      twk[i] = Math.random() * 6.28;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    var m = new THREE.PointsMaterial({ size: 1.25, sizeAttenuation: true, vertexColors: true, map: dotTex(), transparent: true, depthWrite: false, opacity: 1 });
    group.add(new THREE.Points(g, m));
    var lp = [];
    for (i = 0; i < N; i++) {
      var bj = -1, bd = 1e9, ax = P[i * 3], ay = P[i * 3 + 1], az = P[i * 3 + 2];
      for (j = 0; j < N; j++) {
        if (j === i) continue;
        var dx = ax - P[j * 3], dy = ay - P[j * 3 + 1], dz = az - P[j * 3 + 2], d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; bj = j; }
      }
      if (bj >= 0 && bd < 10) lp.push(ax, ay, az, P[bj * 3], P[bj * 3 + 1], P[bj * 3 + 2]);
    }
    var lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
    var lineMat = new THREE.LineBasicMaterial({ color: pal.line, transparent: true, opacity: pal.lineOp });
    group.add(new THREE.LineSegments(lg, lineMat));
    var ca = g.attributes.color;
    con = { N: N, base: base, kind: kind, ca: ca, lineMat: lineMat, renderer: renderer, scene: scene, camera: camera, group: group, twk: twk, active: true, loop: false, _w: 0, _h: 0 };
    con.update = function (tm, dt) {
      group.rotation.y += dt * (0.13 * speed + 0.02);
      group.rotation.x = Math.sin(tm * 0.16) * 0.06;
      var arr = ca.array;
      for (var k = 0; k < N; k++) {
        var kk = 0.72 + 0.28 * Math.sin(tm * 1.3 + twk[k]);
        arr[k * 3] = base[k * 3] * kk; arr[k * 3 + 1] = base[k * 3 + 1] * kk; arr[k * 3 + 2] = base[k * 3 + 2] * kk;
      }
      ca.needsUpdate = true;
      camera.lookAt(0, 0, 0);
    };
    con.resize = function () {
      var W2 = Math.max(1, wrap.clientWidth), H2 = Math.max(1, wrap.clientHeight);
      if (W2 === con._w && H2 === con._h) return;
      con._w = W2; con._h = H2;
      renderer.setSize(W2, H2, false); camera.aspect = W2 / H2; camera.updateProjectionMatrix();
      if (!con.loop) { try { renderer.render(scene, camera); } catch (e) {} }
    };
    con.resize();
    try { con.update(0, 0.016); renderer.render(scene, camera); } catch (e) {}
    if ("ResizeObserver" in window) { new ResizeObserver(con.resize).observe(wrap); }
    window.addEventListener("resize", con.resize, { passive: true });
    window.addEventListener("load", con.resize);
    setTimeout(con.resize, 400); setTimeout(con.resize, 1400);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { con.active = e.isIntersecting; }); }, { threshold: 0.01, rootMargin: "160px" }).observe(canvas);
    }
  }

  function themeConstellation(light) {
    if (!con) return;
    var pal = light ? conPalette.light : conPalette.dark;
    for (var i = 0; i < con.N; i++) {
      var k = con.kind[i], c = k === 0 ? pal.or : (k === 1 ? pal.st : pal.dm);
      con.base[i * 3] = c[0]; con.base[i * 3 + 1] = c[1]; con.base[i * 3 + 2] = c[2];
      con.ca.array[i * 3] = c[0]; con.ca.array[i * 3 + 1] = c[1]; con.ca.array[i * 3 + 2] = c[2];
    }
    con.ca.needsUpdate = true;
    if (con.lineMat) { con.lineMat.color.set(pal.line); con.lineMat.opacity = pal.lineOp; }
    if (!con.loop) { try { con.renderer.render(con.scene, con.camera); } catch (e) {} }
  }

  function startLoop() {
    if (!con) return; con.loop = true;
    var clock = new THREE.Clock();
    (function tick() {
      var dt = Math.min(0.05, clock.getDelta()), tm = clock.elapsedTime;
      if (con.active && con.update) { con.update(tm, dt); con.renderer.render(con.scene, con.camera); }
      requestAnimationFrame(tick);
    })();
  }

  /* ---------- Alto del hero = 100vh − header (mide el header real) ---------- */
  function sizeHeader() {
    var h = document.querySelector(".header");
    if (!h) return;
    document.documentElement.style.setProperty("--header-h", (h.offsetTop + h.offsetHeight) + "px");
  }

  /* ---------- Arranque ---------- */
  function init() {
    reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    speed = CFG.motion === "off" ? 0 : (CFG.motion === "calm" ? 0.45 : 1);
    var isMobile = !!(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
    density = Math.max(0.3, Math.min(2, isMobile ? 0.7 : CFG.density));
    if (reduced) speed = 0;

    applyTheme();
    renderLangMenu();
    applyLang();
    bindStateStyles(document);

    sizeHeader();
    window.addEventListener("resize", sizeHeader, { passive: true });
    window.addEventListener("load", sizeHeader);

    $("themeBtn").addEventListener("click", toggleTheme);
    $("langBtn").addEventListener("click", function (e) { e.stopPropagation(); toggleLangOpen(); });
    $("langScrim").addEventListener("click", closeLang);

    var onInput = function () { if (!_fTouch) _fTouch = Date.now(); };
    ["fName", "fEmail", "fPhone", "fMsg"].forEach(function (id) {
      $(id).addEventListener("input", function () { onInput(); if (id === "fMsg") updateMsgCount(); if (state.fTried) updateErrors(); });
    });
    $("fPrivacy").addEventListener("change", function () { if (state.fTried) updateErrors(); });
    $("contactForm").addEventListener("submit", submitF);
    $("resetBtn").addEventListener("click", resetF);
    $("capClose").addEventListener("click", cancelCap);
    $("capCancel").addEventListener("click", cancelCap);
    $("capVerify").addEventListener("click", verifyCap);

    syncCool();
    setupReveal();
    waitForThree(function () {
      try { initConstellation(); themeConstellation(isLight()); if (speed > 0) startLoop(); } catch (e) { console.warn("[YLION] 3D error", e); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
