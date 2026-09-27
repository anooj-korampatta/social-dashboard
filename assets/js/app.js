(() => {
  "use strict";

  const data = window.GWC_REPORT_DATA;
  const state = { month: data.reportMeta.availableMonths[0], charts: {} };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const fmt = new Intl.NumberFormat("en-GB");
  const number = (value) => value === null || value === undefined ? "—" : fmt.format(value);
  const pct = (value) => value === null || value === undefined ? "—" : `${Number(value).toFixed(value >= 10 ? 2 : 2)}%`;

  function activeMonth() { return data.months[state.month]; }

  function metricCard(value, label, delta = "") {
    const deltaHtml = delta ? `<div class="metric-delta">${delta}</div>` : "";
    return `<div class="metric-card"><div class="metric-value">${value}</div><div class="metric-label">${label}</div>${deltaHtml}</div>`;
  }

  function overviewMarkup(month) {
    const o = month.overview;
    return `
      <div class="metric-grid">
        ${metricCard(number(o.posts), "Posts published")}
        ${metricCard(number(o.followers), "Followers", `↑ ${o.followersChange}% vs Jul`)}
        ${metricCard(`+${number(o.newFollowers)}`, "Net new followers")}
        ${metricCard(number(o.impressions), "Impressions")}
        ${metricCard(number(o.reach), "Reach")}
        ${metricCard(number(o.engagements), "Engagements")}
      </div>

      <div class="panel-grid">
        <div class="panel">
          <div class="panel-header">
            <div><h2 class="panel-title">Performance trend</h2><div class="panel-subtitle">Apr–Aug 2026</div></div>
            <select class="metric-switch" id="overviewMetric" aria-label="Select trend metric">
              <option value="impressions">Impressions</option>
              <option value="engagements">Engagements</option>
              <option value="followers">Followers</option>
              <option value="posts">Posts</option>
            </select>
          </div>
          <div class="chart-wrap"><canvas id="overviewTrendChart" aria-label="Platform trend chart"></canvas></div>
        </div>

        <div class="panel">
          <div class="panel-header"><div><h2 class="panel-title">Channel contribution</h2><div class="panel-subtitle">Share of August impressions</div></div></div>
          <div class="contribution-list" id="contributionList"></div>
        </div>
      </div>

      <div class="platform-strip">
        ${platformMini("linkedin", month.platforms.linkedin)}
        ${platformMini("instagram", month.platforms.instagram)}
        ${platformMini("x", month.platforms.x)}
      </div>
    `;
  }

  function platformMini(key, p) {
    return `<button class="platform-mini" type="button" data-open-platform="${key}" aria-label="Open ${p.name} details">
      <div class="platform-mini-title">${p.name}</div>
      <div class="platform-mini-metrics">
        <div><div class="big">${number(p.followers)}</div><div class="small-label">Followers</div></div>
        <div><div class="big">${pct(p.engagementRate)}</div><div class="small-label">Engagement rate</div></div>
      </div>
    </button>`;
  }

  function platformMarkup(key, p) {
    const reachCard = metricCard(number(p.reach), "Reach");
    return `
      <div class="metric-grid">
        ${metricCard(number(p.posts), "Posts published")}
        ${metricCard(number(p.followers), "Followers", `↑ ${p.followerChange}% vs Jul`)}
        ${metricCard(`+${number(p.newFollowers)}`, "Net new followers")}
        ${metricCard(number(p.impressions), "Impressions")}
        ${reachCard}
        ${metricCard(pct(p.engagementRate), "Engagement rate")}
      </div>

      <div class="panel-grid equal">
        <div class="panel">
          <div class="panel-header"><div><h2 class="panel-title">Posting cadence</h2><div class="panel-subtitle">Posts published by week</div></div></div>
          <div class="chart-wrap compact"><canvas id="${key}CadenceChart" aria-label="${p.name} weekly posting cadence"></canvas></div>
        </div>
        <div class="panel">
          <div class="panel-header"><div><h2 class="panel-title">Content mix</h2><div class="panel-subtitle">Format share of channel</div></div></div>
          <div class="format-list">
            ${p.contentMix.map(item => `<div class="format-row"><div class="format-label">${item.label}</div><div class="format-track"><div class="format-fill" style="width:${item.pct}%"></div></div><div class="format-pct">${item.pct}%</div></div>`).join("")}
          </div>
          <div class="language-pill"><strong>Language mix</strong> · ${p.language}</div>
        </div>
      </div>

      <div class="post-grid">
        ${postCard("Top performing", p.topPost)}
        ${postCard("Needs attention", p.lowPost)}
      </div>

      <div class="action-strip">
        <div class="action-dot" aria-hidden="true"></div>
        <div class="action-copy"><strong>Recommended action:</strong> ${p.action}</div>
        <div class="action-timeline">${p.actionTimeline}</div>
      </div>
    `;
  }

  function postCard(label, post) {
    return `<article class="post-card">
      <img class="post-thumb" src="${post.image}" alt="Post artwork placeholder">
      <div>
        <div class="post-kicker">${label} · ${post.date}</div>
        <div class="post-title">${post.title}</div>
        <div class="post-stats">
          <div><div class="post-stat-value">${pct(post.er)}</div><div class="post-stat-label">Engagement rate</div></div>
          <div><div class="post-stat-value">${number(post.impressions)}</div><div class="post-stat-label">Impressions</div></div>
          <div><div class="post-stat-value">${number(post.engagements)}</div><div class="post-stat-label">Engagements</div></div>
          <div><div class="post-stat-value">${number(post.extraValue)}</div><div class="post-stat-label">${post.extraLabel}</div></div>
        </div>
      </div>
    </article>`;
  }

  function insightsMarkup(month) {
    return `<div class="insights-grid">${month.insights.map(i => `
      <article class="insight-card">
        <div class="insight-top"><div class="insight-platform">${i.platform}</div><div class="insight-timeline">${i.timeline}</div></div>
        <div class="insight-area">${i.area}</div>
        <div class="insight-action">${i.action}</div>
      </article>
    `).join("")}</div>`;
  }

  function render() {
    const month = activeMonth();
    $("#monthMeta").textContent = month.label;
    $("#overviewContent").innerHTML = overviewMarkup(month);
    $("#linkedinContent").innerHTML = platformMarkup("linkedin", month.platforms.linkedin);
    $("#instagramContent").innerHTML = platformMarkup("instagram", month.platforms.instagram);
    $("#xContent").innerHTML = platformMarkup("x", month.platforms.x);
    $("#insightsContent").innerHTML = insightsMarkup(month);

    buildContribution(month);
    buildOverviewTrend(month, "impressions");
    buildCadence("linkedin", month.platforms.linkedin);
    buildCadence("instagram", month.platforms.instagram);
    buildCadence("x", month.platforms.x);
    wireDynamicControls();
  }

  function chartBaseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111",
          titleFont: { family: "proxima-nova" },
          bodyFont: { family: "proxima-nova" },
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: "#7b7b7b", font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: "#eeeeee" }, border: { display: false }, ticks: { color: "#7b7b7b", font: { size: 10 }, maxTicksLimit: 5 } }
      }
    };
  }

  function destroyChart(name) {
    if (state.charts[name]) { state.charts[name].destroy(); delete state.charts[name]; }
  }

  function buildOverviewTrend(month, metric) {
    destroyChart("overview");
    const canvas = $("#overviewTrendChart");
    if (!canvas || !window.Chart) return;
    const t = month.trend;
    state.charts.overview = new Chart(canvas, {
      type: "line",
      data: {
        labels: t.labels,
        datasets: [
          { label: "LinkedIn", data: t.linkedin[metric], borderColor: "#111111", backgroundColor: "#111111", borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: .34 },
          { label: "Instagram", data: t.instagram[metric], borderColor: "#737373", backgroundColor: "#737373", borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: .34 },
          { label: "X", data: t.x[metric], borderColor: "#b5b5b5", backgroundColor: "#b5b5b5", borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: .34 }
        ]
      },
      options: {
        ...chartBaseOptions(),
        plugins: {
          ...chartBaseOptions().plugins,
          legend: { display: true, position: "bottom", align: "start", labels: { usePointStyle: true, boxWidth: 7, boxHeight: 7, color: "#555", padding: 16, font: { size: 10 } } }
        }
      }
    });
  }

  function buildCadence(key, p) {
    destroyChart(`${key}Cadence`);
    const canvas = $(`#${key}CadenceChart`);
    if (!canvas || !window.Chart) return;
    state.charts[`${key}Cadence`] = new Chart(canvas, {
      type: "bar",
      data: {
        labels: p.cadenceLabels,
        datasets: [{ data: p.cadence, backgroundColor: "#222222", borderRadius: 5, maxBarThickness: 46 }]
      },
      options: chartBaseOptions()
    });
  }

  function buildContribution(month) {
    const list = $("#contributionList");
    if (!list) return;
    const ps = month.platforms;
    const total = ps.linkedin.impressions + ps.instagram.impressions + ps.x.impressions;
    const rows = [
      ["LinkedIn", ps.linkedin.impressions],
      ["Instagram", ps.instagram.impressions],
      ["X", ps.x.impressions]
    ];
    list.innerHTML = rows.map(([name, val], index) => {
      const share = Math.round((val / total) * 100);
      return `<div class="contrib-row ${index === 0 ? "active" : ""}"><div class="contrib-name">${name}</div><div class="contrib-track"><div class="contrib-bar" style="width:${share}%"></div></div><div class="contrib-value">${share}%</div></div>`;
    }).join("");
  }

  function wireDynamicControls() {
    const metric = $("#overviewMetric");
    if (metric) metric.addEventListener("change", e => buildOverviewTrend(activeMonth(), e.target.value));
    $$('[data-open-platform]').forEach(btn => btn.addEventListener("click", () => {
      const key = btn.dataset.openPlatform;
      const tabButton = $(`#tab-${key}`);
      if (tabButton) bootstrap.Tab.getOrCreateInstance(tabButton).show();
    }));
  }

  function setupMonthSelector() {
    const select = $("#monthSelect");
    data.reportMeta.availableMonths.forEach(key => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = data.months[key].label;
      select.appendChild(option);
    });
    select.value = state.month;
    select.addEventListener("change", e => { state.month = e.target.value; render(); });
  }

  async function downloadCurrentTabPdf() {
    const button = $("#downloadPdfBtn");
    const activePane = $(".tab-pane.active");
    if (!activePane || !window.html2pdf) {
      window.print();
      return;
    }

    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Preparing PDF';

    const exportWrap = document.createElement("div");
    exportWrap.style.padding = "24px";
    exportWrap.style.background = "#fff";
    exportWrap.style.width = "1200px";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.borderBottom = "1px solid #e7e7e7";
    header.style.paddingBottom = "14px";
    header.style.marginBottom = "16px";
    header.innerHTML = `<div><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#3fae2a;font-weight:700">Monthly reporting</div><div style="font-size:28px;font-weight:700">Social Media Performance</div><div style="font-size:12px;color:#777">${activeMonth().label} · ${$(".nav-link.active").textContent.trim()}</div></div><img src="assets/images/gwc-logo-placeholder.svg" style="width:100px;height:auto" alt="GWC">`;
    exportWrap.appendChild(header);

    const clone = activePane.cloneNode(true);
    clone.classList.add("show", "active");
    clone.style.display = "block";
    exportWrap.appendChild(clone);
    document.body.appendChild(exportWrap);

    const filename = `GWC-Social-Media-${activeMonth().label.replace(/\s+/g, "-")}-${$(".nav-link.active").textContent.trim()}.pdf`;

    try {
      await html2pdf().set({
        margin: 0,
        filename,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale: 1.65, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
      }).from(exportWrap).save();
    } catch (err) {
      console.error(err);
      window.print();
    } finally {
      exportWrap.remove();
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }

  setupMonthSelector();
  render();
  $("#downloadPdfBtn").addEventListener("click", downloadCurrentTabPdf);
})();

