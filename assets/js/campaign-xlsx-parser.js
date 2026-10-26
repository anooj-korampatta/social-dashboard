(() => {
  "use strict";

  const XLSXLib = window.XLSX;

  const platformMap = {
    linkedin: "linkedin",
    instagram: "instagram",
    facebook: "facebook",
    twitter: "x",
    x: "x"
  };

  const sourceHeaders = {
    linkedin: ["linkedin"],
    instagram: ["instagram"],
    facebook: ["facebook"],
    x: ["twitter", "x"]
  };

  const normalise = value => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const numberOrNull = value => {
    if (value === null || value === undefined || value === "" || value === "--") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const n = Number(String(value).replace(/,/g, "").replace(/%/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };
  const intOrNull = value => {
    const n = numberOrNull(value);
    return n === null ? null : Math.round(n);
  };
  const first = (...values) => values.find(v => v !== null && v !== undefined && v !== "") ?? null;

  function findSheet(workbook, wanted) {
    const target = normalise(wanted);
    const name = workbook.SheetNames.find(n => normalise(n) === target);
    return name ? workbook.Sheets[name] : null;
  }

  function matrix(workbook, name) {
    const sheet = findSheet(workbook, name);
    return sheet ? XLSXLib.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) : [];
  }

  function objectRows(workbook, name) {
    const rows = matrix(workbook, name);
    if (rows.length < 2) return [];
    const headers = rows[0].map(normalise);
    return rows.slice(1)
      .filter(row => row.some(v => v !== null && v !== ""))
      .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? null])));
  }

  function metricValue(workbook, name) {
    const rows = matrix(workbook, name);
    if (rows.length < 2) return null;
    const headers = rows[0].map(normalise);
    const col = headers.indexOf("value");
    return col >= 0 ? numberOrNull(rows[1]?.[col]) : null;
  }

  function parseIsoDate(value) {
    const text = String(value ?? "").trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  function parseTimestamp(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function parseShortDate(value, periodStart) {
    const text = String(value ?? "").trim();
    const m = text.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
    if (!m || !periodStart) return null;
    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const month = months[m[1].toLowerCase()];
    if (month === undefined) return null;
    const start = new Date(`${periodStart}T00:00:00Z`);
    let year = start.getUTCFullYear();
    if (month < start.getUTCMonth() - 6) year += 1;
    const d = new Date(Date.UTC(year, month, Number(m[2])));
    return d.toISOString().slice(0, 10);
  }

  function overview(workbook) {
    const rows = matrix(workbook, "Report overview");
    const out = { periodStart: null, periodEnd: null, profiles: {} };
    rows.forEach(row => {
      const key = normalise(row[0]);
      if (key === "from date") out.periodStart = parseIsoDate(row[1]);
      if (key === "to date") out.periodEnd = parseIsoDate(row[1]);
      if (["facebook", "instagram", "twitter", "linkedin"].includes(key)) out.profiles[platformMap[key]] = row[1] ?? null;
    });
    return out;
  }

  function detectTag(posts) {
    const counts = new Map();
    posts.forEach(post => {
      String(post.tags ?? "")
        .split(/[,;|]/)
        .map(v => v.trim())
        .filter(Boolean)
        .forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }

  function parsePosts(workbook) {
    return objectRows(workbook, "Top posts").map((row, index) => {
      const platform = platformMap[normalise(row.source)];
      if (!platform) return null;
      const timestamp = first(row["created time (utc)"], row["formatted created time"]);
      return {
        platform,
        post_date: parseTimestamp(timestamp),
        post_type: String(first(row["post type"], row.type, "") || ""),
        caption: String(row["social text"] ?? ""),
        tags: String(row.tags ?? ""),
        impressions: intOrNull(row.impressions),
        engagements: intOrNull(row.engagement),
        engagement_rate: numberOrNull(row["engagement rate"]),
        link_clicks: intOrNull(first(row["post link clicks"], row.clicks)),
        reach: intOrNull(row.reach),
        reactions: intOrNull(first(row.reactions, row["total likes"])),
        comments: intOrNull(first(row.comments, row["total comments"])),
        shares: intOrNull(first(row.shares, row.reposts, row.retweets)),
        permalink: String(row.permalink ?? ""),
        media_url: String(row["media url"] ?? ""),
        profile_url: String(row["profile url"] ?? ""),
        source_post_key: String(first(row.permalink, `${platform}-${timestamp || index}`))
      };
    }).filter(Boolean);
  }

  function parsePlatforms(workbook) {
    return objectRows(workbook, "Social Account Leaderboard").map(row => {
      const platform = platformMap[normalise(row.source)];
      if (!platform) return null;
      return {
        platform,
        items: intOrNull(row.posts) || 0,
        impressions: intOrNull(row.impressions) || 0,
        engagements: intOrNull(first(row.engagement, row.engagements)) || 0,
        engagement_rate: numberOrNull(row["engagement rate"]),
        link_clicks: intOrNull(row["post link clicks"]) || 0,
        reach: null,
        net_fans: intOrNull(row["net fans"])
      };
    }).filter(Boolean);
  }

  function dailySheet(workbook, sheetName, field, periodStart, store) {
    const rows = matrix(workbook, sheetName);
    if (rows.length < 2) return;
    const headers = rows[0].map(normalise);
    const dateCol = headers.indexOf("date");
    if (dateCol < 0) return;

    rows.slice(1).forEach(row => {
      const metricDate = parseShortDate(row[dateCol], periodStart);
      if (!metricDate) return;
      Object.entries(sourceHeaders).forEach(([platform, aliases]) => {
        const col = headers.findIndex(h => aliases.includes(h));
        if (col < 0) return;
        const value = numberOrNull(row[col]);
        if (value === null) return;
        const key = `${metricDate}|${platform}`;
        if (!store.has(key)) store.set(key, { metric_date: metricDate, platform });
        const target = store.get(key);
        target[field] = field === "engagement_rate" ? value : Math.round(value);
      });
    });
  }

  function parseDaily(workbook, periodStart) {
    const store = new Map();
    dailySheet(workbook, "Total Posts1", "posts", periodStart, store);
    dailySheet(workbook, "Post Impressions1", "impressions", periodStart, store);
    dailySheet(workbook, "Post Engagements1", "engagements", periodStart, store);
    dailySheet(workbook, "Engagement Rate1", "engagement_rate", periodStart, store);
    dailySheet(workbook, "Post Reach1", "reach", periodStart, store);
    dailySheet(workbook, "Post Link Clicks1", "link_clicks", periodStart, store);
    return [...store.values()].sort((a, b) => a.metric_date.localeCompare(b.metric_date) || a.platform.localeCompare(b.platform));
  }

  function enrichPlatformReach(platforms, posts) {
    const reachByPlatform = new Map();
    posts.forEach(post => {
      if (post.reach === null || post.reach === undefined) return;
      reachByPlatform.set(post.platform, (reachByPlatform.get(post.platform) || 0) + Number(post.reach || 0));
    });
    platforms.forEach(row => {
      row.reach = reachByPlatform.has(row.platform) ? Math.round(reachByPlatform.get(row.platform)) : null;
    });
  }

  function overall(workbook, platforms, posts) {
    const totalItems = intOrNull(metricValue(workbook, "Total Posts")) ?? posts.length;
    const impressions = intOrNull(metricValue(workbook, "Post Impressions")) ?? platforms.reduce((s, p) => s + (p.impressions || 0), 0);
    const engagements = intOrNull(metricValue(workbook, "Post Engagements")) ?? platforms.reduce((s, p) => s + (p.engagements || 0), 0);
    const engagementRate = numberOrNull(metricValue(workbook, "Engagement Rate"));
    const linkClicks = intOrNull(metricValue(workbook, "Post Link Clicks")) ?? platforms.reduce((s, p) => s + (p.link_clicks || 0), 0);
    const reach = intOrNull(metricValue(workbook, "Post Reach"));
    const netFans = intOrNull(metricValue(workbook, "Net Fans"));
    return {
      total_items: totalItems,
      impressions,
      engagements,
      engagement_rate: engagementRate,
      link_clicks: linkClicks,
      reach,
      net_fans: netFans
    };
  }

  function validate(result) {
    const warnings = [];
    if (!result.periodStart || !result.periodEnd) warnings.push("Reporting period could not be detected from the Report overview sheet.");
    if (!result.posts.length) warnings.push("No rows were found in Top posts.");
    if (!result.platforms.length) warnings.push("Social Account Leaderboard was not found or contained no supported platforms.");
    if (!result.tag) warnings.push("No Meltwater campaign tag was detected. Enter the campaign/tag name manually before importing.");
    if (result.overall.total_items !== result.posts.length) warnings.push(`Total Posts is ${result.overall.total_items}, while Top posts contains ${result.posts.length} rows. Review before publishing.`);
    return warnings;
  }

  async function parseFile(file) {
    if (!XLSXLib) throw new Error("SheetJS is not loaded.");
    const buffer = await file.arrayBuffer();
    const workbook = XLSXLib.read(buffer, { type: "array", cellDates: true });
    const info = overview(workbook);
    const posts = parsePosts(workbook);
    const platforms = parsePlatforms(workbook);
    enrichPlatformReach(platforms, posts);
    const result = {
      sourceFilename: file.name,
      periodStart: info.periodStart,
      periodEnd: info.periodEnd,
      profiles: info.profiles,
      posts,
      platforms,
      daily: parseDaily(workbook, info.periodStart),
      tag: detectTag(posts)
    };
    result.overall = overall(workbook, platforms, posts);
    result.warnings = validate(result);
    return result;
  }

  window.GWC_CAMPAIGN_XLSX = { parseFile };
})();
