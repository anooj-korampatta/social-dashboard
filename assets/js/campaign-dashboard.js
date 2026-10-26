(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = {
    auth: null,
    campaigns: [],
    campaign: null,
    platforms: [],
    posts: [],
    daily: [],
    activeTab: "overview",
    chart: null,
    contentPage: 1,
    contentPlatform: "all"
  };

  const labels = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", x: "X" };
  const icons = { linkedin: "bi-linkedin", instagram: "bi-instagram", facebook: "bi-facebook", x: "bi-twitter-x" };
  const lineColors = { linkedin: "#0A66C2", instagram: "#D62976", facebook: "#1877F2", x: "#111111" };
  const metricLabels = { impressions: "Impressions", engagements: "Engagements", engagement_rate: "Engagement rate", link_clicks: "Link clicks", reach: "Reach", posts: "Content items" };

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const fmt = value => value === null || value === undefined ? "—" : new Intl.NumberFormat("en-GB").format(Number(value));
  const pct = value => value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}%`;
  const dateFmt = value => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value)) : "—";

  function message(text, type = "") {
    const box = $("#campaignMessage");
    box.className = `system-message ${type}`.trim();
    box.textContent = text;
    box.classList.toggle("d-none", !text);
  }

  function platformIcon(platform) {
    return `<span class="campaign-platform-icon ${platform}"><i class="bi ${icons[platform] || "bi-circle"}"></i></span>`;
  }

  function statusSafeUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function topPlatform(metric) {
    return [...state.platforms]
      .filter(row => row[metric] !== null && row[metric] !== undefined)
      .sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0))[0] || null;
  }

  function insightCopy() {
    const eng = topPlatform("engagements");
    const imp = topPlatform("impressions");
    const clicks = topPlatform("link_clicks");
    const totalEng = Number(state.campaign?.engagements || 0);
    const totalImp = Number(state.campaign?.impressions || 0);
    const totalClicks = Number(state.campaign?.link_clicks || 0);
    return [
      eng ? `<strong>${labels[eng.platform]}</strong> generated ${totalEng ? Math.round((Number(eng.engagements || 0) / totalEng) * 100) : 0}% of campaign engagements.` : "Engagement contribution unavailable.",
      imp ? `<strong>${labels[imp.platform]}</strong> delivered the highest impressions (${fmt(imp.impressions)}).` : "Impression contribution unavailable.",
      clicks ? `<strong>${labels[clicks.platform]}</strong> generated ${fmt(clicks.link_clicks)} of ${fmt(totalClicks)} recorded link clicks.` : "Link-click contribution unavailable."
    ];
  }

  const platformOrder = { linkedin: 1, instagram: 2, facebook: 3, x: 4 };

  function orderedPlatforms() {
    return [...state.platforms].sort((a, b) => (platformOrder[a.platform] || 99) - (platformOrder[b.platform] || 99));
  }

  function contributionRows() {
    const totalImp = Number(state.campaign?.impressions || 0);
    const totalEng = Number(state.campaign?.engagements || 0);
    return orderedPlatforms().map(p => {
      const impShare = totalImp ? (Number(p.impressions || 0) / totalImp) * 100 : 0;
      const engShare = totalEng ? (Number(p.engagements || 0) / totalEng) * 100 : 0;
      return `<div class="campaign-contribution-row">
        <div class="campaign-contribution-label">${platformIcon(p.platform)}<span>${labels[p.platform]}</span></div>
        <div class="campaign-contribution-metric"><div class="campaign-contribution-value"><span>Impressions</span><strong>${impShare.toFixed(0)}%</strong></div><div class="campaign-contribution-track"><span class="${p.platform}" style="width:${Math.min(100, impShare).toFixed(1)}%"></span></div></div>
        <div class="campaign-contribution-metric"><div class="campaign-contribution-value"><span>Engagements</span><strong>${engShare.toFixed(0)}%</strong></div><div class="campaign-contribution-track"><span class="${p.platform}" style="width:${Math.min(100, engShare).toFixed(1)}%"></span></div></div>
      </div>`;
    }).join("");
  }

  function renderOverview() {
    const c = state.campaign;
    const insights = insightCopy();
    const platformCards = orderedPlatforms().map(p => `
      <article class="campaign-platform-card">
        <div class="campaign-platform-head">
          <div class="campaign-platform-name">${platformIcon(p.platform)}${labels[p.platform]}</div>
          <div class="campaign-platform-items">${fmt(p.items)} ${p.platform === "instagram" ? "items" : "posts"}</div>
        </div>
        <div class="platform-metric-grid">
          <div class="platform-metric"><strong>${fmt(p.impressions)}</strong><span>Impressions</span></div>
          <div class="platform-metric"><strong>${fmt(p.engagements)}</strong><span>Engagements</span></div>
          <div class="platform-metric"><strong>${pct(p.engagement_rate)}</strong><span>Engagement rate</span></div>
          <div class="platform-metric"><strong>${fmt(p.link_clicks)}</strong><span>Link clicks</span></div>
        </div>
      </article>`).join("");

    return `<div class="campaign-screen campaign-overview-screen">
      <div class="campaign-kpi-grid">
        <article class="campaign-kpi"><span class="campaign-kpi-label">Content items</span><strong class="campaign-kpi-value">${fmt(c.total_items)}</strong><span class="campaign-kpi-note">Posts + Stories</span></article>
        <article class="campaign-kpi"><span class="campaign-kpi-label">Impressions</span><strong class="campaign-kpi-value">${fmt(c.impressions)}</strong><span class="campaign-kpi-note">Campaign total</span></article>
        <article class="campaign-kpi"><span class="campaign-kpi-label">Engagements</span><strong class="campaign-kpi-value">${fmt(c.engagements)}</strong><span class="campaign-kpi-note">Campaign total</span></article>
        <article class="campaign-kpi"><span class="campaign-kpi-label">Engagement rate</span><strong class="campaign-kpi-value">${pct(c.engagement_rate)}</strong><span class="campaign-kpi-note">Reporting period</span></article>
        <article class="campaign-kpi"><span class="campaign-kpi-label">Post link clicks</span><strong class="campaign-kpi-value">${fmt(c.link_clicks)}</strong><span class="campaign-kpi-note">Recorded clicks</span></article>
      </div>

      <div class="campaign-platform-grid">${platformCards}</div>

      <div class="campaign-overview-bottom">
        <section class="campaign-contribution-panel">
          <div class="campaign-panel-heading"><div><span class="campaign-eyebrow">Cross-channel mix</span><h2>Performance contribution</h2></div><span class="campaign-panel-note">Share of campaign totals</span></div>
          <div class="campaign-contribution-list">${contributionRows()}</div>
        </section>
        <section class="campaign-takeaways-panel">
          <div class="campaign-panel-heading"><div><span class="campaign-eyebrow">Executive readout</span><h2>Key takeaways</h2></div></div>
          <div class="campaign-takeaway-list">${insights.map((i, idx) => `<div class="campaign-takeaway"><span>${idx + 1}</span><p>${i}</p></div>`).join("")}</div>
        </section>
      </div>
    </div>`;
  }

  function renderPlatforms() {
    const cards = state.platforms.map(p => `
      <article class="platform-detail-card">
        <div class="campaign-platform-head">
          <div class="campaign-platform-name">${platformIcon(p.platform)}${labels[p.platform]}</div>
          <div class="campaign-platform-items">${fmt(p.items)} ${p.platform === "instagram" ? "items" : "posts"}</div>
        </div>
        <div class="platform-metric-grid">
          <div class="platform-metric"><strong>${fmt(p.impressions)}</strong><span>Impressions</span></div>
          <div class="platform-metric"><strong>${fmt(p.engagements)}</strong><span>Engagements</span></div>
          <div class="platform-metric"><strong>${pct(p.engagement_rate)}</strong><span>Engagement rate</span></div>
          <div class="platform-metric"><strong>${fmt(p.link_clicks)}</strong><span>Link clicks</span></div>
          <div class="platform-metric"><strong>${p.reach === null ? "—" : fmt(p.reach)}</strong><span>Reach</span></div>
          <div class="platform-metric"><strong>${p.net_fans === null ? "—" : fmt(p.net_fans)}</strong><span>Audience growth*</span></div>
        </div>
      </article>`).join("");
    return `<div class="campaign-screen"><div class="platform-detail-grid">${cards}</div><div class="campaign-kpi-note">*Audience growth is account-level movement during the campaign reporting window and is not attributed solely to the campaign.</div></div>`;
  }

  function trendOptions() {
    return `<div class="trend-controls"><select id="trendMetric" class="form-select">${Object.entries(metricLabels).map(([key, label]) => `<option value="${key}" ${key === "impressions" ? "selected" : ""}>${label}</option>`).join("")}</select><select id="trendPlatform" class="form-select"><option value="all">All platforms</option>${state.platforms.map(p => `<option value="${p.platform}">${labels[p.platform]}</option>`).join("")}</select></div>`;
  }

  function renderTrend() {
    return `<div class="campaign-screen"><div class="trend-panel"><div class="trend-panel-head"><div class="trend-title"><h2>Campaign trend</h2><p>Daily performance from the Meltwater campaign export.</p></div>${trendOptions()}</div><div class="trend-chart-wrap"><canvas id="campaignTrendChart"></canvas></div></div></div>`;
  }

  function mediaThumb(post) {
    const media = statusSafeUrl(post.media_url);
    return media ? `<img src="${esc(media)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.innerHTML='<i class=&quot;bi bi-image&quot;></i>'">` : '<i class="bi bi-image"></i>';
  }

  function postScore(post) {
    return Number(post.engagements || 0) * 1000000 + Number(post.impressions || 0);
  }

  function topPosts() {
    return [...state.posts].sort((a, b) => postScore(b) - postScore(a)).slice(0, 4);
  }

  function renderTopContent() {
    return topPosts().map((post, index) => {
      const permalink = statusSafeUrl(post.permalink);
      const caption = post.caption || `${labels[post.platform]} post`;
      return `<article class="content-card">
        <div class="content-thumb">${mediaThumb(post)}</div>
        <div class="content-card-body">
          <div class="content-rank">#${index + 1} · ${labels[post.platform]} · ${dateFmt(post.post_date)}</div>
          <div class="content-caption">${esc(caption)}</div>
          <div class="content-card-metrics"><div><strong>${fmt(post.impressions)}</strong><span>Imp.</span></div><div><strong>${fmt(post.engagements)}</strong><span>Eng.</span></div><div><strong>${pct(post.engagement_rate)}</strong><span>ER</span></div></div>
          ${permalink ? `<a href="${esc(permalink)}" target="_blank" rel="noopener">View post <i class="bi bi-arrow-up-right"></i></a>` : ""}
        </div>
      </article>`;
    }).join("");
  }

  function filteredPosts() {
    const rows = state.contentPlatform === "all" ? state.posts : state.posts.filter(p => p.platform === state.contentPlatform);
    return [...rows].sort((a, b) => new Date(b.post_date || 0) - new Date(a.post_date || 0));
  }

  function renderContent() {
    const rows = filteredPosts();
    const perPage = 6;
    const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
    state.contentPage = Math.min(state.contentPage, totalPages);
    const start = (state.contentPage - 1) * perPage;
    const pageRows = rows.slice(start, start + perPage);
    const body = pageRows.map(post => {
      const link = statusSafeUrl(post.permalink);
      return `<tr><td><span class="platform-pill"><span class="platform-dot ${post.platform}"></span>${labels[post.platform]}</span></td><td>${dateFmt(post.post_date)}</td><td class="caption-cell" title="${esc(post.caption || "")}">${esc(post.caption || post.post_type || "—")}</td><td>${fmt(post.impressions)}</td><td>${fmt(post.engagements)}</td><td>${pct(post.engagement_rate)}</td><td>${fmt(post.link_clicks)}</td><td>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i></a>` : "—"}</td></tr>`;
    }).join("");

    return `<div class="campaign-screen content-screen">
      <div class="top-content-grid">${renderTopContent()}</div>
      <div class="content-table-panel">
        <div class="content-table-head"><h3>Content performance</h3><select id="contentPlatformFilter" class="form-select"><option value="all">All platforms</option>${state.platforms.map(p => `<option value="${p.platform}" ${state.contentPlatform === p.platform ? "selected" : ""}>${labels[p.platform]}</option>`).join("")}</select></div>
        <div class="content-table-wrap"><table class="campaign-content-table"><colgroup><col style="width:12%"><col style="width:10%"><col style="width:31%"><col style="width:11%"><col style="width:11%"><col style="width:9%"><col style="width:9%"><col style="width:7%"></colgroup><thead><tr><th>Platform</th><th>Date</th><th>Caption</th><th>Impressions</th><th>Engagements</th><th>ER</th><th>Clicks</th><th>Post</th></tr></thead><tbody>${body || '<tr><td colspan="8">No posts for this filter.</td></tr>'}</tbody></table></div>
        <div class="content-pagination"><button id="contentPrevBtn" type="button" ${state.contentPage <= 1 ? "disabled" : ""}><i class="bi bi-chevron-left"></i></button><span>${state.contentPage} / ${totalPages}</span><button id="contentNextBtn" type="button" ${state.contentPage >= totalPages ? "disabled" : ""}><i class="bi bi-chevron-right"></i></button></div>
      </div>
    </div>`;
  }

  function renderActiveTab() {
    if (!state.campaign) return;
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    const stage = $("#campaignStage");
    if (state.activeTab === "overview") stage.innerHTML = renderOverview();
    if (state.activeTab === "platforms") stage.innerHTML = renderPlatforms();
    if (state.activeTab === "trend") {
      stage.innerHTML = renderTrend();
      $("#trendMetric").addEventListener("change", renderTrendChart);
      $("#trendPlatform").addEventListener("change", renderTrendChart);
      renderTrendChart();
    }
    if (state.activeTab === "content") {
      stage.innerHTML = renderContent();
      $("#contentPlatformFilter").addEventListener("change", event => {
        state.contentPlatform = event.target.value;
        state.contentPage = 1;
        renderActiveTab();
      });
      $("#contentPrevBtn")?.addEventListener("click", () => { state.contentPage -= 1; renderActiveTab(); });
      $("#contentNextBtn")?.addEventListener("click", () => { state.contentPage += 1; renderActiveTab(); });
    }
  }

  function chartTheme() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    return { text: dark ? "#AEB6C4" : "#707988", grid: dark ? "#2A2F36" : "#EDF0F2", tooltip: dark ? "#0D0F12" : "#111111" };
  }

  function aggregateTrend(metric, platformFilter) {
    const rows = platformFilter === "all" ? state.daily : state.daily.filter(r => r.platform === platformFilter);
    const dates = [...new Set(rows.map(r => r.metric_date))].sort();
    if (platformFilter !== "all") {
      const map = new Map(rows.map(r => [r.metric_date, Number(r[metric] || 0)]));
      return { dates, datasets: [{ label: labels[platformFilter], data: dates.map(d => map.get(d) || 0), borderColor: lineColors[platformFilter], backgroundColor: lineColors[platformFilter], tension: .28, pointRadius: 2.5, borderWidth: 2 }] };
    }
    const datasets = state.platforms.map(p => {
      const pr = rows.filter(r => r.platform === p.platform);
      const map = new Map(pr.map(r => [r.metric_date, Number(r[metric] || 0)]));
      return { label: labels[p.platform], data: dates.map(d => map.get(d) || 0), borderColor: lineColors[p.platform], backgroundColor: lineColors[p.platform], tension: .28, pointRadius: 2.3, borderWidth: 2 };
    });
    return { dates, datasets };
  }

  function renderTrendChart() {
    const canvas = $("#campaignTrendChart");
    if (!canvas) return;
    if (state.chart) state.chart.destroy();
    const metric = $("#trendMetric")?.value || "impressions";
    const platform = $("#trendPlatform")?.value || "all";
    const data = aggregateTrend(metric, platform);
    const theme = chartTheme();
    state.chart = new Chart(canvas, {
      type: "line",
      data: { labels: data.dates.map(d => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))), datasets: data.datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: { legend: { position: "bottom", labels: { color: theme.text, usePointStyle: true, boxWidth: 7, font: { size: 10 } } }, tooltip: { backgroundColor: theme.tooltip } },
        scales: { x: { ticks: { color: theme.text, maxTicksLimit: 12, font: { size: 9 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: theme.text, font: { size: 9 }, callback: value => metric === "engagement_rate" ? `${value}%` : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value) }, grid: { color: theme.grid } } }
      }
    });
  }

  async function loadCampaignList(requestedId) {
    const query = client.from("campaigns").select("id,name,campaign_tag,period_start,period_end,status").order("period_end", { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    state.campaigns = data || [];

    const select = $("#campaignSelect");
    if (!state.campaigns.length) {
      select.innerHTML = '<option>No published campaigns</option>';
      select.disabled = true;
      $("#campaignStage").innerHTML = '<div class="campaign-empty-screen"><i class="bi bi-megaphone"></i><strong>No campaign dashboards available</strong><span>Publish a campaign from the CMS first.</span></div>';
      $("#campaignMeta").textContent = "No published campaigns";
      return null;
    }

    select.innerHTML = state.campaigns.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    const chosen = state.campaigns.find(c => c.id === requestedId) || state.campaigns[0];
    select.value = chosen.id;
    select.disabled = false;
    select.addEventListener("change", () => loadCampaign(select.value));
    return chosen.id;
  }

  async function loadCampaign(id) {
    message("");
    $("#campaignSnapshotBtn").disabled = true;
    $("#campaignStage").innerHTML = '<div class="campaign-loading"><span class="spinner-border spinner-border-sm"></span> Loading campaign data…</div>';
    if (state.chart) { state.chart.destroy(); state.chart = null; }

    const [campaignRes, platformRes, postsRes, dailyRes] = await Promise.all([
      client.from("campaigns").select("*").eq("id", id).single(),
      client.from("campaign_platform_metrics").select("*").eq("campaign_id", id).order("platform"),
      client.from("campaign_posts").select("*").eq("campaign_id", id).order("post_date", { ascending: false }),
      client.from("campaign_daily_metrics").select("*").eq("campaign_id", id).order("metric_date", { ascending: true })
    ]);
    const failure = [campaignRes, platformRes, postsRes, dailyRes].find(r => r.error);
    if (failure) throw failure.error;

    state.campaign = campaignRes.data;
    state.platforms = platformRes.data || [];
    state.posts = postsRes.data || [];
    state.daily = dailyRes.data || [];
    state.contentPage = 1;
    state.contentPlatform = "all";

    $("#campaignMeta").textContent = `${state.campaign.name} · ${dateFmt(state.campaign.period_start)}–${dateFmt(state.campaign.period_end)} · ${state.campaign.campaign_tag ? `Tag: ${state.campaign.campaign_tag}` : "Meltwater"}`;
    const url = new URL(window.location.href);
    url.searchParams.set("id", id);
    window.history.replaceState({}, "", url);
    renderActiveTab();
    $("#campaignSnapshotBtn").disabled = false;
  }

  function wireTabs() {
    $$("[data-campaign-tab]").forEach(button => button.addEventListener("click", () => {
      state.activeTab = button.dataset.campaignTab;
      $$("[data-campaign-tab]").forEach(b => b.classList.toggle("active", b === button));
      renderActiveTab();
    }));
  }

  async function snapshot() {
    if (!state.campaign || !window.html2canvas) return;
    const button = $("#campaignSnapshotBtn");
    button.disabled = true;
    const previous = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Creating';
    try {
      const canvas = await window.html2canvas($("#campaignWorkspace"), { scale: 2, backgroundColor: document.documentElement.getAttribute("data-theme") === "dark" ? "#101214" : "#f5f6f7", useCORS: true, logging: false });
      const link = document.createElement("a");
      const slug = (state.campaign.name || "campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      link.download = `${slug}-${state.activeTab}-snapshot.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      button.disabled = false;
      button.innerHTML = previous;
    }
  }

  async function init() {
    try {
      wireTabs();
      $("#campaignSnapshotBtn")?.addEventListener("click", snapshot);
      window.addEventListener("gwc:themechange", () => { if (state.activeTab === "trend") renderTrendChart(); });

      if (window.GWC_CAMPAIGN_SHARE?.fetch) {
        const payload = await window.GWC_CAMPAIGN_SHARE.fetch();
        state.campaign = payload.campaign;
        state.platforms = payload.platforms || [];
        state.posts = payload.posts || [];
        state.daily = payload.daily || [];
        $("#campaignMeta").textContent = `${state.campaign.name} · ${dateFmt(state.campaign.period_start)}–${dateFmt(state.campaign.period_end)} · ${state.campaign.campaign_tag ? `Tag: ${state.campaign.campaign_tag}` : "Meltwater"}`;
        const expiry = $("#campaignShareExpiry");
        if (expiry && payload.share?.expires_at) expiry.textContent = `View-only · expires ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.share.expires_at))}`;
        renderActiveTab();
        if ($("#campaignSnapshotBtn")) $("#campaignSnapshotBtn").disabled = false;
        return;
      }

      if (!api?.ready || !client) {
        message("Supabase is not configured.", "error");
        return;
      }
      state.auth = window.GWC_VIEWER_AUTH_READY ? await window.GWC_VIEWER_AUTH_READY : null;
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get("id");
      const id = await loadCampaignList(requestedId);
      if (!id) return;
      await loadCampaign(id);
    } catch (error) {
      $("#campaignStage").innerHTML = `<div class="campaign-empty-screen"><i class="bi bi-exclamation-circle"></i><strong>Unable to load campaign analytics</strong><span>${esc(error.message || "Unknown error")}</span></div>`;
      message(error.message || "Unable to load campaign analytics.", "error");
    }
  }

  init();
})();
