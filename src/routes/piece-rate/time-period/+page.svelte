<script lang="ts">
  /**
   * Piece Rate - Time Period
   *
   * Data flow: Supabase prdn_work_reporting (+ nested prdn_work_planning) -> pieceRateData -> table.
   *
   * Column mapping (each row = one element of pieceRateData, i.e. one prdn_work_reporting record):
   * - Date              -> report.from_date (formatDateLocal)
   * - Work Code         -> getWorkCode(report) -> planning.derived_sw_code || planning.other_work_code
   * - Work Name         -> getWorkName(report) -> planning.std_work_type_details?.std_work_details?.sw_name or otherWorkDescMap[planning] or planning.other_work_code
   * - Hours             -> report.hours_worked_today
   * - Piece Rate        -> report.pr_amount (set by piece rate calculation; null until calculation runs)
   * - Rate/Hour         -> report.pr_rate
   * - Std Time (min)    -> report.pr_std_time
   * - POW               -> report.pr_pow
   * - Type              -> report.pr_type ('PR' | 'SL')
   * - Overtime          -> report.overtime_amount
   * - Lost Time         -> sum of report.lt_details[].lt_value (or 0)
   * - Status            -> report.completion_status ('C' = Completed)
   *
   * Note: pr_amount, pr_rate, pr_std_time, pr_pow, pr_type are only populated when
   * pieceRateCalculationService runs (on report completion); otherwise they stay null and show as '-'.
   */
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { supabase } from '$lib/supabaseClient';
  import { formatDateLocal } from '$lib/utils/formatDate';

  let showSidebar = false;
  let menus: any[] = [];
  let isLoading = false;
  
  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }
  
  // Form state
  let selectedEmployeeId = '';
  let fromDate = '';
  let toDate = '';
  
  // Data
  let pieceRateData: any[] = [];
  let employees: any[] = [];
  let isDataLoading = false;
  /** Map key: `${wo_details_id}-${stage_code}-${other_work_code}` -> other_work_desc (from prdn_work_additions) */
  let otherWorkDescMap: Record<string, string> = {};
  
  // Validation errors
  let errors: { employee?: string; dates?: string } = {};

  const ADDITIONS_KEY_SEP = '\u001f';

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadEmployees();
  });

  const EMPLOYEES_PAGE_SIZE = 1000;

  async function loadEmployees() {
    try {
      const all: { emp_id: string; emp_name?: string; skill_short?: string }[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('hr_emp')
          .select('emp_id, emp_name, skill_short')
          .eq('is_deleted', false)
          .eq('is_active', true)
          .order('emp_name')
          .range(offset, offset + EMPLOYEES_PAGE_SIZE - 1);

        if (error) throw error;
        const page = data || [];
        all.push(...page);
        hasMore = page.length === EMPLOYEES_PAGE_SIZE;
        offset += EMPLOYEES_PAGE_SIZE;
      }
      employees = all;
    } catch (error) {
      console.error('Error loading employees:', error);
      alert('Error loading employees');
    }
  }

  function validateDates(): boolean {
    errors = {};
    
    if (!fromDate || !toDate) {
      errors.dates = 'Please select both from date and to date';
      return false;
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (to < from) {
      errors.dates = 'To date must be greater than or equal to from date';
      return false;
    }

    // Check if both dates are in the same month and year
    if (from.getFullYear() !== to.getFullYear() || from.getMonth() !== to.getMonth()) {
      errors.dates = 'Both dates must be in the same month and year';
      return false;
    }

    return true;
  }

  async function loadPieceRateData() {
    if (!selectedEmployeeId) {
      errors.employee = 'Please select an employee';
      return;
    }

    if (!validateDates()) {
      return;
    }

    isDataLoading = true;
    try {
      const { data, error } = await supabase
        .from('prdn_work_reporting')
        .select(`
          id,
          planning_id,
          worker_id,
          from_date,
          to_date,
          hours_worked_today,
          completion_status,
          pr_amount,
          pr_calculated_dt,
          pr_rate,
          pr_std_time,
          pr_pow,
          pr_type,
          overtime_minutes,
          overtime_amount,
          lt_minutes_total,
          lt_details,
          prdn_work_planning!inner(
            id,
            wo_details_id,
            stage_code,
            derived_sw_code,
            other_work_code,
            sc_required,
            std_work_type_details!left(
              std_work_details!left(
                sw_name
              )
            )
          )
        `)
        .eq('worker_id', selectedEmployeeId)
        .gte('from_date', fromDate)
        .lte('to_date', toDate)
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('from_date', { ascending: true })
        .order('from_time', { ascending: true });

      if (error) throw error;

      const reports = data || [];
      pieceRateData = reports;

      // Fetch other_work_desc from prdn_work_additions (no FK from planning to additions, so separate query)
      const keyTriplets: { wo_details_id: number; stage_code: string; other_work_code: string }[] = [];
      const seen = new Set<string>();
      for (const r of reports) {
        const p = Array.isArray(r.prdn_work_planning) ? r.prdn_work_planning[0] : r.prdn_work_planning;
        if (p?.other_work_code != null && p.wo_details_id != null && p.stage_code != null) {
          const k = `${p.wo_details_id}${ADDITIONS_KEY_SEP}${p.stage_code}${ADDITIONS_KEY_SEP}${p.other_work_code}`;
          if (!seen.has(k)) {
            seen.add(k);
            keyTriplets.push({
              wo_details_id: p.wo_details_id,
              stage_code: p.stage_code,
              other_work_code: p.other_work_code
            });
          }
        }
      }
      otherWorkDescMap = {};
      if (keyTriplets.length > 0) {
        const orParts = keyTriplets.map(
          (t) =>
            `and(wo_details_id.eq.${t.wo_details_id},stage_code.eq.${t.stage_code},other_work_code.eq.${t.other_work_code})`
        );
        const { data: additions } = await supabase
          .from('prdn_work_additions')
          .select('wo_details_id, stage_code, other_work_code, other_work_desc')
          .or(orParts.join(','));
        if (additions) {
          for (const row of additions) {
            const key = `${row.wo_details_id}${ADDITIONS_KEY_SEP}${row.stage_code}${ADDITIONS_KEY_SEP}${row.other_work_code}`;
            otherWorkDescMap[key] = row.other_work_desc ?? '';
          }
        }
      }
    } catch (error) {
      console.error('Error loading piece rate data:', error);
      alert('Error loading piece rate data');
    } finally {
      isDataLoading = false;
    }
  }

  /** Normalize planning: Supabase may return FK embed as object or as single-element array */
  function getPlanning(report: any): any {
    const p = report?.prdn_work_planning;
    return Array.isArray(p) ? p[0] : p;
  }

  function getWorkName(report: any): string {
    const planning = getPlanning(report);
    if (!planning) return 'Unknown';
    if (planning.derived_sw_code) {
      const sw = planning.std_work_type_details;
      const details = sw?.std_work_details;
      const name = Array.isArray(details) ? details[0]?.sw_name : details?.sw_name;
      return name || planning.derived_sw_code;
    }
    if (planning.other_work_code != null && planning.wo_details_id != null && planning.stage_code != null) {
      const key = `${planning.wo_details_id}${ADDITIONS_KEY_SEP}${planning.stage_code}${planning.other_work_code}`;
      return otherWorkDescMap[key] || planning.other_work_code;
    }
    return 'Unknown';
  }

  function getWorkCode(report: any): string {
    const planning = getPlanning(report);
    return planning?.derived_sw_code || planning?.other_work_code || 'N/A';
  }

  function formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '-';
    return `₹${amount.toFixed(2)}`;
  }

  function formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(2)}%`;
  }

  // Calculate totals
  $: totalPieceRate = pieceRateData.reduce((sum, r) => sum + (r.pr_amount || 0), 0);
  $: totalOvertime = pieceRateData.reduce((sum, r) => sum + (r.overtime_amount || 0), 0);
  $: totalLostTime = pieceRateData.reduce((sum, r) => {
    if (r.lt_details && Array.isArray(r.lt_details)) {
      return sum + r.lt_details.reduce((ltSum: number, lt: any) => ltSum + (lt.lt_value || 0), 0);
    }
    return sum;
  }, 0);
  $: totalHours = pieceRateData.reduce((sum, r) => sum + (r.hours_worked_today || 0), 0);

  const selectedEmployee = employees.find(e => e.emp_id === selectedEmployeeId);
</script>

<svelte:head>
  <title>Piece Rate - Time Period</title>
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
  <!-- Header -->
  <AppHeader 
    title="Piece Rate - Time Period"
    onSidebarToggle={handleSidebarToggle}
  />

  <!-- Main Content -->
  <div class="flex flex-1 p-4">
    <div class="w-full">

      <!-- Filters -->
      <div class="theme-bg-secondary rounded-lg shadow border theme-border p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="piece-rate-employee" class="block text-sm font-medium theme-text-primary mb-2">
              Employee <span class="text-red-500">*</span>
            </label>
            <select
              id="piece-rate-employee"
              bind:value={selectedEmployeeId}
              class="w-full px-3 py-2 theme-border border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Employee</option>
              {#each employees as emp}
                <option value={emp.emp_id}>{emp.emp_name} ({emp.emp_id})</option>
              {/each}
            </select>
            {#if errors.employee}
              <p class="text-red-500 text-xs mt-1">{errors.employee}</p>
            {/if}
          </div>

          <div>
            <label for="piece-rate-from-date" class="block text-sm font-medium theme-text-primary mb-2">
              From Date <span class="text-red-500">*</span>
            </label>
            <input
              id="piece-rate-from-date"
              type="date"
              bind:value={fromDate}
              class="w-full px-3 py-2 theme-border border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="piece-rate-to-date" class="block text-sm font-medium theme-text-primary mb-2">
              To Date <span class="text-red-500">*</span>
            </label>
            <input
              id="piece-rate-to-date"
              type="date"
              bind:value={toDate}
              min={fromDate || undefined}
              class="w-full px-3 py-2 theme-border border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Must be on or after From date"
            />
            <p class="text-xs theme-text-secondary mt-1">Must be on or after From date</p>
          </div>
        </div>

        {#if errors.dates}
          <p class="text-red-500 text-xs mt-2">{errors.dates}</p>
        {/if}

        <div class="mt-4">
          <Button
            on:click={loadPieceRateData}
            disabled={isDataLoading}
            class="px-6 py-2"
          >
            {isDataLoading ? 'Loading...' : 'Load Data'}
          </Button>
        </div>
      </div>

      <!-- Results -->
      {#if pieceRateData.length > 0}
        <div class="theme-bg-secondary rounded-lg shadow border theme-border overflow-hidden">
          <div class="p-6 border-b theme-border">
            <h2 class="text-lg font-semibold theme-text-primary">
              Piece Rate Report
              {#if selectedEmployee}
                - {selectedEmployee.emp_name} ({selectedEmployee.emp_id})
              {/if}
            </h2>
            <p class="text-sm theme-text-secondary mt-1">
              {formatDateLocal(fromDate)} to {formatDateLocal(toDate)}
            </p>
            <p class="text-xs theme-text-secondary mt-1">
              Piece Rate, Rate/Hour, Std Time, POW and Type are filled when piece rate is calculated (on report completion). Blank values mean calculation has not run or prerequisites (e.g. time standards, skill mapping) are missing.
            </p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="theme-bg-secondary border-b theme-border">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Date</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Work Code</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Work Name</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Hours</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Piece Rate</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Rate/Hour</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Std Time (min)</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">POW</th>
                  <th class="px-4 py-3 text-center text-xs font-medium theme-text-primary uppercase">Type</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Overtime</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Lost Time</th>
                  <th class="px-4 py-3 text-center text-xs font-medium theme-text-primary uppercase">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y theme-border">
                {#each pieceRateData as report}
                  <tr class="hover:theme-bg-secondary transition-colors">
                    <td class="px-4 py-3 text-sm theme-text-primary">{formatDateLocal(report.from_date)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{getWorkCode(report)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{getWorkName(report)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{report.hours_worked_today?.toFixed(2) || '-'}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary font-medium">
                      {formatCurrency(report.pr_amount)}
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {formatCurrency(report.pr_rate)}
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {report.pr_std_time || '-'}
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {formatPercentage(report.pr_pow)}
                    </td>
                    <td class="px-4 py-3 text-sm text-center">
                      <span class="px-2 py-1 rounded text-xs {
                        report.pr_type === 'PR' 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                          : report.pr_type === 'SL'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }">
                        {report.pr_type || '-'}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {formatCurrency(report.overtime_amount)}
                    </td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">
                      {formatCurrency(
                        report.lt_details && Array.isArray(report.lt_details)
                          ? report.lt_details.reduce((sum: number, lt: any) => sum + (lt.lt_value || 0), 0)
                          : 0
                      )}
                    </td>
                    <td class="px-4 py-3 text-sm text-center">
                      <span class="px-2 py-1 rounded text-xs {
                        report.completion_status === 'C' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }">
                        {report.completion_status === 'C' ? 'Completed' : 'Not Completed'}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="theme-bg-secondary border-t theme-border font-semibold">
                <tr>
                  <td colspan="3" class="px-4 py-3 text-sm theme-text-primary">Total</td>
                  <td class="px-4 py-3 text-sm theme-text-primary">{totalHours.toFixed(2)}</td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(totalPieceRate)}</td>
                  <td colspan="5"></td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(totalOvertime)}</td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(totalLostTime)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="p-6 border-t theme-border">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p class="text-sm theme-text-secondary">Total Hours</p>
                <p class="text-lg font-semibold theme-text-primary">{totalHours.toFixed(2)}</p>
              </div>
              <div>
                <p class="text-sm theme-text-secondary">Total Piece Rate</p>
                <p class="text-lg font-semibold theme-text-primary">{formatCurrency(totalPieceRate)}</p>
              </div>
              <div>
                <p class="text-sm theme-text-secondary">Total Overtime</p>
                <p class="text-lg font-semibold theme-text-primary">{formatCurrency(totalOvertime)}</p>
              </div>
              <div>
                <p class="text-sm theme-text-secondary">Total Lost Time</p>
                <p class="text-lg font-semibold theme-text-primary">{formatCurrency(totalLostTime)}</p>
              </div>
            </div>
          </div>
        </div>
      {:else if isDataLoading}
        <div class="text-center py-12">
          <p class="theme-text-secondary">Loading data...</p>
        </div>
      {:else if selectedEmployeeId && fromDate && toDate}
        <div class="text-center py-12">
          <p class="theme-text-secondary">No data found for the selected criteria</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />

