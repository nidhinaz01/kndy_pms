<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';
  import { loadWorkers, loadStandardTime, loadLostTimeReasons, loadShiftInfo, loadAverageEmployeeSalary, checkMultiSkillReportConflicts } from '$lib/services/multiSkillReportService';
  import { saveMultiSkillReports, updatePlanningStatus, updateProductionDatesIfFirstReport, updateWorkStatus } from '$lib/services/multiSkillReportSaveService';
  import { calculateActualTime, calculateLostTime } from '$lib/utils/multiSkillReportUtils';
  import { validateSave } from '$lib/utils/multiSkillReportValidation';
  import type { MultiSkillReportFormData, MultiSkillReportState } from '$lib/types/multiSkillReport';
  import { initialMultiSkillReportFormData, initialMultiSkillReportState } from '$lib/types/multiSkillReport';
  import type { RowTimeOverride } from '$lib/types/planWork';
  import { calculatePlannedHours } from '$lib/utils/planWorkUtils';
  import type { LostTimeReason } from '$lib/api/lostTimeReasons';
  import { supabase } from '$lib/supabaseClient';
  import WorkDetailsDisplay from './multi-skill-report/WorkDetailsDisplay.svelte';
  import EmployeeAssignment from './multi-skill-report/EmployeeAssignment.svelte';
  import SharedTimeSelection from './multi-skill-report/SharedTimeSelection.svelte';
  import LostTimeSection from './multi-skill-report/LostTimeSection.svelte';

  export let isOpen: boolean = false;
  export let selectedWorks: any[] = [];
  export let stageCode: string = '';
  export let shiftCode: string = '';
  export let reportingDate: string = '';

  const dispatch = createEventDispatcher();

  // Form data and state
  let formData: MultiSkillReportFormData = { ...initialMultiSkillReportFormData };
  let state: MultiSkillReportState = { ...initialMultiSkillReportState };

  // Modal state
  let isLoading = false;
  let availableWorkers: any[] = [];
  let lostTimeReasons: LostTimeReason[] = [];
  let shiftInfo: any = null;
  let skillEmployeesString = '';
  let previousSkillEmployeesString = '';
  let isLoadingSalary = false;

  function isTraineePlanningWork(work: any): boolean {
    const n = work?.notes ?? work?.prdn_work_planning?.notes;
    return typeof n === 'string' && n.trim().startsWith('Trainee:');
  }

  $: skillPlanningWorks = selectedWorks.filter((w: any) => !isTraineePlanningWork(w));

  function normReportTime(timeStr: string): string {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return timeStr;
  }

  // Watch for selectedWorks changes
  $: if (selectedWorks.length > 0 && isOpen) {
    console.log('MultiSkillReportModal: Selected works changed:', selectedWorks);
    
    // Fix 2: Validate selectedWorks to ensure they're all for the same work order
    // This prevents using stale data from previous modal opens
    const firstWoDetailsId = selectedWorks[0]?.wo_details_id || selectedWorks[0]?.prdn_wo_details_id;
    if (firstWoDetailsId) {
      // Filter out any works that don't match the first work's work order
      const validWorks = selectedWorks.filter((work: any) => {
        const workWoDetailsId = work.wo_details_id || work.prdn_wo_details_id;
        return workWoDetailsId === firstWoDetailsId;
      });
      
      if (validWorks.length !== selectedWorks.length) {
        console.warn('MultiSkillReportModal: Some works have mismatched work order IDs, filtering them out');
        // Note: We can't directly modify the prop, but the validation will prevent issues
      }
    }
    
    initializeForm();
    loadAllData();
  }

  // Watch for date changes to reload workers and shift info
  $: if (formData.fromDate) {
    loadWorkersData();
    loadShiftInfoData();
  }

  // Check if this is a non-standard work (code starts with OW or has other_work_code)
  $: firstSkillOrWork = skillPlanningWorks[0] || selectedWorks[0];
  $: isNonStandardWork = !!firstSkillOrWork && (
    firstSkillOrWork?.other_work_code ? true : 
    (firstSkillOrWork?.std_work_type_details?.derived_sw_code?.startsWith('OW') || 
     firstSkillOrWork?.std_work_type_details?.sw_code?.startsWith('OW') || false)
  );

  // Reactive calculation of actual time (only for standard works)
  $: {
    if (formData.fromDate && formData.fromTime && formData.toDate && formData.toTime) {
      state.actualTimeMinutes = calculateActualTime(
        formData.fromDate,
        formData.fromTime,
        formData.toDate,
        formData.toTime,
        shiftInfo?.breakTimes
      );
      
      // Only calculate lost time for standard works (not non-standard works starting with OW)
      if (!isNonStandardWork && state.standardTimeMinutes > 0) {
        // Use max time_worked_till_date across selected works (hours -> minutes)
        const timeWorkedTillDateMinutes =
          skillPlanningWorks.length > 0
            ? Math.max(...skillPlanningWorks.map((w: any) => (w.time_worked_till_date || 0) * 60))
            : 0;
        formData.ltMinutes = calculateLostTime(
          state.standardTimeMinutes,
          state.actualTimeMinutes,
          timeWorkedTillDateMinutes
        );
        state.showLostTimeSection = formData.ltMinutes > 0;
      } else {
        // For non-standard works, set lost time to 0 and don't show lost time section
        formData.ltMinutes = 0;
        state.showLostTimeSection = false;
      }
    } else {
      state.actualTimeMinutes = 0;
      formData.ltMinutes = 0;
      state.showLostTimeSection = false;
    }
  }

  // Watch for employee assignments to load salary
  $: skillEmployeesString = JSON.stringify(Object.entries(formData.skillEmployees).sort(([a], [b]) => a.localeCompare(b)));
  
  $: if (skillEmployeesString && skillEmployeesString !== previousSkillEmployeesString && skillEmployeesString !== '{}' && !isLoadingSalary) {
    previousSkillEmployeesString = skillEmployeesString;
    isLoadingSalary = true;
    loadAverageEmployeeSalaryData().finally(() => {
      isLoadingSalary = false;
    });
  }

  // Get selected workers with their salaries for lost time calculation
  let selectedWorkersWithSalaries: Array<{ emp_id: string; emp_name: string; salary: number }> = [];
  
  async function loadSelectedWorkersWithSalaries() {
    const selectedWorkerIds = Object.values(formData.skillEmployees).filter(Boolean) as string[];
    if (selectedWorkerIds.length === 0) {
      selectedWorkersWithSalaries = [];
      return;
    }
    
    try {
      // Fetch salaries for selected workers
      const { data: salaryData, error } = await supabase
        .from('hr_emp')
        .select('emp_id, emp_name, salary')
        .in('emp_id', selectedWorkerIds)
        .eq('is_active', true)
        .eq('is_deleted', false);
      
      if (error) {
        console.error('Error loading worker salaries:', error);
        // Fallback: use availableWorkers data if salary fetch fails
        selectedWorkersWithSalaries = selectedWorkerIds.map(workerId => {
          const worker = availableWorkers.find((w: any) => w.emp_id === workerId);
          return {
            emp_id: workerId,
            emp_name: worker?.emp_name || workerId,
            salary: state.averageEmployeeSalary || 0 // Use average as fallback
          };
        });
        return;
      }
      
      // Map salary data with worker names from availableWorkers
      selectedWorkersWithSalaries = selectedWorkerIds.map(workerId => {
        const salaryRecord = salaryData?.find((s: any) => s.emp_id === workerId);
        const worker = availableWorkers.find((w: any) => w.emp_id === workerId);
        return {
          emp_id: workerId,
          emp_name: worker?.emp_name || salaryRecord?.emp_name || workerId,
          salary: salaryRecord?.salary || state.averageEmployeeSalary || 0
        };
      });
    } catch (error) {
      console.error('Error loading worker salaries:', error);
      // Fallback: use availableWorkers data
      selectedWorkersWithSalaries = selectedWorkerIds.map(workerId => {
        const worker = availableWorkers.find((w: any) => w.emp_id === workerId);
        return {
          emp_id: workerId,
          emp_name: worker?.emp_name || workerId,
          salary: state.averageEmployeeSalary || 0
        };
      });
    }
  }
  
  // Track previous skill employees string for worker salary loading
  let previousSkillEmployeesForSalaries = '';
  
  // Load worker salaries when workers are selected
  $: if (skillEmployeesString && skillEmployeesString !== previousSkillEmployeesForSalaries && skillEmployeesString !== '{}') {
    console.log('🔄 Loading worker salaries for:', skillEmployeesString);
    previousSkillEmployeesForSalaries = skillEmployeesString;
    loadSelectedWorkersWithSalaries();
  }
  
  // Also load workers when moving to stage 2 (lost time section)
  $: if (state.currentStage === 2 && Object.values(formData.skillEmployees).filter(Boolean).length > 0 && selectedWorkersWithSalaries.length === 0) {
    console.log('🔄 Stage 2 detected, loading worker salaries...');
    loadSelectedWorkersWithSalaries();
  }
  
  // Debug: log when selectedWorkersWithSalaries changes
  $: if (selectedWorkersWithSalaries.length > 0) {
    console.log('✅ Selected workers with salaries loaded:', selectedWorkersWithSalaries.map(w => ({ name: w.emp_name, salary: w.salary })));
  } else if (Object.values(formData.skillEmployees).filter(Boolean).length > 0 && state.currentStage === 2) {
    console.log('⚠️ No workers with salaries found, but workers are selected. Selected IDs:', Object.values(formData.skillEmployees).filter(Boolean));
  }

  // Check if lost time is properly allocated
  $: isLostTimeValid = !state.showLostTimeSection || formData.ltMinutes === 0 || 
    (formData.breakdownData.breakdownItems.length > 0 && 
     formData.breakdownData.breakdownItems.every(item => item.reasonId > 0) &&
     formData.breakdownData.breakdownItems.reduce((sum, item) => sum + item.minutes, 0) === formData.ltMinutes) ||
    (formData.breakdownData.breakdownItems.length === 0 && formData.ltReasonId);

  async function loadAllData() {
    if (!selectedWorks.length) return;
    
    isLoading = true;
    try {
      await Promise.all([
        loadStandardTimeData(),
        loadLostTimeReasonsData()
      ]);
    } finally {
      isLoading = false;
    }
  }

  async function loadWorkersData() {
    const w0 = skillPlanningWorks[0] || selectedWorks[0];
    if (!w0?.stage_code || !formData.fromDate) return;
    const worksForLoad = skillPlanningWorks.length ? skillPlanningWorks : selectedWorks;
    availableWorkers = await loadWorkers(w0.stage_code, formData.fromDate, worksForLoad, shiftCode);
  }

  async function loadStandardTimeData() {
    const works = skillPlanningWorks.length ? skillPlanningWorks : selectedWorks;
    state.standardTimeMinutes = await loadStandardTime(works);
  }

  async function loadLostTimeReasonsData() {
    lostTimeReasons = await loadLostTimeReasons();
  }

  async function loadShiftInfoData() {
    const w0 = skillPlanningWorks[0] || selectedWorks[0];
    if (!w0?.stage_code || !formData.fromDate) return;
    shiftInfo = await loadShiftInfo(w0.stage_code, formData.fromDate);
  }

  async function loadAverageEmployeeSalaryData() {
    const employeeIds = Object.values(formData.skillEmployees).filter(Boolean);
    state.averageEmployeeSalary = await loadAverageEmployeeSalary(employeeIds);
  }

  function initializeForm() {
    if (selectedWorks.length === 0) return;

    const mappingWorks = selectedWorks.filter((w: any) => !isTraineePlanningWork(w));
    const traineeWorks = selectedWorks.filter((w: any) => isTraineePlanningWork(w));

    const firstWork = mappingWorks[0] || selectedWorks[0];
    const fromDates = selectedWorks.map((w: any) => (w.from_date || '').toString().split('T')[0]).filter(Boolean);
    const toDates = selectedWorks.map((w: any) => (w.to_date || '').toString().split('T')[0]).filter(Boolean);

    const allFrom = selectedWorks.map((w: any) => normReportTime(w.from_time || '')).filter(Boolean);
    const allTo = selectedWorks.map((w: any) => normReportTime(w.to_time || '')).filter(Boolean);
    const earliest = allFrom.length ? [...allFrom].sort()[0] : '';
    const latest = allTo.length ? [...allTo].sort().reverse()[0] : '';

    const fromDateStr =
      fromDates.length > 0 ? [...fromDates].sort()[0] : (firstWork.from_date || '').toString().split('T')[0] || '';
    const toDateStr =
      toDates.length > 0 ? [...toDates].sort().reverse()[0] : (firstWork.to_date || '').toString().split('T')[0] || '';

    formData = {
      ...initialMultiSkillReportFormData,
      fromDate: fromDateStr,
      fromTime: earliest || normReportTime(firstWork.from_time || ''),
      toDate: toDateStr,
      toTime: latest || normReportTime(firstWork.to_time || ''),
      plannedHours: calculatePlannedHours(
        earliest || normReportTime(firstWork.from_time || ''),
        latest || normReportTime(firstWork.to_time || '')
      ),
      rowTimeOverrides: {}
    };

    formData.skillEmployees = {};
    formData.deviations = {};

    mappingWorks.forEach((work: any) => {
      formData.skillEmployees[work.id] = work.worker_id || '';
      formData.deviations[work.id] = {
        hasDeviation: false,
        reason: '',
        deviationType: 'no_worker'
      };
    });

    const gFrom = normReportTime(formData.fromTime);
    const gTo = normReportTime(formData.toTime);
    const overrides: Record<string, RowTimeOverride> = {};
    mappingWorks.forEach((w: any) => {
      const pf = normReportTime(w.from_time);
      const pt = normReportTime(w.to_time);
      if (pf && pt && (pf !== gFrom || pt !== gTo)) {
        overrides[String(w.id)] = { useCustom: true, fromTime: pf, toTime: pt };
      }
    });

    const sortedTrainees = [...traineeWorks].sort(
      (a: any, b: any) => Number(a.id ?? 0) - Number(b.id ?? 0)
    );
    formData.selectedTrainees = sortedTrainees.map((w: any) => ({
      emp_id: String(w.worker_id || w.hr_emp?.emp_id || ''),
      emp_name:
        w.hr_emp?.emp_name ||
        (typeof w.notes === 'string' ? w.notes.replace(/^Trainee:\s*/i, '').trim() : '') ||
        'Unknown',
      skill_short: w.hr_emp?.skill_short || 'T',
      reporting_id: w.reporting_id,
      planning_id: w.id
    }));

    sortedTrainees.forEach((w: any, ti: number) => {
      const pf = normReportTime(w.from_time);
      const pt = normReportTime(w.to_time);
      if (pf && pt && (pf !== gFrom || pt !== gTo)) {
        overrides[`trainee-${ti}`] = { useCustom: true, fromTime: pf, toTime: pt };
      }
    });

    formData.rowTimeOverrides = overrides;
    formData.traineeDeviationReason = '';

    void traineeDeviationPrefetch(sortedTrainees);

    state = { ...initialMultiSkillReportState };
  }

  async function traineeDeviationPrefetch(traineeWorks: any[]) {
    const ids = traineeWorks
      .map((w: any) => w.id)
      .filter((id: any) => id != null && id !== '');
    if (ids.length === 0) return;
    const { data, error } = await supabase
      .from('prdn_work_planning_deviations')
      .select('reason')
      .eq('deviation_type', 'trainee_addition')
      .in('planning_id', ids as number[])
      .eq('is_active', true)
      .eq('is_deleted', false)
      .limit(1);
    const reason = Array.isArray(data) && data[0]?.reason ? data[0].reason : null;
    if (!error && reason) {
      formData.traineeDeviationReason = reason;
      formData = { ...formData };
    }
  }

  function proceedToStage2() {
    const validation = validateSave(formData, skillPlanningWorks, isNonStandardWork);
    if (!validation.isValid) {
      alert(Object.values(validation.errors)[0]);
      return;
    }

    // For non-standard works, skip lost time section and go directly to save
    if (isNonStandardWork) {
      handleSave();
      return;
    }

    state.currentStage = 2;
  }

  function goBackToStage1() {
    state.currentStage = 1;
  }

  async function handleSave() {
    console.log('🔵 handleSave called');
    console.log('📊 Current state:', { 
      isLoading, 
      stageCode, 
      reportingDate, 
      skillEmployees: formData.skillEmployees,
      selectedWorksCount: selectedWorks.length
    });
    
    if (isLoading) {
      console.log('⏸️ Already loading, returning');
      return;
    }
    
    console.log('✅ Starting validation...', { stageCode, reportingDate, selectedWorkerIds: Object.values(formData.skillEmployees).filter(Boolean) });
    
    let validation;
    try {
      validation = validateSave(formData, skillPlanningWorks, isNonStandardWork);
      console.log('✅ Validation result:', validation);
    } catch (validationError) {
      console.error('❌ Error in validateSave:', validationError);
      alert(`Validation error: ${(validationError as Error).message}`);
      return;
    }
    
    if (!validation.isValid) {
      console.log('❌ Form validation failed:', validation.errors);
      alert(Object.values(validation.errors)[0]);
      return;
    }
    console.log('✅ Form validation passed');

    // Get planning IDs to exclude from conflict check (the ones being reported)
    const planningIds = selectedWorks.map(work => work.id);
    
    // Get reporting IDs to exclude from conflict check (the ones being edited)
    const reportingIds = selectedWorks
      .map(work => work.reporting_id)
      .filter((id): id is number => id !== undefined && id !== null);
    
    const conflictResult = await checkMultiSkillReportConflicts(
      selectedWorks,
      formData,
      planningIds,
      reportingIds.length > 0 ? reportingIds : undefined
    );
    
    if (conflictResult.hasConflict) {
      // If there's a report conflict, BLOCK (cannot proceed)
      if (conflictResult.hasReportConflict) {
        alert(conflictResult.message);
        return;
      }
      // If there's only a plan conflict, WARN (can proceed with confirmation)
      const proceed = confirm(conflictResult.message);
      if (!proceed) return;
    }

    // Validate that all selected workers are marked as present
    const selectedWorkerIds = Object.values(formData.skillEmployees).filter(Boolean) as string[];
    console.log('🔍 Checking attendance for workers:', selectedWorkerIds, 'stageCode:', stageCode, 'reportingDate:', reportingDate);
    
    if (selectedWorkerIds.length > 0 && stageCode && reportingDate) {
      try {
        const dateStr = reportingDate.split('T')[0];
        console.log('📅 Checking attendance for date:', dateStr, 'stage:', stageCode);
        
        const { data: attendanceRecords, error: attendanceError } = await supabase
          .from('prdn_reporting_manpower')
          .select('emp_id, attendance_status')
          .eq('stage_code', stageCode)
          .eq('reporting_date', dateStr)
          .in('emp_id', selectedWorkerIds)
          .eq('is_deleted', false);

        console.log('📊 Attendance records fetched:', attendanceRecords);

        if (attendanceError) {
          console.error('❌ Error checking worker attendance:', attendanceError);
          alert(`Error checking worker attendance: ${attendanceError.message}`);
          return;
        }

        const attendanceMap = new Map(
          (attendanceRecords || []).map((r: any) => [r.emp_id, r.attendance_status])
        );

        const absentWorkers: string[] = [];
        const missingAttendance: string[] = [];

        selectedWorkerIds.forEach((workerId: string) => {
          const attendanceStatus = attendanceMap.get(workerId);
          if (!attendanceStatus) {
            // Worker not found in attendance records
            const worker = availableWorkers.find((w: any) => w.emp_id === workerId);
            const workerName = worker?.emp_name || workerId;
            missingAttendance.push(`${workerName} (${workerId})`);
          } else if (attendanceStatus !== 'present') {
            // Worker is marked as absent
            const worker = availableWorkers.find((w: any) => w.emp_id === workerId);
            const workerName = worker?.emp_name || workerId;
            absentWorkers.push(`${workerName} (${workerId})`);
          }
        });

        if (missingAttendance.length > 0) {
          alert(
            `Cannot save report. The following workers do not have attendance marked:\n\n` +
            `${missingAttendance.join(', ')}\n\n` +
            `Please mark attendance for all workers in the Manpower Report tab before saving.`
          );
          return;
        }

        if (absentWorkers.length > 0) {
          console.log('❌ Found absent workers:', absentWorkers);
          alert(
            `Cannot save report. The following workers are marked as absent:\n\n` +
            `${absentWorkers.join(', ')}\n\n` +
            `Absent workers cannot be included in the report. Please remove them from the worker list before saving.`
          );
          return;
        }
        
        console.log('✅ All workers are present, proceeding with save');
      } catch (error) {
        console.error('❌ Error validating worker attendance:', error);
        alert(`Error validating worker attendance: ${(error as Error).message}`);
        return;
      }
    } else {
      console.log('⚠️ No workers selected, skipping attendance validation');
    }

    console.log('💾 Starting save process...');
    isLoading = true;
    
    try {
      formData.actualTimeMinutes = state.actualTimeMinutes;
      
      const result = await saveMultiSkillReports(selectedWorks, formData, lostTimeReasons);
      if (!result.success) {
        alert('Error saving report: ' + (result.error || 'Unknown error'));
        return;
      }

      if (result.data) {
        await updateProductionDatesIfFirstReport(result.data);

        const planningIds = selectedWorks.map(work => work.id);
        const updateResult = await updatePlanningStatus(planningIds, result.data);
        if (!updateResult.success) {
          alert('Reports created but failed to update planning status: ' + (updateResult.error || 'Unknown error'));
          return;
        }

        await updateWorkStatus(planningIds, formData.completionStatus);
      }

      dispatch('save', {
        success: true,
        message: `Successfully reported ${skillPlanningWorks.length} skill competencies`,
        reportData: result.data
      });

      handleClose();
    } catch (error) {
      console.error('Error saving multi-skill report:', error);
      alert('Error saving report. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  function handleClose() {
    dispatch('close');
    resetForm();
  }

  function resetForm() {
    // Fix 3: Reset all modal state variables when modal closes
    formData = { ...initialMultiSkillReportFormData };
    state = { ...initialMultiSkillReportState };
    availableWorkers = [];
    lostTimeReasons = [];
    shiftInfo = null;
    skillEmployeesString = '';
    previousSkillEmployeesString = '';
    selectedWorkersWithSalaries = [];
    isLoading = false;
    isLoadingSalary = false;
    // Ensure trainees are cleared
    formData.selectedTrainees = [];
    formData.traineeDeviationReason = '';
  }

  function handleEmployeeChange(workId: string, employeeId: string) {
    formData.skillEmployees[workId] = employeeId;
  }

  function handleDeviationChange(workId: string, hasDeviation: boolean, reason: string) {
    if (!formData.deviations[workId]) {
      formData.deviations[workId] = {
        hasDeviation: false,
        reason: '',
        deviationType: 'no_worker'
      };
    }
    formData.deviations[workId] = {
      ...formData.deviations[workId],
      hasDeviation,
      reason: reason.trim()
    };
    formData.deviations = { ...formData.deviations }; // Trigger reactivity
  }

  function handleTraineeAdd(trainee: { emp_id: string; emp_name: string; skill_short: string }) {
    formData.selectedTrainees = [...formData.selectedTrainees, trainee];
    formData = { ...formData }; // Trigger reactivity
  }

  function handleTraineeRemove(index: number) {
    const prevOverrides = formData.rowTimeOverrides || {};
    formData.selectedTrainees = formData.selectedTrainees.filter((_, i) => i !== index);
    if (formData.selectedTrainees.length === 0) {
      formData.traineeDeviationReason = '';
    }
    const ro: Record<string, RowTimeOverride> = {};
    for (const [k, v] of Object.entries(prevOverrides)) {
      if (!k.startsWith('trainee-')) ro[k] = v;
    }
    formData.selectedTrainees.forEach((_, i) => {
      const oldIdx = i < index ? i : i + 1;
      const o = prevOverrides[`trainee-${oldIdx}`];
      if (o) ro[`trainee-${i}`] = o;
    });
    formData.rowTimeOverrides = ro;
    formData = { ...formData };
  }

  function handleTraineeReasonChange(reason: string) {
    formData.traineeDeviationReason = reason;
    formData = { ...formData }; // Trigger reactivity
  }

  function handleDateChange(field: string, value: string) {
    if (field === 'fromDate') formData.fromDate = value;
    if (field === 'toDate') formData.toDate = value;
    formData.plannedHours = calculatePlannedHours(formData.fromTime || '', formData.toTime || '');
    formData = { ...formData };
  }

  function handleTimeChange(field: string, value: string) {
    if (field === 'fromTime') formData.fromTime = value;
    if (field === 'toTime') formData.toTime = value;
    formData.plannedHours = calculatePlannedHours(formData.fromTime || '', formData.toTime || '');
    formData = { ...formData };
  }

  function handleRowTimeOverride(rowKey: string, next: RowTimeOverride | null) {
    const rest = { ...formData.rowTimeOverrides };
    if (next === null) {
      delete rest[rowKey];
    } else {
      rest[rowKey] = next;
    }
    formData.rowTimeOverrides = rest;
    formData = { ...formData };
  }

  function handleStatusChange(value: 'C' | 'NC') {
    formData.completionStatus = value;
  }

  function handleBreakdownChange(event: CustomEvent) {
    formData.breakdownData = event.detail;
  }

  function handleCommentsChange(value: string) {
    formData.ltComments = value;
  }
</script>

{#if isOpen}
  <button 
    class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-[9999] w-full h-full border-none p-0"
    on:click={handleClose}
    aria-label="Close modal"
  ></button>
  
  <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-2xl dark:shadow-black/50 border-2 border-gray-300 dark:border-gray-600 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-4 border-b theme-border">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium theme-text-primary">Multi-Skill Report</h3>
            <div class="flex items-center space-x-4 mt-2">
              <div class="flex items-center space-x-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {state.currentStage >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">1</div>
                <span class="text-sm theme-text-secondary">Assign & Time</span>
              </div>
              {#if !isNonStandardWork}
                <div class="w-8 h-px bg-gray-300 dark:bg-gray-600"></div>
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {state.currentStage >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">2</div>
                  <span class="text-sm theme-text-secondary">Lost Time & Save</span>
                </div>
              {/if}
            </div>
          </div>
          <button
            type="button"
            class="theme-text-secondary hover:theme-text-primary transition-colors"
            on:click={handleClose}
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>

      <div class="px-6 py-4 space-y-6">
        {#if isLoading}
          <div class="text-center py-8">
            <p class="theme-text-secondary">Loading...</p>
          </div>
        {:else if selectedWorks.length > 0}
          <WorkDetailsDisplay 
            selectedWorks={skillPlanningWorks.length ? skillPlanningWorks : selectedWorks}
            standardTimeMinutes={state.standardTimeMinutes}
          />

          {#if state.currentStage === 1}
            <SharedTimeSelection
              {formData}
              actualTimeMinutes={state.actualTimeMinutes}
              onDateChange={handleDateChange}
              onTimeChange={handleTimeChange}
              onStatusChange={handleStatusChange}
            />

            <EmployeeAssignment
              selectedWorks={skillPlanningWorks}
              {availableWorkers}
              {formData}
              shiftInfo={shiftInfo}
              onEmployeeChange={handleEmployeeChange}
              onDeviationChange={handleDeviationChange}
              onTraineeAdd={handleTraineeAdd}
              onTraineeRemove={handleTraineeRemove}
              onTraineeReasonChange={handleTraineeReasonChange}
              onRowTimeOverride={handleRowTimeOverride}
            />
          {/if}

          {#if state.currentStage === 2}
            <LostTimeSection
              {formData}
              {lostTimeReasons}
              averageEmployeeSalary={state.averageEmployeeSalary}
              standardTimeMinutes={state.standardTimeMinutes}
              actualTimeMinutes={state.actualTimeMinutes}
              showLostTimeSection={state.showLostTimeSection}
              workers={selectedWorkersWithSalaries}
              onBreakdownChange={handleBreakdownChange}
              onCommentsChange={handleCommentsChange}
            />
          {/if}
        {/if}
      </div>

      <div class="px-6 py-4 border-t theme-border flex justify-between">
        <div>
          {#if state.currentStage === 2}
            <Button variant="secondary" on:click={goBackToStage1} disabled={isLoading}>
              ← Back to Stage 1
            </Button>
          {/if}
        </div>
        <div class="flex space-x-3">
          <Button variant="secondary" on:click={handleClose}>
            Cancel
          </Button>
          {#if state.currentStage === 1}
            <Button variant="primary" on:click={proceedToStage2} disabled={isLoading || !formData.fromDate || !formData.fromTime || !formData.toDate || !formData.toTime}>
              {isNonStandardWork ? 'Save Report' : 'Next →'}
            </Button>
          {:else if state.currentStage === 2}
            <Button variant="primary" on:click={handleSave} disabled={isLoading || (state.showLostTimeSection && formData.ltMinutes > 0 && !isLostTimeValid)}>
              Save Report
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
