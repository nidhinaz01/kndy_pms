<script lang="ts">
  /**
   * Piece Rate - Time Period
   *
   * Data flow: Supabase prdn_work_reporting (+ nested prdn_work_planning) -> pieceRateData -> table.
   *
   * Column mapping (each row = one element of pieceRateData, i.e. one prdn_work_reporting record):
   * - Date              -> report.from_date (formatDateLocal)
   * - Stage             -> planning.stage_code
   * - WO No             -> getWoNo(report) -> planning.prdn_wo_details.wo_no
   * - Work Code         -> getWorkCode(report) -> planning.derived_sw_code || planning.other_work_code
   * - Work Name         -> getWorkName(report)
   * - Std. SC           -> std_work_skill_mapping.sc_name (via planning.wsm_id)
   * - Std. Time         -> report.pr_std_time (formatStdTimeHrMin)
   * - Start Time        -> formatDateTimeDDMMYYYYHHMM(from_date, from_time)
   * - End Time          -> formatDateTimeDDMMYYYYHHMM(to_date, to_time)
   * - Hours Worked Till Date -> report.hours_worked_till_date
   * - Hours Worked on Date   -> report.hours_worked_today
   * - SC Required       -> planning.sc_required
   * - SC of Emp         -> hr_emp.skill_short (worker)
   * - Type              -> report.pr_type ('PR' | 'SL')
   * - Rate of Work      -> report.pr_rate_work
   * - Rate of Worker    -> report.pr_rate_worker
   * - POW               -> report.pr_pow
   * - Piece Rate        -> report.pr_amount
   * - Overtime          -> report.overtime_amount
   * - Lost Time Details -> report.lt_details formatted (formatLostTimeDetails)
   * - Lost Time Amount  -> sum of report.lt_details[].lt_value (total payable for that record)
   * - Status            -> report.completion_status ('C' = Completed)
   *
   * Note: pr_amount, pr_rate_work, pr_rate_worker, pr_std_time, pr_pow, pr_type are only populated when
   * pieceRateCalculationService runs (on report completion); otherwise they stay null and show as '-'.
   */
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { supabase } from '$lib/supabaseClient';
  import { formatDateLocal, formatDateTimeDDMMYYYYHHMM } from '$lib/utils/formatDate';
  import { formatLostTimeDetails } from '$lib/utils/formatLostTime';
  import * as XLSX from 'xlsx';

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
          from_time,
          to_date,
          to_time,
          hours_worked_till_date,
          hours_worked_today,
          completion_status,
          pr_amount,
          pr_calculated_dt,
          pr_rate_work,
          pr_rate_worker,
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
            wsm_id,
            std_work_type_details!left(
              std_work_details!left(
                sw_name
              )
            ),
            std_work_skill_mapping!left(
              sc_name
            ),
            prdn_wo_details(
              wo_no
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

  /** Std. SC from std_work_skill_mapping.sc_name (via planning.wsm_id) */
  function getStdScName(report: any): string {
    const planning = getPlanning(report);
    const wsm = planning?.std_work_skill_mapping;
    const row = Array.isArray(wsm) ? wsm[0] : wsm;
    return row?.sc_name ?? '-';
  }

  /** SC of Emp = hr_emp.skill_short for report.worker_id */
  function getScOfEmp(report: any): string {
    const emp = employees.find((e: any) => e.emp_id === report.worker_id);
    return emp?.skill_short ?? '-';
  }

  function getWoNo(report: any): string {
    const planning = getPlanning(report);
    const woDetails = planning?.prdn_wo_details;
    const wo = Array.isArray(woDetails) ? woDetails[0] : woDetails;
    return wo?.wo_no ?? '-';
  }

  function formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '-';
    return `₹${amount.toFixed(2)}`;
  }

  function formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(2)}%`;
  }

  /** Format minutes as "x Hr y Min" (e.g. 90 -> "1 Hr 30 Min", 45 -> "0 Hr 45 Min") */
  function formatStdTimeHrMin(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) return '-';
    const m = Math.floor(Number(minutes));
    if (isNaN(m) || m < 0) return '-';
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    if (hours === 0) return `${mins} Min`;
    if (mins === 0) return `${hours} Hr`;
    return `${hours} Hr ${mins} Min`;
  }

  function getLostTimeAmount(report: any): number {
    if (!report.lt_details || !Array.isArray(report.lt_details)) return 0;
    return report.lt_details.reduce((sum: number, lt: any) => sum + (lt.lt_value || 0), 0);
  }

  function exportToExcel(): void {
    if (pieceRateData.length === 0) return;
    try {
      const rows = pieceRateData.map((report) => {
        const planning = getPlanning(report);
        return {
          Date: formatDateLocal(report.from_date),
          Stage: planning?.stage_code ?? '',
          'WO No': getWoNo(report),
          'Work Code': getWorkCode(report),
          'Work Name': getWorkName(report),
          'Std. SC': getStdScName(report),
          'Std. Time': formatStdTimeHrMin(report.pr_std_time),
          'Start Time': formatDateTimeDDMMYYYYHHMM(report.from_date, report.from_time),
          'End Time': formatDateTimeDDMMYYYYHHMM(report.to_date, report.to_time),
          'Hours Worked Till Date': report.hours_worked_till_date != null ? Number(report.hours_worked_till_date) : '',
          'Hours Worked on Date': report.hours_worked_today ?? '',
          'Total Hours': (Number(report.hours_worked_till_date) || 0) + (Number(report.hours_worked_today) || 0),
          'SC Required': planning?.sc_required ?? '',
          'SC of Emp': getScOfEmp(report),
          Type: report.pr_type ?? '',
          'Rate of Work': report.pr_rate_work ?? '',
          'Rate of Worker': report.pr_rate_worker ?? '',
          POW: report.pr_pow ?? '',
          'Piece Rate': report.pr_amount ?? '',
          Overtime: report.overtime_amount ?? '',
          'Lost Time Details': formatLostTimeDetails(report.lt_details),
          'Lost Time Amount': getLostTimeAmount(report),
          Status: report.completion_status === 'C' ? 'Completed' : 'Not Completed'
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const ACCOUNTING_FORMAT = '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)';
      const rateAmountCols = ['J', 'K', 'L', 'P', 'Q', 'R', 'S', 'T', 'V']; // J=Hours Till, K=Hours On, L=Total Hours, P–S=rates/POW/Piece, T=Overtime, V=Lost Time Amount
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r + 1; R <= range.e.r; R++) {
        for (const C of rateAmountCols) {
          const ref = `${C}${R + 1}`;
          if (ws[ref] != null && typeof ws[ref].v === 'number') {
            ws[ref].z = ACCOUNTING_FORMAT;
          }
        }
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PR Report');
      const sanitize = (s: string) => String(s || '').replace(/[\s\/\\:<>?"|*]/g, '-').replace(/-+/g, '-').trim();
      const empLabel = selectedEmployee ? sanitize(selectedEmployee.emp_name || selectedEmployeeId) : sanitize(selectedEmployeeId) || 'All';
      const generatedAt = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const generatedTimestamp = `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())}_${pad(generatedAt.getHours())}-${pad(generatedAt.getMinutes())}-${pad(generatedAt.getSeconds())}`;
      const filename = `PR Report-${empLabel}-${fromDate}-${toDate}-${generatedTimestamp}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Export Excel error:', err);
      alert('Failed to export Excel. Please try again.');
    }
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
  $: totalHours = pieceRateData.reduce(
    (sum, r) => sum + (Number(r.hours_worked_till_date) || 0) + (Number(r.hours_worked_today) || 0),
    0
  );

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

        <div class="mt-4 flex flex-wrap gap-2">
          <Button
            on:click={loadPieceRateData}
            disabled={isDataLoading}
            class="px-6 py-2"
          >
            {isDataLoading ? 'Loading...' : 'Load Data'}
          </Button>
          <Button
            variant="secondary"
            on:click={exportToExcel}
            disabled={pieceRateData.length === 0}
            class="px-6 py-2"
          >
            Export Excel
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
              Type, Rate of Work, Rate of Worker, Std Time, POW and Piece Rate are filled when piece rate is calculated (on report completion). Blank values mean calculation has not run or prerequisites (e.g. time standards, skill mapping) are missing.
            </p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-max">
              <thead class="theme-bg-secondary border-b theme-border">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Date</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Stage</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">WO No</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Work Code</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Work Name</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Std. SC</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Std. Time</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Start Time</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">End Time</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Hours Worked Till Date</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Hours Worked on Date</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Total Hours</th>
                  <th class="px-4 py-3 text-center text-xs font-medium theme-text-primary uppercase">SC Required</th>
                  <th class="px-4 py-3 text-center text-xs font-medium theme-text-primary uppercase">SC of Emp</th>
                  <th class="px-4 py-3 text-center text-xs font-medium theme-text-primary uppercase">Type</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Rate of Work</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Rate of Worker</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">POW</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Piece Rate</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Overtime</th>
                  <th class="px-4 py-3 text-left text-xs font-medium theme-text-primary uppercase">Lost Time Details</th>
                  <th class="px-4 py-3 text-right text-xs font-medium theme-text-primary uppercase">Lost Time Amount</th>
                  <th class="px-4 py-3 text-center text-xs font-medium theme-text-primary uppercase">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y theme-border">
                {#each pieceRateData as report}
                  {@const planning = getPlanning(report)}
                  <tr class="hover:theme-bg-secondary transition-colors">
                    <td class="px-4 py-3 text-sm theme-text-primary">{formatDateLocal(report.from_date)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{planning?.stage_code ?? '-'}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{getWoNo(report)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{getWorkCode(report)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{getWorkName(report)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{getStdScName(report)}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatStdTimeHrMin(report.pr_std_time)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{formatDateTimeDDMMYYYYHHMM(report.from_date, report.from_time)}</td>
                    <td class="px-4 py-3 text-sm theme-text-primary">{formatDateTimeDDMMYYYYHHMM(report.to_date, report.to_time)}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">{(report.hours_worked_till_date != null ? Number(report.hours_worked_till_date) : 0).toFixed(2)}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">{report.hours_worked_today != null ? Number(report.hours_worked_today).toFixed(2) : '-'}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">{((Number(report.hours_worked_till_date) || 0) + (Number(report.hours_worked_today) || 0)).toFixed(2)}</td>
                    <td class="px-4 py-3 text-sm text-center theme-text-primary">{planning?.sc_required ?? '-'}</td>
                    <td class="px-4 py-3 text-sm text-center theme-text-primary">{getScOfEmp(report)}</td>
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
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(report.pr_rate_work)}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(report.pr_rate_worker)}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatPercentage(report.pr_pow)}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary font-medium">{formatCurrency(report.pr_amount)}</td>
                    <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(report.overtime_amount)}</td>
                    <td class="px-4 py-3 text-sm text-left theme-text-primary max-w-xs truncate" title={formatLostTimeDetails(report.lt_details)}>
                      {formatLostTimeDetails(report.lt_details) || '-'}
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
                  <td colspan="7" class="px-4 py-3 text-sm theme-text-primary">Total</td>
                  <td colspan="2"></td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{pieceRateData.reduce((s, r) => s + (Number(r.hours_worked_till_date) || 0), 0).toFixed(2)}</td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{pieceRateData.reduce((s, r) => s + (Number(r.hours_worked_today) || 0), 0).toFixed(2)}</td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{totalHours.toFixed(2)}</td>
                  <td colspan="5"></td>
                  <td></td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(totalPieceRate)}</td>
                  <td class="px-4 py-3 text-sm text-right theme-text-primary">{formatCurrency(totalOvertime)}</td>
                  <td></td>
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

