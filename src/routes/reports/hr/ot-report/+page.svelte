<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import {
    firstDayOfMonthIso,
    todayIsoLocal,
    validateReportDateRange,
    formatDdMmmYyyy
  } from '$lib/utils/reportDateRange';
  import { loadOtReport, type OtReportRow } from './services/otReportService';
  import { exportOtReportExcel } from './utils/exportOtReportExcel';

  let menus: any[] = [];
  let showSidebar = false;

  let fromDate = firstDayOfMonthIso();
  let toDate = todayIsoLocal();
  let rows: OtReportRow[] = [];
  let loading = false;
  let errorMessage = '';
  let lastRunSucceeded = false;

  onMount(async () => {
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      menus = await fetchUserMenus(username);
    } catch (e) {
      console.error('Failed to load menus:', e);
    }
  });

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  async function generateReport() {
    errorMessage = '';
    rows = [];
    lastRunSucceeded = false;
    const v = validateReportDateRange(fromDate, toDate);
    if (!v.ok) {
      errorMessage = v.error || 'Invalid dates.';
      return;
    }
    loading = true;
    try {
      rows = await loadOtReport(v.fromDate!, v.toDate!);
      lastRunSucceeded = true;
    } catch (e) {
      console.error(e);
      errorMessage = e instanceof Error ? e.message : 'Failed to generate report.';
    } finally {
      loading = false;
    }
  }

  function exportExcel() {
    if (rows.length === 0) return;
    const v = validateReportDateRange(fromDate, toDate);
    if (!v.ok) {
      errorMessage = v.error || 'Fix dates before export.';
      return;
    }
    try {
      exportOtReportExcel(rows, v.fromDate!, v.toDate!);
    } catch (e) {
      console.error(e);
      alert('Export failed. Please try again.');
    }
  }

  function formatOtHours(mins: number | null): string {
    if (mins == null || !Number.isFinite(mins)) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  }
</script>

<svelte:head>
  <title>Overtime Report</title>
</svelte:head>

<div class="flex min-h-screen flex-col theme-bg-secondary transition-colors duration-200">
  <div class="theme-bg-primary border-b theme-border">
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="rounded-lg p-2 hover:theme-bg-tertiary transition-colors"
          aria-label="Show sidebar"
          on:click={handleSidebarToggle}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h1 class="text-xl font-semibold theme-text-primary">Overtime Report</h1>
          <p class="text-sm theme-text-secondary">
            Work reports with OT minutes (window overlaps range; max ~3 months)
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>From date</span>
          <input
            type="date"
            bind:value={fromDate}
            disabled={loading}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>To date</span>
          <input
            type="date"
            bind:value={toDate}
            disabled={loading}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </label>
        <Button variant="primary" size="sm" on:click={generateReport} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Report'}
        </Button>
        <Button variant="secondary" size="sm" on:click={exportExcel} disabled={loading || rows.length === 0}>
          Export Excel
        </Button>
        <button
          type="button"
          on:click={() => goto('/dashboard')}
          class="flex shrink-0 items-center self-center hover:opacity-80 transition-opacity"
          aria-label="Go to dashboard"
        >
          <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
        </button>
      </div>
    </div>
  </div>

  <main class="mx-auto min-w-0 w-full max-w-[100rem] flex-1 px-4 py-6 sm:px-6">
    {#if errorMessage}
      <div
        class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
      >
        {errorMessage}
      </div>
    {/if}

    {#if loading}
      <p class="mb-4 text-sm font-medium theme-text-primary" role="status" aria-live="polite">Generating report…</p>
    {/if}

    {#if lastRunSucceeded && !rows.length && !loading}
      <p class="mb-4 rounded-lg border theme-border theme-bg-primary px-4 py-3 text-sm theme-text-secondary">
        No overtime rows match this range.
      </p>
    {/if}

    {#if !rows.length && !loading && !errorMessage && !lastRunSucceeded}
      <p class="theme-text-secondary mb-4 text-sm">
        Choose dates and click <strong>Generate Report</strong>. Includes work reporting rows whose from/to dates overlap
        the range and have <strong>overtime minutes &gt; 0</strong>. Only rows with a <strong>worker name</strong> are shown.
      </p>
    {/if}

    {#if rows.length > 0}
      <section class="rounded-lg border theme-border theme-bg-primary p-4 shadow-sm">
        <h2 class="mb-3 text-base font-semibold theme-text-primary">
          Results ({rows.length} row{rows.length === 1 ? '' : 's'})
        </h2>
        <div
          class="min-w-0 overflow-x-auto rounded-md border theme-border [-webkit-overflow-scrolling:touch]"
          role="region"
          aria-label="Overtime report table"
        >
          <table class="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr class="theme-text-secondary border-b theme-border text-left">
                <th class="theme-bg-primary sticky left-0 z-10 px-2 py-2 font-medium">Shift</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Stage</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">WO</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Work code</th>
                <th class="px-2 py-2 font-medium min-w-[10rem]">Work name + details</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Worker</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">Report window</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">OT</th>
                <th class="px-2 py-2 font-medium whitespace-nowrap">OT amount</th>
              </tr>
            </thead>
            <tbody class="theme-text-primary">
              {#each rows as r}
                <tr class="theme-border border-b align-top">
                  <td class="theme-bg-primary sticky left-0 z-10 px-2 py-2 font-medium whitespace-nowrap font-mono">{r.shiftCode ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap font-mono">{r.stageCode ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">{r.woNo ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap font-mono">{r.workCode ?? '—'}</td>
                  <td class="px-2 py-2 max-w-[14rem] break-words">{r.workNameDetails ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">{r.workerName ?? '—'}</td>
                  <td class="px-2 py-2 whitespace-nowrap">
                    {formatDdMmmYyyy(r.reportFromDate) || '—'} {r.reportFromTime ?? ''} → {formatDdMmmYyyy(r.reportToDate) || '—'}
                    {r.reportToTime ?? ''}
                  </td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums">{formatOtHours(r.overtimeMinutes)}</td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums">{r.overtimeAmount ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="theme-text-secondary mt-2 text-xs">
          <strong>Export Excel</strong> includes customer, skill, report status, and created-by fields.
        </p>
      </section>
    {/if}
  </main>

  <FloatingThemeToggle />

  {#if showSidebar}
    <div class="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close sidebar overlay"
        class="fixed inset-0 z-40 bg-black bg-opacity-40"
        on:click={handleSidebarToggle}
        tabindex="0"
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSidebarToggle()}
        style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0;"
      ></button>
      <div class="theme-bg-primary fixed left-0 top-0 z-50 h-full w-64 shadow-lg">
        <Sidebar {menus} />
      </div>
    </div>
  {/if}
</div>
