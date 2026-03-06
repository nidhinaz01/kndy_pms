import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  try {
    const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (import.meta.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY || null;
    const hasKey = !!envKey;
    const preview = envKey ? `${envKey.slice(0, 6)}...${envKey.slice(-4)}` : null;

    return new Response(JSON.stringify({
      ok: true,
      hasKey,
      keyPreview: preview
    }), { status: 200 });
  } catch (err) {
    console.error('Debug endpoint error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'internal' }), { status: 500 });
  }
};

