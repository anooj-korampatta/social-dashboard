(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client;
  const parser = window.GWC_CAMPAIGN_XLSX;
  const $ = (selector, root = document) => root.querySelector(selector);

  const state = {
    admin: null,
    analysis: null,
    reimportId: null,
    shareCampaignId: null,
    shareModal: null
  };

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const fmt = value => value === null || value === undefined ? "—" : new Intl.NumberFormat("en-GB").format(value);
  const pct = value => value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}%`;
  const dateFmt = value => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00Z`)) : "—";

  function alertMessage(message, type = "danger") {
    const box = $("#campaignAdminAlert");
    box.className = `alert alert-${type}`;
    box.textContent = message;
  }

  function clearAlert() {
    const box = $("#campaignAdminAlert");
    box.className = "alert d-none";
    box.textContent = "";
  }

  async function loadCampaigns() {
    const list = $("#campaignList");
    list.innerHTML = '<div class="campaign-admin-loading">Loading campaigns…</div>';
    const { data, error } = await client
      .from("campaigns")
      .select("id,name,campaign_tag,period_start,period_end,status,total_items,impressions,engagements,updated_at,source_filename")
      .order("period_end", { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      list.innerHTML = '<div class="campaign-empty"><i class="bi bi-megaphone d-block fs-2 mb-2"></i>No campaigns yet. Upload a tagged Meltwater Excel export on the right.</div>';
      return;
    }

    list.innerHTML = data.map(row => `
      <article class="campaign-row" data-campaign-id="${esc(row.id)}">
        <div>
          <div class="campaign-row-title">${esc(row.name)}</div>
          <div class="campaign-row-meta">${dateFmt(row.period_start)} – ${dateFmt(row.period_end)} · ${fmt(row.total_items)} items · ${fmt(row.impressions)} impressions${row.campaign_tag ? ` · Tag: ${esc(row.campaign_tag)}` : ""}</div>
        </div>
        <span class="campaign-status ${row.status === "published" ? "published" : ""}">${esc(row.status)}</span>
        <div class="campaign-row-actions">
          <a class="btn btn-sm btn-outline-secondary" href="../campaigns.html?id=${encodeURIComponent(row.id)}${row.status !== "published" ? "&preview=1" : ""}" target="_blank" rel="noopener" title="Preview"><i class="bi bi-eye"></i></a>
          <button class="btn btn-sm btn-outline-secondary" type="button" data-action="reimport" title="Re-import Excel"><i class="bi bi-arrow-repeat"></i></button>
          <button class="btn btn-sm ${row.status === "published" ? "btn-outline-dark" : "btn-success"}" type="button" data-action="publish" data-status="${esc(row.status)}" title="${row.status === "published" ? "Move to draft" : "Publish"}"><i class="bi ${row.status === "published" ? "bi-eye-slash" : "bi-check2-circle"}"></i></button>
          <button class="btn btn-sm btn-outline-secondary" type="button" data-action="share" ${row.status !== "published" ? "disabled" : ""} title="Temporary share link"><i class="bi bi-share"></i></button>
        </div>
      </article>`).join("");

    list.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", handleRowAction));
  }

  async function getCampaign(id) {
    const { data, error } = await client.from("campaigns").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }

  async function handleRowAction(event) {
    const button = event.currentTarget;
    const row = button.closest(".campaign-row");
    const id = row?.dataset.campaignId;
    if (!id) return;
    clearAlert();

    try {
      if (button.dataset.action === "reimport") {
        const campaign = await getCampaign(id);
        state.reimportId = id;
        $("#campaignName").value = campaign.name || "";
        $("#campaignFile").value = "";
        $("#campaignFileName").textContent = `Re-importing ${campaign.name} · choose updated XLSX`;
        $("#campaignAnalysis").classList.add("d-none");
        $("#campaignFile").click();
        return;
      }

      if (button.dataset.action === "publish") {
        button.disabled = true;
        const next = button.dataset.status === "published" ? "draft" : "published";
        const { error } = await client.from("campaigns").update({ status: next }).eq("id", id);
        if (error) throw error;
        await loadCampaigns();
        alertMessage(next === "published" ? "Campaign published." : "Campaign moved back to draft.", "success");
        return;
      }

      if (button.dataset.action === "share") {
        const campaign = await getCampaign(id);
        state.shareCampaignId = id;
        $("#shareCampaignName").textContent = campaign.name;
        $("#shareLinkResult").classList.add("d-none");
        state.shareModal.show();
        await loadShareLinks();
      }
    } catch (error) {
      alertMessage(error.message || "Unable to complete the action.");
      button.disabled = false;
    }
  }

  function analysisMarkup(data) {
    const name = $("#campaignName").value.trim() || data.tag || "Campaign";
    const warnings = data.warnings || [];
    return `
      <div class="analysis-kicker">Detected from Meltwater</div>
      <div class="analysis-title">${esc(name)}</div>
      <div class="analysis-period">${dateFmt(data.periodStart)} – ${dateFmt(data.periodEnd)} · Tag: ${esc(data.tag || "Not detected")}</div>
      <div class="analysis-grid">
        <div class="analysis-metric"><strong>${fmt(data.overall.total_items)}</strong><span>Content items</span></div>
        <div class="analysis-metric"><strong>${fmt(data.overall.impressions)}</strong><span>Impressions</span></div>
        <div class="analysis-metric"><strong>${fmt(data.overall.engagements)}</strong><span>Engagements</span></div>
        <div class="analysis-metric"><strong>${fmt(data.overall.link_clicks)}</strong><span>Link clicks</span></div>
      </div>
      <div class="analysis-platforms"><strong>Platforms:</strong> ${data.platforms.map(p => esc(p.platform === "x" ? "X" : p.platform[0].toUpperCase() + p.platform.slice(1))).join(" · ")} · ER ${pct(data.overall.engagement_rate)}</div>
      ${warnings.map(w => `<div class="analysis-warning"><i class="bi bi-exclamation-triangle me-1"></i>${esc(w)}</div>`).join("")}
      <div class="analysis-actions">
        <button class="btn btn-outline-secondary" type="button" id="cancelAnalysisBtn">Cancel</button>
        <button class="btn btn-success" type="button" id="importCampaignBtn"><i class="bi bi-cloud-arrow-up me-1"></i>${state.reimportId ? "Update draft" : "Import as draft"}</button>
      </div>`;
  }

  async function analyseFile(event) {
    event.preventDefault();
    clearAlert();
    const file = $("#campaignFile").files?.[0];
    if (!file) {
      alertMessage("Choose a Meltwater XLSX file first.", "warning");
      return;
    }
    const button = $("#analyseCampaignBtn");
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Analysing…';
    try {
      state.analysis = await parser.parseFile(file);
      if (!$("#campaignName").value.trim() && state.analysis.tag) $("#campaignName").value = state.analysis.tag;
      const analysis = $("#campaignAnalysis");
      analysis.innerHTML = analysisMarkup(state.analysis);
      analysis.classList.remove("d-none");
      $("#cancelAnalysisBtn").addEventListener("click", resetImport);
      $("#importCampaignBtn").addEventListener("click", importCampaign);
    } catch (error) {
      alertMessage(error.message || "Unable to analyse this Meltwater workbook.");
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="bi bi-search me-2"></i>Analyse Excel';
    }
  }

  async function findExistingId(data) {
    if (state.reimportId) return state.reimportId;
    if (!data.tag || !data.periodStart || !data.periodEnd) return null;
    const { data: existing, error } = await client
      .from("campaigns")
      .select("id")
      .eq("campaign_tag", data.tag)
      .eq("period_start", data.periodStart)
      .eq("period_end", data.periodEnd)
      .maybeSingle();
    if (error) throw error;
    return existing?.id || null;
  }

  async function importCampaign() {
    if (!state.analysis) return;
    const name = $("#campaignName").value.trim() || state.analysis.tag;
    if (!name) {
      alertMessage("Enter a campaign name before importing.", "warning");
      return;
    }
    if (!state.analysis.periodStart || !state.analysis.periodEnd) {
      alertMessage("The reporting period could not be detected. Use a standard Meltwater campaign export.", "warning");
      return;
    }

    const button = $("#importCampaignBtn");
    button.disabled = true;
    try {
      const existingId = await findExistingId(state.analysis);
      const payload = {
        id: existingId,
        name,
        campaign_tag: state.analysis.tag || name,
        source: "Meltwater",
        source_filename: state.analysis.sourceFilename,
        period_start: state.analysis.periodStart,
        period_end: state.analysis.periodEnd,
        status: "draft",
        ...state.analysis.overall,
        platforms: state.analysis.platforms,
        posts: state.analysis.posts,
        daily: state.analysis.daily
      };

      const { data: campaignId, error } = await client.rpc("import_campaign_payload", { payload });
      if (error) throw error;
      resetImport();
      await loadCampaigns();
      alertMessage(`${name} imported successfully as a draft. Preview it, then publish when ready.`, "success");
      window.open(`../campaigns.html?id=${encodeURIComponent(campaignId)}&preview=1`, "_blank", "noopener");
    } catch (error) {
      alertMessage(error.message || "Unable to import campaign.");
      button.disabled = false;
    }
  }

  function resetImport() {
    state.analysis = null;
    state.reimportId = null;
    $("#campaignImportForm").reset();
    $("#campaignName").value = "";
    $("#campaignFileName").textContent = "No file selected";
    $("#campaignAnalysis").innerHTML = "";
    $("#campaignAnalysis").classList.add("d-none");
  }

  async function invokeShare(body) {
    const { data, error } = await client.functions.invoke("campaign-share", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function createShareLink() {
    if (!state.shareCampaignId) return;
    const button = $("#createShareLinkBtn");
    button.disabled = true;
    try {
      const days = Number($("#shareExpiry").value || 7);
      const result = await invokeShare({ action: "create", campaign_id: state.shareCampaignId, expires_in_days: days });
      const url = new URL("../campaign-share.html", window.location.href);
      url.searchParams.set("token", result.token);
      const container = $("#shareLinkResult");
      container.innerHTML = `<div class="small fw-bold mb-2">View-only link created</div><div class="share-link-row"><input id="generatedShareUrl" class="form-control" readonly value="${esc(url.href)}"><button id="copyShareUrlBtn" class="btn btn-dark" type="button"><i class="bi bi-copy"></i></button></div><div class="small text-muted mt-2">Expires ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.expires_at))}</div>`;
      container.classList.remove("d-none");
      $("#copyShareUrlBtn").addEventListener("click", async () => {
        await navigator.clipboard.writeText(url.href);
        $("#copyShareUrlBtn").innerHTML = '<i class="bi bi-check2"></i>';
      });
      await loadShareLinks();
    } catch (error) {
      alertMessage(error.message || "Unable to create a share link.");
      state.shareModal.hide();
    } finally {
      button.disabled = false;
    }
  }

  async function loadShareLinks() {
    if (!state.shareCampaignId) return;
    const target = $("#shareLinksList");
    target.innerHTML = '<span class="text-muted">Loading…</span>';
    try {
      const result = await invokeShare({ action: "list", campaign_id: state.shareCampaignId });
      const rows = result.links || [];
      if (!rows.length) {
        target.innerHTML = '<span class="text-muted">No temporary links created yet.</span>';
        return;
      }
      target.innerHTML = rows.map(link => {
        const expired = new Date(link.expires_at) <= new Date();
        const status = link.revoked_at ? "Revoked" : expired ? "Expired" : "Active";
        return `<div class="share-item"><span>${status} · expires ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(link.expires_at))}</span>${!link.revoked_at && !expired ? `<button type="button" data-revoke-share="${esc(link.id)}">Revoke</button>` : ""}</div>`;
      }).join("");
      target.querySelectorAll("[data-revoke-share]").forEach(btn => btn.addEventListener("click", async () => {
        btn.disabled = true;
        await invokeShare({ action: "revoke", share_id: btn.dataset.revokeShare });
        await loadShareLinks();
      }));
    } catch (error) {
      target.innerHTML = `<span class="text-danger">${esc(error.message || "Unable to load links")}</span>`;
    }
  }

  async function init() {
    if (!api?.ready || !client || !parser) {
      alertMessage("Campaign Analytics is not configured. Check Supabase/configuration and campaign patch files.");
      return;
    }
    state.admin = await api.requireAdmin();
    if (!state.admin) return;
    $("#userEmail").textContent = state.admin.user.email || "";
    $("#signOutBtn").addEventListener("click", api.signOut);
    state.shareModal = new bootstrap.Modal($("#campaignShareModal"));

    $("#campaignImportForm").addEventListener("submit", analyseFile);
    $("#campaignFile").addEventListener("change", () => {
      const file = $("#campaignFile").files?.[0];
      $("#campaignFileName").textContent = file?.name || "No file selected";
      if (file && state.reimportId) $("#campaignImportForm").requestSubmit();
    });
    $("#refreshCampaignsBtn").addEventListener("click", () => loadCampaigns().catch(error => alertMessage(error.message)));
    $("#createShareLinkBtn").addEventListener("click", createShareLink);
    $("#reloadShareLinksBtn").addEventListener("click", loadShareLinks);

    try { await loadCampaigns(); } catch (error) { alertMessage(error.message || "Unable to load campaigns."); }
  }

  init();
})();
