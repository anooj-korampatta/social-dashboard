(() => {
  "use strict";

  const THEME_KEY = "gwc-reporting-theme";
  const html = document.documentElement;

  function normaliseTheme(value) {
    return value === "dark" ? "dark" : "light";
  }

  function currentTheme() {
    return normaliseTheme(html.getAttribute("data-theme") || localStorage.getItem(THEME_KEY));
  }

  function injectThemeStyles() {
    if (document.querySelector('link[data-gwc-theme-styles]')) return;
    const current = document.currentScript;
    if (!current || !current.src) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../css/theme.css", current.src).href;
    link.setAttribute("data-gwc-theme-styles", "true");
    document.head.appendChild(link);
  }

  function updateThemeButtons(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const dark = theme === "dark";
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      button.setAttribute("title", dark ? "Light theme" : "Dark theme");
      const icon = button.querySelector("i");
      if (icon) icon.className = dark ? "bi bi-sun" : "bi bi-moon-stars";
      const label = button.querySelector(".theme-toggle-label");
      if (label) label.textContent = dark ? "Light" : "Dark";
    });
  }

  function syncCharts(theme) {
    if (!window.Chart || !window.Chart.instances) return;
    const dark = theme === "dark";
    const text = dark ? "#AEB6C4" : "#777777";
    const grid = dark ? "#2A2F36" : "#EEEEEE";
    const tooltipBg = dark ? "#0D0F12" : "#111111";

    Object.values(window.Chart.instances).forEach((chart) => {
      try {
        const scales = chart.options && chart.options.scales ? chart.options.scales : {};
        Object.values(scales).forEach((scale) => {
          if (scale.ticks) scale.ticks.color = text;
          if (scale.grid && scale.grid.display !== false) scale.grid.color = grid;
        });

        const plugins = chart.options && chart.options.plugins ? chart.options.plugins : {};
        if (plugins.legend && plugins.legend.labels) plugins.legend.labels.color = text;
        if (plugins.tooltip) plugins.tooltip.backgroundColor = tooltipBg;

        (chart.data.datasets || []).forEach((dataset) => {
          if (dataset.label === "X") {
            dataset.borderColor = dark ? "#E8EAED" : "#111111";
            dataset.backgroundColor = dark ? "#E8EAED" : "#111111";
          } else if (!dataset.label && dataset.type !== "line") {
            if (typeof dataset.backgroundColor === "string") {
              dataset.backgroundColor = dark ? "#D5DAE1" : "#222222";
            }
          }
        });
        chart.update("none");
      } catch (error) {
        // Theme sync must never interrupt report rendering.
      }
    });
  }

  function applyTheme(theme, persist = false) {
    const next = normaliseTheme(theme);
    html.setAttribute("data-theme", next);
    html.style.colorScheme = next;
    if (persist) localStorage.setItem(THEME_KEY, next);
    updateThemeButtons(next);
    syncCharts(next);
    window.dispatchEvent(new CustomEvent("gwc:themechange", { detail: { theme: next } }));
  }

  function createThemeToggle() {
    if (document.querySelector("[data-theme-toggle]")) return;
    const dashboardActions = document.querySelector(".header-actions");
    const adminActions = document.querySelector(".admin-header-actions");
    const target = dashboardActions || adminActions;
    if (!target) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle-btn";
    button.setAttribute("data-theme-toggle", "");
    button.innerHTML = '<i class="bi bi-moon-stars" aria-hidden="true"></i><span class="theme-toggle-label">Dark</span>';

    if (dashboardActions) {
      const pdfButton = document.querySelector("#downloadPdfBtn");
      if (pdfButton) dashboardActions.insertBefore(button, pdfButton);
      else dashboardActions.appendChild(button);
    } else {
      const firstAction = adminActions.firstElementChild;
      if (firstAction) adminActions.insertBefore(button, firstAction);
      else adminActions.appendChild(button);
    }

    button.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next, true);
    });
    updateThemeButtons(currentTheme());
  }

  injectThemeStyles();
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  createThemeToggle();

  // Dashboard charts may be created after async Supabase requests complete.
  // Re-apply chart colours briefly after load so the selected theme is respected.
  let chartSyncCount = 0;
  const chartSyncTimer = window.setInterval(() => {
    syncCharts(currentTheme());
    chartSyncCount += 1;
    if (chartSyncCount >= 12) window.clearInterval(chartSyncTimer);
  }, 700);

  window.addEventListener("load", () => syncCharts(currentTheme()), { once: true });

  // Existing sidebar behaviour.
  const layout = document.querySelector("#appLayout");
  const sidebar = document.querySelector("#appSidebar");
  const toggle = document.querySelector("#sidebarToggle");
  const mobile = document.querySelector("#mobileMenuBtn");
  const scrim = document.querySelector("#sidebarScrim");
  if (!layout || !sidebar) return;

  const closeMobile = () => layout.classList.remove("mobile-open");
  if (toggle) {
    toggle.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        closeMobile();
        return;
      }
      layout.classList.toggle("sidebar-collapsed");
      toggle.setAttribute("aria-label", layout.classList.contains("sidebar-collapsed") ? "Expand sidebar" : "Collapse sidebar");
    });
  }
  if (mobile) mobile.addEventListener("click", () => layout.classList.toggle("mobile-open"));
  if (scrim) scrim.addEventListener("click", closeMobile);
  sidebar.querySelectorAll("button[data-bs-toggle='tab'], a").forEach((el) => el.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 900px)").matches) closeMobile();
  }));
})();
