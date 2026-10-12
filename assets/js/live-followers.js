(() => {
  "use strict";

  const REFRESH_FUNCTION = "refresh-live-followers";
  const AUTO_REFRESH_MS = 15 * 60 * 1000;
  const DISPLAY_REFRESH_MS = 60 * 1000;
  const PLATFORM_ORDER = ["linkedin", "instagram", "x"];
  const nf = new Intl.NumberFormat("en-GB");
  let rows = new Map();
  let refreshing = false;
  let relativeTimer = null;
  let autoTimer = null;

  function client() {
    return window.GWC_SUPABASE && window.GWC_SUPABASE.ready
      ? window.GWC_SUPABASE.client
      : null;
  }

  function injectStyles() {
    if (document.querySelector('link[data-gwc-live-followers-styles]')) return;
    const current = document.currentScript;
    if (!current || !current.src) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../css/live-followers.css", current.src).href;
    link.setAttribute("data-gwc-live-followers-styles", "true");
    document.head.appendChild(link);
  }

  function platformMeta(key) {
    return {
      linkedin: { label: "LinkedIn", icon: "bi-linkedin" },
      instagram: { label: "Instagram", icon: "bi-instagram" },
      x: { label: "X", icon: "bi-twitter-x" }
    }[key];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function oldestSuccessDate() {
    const dates = PLATFORM_ORDER
      .map((key) => parseDate(rows.get(key)?.last_success_at || rows.get(key)?.fetched_at))
      .filter(Boolean);
    if (!dates.length) return null;
    return new Date(Math.min(...dates.map((d) => d.getTime())));
  }

  function relativeTime(date) {
    if (!date) return "Not synced yet";
    const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 45) return "Updated just now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `Updated ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
  }

  function liveMarkup() {
    const platformItems = PLATFORM_ORDER.map((key) => {
      const meta = platformMeta(key);
      const row = rows.get(key);
      const hasValue = Number.isFinite(Number(row?.followers));
      const error = row?.last_error ? ` title="${escapeHtml(row.last_error)}"` : "";
      return `
        <div class="live-audience-platform live-${key}"${error}>
          <span class="live-platform-icon" aria-hidden="true"><i class="bi ${meta.icon}"></i></span>
          <span class="live-platform-copy">
            <span class="live-platform-label">${meta.label}</span>
            <strong class="live-platform-count">${hasValue ? nf.format(Number(row.followers)) : "—"}</strong>
          </span>
          ${row?.last_error ? '<span class="live-platform-warning" aria-label="Latest sync failed"><i class="bi bi-exclamation-circle"></i></span>' : ""}
        </div>`;
    }).join("");

    return `
      <section class="live-audience-card" data-live-audience aria-label="Current social media follower counts">
        <div class="live-audience-heading">
          <div>
            <div class="live-audience-kicker"><span class="live-pulse" aria-hidden="true"></span>Live audience</div>
            <div class="live-audience-title">Current follower snapshot</div>
          </div>
          <div class="live-audience-sync">
            <span class="live-updated-at" data-live-updated>${relativeTime(oldestSuccessDate())}</span>
            <button class="live-refresh-btn" type="button" data-live-refresh aria-label="Refresh follower counts" title="Refresh follower counts">
              <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div class="live-audience-platforms">${platformItems}</div>
        <div class="live-audience-footnote">Live follower counts are a current snapshot and are separate from the selected month's month-end reporting figures.</div>
      </section>`;
  }

  function ensureCard() {
    const target = document.getElementById("overviewContent");
    if (!target || target.querySelector(".gwc-skeleton-screen")) return null;

    let card = target.querySelector("[data-live-audience]");
    if (!card) {
      const wrap = document.createElement("div");
      wrap.innerHTML = liveMarkup().trim();
      card = wrap.firstElementChild;
      const intro = target.querySelector(".section-intro");
      if (intro && intro.parentNode) intro.insertAdjacentElement("afterend", card);
      else target.prepend(card);
    } else {
      const replacement = document.createElement("div");
      replacement.innerHTML = liveMarkup().trim();
      card.replaceWith(replacement.firstElementChild);
      card = target.querySelector("[data-live-audience]");
    }

    wireRefresh(card);
    return card;
  }

  function setRefreshing(value) {
    refreshing = Boolean(value);
    document.querySelectorAll("[data-live-refresh]").forEach((button) => {
      button.disabled = refreshing;
      button.classList.toggle("is-refreshing", refreshing);
    });
  }

  function updateRelativeText() {
    document.querySelectorAll("[data-live-updated]").forEach((el) => {
      el.textContent = relativeTime(oldestSuccessDate());
    });
  }

  async function loadCached() {
    const sb = client();
    if (!sb) return false;
    const { data, error } = await sb
      .from("live_followers")
      .select("platform,followers,fetched_at,last_success_at,last_error")
      .in("platform", PLATFORM_ORDER);
    if (error) {
      console.warn("Live followers cache unavailable:", error.message);
      return false;
    }
    rows = new Map((data || []).map((row) => [row.platform, row]));
    ensureCard();
    return true;
  }

  function cacheIsStale() {
    const oldest = oldestSuccessDate();
    if (!oldest || rows.size < PLATFORM_ORDER.length) return true;
    return Date.now() - oldest.getTime() >= AUTO_REFRESH_MS;
  }

  async function refreshLive({ force = false, silent = false } = {}) {
    const sb = client();
    if (!sb || refreshing) return;
    setRefreshing(true);
    try {
      const { data, error } = await sb.functions.invoke(REFRESH_FUNCTION, {
        body: { force: Boolean(force) }
      });
      if (error) throw error;
      if (data?.rows && Array.isArray(data.rows)) {
        rows = new Map(data.rows.map((row) => [row.platform, row]));
      } else {
        await loadCached();
      }
      ensureCard();
    } catch (error) {
      console.warn("Live follower refresh failed:", error?.message || error);
      if (!silent) {
        const card = ensureCard();
        const note = card?.querySelector(".live-audience-footnote");
        if (note) note.textContent = "Live refresh is temporarily unavailable. Showing the latest saved follower counts.";
      }
    } finally {
      setRefreshing(false);
    }
  }

  function wireRefresh(scope = document) {
    const button = scope.querySelector?.("[data-live-refresh]");
    if (!button || button.dataset.wired === "true") return;
    button.dataset.wired = "true";
    button.addEventListener("click", () => refreshLive({ force: true }));
  }

  function observeOverview() {
    const target = document.getElementById("overviewContent");
    if (!target || typeof MutationObserver === "undefined") return;
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (!target.querySelector(".gwc-skeleton-screen") && !target.querySelector("[data-live-audience]")) {
          ensureCard();
        }
      });
    });
    observer.observe(target, { childList: true, subtree: false });
  }

  async function init() {
    injectStyles();
    observeOverview();

    let attempts = 0;
    while (!client() && attempts < 80) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts += 1;
    }
    if (!client()) return;

    await loadCached();
    ensureCard();
    if (cacheIsStale()) refreshLive({ force: false, silent: true });

    if (relativeTimer) clearInterval(relativeTimer);
    relativeTimer = setInterval(updateRelativeText, DISPLAY_REFRESH_MS);

    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => refreshLive({ force: false, silent: true }), AUTO_REFRESH_MS);
  }

  init();
})();
