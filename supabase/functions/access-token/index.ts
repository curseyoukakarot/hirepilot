// Fast Access Token Hook that returns the FULL token claims object,
// preserving required fields and injecting a root-level `role`.
// No external imports or DB calls to avoid timeouts.

Deno.serve(async (req) => {
  try {
    const payload = await req.json()

    // The hook payload typically looks like: { type: 'access_token', token: { ...claims } }
    // Fall back gracefully if shape differs.
    const baseClaims: any = payload?.token ?? payload

    // Infer user/app_metadata from common locations
    const user: any = baseClaims?.user ?? payload?.user ?? payload?.claims ?? null
    const appMeta = (user?.app_metadata ?? baseClaims?.app_metadata) || {}
    const role = (appMeta.role as string) || 'member'

    // Return the ENTIRE claims object with our additions. We must preserve
    // fields like aud, exp, iat, sub, email, phone, aal, session_id, is_anonymous, etc.
    const out = {
      ...baseClaims,
      role,
      app_metadata: {
        ...appMeta,
        role,
        allowed_roles: ['super_admin', 'team_admin', 'recruitpro', 'member', 'authenticated'],
      },
    }

    return new Response(JSON.stringify(out), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Access token hook failure', details: String(error?.message || error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})