(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client;
  const form = document.querySelector("#loginForm");
  const alertBox = document.querySelector("#loginAlert");
  const button = document.querySelector("#loginBtn");

  function showAlert(message, type = "danger") {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
  }

  async function init() {
    if (!api?.ready || !client) {
      showAlert("Supabase is not configured. Add your Project URL and Publishable key in assets/js/config.js.");
      form.querySelectorAll("input,button").forEach(el => { el.disabled = true; });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "not-authorised") {
      showAlert("This account is not authorised for the reporting CMS.", "warning");
    }

    const admin = await api.requireAdmin({ redirect: false });
    if (admin) {
      window.location.href = "index.html";
      return;
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const email = document.querySelector("#email").value.trim();
      const password = document.querySelector("#password").value;
      if (!email || !password) {
        showAlert("Enter both email and password.", "warning");
        return;
      }

      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Signing in…";

      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const adminUser = await api.requireAdmin({ redirect: false });
        if (!adminUser) {
          await client.auth.signOut();
          throw new Error("This user is not listed in admin_users.");
        }
        window.location.href = "index.html";
      } catch (err) {
        showAlert(err.message || "Unable to sign in.");
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  init();
})();
