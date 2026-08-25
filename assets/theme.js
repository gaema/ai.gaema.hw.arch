// Theme boot + toggle. Runs before paint so there is no light flash on a
// dark-preferring browser. Three states: light / dark / auto (no attribute).
(function () {
  var KEY = "arch-theme";
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  if (saved === "light" || saved === "dark") {
    document.documentElement.setAttribute("data-theme", saved);
  }

  function current() {
    return document.documentElement.getAttribute("data-theme") || "auto";
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
    btn.textContent = m === "light" ? "Light" : m === "dark" ? "Dark" : "Auto";
    btn.setAttribute("aria-label", "Colour theme: " + btn.textContent + ". Click to change.");
  }

  window.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    label();
    btn.addEventListener("click", function () {
      var order = ["auto", "light", "dark"];
      apply(order[(order.indexOf(current()) + 1) % order.length]);
    });
  });
})();
