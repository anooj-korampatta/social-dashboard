(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client || null;
  const form = document.querySelector("#viewerLoginForm");
  const emailInput = document.querySelector("#viewerEmail");
  const passwordInput = document.querySelector("#viewerPassword");
  const button = document.querySelector("#viewerLoginBtn");
  const alertBox = document.querySelector("#loginAlert");
  const togglePassword = document.querySelector("#togglePassword");

  function showAlert(message, type = "danger") {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
  }

  function clearAlert() {
    if (!alertBox) return;
    alertBox.className = "alert d-none";
    alertBox.textContent = "";
  }

  function nextUrl() {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (!requested) return "index.html";
    // Keep redirects local to this site.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(requested) || requested.startsWith("//")) return "index.html";
    return requested.replace(/^\/+/, "") || "index.html";
  }

  async function accessFor(user) {
    if (!user || !client) return { allowed: false, isAdmin: false, isViewer: false };

    const { data: adminRow, error: adminError } = await client
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (adminRow) return { allowed: true, isAdmin: true, isViewer: false };

    const { data: viewerRow, error: viewerError } = await client
      .from("portal_viewers")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (viewerError) throw viewerError;

    return { allowed: Boolean(viewerRow), isAdmin: false, isViewer: Boolean(viewerRow) };
  }

  async function redirectIfAlreadySignedIn() {
    if (!client) return false;
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) return false;

    try {
      const access = await accessFor(data.user);
      if (access.allowed) {
        window.location.replace(nextUrl());
        return true;
      }
      await client.auth.signOut();
      return false;
    } catch (_) {
      return false;
    }
  }

  async function init() {
    if (!form) return;
    if (!api?.ready || !client) {
      showAlert("Supabase is not configured. Check assets/js/config.js.");
      form.querySelectorAll("input,button").forEach(el => { el.disabled = true; });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error");
    if (errorCode === "not-authorised") {
      showAlert("This account is not authorised to view the reporting portal.", "warning");
    } else if (errorCode === "viewer-setup") {
      showAlert("Viewer access is not configured yet. Run database/dashboard_viewer_auth_patch.sql.", "warning");
    } else if (errorCode === "signed-out") {
      showAlert("You have been signed out.", "secondary");
    }

    if (await redirectIfAlreadySignedIn()) return;

    togglePassword?.addEventListener("click", () => {
      const showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      togglePassword.setAttribute("title", showing ? "Show password" : "Hide password");
      togglePassword.innerHTML = `<i class="bi ${showing ? "bi-eye" : "bi-eye-slash"}"></i>`;
      passwordInput.focus();
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      clearAlert();

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        showAlert("Enter both email and password.", "warning");
        return;
      }

      const original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>Signing in…</span>';

      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data?.user) throw new Error("Unable to verify this account.");

        const access = await accessFor(data.user);
        if (!access.allowed) {
          await client.auth.signOut();
          throw new Error("This account is not authorised to view the reporting portal.");
        }

        window.location.replace(nextUrl());
      } catch (err) {
        showAlert(err?.message || "Unable to sign in.");
        button.disabled = false;
        button.innerHTML = original;
      }
    });
  }

  init().catch(err => showAlert(err?.message || "Unable to initialise sign in."));
})();
