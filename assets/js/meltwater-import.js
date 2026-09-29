(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client;
  const XLSXLib = window.XLSX;

  const platformConfig = {
    linkedin: {
      label: "LinkedIn",
      fileId: "#importLinkedinFile",
      nameId: "#importLinkedinName",
      sourceAliases: ["linkedin"],
      cadenceAliases: ["linkedin"],
      formats: {
        IMAGE: "Image",
        NATIVE_IMAGE: "Image",
        DOCUMENT: "Document",
        NATIVE_DOCUMENT: "Document",
        MULTI_IMAGE: "Multi-image",
        MULTIIMAGE: "Multi-image",
        VIDEO: "Video",
        NATIVE_VIDEO: "Video"
      }
    },
    instagram: {
      label: "Instagram",
      fileId: "#importInstagramFile",
      nameId: "#importInstagramName",
      sourceAliases: ["instagram"],
      cadenceAliases: ["instagram"],
      formats: {
        CAROUSEL_ALBUM: "Carousel",
        CAROUSEL: "Carousel",
        IMAGE: "Image",
        PHOTO: "Image",
        STORY: "Story",
        REEL: "Reels",
        REELS: "Reels",
        VIDEO: "Reels"
      }
    },
    x: {
      label: "X",
      fileId: "#importXFile",
      nameId: "#importXName",
      sourceAliases: ["twitter", "x"],
      cadenceAliases: ["twitter", "x"],
      formats: {
        PHOTO: "Photo",
        IMAGE: "Photo",
        VIDEO: "Video",
        TEXT: "Text only",
        TEXT_ONLY: "Text only",
        STATUS: "Text only"
      }
    }
  };

  const state = {
    admin: null,
    analyses: null,
    selectedMonth: null,
    busy: false
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function showImportAlert(message, type = "danger") {
    const box = $("#meltwaterImportAlert");
    if (!box) return;
    box.className = `alert alert-${type} mt-3`;
    box.textContent = message;
  }

  function hideImportAlert() {
    const box = $("#meltwaterImportAlert");
    if (!box) return;
    box.className = "alert d-none mt-3";
    box.textContent = "";
  }

  function normaliseText(value) {
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function intOrNull(value) {
    const n = numberOrNull(value);
    return n === null ? null : Math.round(n);
  }

  function monthFromDateLike(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    const text = String(value ?? "").trim();
    const iso = text.match(/^(\d{4})-(\d{2})-/);
    if (iso) return `${iso[1]}-${iso[2]}`;
    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    return null;
  }

  function dateOnly(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
    }
    const text = String(value ?? "").trim();
    const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
    return null;
  }

  function dayOfMonth(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getUTCDate();
    const text = String(value ?? "");
    const iso = text.match(/^\d{4}-\d{2}-(\d{2})/);
    if (iso) return Number(iso[1]);
    const short = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\b/i);
    if (short) return Number(short[1]);
    const numeric = text.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
    return numeric ? Number(numeric[1]) : null;
  }

  function weekOfMonth(day) {
    if (!day || day < 1) return null;
    return Math.min(5, Math.floor((day - 1) / 7) + 1);
  }

  function findSheet(workbook, wanted) {
    const target = normaliseText(wanted);
    const name = workbook.SheetNames.find(n => normaliseText(n) === target);
    return name ? workbook.Sheets[name] : null;
  }

  function sheetMatrix(workbook, name) {
    const sheet = findSheet(workbook, name);
    return sheet ? XLSXLib.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) : [];
  }

  function objectRows(workbook, name) {
    const rows = sheetMatrix(workbook, name);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => normaliseText(h));
    return rows.slice(1)
      .filter(row => row.some(v => v !== null && v !== ""))
      .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? null])));
  }

  function metricValue(workbook, sheetName) {
    const rows = sheetMatrix(workbook, sheetName);
    if (!rows.length) return null;
    const headerIndex = rows.findIndex(row => row.some(cell => normaliseText(cell) === "value"));
    if (headerIndex >= 0 && rows[headerIndex + 1]) {
      const valueCol = rows[headerIndex].findIndex(cell => normaliseText(cell) === "value");
      return numberOrNull(rows[headerIndex + 1][valueCol]);
    }
    for (const row of rows) {
      for (let i = 0; i < row.length; i += 1) {
        if (normaliseText(row[i]) === "value") {
          const direct = numberOrNull(row[i + 1]);
          if (direct !== null) return direct;
        }
      }
    }
    return null;
  }

  function scanMatrixForValue(matrix, aliases) {
    const wanted = aliases.map(normaliseText);
    for (let r = 0; r < matrix.length; r += 1) {
      const row = matrix[r] || [];
      for (let c = 0; c < row.length; c += 1) {
        const cell = normaliseText(row[c]);
        if (!wanted.includes(cell)) continue;
        const candidates = [row[c + 1], matrix[r + 1]?.[c], matrix[r + 1]?.[c + 1]];
        for (const candidate of candidates) {
          const n = numberOrNull(candidate);
          if (n !== null) return n;
        }
      }
    }
    return null;
  }

  function fallbackMetricValue(workbook, aliases) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) return null;
    const matrix = XLSXLib.utils.sheet_to_json(firstSheet, { header: 1, defval: null, raw: true });
    return scanMatrixForValue(matrix, aliases);
  }

  function overviewInfo(workbook) {
    const rows = sheetMatrix(workbook, "Report overview");
    let fromDate = null;
    let detectedPlatform = null;
    for (const row of rows) {
      const first = normaliseText(row[0]);
      if (first === "from date") fromDate = row[1];
      if (["linkedin", "instagram", "twitter", "x"].includes(first)) detectedPlatform = first;
    }
    return {
      month: monthFromDateLike(fromDate),
      sourcePlatform: detectedPlatform
    };
  }

  function postRowsFromWorkbook(workbook) {
    const top = objectRows(workbook, "Top posts");
    if (top.length) return top;

    // Fallback for a CSV that is itself a post-level export.
    const first = workbook.Sheets[workbook.SheetNames[0]];
    if (!first) return [];
    const matrix = XLSXLib.utils.sheet_to_json(first, { header: 1, defval: null, raw: true });
    const headerRow = matrix.findIndex(row => {
      const h = row.map(normaliseText);
      return h.includes("source") && h.includes("post type") && h.includes("impressions");
    });
    if (headerRow < 0) return [];
    const headers = matrix[headerRow].map(normaliseText);
    return matrix.slice(headerRow + 1)
      .filter(row => row.some(v => v !== null && v !== ""))
      .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? null])));
  }

  function metricBreakdown(workbook) {
    const rows = objectRows(workbook, "Post Metrics Breakdown");
    return rows.find(row => normaliseText(row["date range"]) === "reporting period") || {};
  }

  function leaderboard(workbook) {
    return objectRows(workbook, "Social Account Leaderboard")[0] || {};
  }

  function firstAvailable(...values) {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== "") return value;
    }
    return null;
  }

  function deriveMetrics(workbook, platform, warnings) {
    const breakdown = metricBreakdown(workbook);
    const board = leaderboard(workbook);

    const posts = intOrNull(firstAvailable(
      metricValue(workbook, "Total Posts"),
      numberOrNull(board.posts),
      fallbackMetricValue(workbook, ["Total Posts", "Posts"])
    ));
    const followers = intOrNull(firstAvailable(
      metricValue(workbook, "Total Fans"),
      fallbackMetricValue(workbook, ["Total Fans", "Followers", "Fans"])
    ));
    const impressions = intOrNull(firstAvailable(
      metricValue(workbook, "Post Impressions"),
      numberOrNull(breakdown.impressions),
      numberOrNull(board.impressions),
      fallbackMetricValue(workbook, ["Post Impressions", "Impressions"])
    ));
    const engagements = intOrNull(firstAvailable(
      metricValue(workbook, "Post Engagements"),
      numberOrNull(breakdown.engagements),
      numberOrNull(board.engagement),
      fallbackMetricValue(workbook, ["Post Engagements", "Engagements", "Engagement"])
    ));
    const engagementRate = numberOrNull(firstAvailable(
      metricValue(workbook, "Engagement Rate"),
      numberOrNull(breakdown["engagement rate"]),
      numberOrNull(board["engagement rate"]),
      fallbackMetricValue(workbook, ["Engagement Rate"])
    ));

    let reach = intOrNull(firstAvailable(
      metricValue(workbook, "Post Reach"),
      numberOrNull(breakdown.reach),
      fallbackMetricValue(workbook, ["Post Reach", "Reach"])
    ));

    // Meltwater currently returns zero reach for the supplied LinkedIn/X exports.
    // Treat that as unavailable rather than as an actual measured zero.
    if (platform !== "instagram" && reach === 0) {
      reach = null;
      warnings.push(`${platformConfig[platform].label} reach is not available in this Meltwater export and will remain blank for manual entry if needed.`);
    }

    return {
      posts,
      followers,
      impressions,
      reach,
      engagements,
      engagement_rate: engagementRate
    };
  }

  function cadenceFromDailySheet(workbook, platform) {
    const rows = sheetMatrix(workbook, "Total Posts1");
    if (rows.length < 2) return null;
    const headers = rows[0].map(normaliseText);
    const aliases = platformConfig[platform].cadenceAliases;
    const platformCol = headers.findIndex(h => aliases.includes(h));
    const dateCol = headers.findIndex(h => h === "date");
    if (platformCol < 0 || dateCol < 0) return null;

    const weeks = [0, 0, 0, 0, 0];
    let recognised = 0;
    rows.slice(1).forEach(row => {
      const count = intOrNull(row[platformCol]) || 0;
      const day = dayOfMonth(row[dateCol]);
      const week = weekOfMonth(day);
      if (week) {
        weeks[week - 1] += count;
        recognised += count;
      }
    });
    return { weeks, total: recognised };
  }

  function cadenceFromPosts(posts) {
    const weeks = [0, 0, 0, 0, 0];
    let total = 0;
    posts.forEach(post => {
      const day = dayOfMonth(firstAvailable(post["created time (utc)"], post["formatted created time"]));
      const week = weekOfMonth(day);
      if (week) {
        weeks[week - 1] += 1;
        total += 1;
      }
    });
    return { weeks, total };
  }

  function deriveCadence(workbook, platform, posts, totalPosts, warnings) {
    const daily = cadenceFromDailySheet(workbook, platform);
    let result = daily;
    if (!result || result.total !== totalPosts) result = cadenceFromPosts(posts);
    if (!result || result.total !== totalPosts) {
      warnings.push(`Weekly cadence could not be verified against ${totalPosts ?? "the"} published posts, so cadence will not overwrite existing CMS values.`);
      return null;
    }
    return result.weeks.map((post_count, index) => ({ week_number: index + 1, post_count }));
  }

  function canonicalPostType(value) {
    return String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  }

  function deriveContentMix(platform, posts, totalPosts, warnings) {
    if (!posts.length || totalPosts === null || posts.length !== totalPosts) {
      warnings.push("Content mix cannot be safely derived because the post-level rows do not match Total Posts; existing CMS content mix will be preserved.");
      return null;
    }
    const counts = new Map();
    for (const post of posts) {
      const raw = canonicalPostType(post["post type"]);
      const mapped = platformConfig[platform].formats[raw];
      if (!mapped) {
        warnings.push(`Unrecognised ${platformConfig[platform].label} post type “${post["post type"] ?? "blank"}”; content mix will be preserved for manual review.`);
        return null;
      }
      counts.set(mapped, (counts.get(mapped) || 0) + 1);
    }
    return [...counts.entries()].map(([format, post_count]) => ({ format, post_count }));
  }

  function languageBucket(text) {
    const value = String(text ?? "").replace(/https?:\/\/\S+/gi, " ").trim();
    if (!value) return "Excluded";
    const hasArabic = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(value);
    const hasEnglish = /[A-Za-z]/.test(value);
    if (hasArabic && hasEnglish) return "Bilingual";
    if (hasArabic) return "Arabic Only";
    return "English Only";
  }

  function deriveLanguageMix(posts, totalPosts, warnings) {
    if (!posts.length || totalPosts === null || posts.length !== totalPosts) {
      warnings.push("Language mix cannot be safely derived because the post-level rows do not match Total Posts; existing CMS language mix will be preserved.");
      return null;
    }
    const order = ["English Only", "Bilingual", "Arabic Only", "Excluded"];
    const counts = Object.fromEntries(order.map(label => [label, 0]));
    posts.forEach(post => { counts[languageBucket(post["social text"])] += 1; });
    return order.map(language => ({ language, post_count: counts[language] }));
  }

  function compactTitle(text) {
    const cleaned = String(text ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) return null;
    return cleaned.length > 180 ? `${cleaned.slice(0, 177)}…` : cleaned;
  }

  function featuredRow(post, platform, performanceType) {
    const reachValue = intOrNull(post.reach);
    return {
      platform,
      performance_type: performanceType,
      post_date: dateOnly(firstAvailable(post["created time (utc)"], post["formatted created time"])),
      title: compactTitle(post["social text"]),
      post_url: String(post.permalink ?? "").trim() || null,
      engagement_rate: numberOrNull(post["engagement rate"]),
      impressions: intOrNull(post.impressions),
      reach: platform !== "instagram" && reachValue === 0 ? null : reachValue,
      engagements: intOrNull(post.engagement),
      likes: intOrNull(post.reactions),
      link_clicks: intOrNull(post["post link clicks"])
    };
  }

  function deriveFeatured(platform, posts, totalPosts, warnings) {
    if (!posts.length) {
      warnings.push("No post-level rows were found, so featured posts will remain unchanged.");
      return null;
    }

    let eligible = posts.filter(post => numberOrNull(post["engagement rate"]) !== null);
    if (platform === "instagram") {
      eligible = eligible.filter(post => canonicalPostType(post["post type"]) !== "STORY");
    }

    if (!eligible.length) {
      warnings.push("No posts with engagement-rate data were found for featured-post selection.");
      return null;
    }

    if (totalPosts !== null && posts.length !== totalPosts) {
      warnings.push("Featured-post selection is based on the rows included in the export. Because the post list is not complete, review the Top/Needs Attention choices in the editor.");
    }

    eligible.sort((a, b) => numberOrNull(b["engagement rate"]) - numberOrNull(a["engagement rate"]));
    const top = featuredRow(eligible[0], platform, "top");
    const low = eligible.length > 1 ? featuredRow(eligible[eligible.length - 1], platform, "needs_attention") : null;
    return low ? [top, low] : [top];
  }

  function validatePlatformIdentity(platform, overview, posts, errors, warnings) {
    const aliases = platformConfig[platform].sourceAliases;
    const overviewSource = normaliseText(overview.sourcePlatform);
    if (overviewSource && !aliases.includes(overviewSource)) {
      errors.push(`This file identifies itself as ${overview.sourcePlatform}, not ${platformConfig[platform].label}.`);
      return;
    }

    const postSources = [...new Set(posts.map(post => normaliseText(post.source)).filter(Boolean))];
    if (postSources.length && !postSources.some(source => aliases.includes(source))) {
      errors.push(`Post rows appear to belong to ${postSources.join(", ")}, not ${platformConfig[platform].label}.`);
    } else if (!overviewSource && !postSources.length) {
      warnings.push("Platform identity could not be verified from the file; review the preview before importing.");
    }
  }

  async function workbookFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    return XLSXLib.read(arrayBuffer, { type: "array", cellDates: true, raw: true });
  }

  async function analyseFile(file, platform, selectedMonth) {
    const warnings = [];
    const errors = [];
    const workbook = await workbookFromFile(file);
    const overview = overviewInfo(workbook);
    const posts = postRowsFromWorkbook(workbook);
    const metrics = deriveMetrics(workbook, platform, warnings);

    validatePlatformIdentity(platform, overview, posts, errors, warnings);

    if (overview.month && overview.month !== selectedMonth) {
      errors.push(`File date range is ${overview.month}; selected reporting month is ${selectedMonth}.`);
    } else if (!overview.month) {
      warnings.push("Reporting month was not found in the file, so the selected CMS month will be used.");
    }

    const required = ["posts", "followers", "impressions", "engagements"];
    const missing = required.filter(key => metrics[key] === null);
    if (missing.length) {
      errors.push(`Missing required monthly metrics: ${missing.join(", ")}. Use the full Meltwater report export (the supplied XLSX format works).`);
    }

    const cadence = deriveCadence(workbook, platform, posts, metrics.posts, warnings);
    const contentMix = deriveContentMix(platform, posts, metrics.posts, warnings);
    const languageMix = deriveLanguageMix(posts, metrics.posts, warnings);
    const featured = deriveFeatured(platform, posts, metrics.posts, warnings);

    return {
      platform,
      label: platformConfig[platform].label,
      filename: file.name,
      detectedMonth: overview.month,
      metrics,
      cadence,
      contentMix,
      languageMix,
      featured,
      postRows: posts.length,
      warnings,
      errors
    };
  }

  function fmt(value, decimals = 0) {
    if (value === null || value === undefined) return "—";
    return Number(value).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function previewCard(analysis) {
    const statusClass = analysis.errors.length ? "error" : analysis.warnings.length ? "warning" : "ready";
    const statusText = analysis.errors.length ? "Needs attention" : analysis.warnings.length ? "Ready with notes" : "Ready";
    const mixLabel = analysis.contentMix ? analysis.contentMix.map(row => `${row.format} ${row.post_count}`).join(" · ") : "Preserve existing/manual";
    const cadenceLabel = analysis.cadence ? analysis.cadence.map(row => row.post_count).join(" / ") : "Preserve existing/manual";
    const featureLabel = analysis.featured?.length ? `${analysis.featured.length} selected` : "Preserve existing/manual";

    return `
      <article class="import-preview-card ${statusClass}">
        <div class="import-preview-title">
          <div><span class="import-platform-mini">${analysis.label}</span><strong>${escapeHtml(analysis.filename)}</strong></div>
          <span class="import-status ${statusClass}">${statusText}</span>
        </div>
        <div class="import-kpi-grid">
          <div><span>Posts</span><strong>${fmt(analysis.metrics.posts)}</strong></div>
          <div><span>Followers</span><strong>${fmt(analysis.metrics.followers)}</strong></div>
          <div><span>Impressions</span><strong>${fmt(analysis.metrics.impressions)}</strong></div>
          <div><span>Reach</span><strong>${fmt(analysis.metrics.reach)}</strong></div>
          <div><span>Engagements</span><strong>${fmt(analysis.metrics.engagements)}</strong></div>
          <div><span>Engagement rate</span><strong>${analysis.metrics.engagement_rate === null ? "—" : `${fmt(analysis.metrics.engagement_rate, 2)}%`}</strong></div>
        </div>
        <div class="import-derived-list">
          <div><span>Weekly cadence</span><strong>${escapeHtml(cadenceLabel)}</strong></div>
          <div><span>Content mix</span><strong>${escapeHtml(mixLabel)}</strong></div>
          <div><span>Post rows read</span><strong>${analysis.postRows}</strong></div>
          <div><span>Featured posts</span><strong>${featureLabel}</strong></div>
        </div>
        ${analysis.errors.length ? `<div class="import-message-list errors">${analysis.errors.map(item => `<div><i class="bi bi-x-circle"></i><span>${escapeHtml(item)}</span></div>`).join("")}</div>` : ""}
        ${analysis.warnings.length ? `<div class="import-message-list warnings">${analysis.warnings.map(item => `<div><i class="bi bi-exclamation-circle"></i><span>${escapeHtml(item)}</span></div>`).join("")}</div>` : ""}
      </article>`;
  }

  function renderPreview(analyses, month) {
    const preview = $("#meltwaterImportPreview");
    if (!preview) return;
    const errors = analyses.flatMap(a => a.errors);
    const warnings = analyses.flatMap(a => a.warnings);
    preview.classList.remove("d-none");
    preview.innerHTML = `
      <div class="import-preview-head">
        <div><div class="admin-section-kicker">Import preview</div><h3>${new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))}</h3><p>Review the detected values before they are written to the CMS.</p></div>
        <div class="import-preview-summary"><strong>${errors.length ? "Import blocked" : "Ready to import"}</strong><span>${errors.length} errors · ${warnings.length} notes</span></div>
      </div>
      <div class="import-preview-grid">${analyses.map(previewCard).join("")}</div>`;
  }

  async function analyseAll() {
    hideImportAlert();
    const month = $("#importReportMonth")?.value;
    if (!month) {
      showImportAlert("Choose the reporting month first.", "warning");
      return;
    }
    if (!XLSXLib) {
      showImportAlert("The spreadsheet parser did not load. Check the SheetJS CDN connection and try again.");
      return;
    }

    const selections = Object.entries(platformConfig).map(([platform, config]) => ({
      platform,
      file: $(config.fileId)?.files?.[0] || null
    }));
    const missing = selections.filter(item => !item.file).map(item => platformConfig[item.platform].label);
    if (missing.length) {
      showImportAlert(`Choose all three Meltwater files before analysing: ${missing.join(", ")}.`, "warning");
      return;
    }

    const analyseBtn = $("#analyseMeltwaterBtn");
    const importBtn = $("#importMeltwaterBtn");
    const original = analyseBtn.innerHTML;
    analyseBtn.disabled = true;
    importBtn.disabled = true;
    analyseBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Analysing…';

    try {
      const analyses = [];
      for (const selection of selections) {
        analyses.push(await analyseFile(selection.file, selection.platform, month));
      }
      state.analyses = analyses;
      state.selectedMonth = month;
      renderPreview(analyses, month);
      const errorCount = analyses.reduce((sum, a) => sum + a.errors.length, 0);
      importBtn.disabled = errorCount > 0;
      if (errorCount) {
        showImportAlert("One or more files do not match the selected month/platform or are missing required metrics. Review the import preview.", "warning");
      } else {
        showImportAlert("Files analysed successfully. Review the preview, then import to a draft report.", "success");
      }
    } catch (err) {
      console.error(err);
      state.analyses = null;
      showImportAlert(err.message || "Unable to analyse the Meltwater files.");
    } finally {
      analyseBtn.disabled = false;
      analyseBtn.innerHTML = original;
    }
  }

  async function getOrCreateDraft(month) {
    const reportMonth = `${month}-01`;
    const { data: existing, error: existingError } = await client
      .from("reports")
      .select("*")
      .eq("report_month", reportMonth)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      const { data, error } = await client
        .from("reports")
        .update({
          status: "draft",
          source: "Meltwater",
          published_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await client
      .from("reports")
      .insert({
        report_month: reportMonth,
        status: "draft",
        source: "Meltwater",
        prepared_by: state.admin?.user?.email || null,
        created_by: state.admin?.user?.id || null
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function replacePlatformRows(table, reportId, platform, rows) {
    if (!rows) return;
    const { error: deleteError } = await client.from(table).delete().eq("report_id", reportId).eq("platform", platform);
    if (deleteError) throw deleteError;
    if (!rows.length) return;
    const payload = rows.map(row => ({ report_id: reportId, platform, ...row }));
    const { error: insertError } = await client.from(table).insert(payload);
    if (insertError) throw insertError;
  }

  async function importFeatured(reportId, analysis) {
    if (!analysis.featured?.length) return;
    const { data: existing, error: existingError } = await client
      .from("featured_posts")
      .select("*")
      .eq("report_id", reportId)
      .eq("platform", analysis.platform);
    if (existingError) throw existingError;
    const existingMap = Object.fromEntries((existing || []).map(row => [row.performance_type, row]));

    const rows = analysis.featured.map(row => ({
      report_id: reportId,
      ...row,
      image_url: existingMap[row.performance_type]?.image_url || null
    }));

    const { error } = await client
      .from("featured_posts")
      .upsert(rows, { onConflict: "report_id,platform,performance_type" });
    if (error) throw error;
  }

  async function importToDraft() {
    hideImportAlert();
    if (state.busy) return;
    if (!state.analyses || !state.selectedMonth) {
      showImportAlert("Analyse the files first.", "warning");
      return;
    }
    if (state.selectedMonth !== $("#importReportMonth")?.value) {
      showImportAlert("The reporting month changed after analysis. Analyse the files again before importing.", "warning");
      return;
    }
    if (state.analyses.some(a => a.errors.length)) {
      showImportAlert("Resolve the import errors before continuing.", "warning");
      return;
    }

    state.busy = true;
    const importBtn = $("#importMeltwaterBtn");
    const analyseBtn = $("#analyseMeltwaterBtn");
    const original = importBtn.innerHTML;
    importBtn.disabled = true;
    analyseBtn.disabled = true;
    importBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Importing…';

    try {
      const report = await getOrCreateDraft(state.selectedMonth);

      const { data: existingMetrics, error: existingMetricsError } = await client
        .from("platform_metrics")
        .select("*")
        .eq("report_id", report.id);
      if (existingMetricsError) throw existingMetricsError;
      const existingMetricMap = Object.fromEntries((existingMetrics || []).map(row => [row.platform, row]));

      const metricRows = state.analyses.map(analysis => ({
        report_id: report.id,
        platform: analysis.platform,
        posts: analysis.metrics.posts,
        followers: analysis.metrics.followers,
        impressions: analysis.metrics.impressions,
        reach: analysis.metrics.reach ?? existingMetricMap[analysis.platform]?.reach ?? null,
        engagements: analysis.metrics.engagements,
        engagement_rate: analysis.metrics.engagement_rate ?? existingMetricMap[analysis.platform]?.engagement_rate ?? null
      }));
      const { error: metricsError } = await client
        .from("platform_metrics")
        .upsert(metricRows, { onConflict: "report_id,platform" });
      if (metricsError) throw metricsError;

      for (const analysis of state.analyses) {
        await replacePlatformRows("weekly_cadence", report.id, analysis.platform, analysis.cadence);
        await replacePlatformRows("content_mix", report.id, analysis.platform, analysis.contentMix);
        await replacePlatformRows("language_mix", report.id, analysis.platform, analysis.languageMix);
        await importFeatured(report.id, analysis);
      }

      const { error: touchError } = await client.from("reports").update({ updated_at: new Date().toISOString() }).eq("id", report.id);
      if (touchError) throw touchError;

      showImportAlert("Meltwater data imported successfully. Opening the draft report for review…", "success");
      window.setTimeout(() => {
        window.location.href = `report.html?id=${encodeURIComponent(report.id)}`;
      }, 700);
    } catch (err) {
      console.error(err);
      showImportAlert(err.message || "Unable to import Meltwater data.");
      importBtn.disabled = false;
      analyseBtn.disabled = false;
      importBtn.innerHTML = original;
      state.busy = false;
    }
  }

  function wireFileInputs() {
    for (const config of Object.values(platformConfig)) {
      const input = $(config.fileId);
      const label = $(config.nameId);
      input?.addEventListener("change", () => {
        const file = input.files?.[0];
        label.textContent = file ? file.name : "Choose Meltwater file";
        input.closest(".import-file-card")?.classList.toggle("has-file", Boolean(file));
        state.analyses = null;
        $("#importMeltwaterBtn").disabled = true;
        $("#meltwaterImportPreview")?.classList.add("d-none");
        hideImportAlert();
      });
    }

    $("#importReportMonth")?.addEventListener("change", () => {
      state.analyses = null;
      $("#importMeltwaterBtn").disabled = true;
      $("#meltwaterImportPreview")?.classList.add("d-none");
      hideImportAlert();
    });
  }

  async function init() {
    const form = $("#meltwaterImportForm");
    if (!form) return;
    if (!api?.ready || !client) {
      showImportAlert("Supabase is not configured. Complete the setup before using the importer.");
      form.querySelectorAll("input,button").forEach(el => { el.disabled = true; });
      return;
    }
    if (!XLSXLib) {
      showImportAlert("Spreadsheet import library failed to load. Check your internet/CDN access.");
      form.querySelectorAll("input,button").forEach(el => { el.disabled = true; });
      return;
    }

    const admin = await api.requireAdmin();
    if (!admin) return;
    state.admin = admin;

    wireFileInputs();
    $("#analyseMeltwaterBtn")?.addEventListener("click", analyseAll);
    $("#importMeltwaterBtn")?.addEventListener("click", importToDraft);
  }

  init();
})();
