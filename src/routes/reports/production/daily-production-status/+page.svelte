<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import {
    loadDailyProductionStatusReport,
    formatDdMmmYyyy,
    type DailyProductionStatusReport
  } from './services/dailyProductionStatusService';
  import { exportDailyProductionStatusExcel } from './utils/exportDailyProductionStatusExcel';

  let menus: any[] = [];
  let showSidebar = false;

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  let selectedDate = new Date().toISOString().split('T')[0];
  let report: DailyProductionStatusReport | null = null;
  let loading = false;
  let errorMessage = '';

  onMount(async () => {
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      menus = await fetchUserMenus(username);
    } catch (e) {
      console.error('Failed to load menus:', e);
    }
  });

  async function generateReport() {
    errorMessage = '';
    report = null;
    loading = true;
    try {
      report = await loadDailyProductionStatusReport(selectedDate);
    } catch (e) {
      console.error(e);
      errorMessage = e instanceof Error ? e.message : 'Failed to generate report.';
    } finally {
      loading = false;
    }
  }

  function exportExcel() {
    if (!report) return;
    try {
      exportDailyProductionStatusExcel(report);
    } catch (e) {
      console.error(e);
      alert('Export failed. Please try again.');
    }
  }

  const WO_PER_LINE = 2;

  /** Groups WO strings so at most `WO_PER_LINE` appear on one line (comma-separated). */
  function woLines(wos: string[]): string[][] {
    const lines: string[][] = [];
    for (let i = 0; i < wos.length; i += WO_PER_LINE) {
      lines.push(wos.slice(i, i + WO_PER_LINE));
    }
    return lines;
  }
</script>

<svelte:head>
  <title>Daily Production Status</title>
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
          <h1 class="text-xl font-semibold theme-text-primary">Daily Production Status</h1>
          <p class="text-sm theme-text-secondary">
            Month to date (1st of month through selected date)
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>As of date</span>
          <input
            type="date"
            bind:value={selectedDate}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
        <Button variant="primary" size="sm" on:click={generateReport} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Report'}
        </Button>
        <Button variant="secondary" size="sm" on:click={exportExcel} disabled={!report}>
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

      {#if !report && !loading && !errorMessage}
        <p class="theme-text-secondary text-sm">
          Choose a date and click <strong>Generate Report</strong>. Working days are calendar days in the period that are
          not active holidays in <code class="text-xs">plan_holidays</code> (weekends count unless listed as holidays).
          Daily entry target comes from the
          production plan (<code class="text-xs">plan_prod_plan_per_shift.ppd_count</code>) whose period covers the
          selected date (active plan if any; otherwise an inactive plan that still includes that date).
        </p>
      {/if}

      {#if report}
        <section class="mb-8 rounded-lg border theme-border theme-bg-primary p-4 shadow-sm">
          <h2 class="mb-3 text-base font-semibold theme-text-primary">Summary (month to date)</h2>
          <dl class="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="theme-text-secondary">Period</dt>
              <dd class="font-medium theme-text-primary">
                {formatDdMmmYyyy(report.periodStart)} → {formatDdMmmYyyy(report.asOfDate)}
              </dd>
            </div>
            <div>
              <dt class="theme-text-secondary">Working days completed</dt>
              <dd class="font-medium theme-text-primary">{report.workingDaysCompleted}</dd>
            </div>
            <div>
              <dt class="theme-text-secondary">Daily entry target</dt>
              <dd class="font-medium theme-text-primary">
                {report.dailyEntryTarget != null ? report.dailyEntryTarget : '— (no plan covers this date)'}
              </dd>
            </div>
            <div>
              <dt class="theme-text-secondary">Target (daily × working days)</dt>
              <dd class="font-medium theme-text-primary">
                {report.periodTarget != null ? report.periodTarget : '—'}
              </dd>
            </div>
          </dl>

          <h3 class="mb-2 mt-6 text-sm font-semibold theme-text-primary">Plants</h3>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[320px] border-collapse text-sm">
              <thead>
                <tr class="border-b theme-border theme-text-secondary">
                  <th class="py-2 text-left font-medium">Plant</th>
                  <th class="py-2 text-left font-medium">Entry stage</th>
                  <th class="py-2 text-left font-medium">Exit stage</th>
                  <th class="py-2 text-right font-medium">Entered</th>
                  <th class="py-2 text-right font-medium">Exited</th>
                </tr>
              </thead>
              <tbody>
                {#each report.plantMatrix as row}
                  <tr class="border-b theme-border theme-text-primary">
                    <td class="py-2">{row.plantLabel}</td>
                    <td class="py-2 font-mono text-xs">{row.entryStageCode}</td>
                    <td class="py-2 font-mono text-xs">{row.exitStageCode}</td>
                    <td class="py-2 text-right tabular-nums">{row.entriesCount}</td>
                    <td class="py-2 text-right tabular-nums">{row.exitsCount}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <p class="mt-2 text-xs theme-text-secondary">
            Entered = distinct WOs with an <strong>entry</strong> at the plant’s first line stage (PnS1). Exited =
            distinct WOs with an <strong>exit</strong> at the plant’s last line stage (e.g. P1S4, P2S4); P3 uses P3S1
            for both when it is the only stage.
          </p>
        </section>

        <section class="min-w-0 rounded-lg border theme-border theme-bg-primary p-4 shadow-sm">
          <h2 class="mb-3 text-base font-semibold theme-text-primary">By stage (month to date)</h2>
          <p class="mb-4 text-xs theme-text-secondary">
            Stages come from <code class="text-xs">sys_data_elements</code> (<code class="text-xs">Plant-Stage</code>).
            Entry and exit counts and WO numbers from <code class="text-xs">prdn_dates</code> by calendar day; missing
            activity shows 0 and —.
          </p>
          {#if report.stageBreakdownByDate.length === 0}
            <p class="text-sm theme-text-secondary">
              No stages are configured under Plant-Stage in system data, and there are no movements in this period.
            </p>
          {:else}
            <p class="mb-2 text-xs theme-text-secondary">
              Scroll horizontally to see more dates; the Stage column stays fixed while you scroll. Up to two WO
              numbers per line in each cell.
            </p>
            <div
              class="min-w-0 overflow-x-auto overflow-y-visible rounded-md border theme-border [-webkit-overflow-scrolling:touch]"
              role="region"
              aria-label="By stage table, scroll horizontally for more dates"
            >
              <table class="w-max border-separate border-spacing-0 text-xs">
                <thead>
                  <tr class="border-b theme-border theme-text-secondary">
                    <th
                      rowspan="3"
                      class="sticky left-0 z-20 border-r theme-border bg-inherit px-2 py-2 text-left align-middle font-medium shadow-[2px_0_6px_-3px_rgba(0,0,0,0.25)] theme-bg-primary"
                    >
                      Stage
                    </th>
                    {#each report.datesInPeriod as d}
                      <th colspan="4" class="border-l theme-border px-1 py-2 text-center font-medium">
                        {formatDdMmmYyyy(d)}
                      </th>
                    {/each}
                  </tr>
                  <tr class="border-b theme-border theme-text-secondary">
                    {#each report.datesInPeriod as _}
                      <th colspan="2" class="border-l theme-border px-1 py-1 text-center font-medium">Entry</th>
                      <th colspan="2" class="px-1 py-1 text-center font-medium">Exit</th>
                    {/each}
                  </tr>
                  <tr class="border-b theme-border theme-text-secondary">
                    {#each report.datesInPeriod as _}
                      <th class="border-l theme-border px-1 py-1 text-center font-normal">Count</th>
                      <th class="px-1 py-1 text-center font-normal">WO Nos.</th>
                      <th class="px-1 py-1 text-center font-normal">Count</th>
                      <th class="px-1 py-1 text-center font-normal">WO Nos.</th>
                    {/each}
                  </tr>
                </thead>
                <tbody class="theme-text-primary">
                  {#each report.stageBreakdownByDate as s}
                    <tr class="border-b theme-border align-top">
                      <td
                        class="sticky left-0 z-20 whitespace-nowrap border-r theme-border bg-inherit px-2 py-2 font-mono shadow-[2px_0_6px_-3px_rgba(0,0,0,0.2)] theme-bg-primary"
                      >
                        {s.stageCode}
                      </td>
                      {#each s.byDay as day}
                        <td class="border-l theme-border px-1 py-2 text-right tabular-nums">{day.entryCount}</td>
                        <td class="min-w-[9rem] max-w-[11rem] align-top px-1 py-2 leading-snug">
                          {#if day.entryWoNumbers.length === 0}
                            —
                          {:else}
                            <div class="flex flex-col gap-0.5">
                              {#each woLines(day.entryWoNumbers) as pair}
                                <span class="break-words">{pair.join(', ')}</span>
                              {/each}
                            </div>
                          {/if}
                        </td>
                        <td class="px-1 py-2 text-right tabular-nums">{day.exitCount}</td>
                        <td class="min-w-[9rem] max-w-[11rem] align-top px-1 py-2 leading-snug">
                          {#if day.exitWoNumbers.length === 0}
                            —
                          {:else}
                            <div class="flex flex-col gap-0.5">
                              {#each woLines(day.exitWoNumbers) as pair}
                                <span class="break-words">{pair.join(', ')}</span>
                              {/each}
                            </div>
                          {/if}
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
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
      <div class="fixed left-0 top-0 z-50 h-full w-64 shadow-lg theme-bg-primary">
        <Sidebar {menus} />
      </div>
    </div>
  {/if}
</div>
