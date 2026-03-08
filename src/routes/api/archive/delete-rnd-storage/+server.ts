import type { RequestHandler } from '@sveltejs/kit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as privateEnv } from '$env/dynamic/private';
import dotenv from 'dotenv';

// Ensure .env is loaded into process.env (SvelteKit may not expose all vars to $env/dynamic/private in all setups)
dotenv.config();

const RND_BUCKET = 'rnd-documents';

// process.env first (from dotenv or shell), then SvelteKit private env, then VITE_ fallback
function getSupabaseAdmin() {
  const url =
    process.env.VITE_SUPABASE_URL ??
    privateEnv.VITE_SUPABASE_URL ??
    (import.meta as any).env?.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    privateEnv.SUPABASE_SERVICE_ROLE_KEY ??
    (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createClient(url, key);
  return null;
}

const supabaseAdmin = getSupabaseAdmin();

/** Recursively list all object paths under a prefix (e.g. "33" -> "33/Structure Drawing/file.pdf", ...) */
async function listAllPathsUnderPrefix(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
  maxDepth = 10
): Promise<string[]> {
  const out: string[] = [];
  async function recurse(currentPrefix: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    const { data: list, error } = await supabase.storage.from(bucket).list(currentPrefix, { limit: 1000 });
    if (error) {
      console.warn('[delete-rnd-storage] list error at', currentPrefix, error.message);
      return;
    }
    if (!list?.length) return;
    for (const item of list) {
      const fullPath = currentPrefix ? `${currentPrefix}/${item.name}` : item.name;
      const meta = item.metadata as { size?: number } | undefined;
      const isFile = item.id != null || (meta && typeof meta.size === 'number');
      if (isFile) {
        out.push(fullPath);
      } else {
        await recurse(fullPath, depth + 1);
      }
    }
  }
  await recurse(prefix, 0);
  return out;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Authorization token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!supabaseAdmin) {
      const url =
        process.env.VITE_SUPABASE_URL ??
        privateEnv.VITE_SUPABASE_URL ??
        (import.meta as any).env?.VITE_SUPABASE_URL;
      const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        privateEnv.SUPABASE_SERVICE_ROLE_KEY ??
        (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY;
      const reason = !url
        ? 'VITE_SUPABASE_URL not set'
        : !key
          ? 'SUPABASE_SERVICE_ROLE_KEY not set. Add SUPABASE_SERVICE_ROLE_KEY=your_service_role_key to .env in the project root and restart the dev server.'
          : 'Supabase admin client could not be created';
      return new Response(
        JSON.stringify({ error: `Server misconfiguration: ${reason}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: userResult, error: getUserError } = await supabaseAdmin.auth.getUser(token);
    if (getUserError || !userResult?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const callerUid = userResult.user.id;
    const { data: appUsers, error: appUserError } = await supabaseAdmin
      .from('app_users')
      .select('username, role')
      .eq('auth_user_id', callerUid)
      .limit(1);

    if (appUserError || !appUsers?.length || String(appUsers[0]?.role).toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden - admin required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json().catch(() => ({}));
    const paths: unknown = body?.paths;
    const prefix: unknown = body?.prefix;

    let validPaths: string[] = [];

    if (Array.isArray(paths) && paths.length > 0) {
      validPaths = paths.filter((p): p is string => typeof p === 'string' && p.length > 0);
    } else if (typeof prefix === 'string' && prefix.trim().length > 0) {
      // Fallback: list all objects under folder (e.g. "33") and remove them
      const collected = await listAllPathsUnderPrefix(supabaseAdmin, RND_BUCKET, prefix.trim());
      validPaths = collected;
    }

    if (validPaths.length === 0) {
      return new Response(JSON.stringify({ success: true, deleted: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data, error } = await supabaseAdmin.storage.from(RND_BUCKET).remove(validPaths);

    if (error) {
      console.error('[delete-rnd-storage] Storage remove error:', error.message, error);
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to delete storage objects' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, deleted: validPaths.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error in delete-rnd-storage:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
