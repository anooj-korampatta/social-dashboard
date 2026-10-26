(() => {
  "use strict";
  const api = window.GWC_SUPABASE;
  const client = api?.client;

  window.GWC_CAMPAIGN_SHARE = {
    async fetch() {
      if (!api?.ready || !client) throw new Error("Share view is not configured.");
      const token = new URLSearchParams(window.location.search).get("token") || "";
      if (!token) throw new Error("Missing campaign share token.");
      const { data, error } = await client.functions.invoke("campaign-share", { body: { action: "get", token } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    }
  };
})();
