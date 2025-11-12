<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Clock, User, AlertTriangle, Calculator } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { fetchActiveLostTimeReasons, getDefaultPayableStatus } from '$lib/api/lostTimeReasons';
  import { getDetailedTimeBreakdownForDerivativeWork } from '$lib/api/stdSkillTimeStandards';
  import LostTimeBreakdown from './LostTimeBreakdown.svelte';
  import type { LostTimeReason } from '$lib/api/lostTimeReasons';

  export let isOpen: boolean = false;
  export let selectedWorks: any[] = []; // Array of selected skill competencies

  const dispatch = createEventDispatcher();

  // Modal state
  let isLoading = false;
  let availableWorkers: any[] = [];
  let lostTimeReasons: LostTimeReason[] = [];
  let currentStage: 1 | 2 = 1;
  
  // Form data - shared for all skills
  let fromDate = '';
  let fromTime = '';
  let toDate = '';
  let toTime = '';
  let completionStatus: 'C' | 'NC' = 'C';
  
  // Employee assignments for each skill
  let skillEmployees: { [skillId: string]: string } = {};
  
  // Lost time fields
  let ltMinutes = 0;
  let ltReasonId = '';
  let ltComments = '';
  
  // Detailed breakdown
  let breakdownData: {
    totalMinutes: number;
    totalCost: number;
    breakdownItems: Array<{
      reasonId: number;
      minutes: number;
      cost: number;
    }>;
  } = {
    totalMinutes: 0,
    totalCost: 0,
    breakdownItems: []
  };
  
  // Employee salaries (for multi-skill, we'll use average or first employee's salary)
  let averageEmployeeSalary: number = 0;
  
  // Calculated fields
  let standardTimeMinutes = 0;
  let actualTimeMinutes = 0;
  let showLostTimeSection = false;
  
  // Shift and break time info
  let shiftInfo: any = null;

  // Watch for selectedWorks changes
  $: if (selectedWorks.length > 0) {
    console.log('MultiSkillReportModal: Selected works changed:', selectedWorks);
    initializeForm();
    loadStandardTime();
    loadLostTimeReasons();
    loadWorkers();
  }

  // Watch for date changes to reload workers and shift info
  $: if (fromDate) {
    loadWorkers();
    loadShiftInfo();
  }

  // Reactive calculations - only recalculate when specific inputs change
  // Use explicit dependencies to prevent infinite loops
  // Note: shiftInfo is included in the dependency so it recalculates when shift info loads
  $: actualTimeMinutes = (() => {
    if (!fromTime || !toTime || !fromDate || !toDate) {
      return 0;
    }
    try {
      const fromDateTime = new Date(`${fromDate}T${fromTime}`);
      const toDateTime = new Date(`${toDate}T${toTime}`);
      
      if (toDateTime <= fromDateTime) {
        return 0;
      }

      // Calculate raw time difference
      const diffMs = toDateTime.getTime() - fromDateTime.getTime();
      let totalMinutes = Math.round(diffMs / (1000 * 60));
      
      // Subtract break time if shift info is available
      // Access shiftInfo to make it a dependency
      const breaks = shiftInfo?.breakTimes;
      if (breaks && Array.isArray(breaks) && breaks.length > 0) {
        const breakMinutes = calculateBreakTimeInPeriod(fromTime, toTime, breaks);
        totalMinutes = Math.max(0, totalMinutes - breakMinutes);
        console.log(`⏱️ Actual time calculation: Raw=${Math.round(diffMs / (1000 * 60))}min, Break=${breakMinutes}min, Net=${totalMinutes}min`);
      }
      
      return totalMinutes;
    } catch (error) {
      console.error('Error calculating actual time:', error);
      return 0;
    }
  })();
  
  // Helper function to calculate break time in a work period
  function calculateBreakTimeInPeriod(startTimeStr: string, endTimeStr: string, breakTimes: any[]): number {
    if (!startTimeStr || !endTimeStr || !breakTimes || breakTimes.length === 0) {
      return 0;
    }
    
    try {
      const workStart = new Date(`2000-01-01T${startTimeStr}`);
      let workEnd = new Date(`2000-01-01T${endTimeStr}`);
      
      if (workEnd < workStart) {
        workEnd.setDate(workEnd.getDate() + 1);
      }
      
      let totalBreakMinutes = 0;
      
      breakTimes.forEach((breakTime: any) => {
        const breakStart = new Date(`2000-01-01T${breakTime.start_time}`);
        let breakEnd = new Date(`2000-01-01T${breakTime.end_time}`);
        
        if (breakEnd < breakStart) {
          breakEnd.setDate(breakEnd.getDate() + 1);
        }
        
        // Calculate overlap between work period and break time
        const overlapStart = new Date(Math.max(workStart.getTime(), breakStart.getTime()));
        const overlapEnd = new Date(Math.min(workEnd.getTime(), breakEnd.getTime()));
        
        if (overlapStart < overlapEnd) {
          const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
          const overlapMinutes = overlapMs / (1000 * 60);
          totalBreakMinutes += overlapMinutes;
          console.log(`✅ Break overlap: ${breakTime.break_name} (${breakTime.start_time}-${breakTime.end_time}) overlaps with work (${startTimeStr}-${endTimeStr}) by ${overlapMinutes} minutes`);
        }
      });
      
      return Math.round(totalBreakMinutes);
    } catch (error) {
      console.error('Error calculating break time in period:', error);
      return 0;
    }
  }
  
  // Calculate lost time reactively - only updates when actualTimeMinutes or standardTimeMinutes changes
  $: ltMinutes = (actualTimeMinutes > standardTimeMinutes) 
    ? Math.max(0, actualTimeMinutes - standardTimeMinutes) 
    : 0;
  
  $: showLostTimeSection = (actualTimeMinutes > standardTimeMinutes);
  
  // Check if lost time is properly allocated (for button enable/disable)
  $: isLostTimeValid = !showLostTimeSection || ltMinutes === 0 || 
    (breakdownData.breakdownItems.length > 0 && 
     breakdownData.breakdownItems.every(item => item.reasonId > 0) &&
     breakdownData.breakdownItems.reduce((sum, item) => sum + item.minutes, 0) === ltMinutes) ||
    (breakdownData.breakdownItems.length === 0 && ltReasonId);

  // Watch for employee assignments to load salary
  // Use a derived value to track changes more explicitly
  let skillEmployeesString = '';
  let previousSkillEmployeesString = '';
  let isLoadingSalary = false;
  
  // Create a stable string representation of skillEmployees
  $: skillEmployeesString = JSON.stringify(Object.entries(skillEmployees).sort(([a], [b]) => a.localeCompare(b)));
  
  // Only load salary when the string representation actually changes
  $: if (skillEmployeesString && skillEmployeesString !== previousSkillEmployeesString && skillEmployeesString !== '{}' && !isLoadingSalary) {
    previousSkillEmployeesString = skillEmployeesString;
    isLoadingSalary = true;
    loadAverageEmployeeSalary().finally(() => {
      isLoadingSalary = false;
    });
  }

  function initializeForm() {
    if (selectedWorks.length === 0) return;
    
    // Use the first work as template for dates/times
    const firstWork = selectedWorks[0];
    fromDate = firstWork.from_date || '';
    fromTime = firstWork.from_time || '';
    toDate = firstWork.to_date || '';
    toTime = firstWork.to_time || '';
    completionStatus = 'C';
    
    // Initialize employee assignments for each skill
    skillEmployees = {};
    selectedWorks.forEach(work => {
      skillEmployees[work.id] = work.worker_id || '';
    });
    
    // Reset lost time fields
    ltMinutes = 0;
    ltReasonId = '';
    ltComments = '';
    
    // Reset to stage 1
    currentStage = 1;
  }

  function proceedToStage2() {
    // Validate stage 1 data
    if (!fromDate || !fromTime || !toDate || !toTime) {
      alert('Please fill in all required time fields');
      return;
    }

    // Check if all skills have workers assigned
    const unassignedSkills = selectedWorks.filter(work => !skillEmployees[work.id]);
    if (unassignedSkills.length > 0) {
      alert('Please assign workers to all selected skills');
      return;
    }

    // Values are already calculated reactively, no need to call functions
    // Move to stage 2
    currentStage = 2;
  }

  function goBackToStage1() {
    currentStage = 1;
  }

  async function loadWorkers() {
    if (selectedWorks.length === 0 || !fromDate) return;
    
    try {
      const { data, error } = await supabase
        .from('hr_emp')
        .select(`
          emp_id,
          emp_name,
          skill_short,
          hr_attendance!inner(
            attendance_status,
            attendance_date
          )
        `)
        .eq('hr_attendance.attendance_status', 'present')
        .eq('hr_attendance.attendance_date', fromDate)
        .eq('is_active', true)
        .eq('is_deleted', false);

      if (error) throw error;
      availableWorkers = data || [];
      console.log('Available workers for multi-skill report:', availableWorkers);
    } catch (error) {
      console.error('Error loading workers:', error);
      availableWorkers = [];
    }
  }

  async function loadStandardTime() {
    if (selectedWorks.length === 0) return;
    
    try {
      // Use the first work to get standard time (all should be same work)
      const firstWork = selectedWorks[0];
      const workCode = firstWork.std_work_type_details?.derived_sw_code || 
                      firstWork.derived_sw_code || 
                      firstWork.std_work_type_details?.sw_code;
      
      if (workCode) {
        const timeBreakdown = await getDetailedTimeBreakdownForDerivativeWork(workCode);
        standardTimeMinutes = timeBreakdown.totalMinutes || 0;
        console.log(`Standard time for work ${workCode}: ${standardTimeMinutes} minutes`);
      }
    } catch (error) {
      console.error('Error loading standard time:', error);
      standardTimeMinutes = 0;
    }
  }

  async function loadLostTimeReasons() {
    try {
      lostTimeReasons = await fetchActiveLostTimeReasons();
    } catch (error) {
      console.error('Error loading lost time reasons:', error);
      lostTimeReasons = [];
    }
  }

  async function loadShiftInfo() {
    if (!fromDate) return;

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
        .eq('schedule_date', fromDate)
        .eq('is_working_day', true)
        .eq('is_active', true)
        .eq('is_deleted', false);

      if (error) {
        console.error('Error loading shift info:', error);
        return;
      }

      // Use the first shift
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
        }
      }
    } catch (error) {
      console.error('Error loading shift info:', error);
    }
  }

  function calculateActualTime() {
    if (!fromTime || !toTime || !fromDate || !toDate) {
      actualTimeMinutes = 0;
      return;
    }

    try {
      const fromDateTime = new Date(`${fromDate}T${fromTime}`);
      const toDateTime = new Date(`${toDate}T${toTime}`);
      
      if (toDateTime <= fromDateTime) {
        actualTimeMinutes = 0;
        return;
      }

      const diffMs = toDateTime.getTime() - fromDateTime.getTime();
      actualTimeMinutes = Math.round(diffMs / (1000 * 60)); // Convert to minutes
    } catch (error) {
      console.error('Error calculating actual time:', error);
      actualTimeMinutes = 0;
    }
  }

  function calculateLostTime() {
    console.log(`🕐 Calculating lost time: actual=${actualTimeMinutes}min, standard=${standardTimeMinutes}min`);
    
    if (actualTimeMinutes > standardTimeMinutes) {
      const lostTimePerWorker = Math.max(0, actualTimeMinutes - standardTimeMinutes);
      ltMinutes = lostTimePerWorker;
      showLostTimeSection = true;
      console.log(`⚠️ Lost time detected: ${ltMinutes} minutes per worker, showing lost time section`);
    } else {
      ltMinutes = 0;
      showLostTimeSection = false;
      console.log(`✅ No lost time detected - actual time is within standard time`);
    }
  }

  function handleReasonChange() {
    // Handle reason change if needed
  }

  function handleBreakdownChange(event: CustomEvent) {
    breakdownData = event.detail;
    console.log('Multi-skill breakdown changed:', breakdownData);
  }

  async function loadAverageEmployeeSalary() {
    if (Object.keys(skillEmployees).length === 0) {
      if (averageEmployeeSalary !== 0) {
        averageEmployeeSalary = 0;
      }
      return;
    }

    try {
      const employeeIds = Object.values(skillEmployees).filter(id => id);
      if (employeeIds.length === 0) {
        if (averageEmployeeSalary !== 0) {
          averageEmployeeSalary = 0;
        }
        return;
      }

      const { data, error } = await supabase
        .from('hr_emp')
        .select('salary')
        .in('emp_id', employeeIds);

      if (error) throw error;
      
      const salaries = data?.map(emp => emp.salary || 0) || [];
      const newAverageSalary = salaries.length > 0 ? salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length : 0;
      
      // Only update if the value actually changed to prevent unnecessary reactivity
      if (Math.abs(newAverageSalary - averageEmployeeSalary) > 0.01) {
        averageEmployeeSalary = newAverageSalary;
        console.log(`Average employee salary loaded: $${averageEmployeeSalary}`);
      }
    } catch (error) {
      console.error('Error loading average employee salary:', error);
      if (averageEmployeeSalary !== 0) {
        averageEmployeeSalary = 0;
      }
    }
  }

  function handleClose() {
    dispatch('close');
  }

  async function checkWorkerConflicts() {
    try {
      // Convert time range to datetime for comparison
      const fromDateTime = new Date(`${fromDate}T${fromTime}`);
      const toDateTime = new Date(`${toDate}T${toTime}`);
      
      // Get all assigned workers
      const assignedWorkers = Object.values(skillEmployees).filter(workerId => workerId);
      
      if (assignedWorkers.length === 0) {
        return false; // No workers assigned
      }

      // Check for conflicts for each assigned worker
      const conflictPromises = assignedWorkers.map(async (workerId) => {
        const { data: existingReports, error } = await supabase
          .from('prdn_work_reporting')
          .select(`
            *,
            prdn_work_planning!inner(
              *,
              std_work_type_details!inner(
                *,
                std_work_details!inner(sw_name)
              )
            )
          `)
          .eq('worker_id', workerId)
          .eq('is_deleted', false);

        if (error) throw error;

        // Check for time conflicts
        const conflicts = existingReports.filter(report => {
          const reportFromDateTime = new Date(`${report.from_date}T${report.from_time}`);
          const reportToDateTime = new Date(`${report.to_date}T${report.to_time}`);
          
          // Check if time ranges overlap
          return (fromDateTime < reportToDateTime && toDateTime > reportFromDateTime);
        });

        return { workerId, conflicts };
      });

      const conflictResults = await Promise.all(conflictPromises);
      const workersWithConflicts = conflictResults.filter(result => result.conflicts.length > 0);

      if (workersWithConflicts.length > 0) {
        // Build conflict message
        const conflictDetails = workersWithConflicts.map(({ workerId, conflicts }) => {
          const workerName = availableWorkers.find(w => w.emp_id === workerId)?.emp_name || 'Unknown Worker';
          const workerConflicts = conflicts.map(conflict => {
            const workName = conflict.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || 'Unknown Work';
            const workCode = conflict.prdn_work_planning?.std_work_type_details?.derived_sw_code || conflict.prdn_work_planning?.std_work_type_details?.sw_code || 'Unknown';
            const conflictFromTime = new Date(`${conflict.from_date}T${conflict.from_time}`).toLocaleString('en-GB', { 
              day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
            const conflictToTime = new Date(`${conflict.to_date}T${conflict.to_time}`).toLocaleString('en-GB', { 
              day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
            
            return `  • ${workName} (${workCode})\n    ${conflictFromTime} - ${conflictToTime}`;
          }).join('\n');
          
          return `${workerName}:\n${workerConflicts}`;
        }).join('\n\n');

        const currentFromTime = fromDateTime.toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        const currentToTime = toDateTime.toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });

        const message = `⚠️ WORKER CONFLICTS DETECTED!\n\nCurrent Assignment: ${currentFromTime} - ${currentToTime}\n\nWorkers with conflicts:\n\n${conflictDetails}\n\nDo you want to proceed anyway?`;

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

  async function updateProductionDatesIfFirstReport(reportDataArray: any[]) {
    try {
      // Group reports by work order and stage
      const reportsByWorkOrder = new Map();
      
      for (const reportData of reportDataArray) {
        // Get the planning record to get stage_code and wo_details_id
        const { data: planningData, error: planningError } = await supabase
          .from('prdn_work_planning')
          .select('stage_code, wo_details_id')
          .eq('id', reportData.planning_id)
          .single();

        if (planningError) {
          console.error('Error fetching planning data:', planningError);
          continue;
        }

        const stageCode = planningData.stage_code;
        const woDetailsId = planningData.wo_details_id;
        const key = `${woDetailsId}_${stageCode}`;

        if (!reportsByWorkOrder.has(key)) {
          reportsByWorkOrder.set(key, {
            woDetailsId,
            stageCode,
            reports: []
          });
        }
        
        reportsByWorkOrder.get(key).reports.push(reportData);
      }

      // Check each work order/stage combination
      for (const [key, workOrderData] of reportsByWorkOrder) {
        const { woDetailsId, stageCode, reports } = workOrderData;
        
        // Check if this is the first work report for this work order in this stage
        const { data: existingReports, error: reportsError } = await supabase
          .from('prdn_work_reporting')
          .select('id')
          .eq('is_deleted', false)
          .in('planning_id', 
            await supabase
              .from('prdn_work_planning')
              .select('id')
              .eq('stage_code', stageCode)
              .eq('wo_details_id', woDetailsId)
              .then(({ data }) => data?.map(p => p.id) || [])
          )
          .order('created_dt', { ascending: true })
          .limit(1);

        if (reportsError) {
          console.error('Error checking existing reports:', reportsError);
          continue;
        }

        // If this is the first report (only one record and it's one of our new reports)
        const isFirstReport = existingReports && existingReports.length === 1 && 
          reports.some((r: any) => r.id === existingReports[0].id);

        if (isFirstReport) {
          console.log(`🎯 First work report for WO ${woDetailsId} in stage ${stageCode}, updating prdn_dates`);
          
          // Use the earliest from_date from our reports
          const earliestDate = reports.reduce((earliest: string, report: any) => 
            report.from_date < earliest ? report.from_date : earliest, reports[0].from_date);
          
          // Update the prdn_dates table with the actual start date
          const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
          const currentUser = getCurrentUsername();
          const now = getCurrentTimestamp();
          
          const { error: datesError } = await supabase
            .from('prdn_dates')
            .update({
              actual_date: earliestDate,
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('sales_order_id', woDetailsId)
            .eq('stage_code', stageCode)
            .eq('date_type', 'entry');

          if (datesError) {
            console.error('Error updating prdn_dates:', datesError);
          } else {
            console.log(`✅ Updated prdn_dates with actual start date: ${earliestDate}`);
          }
        } else {
          console.log(`📝 Not the first work report for WO ${woDetailsId} in stage ${stageCode}, skipping prdn_dates update`);
        }
      }
    } catch (error) {
      console.error('Error in updateProductionDatesIfFirstReport:', error);
    }
  }

  async function handleSave() {
    if (isLoading) return;
    
    // Check for worker conflicts
    const hasConflict = await checkWorkerConflicts();
    if (hasConflict) {
      return; // User chose to cancel
    }
    
    // Validate lost time allocation
    if (showLostTimeSection && ltMinutes > 0) {
      const hasBreakdown = breakdownData.breakdownItems.length > 0;
      
      if (hasBreakdown) {
        // Check that all breakdown items have reasons selected
        if (breakdownData.breakdownItems.some(item => !item.reasonId)) {
          alert('Please select reasons for all lost time breakdown items');
          return;
        }
        
        // Check that all lost time minutes are accounted for
        const totalAllocatedMinutes = breakdownData.breakdownItems.reduce((sum, item) => sum + item.minutes, 0);
        
        if (totalAllocatedMinutes !== ltMinutes) {
          alert(`Lost time allocation incomplete!\n\nTotal Lost Time: ${ltMinutes} minutes\nTotal Allocated: ${totalAllocatedMinutes} minutes\nRemaining: ${ltMinutes - totalAllocatedMinutes} minutes\n\nPlease allocate all ${ltMinutes} minutes before saving.`);
          return;
        }
      } else if (!ltReasonId) {
        alert('Please select a reason for lost time');
        return;
      }
    }
    
    isLoading = true;
    
    try {
      // Get current username (throws error if not found)
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();
      
      // Create report records for each selected skill
      // Calculate hours worked today
      const hoursWorkedToday = actualTimeMinutes / 60;
      
      // Prepare lost time details for JSON storage
      const hasBreakdown = breakdownData.breakdownItems.length > 0;
      let ltDetails = null;
      
      if (ltMinutes > 0) {
        if (hasBreakdown) {
          // Use breakdown data
          ltDetails = breakdownData.breakdownItems.map(item => {
            const reason = lostTimeReasons.find(r => r.id === item.reasonId);
            return {
              lt_minutes: item.minutes,
              lt_reason: reason?.lost_time_reason || 'Unknown',
              is_lt_payable: reason?.p_head === 'Payable',
              lt_value: item.cost
            };
          });
        } else {
          // Use simple reason
          const selectedReason = lostTimeReasons.find(r => r.id.toString() === ltReasonId);
          ltDetails = [{
            lt_minutes: ltMinutes,
            lt_reason: selectedReason?.lost_time_reason || 'No reason specified',
            is_lt_payable: selectedReason?.p_head === 'Payable',
            lt_value: selectedReason?.p_head === 'Payable' ? (ltMinutes / 60) * 50 : 0
          }];
        }
      }
      
      const reportData = selectedWorks.map(work => ({
        planning_id: work.id,
        worker_id: skillEmployees[work.id],
        from_date: fromDate,
        from_time: fromTime,
        to_date: toDate,
        to_time: toTime,
        hours_worked_till_date: work.time_worked_till_date || 0,
        hours_worked_today: hoursWorkedToday,
        completion_status: completionStatus,
        lt_minutes_total: ltMinutes,
        lt_details: ltDetails,
        lt_comments: ltComments,
        created_by: currentUser,
        created_dt: now,
        // modified_by and modified_dt should equal created_by and created_dt on insert
        modified_by: currentUser,
        modified_dt: now
      }));

      // Insert all report records
      const { data: insertedReports, error } = await supabase
        .from('prdn_work_reporting')
        .insert(reportData)
        .select();

      if (error) throw error;

      // Breakdown details are now stored in lt_details JSON field

      // Update prdn_dates table if this is the first work report for any stage
      if (insertedReports) {
        await updateProductionDatesIfFirstReport(insertedReports);
      }

      // Update planning records to mark as reported
      const planningIds = selectedWorks.map(work => work.id);
      const { error: updateError } = await supabase
        .from('prdn_work_planning')
        .update({ 
          status: 'reported',
          modified_by: currentUser,
          modified_dt: now
        })
        .in('id', planningIds);

      if (updateError) throw updateError;

      // Update prdn_work_status based on completion status
      // Get planning records to get derived_sw_code/other_work_code
      const { data: planningRecords, error: planningError } = await supabase
        .from('prdn_work_planning')
        .select('derived_sw_code, other_work_code, wo_details_id, stage_code')
        .in('id', planningIds);

      if (!planningError && planningRecords) {
        const newStatus = completionStatus === 'C' ? 'Completed' : 'In Progress';
        
        // Update each work status
        for (const planningRecord of planningRecords) {
          let statusUpdateQuery = supabase
            .from('prdn_work_status')
            .update({
              current_status: newStatus,
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('stage_code', planningRecord.stage_code)
            .eq('wo_details_id', planningRecord.wo_details_id);

          if (planningRecord.derived_sw_code) {
            statusUpdateQuery = statusUpdateQuery.eq('derived_sw_code', planningRecord.derived_sw_code);
          } else if (planningRecord.other_work_code) {
            statusUpdateQuery = statusUpdateQuery.eq('other_work_code', planningRecord.other_work_code);
          } else {
            console.warn('⚠️ Cannot update work status: no derived_sw_code or other_work_code found');
            continue;
          }

          const { error: statusError } = await statusUpdateQuery;

          if (statusError) {
            console.error('Error updating work status:', statusError);
            // Note: Report was created, but status update failed
            // This is logged but we still continue
          } else {
            console.log(`✅ Updated work status to ${newStatus} for work ${planningRecord.derived_sw_code || planningRecord.other_work_code}`);
          }
        }
      }

      dispatch('save', {
        success: true,
        message: `Successfully reported ${selectedWorks.length} skill competencies`,
        reportData
      });

      handleClose();
    } catch (error) {
      console.error('Error saving multi-skill report:', error);
      alert('Error saving report. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  function formatTime(hours: number): string {
    if (!hours) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }

  function formatMinutes(minutes: number): string {
    if (!minutes) return '0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
    <div class="theme-bg-primary rounded-lg shadow-xl border-2 theme-border max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="px-6 py-4 border-b theme-border">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-medium theme-text-primary">Report Multiple Skills</h3>
              <div class="flex items-center space-x-4 mt-2">
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {currentStage >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">1</div>
                  <span class="text-sm theme-text-secondary">Employees & Time</span>
                </div>
                <div class="w-8 h-px bg-gray-300 dark:bg-gray-600"></div>
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {currentStage >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">2</div>
                  <span class="text-sm theme-text-secondary">Lost Time & Save</span>
                </div>
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

        <!-- Content -->
        <div class="px-6 py-4 space-y-6">
          <!-- Work Details (Always visible) -->
          <div class="theme-bg-secondary rounded-lg p-4">
            <h4 class="font-medium theme-text-primary mb-2">Work Details</h4>
            <div class="space-y-1 text-sm">
              <div><span class="theme-text-secondary">Work Code:</span> <span class="theme-text-primary">{selectedWorks[0]?.std_work_type_details?.derived_sw_code || selectedWorks[0]?.derived_sw_code || selectedWorks[0]?.std_work_type_details?.sw_code}</span></div>
              <div><span class="theme-text-secondary">Work Name:</span> <span class="theme-text-primary">{selectedWorks[0]?.std_work_type_details?.type_description || 'N/A'}</span></div>
              <div><span class="theme-text-secondary">Selected Skills:</span> <span class="theme-text-primary">{selectedWorks.map(w => w.sc_required || 'N/A').filter((v, i, a) => a.indexOf(v) === i).join(' + ')}</span></div>
              <div><span class="theme-text-secondary">Standard Time:</span> <span class="theme-text-primary">{formatMinutes(standardTimeMinutes)}</span></div>
            </div>
          </div>

          <!-- Stage 1: Employee Assignment & Time Selection -->
          {#if currentStage === 1}
            <!-- Employee Assignment for Each Skill -->
            <div>
              <h4 class="font-medium theme-text-primary mb-3">Assign Workers to Skills</h4>
              <div class="space-y-3">
                {#each selectedWorks as work}
                  <div class="flex items-center space-x-4 p-3 border theme-border rounded-lg theme-bg-primary">
                    <div class="flex-1">
                      <div class="text-sm font-medium theme-text-primary">{work.sc_required || 'N/A'}</div>
                      <div class="text-xs theme-text-secondary">Skill Competency</div>
                    </div>
                    <div class="flex-1">
                      <select
                        bind:value={skillEmployees[work.id]}
                        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Choose a worker...</option>
                        {#each availableWorkers as worker}
                          <option value={worker.emp_id}>
                            {worker.emp_name} ({worker.skill_short})
                          </option>
                        {/each}
                      </select>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Shared Date and Time -->
            <div>
              <h4 class="font-medium theme-text-primary mb-3">Shared Time Range</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="from-date" class="block text-sm font-medium theme-text-primary mb-2">From Date</label>
                  <input
                    id="from-date"
                    type="date"
                    bind:value={fromDate}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="from-time" class="block text-sm font-medium theme-text-primary mb-2">From Time</label>
                  <input
                    id="from-time"
                    type="time"
                    bind:value={fromTime}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="to-date" class="block text-sm font-medium theme-text-primary mb-2">To Date</label>
                  <input
                    id="to-date"
                    type="date"
                    bind:value={toDate}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="to-time" class="block text-sm font-medium theme-text-primary mb-2">To Time</label>
                  <input
                    id="to-time"
                    type="time"
                    bind:value={toTime}
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <!-- Work Status -->
            <div>
              <div class="block text-sm font-medium theme-text-primary mb-2">Work Status</div>
              <div class="flex space-x-4">
                <label for="status-completed" class="flex items-center">
                  <input
                    id="status-completed"
                    type="radio"
                    bind:group={completionStatus}
                    value="C"
                    class="mr-2"
                  />
                  <span class="theme-text-primary">Completed (C)</span>
                </label>
                <label for="status-not-completed" class="flex items-center">
                  <input
                    id="status-not-completed"
                    type="radio"
                    bind:group={completionStatus}
                    value="NC"
                    class="mr-2"
                  />
                  <span class="theme-text-primary">Not Completed (NC)</span>
                </label>
              </div>
            </div>
          {/if}

          <!-- Stage 2: Lost Time & Save -->
          {#if currentStage === 2}
            <!-- Time Summary -->
            <div class="theme-bg-secondary rounded-lg p-4 border-2 border-blue-300 dark:border-blue-600">
              <h4 class="font-medium theme-text-primary mb-3">Time Summary</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="theme-text-secondary">Standard Time:</span>
                  <span class="theme-text-primary font-medium ml-2">{formatMinutes(standardTimeMinutes)}</span>
                </div>
                <div>
                  <span class="theme-text-secondary">Actual Time:</span>
                  <span class="theme-text-primary font-medium ml-2">{formatMinutes(actualTimeMinutes)}</span>
                </div>
                <div>
                  <span class="theme-text-secondary">Lost Time:</span>
                  <span class="theme-text-primary font-medium ml-2">{formatMinutes(ltMinutes)} per worker</span>
                </div>
                <div>
                  <span class="theme-text-secondary">Status:</span>
                  <span class="theme-text-primary font-medium ml-2">{completionStatus === 'C' ? 'Completed' : 'Not Completed'}</span>
                </div>
              </div>
            </div>

            <!-- Lost Time Section -->
            {#if showLostTimeSection}
              <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                <div class="flex items-start">
                  <AlertTriangle class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div class="flex-1">
                    <h4 class="font-medium text-orange-800 dark:text-orange-200 mb-3">Lost Time Detected</h4>
                    
                    <div class="space-y-4">
                      <div>
                        <div class="block text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">Total Lost Time</div>
                        <div class="text-sm text-orange-700 dark:text-orange-300">
                          {formatMinutes(ltMinutes)} (Auto-calculated)
                        </div>
                      </div>
                      
                      <!-- Detailed Breakdown Component -->
                      <LostTimeBreakdown 
                        {lostTimeReasons}
                        totalLostTimeMinutes={ltMinutes}
                        employeeSalary={averageEmployeeSalary}
                        on:totalsChanged={handleBreakdownChange}
                      />
                      
                      <div>
                        <label for="lt-comments" class="block text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">Comments</label>
                        <textarea
                          id="lt-comments"
                          bind:value={ltComments}
                          rows="2"
                          class="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Additional comments about the lost time..."
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          {/if}
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t theme-border flex justify-end space-x-3">
          <Button variant="secondary" on:click={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          {#if currentStage === 1}
            <Button variant="primary" on:click={proceedToStage2} disabled={isLoading || !fromDate || !fromTime || !toDate || !toTime}>
              Next: Calculate Lost Time
            </Button>
          {:else if currentStage === 2}
            <Button variant="secondary" on:click={goBackToStage1} disabled={isLoading}>
              Back
            </Button>
            <Button variant="primary" on:click={handleSave} disabled={isLoading || (showLostTimeSection && ltMinutes > 0 && !isLostTimeValid)}>
              {isLoading ? 'Saving...' : `Save Report (${selectedWorks.length} skills)`}
            </Button>
          {/if}
        </div>
    </div>
  </div>
{/if}
