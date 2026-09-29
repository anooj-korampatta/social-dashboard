(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client;
  const list = document.querySelector("#reportList");
  const alertBox = document.querySelector("#adminAlert");
  const form = document.querySelector("#newReportForm");

  function monthLabel(dateString) {
    const [y, m] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  }

  function showAlert(message, type = "danger") {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function hideAlert() {
    alertBox.className = "alert d-none";
    alertBox.textContent = "";
  }

  async function loadReports() {
    const { data, error } = await client
      .from("reports")
      .select("*")
      .order("report_month", { ascending: false });
    if (error) throw error;

    const stats = document.querySelector("#adminStats");
    if (stats) {
      const published = (data || []).filter(r => r.status === "published").length;
      const drafts = (data || []).filter(r => r.status !== "published").length;
      const latest = data?.[0] ? monthLabel(data[0].report_month) : "—";
      const cards = stats.querySelectorAll(".admin-stat-card");
      if (cards[0]) { cards[0].querySelector(".admin-stat-value").textContent = data?.length || 0; cards[0].querySelector(".admin-stat-note").textContent = "Reporting periods"; }
      if (cards[1]) { cards[1].querySelector(".admin-stat-value").textContent = published; cards[1].querySelector(".admin-stat-note").textContent = "Visible on dashboard"; }
      if (cards[2]) { cards[2].querySelector(".admin-stat-value").textContent = drafts; cards[2].querySelector(".admin-stat-note").textContent = drafts === 1 ? "Report awaiting publish" : "Reports awaiting publish"; }
      if (cards[3]) { cards[3].querySelector(".admin-stat-value").textContent = latest; cards[3].querySelector(".admin-stat-note").textContent = data?.[0]?.status === "published" ? "Latest published/draft record" : "Latest draft/published record"; }
    }

    if (!data?.length) {
      list.innerHTML = '<div class="admin-empty">No reports yet. Create the first reporting month from the panel on the right.</div>';
      return;
    }

    list.innerHTML = data.map(report => `
      <article class="report-row">
        <div>
          <div class="report-month">${monthLabel(report.report_month)}</div>
          <div class="report-meta">${report.source || "Source not set"}${report.prepared_by ? ` · ${report.prepared_by}` : ""}</div>
        </div>
        <div><span class="status-badge ${report.status === "published" ? "published" : ""}">${report.status}</span></div>
        <div class="report-meta">Updated ${report.updated_at ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(report.updated_at)) : "—"}</div>
        <div class="report-actions">
          <a class="btn btn-sm btn-outline-secondary" href="../index.html?preview=${encodeURIComponent(report.id)}" target="_blank" rel="noopener"><i class="bi bi-eye me-1"></i>Preview</a>
          <a class="btn btn-sm btn-dark" href="report.html?id=${encodeURIComponent(report.id)}"><i class="bi bi-pencil me-1"></i>Edit</a>
        </div>
      </article>`).join("");
  }

  async function init() {
    if (!api?.ready || !client) {
      showAlert("Supabase is not configured. Complete docs/SUPABASE_SETUP.md first.");
      form.querySelectorAll("input,button").forEach(el => { el.disabled = true; });
      return;
    }

    const admin = await api.requireAdmin();
    if (!admin) return;
    document.querySelector("#userEmail").textContent = admin.user.email || "";
    document.querySelector("#signOutBtn").addEventListener("click", api.signOut);

    form.addEventListener("submit", async event => {
      event.preventDefault();
      hideAlert();
      const monthValue = document.querySelector("#reportMonth").value;
      const source = document.querySelector("#source").value.trim() || "Meltwater";
      const preparedBy = document.querySelector("#preparedBy").value.trim();
      if (!monthValue) {
        showAlert("Choose a reporting month.", "warning");
        return;
      }

      const reportMonth = `${monthValue}-01`;
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const { data, error } = await client
          .from("reports")
          .insert({
            report_month: reportMonth,
            status: "draft",
            source,
            prepared_by: preparedBy || null,
            created_by: admin.user.id
          })
          .select("id")
          .single();
        if (error) throw error;
        window.location.href = `report.html?id=${encodeURIComponent(data.id)}`;
      } catch (err) {
        const msg = err.code === "23505" ? "A report already exists for that month." : (err.message || "Unable to create report.");
        showAlert(msg);
        submitBtn.disabled = false;
      }
    });

    try {
      await loadReports();
    } catch (err) {
      showAlert(err.message || "Unable to load reports.");
    }
  }

  init();
})();
