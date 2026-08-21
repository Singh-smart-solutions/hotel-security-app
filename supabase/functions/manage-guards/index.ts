// Secure guard-account management. Uses the service-role key (server-side only)
// and refuses every request whose caller is not an active manager.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // These three are injected automatically into every deployed edge function.
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: 'Server not configured' }, 500)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // 1. Identify the caller from their bearer token.
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Missing authorization' }, 401)
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    const caller = userData?.user
    if (userErr || !caller) return json({ error: 'Invalid session' }, 401)

    // 2. Authorize: caller must be an active manager.
    const { data: role } = await admin
      .from('user_roles')
      .select('role, disabled')
      .eq('user_id', caller.id)
      .single()
    if (!role || role.role !== 'manager' || role.disabled) {
      return json({ error: 'Manager access required' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const action = body?.action

    // 3. LIST guards (auth users merged with their role rows).
    if (action === 'list') {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      if (error) return json({ error: error.message }, 500)
      const { data: roles } = await admin.from('user_roles').select('*')
      const roleById = new Map((roles || []).map((r) => [r.user_id, r]))
      const users = list.users.map((u) => {
        const r = roleById.get(u.id)
        return {
          id: u.id,
          email: u.email,
          role: r?.role || 'guard',
          full_name: r?.full_name || u.user_metadata?.full_name || '',
          disabled: Boolean(r?.disabled) || Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
          created_at: u.created_at,
        }
      })
      return json({ success: true, users })
    }

    // 4. CREATE a guard account.
    if (action === 'create') {
      const email = String(body.email || '').trim()
      const password = String(body.password || '')
      const fullName = String(body.full_name || '').trim()
      if (!email || password.length < 6) {
        return json({ error: 'Email and a password of at least 6 characters are required' }, 400)
      }
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (error) return json({ error: error.message }, 400)
      await admin.from('user_roles').upsert({
        user_id: created.user.id,
        role: 'guard',
        full_name: fullName,
        disabled: false,
      })
      return json({ success: true, id: created.user.id })
    }

    // 5. DISABLE / ENABLE a guard (soft — the account and history stay).
    if (action === 'set_disabled') {
      const userId = String(body.user_id || '')
      const disabled = Boolean(body.disabled)
      if (!userId) return json({ error: 'user_id required' }, 400)
      if (userId === caller.id) return json({ error: 'You cannot disable your own account' }, 400)
      const { error } = await admin.auth.admin.updateUserById(userId, {
        // A long ban blocks login; 'none' restores it.
        ban_duration: disabled ? '876000h' : 'none',
      })
      if (error) return json({ error: error.message }, 400)
      await admin.from('user_roles').update({ disabled }).eq('user_id', userId)
      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
