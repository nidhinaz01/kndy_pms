<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import TimePicker from '$lib/components/common/TimePicker.svelte';
  import { X, Clock, User, AlertTriangle } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { createWorkPlanning } from '$lib/api/production';

  export let isOpen: boolean = false;
  export let work: any = null;
  export let selectedDate: string = '';
  export let stageCode: string = '';

  const dispatch = createEventDispatcher();

  // Modal state
  let isLoading = false;
  let availableWorkers: Array<{ emp_id: string; emp_name: string; skill_short: string }> = [];
  let selectedWorkers: { [skill: string]: { emp_id: string; emp_name: string; skill_short: string } | null } = {};
  let fromTime = '';
  let toTime = '';
  let plannedHours = 0;
  let showSkillMismatchWarning = false;
  let skillMismatchDetails = '';

  // Work continuation data
  let workContinuation = {
    hasPreviousWork: false,
    timeWorkedTillDate: 0,
    remainingTime: 0,
    previousReports: [] as any[]
  };

  // Time overlap prevention
  let existingPlans: any[] = [];
  let showTimeOverlapWarning = false;
  let timeOverlapDetails = '';

  // Time validation
  let showTimeExcessWarning = false;
  let timeExcessDetails = '';

  // Shift information for auto-calculating end time
  let shiftInfo: any = null;

  // Validation for alternative skill combinations
  let hasAlternativePlanningConflict = false;
  let alternativeConflictDetails = '';
  
  // Track which skill combination is selected (only one at a time)
  let selectedSkillMappingIndex = -1;
  let previousSelectedSkillMappingIndex = -1;

  // Watch for work changes
  $: if (work) {
    console.log('PlanWorkModal: Work changed:', work);
    loadWorkers();
    loadWorkContinuation();
    loadExistingPlans();
    loadShiftInfo();
    calculatePlannedHours();
    checkAlternativeSkillCombinations();
    
    // Reset selected skill mapping and workers
    selectedSkillMappingIndex = -1;
    previousSelectedSkillMappingIndex = -1;
    selectedWorkers = {};
    
    // Auto-select if only one skill mapping
    if (work?.skill_mappings && work.skill_mappings.length === 1) {
      selectedSkillMappingIndex = 0;
      previousSelectedSkillMappingIndex = 0;
    }
  }

  // Debug modal state
  $: console.log('PlanWorkModal: isOpen =', isOpen, 'work =', work);
  
  // Clear workers when switching skill mappings
  $: if (selectedSkillMappingIndex !== previousSelectedSkillMappingIndex && previousSelectedSkillMappingIndex >= 0) {
    console.log('Clearing workers due to skill mapping change');
    selectedWorkers = {};
    previousSelectedSkillMappingIndex = selectedSkillMappingIndex;
  } else if (selectedSkillMappingIndex >= 0) {
    previousSelectedSkillMappingIndex = selectedSkillMappingIndex;
  }

  // Watch for time changes
  $: {
    calculatePlannedHours();
    checkTimeOverlap();
    checkTimeExcess();
    // Recalculate break time when time inputs change
    if (fromTime && toTime) {
      calculateBreakTimeInSlot();
    }
  }

  // Watch for fromTime changes to auto-calculate end time
  // Use remaining time if available, otherwise use standard time
  $: if (fromTime && (workContinuation.remainingTime > 0 || work?.std_vehicle_work_flow?.estimated_duration_minutes)) {
    autoCalculateEndTime();
  }

  async function loadWorkers() {
    if (!stageCode) return;
    
    try {
      // Get workers assigned to the current stage
      const { data, error } = await supabase
        .from('hr_emp')
        .select(`
          emp_id,
          emp_name,
          skill_short,
          stage
        `)
        .eq('stage', stageCode)
        .eq('is_active', true)
        .eq('is_deleted', false);

      if (error) {
        console.error('Error loading workers:', error);
        return;
      }

      availableWorkers = data || [];
      console.log(`👥 Loaded ${availableWorkers.length} workers for stage ${stageCode}:`, availableWorkers);
    } catch (error) {
      console.error('Error loading workers:', error);
    }
  }

  async function checkAlternativeSkillCombinations() {
    if (!work || !work.skill_mappings || work.skill_mappings.length <= 1) {
      hasAlternativePlanningConflict = false;
      alternativeConflictDetails = '';
      return;
    }

    // Only check if there are multiple skill combinations (alternatives)
    const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    
    if (!derivedSwCode) {
      hasAlternativePlanningConflict = false;
      alternativeConflictDetails = '';
      return;
    }

    try {
      // Check if any alternative skill combination has been planned and not completed
      const { data: existingPlans, error } = await supabase
        .from('prdn_work_planning')
        .select(`
          *,
          prdn_work_reporting!left(
            id,
            is_deleted
          )
        `)
        .eq('derived_sw_code', derivedSwCode)
        .eq('stage_code', stageCode)
        .eq('is_active', true)
        .eq('is_deleted', false);

      if (error) {
        console.error('Error checking alternative combinations:', error);
        return;
      }

      if (!existingPlans || existingPlans.length === 0) {
        hasAlternativePlanningConflict = false;
        alternativeConflictDetails = '';
        return;
      }

      // Check if any existing plan is not completed
      const uncompletedPlans = existingPlans.filter(plan => {
        // Check if there's a report for this plan
        const reports = plan.prdn_work_reporting || [];
        const activeReports = reports.filter((r: any) => !r.is_deleted);
        return activeReports.length === 0; // No reports = not completed
      });

      if (uncompletedPlans.length > 0) {
        // Get the skill combinations of those uncompleted plans
        const conflictingScNames = uncompletedPlans.map((plan: any) => plan.sc_required).filter(Boolean);
        
        if (conflictingScNames.length > 0) {
          hasAlternativePlanningConflict = true;
          alternativeConflictDetails = `This work has alternative skill combinations that have been planned but not completed:\n\n${conflictingScNames.join('\n')}\n\nOnce an alternative is planned and not completed, other alternatives cannot be planned.`;
          console.warn('⚠️ Alternative planning conflict detected:', conflictingScNames);
        } else {
          hasAlternativePlanningConflict = false;
          alternativeConflictDetails = '';
        }
      } else {
        hasAlternativePlanningConflict = false;
        alternativeConflictDetails = '';
      }
    } catch (error) {
      console.error('Error checking alternative skill combinations:', error);
      hasAlternativePlanningConflict = false;
      alternativeConflictDetails = '';
    }
  }

  async function loadWorkContinuation() {
    if (!work || !selectedDate) return;

    try {
      // First, check if the work object already has time_taken and remaining_time from Works tab
      // This is more reliable than recalculating
      if (work.time_taken !== undefined && work.remaining_time !== undefined) {
        workContinuation.timeWorkedTillDate = work.time_taken || 0;
        workContinuation.remainingTime = work.remaining_time || 0;
        workContinuation.hasPreviousWork = (work.time_taken || 0) > 0;
        
        console.log(`📊 Using work object time data:`, {
          time_taken: work.time_taken,
          remaining_time: work.remaining_time,
          timeWorkedTillDate: workContinuation.timeWorkedTillDate,
          remainingTime: workContinuation.remainingTime
        });
        return;
      }

      const workCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
      const woDetailsId = work.prdn_wo_details_id || work.wo_details_id;
      
      if (!workCode || !woDetailsId) {
        console.warn('⚠️ Missing workCode or woDetailsId for work continuation');
        // Fallback calculation
        const standardTime = work.std_vehicle_work_flow?.estimated_duration_minutes || 0;
        const standardHours = standardTime / 60;
        workContinuation.remainingTime = standardHours;
        workContinuation.timeWorkedTillDate = 0;
        return;
      }

      // Check if this work has been reported before (before or on the selected date)
      // We need to get reports for the same work code and work order
      // Match the Works tab query: only filter by is_deleted, not is_active
      const { data, error } = await supabase
        .from('prdn_work_reporting')
        .select(`
          hours_worked_till_date,
          hours_worked_today,
          from_date,
          prdn_work_planning!inner(
            derived_sw_code,
            wo_details_id,
            from_date,
            stage_code
          )
        `)
        .eq('prdn_work_planning.derived_sw_code', workCode)
        .eq('prdn_work_planning.wo_details_id', woDetailsId)
        .eq('prdn_work_planning.stage_code', stageCode)
        .lte('prdn_work_planning.from_date', selectedDate)
        .eq('is_deleted', false)
        .order('prdn_work_planning.from_date', { ascending: false })
        .order('created_dt', { ascending: false });

      if (error) {
        console.error('Error loading work continuation:', error);
        // Fallback calculation
        const standardTime = work.std_vehicle_work_flow?.estimated_duration_minutes || 0;
        const standardHours = standardTime / 60;
        workContinuation.remainingTime = standardHours;
        workContinuation.timeWorkedTillDate = 0;
        return;
      }

      if (data && data.length > 0) {
        workContinuation.hasPreviousWork = true;
        workContinuation.previousReports = data;
        
        // Calculate total time worked till date
        // We need to sum all hours_worked_today from reports on dates before the selected date
        // For reports on the same date, we should use the average (like Works tab does)
        // But for cumulative time, we sum all hours_worked_today from all previous dates
        
        // Group reports by date
        const reportsByDate = data.reduce((groups, report) => {
          const planning = report.prdn_work_planning as any;
          const reportDate = planning?.from_date || report.from_date;
          if (!groups[reportDate]) {
            groups[reportDate] = [];
          }
          groups[reportDate].push(report);
          return groups;
        }, {} as { [date: string]: any[] });
        
        // Calculate cumulative time: for each date, average the hours_worked_today, then sum across dates
        let totalTimeWorked = 0;
        Object.entries(reportsByDate).forEach(([date, reports]) => {
          // For each date, get the average of hours_worked_today (handles multiple workers on same date)
          const hoursWorkedTodayValues = reports.map(r => r.hours_worked_today || 0).filter(h => h > 0);
          if (hoursWorkedTodayValues.length > 0) {
            const averageForDate = hoursWorkedTodayValues.reduce((sum, h) => sum + h, 0) / hoursWorkedTodayValues.length;
            totalTimeWorked += averageForDate;
          }
        });
        
        workContinuation.timeWorkedTillDate = totalTimeWorked;

        // Calculate remaining time
        const standardTime = work.std_vehicle_work_flow?.estimated_duration_minutes || 0;
        const standardHours = standardTime / 60;
        workContinuation.remainingTime = Math.max(0, standardHours - workContinuation.timeWorkedTillDate);
        
        console.log(`📊 Work continuation calculation:`, {
          workCode,
          woDetailsId,
          stageCode,
          selectedDate,
          standardTime,
          standardHours,
          timeWorkedTillDate: workContinuation.timeWorkedTillDate,
          remainingTime: workContinuation.remainingTime,
          totalReports: data.length,
          reportsByDate: Object.keys(reportsByDate).length,
          reportsData: data.map(r => ({
            date: (r.prdn_work_planning as any)?.from_date || r.from_date,
            hours_worked_today: r.hours_worked_today,
            hours_worked_till_date: r.hours_worked_till_date
          }))
        });
      } else {
        // If no previous work, remaining time = standard time
        const standardTime = work.std_vehicle_work_flow?.estimated_duration_minutes || 0;
        const standardHours = standardTime / 60;
        workContinuation.remainingTime = standardHours;
        workContinuation.timeWorkedTillDate = 0;
        workContinuation.hasPreviousWork = false;
        
        console.log(`📊 No previous work - remaining time = standard time:`, {
          workCode,
          woDetailsId,
          standardTime,
          standardHours,
          remainingTime: workContinuation.remainingTime
        });
      }
    } catch (error) {
      console.error('Error loading work continuation:', error);
      // Fallback calculation
      const standardTime = work.std_vehicle_work_flow?.estimated_duration_minutes || 0;
      const standardHours = standardTime / 60;
      workContinuation.remainingTime = standardHours;
      workContinuation.timeWorkedTillDate = 0;
    }
  }

  async function loadExistingPlans() {
    if (!selectedDate) return;

    try {
      // Load all existing plans for the selected date
      const { data, error } = await supabase
        .from('prdn_work_planning')
        .select(`
          *,
          hr_emp!inner(
            emp_id,
            emp_name
          ),
          std_work_type_details!inner(
            sw_code,
            derived_sw_code,
            std_work_details!inner(
              sw_name
            )
          )
        `)
        .eq('from_date', selectedDate)
        .eq('is_active', true)
        .eq('is_deleted', false);

      if (error) {
        console.error('Error loading existing plans:', error);
        return;
      }

      existingPlans = data || [];
      console.log(`📅 Loaded ${existingPlans.length} existing plans for ${selectedDate}`);
    } catch (error) {
      console.error('Error loading existing plans:', error);
    }
  }

  async function loadShiftInfo() {
    if (!selectedDate) return;

    try {
      // Get shift schedule for the selected date
      const { data, error } = await supabase
        .from('hr_daily_shift_schedule')
        .select(`
          *,
          hr_shift_master!inner(
            shift_id,
            shift_code,
            shift_name,
            start_time,
            end_time
          )
        `)
        .eq('schedule_date', selectedDate)
        .eq('is_working_day', true)
        .eq('is_active', true)
        .eq('is_deleted', false);

      if (error) {
        console.error('Error loading shift info:', error);
        return;
      }

      // For now, use the first shift (you might want to make this configurable)
      shiftInfo = data?.[0] || null;
      
      if (shiftInfo?.hr_shift_master?.shift_id) {
        // Fetch break times for this shift
        const { data: breakData, error: breakError } = await supabase
          .from('hr_shift_break_master')
          .select('*')
          .eq('shift_id', shiftInfo.hr_shift_master.shift_id)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .order('break_number');

        if (!breakError && breakData) {
          shiftInfo.breakTimes = breakData;
          console.log(`🕐 Loaded break times for shift ${shiftInfo.hr_shift_master.shift_id}:`, breakData);
        } else if (breakError) {
          console.error('❌ Error loading break times:', breakError);
        } else {
          console.log('⚠️ No break times found for shift:', shiftInfo.hr_shift_master.shift_id);
        }
      }
      
      console.log(`🕐 Loaded shift info for ${selectedDate}:`, shiftInfo);
    } catch (error) {
      console.error('Error loading shift info:', error);
    }
  }

  function calculatePlannedHours() {
    if (!fromTime || !toTime) {
      plannedHours = 0;
      return;
    }

    try {
      const from = new Date(`2000-01-01T${fromTime}`);
      let to = new Date(`2000-01-01T${toTime}`);
      
      // If end time is earlier than start time, it means it's the next day
      if (to < from) {
        to = new Date(`2000-01-02T${toTime}`);
      }
      
      // Calculate total duration in milliseconds
      const diffMs = to.getTime() - from.getTime();
      
      // Get break time in minutes that overlaps with the planned time slot
      const breakMinutes = calculateBreakTimeInSlot();
      
      // Convert break time to hours and subtract from total duration
      const breakHours = breakMinutes / 60;
      const totalHours = diffMs / (1000 * 60 * 60); // Convert to hours
      plannedHours = totalHours - breakHours; // Subtract break time
      
      // Ensure planned hours is not negative
      if (plannedHours < 0) {
        plannedHours = 0;
      }
    } catch (error) {
      console.error('Error calculating planned hours:', error);
      plannedHours = 0;
    }
  }

  function calculateBreakTimeInSlot(): number {
    console.log('🔍 calculateBreakTimeInSlot called with:', {
      fromTime,
      toTime,
      shiftInfo: shiftInfo ? 'exists' : 'null',
      breakTimes: shiftInfo?.breakTimes ? shiftInfo.breakTimes.length : 'no breakTimes'
    });

    if (!fromTime || !toTime || !shiftInfo?.breakTimes) {
      console.log('❌ Early return - missing data:', {
        fromTime: !!fromTime,
        toTime: !!toTime,
        breakTimes: !!shiftInfo?.breakTimes
      });
      return 0;
    }

    try {
      const plannedStart = new Date(`2000-01-01T${fromTime}`);
      const plannedEnd = new Date(`2000-01-01T${toTime}`);
      
      if (plannedEnd < plannedStart) {
        plannedEnd.setDate(plannedEnd.getDate() + 1);
      }

      console.log('📅 Planned time range:', {
        plannedStart: plannedStart.toTimeString(),
        plannedEnd: plannedEnd.toTimeString()
      });

      let totalBreakMinutes = 0;

      shiftInfo.breakTimes.forEach((breakTime: any) => {
        console.log('🕐 Processing break:', breakTime);
        
        const breakStart = new Date(`2000-01-01T${breakTime.start_time}`);
        const breakEnd = new Date(`2000-01-01T${breakTime.end_time}`);
        
        if (breakEnd < breakStart) {
          breakEnd.setDate(breakEnd.getDate() + 1);
        }

        console.log('🕐 Break time range:', {
          breakStart: breakStart.toTimeString(),
          breakEnd: breakEnd.toTimeString()
        });

        // Calculate overlap between planned time and break time
        const overlapStart = new Date(Math.max(plannedStart.getTime(), breakStart.getTime()));
        const overlapEnd = new Date(Math.min(plannedEnd.getTime(), breakEnd.getTime()));
        
        console.log('🕐 Overlap calculation:', {
          overlapStart: overlapStart.toTimeString(),
          overlapEnd: overlapEnd.toTimeString(),
          hasOverlap: overlapStart < overlapEnd
        });
        
        if (overlapStart < overlapEnd) {
          const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
          const overlapMinutes = overlapMs / (1000 * 60);
          totalBreakMinutes += overlapMinutes;
          
          console.log(`✅ Break overlap detected: ${breakTime.break_name} (${breakTime.start_time}-${breakTime.end_time}) overlaps with planned time (${fromTime}-${toTime}) by ${overlapMinutes} minutes`);
        } else {
          console.log(`❌ No overlap: ${breakTime.break_name} (${breakTime.start_time}-${breakTime.end_time}) does not overlap with planned time (${fromTime}-${toTime})`);
        }
      });

      console.log(`📊 Total break minutes in slot: ${totalBreakMinutes}`);
      return totalBreakMinutes;
    } catch (error) {
      console.error('Error calculating break time in slot:', error);
      return 0;
    }
  }

  /**
   * Calculate break time that will be spanned by the work period
   * This function is used when auto-calculating end time (before toTime is known)
   * It iteratively calculates which breaks will be spanned and adds their duration
   */
  function calculateBreakTimeForWorkPeriod(startTimeStr: string, workDurationMinutes: number): number {
    if (!startTimeStr || !shiftInfo?.breakTimes || shiftInfo.breakTimes.length === 0) {
      return 0;
    }

    try {
      const startTime = new Date(`2000-01-01T${startTimeStr}`);
      let currentEndTime = new Date(startTime.getTime() + workDurationMinutes * 60000);
      let totalBreakMinutes = 0;
      let previousTotalBreakMinutes = -1;
      const maxIterations = 10; // Prevent infinite loops
      let iterations = 0;

      // Iteratively calculate break time
      // We need to iterate because adding break time might cause the work period to span additional breaks
      while (iterations < maxIterations) {
        iterations++;
        previousTotalBreakMinutes = totalBreakMinutes;
        totalBreakMinutes = 0;

        // Check each break to see if it's spanned by the current work period
        shiftInfo.breakTimes.forEach((breakTime: any) => {
          const breakStart = new Date(`2000-01-01T${breakTime.start_time}`);
          let breakEnd = new Date(`2000-01-01T${breakTime.end_time}`);
          
          // Handle overnight breaks
          if (breakEnd < breakStart) {
            breakEnd.setDate(breakEnd.getDate() + 1);
          }

          // Check if the work period spans this break
          // A break is spanned only if there's actual overlap:
          // Work overlaps break if: startTime < breakEnd AND currentEndTime > breakStart
          // This excludes cases where work starts exactly at break end or ends exactly at break start
          if (startTime < breakEnd && currentEndTime > breakStart) {
            // Calculate the full break duration
            const breakDurationMs = breakEnd.getTime() - breakStart.getTime();
            const breakDurationMinutes = breakDurationMs / (1000 * 60);
            totalBreakMinutes += breakDurationMinutes;
            
            console.log(`✅ Break spanned: ${breakTime.break_name} (${breakTime.start_time}-${breakTime.end_time}) - ${breakDurationMinutes} minutes`);
          } else {
            console.log(`❌ Break NOT spanned: ${breakTime.break_name} (${breakTime.start_time}-${breakTime.end_time}) - work starts at ${startTimeStr}, ends at ${currentEndTime.toTimeString().substring(0, 5)}`);
          }
        });

        // If no new breaks were found, we're done
        if (totalBreakMinutes === previousTotalBreakMinutes) {
          break;
        }

        // Update current end time to include the break time
        currentEndTime = new Date(startTime.getTime() + (workDurationMinutes + totalBreakMinutes) * 60000);
      }

      console.log(`📊 Total break minutes for work period: ${totalBreakMinutes} (after ${iterations} iterations)`);
      return totalBreakMinutes;
    } catch (error) {
      console.error('Error calculating break time for work period:', error);
      return 0;
    }
  }

  function autoCalculateEndTime() {
    if (!fromTime) {
      return;
    }

    try {
      // Use remaining time if available, otherwise use standard time
      const remainingTimeHours = workContinuation.remainingTime > 0 
        ? workContinuation.remainingTime 
        : (work?.std_vehicle_work_flow?.estimated_duration_minutes || 0) / 60;
      
      const workDurationMinutes = remainingTimeHours * 60;
      
      if (workDurationMinutes <= 0) {
        console.warn('⚠️ No remaining time or standard time available for auto-calculation');
        return;
      }
      
      // Calculate break time that will be spanned by the work period
      const breakMinutes = calculateBreakTimeForWorkPeriod(fromTime, workDurationMinutes);
      const shiftEndTime = shiftInfo?.hr_shift_master?.end_time;

      // Calculate start time
      const startTime = new Date(`2000-01-01T${fromTime}`);
      
      // Calculate end time including break
      const endTime = new Date(startTime.getTime() + (workDurationMinutes + breakMinutes) * 60000);
      
      // Format end time
      const endTimeString = endTime.toTimeString().substring(0, 5);
      
      // Check if end time exceeds shift end time
      if (shiftEndTime && endTimeString > shiftEndTime) {
        // If work extends beyond shift, set to shift end time
        toTime = shiftEndTime;
        console.log(`⚠️ Work duration exceeds shift end time. Set to shift end: ${shiftEndTime}`);
      } else {
        toTime = endTimeString;
        console.log(`✅ Auto-calculated end time: ${endTimeString} (work: ${workDurationMinutes}min + break: ${breakMinutes}min)`);
      }
      
      // Recalculate planned hours
      calculatePlannedHours();
    } catch (error) {
      console.error('Error auto-calculating end time:', error);
    }
  }

  function checkTimeOverlap() {
    if (!fromTime || !toTime) {
      showTimeOverlapWarning = false;
      return;
    }

    const assignedWorkers = Object.values(selectedWorkers).filter(Boolean);
    if (assignedWorkers.length === 0) {
      showTimeOverlapWarning = false;
      return;
    }

    // Check for time overlaps for all assigned workers
    const newFrom = new Date(`2000-01-01T${fromTime}`);
    const newTo = new Date(`2000-01-01T${toTime}`);
    
    if (newTo < newFrom) {
      newTo.setDate(newTo.getDate() + 1);
    }

    const overlaps: string[] = [];

    assignedWorkers.filter(worker => worker !== null).forEach(worker => {
      if (!worker) return;
      const workerPlans = existingPlans.filter(plan => plan.worker_id === worker.emp_id);
      
      const overlappingPlans = workerPlans.filter(plan => {
        const planFrom = new Date(`2000-01-01T${plan.from_time}`);
        const planTo = new Date(`2000-01-01T${plan.to_time}`);
        
        if (planTo < planFrom) {
          planTo.setDate(planTo.getDate() + 1);
        }

        // Check if time ranges overlap
        return (newFrom < planTo && newTo > planFrom);
      });

      if (overlappingPlans.length > 0) {
        const overlapDetails = overlappingPlans.map(plan => 
          `${plan.std_work_type_details?.sw_code || 'N/A'} (${plan.from_time} - ${plan.to_time})`
        ).join(', ');
        overlaps.push(`${worker.emp_name}: ${overlapDetails}`);
      }
    });

    if (overlaps.length > 0) {
      showTimeOverlapWarning = true;
      timeOverlapDetails = `Time overlaps detected:\n${overlaps.join('\n')}`;
    } else {
      showTimeOverlapWarning = false;
    }
  }

  function checkTimeExcess() {
    if (!fromTime || !toTime) {
      showTimeExcessWarning = false;
      return;
    }

    // Use remaining time if available, otherwise use standard time
    const remainingTimeHours = workContinuation.remainingTime > 0 
      ? workContinuation.remainingTime 
      : (work?.std_vehicle_work_flow?.estimated_duration_minutes || 0) / 60;
    
    const workDurationMinutes = remainingTimeHours * 60;
    
    if (workDurationMinutes <= 0) {
      showTimeExcessWarning = false;
      return;
    }
    
    // Use the same break calculation as autoCalculateEndTime to ensure consistency
    const breakMinutes = calculateBreakTimeInSlot();
    const requiredTimeMinutes = workDurationMinutes + breakMinutes;
    
    // Calculate planned time - handle midnight crossover correctly
    const from = new Date(`2000-01-01T${fromTime}`);
    let to = new Date(`2000-01-01T${toTime}`);
    
    // If end time is earlier than start time, it means it's the next day
    if (to < from) {
      to = new Date(`2000-01-02T${toTime}`);
    }
    
    const plannedTimeMinutes = (to.getTime() - from.getTime()) / (1000 * 60);
    
    // Debug logging
    console.log('⏰ Time Excess Check:', {
      fromTime,
      toTime,
      from: from.toISOString(),
      to: to.toISOString(),
      plannedTimeMinutes,
      requiredTimeMinutes,
      excess: plannedTimeMinutes - requiredTimeMinutes
    });
    
    // Allow a small tolerance (5 minutes) to account for rounding differences
    const toleranceMinutes = 5;
    const excessMinutes = plannedTimeMinutes - requiredTimeMinutes;
    
    // Check if planned time exceeds required time beyond tolerance
    if (excessMinutes > toleranceMinutes) {
      const excessHours = Math.floor(excessMinutes / 60);
      const excessMins = Math.round(excessMinutes % 60);
      
      showTimeExcessWarning = true;
      timeExcessDetails = `Planned time exceeds work requirement by ${excessHours}h ${excessMins}m.\nRequired: ${formatTime(requiredTimeMinutes / 60)}\nPlanned: ${formatTime(plannedTimeMinutes / 60)}`;
    } else {
      showTimeExcessWarning = false;
    }
  }

  function checkSkillMismatch() {
    if (!work?.skill_mappings) {
      showSkillMismatchWarning = false;
      return;
    }

    const mismatches: string[] = [];
    
    // Get the selected skill mapping
    const selectedSkillMapping = work.skill_mappings[selectedSkillMappingIndex >= 0 ? selectedSkillMappingIndex : 0];
    if (!selectedSkillMapping) {
      showSkillMismatchWarning = false;
      return;
    }
    
    const individualSkills = getIndividualSkills(selectedSkillMapping);
    
    // Check each individual skill in the combination (using indexed keys)
    individualSkills.forEach((individualSkill: string, index: number) => {
      const workerKey = `${individualSkill}-${index}`;
      const assignedWorker = selectedWorkers[workerKey];
      if (assignedWorker) {
        const workerSkills = assignedWorker.skill_short || '';
        if (!workerSkills.includes(individualSkill)) {
          mismatches.push(`${assignedWorker.emp_name} (${workerSkills}) for ${individualSkill}`);
        }
      }
    });

    if (mismatches.length > 0) {
      showSkillMismatchWarning = true;
      skillMismatchDetails = `Skill mismatches detected:\n${mismatches.join('\n')}`;
    } else {
      showSkillMismatchWarning = false;
    }
  }

  function handleWorkerChange(event: Event, skillName: string) {
    const target = event.target as HTMLSelectElement;
    const workerId = target.value;
    selectedWorkers[skillName] = availableWorkers.find(w => w.emp_id === workerId) || null;
    checkSkillMismatch();
    checkTimeOverlap();
  }

  async function checkWorkerConflicts() {
    try {
      // Convert time range to datetime for comparison
      const fromDateTime = new Date(`${selectedDate}T${fromTime}`);
      const toDateTime = new Date(`${selectedDate}T${toTime}`);
      
      // Get all assigned workers
      const assignedWorkers = Object.values(selectedWorkers).filter(Boolean);
      
      if (assignedWorkers.length === 0) {
        return false; // No workers assigned
      }

      // Check for conflicts for each assigned worker
      const conflictPromises = assignedWorkers.map(async (worker) => {
        const workerId = (worker as any).emp_id;
        
        // Check existing work reports
        const { data: existingReports, error: reportsError } = await supabase
          .from('prdn_work_reporting')
          .select(`
            *,
            prdn_work_planning!inner(
              *,
              std_work_type_details!inner(
                sw_code,
                derived_sw_code,
                std_work_details!inner(
                  sw_name
                )
              )
            )
          `)
          .eq('worker_id', workerId)
          .eq('is_deleted', false);

        if (reportsError) throw reportsError;

        // Check existing work planning
        const { data: existingPlans, error: plansError } = await supabase
          .from('prdn_work_planning')
          .select(`
            *,
            std_work_type_details!inner(
              sw_code,
              derived_sw_code,
              std_work_details!inner(
                sw_name
              )
            )
          `)
          .eq('worker_id', workerId)
          .eq('is_deleted', false);

        if (plansError) throw plansError;

        // Check for time conflicts in reports
        const reportConflicts = existingReports.filter(report => {
          const reportFromDateTime = new Date(`${report.from_date}T${report.from_time}`);
          const reportToDateTime = new Date(`${report.to_date}T${report.to_time}`);
          
          return (fromDateTime < reportToDateTime && toDateTime > reportFromDateTime);
        });

        // Check for time conflicts in planning
        const planConflicts = existingPlans.filter(plan => {
          const planFromDateTime = new Date(`${plan.from_date}T${plan.from_time}`);
          const planToDateTime = new Date(`${plan.to_date}T${plan.to_time}`);
          
          return (fromDateTime < planToDateTime && toDateTime > planFromDateTime);
        });

        return { workerId, worker, reportConflicts, planConflicts };
      });

      const conflictResults = await Promise.all(conflictPromises);
      const workersWithConflicts = conflictResults.filter(result => 
        result.reportConflicts.length > 0 || result.planConflicts.length > 0
      );

      if (workersWithConflicts.length > 0) {
        // Build conflict message
        const conflictDetails = workersWithConflicts.map(({ workerId, worker, reportConflicts, planConflicts }) => {
          const workerName = (worker as any).emp_name || 'Unknown Worker';
          const allConflicts = [...reportConflicts, ...planConflicts];
          
          const workerConflicts = allConflicts.map(conflict => {
            const workName = conflict.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || 
                            conflict.std_work_type_details?.std_work_details?.sw_name || 'Unknown Work';
            const workCode = conflict.prdn_work_planning?.std_work_type_details?.derived_sw_code || 
                           conflict.prdn_work_planning?.std_work_type_details?.sw_code ||
                           conflict.std_work_type_details?.derived_sw_code || 
                           conflict.std_work_type_details?.sw_code || 'Unknown';
            const conflictFromTime = new Date(`${conflict.from_date}T${conflict.from_time}`).toLocaleString('en-GB', { 
              day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
            const conflictToTime = new Date(`${conflict.to_date}T${conflict.to_time}`).toLocaleString('en-GB', { 
              day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
            const status = conflict.completion_status ? 'Reported' : 'Planned';
            
            return `  • ${workName} (${workCode}) [${status}]\n    ${conflictFromTime} - ${conflictToTime}`;
          }).join('\n');
          
          return `${workerName}:\n${workerConflicts}`;
        }).join('\n\n');

        const currentFromTime = fromDateTime.toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        const currentToTime = toDateTime.toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });

        const message = `⚠️ WORKER CONFLICTS DETECTED!\n\nCurrent Planning: ${currentFromTime} - ${currentToTime}\n\nWorkers with conflicts:\n\n${conflictDetails}\n\nDo you want to proceed anyway?`;

        const proceed = confirm(message);
        return !proceed; // Return true if user cancels (has conflicts)
      }

      return false; // No conflicts found
    } catch (error) {
      console.error('Error checking worker conflicts:', error);
      // If there's an error checking conflicts, allow the save to proceed
      return false;
    }
  }

  async function handleSave() {
    // Check for alternative skill combination conflicts
    if (hasAlternativePlanningConflict) {
      alert(alternativeConflictDetails);
      return;
    }

    // Check if all required skills have workers assigned
    const requiredSkills = work?.skill_mappings || [];
    const assignedWorkers = Object.values(selectedWorkers).filter(Boolean);
    
    if (requiredSkills.length > 0 && assignedWorkers.length === 0) {
      alert('Please assign workers for all required skills');
      return;
    }

    if (!fromTime || !toTime) {
      alert('Please fill in all required fields');
      return;
    }

    // Check for worker conflicts
    const hasConflict = await checkWorkerConflicts();
    if (hasConflict) {
      return; // User chose to cancel
    }

    if (showSkillMismatchWarning) {
      const proceed = confirm(`${skillMismatchDetails}\n\nDo you want to proceed anyway?`);
      if (!proceed) return;
    }

    if (showTimeOverlapWarning) {
      const proceed = confirm(`${timeOverlapDetails}\n\nDo you want to proceed anyway?`);
      if (!proceed) return;
    }

    if (showTimeExcessWarning) {
      const proceed = confirm(`${timeExcessDetails}\n\nDo you want to proceed anyway?`);
      if (!proceed) return;
    }

    try {
      // Get current username (throws error if not found)
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();
      
      // Create work planning records for each assigned worker
      const insertPromises = [];
      
      if (requiredSkills.length > 0) {
        // For works with specific skills
        // Get the selected skill mapping
        const selectedSkillMapping = work.skill_mappings[selectedSkillMappingIndex >= 0 ? selectedSkillMappingIndex : 0];
        const individualSkills = getIndividualSkills(selectedSkillMapping);
        
        // Extract wsm_id from the selected skill mapping
        const wsmId = (selectedSkillMapping as any)?.wsm_id || null;
        
        // Create a planning entry for each skill instance (handles duplicates)
        individualSkills.forEach((skillShort, index) => {
          // Try indexed key first (for multiple skills), then fallback to skill name only (for single skill)
          const workerKey = `${skillShort}-${index}`;
          const worker = selectedWorkers[workerKey] || selectedWorkers[skillShort];
          
          if (worker) {
            // Check if this is a non-standard work (added work)
            const isNonStandardWork = work.is_added_work || !work.std_work_type_details?.derived_sw_code;
            
            insertPromises.push(
              createWorkPlanning({
                stage_code: stageCode,
                wo_details_id: work.prdn_wo_details_id || work.wo_details_id || 1,
                derived_sw_code: isNonStandardWork ? null : (work.std_work_type_details?.derived_sw_code || null),
                other_work_code: isNonStandardWork ? work.sw_code : null,
                sc_required: skillShort, // Use skill_short directly (fits VARCHAR(5))
                worker_id: (worker as any).emp_id,
                from_date: selectedDate,
                from_time: fromTime,
                to_date: selectedDate,
                to_time: toTime,
                planned_hours: plannedHours,
                time_worked_till_date: workContinuation.timeWorkedTillDate,
                remaining_time: workContinuation.remainingTime,
                status: 'planned',
                notes: `Planned for ${skillShort} skill`,
                wsm_id: isNonStandardWork ? null : wsmId // wsm_id is null for non-standard works
              }, currentUser)
            );
          }
        });
      } else {
        // For general works without specific skills
        const worker = Object.values(selectedWorkers)[0];
        if (worker) {
          // Check if this is a non-standard work (added work)
          const isNonStandardWork = work.is_added_work || !work.std_work_type_details?.derived_sw_code;
          
          insertPromises.push(
            createWorkPlanning({
              stage_code: stageCode,
              wo_details_id: work.prdn_wo_details_id || 1,
              derived_sw_code: isNonStandardWork ? null : (work.std_work_type_details?.derived_sw_code || null),
              other_work_code: isNonStandardWork ? work.sw_code : null,
              sc_required: 'GEN', // General work
              worker_id: (worker as any).emp_id,
              from_date: selectedDate,
              from_time: fromTime,
              to_date: selectedDate,
              to_time: toTime,
              planned_hours: plannedHours,
              time_worked_till_date: workContinuation.timeWorkedTillDate,
              remaining_time: workContinuation.remainingTime,
              status: 'planned',
              notes: 'General work planning'
            }, currentUser)
          );
        }
      }

      if (insertPromises.length === 0) {
        alert('No workers assigned. Please assign at least one worker.');
        return;
      }

      const results = await Promise.all(insertPromises);
      console.log('Work planning created successfully:', results);
      
      // Update prdn_work_status to 'Planned'
      if (results.length > 0) {
        try {
          const isNonStandardWork = work.is_added_work || !work.std_work_type_details?.derived_sw_code;
          const derivedSwCode = isNonStandardWork ? null : (work.std_work_type_details?.derived_sw_code || null);
          const otherWorkCode = isNonStandardWork ? work.sw_code : null;
          const woDetailsId = work.prdn_wo_details_id || work.wo_details_id;

          if (woDetailsId && (derivedSwCode || otherWorkCode)) {
            const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
            const currentUser = getCurrentUsername();
            const now = getCurrentTimestamp();

            let statusUpdateQuery = supabase
              .from('prdn_work_status')
              .update({
                current_status: 'Planned',
                modified_by: currentUser,
                modified_dt: now
              })
              .eq('stage_code', stageCode)
              .eq('wo_details_id', woDetailsId);

            if (derivedSwCode) {
              statusUpdateQuery = statusUpdateQuery.eq('derived_sw_code', derivedSwCode);
            } else if (otherWorkCode) {
              statusUpdateQuery = statusUpdateQuery.eq('other_work_code', otherWorkCode);
            }

            const { error: statusError } = await statusUpdateQuery;

            if (statusError) {
              console.error('Error updating work status to Planned:', statusError);
              // Note: Planning was created, but status update failed
              // This is logged but we still continue
            } else {
              console.log(`✅ Updated work status to Planned for work ${derivedSwCode || otherWorkCode}`);
            }
          }
        } catch (error) {
          console.error('Error updating work status:', error);
          // Note: Planning was created, but status update failed
          // This is logged but we still continue
        }
      }
      
      // Dispatch success event
      dispatch('save', {
        success: true,
        createdPlans: results.length,
        message: `Successfully created ${results.length} work plan(s)`
      });
      
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
    selectedWorkers = {};
    fromTime = '';
    toTime = '';
    plannedHours = 0;
    showSkillMismatchWarning = false;
    skillMismatchDetails = '';
    showTimeOverlapWarning = false;
    timeOverlapDetails = '';
    showTimeExcessWarning = false;
    timeExcessDetails = '';
    hasAlternativePlanningConflict = false;
    alternativeConflictDetails = '';
    selectedSkillMappingIndex = -1;
    previousSelectedSkillMappingIndex = -1;
    workContinuation = {
      hasPreviousWork: false,
      timeWorkedTillDate: 0,
      remainingTime: 0,
      previousReports: []
    };
  }

  function formatTime(hours: number): string {
    if (!hours) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }


  function getSkillShort(skillMapping: any): string {
    try {
      // Get skill combination from the mapping
      const skillCombination = skillMapping.std_skill_combinations;
      if (!skillCombination) return skillMapping.sc_name;

      // Handle both array and single object cases
      const combination = Array.isArray(skillCombination) 
        ? skillCombination[0]?.skill_combination 
        : skillCombination?.skill_combination;

      if (!combination) return skillMapping.sc_name;

      // Extract skill_short from the combination
      if (Array.isArray(combination)) {
        // Get all skill names from the combination
        const skillNames = combination
          .map(skill => skill.skill_name)
          .filter(Boolean)
          .join(' + ');
        return skillNames || skillMapping.sc_name;
      }

      return skillMapping.sc_name;
    } catch (error) {
      console.error('Error extracting skill short:', error);
      return skillMapping.sc_name;
    }
  }

  function getIndividualSkills(skillMapping: any): string[] {
    try {
      // Get skill combination from the mapping
      const skillCombination = skillMapping.std_skill_combinations;
      
      // Handle both array and single object cases
      const combination = skillCombination 
        ? (Array.isArray(skillCombination) 
          ? skillCombination[0]?.skill_combination 
          : skillCombination?.skill_combination)
        : null;

      // Extract individual skill names from the combination if available
      if (combination && Array.isArray(combination)) {
        const skillNames = combination
          .map(skill => skill.skill_name)
          .filter(Boolean);
        if (skillNames.length > 0) {
          return skillNames;
        }
      }

      // Fallback: Parse sc_name if it contains " + " (e.g., "S2 + US" -> ["S2", "US"])
      // This is needed for non-standard works where std_skill_combinations might not be fully loaded
      if (skillMapping.sc_name && typeof skillMapping.sc_name === 'string') {
        const scName = skillMapping.sc_name.trim();
        if (scName.includes(' + ')) {
          const individualSkills = scName.split(' + ').map((s: string) => s.trim()).filter(Boolean);
          if (individualSkills.length > 0) {
            return individualSkills;
          }
        }
      }

      // Final fallback: return sc_name as single skill
      return [skillMapping.sc_name || 'Unknown'];
    } catch (error) {
      console.error('Error extracting individual skills:', error);
      // Fallback: try to parse sc_name
      if (skillMapping?.sc_name && typeof skillMapping.sc_name === 'string') {
        const scName = skillMapping.sc_name.trim();
        if (scName.includes(' + ')) {
          const individualSkills = scName.split(' + ').map((s: string) => s.trim()).filter(Boolean);
          if (individualSkills.length > 0) {
            return individualSkills;
          }
        }
        return [scName];
      }
      return [skillMapping?.sc_name || 'Unknown'];
    }
  }

  /**
   * Generate time slots in 15-minute intervals
   * Starting from 3 hours before shift start time, up to shift end time
   */
  function generateTimeSlots(shiftStartTime: string, shiftEndTime: string): Array<{ value: string; display: string }> {
    const slots: Array<{ value: string; display: string }> = [];
    
    try {
      // Parse shift start time
      const [startHour, startMinute] = shiftStartTime.split(':').map(Number);
      const shiftStartDate = new Date(2000, 0, 1, startHour, startMinute);
      
      // Calculate start time (3 hours before shift start)
      const slotStartDate = new Date(shiftStartDate.getTime() - 3 * 60 * 60 * 1000);
      
      // Parse shift end time
      const [endHour, endMinute] = shiftEndTime.split(':').map(Number);
      let shiftEndDate = new Date(2000, 0, 1, endHour, endMinute);
      
      // Handle overnight shifts (if end time is earlier than start time, it's next day)
      if (shiftEndDate < shiftStartDate) {
        shiftEndDate = new Date(shiftEndDate.getTime() + 24 * 60 * 60 * 1000);
      }
      
      // Generate slots in 15-minute intervals
      let currentTime = new Date(slotStartDate);
      while (currentTime <= shiftEndDate) {
        const hours24 = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        
        // Format as HH:MM (24-hour)
        const value = `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Format for display (12-hour with AM/PM)
        const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
        const ampm = hours24 < 12 ? 'AM' : 'PM';
        const display = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        
        slots.push({ value, display });
        
        // Add 15 minutes
        currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
      }
      
      return slots;
    } catch (error) {
      console.error('Error generating time slots:', error);
      return [];
    }
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
          <!-- Work Details -->
          <div class="theme-bg-secondary rounded-lg p-4">
            <h4 class="font-medium theme-text-primary mb-2">Work Details</h4>
            <div class="space-y-1 text-sm">
              <div><span class="theme-text-secondary">Code:</span> <span class="theme-text-primary">{work?.std_work_type_details?.derived_sw_code || work?.sw_code}</span></div>
              <div><span class="theme-text-secondary">Name:</span> <span class="theme-text-primary">{work?.sw_name}{work?.std_work_type_details?.type_description ? ' - ' + work.std_work_type_details.type_description : ''}</span></div>
              <div><span class="theme-text-secondary">Standard Time:</span> <span class="theme-text-primary">{work?.std_vehicle_work_flow?.estimated_duration_minutes ? formatTime(work.std_vehicle_work_flow.estimated_duration_minutes / 60) : 'N/A'}</span></div>
              <div><span class="theme-text-secondary">Time Taken:</span> <span class="theme-text-primary">{formatTime(workContinuation.timeWorkedTillDate)}</span></div>
              <div><span class="theme-text-secondary">Remaining Time:</span> <span class="theme-text-primary">{formatTime(workContinuation.remainingTime)}</span></div>
            </div>
          </div>

          <!-- Required Skills -->
          {#if work?.skill_mappings && work.skill_mappings.length > 0}
            <div>
              <h4 class="font-medium theme-text-primary mb-2">Required Skills</h4>
              <div class="flex flex-wrap gap-2">
                {#each work.skill_mappings as skill}
                  {@const skillAny = skill as any}
                  {@const skillShort = getSkillShort(skillAny)}
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    {skillShort || skillAny.sc_name}
                  </span>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Work Continuation Info -->
          {#if workContinuation.hasPreviousWork}
            <div class="theme-bg-yellow-50 dark:theme-bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
              <h4 class="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Work Continuation</h4>
              <div class="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                <div>Time worked till date: <span class="font-medium">{formatTime(workContinuation.timeWorkedTillDate)}</span></div>
                <div>Remaining time: <span class="font-medium">{formatTime(workContinuation.remainingTime)}</span></div>
              </div>
            </div>
          {/if}

          <!-- Alternative Skill Combination Conflict Warning -->
          {#if hasAlternativePlanningConflict}
            <div class="theme-bg-red-50 dark:theme-bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <div class="flex items-start">
                <AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 class="font-medium text-red-800 dark:text-red-200">Alternative Combination Conflict</h4>
                  <p class="text-sm text-red-700 dark:text-red-300 mt-1 whitespace-pre-line">{alternativeConflictDetails}</p>
                </div>
              </div>
            </div>
          {/if}

          <!-- Worker Selection for Each Skill -->
          {#if work?.skill_mappings && work.skill_mappings.length > 0}
            <div>
              <h4 class="font-medium theme-text-primary mb-3">Assign Workers by Skill</h4>
              
              <!-- If multiple skill mappings, allow selecting only one -->
              {#if work.skill_mappings.length > 1}
                <div class="mb-4">
                  <p class="text-sm theme-text-secondary mb-2">This work has multiple alternative skill combinations. Select ONE to plan:</p>
                  <div class="space-y-2">
                    {#each work.skill_mappings as skill, index}
                      {@const skillAny = skill as any}
                      {@const skillShort = getSkillShort(skillAny)}
                      <label class="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors {selectedSkillMappingIndex === index ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 dark:text-gray-100' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}">
                        <input
                          type="radio"
                          name="skill-mapping"
                          value={index}
                          checked={selectedSkillMappingIndex === index}
                          on:change={() => selectedSkillMappingIndex = index}
                          class="mr-3 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
                        />
                        <div class="flex-1">
                          <div class="font-medium text-gray-900 dark:text-gray-100">{skillShort || skillAny.sc_name}</div>
                        </div>
                      </label>
                    {/each}
                  </div>
                </div>
              {:else}
                <!-- Auto-select first (and only) skill mapping -->
              {/if}
              
              {#if selectedSkillMappingIndex >= 0 || work.skill_mappings.length === 1}
                {#key selectedSkillMappingIndex}
                  {#if work.skill_mappings.length > 1}
                    {#if selectedSkillMappingIndex >= 0}
                      {@const skill = work.skill_mappings[selectedSkillMappingIndex]}
                      {@const skillShort = getSkillShort(skill)}
                      {@const individualSkills = getIndividualSkills(skill)}
                      
                      <div class="space-y-4">
                        {#if individualSkills.length > 1}
                    <!-- Multiple skills in combination - show separate fields for each -->
                    <div class="border-l-4 border-blue-500 pl-4">
                      <h5 class="font-medium theme-text-primary mb-2">{skillShort || skill.sc_name}</h5>
                      <div class="space-y-3">
                        {#each individualSkills as individualSkill, skillIndex}
                          <div>
                            <label for="worker-{skill.sc_name}-{individualSkill}-{skillIndex}" class="block text-sm font-medium theme-text-primary mb-1">
                              {individualSkill} Worker {skillIndex > 0 ? `(${skillIndex + 1})` : ''}
                            </label>
                            <select
                              id="worker-{skill.sc_name}-{individualSkill}-{skillIndex}"
                              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              on:change={(e) => handleWorkerChange(e, `${individualSkill}-${skillIndex}`)}
                            >
                              <option value="">Choose a worker for {individualSkill}...</option>
                              {#each availableWorkers as worker}
                                {@const w = worker as { emp_id: string; emp_name: string; skill_short: string }}
                                <option value={w.emp_id}>
                                  {w.emp_name} ({w.skill_short})
                                </option>
                              {/each}
                            </select>
                            {#if selectedWorkers[`${individualSkill}-${skillIndex}`]}
                              {@const selectedWorker = selectedWorkers[`${individualSkill}-${skillIndex}`]}
                              {#if selectedWorker}
                                <div class="mt-1 text-xs theme-text-secondary">
                                  Selected: {selectedWorker.emp_name} ({selectedWorker.skill_short})
                                </div>
                              {/if}
                            {/if}
                          </div>
                        {/each}
                      </div>
                    </div>
                  {:else}
                    <!-- Single skill - show single field -->
                    <div>
                      <label for="worker-{skill.sc_name}" class="block text-sm font-medium theme-text-primary mb-2">
                        {skillShort || skill.sc_name} Worker
                      </label>
                      <select
                        id="worker-{skill.sc_name}"
                        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        on:change={(e) => handleWorkerChange(e, skillShort || skill.sc_name)}
                      >
                        <option value="">Choose a worker for {skillShort || skill.sc_name}...</option>
                        {#each availableWorkers as worker}
                          {@const w = worker as { emp_id: string; emp_name: string; skill_short: string }}
                          <option value={w.emp_id}>
                            {w.emp_name} ({w.skill_short})
                          </option>
                        {/each}
                      </select>
                      {#if selectedWorkers[skillShort || skill.sc_name]}
                        {@const selectedWorker = selectedWorkers[skillShort || skill.sc_name]}
                        {#if selectedWorker}
                          <div class="mt-1 text-xs theme-text-secondary">
                            Selected: {selectedWorker.emp_name} ({selectedWorker.skill_short})
                          </div>
                        {/if}
                      {/if}
                    </div>
                  {/if}
                    </div>
                  {/if}
                  {:else}
                    <!-- Case when there's only 1 skill mapping -->
                    {@const skill = work.skill_mappings[0]}
                    {@const skillShort = getSkillShort(skill)}
                    {@const individualSkills = getIndividualSkills(skill)}
                    
                    <div class="space-y-4">
                      {#if individualSkills.length > 1}
                        <div class="border-l-4 border-blue-500 pl-4">
                          <h5 class="font-medium theme-text-primary mb-2">{skillShort || skill.sc_name}</h5>
                          <div class="space-y-3">
                            {#each individualSkills as individualSkill, skillIndex}
                              <div>
                                <label for="worker-single-{individualSkill}-{skillIndex}" class="block text-sm font-medium theme-text-primary mb-1">
                                  {individualSkill} Worker {skillIndex > 0 ? `(${skillIndex + 1})` : ''}
                                </label>
                                <select
                                  id="worker-single-{individualSkill}-{skillIndex}"
                                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  on:change={(e) => handleWorkerChange(e, `${individualSkill}-${skillIndex}`)}
                                >
                                  <option value="">Choose a worker for {individualSkill}...</option>
                                  {#each availableWorkers as worker}
                                    {@const w = worker as { emp_id: string; emp_name: string; skill_short: string }}
                                    <option value={w.emp_id}>
                                      {w.emp_name} ({w.skill_short})
                                    </option>
                                  {/each}
                                </select>
                                {#if selectedWorkers[`${individualSkill}-${skillIndex}`]}
                                  {@const selectedWorker = selectedWorkers[`${individualSkill}-${skillIndex}`]}
                                  {#if selectedWorker}
                                    <div class="mt-1 text-xs theme-text-secondary">
                                      Selected: {selectedWorker.emp_name} ({selectedWorker.skill_short})
                                    </div>
                                  {/if}
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {:else}
                        <div>
                          <label for="worker-single-skill" class="block text-sm font-medium theme-text-primary mb-2">
                            {skillShort || skill.sc_name} Worker
                          </label>
                          <select
                            id="worker-single-skill"
                            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            on:change={(e) => handleWorkerChange(e, skillShort || skill.sc_name)}
                          >
                            <option value="">Choose a worker for {skillShort || skill.sc_name}...</option>
                            {#each availableWorkers as worker}
                              {@const w = worker as { emp_id: string; emp_name: string; skill_short: string }}
                              <option value={w.emp_id}>
                                {w.emp_name} ({w.skill_short})
                              </option>
                            {/each}
                          </select>
                          {#if selectedWorkers[skillShort || skill.sc_name]}
                            {@const selectedWorker = selectedWorkers[skillShort || skill.sc_name]}
                            {#if selectedWorker}
                              <div class="mt-1 text-xs theme-text-secondary">
                                Selected: {selectedWorker.emp_name} ({selectedWorker.skill_short})
                              </div>
                            {/if}
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/key}
              {/if}
            </div>
          {:else}
            <!-- Fallback for works without specific skills -->
            <div>
              <label for="worker-select" class="block text-sm font-medium theme-text-primary mb-2">Select Worker</label>
              <select
                id="worker-select"
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                on:change={(e) => handleWorkerChange(e, 'general')}
              >
                <option value="">Choose a worker...</option>
                {#each availableWorkers as worker}
                  {@const w = worker as { emp_id: string; emp_name: string; skill_short: string }}
                  <option value={w.emp_id}>
                    {w.emp_name} ({w.skill_short})
                  </option>
                {/each}
              </select>
            </div>
          {/if}

          <!-- Skill Mismatch Warning -->
          {#if showSkillMismatchWarning}
            <div class="theme-bg-red-50 dark:theme-bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <div class="flex items-start">
                <AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 class="font-medium text-red-800 dark:text-red-200">Skill Mismatch Warning</h4>
                  <p class="text-sm text-red-700 dark:text-red-300 mt-1">{skillMismatchDetails}</p>
                </div>
              </div>
            </div>
          {/if}

          <!-- Time Overlap Warning -->
          {#if showTimeOverlapWarning}
            <div class="theme-bg-orange-50 dark:theme-bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <div class="flex items-start">
                <AlertTriangle class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 class="font-medium text-orange-800 dark:text-orange-200">Time Overlap Warning</h4>
                  <p class="text-sm text-orange-700 dark:text-orange-300 mt-1">{timeOverlapDetails}</p>
                </div>
              </div>
            </div>
          {/if}

          <!-- Time Excess Warning -->
          {#if showTimeExcessWarning}
            <div class="theme-bg-yellow-50 dark:theme-bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
              <div class="flex items-start">
                <AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h4 class="font-medium text-yellow-800 dark:text-yellow-200">Time Excess Warning</h4>
                  <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1 whitespace-pre-line">{timeExcessDetails}</p>
                </div>
              </div>
            </div>
          {/if}

          <!-- Time Planning -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="font-medium theme-text-primary">Time Planning</h4>
              {#if work?.std_vehicle_work_flow?.estimated_duration_minutes}
                <button
                  type="button"
                  class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  on:click={autoCalculateEndTime}
                >
                  Auto Calculate End Time
                </button>
              {/if}
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="from-time-select" class="block text-sm font-medium theme-text-primary mb-2">
                  From Time
                </label>
                <select
                  id="from-time-select"
                  bind:value={fromTime}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select time...</option>
                  {#if shiftInfo?.hr_shift_master?.start_time && shiftInfo?.hr_shift_master?.end_time}
                    {@const timeSlots = generateTimeSlots(shiftInfo.hr_shift_master.start_time, shiftInfo.hr_shift_master.end_time)}
                    {#each timeSlots as slot}
                      <option value={slot.value}>{slot.display}</option>
                    {/each}
                  {:else}
                    <option value="" disabled>Shift information not available</option>
                  {/if}
                </select>
              </div>
              <div>
                <TimePicker
                  label="To Time"
                  bind:value={toTime}
                />
              </div>
            </div>
            
            <!-- Shift Information Display -->
            {#if shiftInfo?.hr_shift_master}
              <div class="theme-bg-blue-50 dark:theme-bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <div class="text-sm text-blue-800 dark:text-blue-200">
                  <div class="font-medium mb-1">Shift Information:</div>
                  <div>Shift: {shiftInfo.hr_shift_master.shift_name} ({shiftInfo.hr_shift_master.start_time} - {shiftInfo.hr_shift_master.end_time})</div>
                </div>
              </div>
            {/if}
            
            <!-- Auto-calculation Info -->
            {#if work?.std_vehicle_work_flow?.estimated_duration_minutes}
              {@const breakTimeForPeriod = fromTime ? calculateBreakTimeForWorkPeriod(fromTime, work.std_vehicle_work_flow.estimated_duration_minutes) : 0}
              <div class="theme-bg-green-50 dark:theme-bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                <div class="text-sm text-green-800 dark:text-green-200">
                  <div class="font-medium mb-1">💡 Auto-calculation:</div>
                  <div>End time will be automatically calculated based on:</div>
                  <div>• Work duration: {work.std_vehicle_work_flow.estimated_duration_minutes} minutes</div>
                  <div>• Break time (if spanned): {breakTimeForPeriod} minutes</div>
                  <div>• Shift end time constraint</div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Planned Hours Display -->
          {#if plannedHours > 0}
            <div class="theme-bg-blue-50 dark:theme-bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div class="flex items-center">
                <Clock class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                <span class="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Planned Hours: {formatTime(plannedHours)}
                </span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t theme-border flex justify-end space-x-3">
          <Button variant="secondary" on:click={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" on:click={handleSave} disabled={Object.values(selectedWorkers).filter(Boolean).length === 0 || !fromTime || !toTime}>
            Save Plan
          </Button>
        </div>
    </div>
  </div>
{/if}
