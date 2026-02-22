import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || (import.meta.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase public env variables for reset endpoint.');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Missing SUPABASE_SERVICE_ROLE_KEY; audit inserts will fail without it.');
}

const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

export const POST: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Require an access token to authenticate the caller
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Authorization token' }), { status: 401 });
    }

    // Verify token and ensure caller is an admin in app_users
    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500 });
    }

    const { data: userResult, error: getUserError } = await supabaseAdmin.auth.getUser(token);
    if (getUserError || !userResult?.user) {
      console.error('Failed to verify token with Supabase:', getUserError);
      return new Response(JSON.stringify({ error: 'Invalid session token' }), { status: 401 });
    }
    const callerUid = userResult.user.id;

    // Check app_users table for admin role
    const { data: appUsers, error: appUserError } = await supabaseAdmin
      .from('app_users')
      .select('username, role, app_user_uuid, auth_user_id')
      .eq('auth_user_id', callerUid)
      .limit(1);

    if (appUserError) {
      console.error('Error querying app_users for caller:', appUserError);
      return new Response(JSON.stringify({ error: 'Failed to verify admin' }), { status: 500 });
    }
    const callerRecord = Array.isArray(appUsers) && appUsers.length > 0 ? appUsers[0] : null;
    if (!callerRecord || !callerRecord.role || String(callerRecord.role).toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden - admin role required' }), { status: 403 });
    }

    // Parse body and validate target email
    const body = await request.json();
    const email: string = body?.email;
    const targetUserId: string | null = body?.target_user_id || null;

    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), { status: 400 });
    }

    // Trigger Supabase password reset email (using public client)
    const { error: resetError } = await supabasePublic.auth.resetPasswordForEmail(email);
    if (resetError) {
      console.error('Error sending reset email:', resetError);
      return new Response(JSON.stringify({ error: resetError.message || 'Failed to send reset email' }), { status: 500 });
    }

    // Insert audit record (include caller auth_user_id)
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert([{
          admin_user_id: callerUid,
          target_user_id: targetUserId,
          action: 'password_reset_email_sent',
          details: { email },
          created_at: new Date()
        }]);
    } catch (auditErr) {
      // don't fail the whole request if audit logging fails; just log
      console.error('Failed to insert audit log:', auditErr);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Unexpected error in send-reset endpoint:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

