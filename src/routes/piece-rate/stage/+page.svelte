<script lang="ts">
  /**
   * Piece Rate - Stage
   * Export Excel report by stage and date range. No table preview; export runs async with modal.
   * Stages from sys_data_elements where de_name = 'Plant-Stage'.
   * Excel: Detail (all report rows for stage/period, multi-employee) + Consolidated (per-employee totals + grand total).
   */
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import AppHeader from '$lib/components/common/AppHeader.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { supabase } from '$lib/supabaseClient';
  import { fetchDataElements } from '$lib/api/dataElements';
  import { formatDateLocal, formatDateTimeDDMMYYYYHHMM } from '$lib/utils/formatDate';
  import { formatLostTimeDetails } from '$lib/utils/formatLostTime';
  import * as XLSX from 'xlsx';

  let showSidebar = false;
  let menus: any[] = [];

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  let selectedStage = '';
  let fromDate = '';
  let toDate = '';
  let stages: { de_value: string }[] = [];
  let isExporting = false;
  let errors: { stage?: string; dates?: string } = {};

  const ADDITIONS_KEY_SEP = '\u001f';
  const PLANNING_IDS_BATCH = 100;

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus(username);
    }
    const elements = await fetchDataElements('Plant-Stage');
    stages = (elements || [])
      .map((e) => ({ de_value: e.de_value }))
      .sort((a, b) => a.de_value.localeCompare(b.de_value, undefined, { sensitivity: 'base' }));
  });

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
    if (from.getFullYear() !== to.getFullYear() || from.getMonth() !== to.getMonth()) {
      errors.dates = 'Both dates must be in the same month and year';
      return false;
    }
    return true;
  }

  function getPlanning(report: any): any {
    const p = report?.prdn_work_planning;
    return Array.isArray(p) ? p[0] : p;
  }

  function getWorkName(report: any, otherWorkDescMap: Record<string, string>): string {
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

  function getStdScName(report: any): string {
    const planning = getPlanning(report);
    const wsm = planning?.std_work_skill_mapping;
    const row = Array.isArray(wsm) ? wsm[0] : wsm;
    return row?.sc_name ?? '-';
  }

  function getWoNo(report: any): string {
    const planning = getPlanning(report);
    const woDetails = planning?.prdn_wo_details;
    const wo = Array.isArray(woDetails) ? woDetails[0] : woDetails;
    return wo?.wo_no ?? '-';
  }

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

  async function exportExcelReport(): Promise<void> {
    if (!selectedStage) {
      errors.stage = 'Please select a stage';
      return;
    }
    if (!validateDates()) return;

    isExporting = true;
    try {
      const { data: planningRows } = await supabase
        .from('prdn_work_planning')
        .select('id')
        .eq('stage_code', selectedStage)
        .eq('is_deleted', false)
        .eq('is_active', true);
      const planningIds = (planningRows || []).map((r) => r.id);
      if (planningIds.length === 0) {
        alert('No planning records found for the selected stage.');
        return;
      }

      const reports: any[] = [];
      for (let i = 0; i < planningIds.length; i += PLANNING_IDS_BATCH) {
        const batch = planningIds.slice(i, i + PLANNING_IDS_BATCH);
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
            pr_rate_work,
            pr_rate_worker,
            pr_std_time,
            pr_pow,
            pr_type,
            overtime_amount,
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
                std_work_details!left(sw_name)
              ),
              std_work_skill_mapping!left(sc_name),
              prdn_wo_details(wo_no)
            )
          `)
          .in('planning_id', batch)
          .gte('from_date', fromDate)
          .lte('to_date', toDate)
          .eq('is_deleted', false)
          .eq('is_active', true)
          .order('from_date', { ascending: true })
          .order('from_time', { ascending: true });
        if (error) throw error;
        reports.push(...(data || []));
      }

      const keyTriplets: { wo_details_id: number; stage_code: string; other_work_code: string }[] = [];
      const seen = new Set<string>();
      for (const r of reports) {
        const p = getPlanning(r);
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
      let otherWorkDescMap: Record<string, string> = {};
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

      const workerIds = [...new Set(reports.map((r) => r.worker_id).filter(Boolean))] as string[];
      let empNameMap: Record<string, string> = {};
      let empSkillMap: Record<string, string> = {};
      if (workerIds.length > 0) {
        const { data: emps } = await supabase
          .from('hr_emp')
          .select('emp_id, emp_name, skill_short')
          .in('emp_id', workerIds);
        if (emps) {
          for (const e of emps) {
            empNameMap[e.emp_id] = e.emp_name ?? e.emp_id;
            empSkillMap[e.emp_id] = e.skill_short ?? '';
          }
        }
      }

      const detailRows = reports
        .map((report) => {
          const planning = getPlanning(report);
          return {
            Employee: empNameMap[report.worker_id] ?? report.worker_id ?? '-',
            Date: formatDateLocal(report.from_date),
            Stage: planning?.stage_code ?? '',
            'WO No': getWoNo(report),
            'Work Code': getWorkCode(report),
            'Work Name': getWorkName(report, otherWorkDescMap),
            'Std. SC': getStdScName(report),
            'Std. Time': formatStdTimeHrMin(report.pr_std_time),
            'Start Time': formatDateTimeDDMMYYYYHHMM(report.from_date, report.from_time),
            'End Time': formatDateTimeDDMMYYYYHHMM(report.to_date, report.to_time),
            'Hours Worked Till Date': report.hours_worked_till_date != null ? Number(report.hours_worked_till_date) : '',
            'Hours Worked on Date': report.hours_worked_today ?? '',
            'Total Hours': (Number(report.hours_worked_till_date) || 0) + (Number(report.hours_worked_today) || 0),
            'SC Required': planning?.sc_required ?? '',
            'SC of Emp': empSkillMap[report.worker_id] ?? '-',
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
        })
        .sort((a, b) => (a.Employee ?? '').localeCompare(b.Employee ?? '', undefined, { sensitivity: 'base' }));

      const consolidatedByWorker: Record<
        string,
        { hours: number; pieceRate: number; overtime: number; lostTime: number; count: number }
      > = {};
      for (const r of reports) {
        const wid = r.worker_id ?? '_unknown_';
        if (!consolidatedByWorker[wid]) {
          consolidatedByWorker[wid] = { hours: 0, pieceRate: 0, overtime: 0, lostTime: 0, count: 0 };
        }
        const c = consolidatedByWorker[wid];
        c.hours += (Number(r.hours_worked_till_date) || 0) + (Number(r.hours_worked_today) || 0);
        c.pieceRate += r.pr_amount ?? 0;
        c.overtime += r.overtime_amount ?? 0;
        c.lostTime += getLostTimeAmount(r);
        c.count += 1;
      }
      const consolidatedRowsSorted = Object.entries(consolidatedByWorker)
        .map(([workerId, c]) => ({
          Employee: empNameMap[workerId] ?? workerId,
          'Total Hours': Math.round(c.hours * 100) / 100,
          'Total Piece Rate': Math.round(c.pieceRate * 100) / 100,
          'Total Overtime': Math.round(c.overtime * 100) / 100,
          'Total Lost Time': Math.round(c.lostTime * 100) / 100,
          'Record Count': c.count
        }))
        .sort((a, b) => (a.Employee ?? '').localeCompare(b.Employee ?? '', undefined, { sensitivity: 'base' }));
      const grandTotal = reports.reduce(
        (acc, r) => {
          acc.hours += (Number(r.hours_worked_till_date) || 0) + (Number(r.hours_worked_today) || 0);
          acc.pieceRate += r.pr_amount ?? 0;
          acc.overtime += r.overtime_amount ?? 0;
          acc.lostTime += getLostTimeAmount(r);
          acc.count += 1;
          return acc;
        },
        { hours: 0, pieceRate: 0, overtime: 0, lostTime: 0, count: 0 }
      );
      consolidatedRowsSorted.push({
        Employee: 'Grand Total',
        'Total Hours': Math.round(grandTotal.hours * 100) / 100,
        'Total Piece Rate': Math.round(grandTotal.pieceRate * 100) / 100,
        'Total Overtime': Math.round(grandTotal.overtime * 100) / 100,
        'Total Lost Time': Math.round(grandTotal.lostTime * 100) / 100,
        'Record Count': grandTotal.count
      });

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      const wsConsolidated = XLSX.utils.json_to_sheet(consolidatedRowsSorted);

      const ACCOUNTING_FORMAT = '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)';
      const detailRateAmountCols = ['J', 'K', 'L', 'P', 'Q', 'R', 'S', 'T', 'V']; // J=Hours Till, K=Hours On, L=Total Hours, P–S=rates/POW/Piece, T=Overtime, V=Lost Time Amount
      const detailRange = XLSX.utils.decode_range(wsDetail['!ref'] || 'A1');
      for (let R = detailRange.s.r + 1; R <= detailRange.e.r; R++) {
        for (const C of detailRateAmountCols) {
          const ref = `${C}${R + 1}`;
          if (wsDetail[ref] != null && typeof wsDetail[ref].v === 'number') {
            wsDetail[ref].z = ACCOUNTING_FORMAT;
          }
        }
      }
      const consolidatedRateAmountCols = ['B', 'C', 'D', 'E'];
      const consolidatedRange = XLSX.utils.decode_range(wsConsolidated['!ref'] || 'A1');
      for (let R = consolidatedRange.s.r + 1; R <= consolidatedRange.e.r; R++) {
        for (const C of consolidatedRateAmountCols) {
          const ref = `${C}${R + 1}`;
          if (wsConsolidated[ref] != null && typeof wsConsolidated[ref].v === 'number') {
            wsConsolidated[ref].z = ACCOUNTING_FORMAT;
          }
        }
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsConsolidated, 'Consolidated');
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail');

      const sanitize = (s: string) =>
        String(s || '')
          .replace(/[\s\/\\:<>?"|*]/g, '-')
          .replace(/-+/g, '-')
          .trim();
      const generatedAt = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const generatedTimestamp = `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())}_${pad(generatedAt.getHours())}-${pad(generatedAt.getMinutes())}-${pad(generatedAt.getSeconds())}`;
      const filename = `PR Report-${sanitize(selectedStage)}-${fromDate}-${toDate}-${generatedTimestamp}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Export Excel error:', err);
      alert('Failed to export Excel. Please try again.');
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:head>
  <title>PMS - Piece Rate - Stage</title>
</svelte:head>

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
  <AppHeader title="Piece Rate - Stage" onSidebarToggle={handleSidebarToggle} />

  <div class="flex flex-1 p-4">
    <div class="w-full">
      <div class="theme-bg-secondary rounded-lg shadow border theme-border p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="piece-rate-stage" class="block text-sm font-medium theme-text-primary mb-2">
              Stage <span class="text-red-500">*</span>
            </label>
            <select
              id="piece-rate-stage"
              bind:value={selectedStage}
              class="w-full px-3 py-2 theme-border border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Stage</option>
              {#each stages as s}
                <option value={s.de_value}>{s.de_value}</option>
              {/each}
            </select>
            {#if errors.stage}
              <p class="text-red-500 text-xs mt-1">{errors.stage}</p>
            {/if}
          </div>
          <div>
            <label for="piece-rate-stage-from-date" class="block text-sm font-medium theme-text-primary mb-2">
              From Date <span class="text-red-500">*</span>
            </label>
            <input
              id="piece-rate-stage-from-date"
              type="date"
              bind:value={fromDate}
              class="w-full px-3 py-2 theme-border border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label for="piece-rate-stage-to-date" class="block text-sm font-medium theme-text-primary mb-2">
              To Date <span class="text-red-500">*</span>
            </label>
            <input
              id="piece-rate-stage-to-date"
              type="date"
              bind:value={toDate}
              min={fromDate || undefined}
              class="w-full px-3 py-2 theme-border border rounded-md theme-bg-primary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs theme-text-secondary mt-1">Must be on or after From date; same month and year.</p>
          </div>
        </div>
        {#if errors.dates}
          <p class="text-red-500 text-xs mt-2">{errors.dates}</p>
        {/if}
        <div class="mt-4">
          <Button
            on:click={exportExcelReport}
            disabled={isExporting}
            class="px-6 py-2"
          >
            {isExporting ? 'Generating...' : 'Export Excel report'}
          </Button>
        </div>
      </div>
    </div>
  </div>
</div>

{#if isExporting}
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
    <div class="theme-bg-primary rounded-lg shadow-xl p-6 max-w-sm mx-4 text-center">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <h2 id="export-modal-title" class="text-lg font-semibold theme-text-primary">Excel file generation is in process.</h2>
      <p class="text-sm theme-text-secondary mt-2">Please wait. The file will download when ready.</p>
    </div>
  </div>
{/if}

<FloatingThemeToggle />
