import type { RequestHandler } from '@sveltejs/kit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as privateEnv } from '$env/dynamic/private';
import dotenv from 'dotenv';

dotenv.config();

function getSupabaseAdmin() {
	const url =
		process.env.VITE_SUPABASE_URL ??
		privateEnv.VITE_SUPABASE_URL ??
		(import.meta as any).env?.VITE_SUPABASE_URL;
	const key =
		process.env.SUPABASE_SERVICE_ROLE_KEY ??
		privateEnv.SUPABASE_SERVICE_ROLE_KEY ??
		(import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY;
	if (url && key) return createClient(url, key) as ServiceRoleClient;
	return null;
}

function misconfigurationReason(): string {
	const url =
		process.env.VITE_SUPABASE_URL ??
		privateEnv.VITE_SUPABASE_URL ??
		(import.meta as any).env?.VITE_SUPABASE_URL;
	const key =
		process.env.SUPABASE_SERVICE_ROLE_KEY ??
		privateEnv.SUPABASE_SERVICE_ROLE_KEY ??
		(import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY;
	if (!url) return 'VITE_SUPABASE_URL not set';
	if (!key)
		return 'SUPABASE_SERVICE_ROLE_KEY not set. Add SUPABASE_SERVICE_ROLE_KEY to .env in the project root and restart the dev server.';
	return 'Supabase admin client could not be created';
}

type DbJobId = 'calculate_piece_rates';

/** Service-role client: avoid `ReturnType<typeof createClient>` here — it resolves to a stricter generic than `createClient(url, key)` and fails assignability under svelte-check. */
type ServiceRoleClient = SupabaseClient;

async function runJob(
	supabaseAdmin: ServiceRoleClient,
	job: DbJobId
): Promise<{ data: unknown; errorMessage: string | null }> {
	if (job === 'calculate_piece_rates') {
		const { data, error } = await supabaseAdmin.rpc('calculate_piece_rates');
		if (error) {
			const msg =
				(error as { message?: string; details?: string; hint?: string }).message ||
				String(error);
			const details = (error as { details?: string }).details;
			const hint = (error as { hint?: string }).hint;
			const full = [msg, details, hint].filter(Boolean).join(' — ');
			return { data: null, errorMessage: full || 'RPC calculate_piece_rates failed' };
		}
		return { data, errorMessage: null };
	}
	return { data: null, errorMessage: 'Unknown job' };
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const supabaseAdmin = getSupabaseAdmin();
		if (!supabaseAdmin) {
			return new Response(
				JSON.stringify({
					error: `Server misconfiguration: ${misconfigurationReason()}`
				}),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const authHeader = request.headers.get('authorization') || '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!token) {
			return new Response(JSON.stringify({ error: 'Missing Authorization token' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
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
			.select('username, role, auth_user_id')
			.eq('auth_user_id', callerUid)
			.limit(1);

		if (appUserError) {
			console.error('Error querying app_users for db-job:', appUserError);
			return new Response(JSON.stringify({ error: 'Failed to verify admin' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		const callerRecord = Array.isArray(appUsers) && appUsers.length > 0 ? appUsers[0] : null;
		if (!callerRecord || String(callerRecord.role || '').toLowerCase() !== 'admin') {
			return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		let body: { job?: string };
		try {
			body = await request.json();
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const job = body?.job as DbJobId | undefined;
		if (job !== 'calculate_piece_rates') {
			return new Response(JSON.stringify({ error: 'Unknown or unsupported job' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const { data, errorMessage } = await runJob(supabaseAdmin, job);
		if (errorMessage) {
			console.error('db-job RPC error:', errorMessage);
			try {
				await supabaseAdmin.from('admin_audit_logs').insert([
					{
						admin_user_id: callerUid,
						target_user_id: null,
						action: 'db_job_failed',
						details: { job, error: errorMessage },
						created_at: new Date().toISOString()
					}
				]);
			} catch (auditErr) {
				console.error('admin_audit_logs insert failed:', auditErr);
			}
			return new Response(JSON.stringify({ success: false, error: errorMessage }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		try {
			await supabaseAdmin.from('admin_audit_logs').insert([
				{
					admin_user_id: callerUid,
					target_user_id: null,
					action: 'db_job_run',
					details: { job, result: data },
					created_at: new Date().toISOString()
				}
			]);
		} catch (auditErr) {
			console.error('admin_audit_logs insert failed:', auditErr);
		}

		return new Response(JSON.stringify({ success: true, result: data }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('db-job unexpected error:', err);
		const msg = err instanceof Error ? err.message : 'Internal server error';
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
