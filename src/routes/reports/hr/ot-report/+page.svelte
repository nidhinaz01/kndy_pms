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
  import { loadOtReport, loadOtReportStages, type OtReportRow } from './services/otReportService';
  import { exportOtReportExcel } from './utils/exportOtReportExcel';
  import { reportRowMatchesSearch } from '$lib/utils/reportTableSearch';

  let menus: any[] = [];
  let showSidebar = false;

  let fromDate = firstDayOfMonthIso();
  let toDate = todayIsoLocal();
  let selectedStage = '';
  let stageOptions: string[] = [];
  let rows: OtReportRow[] = [];
  let loading = false;
  let errorMessage = '';
  let lastRunSucceeded = false;
  let tableSearch = '';
  let activeTab: 'consolidated' | 'details' = 'consolidated';

  onMount(async () => {
    try {
      const { getCurrentUsername } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      menus = await fetchUserMenus(username);
      stageOptions = await loadOtReportStages();
    } catch (e) {
      console.error('Failed to load menus:', e);
    }
  });

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  async function generateReport() {
    errorMessage = '';
    tableSearch = '';
    rows = [];
    lastRunSucceeded = false;
    activeTab = 'consolidated';
    if (!selectedStage) {
      const msg = 'Stage has to be selected.';
      errorMessage = msg;
      alert(msg);
      return;
    }
    const v = validateReportDateRange(fromDate, toDate);
    if (!v.ok) {
      errorMessage = v.error || 'Invalid dates.';
      return;
    }
    loading = true;
    try {
      rows = await loadOtReport(v.fromDate!, v.toDate!, selectedStage);
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
      exportOtReportExcel(rows, v.fromDate!, v.toDate!, selectedStage);
    } catch (e) {
      console.error(e);
      alert('Export failed. Please try again.');
    }
  }

  function formatOtHours(mins: number | null): string {
    if (mins == null || !Number.isFinite(mins)) return '0 Hr 0 Min';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h} Hr ${m} Min`;
  }

  $: filteredRows = rows.filter((r) => reportRowMatchesSearch(tableSearch, r));
  $: totalOtMinutes = filteredRows.reduce((sum, r) => sum + (Number.isFinite(Number(r.overtimeMinutes)) ? Number(r.overtimeMinutes) : 0), 0);
  $: totalOtValue = filteredRows.reduce((sum, r) => sum + (Number.isFinite(Number(r.overtimeAmount)) ? Number(r.overtimeAmount) : 0), 0);

  function toIsoDateOnly(value: string | null | undefined): string | null {
    if (!value) return null;
    return String(value).split('T')[0] || null;
  }

  function enumerateDates(startIso: string, endIso: string): string[] {
    const [sy, sm, sd] = startIso.split('-').map(Number);
    const [ey, em, ed] = endIso.split('-').map(Number);
    if (!sy || !sm || !sd || !ey || !em || !ed) return [];
    const out: string[] = [];
    let d = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    while (d <= end) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      out.push(`${y}-${m}-${day}`);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    return out;
  }

  function workCodeClass(code: string | null | undefined): 'pr' | 'nonpr' {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return 'nonpr';
    if (normalized.startsWith('C') || normalized.startsWith('M') || normalized.startsWith('P')) return 'pr';
    return 'nonpr';
  }

  type ConsolidatedCell = { prMinutes: number; prValue: number; nonPrMinutes: number; nonPrValue: number };
  type ConsolidatedRow = { key: string; employeeName: string; byDate: Record<string, ConsolidatedCell> };
  $: consolidatedDates = enumerateDates(fromDate, toDate);
  $: consolidatedRows = (() => {
    const byEmp = new Map<string, ConsolidatedRow>();
    for (const r of rows) {
      const employeeCode = (r.workerId || '').trim();
      const employeeName = (r.workerName || '').trim();
      if (!employeeName) continue;
      const key = `${employeeCode}__${employeeName}`;
      if (!byEmp.has(key)) {
        const byDate: Record<string, ConsolidatedCell> = {};
        for (const d of consolidatedDates) {
          byDate[d] = { prMinutes: 0, prValue: 0, nonPrMinutes: 0, nonPrValue: 0 };
        }
        byEmp.set(key, { key, employeeName, byDate });
      }
      const dateKey = toIsoDateOnly(r.reportFromDate);
      if (!dateKey || !consolidatedDates.includes(dateKey)) continue;
      const rowRef = byEmp.get(key)!;
      const cell = rowRef.byDate[dateKey] ?? { prMinutes: 0, prValue: 0, nonPrMinutes: 0, nonPrValue: 0 };
      const mins = Number.isFinite(Number(r.overtimeMinutes)) ? Number(r.overtimeMinutes) : 0;
      const value = Number.isFinite(Number(r.overtimeAmount)) ? Number(r.overtimeAmount) : 0;
      if (workCodeClass(r.workCode) === 'pr') {
        cell.prMinutes += mins;
        cell.prValue += value;
      } else {
        cell.nonPrMinutes += mins;
        cell.nonPrValue += value;
      }
      rowRef.byDate[dateKey] = cell;
    }
    return [...byEmp.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  })();
  $: consolidatedEmployeeTotals = consolidatedRows.map((r) => {
    let prMinutes = 0;
    let prValue = 0;
    let nonPrMinutes = 0;
    let nonPrValue = 0;
    for (const d of consolidatedDates) {
      const cell = r.byDate[d];
      prMinutes += cell?.prMinutes ?? 0;
      prValue += cell?.prValue ?? 0;
      nonPrMinutes += cell?.nonPrMinutes ?? 0;
      nonPrValue += cell?.nonPrValue ?? 0;
    }
    return { key: r.key, prMinutes, prValue, nonPrMinutes, nonPrValue };
  });
  $: consolidatedDayTotals = (() => {
    const byDate: Record<string, ConsolidatedCell> = {};
    for (const d of consolidatedDates) {
      byDate[d] = { prMinutes: 0, prValue: 0, nonPrMinutes: 0, nonPrValue: 0 };
    }
    for (const r of consolidatedRows) {
      for (const d of consolidatedDates) {
        const src = r.byDate[d];
        if (!src) continue;
        byDate[d].prMinutes += src.prMinutes;
        byDate[d].prValue += src.prValue;
        byDate[d].nonPrMinutes += src.nonPrMinutes;
        byDate[d].nonPrValue += src.nonPrValue;
      }
    }
    return byDate;
  })();
  $: consolidatedGrandTotals = (() => {
    let prMinutes = 0;
    let prValue = 0;
    let nonPrMinutes = 0;
    let nonPrValue = 0;
    for (const d of consolidatedDates) {
      const cell = consolidatedDayTotals[d];
      prMinutes += cell?.prMinutes ?? 0;
      prValue += cell?.prValue ?? 0;
      nonPrMinutes += cell?.nonPrMinutes ?? 0;
      nonPrValue += cell?.nonPrValue ?? 0;
    }
    return { prMinutes, prValue, nonPrMinutes, nonPrValue };
  })();
</script>

<svelte:head>
  <title>PMS - Overtime Report</title>
</svelte:head>

<div class="flex min-h-screen flex-col theme-bg-secondary transition-colors duration-200">
  <div class="theme-bg-primary border-b theme-border">
    <div class="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
      <div class="flex min-w-0 items-center gap-3">
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
      <div class="flex flex-wrap items-end justify-end gap-3">
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>Stage</span>
          <select
            bind:value={selectedStage}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">--Select Stage--</option>
            <option value="All">All</option>
            {#each stageOptions as stage}
              <option value={stage}>{stage}</option>
            {/each}
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>From date</span>
          <input
            type="date"
            bind:value={fromDate}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm theme-text-secondary">
          <span>To date</span>
          <input
            type="date"
            bind:value={toDate}
            class="rounded-md border theme-border bg-white px-2 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
        <Button variant="primary" size="sm" on:click={generateReport} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Report'}
        </Button>
        <Button variant="secondary" size="sm" on:click={exportExcel} disabled={rows.length === 0}>
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
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <h2 class="text-base font-semibold theme-text-primary">
            Results ({rows.length} row{rows.length === 1 ? '' : 's'})
          </h2>
          <div class="inline-flex rounded-md border theme-border overflow-hidden text-sm">
            <button
              type="button"
              class="px-3 py-1.5"
              class:theme-bg-tertiary={activeTab === 'consolidated'}
              class:theme-text-primary={activeTab === 'consolidated'}
              class:theme-text-secondary={activeTab !== 'consolidated'}
              on:click={() => (activeTab = 'consolidated')}
            >
              Consolidated
            </button>
            <button
              type="button"
              class="px-3 py-1.5 border-l theme-border"
              class:theme-bg-tertiary={activeTab === 'details'}
              class:theme-text-primary={activeTab === 'details'}
              class:theme-text-secondary={activeTab !== 'details'}
              on:click={() => (activeTab = 'details')}
            >
              Details
            </button>
          </div>
        </div>
        {#if activeTab === 'consolidated'}
          <div class="min-w-0 overflow-x-auto rounded-md border theme-border [-webkit-overflow-scrolling:touch]" role="region" aria-label="Consolidated overtime report table">
            <table class="w-max border-separate border-spacing-0 text-xs">
              <thead>
                <tr class="theme-text-secondary border-b theme-border">
                  <th rowspan="2" class="theme-bg-primary sticky left-0 z-10 border-r theme-border px-2 py-2 text-left font-medium whitespace-nowrap">Employee Name</th>
                  {#each consolidatedDates as d}
                    <th colspan="4" class="border-l theme-border px-2 py-2 text-center font-medium whitespace-nowrap">{formatDdMmmYyyy(d) || d}</th>
                  {/each}
                  <th colspan="4" class="border-l theme-border px-2 py-2 text-center font-medium whitespace-nowrap">Total</th>
                </tr>
                <tr class="theme-text-secondary border-b theme-border">
                  {#each consolidatedDates as _}
                    <th class="border-l theme-border px-2 py-2 text-center font-medium whitespace-nowrap">PR OT Time</th>
                    <th class="px-2 py-2 text-right font-medium whitespace-nowrap">PR OT Value</th>
                    <th class="px-2 py-2 text-center font-medium whitespace-nowrap">Non PR OT Time</th>
                    <th class="px-2 py-2 text-right font-medium whitespace-nowrap">Non PR OT Value</th>
                  {/each}
                  <th class="border-l theme-border px-2 py-2 text-center font-medium whitespace-nowrap">PR OT Time</th>
                  <th class="px-2 py-2 text-right font-medium whitespace-nowrap">PR OT Value</th>
                  <th class="px-2 py-2 text-center font-medium whitespace-nowrap">Non PR OT Time</th>
                  <th class="px-2 py-2 text-right font-medium whitespace-nowrap">Non PR OT Value</th>
                </tr>
              </thead>
              <tbody class="theme-text-primary">
                {#each consolidatedRows as r, idx}
                  <tr class="theme-border border-b align-top">
                    <td class="theme-bg-primary sticky left-0 z-10 border-r theme-border px-2 py-2 whitespace-nowrap">{r.employeeName}</td>
                    {#each consolidatedDates as d}
                      {@const cell = r.byDate[d]}
                      <td class="border-l theme-border px-2 py-2 whitespace-nowrap tabular-nums">{formatOtHours(cell?.prMinutes ?? 0)}</td>
                      <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right">{(cell?.prValue ?? 0).toFixed(2)}</td>
                      <td class="px-2 py-2 whitespace-nowrap tabular-nums">{formatOtHours(cell?.nonPrMinutes ?? 0)}</td>
                      <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right">{(cell?.nonPrValue ?? 0).toFixed(2)}</td>
                    {/each}
                    <td class="border-l theme-border px-2 py-2 whitespace-nowrap tabular-nums font-semibold">{formatOtHours(consolidatedEmployeeTotals[idx]?.prMinutes ?? 0)}</td>
                    <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right font-semibold">{(consolidatedEmployeeTotals[idx]?.prValue ?? 0).toFixed(2)}</td>
                    <td class="px-2 py-2 whitespace-nowrap tabular-nums font-semibold">{formatOtHours(consolidatedEmployeeTotals[idx]?.nonPrMinutes ?? 0)}</td>
                    <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right font-semibold">{(consolidatedEmployeeTotals[idx]?.nonPrValue ?? 0).toFixed(2)}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr class="theme-text-primary font-semibold border-t theme-border">
                  <td class="theme-bg-primary sticky left-0 z-10 border-r theme-border px-2 py-2 whitespace-nowrap">Total</td>
                  {#each consolidatedDates as d}
                    {@const dayTotal = consolidatedDayTotals[d]}
                    <td class="border-l theme-border px-2 py-2 whitespace-nowrap tabular-nums">{formatOtHours(dayTotal?.prMinutes ?? 0)}</td>
                    <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right">{(dayTotal?.prValue ?? 0).toFixed(2)}</td>
                    <td class="px-2 py-2 whitespace-nowrap tabular-nums">{formatOtHours(dayTotal?.nonPrMinutes ?? 0)}</td>
                    <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right">{(dayTotal?.nonPrValue ?? 0).toFixed(2)}</td>
                  {/each}
                  <td class="border-l theme-border px-2 py-2 whitespace-nowrap tabular-nums">{formatOtHours(consolidatedGrandTotals.prMinutes)}</td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right">{consolidatedGrandTotals.prValue.toFixed(2)}</td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums">{formatOtHours(consolidatedGrandTotals.nonPrMinutes)}</td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right">{consolidatedGrandTotals.nonPrValue.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        {:else}
          <label class="mb-3 flex w-full min-w-0 flex-col gap-1 text-sm theme-text-secondary sm:max-w-md sm:flex-1">
            <span>Search table</span>
            <input
              type="search"
              bind:value={tableSearch}
              placeholder="Filter by any column…"
              autocomplete="off"
              class="rounded-md border theme-border bg-white px-3 py-1.5 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          {#if filteredRows.length === 0 && tableSearch.trim()}
            <p class="theme-text-secondary mb-3 text-sm">No rows match your search. Clear the box to show all rows.</p>
          {/if}
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
                  <th class="px-2 py-2 font-medium whitespace-nowrap">From Date</th>
                  <th class="px-2 py-2 font-medium whitespace-nowrap">From Time</th>
                  <th class="px-2 py-2 font-medium whitespace-nowrap">To Date</th>
                  <th class="px-2 py-2 font-medium whitespace-nowrap">To Time</th>
                  <th class="px-2 py-2 font-medium whitespace-nowrap">OT</th>
                  <th class="px-2 py-2 font-medium whitespace-nowrap text-right">OT amount</th>
                </tr>
              </thead>
              <tbody class="theme-text-primary">
                {#each filteredRows as r}
                  <tr class="theme-border border-b align-top">
                    <td class="theme-bg-primary sticky left-0 z-10 px-2 py-2 font-medium whitespace-nowrap font-mono">{r.shiftCode ?? '—'}</td>
                    <td class="px-2 py-2 whitespace-nowrap font-mono">{r.stageCode ?? '—'}</td>
                    <td class="px-2 py-2 whitespace-nowrap">{r.woNo ?? '—'}</td>
                    <td class="px-2 py-2 whitespace-nowrap font-mono">{r.workCode ?? '—'}</td>
                    <td class="px-2 py-2 max-w-[14rem] break-words">{r.workNameDetails ?? '—'}</td>
                    <td class="px-2 py-2 whitespace-nowrap">{r.workerName ?? '—'}</td>
                    <td class="px-2 py-2 whitespace-nowrap">{formatDdMmmYyyy(r.reportFromDate) || '—'}</td>
                    <td class="px-2 py-2 whitespace-nowrap">{r.reportFromTime || '—'}</td>
                    <td class="px-2 py-2 whitespace-nowrap">{formatDdMmmYyyy(r.reportToDate) || '—'}</td>
                    <td class="px-2 py-2 whitespace-nowrap">{r.reportToTime || '—'}</td>
                    <td class="px-2 py-2 whitespace-nowrap tabular-nums">{formatOtHours(r.overtimeMinutes)}</td>
                    <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right">{r.overtimeAmount != null ? Number(r.overtimeAmount).toFixed(2) : '0.00'}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr class="theme-text-primary font-semibold">
                  <td class="theme-bg-primary sticky left-0 z-10 px-2 py-2">Total</td>
                  <td colspan="9" class="px-2 py-2"></td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums">{formatOtHours(totalOtMinutes)}</td>
                  <td class="px-2 py-2 whitespace-nowrap tabular-nums text-right">{totalOtValue.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        {/if}
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
      <div class="fixed left-0 top-0 z-50 h-full w-64 shadow-lg theme-bg-primary">
        <Sidebar {menus} />
      </div>
    </div>
  {/if}
</div>
