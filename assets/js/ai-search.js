(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client || null;
  const tab = document.querySelector("#tab-ai-search");
  const form = document.querySelector("#aiSearchForm");
  const input = document.querySelector("#aiSearchInput");
  const submit = document.querySelector("#aiSearchSubmit");
  const results = document.querySelector("#aiSearchResults");
  const status = document.querySelector("#aiSearchStatus");
  const context = document.querySelector("#aiSearchContext");
  const monthSelect = document.querySelector("#monthSelect");

  if (!tab || !form || !input || !submit || !results || !status) return;

  const esc = value => String(value ?? "").replace(/[&<>'"]/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[ch]);

  function parseBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value === "true";
    return Boolean(value);
  }

  function selectedContext() {
    if (!monthSelect) return { reportId: null, label: "latest published month" };
    return {
      reportId: monthSelect.value || null,
      label: monthSelect.options?.[monthSelect.selectedIndex]?.textContent?.replace(" · Preview", "") || "selected month"
    };
  }

  function refreshContextLabel() {
    const c = selectedContext();
    if (context) context.textContent = `Default context: ${c.label}. If your question names another month or period, AI Search will use that instead.`;
  }

  function setLoading(isLoading) {
    input.disabled = isLoading;
    submit.disabled = isLoading;
    submit.innerHTML = isLoading
      ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>Thinking</span>'
      : '<span>Ask</span><i class="bi bi-arrow-up-right"></i>';
    status.classList.toggle("d-none", !isLoading);
    status.innerHTML = isLoading ? '<span class="ai-thinking-dot"></span>Reading published reporting data…' : "";
  }

  function renderResult(payload, question) {
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const facts = Array.isArray(payload.facts) ? payload.facts : [];
    const sourceHtml = sources.length
      ? `<div class="ai-result-sources"><span>Sources</span>${sources.map(s => `<span class="ai-source-pill">${esc(s)}</span>`).join("")}</div>`
      : "";
    const factHtml = facts.length
      ? `<div class="ai-result-facts">${facts.map(f => `<div class="ai-result-fact"><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join("")}</div>`
      : "";
    const noteHtml = payload.note ? `<div class="ai-result-note"><i class="bi bi-info-circle"></i><span>${esc(payload.note)}</span></div>` : "";

    results.innerHTML = `
      <article class="ai-result-card">
        <div class="ai-result-question"><i class="bi bi-chat-left-text"></i><span>${esc(question)}</span></div>
        <div class="ai-result-answer-icon"><i class="bi bi-stars"></i></div>
        <div class="ai-result-body">
          <div class="ai-result-label">${esc(payload.title || "Answer")}</div>
          <div class="ai-result-answer">${esc(payload.answer || "No answer was returned.")}</div>
          ${payload.calculation ? `<div class="ai-result-calculation">${esc(payload.calculation)}</div>` : ""}
          ${factHtml}
          ${noteHtml}
          ${sourceHtml}
        </div>
      </article>`;
  }

  function renderError(message) {
    results.innerHTML = `<div class="ai-search-error"><i class="bi bi-exclamation-circle"></i><div><strong>AI Search couldn't complete that question.</strong><span>${esc(message)}</span></div></div>`;
  }

  async function ask(question) {
    const c = selectedContext();
    setLoading(true);
    results.innerHTML = "";

    try {
      const { data, error } = await client.functions.invoke("ai-search", {
        body: {
          question,
          selected_report_id: c.reportId
        }
      });

      if (error) {
        let detail = error.message || "The AI Search function returned an error.";
        try {
          const body = await error.context?.json?.();
          if (body?.error) detail = body.error;
        } catch (_) {}
        throw new Error(detail);
      }
      if (!data?.answer) throw new Error(data?.error || "No answer was returned.");
      renderResult(data, question);
    } catch (err) {
      console.error(err);
      renderError(err.message || "Please try again.");
    } finally {
      setLoading(false);
      input.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    ask(question);
  });

  document.querySelectorAll(".ai-suggestion").forEach(btn => {
    btn.addEventListener("click", () => {
      input.value = btn.textContent.trim();
      form.requestSubmit();
    });
  });

  monthSelect?.addEventListener("change", refreshContextLabel);

  async function init() {
    if (!api?.ready || !client) return;

    const { data, error } = await client
      .from("portal_settings")
      .select("value")
      .eq("key", "ai_search_enabled")
      .maybeSingle();

    if (error) {
      console.warn("AI Search setting unavailable. Run database/ai_search_patch.sql.", error);
      return;
    }

    if (parseBoolean(data?.value)) {
      tab.classList.remove("d-none");
      refreshContextLabel();
    }
  }

  init().catch(err => console.error("AI Search init failed", err));
})();
