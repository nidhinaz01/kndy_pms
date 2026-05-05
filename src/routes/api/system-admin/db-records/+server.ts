import type { RequestHandler } from '@sveltejs/kit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as privateEnv } from '$env/dynamic/private';
import dotenv from 'dotenv';

dotenv.config();

type ServiceRoleClient = SupabaseClient;

type AllowedTable = 'prdn_work_planning' | 'prdn_work_reporting';
type TableConfig = { pk: string; pkType: 'number' | 'string' };

const TABLE_CONFIG: Record<AllowedTable, TableConfig> = {
	prdn_work_planning: { pk: 'id', pkType: 'number' },
	prdn_work_reporting: { pk: 'id', pkType: 'number' }
};

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

function asAllowedTable(value: unknown): AllowedTable | null {
	if (value === 'prdn_work_planning' || value === 'prdn_work_reporting') return value;
	return null;
}

function parsePk(raw: unknown, pkType: 'number' | 'string'): number | string | null {
	const value = String(raw ?? '').trim();
	if (!value) return null;
	if (pkType === 'string') return value;
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return n;
}

async function requireAdmin(supabaseAdmin: ServiceRoleClient, token: string): Promise<string> {
	const { data: userResult, error: getUserError } = await supabaseAdmin.auth.getUser(token);
	if (getUserError || !userResult?.user) throw new Error('Invalid session token');

	const callerUid = userResult.user.id;
	const { data: appUsers, error: appUserError } = await supabaseAdmin
		.from('app_users')
		.select('role, auth_user_id')
		.eq('auth_user_id', callerUid)
		.limit(1);
	if (appUserError) throw new Error('Failed to verify admin');

	const callerRecord = Array.isArray(appUsers) && appUsers.length > 0 ? appUsers[0] : null;
	if (!callerRecord || String(callerRecord.role || '').toLowerCase() !== 'admin') {
		throw new Error('Forbidden');
	}
	return callerUid;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const supabaseAdmin = getSupabaseAdmin();
		if (!supabaseAdmin) {
			return new Response(JSON.stringify({ error: 'Server misconfiguration: Supabase admin client unavailable' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const authHeader = request.headers.get('authorization') || '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!token) {
			return new Response(JSON.stringify({ error: 'Missing Authorization token' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		try {
			await requireAdmin(supabaseAdmin, token);
		} catch (e) {
			const msg = (e as Error)?.message || 'Unauthorized';
			const status = msg === 'Invalid session token' ? 401 : msg === 'Forbidden' ? 403 : 500;
			return new Response(JSON.stringify({ error: msg }), {
				status,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		let body: { action?: 'preview' | 'delete'; table?: string; pkValue?: string | number };
		try {
			body = await request.json();
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const action = body?.action;
		const table = asAllowedTable(body?.table);
		if (!action || (action !== 'preview' && action !== 'delete')) {
			return new Response(JSON.stringify({ error: 'Unknown action' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		if (!table) {
			return new Response(JSON.stringify({ error: 'Unsupported table' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const config = TABLE_CONFIG[table];
		const pk = parsePk(body?.pkValue, config.pkType);
		if (pk === null) {
			return new Response(JSON.stringify({ error: `Invalid primary key value for ${table}.${config.pk}` }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (action === 'preview') {
			const { data, error } = await supabaseAdmin.from(table).select('*').eq(config.pk, pk).limit(50);
			if (error) {
				return new Response(JSON.stringify({ error: error.message || 'Failed to load records' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			return new Response(
				JSON.stringify({
					success: true,
					table,
					pkColumn: config.pk,
					rows: data || []
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const { data: deletedRows, error: deleteError } = await supabaseAdmin
			.from(table)
			.delete()
			.eq(config.pk, pk)
			.select(config.pk);
		if (deleteError) {
			return new Response(JSON.stringify({ error: deleteError.message || 'Delete failed' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response(
			JSON.stringify({
				success: true,
				table,
				pkColumn: config.pk,
				deletedCount: (deletedRows || []).length
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Internal server error';
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
