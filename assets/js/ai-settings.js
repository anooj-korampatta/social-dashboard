(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client || null;
  const toggle = document.querySelector("#aiSearchEnabled");
  const saveBtn = document.querySelector("#saveAiSettingsBtn");
  const status = document.querySelector("#aiFeatureStatus");
  const alertBox = document.querySelector("#aiSettingsAlert");

  if (!toggle || !saveBtn || !status) return;

  function setStatus(enabled, label) {
    status.classList.toggle("enabled", Boolean(enabled));
    status.innerHTML = `<span></span>${label || (enabled ? "Enabled" : "Disabled")}`;
  }

  function showAlert(message, type = "success") {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type} mt-3 mb-0`;
    alertBox.textContent = message;
  }

  function parseBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value === "true";
    return Boolean(value);
  }

  async function loadSetting() {
    if (!api?.ready || !client) {
      setStatus(false, "Unavailable");
      toggle.disabled = true;
      showAlert("Supabase is not configured.", "warning");
      return;
    }

    const admin = await api.requireAdmin({ redirect: false });
    if (!admin) return;

    const { data, error } = await client
      .from("portal_settings")
      .select("value")
      .eq("key", "ai_search_enabled")
      .maybeSingle();

    if (error) {
      setStatus(false, "Setup required");
      toggle.disabled = true;
      showAlert("AI Search database settings are not installed yet. Run database/ai_search_patch.sql in Supabase SQL Editor.", "warning");
      return;
    }

    const enabled = parseBoolean(data?.value);
    toggle.checked = enabled;
    toggle.disabled = false;
    saveBtn.disabled = false;
    setStatus(enabled);
  }

  toggle.addEventListener("change", () => setStatus(toggle.checked, toggle.checked ? "Will enable" : "Will disable"));

  saveBtn.addEventListener("click", async () => {
    if (!client) return;
    saveBtn.disabled = true;
    const oldHtml = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Saving';

    try {
      const admin = await api.requireAdmin({ redirect: false });
      if (!admin) throw new Error("Admin session not found.");

      const { error } = await client
        .from("portal_settings")
        .upsert({
          key: "ai_search_enabled",
          value: toggle.checked,
          updated_at: new Date().toISOString(),
          updated_by: admin.user.id
        }, { onConflict: "key" });

      if (error) throw error;
      setStatus(toggle.checked);
      showAlert(`AI Search ${toggle.checked ? "enabled" : "disabled"}. Refresh the public dashboard to apply the change.`, "success");
    } catch (err) {
      showAlert(err.message || "Unable to save AI Search setting.", "danger");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = oldHtml;
    }
  });

  loadSetting().catch(err => {
    console.error(err);
    setStatus(false, "Unavailable");
  });
})();
