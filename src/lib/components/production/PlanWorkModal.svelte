<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { calculatePlannedHours, calculateBreakTimeInSlot, autoCalculateEndTime, getIndividualSkills, getSkillShort, generateTimeSlots, getEffectiveRowTimes, getCanonicalPlanWorkKey, getWorkerSlotKey } from '$lib/utils/planWorkUtils';
  import { formatTime } from '$lib/utils/timeFormatUtils';
  import { checkTimeOverlap, checkTimeExcess, checkSkillMismatch } from '$lib/utils/planWorkValidation';
  import { loadWorkers, loadWorkContinuation, loadExistingPlans, loadShiftInfo, checkAlternativeSkillCombinations } from '$lib/services/planWorkService';
  import { saveWorkPlanning } from '$lib/services/planWorkSaveService';
  import { checkWorkerConflicts, type WorkerAssignmentInterval } from '$lib/services/planWorkConflictService';
  import type { Worker, SelectedWorker, WorkContinuation, ShiftInfo, PlanWorkWarnings, PlanWorkFormData, RowTimeOverride } from '$lib/types/planWork';
  import { initialPlanWorkFormData, initialWarnings } from '$lib/types/planWork';
  import WorkDetailsDisplay from './plan-work/WorkDetailsDisplay.svelte';
  import WorkerSelection from './plan-work/WorkerSelection.svelte';
  import TimePlanning from './plan-work/TimePlanning.svelte';
  import WarningsDisplay from './plan-work/WarningsDisplay.svelte';

  export let isOpen: boolean = false;
  export let work: any = null;
  export let selectedDate: string = '';
  export let stageCode: string = '';
  export let shiftCode: string = '';

  const dispatch = createEventDispatcher();

  // Form data
  let formData: PlanWorkFormData = { ...initialPlanWorkFormData };
  let warnings: PlanWorkWarnings = { ...initialWarnings };

  // Modal state
  let isLoading = false;
  let currentStep: 1 | 2 = 1; // Step 1: Time Selection, Step 2: Worker Selection
  let availableWorkers: Worker[] = [];
  let filteredAvailableWorkers: Worker[] = []; // Workers filtered by time availability
  let workContinuation: WorkContinuation = {
    hasPreviousWork: false,
    timeWorkedTillDate: 0,
    remainingTime: 0,
    previousReports: []
  };
  let existingPlans: any[] = [];
  let shiftInfo: ShiftInfo | null = null;
  let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
  let previousSelectedSkillMappingIndex = -1;
  let lastAutoCalculatedToTime: string | null = null;
  let originalDurationMinutes: number | null = null; // Track original duration when editing
  let savedSelectedWorkers: { [skill: string]: SelectedWorker | null } = {}; // Fix 4: Save workers when going back
  let userHasSelectedFromTime = false; // Track if user has manually selected fromTime

  function buildWorkerSlotMap(targetWork: any, mappingIndex: number): { [slotKey: string]: SelectedWorker | null } {
    if (!targetWork?.skill_mappings || targetWork.skill_mappings.length === 0) {
      return { [getWorkerSlotKey('GEN', 0)]: null };
    }

    let effectiveIndex = mappingIndex;
    if (effectiveIndex < 0 && targetWork.skill_mappings.length === 1) {
      effectiveIndex = 0;
    }
    if (effectiveIndex < 0 || effectiveIndex >= targetWork.skill_mappings.length) {
      return {};
    }

    const selectedMapping = targetWork.skill_mappings[effectiveIndex];
    const individualSkills = getIndividualSkills(selectedMapping);
    const slots: { [slotKey: string]: SelectedWorker | null } = {};
    individualSkills.forEach((skillShort: string, index: number) => {
      slots[getWorkerSlotKey(skillShort, index)] = null;
    });
    return slots;
  }

  // Watch for work changes
  // Use a key to track work changes and prevent unnecessary resets
  let previousWorkId: string | null = null;
  let previousIsOpen: boolean = false;
  $: if (work && isOpen) {
    const currentWorkId = getCanonicalPlanWorkKey(work);
    /** True only on the transition into an open modal (previousIsOpen reset when modal closes). */
    const opening = !previousIsOpen && isOpen;

    // Full session reset on every open — avoids stale workers / saved step-2 state / overrides from prior plans.
    if (opening) {
      savedSelectedWorkers = {};
      hasPrefilledWorkers = false;
      formData = {
        ...formData,
        selectedWorkers: {},
        selectedTrainees: [],
        traineeDeviationReason: '',
        rowTimeOverrides: {}
      };
      console.log('🧹 Plan session reset on open (workers, trainees, row overrides, saved step-2 snapshot)');
    }

    // Only reset if this is actually a different work
    if (currentWorkId !== previousWorkId) {
      console.log('PlanWorkModal: Work changed:', work, 'from', previousWorkId, 'to', currentWorkId);
      previousWorkId = currentWorkId; // Update to track this change
      
      // Fix: Always clear ALL state first to prevent stale data from previous modal opens
      // Create a completely fresh object to ensure no references to old data
      formData.selectedWorkers = buildWorkerSlotMap(work, -1);
      // Initialize dates from selectedDate if not already set
      if (!formData.fromDate) {
        formData.fromDate = selectedDate;
      }
      if (!formData.toDate) {
        formData.toDate = selectedDate;
      }
      // Force a reactive update by creating a new object
      formData = { ...formData, selectedWorkers: buildWorkerSlotMap(work, -1), selectedTrainees: [], traineeDeviationReason: '', rowTimeOverrides: {} };
      filteredAvailableWorkers = [];
      savedSelectedWorkers = {};
      hasPrefilledWorkers = false;
      // CRITICAL: Only reset userHasSelectedFromTime when work actually changes
      // Don't reset it if user is still working on the same work
      userHasSelectedFromTime = false; // Reset flag when work changes
      
      console.log('🔍 After work change, formData.fromTime:', formData.fromTime, 'formData.fromDate:', formData.fromDate, 'userHasSelectedFromTime:', userHasSelectedFromTime);
      
      // Debug: only warn if actual workers remain (slot placeholders are expected).
      const selectedWorkerCount = Object.values(formData.selectedWorkers).filter(Boolean).length;
      if (selectedWorkerCount > 0) {
        console.warn(`⚠️ PlanWorkModal: selectedWorkers still has ${selectedWorkerCount} selected worker(s) after clearing!`, formData.selectedWorkers);
      } else {
        console.log('✅ PlanWorkModal: selectedWorkers cleared successfully');
      }
      
      // Fix 2: Validate that existingDraftPlans only contains plans for the current work order
      // This prevents using plans from a different work order
      if (work?.existingDraftPlans && Array.isArray(work.existingDraftPlans)) {
        const currentWoDetailsId = work.wo_details_id || work.prdn_wo_details_id;
        if (currentWoDetailsId) {
          // Filter out any plans that don't match the current work order
          work.existingDraftPlans = work.existingDraftPlans.filter((plan: any) => 
            (plan.wo_details_id || plan.prdn_wo_details_id) === currentWoDetailsId
          );
          // If no valid plans remain, clear existingDraftPlans
          if (work.existingDraftPlans.length === 0) {
            delete work.existingDraftPlans;
          }
        }
      }
      
      loadAllData();
      
      // Check if this is edit mode (has existing draft plans)
      const isEditMode = work?.existingDraftPlans && Array.isArray(work.existingDraftPlans) && work.existingDraftPlans.length > 0;
      
      if (isEditMode) {
        // Pre-fill form with existing plan data (will be called again after workers load)
        // Don't prefill workers yet - wait for availableWorkers to load
        prefillFormFromExistingPlans(work.existingDraftPlans, false);
      } else {
        // Reset form and step for new planning
        // CRITICAL: Never reset formData.fromTime if user has manually selected it
        // This prevents clearing the fromTime value after user selection
        const savedFromTime = userHasSelectedFromTime ? formData.fromTime : '';
        const savedToTime = userHasSelectedFromTime ? formData.toTime : '';
        const savedFromDate = formData.fromDate || selectedDate;
        const savedToDate = formData.toDate || selectedDate;
        
        if (!userHasSelectedFromTime) {
          // Only reset if user hasn't selected a time yet
          formData = { 
            ...initialPlanWorkFormData,
            fromDate: savedFromDate,
            toDate: savedToDate,
            selectedWorkers: buildWorkerSlotMap(work, -1),
            selectedTrainees: [],
            traineeDeviationReason: ''
          };
          console.log('🔄 Reset formData for new planning (no user selection yet)');
        } else {
          // User has selected a time - preserve it when resetting other fields
          formData = { 
            ...initialPlanWorkFormData, 
            fromDate: savedFromDate,
            toDate: savedToDate,
            fromTime: savedFromTime,
            toTime: savedToTime,
            selectedWorkers: buildWorkerSlotMap(work, -1),
            selectedTrainees: [],
            traineeDeviationReason: ''
          };
          console.log('✅ Preserved user-selected times when resetting formData:', { fromTime: savedFromTime, toTime: savedToTime });
        }
        
        warnings = { ...initialWarnings };
        previousSelectedSkillMappingIndex = -1;
        lastAutoCalculatedToTime = null;
        currentStep = 1;
        filteredAvailableWorkers = [];
        
        // Auto-select if only one skill mapping
        if (work?.skill_mappings && work.skill_mappings.length === 1) {
          formData.selectedSkillMappingIndex = 0;
          formData.selectedWorkers = buildWorkerSlotMap(work, 0);
          previousSelectedSkillMappingIndex = 0;
        }
      }
    } else if (opening) {
      // Same work re-opened: still reload workers / continuation / plans / shift so dropdowns stay correct
      console.log('PlanWorkModal: Same work re-opened — reloading data');
      loadAllData();
    }

    previousIsOpen = true;
  }

  // Pre-fill workers after they are loaded (for edit mode)
  let hasPrefilledWorkers = false;
  $: if (work?.existingDraftPlans && Array.isArray(work.existingDraftPlans) && work.existingDraftPlans.length > 0 
      && availableWorkers.length > 0 && isOpen && !hasPrefilledWorkers) {
    // Workers are now loaded, pre-fill them
    prefillFormFromExistingPlans(work.existingDraftPlans, true);
    hasPrefilledWorkers = true;
  }
  
  // Reset flag when modal closes or work changes
  $: if (!isOpen || !work) {
    previousIsOpen = false;
    hasPrefilledWorkers = false;
    savedSelectedWorkers = {}; // Fix 4: Clear saved workers when modal closes or work changes
    // Next open must not think we are still on the last work (avoids skipped reset when keys collide)
    previousWorkId = null;
  }
  
  /** Additional trainees are saved with notes like `Trainee: Name` — not skill-mapping slots. */
  function isAdditionalTraineePlan(plan: any): boolean {
    const n = plan?.notes;
    return typeof n === 'string' && n.trim().startsWith('Trainee:');
  }

  function prefillFormFromExistingPlans(existingPlans: any[], fillWorkers: boolean = true) {
    if (!existingPlans || existingPlans.length === 0) return;

    const mappingPlans = existingPlans.filter((p: any) => !isAdditionalTraineePlan(p));
    const additionalTraineePlans = existingPlans.filter((p: any) => isAdditionalTraineePlan(p));
    
    // Get the first plan item to extract time information
    // All plans in a group should have the same from_time/to_time
    const firstPlan = existingPlans[0];
    
    // Pre-fill time slots from the first plan
    // Use the earliest from_time and latest to_time if they differ
    const allFromTimes = existingPlans.map((p: any) => p.from_time).filter(Boolean);
    const allToTimes = existingPlans.map((p: any) => p.to_time).filter(Boolean);
    
    // Normalize time format: convert HH:MM:SS to HH:MM
    function normalizeTime(timeStr: string): string {
      if (!timeStr) return '';
      // Remove seconds if present (HH:MM:SS -> HH:MM)
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
      return timeStr;
    }
    
    // Find closest matching time slot (time slots are in 15-minute intervals)
    function findClosestTimeSlot(targetTime: string, shiftStart: string, shiftEnd: string): string {
      if (!targetTime || !shiftStart || !shiftEnd) return targetTime;
      
      try {
        const timeSlots = generateTimeSlots(shiftStart, shiftEnd);
        
        if (timeSlots.length === 0) return targetTime;
        
        // Convert target time to minutes
        const [targetHour, targetMin] = targetTime.split(':').map(Number);
        const targetMinutes = targetHour * 60 + targetMin;
        
        // Find the closest slot
        let closestSlot = timeSlots[0];
        let minDiff = Infinity;
        
        for (const slot of timeSlots) {
          const [slotHour, slotMin] = slot.value.split(':').map(Number);
          const slotMinutes = slotHour * 60 + slotMin;
          const diff = Math.abs(slotMinutes - targetMinutes);
          
          if (diff < minDiff) {
            minDiff = diff;
            closestSlot = slot;
          }
        }
        
        return closestSlot.value;
      } catch (error) {
        console.error('Error finding closest time slot:', error);
        return targetTime;
      }
    }
    
    if (allFromTimes.length > 0 && allToTimes.length > 0) {
      // Use the earliest from_time and latest to_time, normalized to HH:MM format
      const normalizedTimes = allFromTimes.map(normalizeTime);
      const normalizedToTimes = allToTimes.map(normalizeTime);
      const earliestTime = normalizedTimes.sort()[0];
      const latestTime = normalizedToTimes.sort().reverse()[0];
      
      // Calculate and store the original duration in minutes
      const [fromHour, fromMin] = earliestTime.split(':').map(Number);
      const [toHour, toMin] = latestTime.split(':').map(Number);
      const fromMinutes = fromHour * 60 + fromMin;
      const toMinutes = toHour * 60 + toMin;
      let durationMinutes = toMinutes - fromMinutes;
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60; // Handle overnight
      }
      originalDurationMinutes = durationMinutes;
      console.log('✅ Stored original duration:', originalDurationMinutes, 'minutes (', formatTime(originalDurationMinutes / 60), ')');
      
      // Find closest matching time slot if shift info is available
      if (shiftInfo?.hr_shift_master?.start_time && shiftInfo?.hr_shift_master?.end_time) {
        formData.fromTime = findClosestTimeSlot(
          earliestTime,
          shiftInfo.hr_shift_master.start_time,
          shiftInfo.hr_shift_master.end_time
        );
      } else {
        // If shift info not loaded yet, use normalized time directly
        // It will be matched to closest slot when shift info loads
        formData.fromTime = earliestTime;
      }
      
      // For toTime, we can use the exact value since TimePicker accepts any time
      formData.toTime = latestTime;
      // CRITICAL: Set lastAutoCalculatedToTime to null when pre-filling from saved plans
      // This prevents the reactive statement from auto-calculating and overwriting the saved value
      lastAutoCalculatedToTime = null;
      console.log('✅ Pre-filled fromTime:', formData.fromTime, 'toTime:', formData.toTime, '(saved values, not auto-calculated)');
    }
    
    // First, try to determine the selected skill mapping index
    // Match the skill mappings from the work with the skills used in the plans
    let selectedMappingIndex = -1;
    if (work?.skill_mappings && work.skill_mappings.length > 0) {
      // Get all unique skills from the existing plans
      const planSkills = new Set(
        mappingPlans
          .map((p: any) => p.sc_required || p.hr_emp?.skill_short || p.skill_short)
          .filter(Boolean)
      );
      
      // Find the skill mapping that contains all the planned skills
      const matchingIndex = work.skill_mappings.findIndex((mapping: any) => {
        try {
          // Get individual skills from this mapping
          const mappingSkills = getIndividualSkills(mapping);
          const mappingSkillSet = new Set(mappingSkills);
          
          // Also check skill_short from skill_combination if available
          if (mapping.std_skill_combinations?.skill_combination) {
            const combination = Array.isArray(mapping.std_skill_combinations.skill_combination)
              ? mapping.std_skill_combinations.skill_combination
              : [mapping.std_skill_combinations.skill_combination];
            
            combination.forEach((skill: any) => {
              if (skill.skill_short) mappingSkillSet.add(skill.skill_short);
              if (skill.skill_name) mappingSkillSet.add(skill.skill_name);
            });
          }
          
          // Check if all planned skills are in this mapping
          return Array.from(planSkills).every(skill => mappingSkillSet.has(skill));
        } catch (error) {
          console.error('Error matching skill mapping:', error);
          return false;
        }
      });
      
      if (matchingIndex >= 0) {
        selectedMappingIndex = matchingIndex;
        formData.selectedSkillMappingIndex = matchingIndex;
        previousSelectedSkillMappingIndex = matchingIndex;
      } else if (work.skill_mappings.length === 1) {
        // Fallback: if only one mapping, select it
        selectedMappingIndex = 0;
        formData.selectedSkillMappingIndex = 0;
        previousSelectedSkillMappingIndex = 0;
      }
    }
    
    // Now pre-fill workers based on existing plans using the correct key format
    const selectedWorkers: { [skill: string]: SelectedWorker | null } = {};
    
    // Get the selected skill mapping
    let selectedMapping: any = null;
    if (selectedMappingIndex >= 0 && work?.skill_mappings) {
      selectedMapping = work.skill_mappings[selectedMappingIndex];
    }
    
    if (selectedMapping) {
      // Get individual skills from the selected mapping
      const individualSkills = getIndividualSkills(selectedMapping);
      
      // Map existing plans to the correct worker keys
      // WorkerSelection uses canonical keys `<skill>-<index>` for all rows.
      if (individualSkills.length > 1) {
        // Multiple skills - use format `${individualSkill}-${skillIndex}`
        // Track which indices have been used for each skill to handle duplicates
        const skillIndexUsage = new Map<string, number[]>(); // skill -> array of indices where this skill appears
        
        // Build map of skill -> available indices
        individualSkills.forEach((skill, index) => {
          if (!skillIndexUsage.has(skill)) {
            skillIndexUsage.set(skill, []);
          }
          skillIndexUsage.get(skill)!.push(index);
        });
        
        // Track which indices have been assigned
        const assignedIndices = new Set<number>();
        
        mappingPlans.forEach((plan: any) => {
          const skillRequired = plan.sc_required || plan.hr_emp?.skill_short || plan.skill_short;
          const worker = plan.hr_emp;
          
          if (skillRequired && worker) {
            // Find available indices for this skill that haven't been assigned yet
            const availableIndices = skillIndexUsage.get(skillRequired) || [];
            const unassignedIndex = availableIndices.find(idx => !assignedIndices.has(idx));
            
            if (unassignedIndex !== undefined) {
              // Use the skill name from individualSkills array
              const skillName = individualSkills[unassignedIndex];
              const workerKey = getWorkerSlotKey(skillName, unassignedIndex);
              selectedWorkers[workerKey] = {
                emp_id: worker.emp_id || plan.worker_id,
                emp_name: worker.emp_name || 'Unknown',
                skill_short: worker.skill_short || skillRequired
              };
              assignedIndices.add(unassignedIndex);
              console.log(`✅ Mapped worker ${worker.emp_name} (${skillRequired}) to key ${workerKey}`);
            } else {
              console.warn(`⚠️ No available index for skill ${skillRequired}, worker ${worker.emp_name}. All indices for this skill are already assigned.`);
            }
          }
        });
      } else {
        // Single skill still uses canonical `<skill>-0` key
        const skillShort = getSkillShort(selectedMapping);
        const firstPlan = mappingPlans[0];
        const worker = firstPlan?.hr_emp;
        
        if (worker) {
          const workerKey = getWorkerSlotKey(skillShort || selectedMapping.sc_name || 'GEN', 0);
          selectedWorkers[workerKey] = {
            emp_id: worker.emp_id || firstPlan.worker_id,
            emp_name: worker.emp_name || 'Unknown',
            skill_short: worker.skill_short || skillShort
          };
        }
      }
    } else {
      // Fallback: if no mapping selected, still store canonical slot keys
      mappingPlans.forEach((plan: any) => {
        const skillRequired = plan.sc_required || plan.skill_short;
        const worker = plan.hr_emp;
        
        if (skillRequired && worker) {
          selectedWorkers[getWorkerSlotKey(skillRequired, 0)] = {
            emp_id: worker.emp_id || plan.worker_id,
            emp_name: worker.emp_name || 'Unknown',
            skill_short: worker.skill_short || skillRequired
          };
        }
      });
    }
    
    if (fillWorkers) {
      formData.selectedWorkers = selectedWorkers;

      const sortedTraineePlans = [...additionalTraineePlans].sort((a: any, b: any) => {
        const idA = Number(a.id ?? a.planning_id ?? 0);
        const idB = Number(b.id ?? b.planning_id ?? 0);
        return idA - idB;
      });
      formData.selectedTrainees = sortedTraineePlans.map((plan: any) => {
        const w = plan.hr_emp;
        const nameFromNotes =
          typeof plan.notes === 'string' ? plan.notes.replace(/^Trainee:\s*/i, '').trim() : '';
        return {
          emp_id: String(w?.emp_id ?? plan.worker_id ?? ''),
          emp_name: w?.emp_name || nameFromNotes || 'Unknown',
          skill_short: w?.skill_short || 'T'
        };
      });

      const traineePlanIds = sortedTraineePlans
        .map((p: any) => p.id ?? p.planning_id)
        .filter((id: any) => id != null && id !== '');
      if (traineePlanIds.length > 0 && !formData.traineeDeviationReason?.trim()) {
        void (async () => {
          const { data, error } = await supabase
            .from('prdn_work_planning_deviations')
            .select('reason')
            .eq('deviation_type', 'trainee_addition')
            .in('planning_id', traineePlanIds as number[])
            .eq('is_active', true)
            .eq('is_deleted', false)
            .limit(1);
          const reason = Array.isArray(data) && data[0]?.reason ? data[0].reason : null;
          if (!error && reason) {
            formData.traineeDeviationReason = reason;
            formData = { ...formData };
          }
        })();
      }

      // Ensure selected workers are in the available list
      ensureSelectedWorkersInAvailable();

      // Per-row custom times when a saved plan differs from global (earliest–latest) window
      if (existingPlans.length > 0) {
        const norm = (timeStr: string): string => {
          if (!timeStr) return '';
          const parts = timeStr.split(':');
          if (parts.length >= 2) {
            return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
          }
          return timeStr;
        };
        const gFrom = norm(formData.fromTime);
        const gTo = norm(formData.toTime);
        const overrides: Record<string, RowTimeOverride> = {};
        for (const [key, sw] of Object.entries(selectedWorkers)) {
          if (!sw || !(sw as SelectedWorker).emp_id) continue;
          const skillShort = key.includes('-') ? key.split('-')[0] : key;
          const plan = mappingPlans.find((p: any) => {
            const wid = p.worker_id || p.hr_emp?.emp_id;
            const sc = p.sc_required || p.hr_emp?.skill_short;
            return wid === (sw as SelectedWorker).emp_id && sc === skillShort;
          });
          if (!plan?.from_time || !plan?.to_time) continue;
          const pf = norm(plan.from_time);
          const pt = norm(plan.to_time);
          if (pf !== gFrom || pt !== gTo) {
            overrides[key] = { useCustom: true, fromTime: pf, toTime: pt };
          }
        }
        sortedTraineePlans.forEach((plan: any, ti: number) => {
          if (!plan?.from_time || !plan?.to_time) return;
          const pf = norm(plan.from_time);
          const pt = norm(plan.to_time);
          if (pf !== gFrom || pt !== gTo) {
            overrides[`trainee-${ti}`] = { useCustom: true, fromTime: pf, toTime: pt };
          }
        });
        formData.rowTimeOverrides = { ...formData.rowTimeOverrides, ...overrides };
        formData = { ...formData };
      }
    }
    
    // Keep step at 1 (time selection) so user can see and modify times
    // Don't skip to step 2 - let user proceed naturally
    if (!fillWorkers) {
      // Only set step on first call (when filling times)
      currentStep = 1;
    }
    
    // Reset warnings
    warnings = { ...initialWarnings };
    filteredAvailableWorkers = [];
    
    console.log('✅ Pre-filled form from existing plans:', {
      fromTime: formData.fromTime,
      toTime: formData.toTime,
      selectedWorkers: fillWorkers ? formData.selectedWorkers : 'deferred',
      selectedSkillMappingIndex: formData.selectedSkillMappingIndex,
      fillWorkers
    });
  }
  
  // Clear workers when switching skill mappings
  $: if (formData.selectedSkillMappingIndex !== previousSelectedSkillMappingIndex && previousSelectedSkillMappingIndex >= 0) {
    console.log('Clearing workers due to skill mapping change');
    formData.selectedWorkers = buildWorkerSlotMap(work, formData.selectedSkillMappingIndex);
    formData.rowTimeOverrides = {};
    previousSelectedSkillMappingIndex = formData.selectedSkillMappingIndex;
  } else if (formData.selectedSkillMappingIndex >= 0) {
    previousSelectedSkillMappingIndex = formData.selectedSkillMappingIndex;
  }

  // Watch for fromTime changes to auto-calculate end time FIRST
  // Only auto-calculate if toTime is empty or was previously auto-calculated
  // CRITICAL: Don't auto-calculate when pre-filling from existing plans (lastAutoCalculatedToTime will be null)
  $: if (formData.fromTime && (workContinuation.remainingTime > 0 || work?.std_vehicle_work_flow?.estimated_duration_minutes)) {
    // Auto-calculate end time when fromTime changes
    // Only if:
    // 1. toTime is empty, OR
    // 2. (toTime matches the last auto-calculated value AND lastAutoCalculatedToTime is not null)
    // This ensures we don't overwrite saved values when editing
    if (!formData.toTime || (formData.toTime === lastAutoCalculatedToTime && lastAutoCalculatedToTime !== null)) {
      const calculatedToTime = autoCalculateEndTime(
        formData.fromTime,
        workContinuation.remainingTime,
        work?.std_vehicle_work_flow?.estimated_duration_minutes,
        shiftBreakTimes,
        shiftInfo?.hr_shift_master?.end_time
      );
      if (calculatedToTime) {
        formData.toTime = calculatedToTime;
        if (formData.fromDate) {
          formData.toDate = formData.fromDate;
        }
        lastAutoCalculatedToTime = calculatedToTime;
        console.log('🔄 Auto-calculated toTime:', calculatedToTime, 'from fromTime:', formData.fromTime);
      }
    }
  }

  // Watch for fromDate and fromTime changes to auto-calculate toDate
  // If toTime is less than fromTime, it means the work spans overnight, so toDate should be the next day
  $: if (formData.fromDate && formData.fromTime && formData.toTime) {
    const [fromHour, fromMin] = formData.fromTime.split(':').map(Number);
    const [toHour, toMin] = formData.toTime.split(':').map(Number);
    const fromMinutes = fromHour * 60 + fromMin;
    const toMinutes = toHour * 60 + toMin;
    
    // If toTime is less than fromTime, it means overnight work
    if (toMinutes < fromMinutes) {
      // Work spans overnight, so toDate should be the next day
      const fromDateObj = new Date(formData.fromDate);
      fromDateObj.setDate(fromDateObj.getDate() + 1);
      const nextDay = fromDateObj.toISOString().split('T')[0];
      
      if (formData.toDate !== nextDay) {
        formData.toDate = nextDay;
        console.log('🔄 Auto-calculated toDate (overnight work):', nextDay, 'from fromDate:', formData.fromDate);
      }
    } else {
      // Work is on the same day, so toDate should match fromDate
      if (formData.toDate !== formData.fromDate) {
        formData.toDate = formData.fromDate;
        console.log('🔄 Auto-calculated toDate (same day):', formData.fromDate);
      }
    }
  }

  // Watch for time changes - explicitly depend on fromTime, toTime
  // Planned hours = simple duration between fromTime and toTime (no break time subtraction)
  // This runs AFTER the auto-calculate above has updated toTime
  // Use explicit reactive statement to ensure it runs when either time changes
  $: {
    const fromTime = formData.fromTime;
    const toTime = formData.toTime;
    
    if (fromTime && toTime) {
      // Calculate simple duration - no break time involved
      const calculatedHours = calculatePlannedHours(fromTime, toTime);
      
      console.log('📊 Planned hours calculation:', {
        fromTime: fromTime,
        toTime: toTime,
        calculatedHours: calculatedHours,
        fromTimeType: typeof fromTime,
        toTimeType: typeof toTime
      });
      
      formData.plannedHours = calculatedHours;
    } else {
      formData.plannedHours = 0;
    }
  }
  
  // Separate reactive block for validation (runs after plannedHours is calculated)
  $: if (formData.fromTime && formData.toTime) {
    checkTimeOverlapValidation();
    checkTimeExcessValidation();
  }

  // Ensure selected workers are always in available list when viewing step 2
  $: if (currentStep === 2 && filteredAvailableWorkers.length > 0) {
    ensureSelectedWorkersInAvailable();
  }


  async function loadAllData() {
    if (!stageCode || !selectedDate) return;
    
    isLoading = true;
    try {
      await Promise.all([
        loadWorkersData(),
        loadWorkContinuationData(),
        loadExistingPlansData(),
        loadShiftInfoData(),
        checkAlternativeCombinations()
      ]);
    } finally {
      isLoading = false;
    }
  }

  async function loadWorkersData() {
    const workers = await loadWorkers(stageCode);
    // Sort workers alphabetically by name
    availableWorkers = workers.sort((a, b) => {
      const nameA = (a.emp_name || '').toLowerCase();
      const nameB = (b.emp_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    console.log(`👥 Loaded ${availableWorkers.length} workers for stage ${stageCode} (sorted alphabetically)`);
  }

  async function loadWorkContinuationData() {
    if (!work || !selectedDate) return;

    // First check if work object has time data
      if (work.time_taken !== undefined && work.remaining_time !== undefined) {
      workContinuation = {
        hasPreviousWork: (work.time_taken || 0) > 0,
        timeWorkedTillDate: work.time_taken || 0,
        remainingTime: work.remaining_time || 0,
        previousReports: []
      };
        return;
      }

    workContinuation = await loadWorkContinuation(work, stageCode, selectedDate);
  }

  async function loadExistingPlansData() {
    // If editing, exclude the current draft plans from conflict checks
    const isEditMode = work?.existingDraftPlans && Array.isArray(work.existingDraftPlans) && work.existingDraftPlans.length > 0;
    
    if (isEditMode) {
      // Get all existing plans, then filter out the ones we're editing
      const allPlans = await loadExistingPlans(work, stageCode, selectedDate);
      const currentPlanIds = new Set(work.existingDraftPlans.map((p: any) => p.id).filter(Boolean));
      existingPlans = allPlans.filter((plan: any) => !currentPlanIds.has(plan.id));
      console.log(`📅 Loaded ${existingPlans.length} existing plans (excluding ${currentPlanIds.size} being edited) for ${selectedDate}`);
    } else {
    existingPlans = await loadExistingPlans(work, stageCode, selectedDate);
      console.log(`📅 Loaded ${existingPlans.length} existing plans for ${selectedDate}`);
    }
  }

  async function loadShiftInfoData() {
    shiftInfo = await loadShiftInfo(stageCode);
      
      if (shiftInfo?.hr_shift_master?.shift_id) {
        const { data: breakData, error: breakError } = await supabase
          .from('hr_shift_break_master')
          .select('*')
          .eq('shift_id', shiftInfo.hr_shift_master.shift_id)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .order('break_number');

        if (!breakError && breakData) {
          // Create a new array to ensure reactivity
        shiftBreakTimes = breakData.map((b: any) => ({
          start_time: b.start_time,
          end_time: b.end_time
        }));
          console.log('🕐 Loaded break times:', shiftBreakTimes.map(bt => `${bt.start_time}-${bt.end_time}`).join(', '));
        } else {
          // Reset to empty array if no breaks
          shiftBreakTimes = [];
          console.log('🕐 No break times found');
        }
      } else {
        shiftBreakTimes = [];
      }
      
      // After shift info loads, update fromTime to match closest time slot (for edit mode only, and only if fromTime was pre-filled)
      // Only do this once when shift info first loads, not on every reactive update
      // Don't update if user has manually selected a time
      if (work?.existingDraftPlans && Array.isArray(work.existingDraftPlans) && work.existingDraftPlans.length > 0 
          && formData.fromTime && shiftInfo?.hr_shift_master?.start_time && shiftInfo?.hr_shift_master?.end_time
          && hasPrefilledWorkers && !userHasSelectedFromTime) { // Only update if we're in edit mode, workers were pre-filled, and user hasn't manually selected
        const { generateTimeSlots } = await import('$lib/utils/planWorkUtils');
        const timeSlots = generateTimeSlots(shiftInfo.hr_shift_master.start_time, shiftInfo.hr_shift_master.end_time);
        
        if (timeSlots.length > 0) {
          // Find closest matching time slot
          const [currentHour, currentMin] = formData.fromTime.split(':').map(Number);
          const currentMinutes = currentHour * 60 + currentMin;
          
          let closestSlot = timeSlots[0];
          let minDiff = Infinity;
          
          for (const slot of timeSlots) {
            const [slotHour, slotMin] = slot.value.split(':').map(Number);
            const slotMinutes = slotHour * 60 + slotMin;
            const diff = Math.abs(slotMinutes - currentMinutes);
            
            if (diff < minDiff) {
              minDiff = diff;
              closestSlot = slot;
            }
          }
          
          // Only update if the value is different (to avoid unnecessary updates)
          if (formData.fromTime !== closestSlot.value) {
            formData.fromTime = closestSlot.value;
            console.log('✅ Updated fromTime to closest slot:', formData.fromTime);
          }
        }
    }
  }

  async function checkAlternativeCombinations() {
    const result = await checkAlternativeSkillCombinations(work, stageCode);
    warnings.hasAlternativePlanningConflict = result.hasConflict;
    warnings.alternativeConflictDetails = result.details;
  }

  function checkTimeOverlapValidation() {
    const result = checkTimeOverlap(formData.fromTime, formData.toTime, existingPlans);
    warnings.showTimeOverlapWarning = result.hasOverlap;
    warnings.timeOverlapDetails = result.details;
  }

  function checkTimeExcessValidation() {
    const result = checkTimeExcess(
      formData.fromTime,
      formData.toTime,
      workContinuation.remainingTime,
      work?.std_vehicle_work_flow?.estimated_duration_minutes,
      shiftBreakTimes
    );
    warnings.showTimeExcessWarning = result.hasExcess;
    warnings.timeExcessDetails = result.details;
  }

  function checkSkillMismatchValidation() {
    const result = checkSkillMismatch(
      formData.selectedWorkers,
      work,
      formData.selectedSkillMappingIndex
    );
    warnings.showSkillMismatchWarning = result.hasMismatch;
    warnings.skillMismatchDetails = result.details;
  }

  /**
   * Native stage roster is in `availableWorkers` (hr_emp.stage = stage).
   * People reassigned into this stage for the day appear only in `filteredAvailableWorkers`
   * after time filtering — same list the step-2 dropdown uses.
   */
  function findWorkerByEmpId(empId: string): Worker | undefined {
    if (!empId) return undefined;
    const fromFiltered = filteredAvailableWorkers.find(w => w.emp_id === empId);
    if (fromFiltered) return fromFiltered;
    return availableWorkers.find(w => w.emp_id === empId);
  }

  function handleWorkerChange(event: Event, skillKey: string) {
    const target = event.target as HTMLSelectElement;
    const workerId = target.value;
    const validSlotKeys = new Set([
      ...Object.keys(buildWorkerSlotMap(work, formData.selectedSkillMappingIndex)),
      skillKey
    ]);
    
    // Clean up null/undefined entries and any stale keys from previous sessions.
    Object.keys(formData.selectedWorkers).forEach(key => {
      if (!formData.selectedWorkers[key] || !validSlotKeys.has(key)) {
        delete formData.selectedWorkers[key];
      }
    });
    
    // If a worker is selected, check if they're already assigned to another skill competency
    if (workerId) {
      const selectedWorker = findWorkerByEmpId(workerId);
      
      // Check if this worker is already assigned to a different skill competency
      for (const [key, worker] of Object.entries(formData.selectedWorkers)) {
        if (key !== skillKey && worker && worker.emp_id === workerId) {
          // Worker is already assigned to another skill competency
          alert(`Worker ${selectedWorker?.emp_name || workerId} is already assigned to another skill competency. One worker can only be assigned to one skill competency at a time.`);
          // Reset the select to empty
          target.value = '';
          delete formData.selectedWorkers[skillKey];
          checkSkillMismatchValidation();
          checkTimeOverlapValidation();
          return;
        }
      }
      
      // Worker is not already assigned, proceed with assignment
      formData.selectedWorkers[skillKey] = selectedWorker || null;
    } else {
      // No worker selected, remove the entry entirely
      delete formData.selectedWorkers[skillKey];
    }
    
    checkSkillMismatchValidation();
    checkTimeOverlapValidation();
  }

  function handleSkillMappingChange(index: number) {
    formData.selectedSkillMappingIndex = index;
    formData.selectedWorkers = buildWorkerSlotMap(work, index);
    formData.rowTimeOverrides = {};
  }

  function handleRowCustomTimesChange(rowKey: string, next: RowTimeOverride | null) {
    const rest = { ...formData.rowTimeOverrides };
    if (next === null) {
      delete rest[rowKey];
    } else {
      rest[rowKey] = next;
    }
    formData.rowTimeOverrides = rest;
    formData = { ...formData };
  }

  function handleTraineeAdd(trainee: SelectedWorker) {
    if (formData.selectedTrainees.length < 2) {
      formData.selectedTrainees = [...formData.selectedTrainees, trainee];
    }
  }

  function handleTraineeRemove(index: number) {
    formData.selectedTrainees = formData.selectedTrainees.filter((_, i) => i !== index);
    const ro = { ...formData.rowTimeOverrides };
    Object.keys(ro)
      .filter((k) => k.startsWith('trainee-'))
      .forEach((k) => delete ro[k]);
    formData.rowTimeOverrides = ro;
    // Clear reason if no trainees left
    if (formData.selectedTrainees.length === 0) {
      formData.traineeDeviationReason = '';
    }
    formData = { ...formData };
  }

  function handleTraineeReasonChange(reason: string) {
    formData.traineeDeviationReason = reason;
  }

  function handleFromTimeChange(value: string) {
    console.log('🔍 handleFromTimeChange called with value:', value);
    console.log('🔍 Current formData.fromTime before update:', formData.fromTime);
    formData.fromTime = value;
    userHasSelectedFromTime = true; // Mark that user has manually selected a time
    
    // When user manually changes fromTime, allow auto-calculation of toTime
    // Set lastAutoCalculatedToTime to current toTime so reactive statement can detect if it should recalculate
    if (formData.toTime) {
      lastAutoCalculatedToTime = formData.toTime;
    }
    
    console.log('✅ User selected fromTime:', value, 'formData.fromTime after update:', formData.fromTime);
    
    // Force a reactive update to ensure the value persists
    formData = { ...formData };
  }

  function handleFromDateChange(value: string) {
    console.log('🔍 handleFromDateChange called with value:', value);
    formData.fromDate = value;
    // The reactive statement will handle setting toDate based on whether work spans overnight
    // But if toDate is not set or is before fromDate, update it immediately
    if (!formData.toDate || formData.toDate < formData.fromDate) {
      formData.toDate = formData.fromDate;
    }
    console.log('✅ User selected fromDate:', value);
  }

  function handleToDateChange(value: string) {
    console.log('🔍 handleToDateChange called with value:', value);
    formData.toDate = value;
    // Ensure toDate is not before fromDate
    if (formData.fromDate && formData.toDate < formData.fromDate) {
      formData.toDate = formData.fromDate;
      console.log('⚠️ toDate adjusted to match fromDate');
    }
    console.log('✅ User selected toDate:', formData.toDate);
  }

  // toTime is bound directly in TimePlanning component

  function handleAutoCalculate() {
    if (!formData.fromTime) return;
    
    const remainingTime = workContinuation.remainingTime;
    const estimatedDurationMinutes = work?.std_vehicle_work_flow?.estimated_duration_minutes;
    
    const calculatedToTime = autoCalculateEndTime(
      formData.fromTime,
      remainingTime,
      estimatedDurationMinutes,
      shiftBreakTimes,
      shiftInfo?.hr_shift_master?.end_time
    );
    
    if (calculatedToTime) {
      formData.toTime = calculatedToTime;
      if (formData.fromDate) {
        formData.toDate = formData.fromDate;
      }
      lastAutoCalculatedToTime = calculatedToTime;
    }
  }

  async function checkWorkerConflictsValidation(): Promise<boolean> {
    // CRITICAL: Get the CURRENT state of selectedWorkers (not a stale reference)
    // Create a completely fresh object to ensure no stale data
    const currentSelectedWorkers = { ...formData.selectedWorkers };
    
    // CRITICAL: Validate that selected workers match the current work's skill mappings
    // This prevents checking conflicts for workers from a previous work
    const currentWorkSkillKeys = new Set<string>();
    if (work?.skill_mappings && Array.isArray(work.skill_mappings) && work.skill_mappings.length > 0) {
      let selectedMapping: any = null;
      if (
        formData.selectedSkillMappingIndex >= 0 &&
        formData.selectedSkillMappingIndex < work.skill_mappings.length
      ) {
        selectedMapping = work.skill_mappings[formData.selectedSkillMappingIndex];
      } else if (work.skill_mappings.length === 1) {
        selectedMapping = work.skill_mappings[0];
      }
      if (selectedMapping) {
        const individualSkills = getIndividualSkills(selectedMapping);
        individualSkills.forEach((skillShort: string, index: number) => {
          currentWorkSkillKeys.add(getWorkerSlotKey(skillShort, index));
        });
      }
    } else {
      // No skill mapping path still uses canonical key.
      currentWorkSkillKeys.add(getWorkerSlotKey('GEN', 0));
    }
    
    // Only check conflicts for workers that are explicitly selected (not null/undefined)
    // AND that match the current work's skill mappings
    const validSelectedWorkers: { [key: string]: any } = {};
    Object.entries(currentSelectedWorkers).forEach(([key, worker]) => {
      if (worker && worker.emp_id && typeof worker === 'object') {
        // Verify this worker is selected for a skill that belongs to the current work
        const isCurrentWorkSkill = currentWorkSkillKeys.has(key);
        
        if (isCurrentWorkSkill) {
          // Create a fresh copy of the worker object to avoid any reference issues
          validSelectedWorkers[key] = { ...worker };
        } else {
          console.warn(`⚠️ checkWorkerConflictsValidation: Skipping worker ${worker.emp_name || worker.emp_id} with key "${key}" - not a valid skill for current work`);
        }
      }
    });
    
    // Debug: Log what workers are being checked
    const workerIds = Object.values(validSelectedWorkers).map((w: any) => w.emp_id).filter(Boolean);
    const workerNames = Object.values(validSelectedWorkers).map((w: any) => w.emp_name || w.emp_id).filter(Boolean);
    console.log(`🔍 checkWorkerConflictsValidation: Checking ${workerIds.length} worker(s) for work ${work?.sw_code || work?.derived_sw_code || 'unknown'}:`, workerNames);
    console.log(`🔍 checkWorkerConflictsValidation: Current formData.selectedWorkers keys:`, Object.keys(formData.selectedWorkers));
    console.log(`🔍 checkWorkerConflictsValidation: Current work skill keys:`, Array.from(currentWorkSkillKeys));
    
    if (Object.keys(validSelectedWorkers).length === 0 && formData.selectedTrainees.length === 0) {
      console.log('✅ checkWorkerConflictsValidation: No workers or trainees, skipping conflict check');
      return false;
    }
    
    // Get plan IDs to exclude (for edit mode)
    const excludePlanIds = work?.existingDraftPlans?.map((p: any) => p.id).filter(Boolean) || [];
    
    // Use dates from formData if available, otherwise fall back to selectedDate
    const fromDate = formData.fromDate || selectedDate;
    const toDate = formData.toDate || selectedDate;

    const assignments: WorkerAssignmentInterval[] = [];

    for (const [key, worker] of Object.entries(validSelectedWorkers)) {
      if (!worker || !(worker as any).emp_id) continue;
      const eff = getEffectiveRowTimes(key, formData);
      assignments.push({
        worker,
        fromDate: eff.fromDate || fromDate,
        toDate: eff.toDate || toDate,
        fromTime: eff.fromTime,
        toTime: eff.toTime
      });
    }

    for (let ti = 0; ti < formData.selectedTrainees.length; ti++) {
      const trainee = formData.selectedTrainees[ti];
      const eff = getEffectiveRowTimes(`trainee-${ti}`, formData);
      assignments.push({
        worker: trainee,
        fromDate: eff.fromDate || fromDate,
        toDate: eff.toDate || toDate,
        fromTime: eff.fromTime,
        toTime: eff.toTime
      });
    }

    const result = await checkWorkerConflicts(
      assignments,
      excludePlanIds.length > 0 ? excludePlanIds : undefined,
      stageCode
    );

    if (result.hasConflict) {
      alert(`${result.conflictDetails}\n\nCannot proceed. Please resolve the time conflicts before planning work.`);
      return true;
    }

    return false;
  }

  async function handleSave() {
    // Use dates from formData if available, otherwise fall back to selectedDate
    const fromDate = formData.fromDate || selectedDate;
    const toDate = formData.toDate || selectedDate;
    
    // Validate trainee reason if trainees are selected
    if (formData.selectedTrainees && formData.selectedTrainees.length > 0) {
      if (!formData.traineeDeviationReason || !formData.traineeDeviationReason.trim()) {
        alert('Please provide a reason for adding trainees.');
        return;
      }
    }

    for (const [key, o] of Object.entries(formData.rowTimeOverrides || {})) {
      if (o?.useCustom && (!o.fromTime?.trim() || !o.toTime?.trim())) {
        alert(`Please complete custom from/to times for "${key}" or turn off custom times.`);
        return;
      }
    }
    
    // First check if planning is blocked due to approved submission
    // Check both fromDate and toDate to ensure planning is allowed for the date range
    if (shiftCode && fromDate) {
      const { isPlanningBlockedForStageShiftDate } = await import('$lib/api/production/productionWorkValidationService');
      const blockCheck = await isPlanningBlockedForStageShiftDate(stageCode, shiftCode, fromDate);
      if (blockCheck.isBlocked) {
        alert(blockCheck.reason || 'Planning is blocked for this stage-shift-date combination.');
        return;
      }
      
      // Also check toDate if it's different from fromDate
      if (toDate && toDate !== fromDate) {
        const toDateBlockCheck = await isPlanningBlockedForStageShiftDate(stageCode, shiftCode, toDate);
        if (toDateBlockCheck.isBlocked) {
          alert(toDateBlockCheck.reason || 'Planning is blocked for the end date of this work.');
          return;
        }
      }
    }

    if (warnings.hasAlternativePlanningConflict) {
      alert(warnings.alternativeConflictDetails);
      return;
    }

    const hasConflict = await checkWorkerConflictsValidation();
    if (hasConflict) {
      return;
    }

    if (warnings.showSkillMismatchWarning) {
      const proceed = confirm(`${warnings.skillMismatchDetails}\n\nDo you want to proceed anyway?`);
      if (!proceed) return;
    }

    if (warnings.showTimeOverlapWarning) {
      const proceed = confirm(`${warnings.timeOverlapDetails}\n\nDo you want to proceed anyway?`);
      if (!proceed) return;
    }

    if (warnings.showTimeExcessWarning) {
      const proceed = confirm(`${warnings.timeExcessDetails}\n\nDo you want to proceed anyway?`);
      if (!proceed) return;
    }

    try {
      // Use dates from formData if available, otherwise fall back to selectedDate
      const fromDate = formData.fromDate || selectedDate;
      const toDate = formData.toDate || selectedDate;
      
      console.log('💾 Saving plan with dates:', { fromDate, toDate, fromTime: formData.fromTime, toTime: formData.toTime });
      
      const result = await saveWorkPlanning(
        work,
        formData,
        workContinuation,
        stageCode,
        shiftCode,
        fromDate,
        toDate
      );
      
      dispatch('save', result);
      handleClose();
    } catch (error) {
      console.error('Error creating work planning:', error);
      alert('Error creating work planning: ' + ((error as Error)?.message || 'Unknown error'));
    }
  }

  function handleClose() {
    dispatch('close');
    resetForm();
  }

  function resetForm() {
    // Fix 3: Reset all modal state variables when modal closes
    formData = { ...initialPlanWorkFormData, selectedTrainees: [], traineeDeviationReason: '' };
    warnings = { ...initialWarnings };
    previousSelectedSkillMappingIndex = -1;
    lastAutoCalculatedToTime = null;
    originalDurationMinutes = null;
    currentStep = 1;
    availableWorkers = [];
    filteredAvailableWorkers = [];
    existingPlans = [];
    shiftInfo = null;
    shiftBreakTimes = [];
    workContinuation = {
      hasPreviousWork: false,
      timeWorkedTillDate: 0,
      remainingTime: 0,
      previousReports: []
    };
    savedSelectedWorkers = {}; // Also clear saved workers
    hasPrefilledWorkers = false; // Reset prefilled flag
    userHasSelectedFromTime = false; // Reset user selection flag
  }

  // Filter workers based on time availability when moving to step 2
  async function filterWorkersByTimeAvailability() {
    if (!selectedDate || !formData.fromTime || !formData.toTime) {
      // Sort workers alphabetically
      filteredAvailableWorkers = [...availableWorkers].sort((a, b) => {
        const nameA = (a.emp_name || '').toLowerCase();
        const nameB = (b.emp_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      // Ensure selected workers are included
      ensureSelectedWorkersInAvailable();
      return;
    }

    try {
      // Helper function to convert time string to minutes
      const timeToMinutes = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      // Convert selected time to minutes for comparison
      const fromMinutes = timeToMinutes(formData.fromTime);
      const toMinutes = timeToMinutes(formData.toTime);
      let adjustedToMinutes = toMinutes;
      if (adjustedToMinutes < fromMinutes) {
        adjustedToMinutes += 24 * 60; // Handle overnight
      }
      
      const workerIds = availableWorkers.map(w => w.emp_id);
      
      // First, get workers reassigned TO this stage during the selected time period
      const { data: reassignmentsTo, error: reassignToError } = await supabase
        .from('prdn_planning_stage_reassignment')
        .select('emp_id, from_time, to_time, hr_emp!inner(emp_id, emp_name, skill_short)')
        .eq('to_stage_code', stageCode)
        .eq('planning_date', selectedDate)
        .eq('status', 'draft')
        .eq('is_deleted', false);

      if (reassignToError) {
        console.error('Error checking reassignments to stage:', reassignToError);
      }

      // Add workers reassigned TO this stage during our time period to available workers
      const reassignedWorkers: Worker[] = [];
      (reassignmentsTo || []).forEach((reassignment: any) => {
        if (!reassignment.from_time || !reassignment.to_time) return;
        
        const reassignFromMinutes = timeToMinutes(reassignment.from_time);
        const reassignToMinutes = timeToMinutes(reassignment.to_time);
        let adjustedReassignToMinutes = reassignToMinutes;
        if (adjustedReassignToMinutes < reassignFromMinutes) {
          adjustedReassignToMinutes += 24 * 60; // Handle overnight
        }
        
        // Check if reassignment period overlaps with our planned time (including adjacent slots)
        if (fromMinutes < adjustedReassignToMinutes && adjustedToMinutes > reassignFromMinutes) {
          const emp = reassignment.hr_emp;
          if (emp && !workerIds.includes(emp.emp_id)) {
            reassignedWorkers.push({
              emp_id: emp.emp_id,
              emp_name: emp.emp_name,
              skill_short: emp.skill_short
            });
          }
        }
      });

      // Combine original workers with reassigned workers
      const allWorkers = [...availableWorkers, ...reassignedWorkers];
      const allWorkerIds = allWorkers.map(w => w.emp_id);
      
      // Check existing work plans for all workers at the same time
      const { data: existingPlans, error: plansError } = await supabase
        .from('prdn_work_planning')
        .select('worker_id, from_date, from_time, to_date, to_time')
        .in('worker_id', allWorkerIds)
        .eq('from_date', selectedDate)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .eq('status', 'draft');

      if (plansError) {
        console.error('Error checking existing plans:', plansError);
      }

      // Check stage reassignments - workers reassigned FROM this stage (they're away)
      const { data: reassignmentsFrom, error: reassignFromError } = await supabase
        .from('prdn_planning_stage_reassignment')
        .select('emp_id, from_time, to_time')
        .in('emp_id', allWorkerIds)
        .eq('from_stage_code', stageCode)
        .eq('planning_date', selectedDate)
        .eq('status', 'draft')
        .eq('is_deleted', false);

      if (reassignFromError) {
        console.error('Error checking reassignments from stage:', reassignFromError);
      }

      const unavailableWorkerIds = new Set<string>();
      
      // Check work plan conflicts
      (existingPlans || []).forEach((plan: any) => {
        if (!plan.from_time || !plan.to_time) return;
        
        const planFromMinutes = timeToMinutes(plan.from_time);
        const planToMinutes = timeToMinutes(plan.to_time);
        let adjustedPlanToMinutes = planToMinutes;
        if (adjustedPlanToMinutes < planFromMinutes) {
          adjustedPlanToMinutes += 24 * 60; // Handle overnight
        }
        
        // Check if time ranges overlap (excluding adjacent slots)
        // Two ranges overlap if: start1 < end2 && end1 > start2
        // Adjacent slots (where one ends exactly when another starts) are allowed
        // This means we only mark as unavailable if there's actual overlap, not just adjacency
        const hasOverlap = fromMinutes < adjustedPlanToMinutes && adjustedToMinutes > planFromMinutes;
        // Also check if new work starts before existing work ends AND new work ends after existing work starts
        // But exclude the case where they're exactly adjacent (one ends when another starts)
        const isAdjacent = (fromMinutes === adjustedPlanToMinutes) || (adjustedToMinutes === planFromMinutes);
        if (hasOverlap && !isAdjacent) {
          unavailableWorkerIds.add(plan.worker_id);
        }
      });

      // Check reassignments FROM this stage (workers are away during that time)
      (reassignmentsFrom || []).forEach((reassignment: any) => {
        if (!reassignment.from_time || !reassignment.to_time) return;
        
        const reassignFromMinutes = timeToMinutes(reassignment.from_time);
        const reassignToMinutes = timeToMinutes(reassignment.to_time);
        let adjustedReassignToMinutes = reassignToMinutes;
        if (adjustedReassignToMinutes < reassignFromMinutes) {
          adjustedReassignToMinutes += 24 * 60; // Handle overnight
        }
        
        // Check if time ranges overlap (worker is away during our planned time)
        // Adjacent slots are allowed (where reassignment ends exactly when our work starts)
        if (fromMinutes < adjustedReassignToMinutes && adjustedToMinutes > reassignFromMinutes) {
          unavailableWorkerIds.add(reassignment.emp_id);
        }
      });

      // Filter out unavailable workers
      const filtered = allWorkers.filter(w => !unavailableWorkerIds.has(w.emp_id));
      
      // Sort workers alphabetically by name
      filteredAvailableWorkers = filtered.sort((a, b) => {
        const nameA = (a.emp_name || '').toLowerCase();
        const nameB = (b.emp_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      // Ensure selected workers are always included (for edit mode - they're already assigned to this work)
      ensureSelectedWorkersInAvailable();
      
      console.log(`✅ Filtered workers: ${filteredAvailableWorkers.length} available out of ${allWorkers.length} total (${reassignedWorkers.length} reassigned to stage)`);
    } catch (error) {
      console.error('Error filtering workers by time availability:', error);
      // Sort workers alphabetically even on error
      filteredAvailableWorkers = [...availableWorkers].sort((a, b) => {
        const nameA = (a.emp_name || '').toLowerCase();
        const nameB = (b.emp_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      ensureSelectedWorkersInAvailable();
    }
  }

  // Ensure selected workers are always in the available workers list (for edit mode)
  function ensureSelectedWorkersInAvailable() {
    const selectedWorkerIds = new Set<string>();
    Object.values(formData.selectedWorkers).forEach((worker: SelectedWorker | null) => {
      if (worker && worker.emp_id) {
        selectedWorkerIds.add(worker.emp_id);
      }
    });
    (formData.selectedTrainees || []).forEach((t: SelectedWorker) => {
      if (t?.emp_id) selectedWorkerIds.add(t.emp_id);
    });

    // Check if any selected workers are missing from filteredAvailableWorkers
    selectedWorkerIds.forEach(empId => {
      const isInAvailable = filteredAvailableWorkers.some(w => w.emp_id === empId);
      if (!isInAvailable) {
        const worker = findWorkerByEmpId(empId);
        if (worker) {
          // Add to filteredAvailableWorkers
          filteredAvailableWorkers = [...filteredAvailableWorkers, worker];
          console.log(`➕ Added selected worker to available list: ${worker.emp_name} (${worker.emp_id})`);
        } else {
          // Worker not in availableWorkers, try to get from selectedWorkers or trainees
          const selectedWorker =
            (Object.values(formData.selectedWorkers).find(
              (w: SelectedWorker | null) => w && w.emp_id === empId
            ) as SelectedWorker | null) ||
            (formData.selectedTrainees || []).find((t) => t.emp_id === empId) ||
            null;
          if (selectedWorker) {
            // Create a Worker object from SelectedWorker
            filteredAvailableWorkers = [...filteredAvailableWorkers, {
              emp_id: selectedWorker.emp_id,
              emp_name: selectedWorker.emp_name,
              skill_short: selectedWorker.skill_short
            }];
            console.log(`➕ Added selected worker to available list: ${selectedWorker.emp_name} (${selectedWorker.emp_id})`);
          }
        }
      }
    });
  }

  // Move to step 2 (worker selection) after time is set
  async function proceedToWorkerSelection() {
    if (!formData.fromTime || !formData.toTime) {
      alert('Please select both start time and end time before proceeding.');
      return;
    }

    // Validate time
    checkTimeOverlapValidation();
    checkTimeExcessValidation();
    
    if (warnings.showTimeOverlapWarning || warnings.showTimeExcessWarning) {
      const proceed = confirm(
        `${warnings.timeOverlapDetails || ''}\n${warnings.timeExcessDetails || ''}\n\nDo you want to proceed anyway?`
      );
      if (!proceed) return;
    }

    // Filter workers based on time availability
    await filterWorkersByTimeAvailability();
    
    // Fix 4: Restore saved workers if they exist (user went back and forward)
    if (Object.keys(savedSelectedWorkers).length > 0) {
      formData.selectedWorkers = { ...savedSelectedWorkers };
      savedSelectedWorkers = {}; // Clear saved workers after restoring
    }
    
    // Ensure selected workers are in the available list (in case they were filtered out)
    ensureSelectedWorkersInAvailable();
    
    // Move to step 2
    currentStep = 2;
  }

  // Go back to step 1 (time selection)
  function goBackToTimeSelection() {
    // Fix 4: Save current worker selections before clearing them
    savedSelectedWorkers = { ...formData.selectedWorkers };
    currentStep = 1;
    // Clear worker selections when going back
    formData.selectedWorkers = {};
  }
</script>

{#if isOpen}
  <!-- Modal backdrop -->
  <button 
    class="fixed inset-0 bg-black bg-opacity-50 z-[9999] w-full h-full border-none p-0"
    on:click={handleClose}
    aria-label="Close modal"
  ></button>
  
  <!-- Modal content -->
  <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl border-2 border-gray-300 dark:border-gray-600 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="px-6 py-4 border-b theme-border">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium theme-text-primary">Plan Work</h3>
            <button
              type="button"
              class="theme-text-secondary hover:theme-text-primary transition-colors"
              on:click={handleClose}
            >
              <X class="w-6 h-6" />
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="px-6 py-4 space-y-4">
        {#if isLoading}
          <div class="text-center py-8">
            <p class="theme-text-secondary">Loading...</p>
            </div>
        {:else if work}
          <!-- Work Details Display -->
          <WorkDetailsDisplay 
            {work} 
            {workContinuation}
          />

          <!-- Warnings Display -->
          <WarningsDisplay {warnings} />

            <!-- Step Indicator -->
            <div class="flex items-center justify-center mb-6">
              <div class="flex items-center space-x-4">
                <!-- Step 1: Time Selection -->
                <div class="flex items-center">
                  <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 {
                    currentStep >= 1 ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-gray-400'
                  }">
                    {currentStep > 1 ? '✓' : '1'}
                  </div>
                  <span class="ml-2 text-sm font-medium {
                    currentStep >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                  }">Time Selection</span>
                </div>
                
                <!-- Arrow -->
                <div class="w-8 h-0.5 bg-gray-300"></div>
                
                <!-- Step 2: Worker Selection -->
                <div class="flex items-center">
                  <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 {
                    currentStep >= 2 ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-gray-400'
                  }">
                    2
                  </div>
                  <span class="ml-2 text-sm font-medium {
                    currentStep >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                  }">Worker Selection</span>
                </div>
              </div>
            </div>

            {#if currentStep === 1}
              <!-- Step 1: Time Selection -->
              <div class="space-y-4">
                <h4 class="font-medium theme-text-primary text-lg">Step 1: Select Time</h4>
                
          {#key `${work?.sw_id || work?.id || 'new'}-${work?.wo_details_id || 'unknown'}-${userHasSelectedFromTime}`}
            <TimePlanning
              bind:fromDate={formData.fromDate}
              bind:toDate={formData.toDate}
              bind:fromTime={formData.fromTime}
              bind:toTime={formData.toTime}
              plannedHours={formData.plannedHours}
              {shiftInfo}
              {work}
              onFromTimeChange={handleFromTimeChange}
              onFromDateChange={handleFromDateChange}
              onToDateChange={handleToDateChange}
              onAutoCalculate={handleAutoCalculate}
            />
          {/key}
              </div>
            {:else if currentStep === 2}
              <!-- Step 2: Worker Selection -->
              <div class="space-y-4">
                <h4 class="font-medium theme-text-primary text-lg">Step 2: Select Workers</h4>
                <p class="text-sm theme-text-secondary">
                  Only workers available during {formData.fromTime} - {formData.toTime} are shown.
                </p>
                
                {#key `${work?.sw_id || work?.id || 'new'}-${work?.wo_details_id || 'unknown'}`}
                  <WorkerSelection
                    {work}
                    availableWorkers={filteredAvailableWorkers}
                    selectedWorkers={formData.selectedWorkers}
                    selectedTrainees={formData.selectedTrainees}
                    traineeDeviationReason={formData.traineeDeviationReason}
                    selectedSkillMappingIndex={formData.selectedSkillMappingIndex}
                    {selectedDate}
                    fromTime={formData.fromTime}
                    toTime={formData.toTime}
                    shiftInfo={shiftInfo}
                    rowTimeOverrides={formData.rowTimeOverrides}
                    onRowCustomTimesChange={handleRowCustomTimesChange}
                    excludePlanIds={work?.existingDraftPlans?.map((p: any) => p.id).filter(Boolean) || []}
                    onWorkerChange={handleWorkerChange}
                    onTraineeAdd={handleTraineeAdd}
                    onTraineeRemove={handleTraineeRemove}
                    onTraineeReasonChange={handleTraineeReasonChange}
                    onSkillMappingChange={handleSkillMappingChange}
                  />
                {/key}
              </div>
            {/if}
          {/if}
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t theme-border flex justify-between">
          <div>
            {#if currentStep === 2}
              <Button variant="secondary" on:click={goBackToTimeSelection}>
                ← Back to Time Selection
              </Button>
            {/if}
          </div>
          <div class="flex space-x-3">
          <Button variant="secondary" on:click={handleClose}>
            Cancel
          </Button>
            {#if currentStep === 1}
              <Button 
                variant="primary" 
                on:click={proceedToWorkerSelection}
                disabled={!formData.fromTime || !formData.toTime}
              >
                Next: Select Workers →
              </Button>
            {:else if currentStep === 2}
        <Button 
          variant="primary" 
          on:click={handleSave} 
          disabled={
            Object.values(formData.selectedWorkers).filter(Boolean).length === 0 ||
            (formData.selectedTrainees.length > 0 && !formData.traineeDeviationReason.trim())
          }
        >
            Save Plan
          </Button>
            {/if}
          </div>
        </div>
    </div>
  </div>
{/if}
