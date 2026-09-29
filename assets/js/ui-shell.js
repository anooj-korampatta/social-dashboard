(() => {
  "use strict";
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
  sidebar.querySelectorAll("button[data-bs-toggle='tab'], a").forEach(el => el.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 900px)").matches) closeMobile();
  }));
})();
