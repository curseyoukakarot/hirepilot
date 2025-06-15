import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ENV: You must set these in supabase secrets
const APOLLO_CLIENT_ID = Deno.env.get("APOLLO_CLIENT_ID")!;
const APOLLO_CLIENT_SECRET = Deno.env.get("APOLLO_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // state = user_id

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const tokenRes = await fetch("https://app.apollo.io/api/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: APOLLO_CLIENT_ID,
      client_secret: APOLLO_CLIENT_SECRET,
      redirect_uri: "https://api.thehirepilot.com/api/auth/apollo/callback"
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    console.error("Apollo token exchange error", tokenData);
    return new Response("Token exchange failed", { status: 500 });
  }

  const { access_token, refresh_token, expires_in } = tokenData;
  const user_id = state; // state is user_id

  // Save tokens to Supabase (UPSERT)
  const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/apollo_accounts`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      user_id,
      access_token,
      refresh_token,
      expires_in,
      connected_at: new Date().toISOString()
    })
  });

  if (!saveRes.ok) {
    const errorText = await saveRes.text();
    console.error("Supabase insert failed:", errorText);
    return new Response("Failed to store tokens", { status: 500 });
  }

  return Response.redirect("https://hirepilot.app/settings/integrations?apollo=connected", 302);
}); 