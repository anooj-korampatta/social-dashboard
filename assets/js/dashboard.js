// GWC dashboard merged patch: Insights platform logos + X reach handling + existing overview enhancements. Build 2026-10-05
(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const supabase = api?.client || null;
  const state = { reports: [], activeReportId: null, bundle: null, charts: {}, chartRange: "5", trendRange: "5", trendMetric: "impressions" };
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const fmt = new Intl.NumberFormat("en-GB");
  const platforms = ["linkedin", "instagram", "x"];

  const number = (value) => value === null || value === undefined || value === "" ? "—" : fmt.format(Number(value));
  const percent = (value) => value === null || value === undefined || value === "" ? "—" : `${Number(value).toFixed(2)}%`;
  const signedPercent = (value) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    const abs = Math.abs(n);
    const digits = Number.isInteger(abs) ? 0 : 1;
    if (n > 0) return `+${abs.toFixed(digits)}%`;
    if (n < 0) return `-${abs.toFixed(digits)}%`;
    return "0%";
  };

  function monthLabel(dateString) {
    if (!dateString) return "—";
    const [y, m] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  }

  function shortMonth(dateString) {
    if (!dateString) return "—";
    const [y, m] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  }

  function shortMonthYear(dateString) {
    if (!dateString) return "—";
    const [y, m] = dateString.split("-").map(Number);
    const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, 1)));
    return `${month} '${String(y).slice(-2)}`;
  }

  function previousMonthDate(dateString) {
    const [y, m] = dateString.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }

  function delta(current, previous) {
    if (current === null || current === undefined || previous === null || previous === undefined) return null;
    const c = Number(current);
    const p = Number(previous);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
    return ((c - p) / p) * 100;
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

  function platformBrandIcon(key) {
    const icons = {
      linkedin: '<span class="social-platform-icon linkedin" aria-hidden="true"><i class="bi bi-linkedin"></i></span>',
      instagram: '<span class="social-platform-icon instagram" aria-hidden="true"><i class="bi bi-instagram"></i></span>',
      x: '<span class="social-platform-icon x" aria-hidden="true"><i class="bi bi-twitter-x"></i></span>'
    };
    return icons[key] || "";
  }

  function normalizePlatformKey(value) {
    const key = String(value || "").trim().toLowerCase();
    if (["all", "all platforms", "all-platforms", "all_platforms"].includes(key)) return "all";
    if (["linkedin", "linked in"].includes(key)) return "linkedin";
    if (["instagram", "insta", "ig"].includes(key)) return "instagram";
    if (["x", "twitter", "twitter x", "twitter/x", "x (twitter)"].includes(key)) return "x";
    return key;
  }

  function insightPlatformIdentity(rawKey) {
    const key = normalizePlatformKey(rawKey);
    const label = key === "all" ? "All platforms" : key === "linkedin" ? "LinkedIn" : key === "instagram" ? "Instagram" : key === "x" ? "X" : (rawKey || "Platform");
    const icon = key === "all"
      ? `<span class="insight-platform-cluster" aria-hidden="true">
          <span class="insight-cluster-icon linkedin"><i class="bi bi-linkedin"></i></span>
          <span class="insight-cluster-icon instagram"><i class="bi bi-instagram"></i></span>
          <span class="insight-cluster-icon x"><i class="bi bi-twitter-x"></i></span>
        </span>`
      : platformBrandIcon(key);

    return `<span class="insight-platform-identity" data-platform="${key}">${icon}<span>${label}</span></span>`;
  }

  function signedNumber(value) {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return `${n > 0 ? "+" : ""}${number(n)}`;
  }

  function showMessage(message, type = "info") {
    const el = $("#systemMessage");
    if (!el) return;
    el.className = `system-message system-message-${type}`;
    el.textContent = message;
  }

  function hideMessage() {
    const el = $("#systemMessage");
    if (!el) return;
    el.className = "system-message d-none";
    el.textContent = "";
  }

  function toMap(rows, key = "platform") {
    return Object.fromEntries((rows || []).map(row => [row[key], row]));
  }

  function sumMetric(metricsMap, metric) {
    const vals = platforms
      .map(p => metricsMap[p]?.[metric])
      .filter(v => v !== null && v !== undefined && v !== "");
    if (!vals.length) return null;
    return vals.reduce((sum, v) => sum + Number(v), 0);
  }

  function reachComparable(currentMap, previousMap) {
    const currentKeys = platforms.filter(p => currentMap[p]?.reach !== null && currentMap[p]?.reach !== undefined);
    const previousKeys = platforms.filter(p => previousMap[p]?.reach !== null && previousMap[p]?.reach !== undefined);
    return currentKeys.length > 0 && currentKeys.join("|") === previousKeys.join("|");
  }

  function comparableReachComparison(currentMap, previousMap) {
    const comparable = platforms.filter(platform => {
      const current = currentMap[platform]?.reach;
      const previous = previousMap[platform]?.reach;
      return current !== null && current !== undefined && previous !== null && previous !== undefined;
    });

    if (!comparable.length) {
      return { previous: null, delta: null, note: "No comparable reach data", comparablePlatforms: [] };
    }

    const currentComparable = comparable.reduce((sum, platform) => sum + Number(currentMap[platform].reach), 0);
    const previousComparable = comparable.reduce((sum, platform) => sum + Number(previousMap[platform].reach), 0);
    const currentReported = platforms.filter(platform => currentMap[platform]?.reach !== null && currentMap[platform]?.reach !== undefined);
    const previousReported = platforms.filter(platform => previousMap[platform]?.reach !== null && previousMap[platform]?.reach !== undefined);
    const isPartial = comparable.length !== currentReported.length || comparable.length !== previousReported.length;
    const names = { linkedin: "LinkedIn", instagram: "Instagram", x: "X" };

    return {
      previous: previousComparable,
      delta: delta(currentComparable, previousComparable),
      note: isPartial ? `MoM based on ${comparable.map(p => names[p]).join(" + ")} only` : "",
      previousLabel: isPartial ? "Comparable previous" : "Previous",
      comparablePlatforms: comparable
    };
  }

  function buildOverview(metricsMap, previousMetricsMap, priorPreviousMetricsMap) {
    const followers = sumMetric(metricsMap, "followers");
    const prevFollowers = sumMetric(previousMetricsMap, "followers");
    const priorFollowers = sumMetric(priorPreviousMetricsMap, "followers");
    const newFollowers = followers !== null && prevFollowers !== null ? followers - prevFollowers : null;
    const previousNewFollowers = prevFollowers !== null && priorFollowers !== null ? prevFollowers - priorFollowers : null;

    return {
      current: {
        posts: sumMetric(metricsMap, "posts"),
        followers,
        newFollowers,
        impressions: sumMetric(metricsMap, "impressions"),
        reach: sumMetric(metricsMap, "reach"),
        engagements: sumMetric(metricsMap, "engagements")
      },
      previous: {
        posts: sumMetric(previousMetricsMap, "posts"),
        followers: prevFollowers,
        newFollowers: previousNewFollowers,
        impressions: sumMetric(previousMetricsMap, "impressions"),
        reach: sumMetric(previousMetricsMap, "reach"),
        engagements: sumMetric(previousMetricsMap, "engagements")
      },
      reachIsComparable: reachComparable(metricsMap, previousMetricsMap)
    };
  }

  function comparisonObject(current, previous, note = "") {
    return { previous, delta: delta(current, previous), note };
  }

  function metricCard({ value, label, comparison, valuePrefix = "", valueSuffix = "", icon = "bi-bar-chart", breakdown = null, comparisonLabel = "previous month" }) {
    const display = value === null || value === undefined ? "—" : `${valuePrefix}${number(value)}${valueSuffix}`;
    let comparisonHtml = '<div class="metric-comparison neutral"><span>No previous-month comparison</span></div>';

    if (comparison) {
      if (comparison.delta !== null && comparison.delta !== undefined) {
        comparisonHtml = `
          <div class="metric-comparison ${deltaClass(comparison.delta)}">
            <span class="delta-value"><i class="bi ${deltaIcon(comparison.delta)}" aria-hidden="true"></i>${signedPercent(comparison.delta)}</span>
            <span>vs ${comparisonLabel}</span>
          </div>`;
      } else if (comparison.note) {
        comparisonHtml = `<div class="metric-comparison neutral"><span>${comparison.note}</span></div>`;
      }
    }

    const previousLabel = comparison?.previousLabel || "Previous";
    const previousHtml = comparison && comparison.previous !== null && comparison.previous !== undefined
      ? `<div class="metric-previous">${previousLabel}: ${valuePrefix}${number(comparison.previous)}${valueSuffix}</div>`
      : '<div class="metric-previous">Previous value unavailable</div>';
    const trendGlyph = comparison?.delta < 0 ? "bi-graph-down-arrow" : "bi-graph-up-arrow";
    const trendClass = comparison?.delta < 0 ? "negative" : comparison?.delta > 0 ? "positive" : "neutral";

    const breakdownKey = String(label || "metric")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const breakdownId = `metric-breakdown-${breakdownKey}`;
    const breakdownHtml = Array.isArray(breakdown) && breakdown.length
      ? `<div class="metric-breakdown-collapse" id="${breakdownId}" aria-hidden="true">
          <div class="metric-breakdown">${breakdown.map(item => {
            const valueText = item.unavailable
              ? '<span class="breakdown-unavailable">— <small>Not reported</small></span>'
              : item.signed ? signedNumber(item.value) : number(item.value);
            return `<div class="metric-breakdown-row">
              <div class="metric-breakdown-platform">${platformBrandIcon(item.key)}<span>${item.label}</span></div>
              <strong>${valueText}</strong>
            </div>`;
          }).join("")}</div>
        </div>`
      : "";
    const breakdownToggle = breakdownHtml
      ? `<button class="metric-breakdown-toggle" type="button" data-metric-breakdown-toggle aria-expanded="false" aria-controls="${breakdownId}" aria-label="Show ${label} channel breakdown" title="Show channel breakdown">
          <i class="bi bi-chevron-down" aria-hidden="true"></i>
        </button>`
      : "";

    const comparisonNote = comparison?.delta !== null && comparison?.delta !== undefined && comparison?.note
      ? `<div class="metric-comparison-note">${comparison.note}</div>`
      : "";

    return `
      <article class="metric-card ${breakdownHtml ? "executive-metric-card" : ""}">
        <div class="metric-card-top">
          <span class="metric-icon"><i class="bi ${icon}" aria-hidden="true"></i></span>
          <i class="bi ${trendGlyph} metric-trend-icon ${trendClass}" aria-hidden="true"></i>
        </div>
        <div class="metric-label">${label}</div>
        <div class="metric-value">${display}</div>
        ${comparisonHtml}
        ${comparisonNote}
        ${previousHtml}
        ${breakdownHtml}
        ${breakdownToggle}
      </article>`;
  }

  function normalizeContentMix(rows, platform) {
    const relevant = (rows || []).filter(r => r.platform === platform);
    const total = relevant.reduce((sum, r) => sum + Number(r.post_count || 0), 0);
    return relevant.map(r => ({
      label: r.format,
      posts: Number(r.post_count || 0),
      pct: total > 0 ? Math.round((Number(r.post_count || 0) / total) * 100) : 0
    }));
  }

  function normalizeCadence(rows, platform) {
    const relevant = (rows || []).filter(r => r.platform === platform);
    const byWeek = Object.fromEntries(relevant.map(r => [Number(r.week_number), Number(r.post_count || 0)]));
    return [1, 2, 3, 4, 5].map(week => byWeek[week] || 0);
  }

  function normalizeLanguage(rows, platform) {
    const relevant = (rows || []).filter(r => r.platform === platform);
    const included = relevant.filter(r => String(r.language).toLowerCase() !== "excluded");
    const total = included.reduce((sum, r) => sum + Number(r.post_count || 0), 0);
    if (!included.length || total === 0) return "Not provided";
    return included
      .filter(r => Number(r.post_count || 0) > 0)
      .map(r => `${r.language} ${Math.round((Number(r.post_count || 0) / total) * 100)}%`)
      .join(" · ");
  }

  function placeholderImage(platform, type) {
    return `assets/images/post-${platform}-${type === "top" ? "top" : "low"}.svg`;
  }

  function safeExternalUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(String(value).trim());
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function normalizePost(rows, platform, type) {
    const row = (rows || []).find(r => r.platform === platform && r.performance_type === type);
    if (!row) {
      return {
        image: placeholderImage(platform, type),
        postUrl: null,
        date: "No post selected",
        title: type === "top" ? "Add the top-performing post in the CMS" : "Add the needs-attention post in the CMS",
        er: null,
        impressions: null,
        engagements: null,
        extraLabel: "Likes",
        extraValue: null
      };
    }

    // Instagram cards use Likes rather than Link clicks.
    // LinkedIn/X keep Link clicks when Meltwater provides them, otherwise Likes.
    const useLikes = platform === "instagram" || row.link_clicks === null || row.link_clicks === undefined;
    const extraLabel = useLikes ? "Likes" : "Link clicks";
    const extraValue = useLikes ? row.likes : row.link_clicks;

    return {
      image: row.image_url || placeholderImage(platform, type),
      postUrl: safeExternalUrl(row.post_url),
      date: row.post_date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${row.post_date}T00:00:00Z`)) : "—",
      title: row.title || row.post_url || "Untitled post",
      er: row.engagement_rate,
      impressions: row.impressions,
      engagements: row.engagements,
      extraLabel,
      extraValue
    };
  }

  async function fetchReportByMonth(date, includeDraft = false) {
    let q = supabase.from("reports").select("*").eq("report_month", date);
    if (!includeDraft) q = q.eq("status", "published").eq("is_hidden", false);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function fetchMetrics(reportId) {
    if (!reportId) return [];
    const { data, error } = await supabase.from("platform_metrics").select("*").eq("report_id", reportId);
    if (error) throw error;
    return data || [];
  }

  async function fetchReportBundle(report) {
    const prevDate = previousMonthDate(report.report_month);
    const priorPrevDate = previousMonthDate(prevDate);
    const previewMode = new URLSearchParams(window.location.search).has("preview");

    const previousReport = await fetchReportByMonth(prevDate, previewMode);
    const priorPreviousReport = await fetchReportByMonth(priorPrevDate, previewMode);

    const [metricsRes, cadenceRes, mixRes, languageRes, postsRes, insightsRes, previousMetrics, priorPreviousMetrics] = await Promise.all([
      supabase.from("platform_metrics").select("*").eq("report_id", report.id),
      supabase.from("weekly_cadence").select("*").eq("report_id", report.id).order("week_number"),
      supabase.from("content_mix").select("*").eq("report_id", report.id),
      supabase.from("language_mix").select("*").eq("report_id", report.id),
      supabase.from("featured_posts").select("*").eq("report_id", report.id),
      supabase.from("insights").select("*").eq("report_id", report.id),
      fetchMetrics(previousReport?.id),
      fetchMetrics(priorPreviousReport?.id)
    ]);

    for (const res of [metricsRes, cadenceRes, mixRes, languageRes, postsRes, insightsRes]) {
      if (res.error) throw res.error;
    }

    let trendQuery = supabase
      .from("reports")
      .select("id,report_month,status")
      .lte("report_month", report.report_month)
      .order("report_month", { ascending: false })
      .limit(14);
    if (!previewMode) trendQuery = trendQuery.eq("status", "published").eq("is_hidden", false);
    const { data: trendReports, error: trendReportsError } = await trendQuery;
    if (trendReportsError) throw trendReportsError;

    const orderedTrendReports = (trendReports || []).slice().reverse();
    let trendMetrics = [];
    if (orderedTrendReports.length) {
      const { data, error } = await supabase
        .from("platform_metrics")
        .select("*")
        .in("report_id", orderedTrendReports.map(r => r.id));
      if (error) throw error;
      trendMetrics = data || [];
    }

    return {
      report,
      previousReport,
      priorPreviousReport,
      metrics: metricsRes.data || [],
      previousMetrics,
      priorPreviousMetrics,
      cadence: cadenceRes.data || [],
      contentMix: mixRes.data || [],
      languageMix: languageRes.data || [],
      featuredPosts: postsRes.data || [],
      insights: insightsRes.data || [],
      trendReports: orderedTrendReports,
      trendMetrics
    };
  }

  function buildPlatformView(platform, bundle) {
    const currentMap = toMap(bundle.metrics);
    const prevMap = toMap(bundle.previousMetrics);
    const priorPrevMap = toMap(bundle.priorPreviousMetrics);
    const row = currentMap[platform] || { platform };
    const prev = prevMap[platform] || {};
    const priorPrev = priorPrevMap[platform] || {};
    const currentNew = row.followers !== null && row.followers !== undefined && prev.followers !== null && prev.followers !== undefined
      ? Number(row.followers) - Number(prev.followers)
      : null;
    const previousNew = prev.followers !== null && prev.followers !== undefined && priorPrev.followers !== null && priorPrev.followers !== undefined
      ? Number(prev.followers) - Number(priorPrev.followers)
      : null;
    const insight = bundle.insights.find(i => i.platform === platform) || {};

    return {
      name: platform === "linkedin" ? "LinkedIn" : platform === "instagram" ? "Instagram" : "X",
      posts: row.posts,
      followers: row.followers,
      newFollowers: currentNew,
      impressions: row.impressions,
      reach: row.reach,
      engagements: row.engagements,
      engagementRate: row.engagement_rate,
      cadenceLabels: ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5"],
      cadence: normalizeCadence(bundle.cadence, platform),
      contentMix: normalizeContentMix(bundle.contentMix, platform),
      language: normalizeLanguage(bundle.languageMix, platform),
      topPost: normalizePost(bundle.featuredPosts, platform, "top"),
      lowPost: normalizePost(bundle.featuredPosts, platform, "needs_attention"),
      action: insight.recommended_action || "No recommended action has been entered.",
      observation: insight.observation || "",
      actionTimeline: insight.timeline || "—",
      comparison: {
        posts: comparisonObject(row.posts, prev.posts),
        followers: comparisonObject(row.followers, prev.followers),
        newFollowers: comparisonObject(currentNew, previousNew),
        impressions: comparisonObject(row.impressions, prev.impressions),
        reach: comparisonObject(row.reach, prev.reach, row.reach !== null && prev.reach === null ? "Previous reach unavailable" : ""),
        engagements: comparisonObject(row.engagements, prev.engagements),
        engagementRate: comparisonObject(row.engagement_rate, prev.engagement_rate, "Source-reported rate")
      }
    };
  }

  function buildTrend(bundle) {
    const byReport = {};
    bundle.trendMetrics.forEach(row => {
      byReport[row.report_id] ||= {};
      byReport[row.report_id][row.platform] = row;
    });

    const periods = bundle.trendReports.map(report => ({
      id: report.id,
      reportMonth: report.report_month,
      label: shortMonth(report.report_month),
      labelWithYear: shortMonthYear(report.report_month),
      platforms: byReport[report.id] || {}
    }));

    const make = platform => ({
      posts: periods.map(period => period.platforms[platform]?.posts ?? null),
      followers: periods.map(period => period.platforms[platform]?.followers ?? null),
      impressions: periods.map(period => period.platforms[platform]?.impressions ?? null),
      engagements: periods.map(period => period.platforms[platform]?.engagements ?? null)
    });

    return {
      periods,
      labels: periods.map(period => period.label),
      label: periods.length ? `${periods[0].label}–${periods[periods.length - 1].label} trend` : "Trend",
      linkedin: make("linkedin"),
      instagram: make("instagram"),
      x: make("x")
    };
  }

  function getTrendPeriods(trend, range = state.trendRange) {
    const periods = trend?.periods || [];
    if (!periods.length) return [];

    if (range === "ytd") {
      const latestYear = String(periods[periods.length - 1].reportMonth).slice(0, 4);
      return periods.filter(period => String(period.reportMonth).startsWith(`${latestYear}-`));
    }

    const count = range === "12" ? 12 : range === "6" ? 6 : 5;
    return periods.slice(-count);
  }

  function trendPeriodLabel(trend, range = state.trendRange) {
    const visible = getTrendPeriods(trend, range);
    if (!visible.length) return "No historical data";
    const first = visible[0];
    const last = visible[visible.length - 1];
    if (first.reportMonth === last.reportMonth) return monthLabel(first.reportMonth);
    return `${first.labelWithYear}–${last.labelWithYear}`;
  }

  function historicalTrendTableMarkup(trend, range = state.trendRange) {
    const visible = getTrendPeriods(trend, range);
    if (!visible.length) return '<div class="empty-inline">No historical data is available for this period.</div>';

    const allByMonth = Object.fromEntries((trend.periods || []).map(period => [period.reportMonth, period]));
    const metricRows = [
      ["posts", "Posts"],
      ["followers", "Followers"],
      ["impressions", "Impressions"],
      ["engagements", "Engagements"]
    ];
    const platformNames = { linkedin: "LinkedIn", instagram: "Instagram", x: "X" };

    const head = visible.map(period => `<th scope="col"><span class="trend-month-label">${period.label}</span><span class="trend-year-label">${String(period.reportMonth).slice(0, 4)}</span></th>`).join("");
    const body = platforms.map(platform => {
      const platformHeader = `<tr class="historical-platform-row"><th colspan="${visible.length + 1}">${platformBrandIcon(platform)}<span>${platformNames[platform]}</span></th></tr>`;
      const rows = metricRows.map(([metric, label]) => {
        const cells = visible.map(period => {
          const current = period.platforms[platform]?.[metric] ?? null;
          const previousPeriod = allByMonth[previousMonthDate(period.reportMonth)];
          const previous = previousPeriod?.platforms?.[platform]?.[metric] ?? null;
          const change = delta(current, previous);
          const deltaText = change === null ? "—" : signedPercent(change);
          const deltaState = change === null ? "neutral" : deltaClass(change);
          const icon = change === null ? "bi-dash" : deltaIcon(change);
          return `<td><div class="trend-cell-value">${number(current)}</div><span class="trend-delta ${deltaState}"><i class="bi ${icon}" aria-hidden="true"></i>${deltaText}</span></td>`;
        }).join("");
        return `<tr><th scope="row" class="historical-metric-label">${label}</th>${cells}</tr>`;
      }).join("");
      return platformHeader + rows;
    }).join("");

    return `
      <div class="historical-trend-scroll">
        <table class="historical-trend-table">
          <thead><tr><th scope="col" class="historical-metric-head">Platform / Metric</th>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div class="panel-footnote">Each percentage compares that month with the immediately preceding calendar month. If the previous month is not available in Supabase, the comparison is shown as —.</div>`;
  }

  function buildModel(bundle) {
    const currentMap = toMap(bundle.metrics);
    const prevMap = toMap(bundle.previousMetrics);
    const priorPrevMap = toMap(bundle.priorPreviousMetrics);
    const overview = buildOverview(currentMap, prevMap, priorPrevMap);
    const current = overview.current;
    const previous = overview.previous;

    return {
      label: monthLabel(bundle.report.report_month),
      previousLabel: bundle.previousReport ? monthLabel(bundle.previousReport.report_month) : "previous month",
      source: bundle.report.source || "Meltwater",
      overview: current,
      comparison: {
        overview: {
          posts: comparisonObject(current.posts, previous.posts),
          followers: comparisonObject(current.followers, previous.followers),
          newFollowers: comparisonObject(current.newFollowers, previous.newFollowers),
          impressions: comparisonObject(current.impressions, previous.impressions),
          reach: comparableReachComparison(currentMap, prevMap),
          engagements: comparisonObject(current.engagements, previous.engagements)
        }
      },
      platforms: {
        linkedin: buildPlatformView("linkedin", bundle),
        instagram: buildPlatformView("instagram", bundle),
        x: buildPlatformView("x", bundle)
      },
      trend: buildTrend(bundle),
      insights: bundle.insights
    };
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
      <div class="panel-footnote">Month-on-month values are calculated automatically from the selected and previous monthly records.</div>`;
  }

  function platformMini(key, p) {
    return `
      <button class="platform-mini" type="button" data-open-platform="${key}" aria-label="Open ${p.name} details">
        <div class="platform-mini-top">
          <div class="platform-mini-title">${platformIcon(key)}<span>${p.name}</span></div>
          <span class="mini-delta ${deltaClass(p.comparison.impressions.delta)}"><i class="bi ${deltaIcon(p.comparison.impressions.delta)}" aria-hidden="true"></i>${signedPercent(p.comparison.impressions.delta)} impressions</span>
        </div>
        <div class="platform-mini-metrics">
          <div><div class="big">${number(p.followers)}</div><div class="small-label">Followers</div></div>
          <div><div class="big">${percent(p.engagementRate)}</div><div class="small-label">Engagement rate</div></div>
        </div>
      </button>`;
  }

  function overviewMarkup(month) {
    const o = month.overview;
    const c = month.comparison.overview;
    const p = month.platforms;
    const previousShort = month.previousLabel.replace(/\s+\d{4}$/, "");

    const split = (metric, signed = false) => [
      { key: "linkedin", label: "LinkedIn", value: p.linkedin?.[metric], signed, unavailable: p.linkedin?.[metric] === null || p.linkedin?.[metric] === undefined },
      { key: "instagram", label: "Instagram", value: p.instagram?.[metric], signed, unavailable: p.instagram?.[metric] === null || p.instagram?.[metric] === undefined },
      { key: "x", label: "X", value: p.x?.[metric], signed, unavailable: p.x?.[metric] === null || p.x?.[metric] === undefined }
    ];

    return `
      <div class="section-intro executive-overview-heading">
        <div>
          <div class="section-kicker">Performance overview</div>
          <h2 class="section-title executive-title">At a glance</h2>
          <div class="overview-lead">Organic social performance across LinkedIn, Instagram and X</div>
        </div>
        <div class="comparison-badge executive-comparison"><span class="comparison-dot"></span>${month.label} vs ${month.previousLabel}</div>
      </div>

      <div class="metric-grid overview-metrics executive-metrics">
        ${metricCard({ value: o.posts, label: "Posts published", comparison: c.posts, comparisonLabel: previousShort, icon: "bi-file-earmark-text", breakdown: split("posts") })}
        ${metricCard({ value: o.followers, label: "Followers", comparison: c.followers, comparisonLabel: previousShort, icon: "bi-people", breakdown: split("followers") })}
        ${metricCard({ value: o.newFollowers, label: "Net new followers", comparison: c.newFollowers, comparisonLabel: previousShort, valuePrefix: o.newFollowers !== null && o.newFollowers >= 0 ? "+" : "", icon: "bi-person-plus", breakdown: split("newFollowers", true) })}
        ${metricCard({ value: o.impressions, label: "Impressions", comparison: c.impressions, comparisonLabel: previousShort, icon: "bi-eye", breakdown: split("impressions") })}
        ${metricCard({ value: o.reach, label: "Reach", comparison: c.reach, comparisonLabel: previousShort, icon: "bi-broadcast", breakdown: split("reach") })}
        ${metricCard({ value: o.engagements, label: "Engagements", comparison: c.engagements, comparisonLabel: previousShort, icon: "bi-hand-thumbs-up", breakdown: split("engagements") })}
      </div>

      <div class="overview-method-note"><i class="bi bi-info-circle" aria-hidden="true"></i><span><strong>Reach methodology:</strong> Reach combines LinkedIn Members Reached and Instagram Accounts Reached. Meltwater does not report reach for X. Month-on-month reach comparisons use only platforms with comparable reach data available in both periods.</span></div>

      <div class="performance-grid">
        <section class="panel performance-chart-panel">
          <div class="panel-header performance-panel-header">
            <div>
              <h3 class="panel-title">Performance chart</h3>
              <div class="panel-subtitle" id="chartPeriodLabel">${trendPeriodLabel(month.trend, state.chartRange)}</div>
            </div>
            <div class="performance-controls">
              <select class="metric-switch" id="chartRange" aria-label="Select chart period">
                <option value="5" ${state.chartRange === "5" ? "selected" : ""}>Last 5 months</option>
                <option value="6" ${state.chartRange === "6" ? "selected" : ""}>Last 6 months</option>
                <option value="ytd" ${state.chartRange === "ytd" ? "selected" : ""}>Year to date</option>
                <option value="12" ${state.chartRange === "12" ? "selected" : ""}>Last 12 months</option>
              </select>
              <select class="metric-switch" id="overviewMetric" aria-label="Select chart metric">
                <option value="impressions" ${state.trendMetric === "impressions" ? "selected" : ""}>Impressions</option>
                <option value="engagements" ${state.trendMetric === "engagements" ? "selected" : ""}>Engagements</option>
                <option value="followers" ${state.trendMetric === "followers" ? "selected" : ""}>Followers</option>
                <option value="posts" ${state.trendMetric === "posts" ? "selected" : ""}>Posts</option>
              </select>
            </div>
          </div>
          <div class="chart-wrap executive-chart"><canvas id="overviewTrendChart" aria-label="Platform performance chart"></canvas></div>
        </section>

        <section class="panel monthly-trend-panel">
          <div class="panel-header performance-panel-header">
            <div>
              <h3 class="panel-title">Monthly trend</h3>
              <div class="panel-subtitle" id="trendPeriodLabel">${trendPeriodLabel(month.trend, state.trendRange)}</div>
            </div>
            <select class="metric-switch trend-range-switch" id="trendRange" aria-label="Select monthly trend period">
              <option value="5" ${state.trendRange === "5" ? "selected" : ""}>Last 5 months</option>
              <option value="6" ${state.trendRange === "6" ? "selected" : ""}>Last 6 months</option>
              <option value="ytd" ${state.trendRange === "ytd" ? "selected" : ""}>Year to date</option>
              <option value="12" ${state.trendRange === "12" ? "selected" : ""}>Last 12 months</option>
            </select>
          </div>
          <div id="historicalTrendTable">${historicalTrendTableMarkup(month.trend, state.trendRange)}</div>
        </section>
      </div>

      <div class="panel-grid overview-lower-grid">
        <section class="panel">
          <div class="panel-header"><div><h3 class="panel-title">Month-on-month performance</h3><div class="panel-subtitle">${month.previousLabel} to ${month.label}</div></div></div>
          ${momTableMarkup(month)}
        </section>
        <section class="panel channel-panel">
          <div class="panel-header"><div><h3 class="panel-title">Channel performance</h3><div class="panel-subtitle">Select a channel to view details</div></div></div>
          <div class="platform-strip">
            ${platformMini("linkedin", month.platforms.linkedin)}
            ${platformMini("instagram", month.platforms.instagram)}
            ${platformMini("x", month.platforms.x)}
          </div>
        </section>
      </div>`;
  }

  function postCard(label, post, platformName) {
    const thumbnail = `<img class="post-thumb" src="${post.image}" alt="${platformName} ${label.toLowerCase()} post thumbnail">`;
    const thumbnailMarkup = post.postUrl
      ? `<a class="post-thumb-link" href="${post.postUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open ${platformName} ${label.toLowerCase()} post">${thumbnail}<span class="post-thumb-open" aria-hidden="true"><i class="bi bi-box-arrow-up-right"></i></span></a>`
      : thumbnail;

    return `
      <article class="post-card">
        ${thumbnailMarkup}
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

  function platformMarkup(key, p, month) {
    const c = p.comparison;
    const mixRows = p.contentMix.length
      ? p.contentMix.map(item => `<div class="format-row"><div class="format-label">${item.label}</div><div class="format-track"><div class="format-fill" style="width:${Math.max(0, Math.min(100, item.pct))}%"></div></div><div class="format-pct">${item.pct}%</div></div>`).join("")
      : '<div class="empty-inline">No content mix entered.</div>';

    return `
      <div class="section-intro platform-heading">
        <div>
          <div class="section-kicker">Platform performance</div>
          <h2 class="section-title section-title-with-icon">${platformIcon(key)}<span>${p.name}</span></h2>
        </div>
        <div class="comparison-badge"><span class="comparison-dot"></span>${month.label} vs ${month.previousLabel}</div>
      </div>

      <div class="metric-grid platform-metrics ${key === "x" ? "platform-metrics-five" : ""}">
        ${metricCard({ value: p.posts, label: "Posts published", comparison: c.posts, icon: "bi-file-earmark-text" })}
        ${metricCard({ value: p.followers, label: "Followers", comparison: c.followers, icon: "bi-people" })}
        ${metricCard({ value: p.newFollowers, label: "Net new followers", comparison: c.newFollowers, valuePrefix: p.newFollowers !== null && p.newFollowers >= 0 ? "+" : "", icon: "bi-person-plus" })}
        ${metricCard({ value: p.impressions, label: "Impressions", comparison: c.impressions, icon: "bi-eye" })}
        ${key !== "x" ? metricCard({ value: p.reach, label: "Reach", comparison: c.reach, icon: "bi-broadcast" }) : ""}
        ${metricCard({ value: p.engagements, label: "Engagements", comparison: c.engagements, icon: "bi-hand-thumbs-up" })}
      </div>

      ${key === "x" ? `<div class="platform-method-note"><i class="bi bi-info-circle" aria-hidden="true"></i><span>Meltwater does not report unique reach for X.</span></div>` : ""}

      <div class="platform-rate-line">
        <span class="rate-label">Engagement rate</span>
        <strong>${percent(p.engagementRate)}</strong>
        <span class="rate-note">Source-reported rate</span>
      </div>

      <div class="panel-grid equal platform-panels">
        <section class="panel">
          <div class="panel-header"><div><h3 class="panel-title">Posting cadence</h3><div class="panel-subtitle">Posts published by week</div></div></div>
          <div class="chart-wrap compact"><canvas id="${key}CadenceChart" aria-label="${p.name} weekly posting cadence"></canvas></div>
        </section>
        <section class="panel">
          <div class="panel-header"><div><h3 class="panel-title">Content mix</h3><div class="panel-subtitle">Format share of channel</div></div></div>
          <div class="format-list">${mixRows}</div>
          <div class="language-pill"><strong>Language mix</strong> · ${p.language}</div>
        </section>
      </div>

      <div class="post-grid">
        ${postCard("Top performing", p.topPost, p.name)}
        ${postCard("Needs attention", p.lowPost, p.name)}
      </div>

      <div class="action-strip">
        <div class="action-dot" aria-hidden="true"></div>
        <div class="action-copy"><strong>Recommended action:</strong> ${p.action}</div>
        <div class="action-timeline">${p.actionTimeline}</div>
      </div>`;
  }

  function insightsMarkup(month) {
    const preferredOrder = ["all", "linkedin", "instagram", "x"];
    const orderOf = (value) => {
      const i = preferredOrder.indexOf(normalizePlatformKey(value));
      return i === -1 ? preferredOrder.length : i;
    };
    const insights = month.insights.slice().sort((a, b) => orderOf(a.platform) - orderOf(b.platform));
    return `
      <div class="section-intro">
        <div><div class="section-kicker">Management view</div><h2 class="section-title">Insights & recommended actions</h2></div>
        <div class="comparison-badge"><span class="comparison-dot"></span>${month.label}</div>
      </div>
      <div class="insights-grid">
        ${insights.length ? insights.map(i => `
          <article class="insight-card">
            <div class="insight-top"><div class="insight-platform">${insightPlatformIdentity(i.platform)}</div><div class="insight-timeline">${i.timeline || "—"}</div></div>
            <div class="insight-area">${i.observation || "No observation entered."}</div>
            <div class="insight-action">${i.recommended_action || "No recommended action entered."}</div>
          </article>`).join("") : '<div class="empty-state">No insights have been published for this month.</div>'}
      </div>`;
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
        x: { grid: { display: false }, border: { display: false }, ticks: { color: "#777777", font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: "#eeeeee" }, border: { display: false }, ticks: { color: "#777777", font: { size: 11 }, maxTicksLimit: 5 } }
      }
    };
  }

  function destroyChart(name) {
    if (state.charts[name]) {
      state.charts[name].destroy();
      delete state.charts[name];
    }
  }

  function buildOverviewTrend(month, metric = state.trendMetric) {
    destroyChart("overview");
    const canvas = $("#overviewTrendChart");
    if (!canvas || !window.Chart) return;

    state.trendMetric = metric;
    const visible = getTrendPeriods(month.trend, state.chartRange);
    const labels = visible.map(period => period.label);
    const seriesFor = platform => visible.map(period => period.platforms[platform]?.[metric] ?? null);

    state.charts.overview = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "LinkedIn", data: seriesFor("linkedin"), borderColor: "#0A66C2", backgroundColor: "#0A66C2", borderWidth: 2, pointRadius: 2.5, pointHoverRadius: 5, tension: 0.32, spanGaps: true },
          { label: "Instagram", data: seriesFor("instagram"), borderColor: "#E1306C", backgroundColor: "#E1306C", borderWidth: 2, pointRadius: 2.5, pointHoverRadius: 5, tension: 0.32, spanGaps: true },
          { label: "X", data: seriesFor("x"), borderColor: "#111111", backgroundColor: "#111111", borderWidth: 2, pointRadius: 2.5, pointHoverRadius: 5, tension: 0.32, spanGaps: true }
        ]
      },
      options: {
        ...chartBaseOptions(),
        plugins: {
          ...chartBaseOptions().plugins,
          legend: { display: true, position: "bottom", align: "start", labels: { usePointStyle: true, boxWidth: 6, boxHeight: 6, color: "#555555", padding: 14, font: { size: 11 } } }
        }
      }
    });
  }

  function updateTrendTable(month) {
    const label = $("#trendPeriodLabel");
    const table = $("#historicalTrendTable");
    if (label) label.textContent = trendPeriodLabel(month.trend, state.trendRange);
    if (table) table.innerHTML = historicalTrendTableMarkup(month.trend, state.trendRange);
  }

  function updateChartPeriod(month) {
    const label = $("#chartPeriodLabel");
    if (label) label.textContent = trendPeriodLabel(month.trend, state.chartRange);
    buildOverviewTrend(month, state.trendMetric);
  }

  function buildCadence(key, p) {
    destroyChart(`${key}Cadence`);
    const canvas = $(`#${key}CadenceChart`);
    if (!canvas || !window.Chart) return;
    state.charts[`${key}Cadence`] = new Chart(canvas, {
      type: "bar",
      data: { labels: p.cadenceLabels, datasets: [{ data: p.cadence, backgroundColor: "#222222", borderRadius: 5, maxBarThickness: 44 }] },
      options: chartBaseOptions()
    });
  }

  function wireDynamicControls(month) {
    const metric = $("#overviewMetric");
    if (metric) metric.addEventListener("change", e => {
      state.trendMetric = e.target.value;
      buildOverviewTrend(month, state.trendMetric);
    });

    const chartRange = $("#chartRange");
    if (chartRange) chartRange.addEventListener("change", e => {
      state.chartRange = e.target.value;
      updateChartPeriod(month);
    });

    const trendRange = $("#trendRange");
    if (trendRange) trendRange.addEventListener("change", e => {
      state.trendRange = e.target.value;
      updateTrendTable(month);
    });

    $$('[data-open-platform]').forEach(btn => btn.addEventListener("click", () => {
      const tabButton = $(`#tab-${btn.dataset.openPlatform}`);
      if (tabButton) bootstrap.Tab.getOrCreateInstance(tabButton).show();
    }));

    $$('[data-metric-breakdown-toggle]').forEach(btn => btn.addEventListener("click", () => {
      const card = btn.closest(".executive-metric-card");
      const panelId = btn.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      if (!card || !panel) return;

      const isOpen = card.classList.toggle("is-breakdown-open");
      btn.setAttribute("aria-expanded", String(isOpen));
      btn.setAttribute("aria-label", `${isOpen ? "Hide" : "Show"} channel breakdown`);
      btn.setAttribute("title", `${isOpen ? "Hide" : "Show"} channel breakdown`);
      panel.setAttribute("aria-hidden", String(!isOpen));
    }));
  }

  function render(month) {
    $("#monthMeta").textContent = month.label;
    $("#comparisonMeta").textContent = `vs ${month.previousLabel}`;
    $("#sourceMeta").textContent = `Source: ${month.source}`;
    $("#overviewContent").innerHTML = overviewMarkup(month);
    $("#linkedinContent").innerHTML = platformMarkup("linkedin", month.platforms.linkedin, month);
    $("#instagramContent").innerHTML = platformMarkup("instagram", month.platforms.instagram, month);
    $("#xContent").innerHTML = platformMarkup("x", month.platforms.x, month);
    $("#insightsContent").innerHTML = insightsMarkup(month);
    buildOverviewTrend(month, state.trendMetric);
    buildCadence("linkedin", month.platforms.linkedin);
    buildCadence("instagram", month.platforms.instagram);
    buildCadence("x", month.platforms.x);
    wireDynamicControls(month);
    $("#downloadPdfBtn").disabled = false;
  }

  async function loadReport(reportId) {
    hideMessage();
    $("#downloadPdfBtn").disabled = true;
    const report = state.reports.find(r => r.id === reportId) || state.previewReport;
    if (!report) return;
    state.activeReportId = report.id;
    const bundle = await fetchReportBundle(report);
    state.bundle = bundle;
    const model = buildModel(bundle);
    render(model);
  }

  async function initReportList() {
    const params = new URLSearchParams(window.location.search);
    const previewId = params.get("preview");

    if (previewId) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Sign in through the Admin CMS before opening a draft preview.");
      const { data: previewReport, error } = await supabase.from("reports").select("*").eq("id", previewId).maybeSingle();
      if (error) throw error;
      if (!previewReport) throw new Error("Preview report not found or you do not have access.");
      state.previewReport = previewReport;
      state.reports = [previewReport];
      $("#monthSelect").innerHTML = `<option value="${previewReport.id}">${monthLabel(previewReport.report_month)} · Preview</option>`;
      $("#monthSelect").disabled = true;
      showMessage("Draft preview — this report is not visible to public users until it is published.", "preview");
      return previewReport.id;
    }

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "published")
      .eq("is_hidden", false)
      .order("report_month", { ascending: false });
    if (error) throw error;
    state.reports = data || [];
    if (!state.reports.length) throw new Error("No published reports are available yet.");

    const select = $("#monthSelect");
    select.innerHTML = "";
    state.reports.forEach(report => {
      const option = document.createElement("option");
      option.value = report.id;
      option.textContent = monthLabel(report.report_month);
      select.appendChild(option);
    });
    select.disabled = false;
    select.addEventListener("change", async e => {
      try {
        await loadReport(e.target.value);
      } catch (err) {
        console.error(err);
        showMessage(err.message || "Unable to load report.", "error");
      }
    });
    return state.reports[0].id;
  }

  async function downloadCurrentTabPdf() {
    const button = $("#downloadPdfBtn");
    const activePane = $(".tab-pane.active");
    if (!activePane || !window.html2pdf || !state.bundle) {
      window.print();
      return;
    }
    const model = buildModel(state.bundle);
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
    header.innerHTML = `<div><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#3fae2a;font-weight:700">Monthly reporting</div><div style="font-size:28px;font-weight:700">Social Media Performance</div><div style="font-size:12px;color:#777">${model.label} vs ${model.previousLabel} · ${$(".nav-link.active").textContent.trim()}</div></div><img src="assets/images/gwc-logo-placeholder.svg" style="width:100px;height:auto" alt="GWC">`;
    exportWrap.appendChild(header);
    const clone = activePane.cloneNode(true);
    clone.classList.add("show", "active");
    clone.style.display = "block";
    exportWrap.appendChild(clone);
    document.body.appendChild(exportWrap);

    const filename = `GWC-Social-Media-${model.label.replace(/\s+/g, "-")}-${$(".nav-link.active").textContent.trim()}.pdf`;
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

  async function init() {
    if (!api?.ready || !supabase) {
      showMessage("Supabase is not configured. Open assets/js/config.js and add your Project URL and Publishable key.", "error");
      $("#overviewContent").innerHTML = '<div class="empty-state">Complete the Supabase setup steps in docs/SUPABASE_SETUP.md, then reload this page.</div>';
      return;
    }

    try {
      const initialReportId = await initReportList();
      await loadReport(initialReportId);
      $("#downloadPdfBtn").addEventListener("click", downloadCurrentTabPdf);
    } catch (err) {
      console.error(err);
      showMessage(err.message || "Unable to load dashboard data.", "error");
      $("#overviewContent").innerHTML = '<div class="empty-state">The dashboard could not load. Check the Supabase configuration, RLS policies and published report data.</div>';
    }
  }

  init();
})();
