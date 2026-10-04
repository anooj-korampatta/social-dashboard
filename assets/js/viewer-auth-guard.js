(() => {
  "use strict";

  const api = window.GWC_SUPABASE;
  const client = api?.client || null;
  const root = document.documentElement;

  function loginUrl(error = "") {
    const current = `${window.location.pathname.split("/").pop() || "index.html"}${window.location.search || ""}${window.location.hash || ""}`;
    const params = new URLSearchParams();
    params.set("next", current);
    if (error) params.set("error", error);
    return `login.html?${params.toString()}`;
  }

  function reveal() {
    root.classList.remove("auth-check-pending");
    root.classList.add("auth-check-ready");
  }

  async function getAccess(user) {
    const { data: adminRow, error: adminError } = await client
      .from("admin_users")
      .select("user_id,email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (adminRow) return { allowed: true, isAdmin: true, adminRow };

    const { data: viewerRow, error: viewerError } = await client
      .from("portal_viewers")
      .select("user_id,email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (viewerError) {
      const err = new Error(viewerError.message || "Viewer access is not configured.");
      err.code = "viewer-setup";
      throw err;
    }

    return { allowed: Boolean(viewerRow), isAdmin: false, viewerRow };
  }

  async function init() {
    if (!api?.ready || !client) {
      reveal();
      const message = document.querySelector("#systemMessage");
      if (message) {
        message.className = "system-message";
        message.textContent = "Supabase is not configured. Check assets/js/config.js.";
      }
      return null;
    }

    const { data, error } = await client.auth.getUser();
    const user = data?.user || null;
    if (error || !user) {
      window.location.replace(loginUrl());
      return null;
    }

    let access;
    try {
      access = await getAccess(user);
    } catch (err) {
      await client.auth.signOut();
      window.location.replace(loginUrl(err?.code === "viewer-setup" ? "viewer-setup" : "not-authorised"));
      return null;
    }

    if (!access.allowed) {
      await client.auth.signOut();
      window.location.replace(loginUrl("not-authorised"));
      return null;
    }

    document.querySelectorAll("[data-admin-only]").forEach(el => {
      el.classList.toggle("d-none", !access.isAdmin);
    });
    document.querySelectorAll("[data-viewer-email]").forEach(el => {
      el.textContent = user.email || "Signed in";
      el.setAttribute("title", user.email || "Signed in");
    });
    document.querySelectorAll("[data-viewer-signout]").forEach(el => {
      el.addEventListener("click", async () => {
        el.disabled = true;
        await client.auth.signOut();
        window.location.replace("login.html?error=signed-out");
      });
    });

    reveal();
    return { user, ...access };
  }

  window.GWC_VIEWER_AUTH_READY = init();

  client?.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      window.location.replace("login.html?error=signed-out");
    }
  });
})();
