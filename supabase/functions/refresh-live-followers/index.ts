import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const platforms = ["linkedin", "instagram", "x"] as const;
type Platform = typeof platforms[number];

type LiveRow = {
  platform: Platform;
  followers: number | null;
  fetched_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
}

async function fetchLinkedInFollowers() {
  const token = required("LINKEDIN_ACCESS_TOKEN");
  const organizationId = required("LINKEDIN_ORGANIZATION_ID");
  const version = required("LINKEDIN_API_VERSION");
  const url = `https://api.linkedin.com/rest/networkSizes/urn:li:organization:${encodeURIComponent(organizationId)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": version,
      "Content-Type": "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`LinkedIn ${response.status}: ${payload?.message || payload?.error || "request failed"}`);
  const followers = Number(payload?.firstDegreeSize);
  if (!Number.isFinite(followers)) throw new Error("LinkedIn response did not contain firstDegreeSize");
  return Math.trunc(followers);
}

async function fetchInstagramFollowers() {
  const token = required("INSTAGRAM_ACCESS_TOKEN");
  const userId = required("INSTAGRAM_USER_ID");
  const graphVersion = required("META_GRAPH_VERSION");
  const params = new URLSearchParams({ fields: "followers_count", access_token: token });
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(userId)}?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Instagram ${response.status}: ${payload?.error?.message || "request failed"}`);
  const followers = Number(payload?.followers_count);
  if (!Number.isFinite(followers)) throw new Error("Instagram response did not contain followers_count");
  return Math.trunc(followers);
}

async function fetchXFollowers() {
  const token = required("X_BEARER_TOKEN");
  const userId = required("X_USER_ID");
  const response = await fetch(`https://api.x.com/2/users/${encodeURIComponent(userId)}?user.fields=public_metrics`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`X ${response.status}: ${payload?.detail || payload?.title || "request failed"}`);
  const followers = Number(payload?.data?.public_metrics?.followers_count);
  if (!Number.isFinite(followers)) throw new Error("X response did not contain public_metrics.followers_count");
  return Math.trunc(followers);
}

async function fetchPlatform(platform: Platform) {
  if (platform === "linkedin") return fetchLinkedInFollowers();
  if (platform === "instagram") return fetchInstagramFollowers();
  return fetchXFollowers();
}

function isFresh(row: LiveRow | undefined, maxAgeMs: number) {
  if (!row?.last_success_at) return false;
  const ts = new Date(row.last_success_at).getTime();
  return Number.isFinite(ts) && Date.now() - ts < maxAgeMs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = required("SUPABASE_URL");
  const anonKey = required("SUPABASE_ANON_KEY");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") || "";

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false }
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData?.user) return json({ error: "Authentication required" }, 401);

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: currentData, error: currentError } = await service
    .from("live_followers")
    .select("platform,followers,fetched_at,last_success_at,last_error");
  if (currentError) return json({ error: currentError.message }, 500);

  let body: { force?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const force = Boolean(body?.force);
  const current = new Map<string, LiveRow>((currentData || []).map((row: LiveRow) => [row.platform, row]));

  // Ordinary background refreshes reuse data for 15 minutes. A manual refresh
  // may refresh sooner, but still enforces a 2-minute minimum to protect API quotas.
  const maxAgeMs = force ? 2 * 60 * 1000 : 15 * 60 * 1000;
  if (platforms.every((platform) => isFresh(current.get(platform), maxAgeMs))) {
    return json({ cached: true, rows: currentData || [] });
  }

  const now = new Date().toISOString();
  for (const platform of platforms) {
    if (isFresh(current.get(platform), maxAgeMs)) continue;
    try {
      const followers = await fetchPlatform(platform);
      const { error } = await service.from("live_followers").upsert({
        platform,
        followers,
        fetched_at: now,
        last_success_at: now,
        last_error: null,
        updated_at: now
      }, { onConflict: "platform" });
      if (error) throw error;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await service.from("live_followers").upsert({
        platform,
        fetched_at: now,
        last_error: message.slice(0, 1200),
        updated_at: now
      }, { onConflict: "platform" });
    }
  }

  const { data: rows, error } = await service
    .from("live_followers")
    .select("platform,followers,fetched_at,last_success_at,last_error")
    .order("platform");
  if (error) return json({ error: error.message }, 500);

  return json({ cached: false, rows: rows || [] });
});
