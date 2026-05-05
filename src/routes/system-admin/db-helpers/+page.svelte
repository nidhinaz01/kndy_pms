<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { supabase } from '$lib/supabaseClient';
	import AppHeader from '$lib/components/common/AppHeader.svelte';
	import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
	import Sidebar from '$lib/components/navigation/Sidebar.svelte';
	import { fetchUserMenus } from '$lib/services/menuService';
	import Button from '$lib/components/common/Button.svelte';
	import DuplicateAttendanceModal from './components/DuplicateAttendanceModal.svelte';
	import DuplicateDraftWorkModal from './components/DuplicateDraftWorkModal.svelte';
	import DeleteRecordsModal from './components/DeleteRecordsModal.svelte';

	let showSidebar = false;
	let menus: unknown[] = [];

	let pieceRateRunning = false;
	let pieceRateMessage = '';
	let pieceRateMessageType: 'success' | 'error' | '' = '';
	let pieceRateLastResult: unknown = null;

	let showDuplicateAttendanceModal = false;
	let showDuplicateDraftWorkModal = false;
	let showDeleteRecordsModal = false;

	function assertAdminClient(): boolean {
		try {
			const savedUserStr = localStorage.getItem('user');
			if (!savedUserStr) return false;
			const savedUser = JSON.parse(savedUserStr);
			const role = savedUser?.role;
			return typeof role === 'string' && role.toLowerCase() === 'admin';
		} catch {
			return false;
		}
	}

	onMount(async () => {
		if (!assertAdminClient()) {
			goto(resolve('/dashboard'));
			return;
		}
		try {
			const username = localStorage.getItem('username');
			if (username) {
				menus = await fetchUserMenus(username);
			}
		} catch (e) {
			console.error('db-helpers: menus load failed', e);
		}
	});

	function handleSidebarToggle() {
		showSidebar = !showSidebar;
	}

	function showPieceRateMessage(text: string, type: 'success' | 'error') {
		pieceRateMessage = text;
		pieceRateMessageType = type;
		setTimeout(() => {
			pieceRateMessage = '';
			pieceRateMessageType = '';
		}, 8000);
	}

	async function runCalculatePieceRates() {
		if (pieceRateRunning) return;
		if (!assertAdminClient()) {
			goto(resolve('/dashboard'));
			return;
		}

		pieceRateRunning = true;
		pieceRateMessage = '';
		pieceRateLastResult = null;

		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			const accessToken = session?.access_token;
			if (!accessToken) {
				showPieceRateMessage('No active session. Sign in again.', 'error');
				return;
			}

			const res = await fetch('/api/system-admin/db-job', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({ job: 'calculate_piece_rates' })
			});

			const payload = await res.json().catch(() => ({}));
			if (!res.ok) {
				showPieceRateMessage(payload?.error || `Request failed (${res.status})`, 'error');
				return;
			}
			pieceRateLastResult = payload?.result ?? null;
			showPieceRateMessage('Piece rate batch completed successfully.', 'success');
		} catch (e) {
			console.error(e);
			showPieceRateMessage((e as Error)?.message || 'Request failed', 'error');
		} finally {
			pieceRateRunning = false;
		}
	}
</script>

<svelte:head>
	<title>PMS - Database Helpers</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
	<div class="fixed inset-0 z-50">
		<button
			type="button"
			aria-label="Close sidebar overlay"
			class="fixed inset-0 bg-black bg-opacity-40 z-40"
			on:click={handleSidebarToggle}
			tabindex="0"
			on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSidebarToggle()}
			style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0; background-color: rgba(0,0,0,0.4);"
		></button>
		<div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
			<Sidebar {menus} />
		</div>
	</div>
{/if}

<div class="flex flex-col h-full w-full theme-bg-secondary transition-colors duration-200" style="min-height: 100vh;">
	<AppHeader title="Database helpers" onSidebarToggle={handleSidebarToggle} />
	<FloatingThemeToggle />

	{#if pieceRateMessage}
		<div
			class={`mx-4 md:mx-6 lg:mx-8 mt-4 p-4 rounded-lg text-sm ${
				pieceRateMessageType === 'success'
					? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
					: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
			}`}
			role="status"
		>
			{pieceRateMessage}
		</div>
	{/if}

	<div class="flex-1 w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
			<section class="theme-bg-primary border theme-border rounded-lg p-6 shadow-lg flex flex-col">
				<h2 class="text-lg font-medium theme-text-primary mb-2">Remove duplicate attendance</h2>
				<p class="text-sm theme-text-secondary mb-4 flex-1">
					Find employees with more than one planning or reporting manpower row on the same calendar day (overlapping
					from–to range). Delete the wrong row with hard delete, subject to submission status rules. Use after load;
					duplicates in Plan and Report are listed in separate tabs.
				</p>
				<Button
					variant="primary"
					size="md"
					class="self-start"
					on:click={() => (showDuplicateAttendanceModal = true)}
				>
					Open duplicate attendance tool
				</Button>
			</section>

			<section class="theme-bg-primary border theme-border rounded-lg p-6 shadow-lg flex flex-col">
				<h2 class="text-lg font-medium theme-text-primary mb-2">Calculate piece rate</h2>
				<p class="text-sm theme-text-secondary mb-4">
					Runs <code class="text-xs rounded px-1 py-0.5 theme-bg-secondary theme-border border"
						>public.calculate_piece_rates()</code
					>
					— the same routine as the nightly pg_cron job (<span class="whitespace-nowrap">00:00</span>). Processes approved reports
					with <code class="text-xs">pr_calculated_dt IS NULL</code> per your deployed procedure.
				</p>
				<p class="text-xs theme-text-secondary mb-4">
					Wait for the current run to finish before clicking again. Heavy batches should not be started twice in parallel.
				</p>
				<Button
					variant="primary"
					size="md"
					class="self-start"
					disabled={pieceRateRunning}
					on:click={runCalculatePieceRates}
				>
					{pieceRateRunning ? 'Running…' : 'Calculate Piece Rate'}
				</Button>

				{#if pieceRateLastResult !== null}
					<div class="mt-4">
						<p class="text-xs font-medium theme-text-secondary mb-1">Last result (JSON)</p>
						<pre
							class="text-xs overflow-x-auto max-h-64 overflow-y-auto p-3 rounded border theme-border theme-bg-secondary theme-text-primary font-mono"
						>{JSON.stringify(pieceRateLastResult, null, 2)}</pre>
					</div>
				{/if}
			</section>

			<section class="theme-bg-primary border theme-border rounded-lg p-6 shadow-lg flex flex-col">
				<h2 class="text-lg font-medium theme-text-primary mb-2">Remove duplicate draft work</h2>
				<p class="text-sm theme-text-secondary mb-4 flex-1">
					Find duplicate <strong>draft</strong> rows in <code class="text-xs">prdn_work_planning</code> (same WO, work code,
					date, stage, shift) and <code class="text-xs">prdn_work_reporting</code> (same planning line + worker). Same
					submission and delete rules as duplicate attendance. Pick a date, then use Draft plan / Draft report tabs.
				</p>
				<Button
					variant="primary"
					size="md"
					class="self-start"
					on:click={() => (showDuplicateDraftWorkModal = true)}
				>
					Open duplicate draft work tool
				</Button>
			</section>

			<section class="theme-bg-primary border theme-border rounded-lg p-6 shadow-lg opacity-90 flex flex-col">
				<h2 class="text-lg font-medium theme-text-primary mb-2">Delete records</h2>
				<p class="text-sm theme-text-secondary mb-4 flex-1">
					Hard delete a single row by table + primary key lookup. Supports
					<code class="text-xs">prdn_work_planning</code> and <code class="text-xs">prdn_work_reporting</code>.
					Load records, select one, then confirm with <code class="text-xs">DELETE</code>.
				</p>
				<Button
					variant="danger"
					size="md"
					class="self-start"
					on:click={() => (showDeleteRecordsModal = true)}
				>
					Open delete records tool
				</Button>
			</section>

			<section class="theme-bg-primary border theme-border rounded-lg p-6 shadow-lg opacity-90 flex flex-col">
				<h2 class="text-lg font-medium theme-text-primary mb-2">More jobs</h2>
				<p class="text-sm theme-text-secondary flex-1">
					Additional cron-aligned actions can be added here as separate buttons, each calling the same API with a different
					<code class="text-xs">job</code> id once the server handler supports them.
				</p>
			</section>
		</div>

		<DuplicateAttendanceModal
			show={showDuplicateAttendanceModal}
			onClose={() => (showDuplicateAttendanceModal = false)}
		/>
		<DuplicateDraftWorkModal
			show={showDuplicateDraftWorkModal}
			onClose={() => (showDuplicateDraftWorkModal = false)}
		/>
		<DeleteRecordsModal
			show={showDeleteRecordsModal}
			onClose={() => (showDeleteRecordsModal = false)}
		/>
	</div>
</div>
