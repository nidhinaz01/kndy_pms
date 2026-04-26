<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';
  import { loadWorkers, loadStandardTime, loadLostTimeReasons, loadShiftInfo, loadAverageEmployeeSalary, checkMultiSkillReportConflicts } from '$lib/services/multiSkillReportService';
  import { saveUnplannedWorkReports } from '$lib/services/unplannedWorkReportSaveService';
  import { calculateActualTime, calculateLostTime } from '$lib/utils/multiSkillReportUtils';
  import { validateSave, validateStage1 } from '$lib/utils/multiSkillReportValidation';
  import {
    getSkillShort,
    getIndividualSkills,
    calculatePlannedHours,
    autoCalculateEndTime,
    findClosestShiftTimeSlot
  } from '$lib/utils/planWorkUtils';
  import type { RowTimeOverride, ShiftInfo } from '$lib/types/planWork';
  import type { MultiSkillReportFormData, MultiSkillReportState } from '$lib/types/multiSkillReport';
  import { initialMultiSkillReportFormData, initialMultiSkillReportState } from '$lib/types/multiSkillReport';
  import type { LostTimeReason } from '$lib/api/lostTimeReasons';
  import { supabase } from '$lib/supabaseClient';
  import { attendanceIsPresent } from '$lib/utils/manpowerAttendanceStatus';
  import { getWorkDisplayCode } from '$lib/utils/workDisplayUtils';
  import WorkDetailsDisplay from '$lib/components/production/multi-skill-report/WorkDetailsDisplay.svelte';
  import EmployeeAssignment from '$lib/components/production/multi-skill-report/EmployeeAssignment.svelte';
  import SharedTimeSelection from '$lib/components/production/multi-skill-report/SharedTimeSelection.svelte';
  import LostTimeSection from '$lib/components/production/multi-skill-report/LostTimeSection.svelte';

  export let isOpen: boolean = false;
  export let selectedWork: any = null;
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
  let workersLoaded = false; // Flag to prevent infinite loop
  let isLoadingWorkers = false; // Flag to prevent concurrent loading
  let lostTimeReasons: LostTimeReason[] = [];
  let shiftInfo: any = null;
  /** Shift breaks for `autoCalculateEndTime` (same as Plan Work modal). */
  let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
  /** Tracks auto-calculated toTime so edits match Plan Work behavior. */
  let lastAutoCalculatedToTime: string | null = null;
  /** When false, `fromTime` is filled from shift start after shift info loads. */
  let userHasSelectedFromTime = false;
  /** Non-standard: when false, `toTime` can default to shift end after shift loads. */
  let userHasSelectedToTime = false;
  let skillEmployeesString = '';
  let previousSkillEmployeesString = '';
  let isLoadingSalary = false;

  // Cumulative "time worked till date" (in hours) per selected worker,
  // loaded from prdn_work_reporting for previous dates.
  // Used for lost-time calculation of standard works.
  let timeWorkedTillDateByWorker: Record<string, number> = {};
  let isLoadingTimeWorkedTillDate = false;
  let previousWorkerSelectionForTillDate = '';

  // Virtual works array - one per skill competency
  let virtualWorks: any[] = [];
  // Selected skill mapping index (for works with multiple skill combinations)
  let selectedSkillMappingIndex: number = -1;
  // Available skill mappings from the work
  let availableSkillMappings: any[] = [];

  // Watch for selectedWork changes
  $: if (selectedWork && isOpen) {
    console.log('UnplannedWorkReportModal: Selected work changed:', selectedWork);
    initializeFormAndLoadData();
  }

  // Removed reactive statement to prevent infinite loop
  // Workers are now loaded explicitly in initializeFormAndLoadData and handleSkillMappingSelect

  // Check if this is a non-standard work
  $: isNonStandardWork = selectedWork && (
    selectedWork.other_work_code ? true : 
    (getWorkDisplayCode(selectedWork)?.startsWith('OW') || false)
  );

  // Auto-calculate toTime from fromTime + standard duration + breaks (aligned with Plan Work modal).
  $: if (formData.fromTime && !isNonStandardWork && state.standardTimeMinutes > 0) {
    // Include lastAutoCalculatedToTime === null so a prefilled toTime (e.g. shift end) still recalculates
    // once standard minutes and breaks are ready, unless the user edited To manually.
    const shouldAuto =
      !userHasSelectedToTime &&
      (!formData.toTime ||
        lastAutoCalculatedToTime === null ||
        formData.toTime === lastAutoCalculatedToTime);
    if (shouldAuto) {
      const calculatedToTime = autoCalculateEndTime(
        formData.fromTime,
        0,
        state.standardTimeMinutes,
        shiftBreakTimes
      );
      if (calculatedToTime && calculatedToTime !== formData.toTime) {
        formData.toTime = calculatedToTime;
        lastAutoCalculatedToTime = calculatedToTime;
        formData = { ...formData };
      }
    }
  }

  // If toTime is before fromTime, span overnight — align toDate (same as Plan Work modal).
  $: if (formData.fromDate && formData.fromTime && formData.toTime) {
    const [fromHour, fromMin] = formData.fromTime.split(':').map(Number);
    const [toHour, toMin] = formData.toTime.split(':').map(Number);
    const fromMinutes = fromHour * 60 + fromMin;
    const toMinutes = toHour * 60 + toMin;

    if (toMinutes < fromMinutes) {
      const fromDateObj = new Date(formData.fromDate);
      fromDateObj.setDate(fromDateObj.getDate() + 1);
      const nextDay = fromDateObj.toISOString().split('T')[0];
      if (formData.toDate !== nextDay) {
        formData.toDate = nextDay;
        formData = { ...formData };
      }
    } else if (formData.toDate !== formData.fromDate) {
      formData.toDate = formData.fromDate;
      formData = { ...formData };
    }
  }

  // Planned hours from current from/to (after auto toTime updates).
  $: {
    const fromTime = formData.fromTime;
    const toTime = formData.toTime;
    if (fromTime && toTime) {
      const h = calculatePlannedHours(fromTime, toTime);
      if (formData.plannedHours !== h) {
        formData.plannedHours = h;
        formData = { ...formData };
      }
    } else if (formData.plannedHours !== 0) {
      formData.plannedHours = 0;
      formData = { ...formData };
    }
  }

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
      
      // Only calculate lost time for standard works
      if (!isNonStandardWork && state.standardTimeMinutes > 0) {
        const workerIds = Object.values(formData.skillEmployees).filter(Boolean) as string[];
        const maxHoursWorkedTillDate = workerIds.length > 0
          ? Math.max(...workerIds.map(id => timeWorkedTillDateByWorker[id] || 0))
          : 0;

        const timeWorkedTillDateMinutes = maxHoursWorkedTillDate * 60;
        formData.ltMinutes = calculateLostTime(
          state.standardTimeMinutes,
          state.actualTimeMinutes,
          timeWorkedTillDateMinutes
        );
        state.showLostTimeSection = formData.ltMinutes > 0;
      } else {
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

  // Load cumulative "time worked till date" for the currently selected workers (previous dates only).
  // This is required for standard-work lost time calculation.
  $: {
    const workerIds = Array.from(
      new Set(Object.values(formData.skillEmployees).filter(Boolean) as string[])
    );
    const workerKey = workerIds.slice().sort().join(',');

    if (!isOpen || !selectedWork || !formData.fromDate || workerIds.length === 0) {
      timeWorkedTillDateByWorker = {};
      previousWorkerSelectionForTillDate = '';
    } else if (workerKey && workerKey !== previousWorkerSelectionForTillDate && !isLoadingTimeWorkedTillDate) {
      previousWorkerSelectionForTillDate = workerKey;
      isLoadingTimeWorkedTillDate = true;
      void loadTimeWorkedTillDateByWorkers(workerIds).finally(() => {
        isLoadingTimeWorkedTillDate = false;
      });
    }
  }

  async function loadTimeWorkedTillDateByWorkers(workerIds: string[]) {
    try {
      if (!selectedWork) return;

      const stageCodeToUse = selectedWork?.stage_code || stageCode;
      const woDetailsId = selectedWork?.wo_details_id || selectedWork?.prdn_wo_details_id;
      const dateStr = (formData.fromDate || '').split('T')[0];

      if (!stageCodeToUse || !woDetailsId || !dateStr || workerIds.length === 0) {
        timeWorkedTillDateByWorker = {};
        return;
      }

      const nonStandard = isNonStandardWork;
      const derivedSwCode = !nonStandard
        ? (selectedWork.derived_sw_code || selectedWork.std_work_type_details?.derived_sw_code || null)
        : null;
      const otherWorkCode = nonStandard
        ? (selectedWork.other_work_code || selectedWork.sw_code || null)
        : null;

      let query = supabase
        .from('prdn_work_reporting')
        .select(`
          worker_id,
          hours_worked_till_date,
          hours_worked_today,
          completion_status,
          from_date,
          prdn_work_planning!inner(
            stage_code,
            wo_details_id,
            derived_sw_code,
            other_work_code
          )
        `)
        .eq('prdn_work_planning.stage_code', stageCodeToUse)
        .eq('prdn_work_planning.wo_details_id', woDetailsId)
        .in('worker_id', workerIds)
        .lt('from_date', dateStr)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('from_date', { ascending: false });

      if (derivedSwCode) {
        query = query.eq('prdn_work_planning.derived_sw_code', derivedSwCode);
      } else if (otherWorkCode) {
        query = query.eq('prdn_work_planning.other_work_code', otherWorkCode);
      } else {
        timeWorkedTillDateByWorker = {};
        return;
      }

      const { data: reports, error } = await query;
      if (error) {
        console.warn('loadTimeWorkedTillDateByWorkers error:', error);
        timeWorkedTillDateByWorker = {};
        return;
      }

      // Since results are ordered by from_date desc, first row per worker is the latest previous report.
      const map: Record<string, number> = {};
      for (const r of reports || []) {
        const wid = r.worker_id;
        if (!wid) continue;
        if (map[wid] !== undefined) continue;

        const totalHours = (Number(r.hours_worked_till_date) || 0) + (Number(r.hours_worked_today) || 0);
        map[wid] = r.completion_status === 'NC' ? totalHours : 0;
      }

      timeWorkedTillDateByWorker = map;
    } catch (e) {
      console.warn('loadTimeWorkedTillDateByWorkers exception:', e);
      timeWorkedTillDateByWorker = {};
    }
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
      const { data: salaryData, error } = await supabase
        .from('hr_emp')
        .select('emp_id, emp_name, salary')
        .in('emp_id', selectedWorkerIds)
        .eq('is_active', true)
        .eq('is_deleted', false);
      
      if (error) {
        console.error('Error loading worker salaries:', error);
        selectedWorkersWithSalaries = selectedWorkerIds.map(workerId => {
          const worker = availableWorkers.find((w: any) => w.emp_id === workerId);
          return {
            emp_id: workerId,
            emp_name: worker?.emp_name || workerId,
            salary: state.averageEmployeeSalary || 0
          };
        });
        return;
      }
      
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
  
  let previousSkillEmployeesForSalaries = '';
  
  $: if (skillEmployeesString && skillEmployeesString !== previousSkillEmployeesForSalaries && skillEmployeesString !== '{}') {
    previousSkillEmployeesForSalaries = skillEmployeesString;
    loadSelectedWorkersWithSalaries();
  }
  
  $: if (state.currentStage === 3 && Object.values(formData.skillEmployees).filter(Boolean).length > 0 && selectedWorkersWithSalaries.length === 0) {
    loadSelectedWorkersWithSalaries();
  }

  // Check if lost time is properly allocated
  $: isLostTimeValid = !state.showLostTimeSection || formData.ltMinutes === 0 || 
    (formData.breakdownData.breakdownItems.length > 0 && 
     formData.breakdownData.breakdownItems.every(item => item.reasonId > 0) &&
     formData.breakdownData.breakdownItems.reduce((sum, item) => sum + item.minutes, 0) === formData.ltMinutes) ||
    (formData.breakdownData.breakdownItems.length === 0 && formData.ltReasonId);

  async function initializeFormAndLoadData() {
    if (!selectedWork) return;
    
    isLoading = true;
    workersLoaded = false; // Reset flag when initializing
    isLoadingWorkers = false; // Reset loading flag
    try {
      console.log('🔍 Initializing form for work:', selectedWork);
      console.log('🔍 Work skill_mappings:', selectedWork.skill_mappings);
      
      // First, try to use skill mappings from the work object (same as Plan Work Modal)
      let skillMappings = selectedWork.skill_mappings || [];
      
      // Check if skill mappings have the full structure (with std_skill_combinations)
      const hasFullStructure = skillMappings.length > 0 && 
        skillMappings.some((m: any) => {
          // Check if mapping has std_skill_combinations with skill_combination
          const hasCombination = m.std_skill_combinations?.skill_combination;
          return hasCombination;
        });
      
      console.log('🔍 Has skill mappings:', skillMappings.length > 0, 'Has full structure:', hasFullStructure);
      
      // If no skill mappings or incomplete structure, fetch them
      if (skillMappings.length === 0 || !hasFullStructure) {
        // Extract derived_sw_code - same way as in productionWorkEnrichmentHelpers
        // The work object from loadStageWorks has std_work_type_details.derived_sw_code
        const derivedSwCode = selectedWork.std_work_type_details?.derived_sw_code || 
                             selectedWork.derived_sw_code ||
                             selectedWork.sw_code; // Fallback to sw_code
        
        console.log('🔍 Derived SW Code:', derivedSwCode);
        console.log('🔍 std_work_type_details:', selectedWork.std_work_type_details);
        console.log('🔍 other_work_code:', selectedWork.other_work_code);
        
        // Only fetch if we have a derived_sw_code and it's not an "other work"
        if (derivedSwCode && !selectedWork.other_work_code) {
          try {
            const { fetchWorkSkillMappingsByDerivedCode } = await import('$lib/api/stdWorkSkillMapping');
            skillMappings = await fetchWorkSkillMappingsByDerivedCode(derivedSwCode);
            console.log('✅ Fetched skill mappings:', skillMappings.length, 'mappings');
            if (skillMappings.length > 0) {
              console.log('📋 First mapping structure:', skillMappings[0]);
              console.log('📋 Has std_skill_combinations:', !!skillMappings[0].std_skill_combinations);
            } else {
              console.warn('⚠️ No skill mappings found for derived_sw_code:', derivedSwCode);
            }
          } catch (error) {
            console.error('❌ Error fetching skill mappings:', error);
            skillMappings = [];
          }
        } else {
          if (!derivedSwCode) {
            console.warn('⚠️ Cannot fetch skill mappings - missing derivedSwCode');
          }
          if (selectedWork.other_work_code) {
            console.log('ℹ️ Work has other_work_code, treating as non-standard work');
          }
        }
      } else {
        console.log('✅ Using existing skill_mappings from work object');
      }
      
      // Store available skill mappings
      availableSkillMappings = skillMappings;
      
      // If multiple skill mappings, require user to select one first
      if (skillMappings.length > 1) {
        console.log('📋 Multiple skill mappings found, user must select one');
        selectedSkillMappingIndex = -1; // Reset to require selection
        virtualWorks = []; // Don't create virtual works yet
      } else if (skillMappings.length === 1) {
        console.log('📋 Single skill mapping found, auto-selecting');
        // Auto-select the only skill mapping
        selectedSkillMappingIndex = 0;
        // Create virtual works from this single mapping
        virtualWorks = createVirtualWorksFromMapping(skillMappings[0], 0);
        console.log('📋 Created virtualWorks:', virtualWorks.length, virtualWorks);
      } else {
        // No skill mappings - create a single virtual work for non-standard work
        selectedSkillMappingIndex = -1;
        virtualWorks = [{
          id: 'virtual_non_standard',
          wsm_id: null,
          sc_required: 'T',
          sc_name: 'Non-Standard Work',
          wo_details_id: selectedWork.wo_details_id || selectedWork.prdn_wo_details_id,
          derived_sw_code: null,
          other_work_code: selectedWork.other_work_code || selectedWork.sw_code,
          stage_code: selectedWork.stage_code || stageCode,
          from_date: reportingDate || '',
          from_time: '08:00',
          to_date: reportingDate || '',
          to_time: '17:00'
        }];
      }

      const nonStd = !!(
        selectedWork.other_work_code ||
        getWorkDisplayCode(selectedWork)?.startsWith('OW')
      );

      // Initialize form data (standard works: toTime filled by auto-calc once standard time + breaks load)
      lastAutoCalculatedToTime = null;
      userHasSelectedFromTime = false;
      userHasSelectedToTime = false;
      formData = {
        ...initialMultiSkillReportFormData,
        fromDate: reportingDate || '',
        // Placeholder until shift info loads (then shift start / non-std shift end).
        fromTime: '08:00',
        toDate: reportingDate || '',
        toTime: nonStd ? '17:00' : '',
        plannedHours: nonStd ? calculatePlannedHours('08:00', '17:00') : 0,
        rowTimeOverrides: {}
      };
      
      formData.skillEmployees = {};
      formData.deviations = {};
      formData.selectedTrainees = [];
      formData.traineeDeviationReason = '';
      
      // Initialize employee assignments for each virtual work
      virtualWorks.forEach(work => {
        formData.skillEmployees[work.id] = '';
        formData.deviations[work.id] = {
          hasDeviation: false,
          reason: '',
          deviationType: 'no_worker'
        };
      });
      
      state = { ...initialMultiSkillReportState };
      
      // Now load all other data (only if virtualWorks are created)
      if (virtualWorks.length > 0) {
        await Promise.all([
          loadStandardTimeData(),
          loadLostTimeReasonsData(),
          loadWorkersData(),
          loadShiftInfoData()
        ]);
      }
    } catch (error) {
      console.error('Error initializing form:', error);
      alert('Error loading work data. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  // Helper function to create virtual works from a selected skill mapping
  function createVirtualWorksFromMapping(mapping: any, mappingIndex: number): any[] {
    // Extract skill combination to get individual skills
    const individualSkills = getIndividualSkills(mapping);
    
    // Create one virtual work per skill in the combination
    return individualSkills.map((skillShort: string, index: number) => {
      return {
        id: `virtual_${mapping.wsm_id}_${mappingIndex}_${index}`,
        wsm_id: mapping.wsm_id,
        sc_required: skillShort,
        sc_name: mapping.sc_name,
        std_work_skill_mapping: mapping,
        wo_details_id: selectedWork.wo_details_id || selectedWork.prdn_wo_details_id,
        wo_no: selectedWork.wo_no || selectedWork.prdn_wo_details?.wo_no,
        pwo_no: selectedWork.pwo_no || selectedWork.prdn_wo_details?.pwo_no,
        derived_sw_code: selectedWork.derived_sw_code || selectedWork.std_work_type_details?.derived_sw_code,
        other_work_code: selectedWork.other_work_code,
        stage_code: selectedWork.stage_code || stageCode,
        // Include work name and std_work_type_details for WorkDetailsDisplay
        sw_name: selectedWork.sw_name,
        std_work_type_details: selectedWork.std_work_type_details || {
          derived_sw_code: selectedWork.derived_sw_code || selectedWork.std_work_type_details?.derived_sw_code,
          type_description: selectedWork.std_work_type_details?.type_description,
          std_work_details: selectedWork.std_work_type_details?.std_work_details || {
            sw_name: selectedWork.sw_name
          }
        },
        from_date: reportingDate || '',
        from_time: '08:00',
        to_date: reportingDate || '',
        to_time: '17:00'
      };
    });
  }

  // Handle skill mapping selection
  async function handleSkillMappingSelect(index: number) {
    console.log('🎯 handleSkillMappingSelect called with index:', index);
    selectedSkillMappingIndex = index;
    userHasSelectedFromTime = false;
    userHasSelectedToTime = false;
    workersLoaded = false; // Reset flag when skill mapping changes
    isLoadingWorkers = false; // Reset loading flag
    
    // Create virtual works from the selected mapping
    const selectedMapping = availableSkillMappings[index];
    virtualWorks = createVirtualWorksFromMapping(selectedMapping, index);
    
    // Initialize employee assignments for each virtual work
    formData.skillEmployees = {};
    formData.deviations = {};
    
    virtualWorks.forEach(work => {
      formData.skillEmployees[work.id] = '';
      formData.deviations[work.id] = {
        hasDeviation: false,
        reason: '',
        deviationType: 'no_worker'
      };
    });
    
    // Load standard time, lost time reasons, and workers for the selected combination
    await Promise.all([
      loadStandardTimeData(),
      loadLostTimeReasonsData(),
      loadWorkersData(),
      loadShiftInfoData()
    ]);
  }

  async function loadWorkersData() {
    // Use stageCode prop if selectedWork.stage_code is not available
    const stageCodeToUse = selectedWork?.stage_code || stageCode;
    
    if (!stageCodeToUse || !formData.fromDate) {
      console.log('⚠️ loadWorkersData: Missing required data', {
        stage_code: stageCodeToUse,
        fromDate: formData.fromDate,
        selectedWork_stage_code: selectedWork?.stage_code,
        stageCode_prop: stageCode
      });
      return;
    }
    
    // Prevent re-loading if already loaded or currently loading
    if (workersLoaded || isLoadingWorkers) {
      return;
    }
    
    isLoadingWorkers = true; // Set loading flag
    try {
      console.log('👥 Loading workers for stage:', stageCodeToUse, 'date:', formData.fromDate, 'virtualWorks:', virtualWorks.length);
      // Create virtual works array for loadWorkers
      availableWorkers = await loadWorkers(stageCodeToUse, formData.fromDate, virtualWorks, shiftCode);
      workersLoaded = true; // Mark as loaded
      console.log('✅ Loaded workers:', availableWorkers.length);
    } finally {
      isLoadingWorkers = false; // Clear loading flag
    }
  }

  async function loadStandardTimeData() {
    if (!selectedWork || virtualWorks.length === 0) return;
    console.log('⏱️ Loading standard time for virtualWorks:', virtualWorks.length, 'first work:', virtualWorks[0]);
    // Create virtual works array for loadStandardTime
    state.standardTimeMinutes = await loadStandardTime(virtualWorks);
    console.log('⏱️ Standard time loaded:', state.standardTimeMinutes, 'minutes');
  }

  async function loadLostTimeReasonsData() {
    lostTimeReasons = await loadLostTimeReasons();
  }

  async function loadShiftInfoData() {
    const stageCodeToUse = selectedWork?.stage_code || stageCode;
    if (!stageCodeToUse || !formData.fromDate) return;
    shiftInfo = await loadShiftInfo(stageCodeToUse, formData.fromDate);

    if (shiftInfo?.hr_shift_master?.shift_id) {
      const { data: breakData, error: breakError } = await supabase
        .from('hr_shift_break_master')
        .select('*')
        .eq('shift_id', shiftInfo.hr_shift_master.shift_id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('break_number');

      if (!breakError && breakData) {
        shiftBreakTimes = breakData.map((b: any) => ({
          start_time: b.start_time,
          end_time: b.end_time
        }));
      } else {
        shiftBreakTimes = [];
      }
    } else {
      shiftBreakTimes = [];
    }

    applyShiftTimesFromLoadedShift();
  }

  /** Default from/to from shift master (Plan Work–style slots). Standard `to` comes from auto-calc reactives. */
  function applyShiftTimesFromLoadedShift() {
    const sm = shiftInfo?.hr_shift_master;
    if (!sm?.start_time || !sm?.end_time) return;

    let changed = false;

    if (!userHasSelectedFromTime) {
      const fromSlot = findClosestShiftTimeSlot(sm.start_time, sm.start_time, sm.end_time);
      if (fromSlot && formData.fromTime !== fromSlot) {
        lastAutoCalculatedToTime = null;
        formData.fromTime = fromSlot;
        changed = true;
      }
    }

    if (isNonStandardWork && !userHasSelectedToTime) {
      const toSlot = findClosestShiftTimeSlot(sm.end_time, sm.start_time, sm.end_time);
      if (toSlot && formData.toTime !== toSlot) {
        formData.toTime = toSlot;
        changed = true;
      }
    }

    if (changed) formData = { ...formData };
  }

  async function loadAverageEmployeeSalaryData() {
    const employeeIds = Object.values(formData.skillEmployees).filter(Boolean);
    state.averageEmployeeSalary = await loadAverageEmployeeSalary(employeeIds);
  }

  function proceedFromStage1To2() {
    if (availableSkillMappings.length > 1 && selectedSkillMappingIndex < 0) {
      alert('Please select a skill combination before continuing.');
      return;
    }
    if (virtualWorks.length === 0) {
      alert('Work setup is not ready yet. Please wait or try again.');
      return;
    }
    if (!formData.fromDate || !formData.fromTime || !formData.toDate || !formData.toTime) {
      alert('Please set the full date and time range.');
      return;
    }
    state.currentStage = 2;
  }

  function proceedFromStage2To3() {
    const validation = validateStage1(formData, virtualWorks);
    if (!validation.isValid) {
      alert(Object.values(validation.errors)[0]);
      return;
    }

    if (isNonStandardWork) {
      handleSave();
      return;
    }

    if (isLoadingTimeWorkedTillDate) {
      alert('Please wait while loading previous time (used for lost time calculation).');
      return;
    }

    state.currentStage = 3;
  }

  function goBackToStage1() {
    state.currentStage = 1;
  }

  function goBackToStage2() {
    state.currentStage = 2;
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

  async function handleSave() {
    if (isLoading) return;
    
    let validation;
    try {
      validation = validateSave(formData, virtualWorks, isNonStandardWork);
    } catch (validationError) {
      alert(`Validation error: ${(validationError as Error).message}`);
      return;
    }
    
    if (!validation.isValid) {
      alert(Object.values(validation.errors)[0]);
      return;
    }

    const conflictResult = await checkMultiSkillReportConflicts(
      virtualWorks,
      formData,
      [],
      []
    );
    
    if (conflictResult.hasConflict) {
      if (conflictResult.hasReportConflict) {
        alert(conflictResult.message);
        return;
      }
      const proceed = confirm(conflictResult.message);
      if (!proceed) return;
    }

    // Validate worker attendance (skills + trainees)
    const selectedWorkerIds = [
      ...Object.values(formData.skillEmployees).filter(Boolean),
      ...(formData.selectedTrainees || []).map((t) => t.emp_id)
    ].filter(Boolean) as string[];
    
    if (selectedWorkerIds.length > 0 && stageCode && reportingDate) {
      try {
        const dateStr = reportingDate.split('T')[0];
        
        const { data: attendanceRecords, error: attendanceError } = await supabase
          .from('prdn_reporting_manpower')
          .select('emp_id, attendance_status')
          .eq('stage_code', stageCode)
          .lte('reporting_from_date', dateStr)
          .gte('reporting_to_date', dateStr)
          .in('emp_id', selectedWorkerIds)
          .eq('is_deleted', false);

        if (attendanceError) {
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
            const worker = availableWorkers.find((w: any) => w.emp_id === workerId);
            const workerName = worker?.emp_name || workerId;
            missingAttendance.push(`${workerName} (${workerId})`);
          } else if (!attendanceIsPresent(attendanceStatus)) {
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
          alert(
            `Cannot save report. The following workers are marked as absent:\n\n` +
            `${absentWorkers.join(', ')}\n\n` +
            `Absent workers cannot be included in the report. Please remove them from the worker list before saving.`
          );
          return;
        }
      } catch (error) {
        alert(`Error validating worker attendance: ${(error as Error).message}`);
        return;
      }
    }

    isLoading = true;
    
    try {
      formData.actualTimeMinutes = state.actualTimeMinutes;
      
      const result = await saveUnplannedWorkReports(
        selectedWork,
        virtualWorks,
        formData,
        lostTimeReasons,
        stageCode,
        shiftCode,
        shiftInfo?.breakTimes ?? []
      );
      if (!result.success) {
        alert('Error saving report: ' + (result.error || 'Unknown error'));
        return;
      }

      dispatch('save', {
        success: true,
        message: `Successfully reported unplanned work with ${virtualWorks.length} skill competencies`,
        reportData: result.data
      });

      handleClose();
    } catch (error) {
      console.error('Error saving unplanned work report:', error);
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
    formData = { ...initialMultiSkillReportFormData };
    state = { ...initialMultiSkillReportState };
    availableWorkers = [];
    lostTimeReasons = [];
    shiftInfo = null;
    skillEmployeesString = '';
    previousSkillEmployeesString = '';
    timeWorkedTillDateByWorker = {};
    previousWorkerSelectionForTillDate = '';
    selectedWorkersWithSalaries = [];
    virtualWorks = [];
    availableSkillMappings = [];
    selectedSkillMappingIndex = -1;
    workersLoaded = false;
    isLoadingWorkers = false;
    shiftBreakTimes = [];
    lastAutoCalculatedToTime = null;
    userHasSelectedFromTime = false;
    userHasSelectedToTime = false;
    isLoading = false;
    isLoadingSalary = false;
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
    formData.deviations = { ...formData.deviations };
  }

  function handleTraineeAdd(trainee: { emp_id: string; emp_name: string; skill_short: string }) {
    if (formData.selectedTrainees.length < 2) {
      formData.selectedTrainees = [...formData.selectedTrainees, trainee];
      formData = { ...formData };
    }
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
    formData = { ...formData };
  }

  function handleDateChange(field: string, value: string) {
    if (field === 'fromDate') {
      formData.fromDate = value;
      if (!formData.toDate || formData.toDate < formData.fromDate) {
        formData.toDate = formData.fromDate;
      }
      workersLoaded = false;
      formData = { ...formData };
      void (async () => {
        await loadShiftInfoData();
        await loadWorkersData();
      })();
      return;
    }
    if (field === 'toDate') {
      formData.toDate = value;
      if (formData.fromDate && formData.toDate < formData.fromDate) {
        formData.toDate = formData.fromDate;
      }
    }
    formData = { ...formData };
  }

  function handleTimeChange(field: string, value: string) {
    if (field === 'fromTime') {
      userHasSelectedFromTime = true;
      if (formData.toTime) {
        lastAutoCalculatedToTime = formData.toTime;
      }
      formData.fromTime = value;
    } else if (field === 'toTime') {
      userHasSelectedToTime = true;
      formData.toTime = value;
      lastAutoCalculatedToTime = null;
    }
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

  // Get available trainees
  $: availableTrainees = availableWorkers.filter((w: any) => w.skill_short === 'T');
</script>

{#if isOpen && browser}
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
            <h3 class="text-lg font-medium theme-text-primary">Report Unplanned Work</h3>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
              <div class="flex items-center space-x-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {state.currentStage >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">1</div>
                <span class="text-sm theme-text-secondary">Select time</span>
              </div>
              <div class="w-8 h-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>
              <div class="flex items-center space-x-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {state.currentStage >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">2</div>
                <span class="text-sm theme-text-secondary">Assign workers</span>
              </div>
              {#if !isNonStandardWork}
                <div class="w-8 h-px bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {state.currentStage >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">3</div>
                  <span class="text-sm theme-text-secondary">Lost time & save</span>
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

      {#if isLoading && virtualWorks.length === 0 && availableSkillMappings.length === 0}
        <div class="px-6 py-8 text-center">
          <p class="theme-text-secondary">Loading...</p>
        </div>
      {:else if formData}
        <div class="px-6 py-4">
          {#if state.currentStage === 1}
            <WorkDetailsDisplay selectedWorks={virtualWorks.length > 0 ? virtualWorks : [selectedWork]} standardTimeMinutes={state.standardTimeMinutes} />
            
            {#if availableSkillMappings.length > 1 && selectedSkillMappingIndex < 0}
              <div class="mt-6">
                <h4 class="font-medium theme-text-primary mb-3">Select Skill Combination</h4>
                <p class="text-sm theme-text-secondary mb-4">
                  This work has multiple alternative skill combinations. Select ONE to report:
                </p>
                <div class="space-y-2">
                  {#each availableSkillMappings as mapping, index}
                    {@const skillShort = getSkillShort(mapping)}
                    <label class="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors {
                      selectedSkillMappingIndex === index 
                        ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 dark:text-gray-100' 
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }">
                      <input
                        type="radio"
                        name="skill-mapping"
                        value={index}
                        checked={selectedSkillMappingIndex === index}
                        on:change={() => handleSkillMappingSelect(index)}
                        class="mr-3 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
                      />
                      <div class="flex-1">
                        <div class="font-medium text-gray-900 dark:text-gray-100">
                          {skillShort || mapping.sc_name}
                        </div>
                      </div>
                    </label>
                  {/each}
                </div>
              </div>
            {:else if virtualWorks.length > 0}
              <div class="mt-6">
                <SharedTimeSelection
                  {formData}
                  actualTimeMinutes={state.actualTimeMinutes}
                  onDateChange={handleDateChange}
                  onTimeChange={handleTimeChange}
                  onStatusChange={handleStatusChange}
                />
              </div>
            {:else if availableSkillMappings.length === 0}
              <div class="px-6 py-8 text-center">
                <p class="theme-text-secondary">No skill competencies found for this work.</p>
              </div>
            {/if}
          {:else if state.currentStage === 2}
            <div class="space-y-4">
              <p class="text-sm theme-text-secondary">
                Assign workers to each skill. Optionally set custom from/to times per row when they differ from the range above.
              </p>
              <EmployeeAssignment
                selectedWorks={virtualWorks}
                {availableWorkers}
                {formData}
                shiftInfo={shiftInfo as ShiftInfo | null}
                onEmployeeChange={handleEmployeeChange}
                onDeviationChange={handleDeviationChange}
                onTraineeAdd={handleTraineeAdd}
                onTraineeRemove={handleTraineeRemove}
                onTraineeReasonChange={handleTraineeReasonChange}
                onRowTimeOverride={handleRowTimeOverride}
              />
            </div>
          {:else if state.currentStage === 3}
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
        </div>

        <div class="px-6 py-4 border-t theme-border flex justify-between items-center flex-wrap gap-2">
          {#if state.currentStage === 1}
            <Button variant="secondary" on:click={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              on:click={proceedFromStage1To2}
              disabled={isLoading || virtualWorks.length === 0}
            >
              Next: Assign workers →
            </Button>
          {:else if state.currentStage === 2}
            <Button variant="secondary" on:click={goBackToStage1} disabled={isLoading}>
              ← Back
            </Button>
            <div class="flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" on:click={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              {#if isNonStandardWork}
                <Button variant="primary" on:click={handleSave} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Report'}
                </Button>
              {:else}
                <Button
                  variant="primary"
                  on:click={proceedFromStage2To3}
                  disabled={isLoading || isLoadingTimeWorkedTillDate}
                >
                  Next: Lost time →
                </Button>
              {/if}
            </div>
          {:else if state.currentStage === 3}
            <Button variant="secondary" on:click={goBackToStage2} disabled={isLoading}>
              ← Back
            </Button>
            <div class="flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" on:click={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                on:click={handleSave}
                disabled={isLoading || !isLostTimeValid}
              >
                {isLoading ? 'Saving...' : 'Save Report'}
              </Button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
