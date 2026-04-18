<script lang="ts">
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';

  import type { ProductionEmployee } from '$lib/api/production';
  import { attendanceIsAbsent } from '$lib/utils/manpowerAttendanceStatus';

  import { fetchConfiguredStageShifts, type StageShiftPair } from './services/dashboardDataService';
  import ProductionCircleDiagram from './components/ProductionCircleDiagram.svelte';
  import {
    fetchCentralProductionDashboardMetrics,
    fetchLostTimeReasonsForStageShift,
    type CentralProductionDashboardMetrics,
    type CentralPlantNode,
    type CentralShiftMetrics
  } from './services/centralProductionMetricsService';
  import {
    loadManpowerPlanData,
    loadManpowerReportData,
    getPlanningSubmissionStatus,
    getReportingSubmissionStatus
  } from '../[stage_Shift]/services/pageDataService';

  import { validateEmployeeShiftPlanning } from '$lib/api/production/planningValidationService';
  import { validateEmployeeShiftReporting } from '$lib/api/production/reportingValidationService';

  import type { ValidationResult as PlanningValidationResult } from '$lib/api/production/planningValidationService';
  import type { ValidationResult as ReportingValidationResult } from '$lib/api/production/reportingValidationService';

  let showSidebar = false;
  let menus: any[] = [];

  // UI state
  let selectedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (needed by validation services)
  let mode: 'planning' | 'reporting' | 'both' = 'both';

  let stageShifts: StageShiftPair[] = [];
  let isStageShiftsLoading = true;

  let centralMetrics: CentralProductionDashboardMetrics | null = null;
  let plantsTree: CentralPlantNode[] = [];
  let shiftMetricsByKey: Record<string, CentralShiftMetrics> = {};
  let isCentralMetricsLoading = false;

  // Submission statuses keyed by `${stageCode}-${shiftCode}` (see makeStageShiftKey)
  let planningStatusByStage: Record<string, any | null> = {};
  let reportingStatusByStage: Record<string, any | null> = {};
  let isStatusesLoading = false;

  // Pending submission lists (for quick manager view)
  let pendingPlanningSubmissions: any[] = [];
  let pendingReportingSubmissions: any[] = [];
  let isApprovalsLoading = false;

  // Selected card details
  let selectedStageCode = '';
  let selectedShiftCode = '';
  let selectedStageShiftKey = '';
  let selectedShiftMetrics: CentralShiftMetrics | null = null;
  let isShiftReasonsLoading = false;
  let lastShiftReasonsLoadedKey = '';

  let isPlanningManpowerLoading = false;
  let isReportingManpowerLoading = false;

  let manpowerPlanData: ProductionEmployee[] = [];
  let manpowerReportData: ProductionEmployee[] = [];

  let planningValidation: PlanningValidationResult | null = null;
  let reportingValidation: ReportingValidationResult | null = null;

  function makeStageShiftKey(stageCode: string, shiftCode: string) {
    return `${stageCode}-${shiftCode}`;
  }

  function getStatusBadge(status: string | null | undefined) {
    const s = (status || '').toLowerCase();
    if (!s) {
      return {
        label: 'Not submitted',
        classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      };
    }

    if (s === 'pending_approval') {
      return {
        label: 'Pending approval',
        classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      };
    }

    if (s === 'approved') {
      return {
        label: 'Approved',
        classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      };
    }

    if (s === 'rejected') {
      return {
        label: 'Rejected',
        classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      };
    }

    return {
      label: status,
      classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    };
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }

  function toNumberOrZero(v: any) {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function computeManpowerMetrics(data: ProductionEmployee[]) {
    const total = data.length;
    const presentCount = data.filter(e => e.attendance_status === 'present').length;
    const absentCount = data.filter(e => attendanceIsAbsent(e.attendance_status)).length;
    const plannedHoursTotal = data.reduce((sum, e) => sum + toNumberOrZero((e as any).planned_hours), 0);
    const actualHoursTotal = data.reduce((sum, e) => sum + toNumberOrZero((e as any).actual_hours), 0);

    return { total, presentCount, absentCount, plannedHoursTotal, actualHoursTotal };
  }

  let pendingPlanningStageCodes = new Set<string>();
  let pendingReportingStageCodes = new Set<string>();

  async function loadStageStatuses() {
    isStatusesLoading = true;
    try {
      const planningEntries = await Promise.all(
        stageShifts.map(async p => ({
          key: makeStageShiftKey(p.stageCode, p.shiftCode),
          status: await getPlanningSubmissionStatus(p.stageCode, p.shiftCode, selectedDate)
        }))
      );
      planningStatusByStage = {};
      planningEntries.forEach(({ key, status }) => {
        planningStatusByStage[key] = status;
      });

      const reportingEntries = await Promise.all(
        stageShifts.map(async p => ({
          key: makeStageShiftKey(p.stageCode, p.shiftCode),
          status: await getReportingSubmissionStatus(p.stageCode, p.shiftCode, selectedDate)
        }))
      );
      reportingStatusByStage = {};
      reportingEntries.forEach(({ key, status }) => {
        reportingStatusByStage[key] = status;
      });
    } finally {
      isStatusesLoading = false;
    }
  }

  async function loadPendingSubmissions() {
    isApprovalsLoading = true;
    try {
      const [planningRes, reportingRes] = await Promise.all([
        supabase
          .from('prdn_planning_submissions')
          .select('id, stage_code, planning_date, status, version, submitted_by, submitted_dt, reviewed_by, reviewed_dt, rejection_reason')
          .eq('status', 'pending_approval')
          .eq('is_deleted', false)
          .eq('planning_date', selectedDate)
          .order('version', { ascending: false })
          .order('submitted_dt', { ascending: false }),
        supabase
          .from('prdn_reporting_submissions')
          .select('id, stage_code, reporting_date, status, version, submitted_by, submitted_dt, reviewed_by, reviewed_dt, rejection_reason')
          .eq('status', 'pending_approval')
          .eq('is_deleted', false)
          .eq('reporting_date', selectedDate)
          .order('version', { ascending: false })
          .order('submitted_dt', { ascending: false })
      ]);

      pendingPlanningSubmissions = planningRes.data || [];
      pendingReportingSubmissions = reportingRes.data || [];

      // Reassign new Set instances so Svelte notices the change.
      pendingPlanningStageCodes = new Set<string>(pendingPlanningSubmissions.map((s: any) => s.stage_code));
      pendingReportingStageCodes = new Set<string>(pendingReportingSubmissions.map((s: any) => s.stage_code));
    } finally {
      isApprovalsLoading = false;
    }
  }

  async function loadSelectedDetails() {
    if (!selectedStageCode || !selectedShiftCode) return;

    const planningRequested = mode === 'planning' || mode === 'both';
    const reportingRequested = mode === 'reporting' || mode === 'both';

    // Clear previous state for cleaner UI transitions
    manpowerPlanData = [];
    manpowerReportData = [];
    planningValidation = null;
    reportingValidation = null;

    if (planningRequested) {
      isPlanningManpowerLoading = true;
      try {
        const [planData, validation] = await Promise.all([
          loadManpowerPlanData(selectedStageCode, selectedShiftCode, selectedDate),
          validateEmployeeShiftPlanning(selectedStageCode, selectedShiftCode, selectedDate)
        ]);
        manpowerPlanData = planData || [];
        planningValidation = validation;
      } finally {
        isPlanningManpowerLoading = false;
      }
    }

    if (reportingRequested) {
      isReportingManpowerLoading = true;
      try {
        const [reportData, validation] = await Promise.all([
          loadManpowerReportData(selectedStageCode, selectedShiftCode, selectedDate),
          validateEmployeeShiftReporting(selectedStageCode, selectedShiftCode, selectedDate)
        ]);
        manpowerReportData = reportData || [];
        reportingValidation = validation;
      } finally {
        isReportingManpowerLoading = false;
      }
    }
  }

  async function reloadAll() {
    planningStatusByStage = {};
    reportingStatusByStage = {};

    await Promise.all([
      loadStageStatuses(),
      loadPendingSubmissions(),
      loadCentralMetrics()
    ]);

    await loadSelectedDetails();
  }

  async function loadCentralMetrics() {
    isCentralMetricsLoading = true;
    try {
      centralMetrics = await fetchCentralProductionDashboardMetrics(selectedDate);
      plantsTree = centralMetrics.plants || [];
      isShiftReasonsLoading = false;
      lastShiftReasonsLoadedKey = '';
      const map: Record<string, CentralShiftMetrics> = {};
      for (const plant of plantsTree) {
        for (const stage of plant.stages) {
          for (const shift of stage.shifts) {
            map[`${shift.stageCode}-${shift.shiftCode}`] = shift;
          }
        }
      }
      shiftMetricsByKey = map;
    } catch (e) {
      console.error('Failed to load central production metrics:', e);
      centralMetrics = null;
      plantsTree = [];
      shiftMetricsByKey = {};
      isShiftReasonsLoading = false;
      lastShiftReasonsLoadedKey = '';
    } finally {
      isCentralMetricsLoading = false;
    }
  }

  onMount(async () => {
    isStageShiftsLoading = true;
    try {
      const username = localStorage.getItem('username');
      if (username) {
        menus = await fetchUserMenus(username);
      }

      stageShifts = await fetchConfiguredStageShifts();
      isStageShiftsLoading = false;

      if (stageShifts.length > 0) {
        selectedStageCode = stageShifts[0].stageCode;
        selectedShiftCode = stageShifts[0].shiftCode;
      }

      await reloadAll();
    } catch (e) {
      console.error('Failed to load production dashboard:', e);
      isStageShiftsLoading = false;
      isStatusesLoading = false;
      isApprovalsLoading = false;
    }
  });

  async function handleDateChange() {
    await reloadAll();
  }

  function handleSelectStageShift(pair: StageShiftPair) {
    selectedStageCode = pair.stageCode;
    selectedShiftCode = pair.shiftCode;
    loadSelectedDetails();
  }

  async function loadShiftReasonsForSelectedShift(stageCode: string, shiftCode: string, key: string) {
    const existing = shiftMetricsByKey[key];
    if (!existing) return;

    // If there is no lost-time WO at this level, reasons are irrelevant.
    if (existing.workOrdersReportedWithLostTime <= 0) {
      lastShiftReasonsLoadedKey = key;
      return;
    }

    // Avoid duplicate fetches.
    if (isShiftReasonsLoading || lastShiftReasonsLoadedKey === key) return;

    isShiftReasonsLoading = true;
    try {
      const reasons = await fetchLostTimeReasonsForStageShift(stageCode, shiftCode, selectedDate, 5);
      shiftMetricsByKey = {
        ...shiftMetricsByKey,
        [key]: { ...existing, lostTimeReasonsTop: reasons }
      };
      lastShiftReasonsLoadedKey = key;
    } catch (e) {
      console.error('Failed to load lost-time reasons:', e);
    } finally {
      isShiftReasonsLoading = false;
    }
  }

  $: selectedStageShiftKey = selectedStageCode && selectedShiftCode
    ? makeStageShiftKey(selectedStageCode, selectedShiftCode)
    : '';

  $: selectedShiftMetrics = selectedStageCode && selectedShiftCode
    ? shiftMetricsByKey[makeStageShiftKey(selectedStageCode, selectedShiftCode)] || null
    : null;

  $: if (selectedShiftMetrics && selectedStageShiftKey) {
    // Load LT reasons only when they are needed for the selected shift.
    const needsReasons =
      (selectedShiftMetrics.lostTimeReasonsTop?.length || 0) === 0 &&
      selectedShiftMetrics.workOrdersReportedWithLostTime > 0;

    if (needsReasons) {
      void loadShiftReasonsForSelectedShift(selectedStageCode, selectedShiftCode, selectedStageShiftKey);
    }
  }
</script>

<svelte:head>
  <title>Central Production Dashboard</title>
</svelte:head>

<div class="flex flex-col min-h-screen theme-bg-secondary transition-colors duration-200">
  <!-- Header -->
  <div class="theme-bg-primary border-b theme-border">
    <div class="flex items-center justify-between px-6 py-4 gap-4">
      <div class="flex items-center gap-4">
        <button
          type="button"
          class="p-2 rounded-lg hover:theme-bg-tertiary transition-colors"
          on:click={handleSidebarToggle}
          aria-label="Show sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h1 class="text-2xl font-semibold theme-text-primary">Central Production Dashboard</h1>
          <p class="text-sm theme-text-secondary mt-1">Summary across all plant-stage + shift</p>
        </div>
      </div>

      <div class="flex items-center gap-3 flex-wrap justify-end">
        <div class="flex items-center gap-2">
          <label for="production-dashboard-date" class="text-sm font-medium theme-text-secondary">Date</label>
          <input
            id="production-dashboard-date"
            type="date"
            bind:value={selectedDate}
            on:change={handleDateChange}
            class="px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg text-sm border"
          />
        </div>

        <div class="flex items-center gap-2">
          <label for="production-dashboard-mode" class="text-sm font-medium theme-text-secondary">View</label>
          <select
            id="production-dashboard-mode"
            bind:value={mode}
            on:change={loadSelectedDetails}
            class="px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg text-sm border"
          >
            <option value="planning">Planning</option>
            <option value="reporting">Reporting</option>
            <option value="both">Both</option>
          </select>
        </div>

        <Button variant="secondary" size="sm" on:click={() => goto('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  </div>

  <div class="p-4 lg:p-6">
    {#if isStageShiftsLoading}
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
        <span class="theme-text-secondary">Loading production dashboard...</span>
      </div>
    {:else}
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <!-- Cards -->
        <section class="xl:col-span-1 theme-bg-primary border theme-border rounded-lg shadow overflow-hidden">
          <div class="p-4 border-b theme-border">
              <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold theme-text-primary">Production Circle (Hierarchy)</h2>
                <p class="text-sm theme-text-secondary mt-1">
                  {plantsTree.length} plants · click to drill down
                </p>
              </div>
              <div class="text-right">
                {#if isStatusesLoading}
                  <div class="text-xs theme-text-secondary">Loading statuses...</div>
                {/if}
              </div>
            </div>
          </div>

          <div class="p-3 max-h-[55vh] overflow-auto">
            {#if isCentralMetricsLoading}
              <div class="text-center py-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                <p class="theme-text-secondary text-sm">Loading production metrics...</p>
              </div>
            {:else if plantsTree.length === 0}
              <div class="text-center py-8">
                <div class="text-4xl mb-2">📌</div>
                <p class="theme-text-secondary">No Plant/Stage/Shift configuration found.</p>
              </div>
            {:else}
              <div class="space-y-3">
                {#if centralMetrics}
                  <div class="rounded-lg theme-bg-secondary border theme-border p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <div class="text-sm font-semibold theme-text-primary">Entire Production</div>
                        <div class="text-xs theme-text-secondary mt-1">Totals across all configured plant-stage shifts</div>
                      </div>
                      <div class="text-right">
                        <div class="text-xs theme-text-secondary">{centralMetrics.totals.workOrdersReportedWithLostTime} LT WO</div>
                        <div class="text-sm theme-text-primary font-semibold">{centralMetrics.totals.lostTimeMinutesTotal.toFixed(0)} LT mins</div>
                      </div>
                    </div>

                    <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div class="p-2 rounded-lg border theme-border theme-bg-primary">
                        <div class="text-xs theme-text-secondary">Manpower Total</div>
                        <div class="text-lg font-semibold theme-text-primary">{centralMetrics.totals.manpowerTotal}</div>
                      </div>
                      <div class="p-2 rounded-lg border theme-border theme-bg-primary">
                        <div class="text-xs theme-text-secondary">Planned / Reported</div>
                        <div class="text-lg font-semibold theme-text-primary">
                          {centralMetrics.totals.manpowerPlannedAttendance} / {centralMetrics.totals.manpowerReportedAttendance}
                        </div>
                      </div>
                      <div class="p-2 rounded-lg border theme-border theme-bg-primary">
                        <div class="text-xs theme-text-secondary">Works</div>
                        <div class="text-lg font-semibold theme-text-primary">
                          {centralMetrics.totals.worksPlanned} / {centralMetrics.totals.worksReported}
                        </div>
                      </div>
                    </div>

                    <div class="mt-2 text-xs theme-text-secondary">
                      WO Planned / Reported: {centralMetrics.totals.workOrdersPlanned} / {centralMetrics.totals.workOrdersReported}
                      {" "}· Reported w/o LT: {centralMetrics.totals.workOrdersReportedWithoutLostTime}
                    </div>
                  </div>
                {/if}

                <div class="rounded-lg theme-bg-secondary border theme-border p-3">
                  {#if plantsTree.length > 0}
                    <ProductionCircleDiagram
                      plants={plantsTree}
                      selectedStageCode={selectedStageCode}
                      selectedShiftCode={selectedShiftCode}
                      mode={mode}
                      onSelectStageShift={handleSelectStageShift}
                    />
                  {:else}
                    <div class="text-sm theme-text-secondary">No production hierarchy found.</div>
                  {/if}
                </div>

                <div class="text-xs theme-text-secondary px-1">
                  Click a plant section (outer ring), then a stage band (middle ring), then a shift marker (inner ring).
                </div>
              </div>
            {/if}
          </div>
        </section>

        <!-- Selected details -->
        <section class="xl:col-span-2 theme-bg-primary border theme-border rounded-lg shadow overflow-hidden">
          <div class="p-4 border-b theme-border">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-lg font-semibold theme-text-primary">
                  Selected: {selectedStageShiftKey || '—'}
                </h2>
                <p class="text-sm theme-text-secondary mt-1">
                  Read-only details for Production Manager
                </p>
              </div>
              {#if selectedStageCode && selectedShiftCode}
                <div class="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    on:click={() => goto(`/production/${selectedStageCode}-${selectedShiftCode}`)}
                  >
                    Open Full Page
                  </Button>
                </div>
              {/if}
            </div>
          </div>

          <div class="p-4 space-y-6">
            {#if isCentralMetricsLoading}
              <div class="rounded-lg theme-bg-secondary border theme-border p-4">
                <div class="flex items-center justify-center gap-3">
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span class="theme-text-secondary text-sm">Loading hierarchy metrics...</span>
                </div>
              </div>
            {:else if selectedShiftMetrics}
              <div class="rounded-lg theme-bg-secondary border theme-border p-4">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h3 class="text-md font-semibold theme-text-primary">Shift Snapshot</h3>
                    <p class="text-sm theme-text-secondary mt-1">
                      {selectedShiftMetrics.stageCode}-{selectedShiftMetrics.shiftCode} · Plant {selectedShiftMetrics.plantCode}
                    </p>
                  </div>
                  <div class="text-right">
                    <div class="text-xs theme-text-secondary">{selectedShiftMetrics.workOrdersReportedWithLostTime} LT work orders</div>
                    <div class="text-sm theme-text-primary font-semibold">{selectedShiftMetrics.lostTimeMinutesTotal.toFixed(0)} LT mins</div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                  <div class="p-3 rounded-lg border theme-border theme-bg-primary">
                    <div class="text-xs theme-text-secondary">Manpower Total</div>
                    <div class="text-lg font-semibold theme-text-primary">{selectedShiftMetrics.manpowerTotal}</div>
                  </div>
                  <div class="p-3 rounded-lg border theme-border theme-bg-primary">
                    <div class="text-xs theme-text-secondary">Manpower Planned</div>
                    <div class="text-lg font-semibold theme-text-primary">{selectedShiftMetrics.manpowerPlannedAttendance}</div>
                  </div>
                  <div class="p-3 rounded-lg border theme-border theme-bg-primary">
                    <div class="text-xs theme-text-secondary">Manpower Reported</div>
                    <div class="text-lg font-semibold theme-text-primary">{selectedShiftMetrics.manpowerReportedAttendance}</div>
                  </div>
                  <div class="p-3 rounded-lg border theme-border theme-bg-primary">
                    <div class="text-xs theme-text-secondary">WO Planned / Reported</div>
                    <div class="text-lg font-semibold theme-text-primary">
                      {selectedShiftMetrics.workOrdersPlanned} / {selectedShiftMetrics.workOrdersReported}
                    </div>
                  </div>
                </div>

                <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div class="p-3 rounded-lg theme-bg-primary border theme-border">
                    <div class="text-sm font-semibold theme-text-primary">Works</div>
                    <div class="text-sm theme-text-secondary mt-1">
                      Planned: <span class="theme-text-primary font-semibold">{selectedShiftMetrics.worksPlanned}</span>
                      {" "}· Reported: <span class="theme-text-primary font-semibold">{selectedShiftMetrics.worksReported}</span>
                    </div>
                    <div class="text-xs theme-text-secondary mt-2">
                      Reported without lost time: {selectedShiftMetrics.workOrdersReportedWithoutLostTime}
                    </div>
                  </div>

                  <div class="p-3 rounded-lg theme-bg-primary border theme-border">
                    <div class="text-sm font-semibold theme-text-primary">Top Lost-Time Reasons</div>
                    {#if isShiftReasonsLoading}
                      <div class="text-sm theme-text-secondary mt-2">
                        Loading reasons...
                      </div>
                    {:else if selectedShiftMetrics.lostTimeReasonsTop.length === 0}
                      <div class="text-sm theme-text-secondary mt-2">
                        {selectedShiftMetrics.workOrdersReportedWithLostTime > 0
                          ? 'No detailed LT reasons available yet.'
                          : 'No lost time captured for this shift.'}
                      </div>
                    {:else}
                      <div class="mt-2 space-y-1">
                        {#each selectedShiftMetrics.lostTimeReasonsTop.slice(0, 3) as r}
                          <div class="flex items-center justify-between gap-3 text-sm">
                            <div class="min-w-0 truncate theme-text-primary">{r.reason}</div>
                            <div class="theme-text-secondary">
                              {r.workOrderCount} WO · {r.minutesTotal.toFixed(0)} mins
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}

            {#if mode === 'planning' || mode === 'both'}
              <div class="rounded-lg border theme-border p-4">
                <div class="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <h3 class="text-md font-semibold theme-text-primary">Planning Manpower</h3>
                    <p class="text-sm theme-text-secondary mt-1">
                      Attendance + validation for selected date
                    </p>
                  </div>
                  <div class="text-right">
                    {#if isPlanningManpowerLoading}
                      <div class="text-xs theme-text-secondary">Loading...</div>
                    {:else}
                      <div class="text-xs theme-text-secondary">
                        Total: {manpowerPlanData.length}
                      </div>
                    {/if}
                  </div>
                </div>

                {#if isPlanningManpowerLoading}
                  <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                    <span class="theme-text-secondary">Loading planning manpower...</span>
                  </div>
                {:else if manpowerPlanData.length === 0}
                  <div class="text-center py-10">
                    <div class="text-4xl mb-2">👥</div>
                    <p class="theme-text-secondary">No planning manpower data for this stage/shift/date.</p>
                  </div>
                {:else}
                  {@const planMetrics = computeManpowerMetrics(manpowerPlanData)}
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div class="p-3 rounded-lg theme-bg-secondary border theme-border">
                      <div class="text-xs theme-text-secondary">Present</div>
                      <div class="text-lg font-semibold theme-text-primary">{planMetrics.presentCount}</div>
                    </div>
                    <div class="p-3 rounded-lg theme-bg-secondary border theme-border">
                      <div class="text-xs theme-text-secondary">Absent</div>
                      <div class="text-lg font-semibold theme-text-primary">{planMetrics.absentCount}</div>
                    </div>
                    <div class="p-3 rounded-lg theme-bg-secondary border theme-border">
                      <div class="text-xs theme-text-secondary">Planned Hours</div>
                      <div class="text-lg font-semibold theme-text-primary">{planMetrics.plannedHoursTotal.toFixed(1)}h</div>
                    </div>
                  </div>

                  <div class="rounded-lg theme-bg-secondary border theme-border p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="font-medium theme-text-primary">Planning Validation</div>
                      {#if planningValidation}
                        {#if planningValidation.isValid}
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            OK
                          </span>
                        {:else}
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            Needs attention
                          </span>
                        {/if}
                      {/if}
                    </div>

                    {#if planningValidation}
                      {#if planningValidation.errors.length > 0}
                        <div class="mt-3">
                          <div class="text-sm font-medium text-red-700 dark:text-red-300">Errors</div>
                          <ul class="mt-2 space-y-1 text-sm">
                            {#each planningValidation.errors.slice(0, 5) as err}
                              <li class="theme-text-primary">- {err}</li>
                            {/each}
                            {#if planningValidation.errors.length > 5}
                              <li class="theme-text-secondary text-xs">
                                +{planningValidation.errors.length - 5} more
                              </li>
                            {/if}
                          </ul>
                        </div>
                      {/if}

                      {#if planningValidation.warnings.length > 0}
                        <div class="mt-4">
                          <div class="text-sm font-medium text-orange-700 dark:text-orange-300">Warnings</div>
                          <ul class="mt-2 space-y-1 text-sm">
                            {#each planningValidation.warnings.slice(0, 5) as w}
                              <li class="theme-text-primary">- {w}</li>
                            {/each}
                            {#if planningValidation.warnings.length > 5}
                              <li class="theme-text-secondary text-xs">
                                +{planningValidation.warnings.length - 5} more
                              </li>
                            {/if}
                          </ul>
                        </div>
                      {/if}
                    {:else}
                      <div class="mt-3 text-sm theme-text-secondary">No validation result available.</div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}

            {#if mode === 'reporting' || mode === 'both'}
              <div class="rounded-lg border theme-border p-4">
                <div class="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <h3 class="text-md font-semibold theme-text-primary">Reporting Manpower</h3>
                    <p class="text-sm theme-text-secondary mt-1">
                      Attendance + validation for selected date
                    </p>
                  </div>
                  <div class="text-right">
                    {#if isReportingManpowerLoading}
                      <div class="text-xs theme-text-secondary">Loading...</div>
                    {:else}
                      <div class="text-xs theme-text-secondary">
                        Total: {manpowerReportData.length}
                      </div>
                    {/if}
                  </div>
                </div>

                {#if isReportingManpowerLoading}
                  <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                    <span class="theme-text-secondary">Loading reporting manpower...</span>
                  </div>
                {:else if manpowerReportData.length === 0}
                  <div class="text-center py-10">
                    <div class="text-4xl mb-2">📊</div>
                    <p class="theme-text-secondary">No reporting manpower data for this stage/shift/date.</p>
                  </div>
                {:else}
                  {@const reportMetrics = computeManpowerMetrics(manpowerReportData)}
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div class="p-3 rounded-lg theme-bg-secondary border theme-border">
                      <div class="text-xs theme-text-secondary">Present</div>
                      <div class="text-lg font-semibold theme-text-primary">{reportMetrics.presentCount}</div>
                    </div>
                    <div class="p-3 rounded-lg theme-bg-secondary border theme-border">
                      <div class="text-xs theme-text-secondary">Absent</div>
                      <div class="text-lg font-semibold theme-text-primary">{reportMetrics.absentCount}</div>
                    </div>
                    <div class="p-3 rounded-lg theme-bg-secondary border theme-border">
                      <div class="text-xs theme-text-secondary">Actual Hours</div>
                      <div class="text-lg font-semibold theme-text-primary">{reportMetrics.actualHoursTotal.toFixed(1)}h</div>
                    </div>
                  </div>

                  <div class="rounded-lg theme-bg-secondary border theme-border p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="font-medium theme-text-primary">Reporting Validation</div>
                      {#if reportingValidation}
                        {#if reportingValidation.isValid}
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            OK
                          </span>
                        {:else}
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            Needs attention
                          </span>
                        {/if}
                      {/if}
                    </div>

                    {#if reportingValidation}
                      {#if reportingValidation.errors.length > 0}
                        <div class="mt-3">
                          <div class="text-sm font-medium text-red-700 dark:text-red-300">Errors</div>
                          <ul class="mt-2 space-y-1 text-sm">
                            {#each reportingValidation.errors.slice(0, 5) as err}
                              <li class="theme-text-primary">- {err}</li>
                            {/each}
                            {#if reportingValidation.errors.length > 5}
                              <li class="theme-text-secondary text-xs">
                                +{reportingValidation.errors.length - 5} more
                              </li>
                            {/if}
                          </ul>
                        </div>
                      {/if}

                      {#if reportingValidation.warnings.length > 0}
                        <div class="mt-4">
                          <div class="text-sm font-medium text-orange-700 dark:text-orange-300">Warnings</div>
                          <ul class="mt-2 space-y-1 text-sm">
                            {#each reportingValidation.warnings.slice(0, 5) as w}
                              <li class="theme-text-primary">- {w}</li>
                            {/each}
                            {#if reportingValidation.warnings.length > 5}
                              <li class="theme-text-secondary text-xs">
                                +{reportingValidation.warnings.length - 5} more
                              </li>
                            {/if}
                          </ul>
                        </div>
                      {/if}
                    {:else}
                      <div class="mt-3 text-sm theme-text-secondary">No validation result available.</div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Compact drill-down helper -->
            {#if selectedStageCode && selectedShiftCode}
              <div class="rounded-lg theme-bg-secondary border theme-border p-4">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-sm theme-text-secondary">Drill-down shortcut</div>
                    <div class="text-lg font-semibold theme-text-primary mt-1">
                      {selectedStageCode}-{selectedShiftCode}
                    </div>
                    <p class="text-sm theme-text-secondary mt-1">
                      Open the existing tabbed page to view Work Orders, Plan, Manpower, and Reports.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    on:click={() => goto(`/production/${selectedStageCode}-${selectedShiftCode}`)}
                  >
                    Go to Tabs
                  </Button>
                </div>
              </div>
            {/if}
          </div>
        </section>
      </div>

      <!-- Pending submissions -->
      <section class="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="theme-bg-primary border theme-border rounded-lg shadow overflow-hidden">
          <div class="p-4 border-b theme-border">
            <h3 class="text-lg font-semibold theme-text-primary">Pending Planning Submissions</h3>
            <p class="text-sm theme-text-secondary mt-1">Across all stages for {new Date(selectedDate).toLocaleDateString('en-GB')}</p>
          </div>
          <div class="p-4">
            {#if isApprovalsLoading}
              <div class="flex items-center justify-center py-10">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                <span class="theme-text-secondary">Loading pending submissions...</span>
              </div>
            {:else if pendingPlanningSubmissions.length === 0}
              <div class="text-center py-10">
                <div class="text-4xl mb-2">✅</div>
                <p class="theme-text-secondary">No pending planning approvals.</p>
              </div>
            {:else}
              <div class="space-y-2 max-h-[30vh] overflow-auto pr-2">
                {#each pendingPlanningSubmissions as sub (sub.id)}
                  <button
                    type="button"
                    on:click={() => {
                      // Select the first configured shift for this stage (planner flow is stage-centric)
                      const first = stageShifts.find(p => p.stageCode === sub.stage_code);
                      if (first) handleSelectStageShift(first);
                    }}
                    class="w-full text-left p-3 rounded-lg border theme-border transition-colors hover:theme-bg-tertiary"
                  >
                    <div class="font-medium theme-text-primary">
                      {sub.stage_code}
                      {#if sub.version && sub.version > 1}
                        <span class="text-xs theme-text-secondary font-normal"> (v{sub.version})</span>
                      {/if}
                    </div>
                    <div class="text-xs theme-text-secondary mt-1">
                      Submitted by {sub.submitted_by} | {sub.submitted_dt ? new Date(sub.submitted_dt).toLocaleString() : '—'}
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <div class="theme-bg-primary border theme-border rounded-lg shadow overflow-hidden">
          <div class="p-4 border-b theme-border">
            <h3 class="text-lg font-semibold theme-text-primary">Pending Reporting Submissions</h3>
            <p class="text-sm theme-text-secondary mt-1">Across all stages for {new Date(selectedDate).toLocaleDateString('en-GB')}</p>
          </div>
          <div class="p-4">
            {#if isApprovalsLoading}
              <div class="flex items-center justify-center py-10">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                <span class="theme-text-secondary">Loading pending submissions...</span>
              </div>
            {:else if pendingReportingSubmissions.length === 0}
              <div class="text-center py-10">
                <div class="text-4xl mb-2">✅</div>
                <p class="theme-text-secondary">No pending reporting approvals.</p>
              </div>
            {:else}
              <div class="space-y-2 max-h-[30vh] overflow-auto pr-2">
                {#each pendingReportingSubmissions as sub (sub.id)}
                  <button
                    type="button"
                    on:click={() => {
                      // Select the first configured shift for this stage (reporting flow is stage-centric too)
                      const first = stageShifts.find(p => p.stageCode === sub.stage_code);
                      if (first) handleSelectStageShift(first);
                    }}
                    class="w-full text-left p-3 rounded-lg border theme-border transition-colors hover:theme-bg-tertiary"
                  >
                    <div class="font-medium theme-text-primary">
                      {sub.stage_code}
                      {#if sub.version && sub.version > 1}
                        <span class="text-xs theme-text-secondary font-normal"> (v{sub.version})</span>
                      {/if}
                    </div>
                    <div class="text-xs theme-text-secondary mt-1">
                      Submitted by {sub.submitted_by} | {sub.submitted_dt ? new Date(sub.submitted_dt).toLocaleString() : '—'}
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </section>
    {/if}
  </div>

  <FloatingThemeToggle />

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
</div>

<style>
  :global(.scrollbar-thin) {
    scrollbar-width: thin;
  }
</style>

