(() => {
  "use strict";

  const cfg = window.GWC_CONFIG || {};
  const hasSdk = Boolean(window.supabase && window.supabase.createClient);
  const ready = hasSdk &&
    typeof cfg.SUPABASE_URL === "string" &&
    cfg.SUPABASE_URL.startsWith("https://") &&
    !cfg.SUPABASE_URL.includes("YOUR-") &&
    typeof cfg.SUPABASE_PUBLISHABLE_KEY === "string" &&
    !cfg.SUPABASE_PUBLISHABLE_KEY.includes("YOUR-");

  const client = ready
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  async function requireAdmin({ redirect = true } = {}) {
    if (!client) return null;

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user || null;
    if (!user) {
      if (redirect) window.location.href = "login.html";
      return null;
    }

    const { data: adminRow, error } = await client
      .from("admin_users")
      .select("user_id,email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !adminRow) {
      await client.auth.signOut();
      if (redirect) window.location.href = "login.html?error=not-authorised";
      return null;
    }

    return { user, adminRow };
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    window.location.href = "login.html";
  }

  window.GWC_SUPABASE = {
    client,
    ready,
    config: cfg,
    requireAdmin,
    signOut
  };
})();
