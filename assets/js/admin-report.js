(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client;
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get("id");
  const platforms = ["linkedin", "instagram", "x"];
  const platformNames = { linkedin: "LinkedIn", instagram: "Instagram", x: "X" };
  const contentFormats = {
    linkedin: ["Image", "Document", "Video", "Multi-image"],
    instagram: ["Carousel", "Image", "Story", "Reels"],
    x: ["Photo", "Video", "Text only"]
  };
  const languageTypes = ["English Only", "Bilingual", "Arabic Only", "Excluded"];
  const timelines = ["Ongoing", "Next 30 days", "Quarter end", "Next quarter", "Review required"];
  const state = {
    report: null,
    previousReport: null,
    metrics: {},
    previousMetrics: {},
    cadence: [],
    contentMix: [],
    languageMix: [],
    featuredPosts: {},
    insights: {},
    user: null,
    staticWired: false
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function monthLabel(dateString) {
    if (!dateString) return "—";
    const [y, m] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  }

  function previousMonthDate(dateString) {
    const [y, m] = dateString.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }

  function showAlert(message, type = "danger") {
    const el = $("#editorAlert");
    el.className = `alert alert-${type}`;
    el.textContent = message;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function hideAlert() {
    const el = $("#editorAlert");
    el.className = "alert d-none";
    el.textContent = "";
  }

  function numOrNull(value) {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function intOrZero(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function delta(current, previous) {
    const c = numOrNull(current);
    const p = numOrNull(previous);
    if (c === null || p === null || p === 0) return null;
    return ((c - p) / p) * 100;
  }

  function signedPercent(value) {
    if (value === null || value === undefined) return "—";
    const abs = Math.abs(value);
    const digits = Number.isInteger(abs) ? 0 : 1;
    return `${value > 0 ? "+" : value < 0 ? "-" : ""}${abs.toFixed(digits)}%`;
  }

  function rowMap(rows, key = "platform") {
    return Object.fromEntries((rows || []).map(r => [r[key], r]));
  }

  function field({ id, label, type = "number", value = "", step = "1", min = "0", placeholder = "", note = "" }) {
    return `
      <div class="metric-input-wrap">
        <label class="form-label" for="${id}">${label}</label>
        <input class="form-control" id="${id}" type="${type}" ${type === "number" ? `step="${step}" min="${min}"` : ""} value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(placeholder)}">
        ${note ? `<div class="field-note">${note}</div>` : ""}
      </div>`;
  }

  function metricField(platform, metric, label, value, previous, options = {}) {
    const id = `${platform}-${metric}`;
    const d = delta(value, previous);
    const compareClass = d === null ? "flat" : d > 0 ? "up" : d < 0 ? "down" : "flat";
    return `
      <div class="metric-input-wrap">
        <label class="form-label" for="${id}">${label}</label>
        <input class="form-control metric-field" data-platform="${platform}" data-metric="${metric}" id="${id}" type="number" min="0" step="${options.step || "1"}" value="${value ?? ""}">
        <div class="metric-compare" id="${id}-compare">Previous: ${previous ?? "—"}${d === null ? "" : ` · <span class="${compareClass}">${signedPercent(d)} MoM</span>`}</div>
      </div>`;
  }

  function insightFields(platform) {
    const insight = state.insights[platform] || {};
    return `
      <div class="form-grid two">
        <div>
          <label class="form-label" for="${platform}-observation">Observation</label>
          <textarea class="form-control" id="${platform}-observation" placeholder="What changed or stood out this month?">${escapeHtml(insight.observation || "")}</textarea>
        </div>
        <div>
          <label class="form-label" for="${platform}-action">Recommended action</label>
          <textarea class="form-control" id="${platform}-action" placeholder="What should the team do next?">${escapeHtml(insight.recommended_action || "")}</textarea>
        </div>
      </div>
      <div class="mt-3" style="max-width:260px">
        <label class="form-label" for="${platform}-timeline">Timeline</label>
        <select class="form-select" id="${platform}-timeline">
          <option value="">Select timeline</option>
          ${timelines.map(t => `<option value="${escapeHtml(t)}" ${insight.timeline === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
        </select>
      </div>`;
  }

  function featureEditor(platform, type) {
    const key = `${platform}:${type}`;
    const row = state.featuredPosts[key] || {};
    const label = type === "top" ? "Top performing" : "Needs attention";
    const image = row.image_url || `../assets/images/post-${platform}-${type === "top" ? "top" : "low"}.svg`;
    return `
      <article class="featured-card">
        <div class="feature-head">
          <div class="feature-type">${label}</div>
        </div>
        <div class="image-preview">
          <img id="feature-${platform}-${type}-preview" src="${escapeHtml(image)}" alt="${label} post preview">
          <div class="flex-grow-1">
            <label class="form-label" for="feature-${platform}-${type}-image">Post thumbnail</label>
            <input class="form-control form-control-sm" id="feature-${platform}-${type}-image" type="file" accept="image/png,image/jpeg,image/webp">
            <div class="small text-secondary mt-1">PNG, JPG or WebP. Existing image remains if no new file is selected.</div>
          </div>
        </div>
        <div class="form-grid two">
          ${field({ id: `feature-${platform}-${type}-date`, label: "Post date", type: "date", value: row.post_date || "" })}
          ${field({ id: `feature-${platform}-${type}-url`, label: "Post URL", type: "url", value: row.post_url || "", placeholder: "https://..." })}
        </div>
        <div class="mt-3">
          <label class="form-label" for="feature-${platform}-${type}-title">Post title / caption</label>
          <input class="form-control" id="feature-${platform}-${type}-title" type="text" value="${escapeHtml(row.title || "")}" placeholder="Short post title or caption">
        </div>
        <div class="form-grid mt-3">
          ${field({ id: `feature-${platform}-${type}-er`, label: "Engagement rate (%)", value: row.engagement_rate ?? "", step: "0.01" })}
          ${field({ id: `feature-${platform}-${type}-impressions`, label: "Impressions", value: row.impressions ?? "" })}
          ${field({ id: `feature-${platform}-${type}-reach`, label: "Reach", value: row.reach ?? "", note: "Leave blank if unavailable" })}
          ${field({ id: `feature-${platform}-${type}-engagements`, label: "Engagements", value: row.engagements ?? "" })}
          ${field({ id: `feature-${platform}-${type}-likes`, label: "Likes", value: row.likes ?? "" })}
          ${field({ id: `feature-${platform}-${type}-clicks`, label: "Link clicks", value: row.link_clicks ?? "", note: "Useful for LinkedIn" })}
        </div>
      </article>`;
  }

  function renderInfo() {
    const info = $("#editor-info");
    info.innerHTML = `
      <section class="editor-card">
        <div class="editor-card-title">
          <div><div class="admin-section-kicker">Report setup</div><h2>${monthLabel(state.report.report_month)}</h2><div class="editor-help">The reporting month cannot be changed after creation. Create a new report if the month is incorrect.</div></div>
        </div>
        <div class="form-grid two">
          <div>
            <label class="form-label" for="report-source">Reporting source</label>
            <input class="form-control" id="report-source" type="text" value="${escapeHtml(state.report.source || "Meltwater")}">
          </div>
          <div>
            <label class="form-label" for="report-prepared-by">Prepared by</label>
            <input class="form-control" id="report-prepared-by" type="text" value="${escapeHtml(state.report.prepared_by || "")}" placeholder="Name / team">
          </div>
        </div>
        <div class="inline-summary mt-3">
          <div class="summary-chip">Current month: <strong>${monthLabel(state.report.report_month)}</strong></div>
          <div class="summary-chip">MoM comparison: <strong>${state.previousReport ? monthLabel(state.previousReport.report_month) : "No previous report"}</strong></div>
          <div class="summary-chip">Status: <strong>${escapeHtml(state.report.status)}</strong></div>
        </div>
      </section>

      <section class="editor-card">
        <div class="editor-card-title"><div><div class="admin-section-kicker">Management summary</div><h3>All-platform insight</h3><div class="editor-help">This appears in the Insights tab as the overall monthly recommendation.</div></div></div>
        ${insightFields("all")}
      </section>

      <section class="editor-card">
        <div class="completion-banner">Enter raw monthly values only. Net-new followers, totals, content percentages and MoM percentages are calculated by the dashboard.</div>
      </section>`;
  }

  function renderPlatform(platform) {
    const current = state.metrics[platform] || {};
    const previous = state.previousMetrics[platform] || {};
    const cadenceByWeek = Object.fromEntries(state.cadence.filter(r => r.platform === platform).map(r => [r.week_number, r.post_count]));
    const mixByFormat = Object.fromEntries(state.contentMix.filter(r => r.platform === platform).map(r => [r.format, r.post_count]));
    const langByType = Object.fromEntries(state.languageMix.filter(r => r.platform === platform).map(r => [r.language, r.post_count]));
    const pane = $(`#editor-${platform}`);

    const currentNew = current.followers != null && previous.followers != null ? Number(current.followers) - Number(previous.followers) : null;

    pane.innerHTML = `
      <section class="editor-card">
        <div class="editor-card-title">
          <div><div class="admin-section-kicker">Platform metrics</div><h2>${platformNames[platform]}</h2><div class="editor-help">Previous-month values are read from ${state.previousReport ? monthLabel(state.previousReport.report_month) : "the database"} and are not editable here.</div></div>
          <div class="summary-chip">Net new followers: <strong id="${platform}-new-followers-summary">${currentNew == null ? "—" : `${currentNew >= 0 ? "+" : ""}${currentNew.toLocaleString("en-GB")}`}</strong></div>
        </div>
        <div class="form-grid">
          ${metricField(platform, "posts", "Posts published", current.posts ?? "", previous.posts ?? null)}
          ${metricField(platform, "followers", "Followers", current.followers ?? "", previous.followers ?? null)}
          ${metricField(platform, "impressions", "Impressions", current.impressions ?? "", previous.impressions ?? null)}
          ${metricField(platform, "reach", "Reach", current.reach ?? "", previous.reach ?? null)}
          ${metricField(platform, "engagements", "Engagements", current.engagements ?? "", previous.engagements ?? null)}
          ${metricField(platform, "engagement_rate", "Engagement rate (%)", current.engagement_rate ?? "", previous.engagement_rate ?? null, { step: "0.01" })}
        </div>
      </section>

      <section class="editor-card">
        <div class="editor-card-title"><div><div class="admin-section-kicker">Publishing pattern</div><h3>Posting cadence</h3><div class="editor-help">Weekly totals should equal Posts published.</div></div><div class="summary-chip" id="${platform}-cadence-total">Total: 0</div></div>
        <div class="form-grid five">
          ${[1,2,3,4,5].map(week => field({ id: `${platform}-week-${week}`, label: `Week ${week}`, value: cadenceByWeek[week] ?? 0 })).join("")}
        </div>
      </section>

      <section class="editor-card">
        <div class="editor-card-title"><div><div class="admin-section-kicker">Content distribution</div><h3>Content mix</h3><div class="editor-help">Enter post counts. Percentages are calculated automatically.</div></div><div class="summary-chip" id="${platform}-mix-total">Total: 0</div></div>
        <div class="mix-grid">
          ${contentFormats[platform].map(format => `
            <div class="mix-item">
              <label for="${platform}-format-${format.replace(/[^a-z0-9]/gi, "-").toLowerCase()}">${escapeHtml(format)}</label>
              <input class="form-control content-mix-input" data-platform="${platform}" data-format="${escapeHtml(format)}" id="${platform}-format-${format.replace(/[^a-z0-9]/gi, "-").toLowerCase()}" type="number" min="0" step="1" value="${mixByFormat[format] ?? 0}">
              <div class="mix-preview" data-mix-preview="${platform}:${escapeHtml(format)}">0%</div>
            </div>`).join("")}
        </div>
      </section>

      <section class="editor-card">
        <div class="editor-card-title"><div><div class="admin-section-kicker">Language</div><h3>Language mix</h3><div class="editor-help">Use Excluded for posts such as Stories that should not be part of the language-percentage calculation.</div></div></div>
        <div class="mix-grid">
          ${languageTypes.map(language => `
            <div class="mix-item">
              <label for="${platform}-lang-${language.replace(/[^a-z0-9]/gi, "-").toLowerCase()}">${escapeHtml(language)}</label>
              <input class="form-control" id="${platform}-lang-${language.replace(/[^a-z0-9]/gi, "-").toLowerCase()}" type="number" min="0" step="1" value="${langByType[language] ?? 0}">
            </div>`).join("")}
        </div>
      </section>

      <section class="editor-card">
        <div class="editor-card-title"><div><div class="admin-section-kicker">Content highlights</div><h3>Featured posts</h3><div class="editor-help">These populate the Top Performing and Needs Attention cards on the dashboard.</div></div></div>
        <div class="featured-grid">
          ${featureEditor(platform, "top")}
          ${featureEditor(platform, "needs_attention")}
        </div>
      </section>

      <section class="editor-card">
        <div class="editor-card-title"><div><div class="admin-section-kicker">Management insight</div><h3>${platformNames[platform]} action</h3></div></div>
        ${insightFields(platform)}
      </section>`;
  }

  async function loadState() {
    const { data: report, error: reportError } = await client.from("reports").select("*").eq("id", reportId).single();
    if (reportError) throw reportError;
    state.report = report;

    const previousDate = previousMonthDate(report.report_month);
    const { data: previousReport, error: prevError } = await client.from("reports").select("*").eq("report_month", previousDate).maybeSingle();
    if (prevError) throw prevError;
    state.previousReport = previousReport || null;

    const [metrics, prevMetrics, cadence, mix, language, featured, insights] = await Promise.all([
      client.from("platform_metrics").select("*").eq("report_id", reportId),
      previousReport ? client.from("platform_metrics").select("*").eq("report_id", previousReport.id) : Promise.resolve({ data: [], error: null }),
      client.from("weekly_cadence").select("*").eq("report_id", reportId),
      client.from("content_mix").select("*").eq("report_id", reportId),
      client.from("language_mix").select("*").eq("report_id", reportId),
      client.from("featured_posts").select("*").eq("report_id", reportId),
      client.from("insights").select("*").eq("report_id", reportId)
    ]);

    for (const res of [metrics, prevMetrics, cadence, mix, language, featured, insights]) {
      if (res.error) throw res.error;
    }

    state.metrics = rowMap(metrics.data || []);
    state.previousMetrics = rowMap(prevMetrics.data || []);
    state.cadence = cadence.data || [];
    state.contentMix = mix.data || [];
    state.languageMix = language.data || [];
    state.featuredPosts = Object.fromEntries((featured.data || []).map(r => [`${r.platform}:${r.performance_type}`, r]));
    state.insights = Object.fromEntries((insights.data || []).map(r => [r.platform, r]));
  }

  function updateStatusUi() {
    $("#reportTitle").textContent = monthLabel(state.report.report_month);
    const badge = $("#statusBadge");
    badge.textContent = state.report.status;
    badge.className = `status-badge ${state.report.status === "published" ? "published" : ""}`;
    const preview = $("#previewBtn");
    preview.href = `../index.html?preview=${encodeURIComponent(reportId)}`;
    preview.classList.remove("disabled");
  }

  function updateLiveComparison(platform, metric) {
    const input = $(`#${platform}-${metric}`);
    const compare = $(`#${platform}-${metric}-compare`);
    if (!input || !compare) return;
    const current = numOrNull(input.value);
    const previous = state.previousMetrics[platform]?.[metric] ?? null;
    const d = delta(current, previous);
    const cls = d === null ? "flat" : d > 0 ? "up" : d < 0 ? "down" : "flat";
    compare.innerHTML = `Previous: ${previous ?? "—"}${d === null ? "" : ` · <span class="${cls}">${signedPercent(d)} MoM</span>`}`;

    if (metric === "followers") {
      const newFollowers = current !== null && previous !== null ? current - Number(previous) : null;
      const summary = $(`#${platform}-new-followers-summary`);
      if (summary) summary.textContent = newFollowers === null ? "—" : `${newFollowers >= 0 ? "+" : ""}${newFollowers.toLocaleString("en-GB")}`;
    }
  }

  function inputValue(id) {
    return $(id)?.value ?? "";
  }

  function sumCadence(platform) {
    return [1,2,3,4,5].reduce((sum, week) => sum + intOrZero(inputValue(`#${platform}-week-${week}`)), 0);
  }

  function sumMix(platform) {
    return contentFormats[platform].reduce((sum, format) => {
      const id = `#${platform}-format-${format.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
      return sum + intOrZero(inputValue(id));
    }, 0);
  }

  function updateDerivedUi(platform) {
    const posts = intOrZero(inputValue(`#${platform}-posts`));
    const cadenceTotal = sumCadence(platform);
    const mixTotal = sumMix(platform);
    const cadenceEl = $(`#${platform}-cadence-total`);
    const mixEl = $(`#${platform}-mix-total`);
    cadenceEl.textContent = `Total: ${cadenceTotal}${cadenceTotal === posts ? " ✓" : ` / ${posts}`}`;
    mixEl.textContent = `Total: ${mixTotal}${mixTotal === posts ? " ✓" : ` / ${posts}`}`;

    contentFormats[platform].forEach(format => {
      const id = `#${platform}-format-${format.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
      const value = intOrZero(inputValue(id));
      const pct = mixTotal > 0 ? Math.round((value / mixTotal) * 100) : 0;
      const preview = document.querySelector(`[data-mix-preview="${CSS.escape(`${platform}:${format}`)}"]`);
      if (preview) preview.textContent = `${pct}%`;
    });
  }

  function validateReport() {
    const checks = [];
    let valid = true;

    platforms.forEach(platform => {
      const name = platformNames[platform];
      const requiredMetrics = ["posts", "followers", "impressions", "engagements"];
      const missing = requiredMetrics.filter(metric => numOrNull(inputValue(`#${platform}-${metric}`)) === null);
      if (missing.length) {
        valid = false;
        checks.push({ status: "error", text: `${name}: complete Posts, Followers, Impressions and Engagements.` });
      } else {
        checks.push({ status: "ok", text: `${name}: core metrics complete.` });
      }

      const posts = intOrZero(inputValue(`#${platform}-posts`));
      const cadenceTotal = sumCadence(platform);
      const mixTotal = sumMix(platform);

      if (cadenceTotal !== posts) {
        valid = false;
        checks.push({ status: "warn", text: `${name}: weekly cadence totals ${cadenceTotal}, but Posts published is ${posts}.` });
      } else {
        checks.push({ status: "ok", text: `${name}: cadence matches total posts.` });
      }

      if (mixTotal !== posts) {
        valid = false;
        checks.push({ status: "warn", text: `${name}: content mix totals ${mixTotal}, but Posts published is ${posts}.` });
      } else {
        checks.push({ status: "ok", text: `${name}: content mix matches total posts.` });
      }
    });

    if (!inputValue("#report-source").trim()) {
      valid = false;
      checks.unshift({ status: "error", text: "Reporting source is required." });
    }

    return { valid, checks };
  }

  function renderValidation() {
    const { valid, checks } = validateReport();
    $("#validationSummary").innerHTML = `
      <div class="completion-banner ${valid ? "" : "error"}">${valid ? "Ready to publish." : "Complete the checks below before publishing."}</div>
      ${checks.map(check => `<div class="validation-item ${check.status}"><i class="bi ${check.status === "ok" ? "bi-check-circle-fill" : check.status === "warn" ? "bi-exclamation-circle-fill" : "bi-x-circle-fill"}"></i><span>${escapeHtml(check.text)}</span></div>`).join("")}`;
    $("#publishBtn").disabled = !valid;
    return valid;
  }

  function wireEditor() {
    if (!state.staticWired) {
      $$("[data-editor-tab]").forEach(button => {
        button.addEventListener("click", () => {
          $$("[data-editor-tab]").forEach(b => b.classList.toggle("active", b === button));
          $$(".editor-pane").forEach(pane => pane.classList.remove("active"));
          $(`#editor-${button.dataset.editorTab}`).classList.add("active");
        });
      });
      $("#saveBtn").addEventListener("click", () => saveReport(false));
      $("#publishBtn").addEventListener("click", () => saveReport(true));
      state.staticWired = true;
    }

    platforms.forEach(platform => {
      ["posts", "followers", "impressions", "reach", "engagements", "engagement_rate"].forEach(metric => {
        const el = $(`#${platform}-${metric}`);
        el?.addEventListener("input", () => {
          updateLiveComparison(platform, metric);
          updateDerivedUi(platform);
          renderValidation();
        });
      });

      [1,2,3,4,5].forEach(week => {
        $(`#${platform}-week-${week}`)?.addEventListener("input", () => {
          updateDerivedUi(platform);
          renderValidation();
        });
      });

      contentFormats[platform].forEach(format => {
        const id = `#${platform}-format-${format.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
        $(id)?.addEventListener("input", () => {
          updateDerivedUi(platform);
          renderValidation();
        });
      });

      ["top", "needs_attention"].forEach(type => {
        const file = $(`#feature-${platform}-${type}-image`);
        file?.addEventListener("change", () => {
          const selected = file.files?.[0];
          if (!selected) return;
          const preview = $(`#feature-${platform}-${type}-preview`);
          preview.src = URL.createObjectURL(selected);
        });
      });

      updateDerivedUi(platform);
    });

    $("#report-source")?.addEventListener("input", renderValidation);
    renderValidation();
  }

  function collectMetrics() {
    return platforms.map(platform => ({
      report_id: reportId,
      platform,
      posts: intOrZero(inputValue(`#${platform}-posts`)),
      followers: intOrZero(inputValue(`#${platform}-followers`)),
      impressions: intOrZero(inputValue(`#${platform}-impressions`)),
      reach: numOrNull(inputValue(`#${platform}-reach`)),
      engagements: intOrZero(inputValue(`#${platform}-engagements`)),
      engagement_rate: numOrNull(inputValue(`#${platform}-engagement_rate`))
    }));
  }

  function collectCadence() {
    return platforms.flatMap(platform => [1,2,3,4,5].map(week => ({
      report_id: reportId,
      platform,
      week_number: week,
      post_count: intOrZero(inputValue(`#${platform}-week-${week}`))
    })));
  }

  function collectContentMix() {
    return platforms.flatMap(platform => contentFormats[platform].map(format => ({
      report_id: reportId,
      platform,
      format,
      post_count: intOrZero(inputValue(`#${platform}-format-${format.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`))
    })));
  }

  function collectLanguageMix() {
    return platforms.flatMap(platform => languageTypes.map(language => ({
      report_id: reportId,
      platform,
      language,
      post_count: intOrZero(inputValue(`#${platform}-lang-${language.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`))
    })));
  }

  function collectInsights() {
    return ["all", ...platforms].map(platform => ({
      report_id: reportId,
      platform,
      observation: inputValue(`#${platform}-observation`).trim() || null,
      recommended_action: inputValue(`#${platform}-action`).trim() || null,
      timeline: inputValue(`#${platform}-timeline`) || null
    })).filter(row => row.observation || row.recommended_action || row.timeline);
  }

  async function uploadPostImage(platform, type, existingUrl) {
    const fileInput = $(`#feature-${platform}-${type}-image`);
    const file = fileInput?.files?.[0];
    if (!file) return existingUrl || null;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${reportId}/${platform}/${type}-${Date.now()}-${safeName}`;
    const bucket = api.config.STORAGE_BUCKET || "social-posts";
    const { error } = await client.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined
    });
    if (error) throw error;
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function collectFeaturedPosts() {
    const rows = [];
    for (const platform of platforms) {
      for (const type of ["top", "needs_attention"]) {
        const existing = state.featuredPosts[`${platform}:${type}`] || {};
        const imageUrl = await uploadPostImage(platform, type, existing.image_url);
        const row = {
          report_id: reportId,
          platform,
          performance_type: type,
          post_date: inputValue(`#feature-${platform}-${type}-date`) || null,
          title: inputValue(`#feature-${platform}-${type}-title`).trim() || null,
          post_url: inputValue(`#feature-${platform}-${type}-url`).trim() || null,
          image_url: imageUrl,
          engagement_rate: numOrNull(inputValue(`#feature-${platform}-${type}-er`)),
          impressions: numOrNull(inputValue(`#feature-${platform}-${type}-impressions`)),
          reach: numOrNull(inputValue(`#feature-${platform}-${type}-reach`)),
          engagements: numOrNull(inputValue(`#feature-${platform}-${type}-engagements`)),
          likes: numOrNull(inputValue(`#feature-${platform}-${type}-likes`)),
          link_clicks: numOrNull(inputValue(`#feature-${platform}-${type}-clicks`))
        };
        const hasContent = row.post_date || row.title || row.post_url || row.image_url || row.engagement_rate !== null || row.impressions !== null || row.engagements !== null || row.likes !== null || row.link_clicks !== null;
        if (hasContent) rows.push(row);
      }
    }
    return rows;
  }

  async function replaceRows(table, rows) {
    const { error: deleteError } = await client.from(table).delete().eq("report_id", reportId);
    if (deleteError) throw deleteError;
    if (!rows.length) return;
    const { error: insertError } = await client.from(table).insert(rows);
    if (insertError) throw insertError;
  }

  async function saveReport(publish) {
    hideAlert();
    if (publish && !renderValidation()) {
      showAlert("Resolve the validation issues before publishing.", "warning");
      return;
    }

    const saveBtn = $("#saveBtn");
    const publishBtn = $("#publishBtn");
    const originalSave = saveBtn.innerHTML;
    const originalPublish = publishBtn.innerHTML;
    saveBtn.disabled = true;
    publishBtn.disabled = true;
    const activeButton = publish ? publishBtn : saveBtn;
    activeButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';

    try {
      const status = publish ? "published" : state.report.status;
      const reportUpdate = {
        source: inputValue("#report-source").trim() || "Meltwater",
        prepared_by: inputValue("#report-prepared-by").trim() || null,
        status,
        updated_at: new Date().toISOString()
      };
      if (publish) reportUpdate.published_at = new Date().toISOString();

      const { error: reportError } = await client.from("reports").update(reportUpdate).eq("id", reportId);
      if (reportError) throw reportError;

      const { error: metricsError } = await client.from("platform_metrics").upsert(collectMetrics(), { onConflict: "report_id,platform" });
      if (metricsError) throw metricsError;

      await replaceRows("weekly_cadence", collectCadence());
      await replaceRows("content_mix", collectContentMix());
      await replaceRows("language_mix", collectLanguageMix());

      const featuredRows = await collectFeaturedPosts();
      await replaceRows("featured_posts", featuredRows);
      await replaceRows("insights", collectInsights());

      state.report = { ...state.report, ...reportUpdate };
      await loadState();
      updateStatusUi();
      showAlert(publish ? "Report published successfully. It is now available in the public dashboard month selector." : "Draft saved successfully.", "success");
      renderInfo();
      platforms.forEach(renderPlatform);
      wireEditor();
    } catch (err) {
      console.error(err);
      showAlert(err.message || "Unable to save report.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalSave;
      publishBtn.innerHTML = originalPublish;
      renderValidation();
    }
  }

  async function init() {
    if (!reportId) {
      showAlert("Missing report ID.");
      return;
    }
    if (!api?.ready || !client) {
      showAlert("Supabase is not configured. Complete docs/SUPABASE_SETUP.md first.");
      return;
    }

    const admin = await api.requireAdmin();
    if (!admin) return;
    state.user = admin.user;

    try {
      await loadState();
      updateStatusUi();
      renderInfo();
      platforms.forEach(renderPlatform);
      wireEditor();
    } catch (err) {
      console.error(err);
      showAlert(err.message || "Unable to load this report.");
    }
  }

  init();
})();
