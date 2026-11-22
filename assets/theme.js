// Theme boot + toggle. Runs before paint so there is no light flash on a
// dark-preferring browser. Three states: light / dark / auto (no attribute).
//
// Behaviour matches viz's framework/theme-boot.js by contract -- the same three
// modes, the same cycle order, the same glyphs, and the same tooltip that spells
// out what `auto` is currently resolving to (the glyph cannot say it). The
// storage key stays per-site because these are separate origins and a shared
// name would buy nothing; everything a visitor SEES is the same.
(function () {
  var KEY = "arch-theme";
  var MODES = { light: "light", dark: "dark", auto: "auto" };
  var GLYPH = { light: "☀", dark: "☾", auto: "A" };
  var NEXT = { light: "dark", dark: "auto", auto: "light" };

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  if (saved === MODES.light || saved === MODES.dark) {
    document.documentElement.setAttribute("data-theme", saved);
  }

  function current() {
    return document.documentElement.getAttribute("data-theme") || "auto";
  }

  function systemTheme() {
    return (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }

  function title(mode) {
    var now = mode === "auto" ? "auto (system: " + systemTheme() + ")" : mode;
    return "Theme: " + now + " — click for " + NEXT[mode];
  }

  function apply(mode) {
    if (mode === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    try {
      if (mode === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch (e) { /* ignore */ }
    label();
  }

  function label() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    var m = current();
    btn.textContent = GLYPH[m];
    btn.title = title(m);
    btn.setAttribute("aria-label", title(m));
  }

  // The site's mark: favicon.svg (switches with the OS scheme) as the icon, and the light and
  // dark drawings before the site name in the bar, switched in CSS by the same three states as
  // the colours. Paths come from this script's own URL, so every page depth resolves them.
  var ASSETS = (document.currentScript && document.currentScript.src || "").replace(/[^/]*$/, "");
  if (ASSETS && !document.querySelector("link[rel~='icon']")) {
    var icon = document.createElement("link");
    icon.rel = "icon"; icon.type = "image/svg+xml"; icon.href = ASSETS + "favicon.svg";
    document.head.appendChild(icon);
  }
  function mark() {
    var brand = document.querySelector(".brand");
    if (!ASSETS || !brand || brand.querySelector(".brand-mark")) return;
    ["light", "dark"].forEach(function (v) {
      var img = document.createElement("img");
      img.className = "brand-mark " + (v === "light" ? "lt" : "dk");
      img.src = ASSETS + "mark-" + v + ".svg"; img.alt = "";
      brand.appendChild(img);
    });
    brand.appendChild(brand.firstChild);          // the name text after the two marks
  }

  window.addEventListener("DOMContentLoaded", function () {
    mark();
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    label();
    btn.addEventListener("click", function () { apply(NEXT[current()]); });
  });
})();
