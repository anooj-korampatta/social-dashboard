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


  // Dashboard skeleton loading -------------------------------------------------
  // This stays independent of dashboard.js so async data-loading UI can evolve
  // without touching the reporting/data logic.
  const SKELETON_TARGETS = [
    "overviewContent",
    "linkedinContent",
    "instagramContent",
    "xContent",
    "insightsContent"
  ];

  function injectSkeletonStyles() {
    if (document.querySelector('link[data-gwc-skeleton-styles]')) return;
    const current = document.currentScript;
    if (!current || !current.src) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../css/skeleton.css", current.src).href;
    link.setAttribute("data-gwc-skeleton-styles", "true");
    document.head.appendChild(link);
  }

  function skeletonLine(width = "100%", height = "14px") {
    return `<span class="gwc-skeleton-block" style="width:${width};height:${height}"></span>`;
  }

  function overviewSkeleton() {
    const cards = Array.from({ length: 6 }, (_, i) => `
      <div class="gwc-skeleton-card gwc-skeleton-kpi">
        <div class="gwc-skeleton-card-top">
          <span class="gwc-skeleton-block gwc-skeleton-icon"></span>
          <span class="gwc-skeleton-block gwc-skeleton-mini-icon"></span>
        </div>
        ${skeletonLine(i % 2 ? "42%" : "50%", "15px")}
        <div class="gwc-skeleton-number">${skeletonLine(i === 1 ? "58%" : "42%", "38px")}</div>
        ${skeletonLine("46%", "18px")}
        ${skeletonLine("34%", "11px")}
      </div>`).join("");

    return `
      <div class="gwc-skeleton-screen" aria-hidden="true">
        <div class="gwc-skeleton-heading">
          <div>${skeletonLine("140px", "11px")}${skeletonLine("220px", "26px")}</div>
          ${skeletonLine("170px", "34px")}
        </div>
        <div class="gwc-skeleton-kpi-grid">${cards}</div>
        <div class="gwc-skeleton-panel gwc-skeleton-chart-panel">
          <div class="gwc-skeleton-panel-head">
            <div>${skeletonLine("155px", "20px")}${skeletonLine("105px", "11px")}</div>
            <div class="gwc-skeleton-actions">${skeletonLine("130px", "38px")}${skeletonLine("130px", "38px")}</div>
          </div>
          <div class="gwc-skeleton-chart">
            <span class="gwc-skeleton-chart-line line-a"></span>
            <span class="gwc-skeleton-chart-line line-b"></span>
            <span class="gwc-skeleton-chart-line line-c"></span>
          </div>
        </div>
        <div class="gwc-skeleton-panel gwc-skeleton-table-panel">
          <div class="gwc-skeleton-panel-head">
            <div>${skeletonLine("135px", "20px")}${skeletonLine("95px", "11px")}</div>
            ${skeletonLine("130px", "38px")}
          </div>
          <div class="gwc-skeleton-table">
            ${Array.from({ length: 6 }, () => `<div class="gwc-skeleton-table-row">${Array.from({ length: 6 }, (_, j) => skeletonLine(j === 0 ? "78%" : "58%", "13px")).join("")}</div>`).join("")}
          </div>
        </div>
      </div>`;
  }

  function platformSkeleton() {
    const cards = Array.from({ length: 6 }, (_, i) => `
      <div class="gwc-skeleton-card gwc-skeleton-kpi compact">
        <div class="gwc-skeleton-card-top"><span class="gwc-skeleton-block gwc-skeleton-icon"></span><span class="gwc-skeleton-block gwc-skeleton-mini-icon"></span></div>
        ${skeletonLine(i % 2 ? "45%" : "54%", "14px")}
        <div class="gwc-skeleton-number">${skeletonLine(i === 1 ? "62%" : "44%", "34px")}</div>
        ${skeletonLine("54%", "16px")}
        ${skeletonLine("38%", "10px")}
      </div>`).join("");

    return `
      <div class="gwc-skeleton-screen" aria-hidden="true">
        <div class="gwc-skeleton-heading"><div>${skeletonLine("150px", "11px")}${skeletonLine("120px", "27px")}</div>${skeletonLine("165px", "34px")}</div>
        <div class="gwc-skeleton-kpi-grid">${cards}</div>
        <div class="gwc-skeleton-two-col">
          <div class="gwc-skeleton-panel">${skeletonLine("140px", "18px")}<div class="gwc-skeleton-chart short"></div></div>
          <div class="gwc-skeleton-panel">${skeletonLine("115px", "18px")}<div class="gwc-skeleton-bars">${Array.from({ length: 4 }, () => `<div>${skeletonLine("80px", "12px")}${skeletonLine("70%", "8px")}</div>`).join("")}</div></div>
        </div>
        <div class="gwc-skeleton-two-col">
          <div class="gwc-skeleton-panel gwc-skeleton-post">${skeletonLine("90px", "100px")}${skeletonLine("65%", "18px")}</div>
          <div class="gwc-skeleton-panel gwc-skeleton-post">${skeletonLine("90px", "100px")}${skeletonLine("65%", "18px")}</div>
        </div>
      </div>`;
  }

  function insightsSkeleton() {
    return `
      <div class="gwc-skeleton-screen" aria-hidden="true">
        <div class="gwc-skeleton-heading"><div>${skeletonLine("145px", "11px")}${skeletonLine("300px", "27px")}</div>${skeletonLine("125px", "34px")}</div>
        <div class="gwc-skeleton-insights-grid">
          ${Array.from({ length: 4 }, () => `
            <div class="gwc-skeleton-panel gwc-skeleton-insight">
              <div class="gwc-skeleton-card-top">${skeletonLine("145px", "20px")}${skeletonLine("85px", "28px")}</div>
              ${skeletonLine("82%", "13px")}
              ${skeletonLine("96%", "15px")}
              ${skeletonLine("72%", "15px")}
            </div>`).join("")}
        </div>
      </div>`;
  }

  function skeletonMarkupFor(id) {
    if (id === "overviewContent") return overviewSkeleton();
    if (id === "insightsContent") return insightsSkeleton();
    return platformSkeleton();
  }

  function setDashboardBusy(isBusy) {
    const content = document.querySelector("#dashboardContent");
    if (!content) return;
    content.setAttribute("aria-busy", String(Boolean(isBusy)));
    content.classList.toggle("dashboard-is-loading", Boolean(isBusy));
  }

  function showDashboardSkeletons() {
    if (!document.querySelector("#dashboardContent")) return;
    setDashboardBusy(true);
    SKELETON_TARGETS.forEach((id) => {
      const target = document.getElementById(id);
      if (!target) return;
      target.innerHTML = skeletonMarkupFor(id);
    });
  }

  function watchDashboardRendering() {
    const content = document.querySelector("#dashboardContent");
    if (!content || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      const activePane = content.querySelector(".tab-pane.active");
      if (activePane && !activePane.querySelector(".gwc-skeleton-screen")) {
        setDashboardBusy(false);
      }
    });
    observer.observe(content, { childList: true, subtree: true });
  }

  function wireDashboardLoadingState() {
    const monthSelect = document.querySelector("#monthSelect");
    if (monthSelect) {
      // Capture runs before dashboard.js's async change handler, so stale values
      // are replaced by the loading state immediately.
      monthSelect.addEventListener("change", showDashboardSkeletons, true);
    }
  }

  window.GWC_SKELETON = {
    show: showDashboardSkeletons,
    hide: () => setDashboardBusy(false)
  };

  injectSkeletonStyles();
  showDashboardSkeletons();
  watchDashboardRendering();
  wireDashboardLoadingState();

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
