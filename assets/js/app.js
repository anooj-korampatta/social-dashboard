(() => {
  "use strict";

  const data = window.GWC_REPORT_DATA;
  const state = { month: data.reportMeta.availableMonths[0], charts: {} };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const fmt = new Intl.NumberFormat("en-GB");

  const number = (value) => value === null || value === undefined ? "—" : fmt.format(value);
  const percent = (value) => value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}%`;
  const signedPercent = (value) => {
    if (value === null || value === undefined) return "—";
    const abs = Math.abs(Number(value));
    const digits = Number.isInteger(abs) ? 0 : 1;
    if (value > 0) return `+${abs.toFixed(digits)}%`;
    if (value < 0) return `-${abs.toFixed(digits)}%`;
    return "0%";
  };

  function activeMonth() {
    return data.months[state.month];
  }

  function deltaClass(value) {
    if (value === null || value === undefined || value === 0) return "neutral";
    return value > 0 ? "positive" : "negative";
  }

  function deltaIcon(value) {
    if (value === null || value === undefined || value === 0) return "bi-dash";
    return value > 0 ? "bi-arrow-up-right" : "bi-arrow-down-right";
  }


function platformIcon(key) {
  const icons = {
    linkedin: '<i class="bi bi-linkedin platform-icon" aria-hidden="true"></i>',
    instagram: '<i class="bi bi-instagram platform-icon" aria-hidden="true"></i>',
    x: '<i class="bi bi-twitter-x platform-icon" aria-hidden="true"></i>'
  };
  return icons[key] || "";
}

  function metricCard({ value, label, comparison, valueSuffix = "", valuePrefix = "" }) {
    const displayValue = value === null || value === undefined ? "—" : `${valuePrefix}${number(value)}${valueSuffix}`;
    let comparisonHtml = `<div class="metric-comparison neutral"><span>Current month</span></div>`;

    if (comparison) {
      if (comparison.delta !== null && comparison.delta !== undefined) {
        comparisonHtml = `
          <div class="metric-comparison ${deltaClass(comparison.delta)}">
            <span class="delta-value"><i class="bi ${deltaIcon(comparison.delta)}" aria-hidden="true"></i>${signedPercent(comparison.delta)}</span>
            <span>vs ${activeMonth().previousLabel.replace(/\s+\d{4}$/, "")}</span>
          </div>`;
      } else {
        comparisonHtml = `<div class="metric-comparison neutral"><span>${comparison.note || "No comparable previous value"}</span></div>`;
      }
    }

    const previousHtml = comparison && comparison.previous !== null && comparison.previous !== undefined
      ? `<div class="metric-previous">Previous: ${valuePrefix}${number(comparison.previous)}${valueSuffix}</div>`
      : `<div class="metric-previous">${comparison && comparison.note ? comparison.note : "Previous value unavailable"}</div>`;

    return `
      <article class="metric-card">
        <div class="metric-value">${displayValue}</div>
        <div class="metric-label">${label}</div>
        ${comparisonHtml}
        ${previousHtml}
      </article>`;
  }

  function overviewMarkup(month) {
    const o = month.overview;
    const c = month.comparison.overview;
    return `
      <div class="section-intro">
        <div>
          <div class="section-kicker">At a glance</div>
          <h2 class="section-title">${month.label} performance</h2>
        </div>
        <div class="comparison-badge"><span class="comparison-dot"></span>Compared with ${month.previousLabel}</div>
      </div>

      <div class="metric-grid">
        ${metricCard({ value: o.posts, label: "Posts published", comparison: c.posts })}
        ${metricCard({ value: o.followers, label: "Followers", comparison: c.followers })}
        ${metricCard({ value: o.newFollowers, label: "Net new followers", comparison: c.newFollowers, valuePrefix: "+" })}
        ${metricCard({ value: o.impressions, label: "Impressions", comparison: c.impressions })}
        ${metricCard({ value: o.reach, label: "Reach", comparison: c.reach })}
        ${metricCard({ value: o.engagements, label: "Engagements", comparison: c.engagements })}
      </div>

      <div class="panel-grid overview-panels">
        <section class="panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">Month-on-month performance</h3>
              <div class="panel-subtitle">${month.previousLabel} to ${month.label}</div>
            </div>
          </div>
          ${momTableMarkup(month)}
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">Performance trend</h3>
              <div class="panel-subtitle">${month.trend.label}</div>
            </div>
            <select class="metric-switch" id="overviewMetric" aria-label="Select trend metric">
              <option value="impressions">Impressions</option>
              <option value="engagements">Engagements</option>
              <option value="followers">Followers</option>
              <option value="posts">Posts</option>
            </select>
          </div>
          <div class="chart-wrap"><canvas id="overviewTrendChart" aria-label="Platform trend chart"></canvas></div>
        </section>
      </div>

      <div class="platform-strip">
        ${platformMini("linkedin", month.platforms.linkedin, month.comparison.platforms.linkedin)}
        ${platformMini("instagram", month.platforms.instagram, month.comparison.platforms.instagram)}
        ${platformMini("x", month.platforms.x, month.comparison.platforms.x)}
      </div>
    `;
  }

  function momTableMarkup(month) {
    const rows = [
      ["Posts", month.overview.posts, month.comparison.overview.posts],
      ["Followers", month.overview.followers, month.comparison.overview.followers],
      ["Net new followers", month.overview.newFollowers, month.comparison.overview.newFollowers],
      ["Impressions", month.overview.impressions, month.comparison.overview.impressions],
      ["Engagements", month.overview.engagements, month.comparison.overview.engagements]
    ];

    return `
      <div class="mom-table" role="table" aria-label="Month-on-month performance comparison">
        <div class="mom-row mom-head" role="row">
          <div role="columnheader">Metric</div>
          <div role="columnheader">${month.previousLabel.replace(/\s+\d{4}$/, "")}</div>
          <div role="columnheader">${month.label.replace(/\s+\d{4}$/, "")}</div>
          <div role="columnheader">Change</div>
        </div>
        ${rows.map(([label, current, comparison]) => `
          <div class="mom-row" role="row">
            <div class="mom-metric" role="cell">${label}</div>
            <div role="cell">${number(comparison.previous)}</div>
            <div role="cell">${number(current)}</div>
            <div role="cell"><span class="mom-delta ${deltaClass(comparison.delta)}"><i class="bi ${deltaIcon(comparison.delta)}" aria-hidden="true"></i>${signedPercent(comparison.delta)}</span></div>
          </div>`).join("")}
      </div>
      <div class="panel-footnote">Net-new-follower comparison is derived from month-end follower totals. Reach is excluded because July total reach is not like-for-like comparable.</div>`;
  }

  function platformMini(key, p, comparison) {
    return `
      <button class="platform-mini" type="button" data-open-platform="${key}" aria-label="Open ${p.name} details">
        <div class="platform-mini-top">
          <div class="platform-mini-title">${platformIcon(key)}<span>${p.name}</span></div>
          <span class="mini-delta ${deltaClass(comparison.impressions.delta)}"><i class="bi ${deltaIcon(comparison.impressions.delta)}" aria-hidden="true"></i>${signedPercent(comparison.impressions.delta)} impressions</span>
        </div>
        <div class="platform-mini-metrics">
          <div><div class="big">${number(p.followers)}</div><div class="small-label">Followers</div></div>
          <div><div class="big">${percent(p.engagementRate)}</div><div class="small-label">Engagement rate</div></div>
        </div>
      </button>`;
  }

  function platformMarkup(key, p, month) {
    const c = month.comparison.platforms[key];
    return `
      <div class="section-intro platform-heading">
        <div>
          <div class="section-kicker">Platform performance</div>
          <h2 class="section-title section-title-with-icon">${platformIcon(key)}<span>${p.name}</span></h2>
        </div>
        <div class="comparison-badge"><span class="comparison-dot"></span>${month.label} vs ${month.previousLabel}</div>
      </div>

      <div class="metric-grid">
        ${metricCard({ value: p.posts, label: "Posts published", comparison: c.posts })}
        ${metricCard({ value: p.followers, label: "Followers", comparison: c.followers })}
        ${metricCard({ value: p.newFollowers, label: "Net new followers", comparison: c.newFollowers, valuePrefix: "+" })}
        ${metricCard({ value: p.impressions, label: "Impressions", comparison: c.impressions })}
        ${metricCard({ value: p.reach, label: "Reach", comparison: c.reach })}
        ${metricCard({ value: p.engagements, label: "Engagements", comparison: c.engagements })}
      </div>

      <div class="platform-rate-line">
        <span class="rate-label">Engagement rate</span>
        <strong>${percent(p.engagementRate)}</strong>
        <span class="rate-note">${c.engagementRate.note}</span>
      </div>

      <div class="panel-grid equal platform-panels">
        <section class="panel">
          <div class="panel-header"><div><h3 class="panel-title">Posting cadence</h3><div class="panel-subtitle">Posts published by week</div></div></div>
          <div class="chart-wrap compact"><canvas id="${key}CadenceChart" aria-label="${p.name} weekly posting cadence"></canvas></div>
        </section>

        <section class="panel">
          <div class="panel-header"><div><h3 class="panel-title">Content mix</h3><div class="panel-subtitle">Format share of channel</div></div></div>
          <div class="format-list">
            ${p.contentMix.map(item => `<div class="format-row"><div class="format-label">${item.label}</div><div class="format-track"><div class="format-fill" style="width:${item.pct}%"></div></div><div class="format-pct">${item.pct}%</div></div>`).join("")}
          </div>
          <div class="language-pill"><strong>Language mix</strong> · ${p.language}</div>
        </section>
      </div>

      <div class="post-grid">
        ${postCard("Top performing", p.topPost)}
        ${postCard("Needs attention", p.lowPost)}
      </div>

      <div class="action-strip">
        <div class="action-dot" aria-hidden="true"></div>
        <div class="action-copy"><strong>Recommended action:</strong> ${p.action}</div>
        <div class="action-timeline">${p.actionTimeline}</div>
      </div>`;
  }

  function postCard(label, post) {
    return `
      <article class="post-card">
        <img class="post-thumb" src="${post.image}" alt="Post artwork placeholder">
        <div class="post-copy">
          <div class="post-kicker">${label} · ${post.date}</div>
          <div class="post-title">${post.title}</div>
          <div class="post-stats">
            <div><div class="post-stat-value">${percent(post.er)}</div><div class="post-stat-label">Engagement rate</div></div>
            <div><div class="post-stat-value">${number(post.impressions)}</div><div class="post-stat-label">Impressions</div></div>
            <div><div class="post-stat-value">${number(post.engagements)}</div><div class="post-stat-label">Engagements</div></div>
            <div><div class="post-stat-value">${number(post.extraValue)}</div><div class="post-stat-label">${post.extraLabel}</div></div>
          </div>
        </div>
      </article>`;
  }

  function insightsMarkup(month) {
    return `
      <div class="section-intro">
        <div>
          <div class="section-kicker">Management view</div>
          <h2 class="section-title">Insights & recommended actions</h2>
        </div>
        <div class="comparison-badge"><span class="comparison-dot"></span>${month.label}</div>
      </div>
      <div class="insights-grid">
        ${month.insights.map(i => `
          <article class="insight-card">
            <div class="insight-top"><div class="insight-platform">${i.platform}</div><div class="insight-timeline">${i.timeline}</div></div>
            <div class="insight-area">${i.area}</div>
            <div class="insight-action">${i.action}</div>
          </article>`).join("")}
      </div>`;
  }

  function render() {
    const month = activeMonth();
    $("#monthMeta").textContent = month.label;
    $("#comparisonMeta").textContent = `vs ${month.previousLabel}`;

    $("#overviewContent").innerHTML = overviewMarkup(month);
    $("#linkedinContent").innerHTML = platformMarkup("linkedin", month.platforms.linkedin, month);
    $("#instagramContent").innerHTML = platformMarkup("instagram", month.platforms.instagram, month);
    $("#xContent").innerHTML = platformMarkup("x", month.platforms.x, month);
    $("#insightsContent").innerHTML = insightsMarkup(month);

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
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111111",
          titleFont: { family: "proxima-nova" },
          bodyFont: { family: "proxima-nova" },
          padding: 9,
          cornerRadius: 8
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: "#777777", font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: "#eeeeee" }, border: { display: false }, ticks: { color: "#777777", font: { size: 10 }, maxTicksLimit: 5 } }
      }
    };
  }

  function destroyChart(name) {
    if (state.charts[name]) {
      state.charts[name].destroy();
      delete state.charts[name];
    }
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
          { label: "LinkedIn", data: t.linkedin[metric], borderColor: "#111111", backgroundColor: "#111111", borderWidth: 2, pointRadius: 2.5, pointHoverRadius: 5, tension: 0.32 },
          { label: "Instagram", data: t.instagram[metric], borderColor: "#777777", backgroundColor: "#777777", borderWidth: 2, pointRadius: 2.5, pointHoverRadius: 5, tension: 0.32 },
          { label: "X", data: t.x[metric], borderColor: "#b7b7b7", backgroundColor: "#b7b7b7", borderWidth: 2, pointRadius: 2.5, pointHoverRadius: 5, tension: 0.32 }
        ]
      },
      options: {
        ...chartBaseOptions(),
        plugins: {
          ...chartBaseOptions().plugins,
          legend: {
            display: true,
            position: "bottom",
            align: "start",
            labels: { usePointStyle: true, boxWidth: 6, boxHeight: 6, color: "#555555", padding: 14, font: { size: 10 } }
          }
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
        datasets: [{ data: p.cadence, backgroundColor: "#222222", borderRadius: 5, maxBarThickness: 44 }]
      },
      options: chartBaseOptions()
    });
  }

  function wireDynamicControls() {
    const metric = $("#overviewMetric");
    if (metric) metric.addEventListener("change", e => buildOverviewTrend(activeMonth(), e.target.value));

    $$('[data-open-platform]').forEach(btn => btn.addEventListener("click", () => {
      const tabButton = $(`#tab-${btn.dataset.openPlatform}`);
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
    select.addEventListener("change", e => {
      state.month = e.target.value;
      render();
    });
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
    exportWrap.style.background = "#ffffff";
    exportWrap.style.width = "1200px";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.borderBottom = "1px solid #e7e7e7";
    header.style.paddingBottom = "14px";
    header.style.marginBottom = "16px";
    header.innerHTML = `<div><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#3fae2a;font-weight:700">Monthly reporting</div><div style="font-size:28px;font-weight:700">Social Media Performance</div><div style="font-size:12px;color:#777">${activeMonth().label} vs ${activeMonth().previousLabel} · ${$(".nav-link.active").textContent.trim()}</div></div><img src="assets/images/gwc-logo-placeholder.svg" style="width:100px;height:auto" alt="GWC">`;
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
        html2canvas: { scale: 1.55, useCORS: true, backgroundColor: "#ffffff" },
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
