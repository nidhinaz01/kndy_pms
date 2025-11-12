<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Clock, User, AlertTriangle, Calculator, Plus, Trash2 } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { fetchActiveLostTimeReasons, getDefaultPayableStatus } from '$lib/api/lostTimeReasons';
  import { getDetailedTimeBreakdownForDerivativeWork } from '$lib/api/stdSkillTimeStandards';
  import LostTimeBreakdown from './LostTimeBreakdown.svelte';
  import type { LostTimeReason } from '$lib/api/lostTimeReasons';

  export let isOpen: boolean = false;
  export let plannedWork: any = null;

  const dispatch = createEventDispatcher();

  // Modal state
  let isLoading = false;
  let availableWorkers: any[] = [];
  let lostTimeReasons: LostTimeReason[] = [];
  let currentStage: 1 | 2 | 3 = 1;
  let selectedEmployeeSalary: number = 0;
  
  // Form data
  let selectedWorkerId = '';
  let fromDate = '';
  let fromTime = '';
  let toDate = '';
  let toTime = '';
  let completionStatus: 'C' | 'NC' = 'C';
  let hoursWorkedToday = 0;
  let hoursWorkedTillDate = 0;
  
  // Lost time fields
  let ltMinutes = 0;
  let ltReasonId = '';
  let isLtPayable = false;
  let ltCost = 0;
  let ltComments = '';
  
  // Multi-step lost time data
  let lostTimeChunks: Array<{
    id: string;
    minutes: number;
    reasonId: number;
    reasonName: string;
    isPayable: boolean;
    cost: number;
  }> = [];
  
  // Stage 2: Lost time splitting
  let totalLostTimeMinutes = 0;
  let remainingMinutesToSplit = 0;
  
  // Reactive calculation of remaining minutes
  $: {
    const allocatedMinutes = lostTimeChunks.reduce((sum, chunk) => sum + chunk.minutes, 0);
    remainingMinutesToSplit = totalLostTimeMinutes - allocatedMinutes;
    console.log('Reactive calculation:', { totalLostTimeMinutes, allocatedMinutes, remainingMinutesToSplit, chunks: lostTimeChunks });
  }
  
  // Stage 3+: Reason assignment
  let currentChunkIndex = 0;
  
  // Calculated fields
  let standardTimeMinutes = 0;
  let actualTimeMinutes = 0;
  let showLostTimeSection = false;

  // Watch for plannedWork changes
  $: if (plannedWork) {
    console.log('ReportWorkModal: Planned work changed:', plannedWork);
    initializeForm();
    loadStandardTime();
    loadLostTimeReasons();
  }

  // Watch for date changes to reload workers
  $: if (plannedWork && fromDate) {
    loadWorkers();
  }

  // Watch for worker selection to load salary
  $: if (selectedWorkerId) {
    loadEmployeeSalary();
  }

  // Watch for time changes to calculate lost time
  $: {
    calculateActualTime();
    calculateLostTime();
  }

  function initializeForm() {
    if (!plannedWork) return;
    
    selectedWorkerId = plannedWork.worker_id || '';
    fromDate = plannedWork.from_date || '';
    fromTime = plannedWork.from_time || '';
    toDate = plannedWork.to_date || '';
    toTime = plannedWork.to_time || '';
    hoursWorkedTillDate = plannedWork.time_worked_till_date || 0;
    
    // Set default values
    completionStatus = 'C';
    hoursWorkedToday = 0;
    ltMinutes = 0;
    ltReasonId = '';
    isLtPayable = false;
    ltCost = 0;
    ltComments = '';
    
    // Reset to stage 1
    currentStage = 1;
  }

  function proceedToStage2() {
    // Validate stage 1 data
    if (!selectedWorkerId || !fromDate || !fromTime || !toDate || !toTime) {
      alert('Please fill in all required fields in Stage 1');
      return;
    }

    // Calculate actual time and lost time
    calculateActualTime();
    calculateLostTime();
    
    if (showLostTimeSection && ltMinutes > 0) {
      // Initialize lost time chunks for splitting
      totalLostTimeMinutes = ltMinutes;
      lostTimeChunks = [];
      currentStage = 2;
    } else {
      // No lost time, go directly to save
      handleSave();
    }
  }

  function goBackToStage1() {
    currentStage = 1;
  }

  function proceedToStage3() {
    console.log('proceedToStage3 called');
    console.log('Current state:', { remainingMinutesToSplit, lostTimeChunks: lostTimeChunks.length, currentStage });
    
    if (remainingMinutesToSplit > 0) {
      alert('Please allocate all lost time minutes before proceeding');
      return;
    }
    
    if (lostTimeChunks.length === 0) {
      alert('Please add at least one lost time chunk');
      return;
    }
    
    console.log('Proceeding to stage 3...');
    currentChunkIndex = 0;
    currentStage = 3;
    console.log('Stage changed to:', currentStage);
  }

  function goBackToStage2() {
    currentStage = 2;
  }

  function proceedToNextChunk() {
    console.log('proceedToNextChunk called');
    console.log('Current state:', { currentChunkIndex, totalChunks: lostTimeChunks.length, currentChunk: lostTimeChunks[currentChunkIndex] });
    
    if (currentChunkIndex < lostTimeChunks.length - 1) {
      console.log('Moving to next chunk...');
      currentChunkIndex++;
      console.log('New chunk index:', currentChunkIndex);
    } else {
      console.log('All chunks assigned, proceeding to save...');
      // All chunks assigned, proceed to save
      handleSave();
    }
  }

  function goBackToPreviousChunk() {
    if (currentChunkIndex > 0) {
      currentChunkIndex--;
    } else {
      // Go back to stage 2
      currentStage = 2;
    }
  }

  // Stage 2: Lost time chunk management
  function addLostTimeChunk() {
    if (remainingMinutesToSplit <= 0) {
      alert('No remaining minutes to allocate');
      return;
    }
    
    const newChunk = {
      id: `chunk_${Date.now()}`,
      minutes: 0,
      reasonId: 0,
      reasonName: '',
      isPayable: false,
      cost: 0
    };
    
    lostTimeChunks = [...lostTimeChunks, newChunk];
  }

  function removeLostTimeChunk(chunkId: string) {
    lostTimeChunks = lostTimeChunks.filter(c => c.id !== chunkId);
  }

  function updateChunkMinutes(chunkId: string, minutes: number) {
    console.log('updateChunkMinutes called:', { chunkId, minutes, totalLostTimeMinutes });
    const chunkIndex = lostTimeChunks.findIndex(c => c.id === chunkId);
    if (chunkIndex !== -1) {
      // Update the chunk
      lostTimeChunks[chunkIndex] = {
        ...lostTimeChunks[chunkIndex],
        minutes: minutes
      };
      
      // Recalculate cost if reason is already assigned
      if (lostTimeChunks[chunkIndex].reasonId > 0) {
        calculateChunkCost(chunkIndex);
      }
      
      // Force reactivity
      lostTimeChunks = [...lostTimeChunks];
      console.log('Updated chunks:', lostTimeChunks);
      console.log('Remaining minutes after update:', remainingMinutesToSplit);
    }
  }

  function calculateChunkCost(chunkIndex: number) {
    if (chunkIndex >= 0 && chunkIndex < lostTimeChunks.length) {
      const chunk = lostTimeChunks[chunkIndex];
      let cost = 0;
      
      if (chunk.isPayable && chunk.minutes > 0) {
        const currentDate = new Date();
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const salaryPerMinute = selectedEmployeeSalary / daysInMonth / 480;
        cost = chunk.minutes * salaryPerMinute;
      }
      
      // Update the chunk with new cost
      lostTimeChunks[chunkIndex] = {
        ...chunk,
        cost: cost
      };
      
      // Force reactivity
      lostTimeChunks = [...lostTimeChunks];
    }
  }

  // Stage 3+: Reason assignment
  function assignReasonToChunk(reasonId: number) {
    if (currentChunkIndex >= 0 && currentChunkIndex < lostTimeChunks.length) {
      // Check if this reason is already used by another chunk
      const isAlreadyUsed = lostTimeChunks.some((chunk, index) => 
        chunk.reasonId === reasonId && index !== currentChunkIndex
      );
      
      if (isAlreadyUsed) {
        const reason = lostTimeReasons.find(r => r.id === reasonId);
        alert(`Duplicate reason detected!\n\n"${reason?.lost_time_reason}" is already used in another chunk.\n\nPlease select a different reason.`);
        return;
      }
      
      const reason = lostTimeReasons.find(r => r.id === reasonId);
      if (reason) {
        // Update the chunk with new reason data
        lostTimeChunks[currentChunkIndex] = {
          ...lostTimeChunks[currentChunkIndex],
          reasonId: reasonId,
          reasonName: reason.lost_time_reason,
          isPayable: reason.p_head === 'Payable'
        };
        
        // Calculate cost for the updated chunk
        calculateChunkCost(currentChunkIndex);
        
        // Force reactivity
        lostTimeChunks = [...lostTimeChunks];
      }
    }
  }

  async function loadWorkers() {
    if (!plannedWork?.stage_code || !fromDate) return;
    
    try {
      // Get workers who are present on the selected date
      const { data, error } = await supabase
        .from('hr_emp')
        .select(`
          emp_id,
          emp_name,
          skill_short,
          stage,
          hr_attendance!inner(
            attendance_status
          )
        `)
        .eq('stage', plannedWork.stage_code)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .eq('hr_attendance.attendance_date', fromDate)
        .eq('hr_attendance.attendance_status', 'present')
        .eq('hr_attendance.is_deleted', false);

      if (error) {
        console.error('Error loading present workers:', error);
        return;
      }

      availableWorkers = data || [];
      console.log(`👥 Loaded ${availableWorkers.length} present workers for stage ${plannedWork.stage_code} on ${fromDate}`);
    } catch (error) {
      console.error('Error loading present workers:', error);
    }
  }

  async function loadStandardTime() {
    console.log('🔍 Loading standard time for planned work:', plannedWork);
    
    // Get the derived work code from planned work
    const derivedWorkCode = plannedWork?.derived_sw_code || 
                           plannedWork?.std_work_type_details?.derived_sw_code ||
                           plannedWork?.std_work_type_details?.sw_code;
    
    if (!derivedWorkCode) {
      console.log('❌ No derived work code found in planned work');
      return;
    }
    
    console.log(`🔍 Looking for standard time with derived work code: ${derivedWorkCode}`);
    
    try {
      // Use the correct function to get detailed time breakdown for derived work
      const timeBreakdown = await getDetailedTimeBreakdownForDerivativeWork(derivedWorkCode);
      
      standardTimeMinutes = timeBreakdown.totalMinutes;
      console.log(`⏱️ Standard time for ${derivedWorkCode}: ${standardTimeMinutes} minutes`);
      console.log('📊 Time breakdown:', timeBreakdown);
      
    } catch (error) {
      console.error('Error loading standard time:', error);
      standardTimeMinutes = 0;
    }
  }

  async function loadLostTimeReasons() {
    try {
      lostTimeReasons = await fetchActiveLostTimeReasons();
      console.log(`📋 Loaded ${lostTimeReasons.length} lost time reasons`);
      console.log('Lost time reasons:', lostTimeReasons);
    } catch (error) {
      console.error('Error loading lost time reasons:', error);
      // Fallback to hardcoded reasons if database fails
      lostTimeReasons = [
        { id: 1, p_head: 'Payable', lost_time_reason: 'Equipment Breakdown' } as LostTimeReason,
        { id: 2, p_head: 'Non-Payable', lost_time_reason: 'Material Shortage' } as LostTimeReason,
        { id: 3, p_head: 'Payable', lost_time_reason: 'Quality Issue' } as LostTimeReason,
        { id: 4, p_head: 'Non-Payable', lost_time_reason: 'Other' } as LostTimeReason
      ];
    }
  }

  async function loadEmployeeSalary() {
    if (!selectedWorkerId) {
      selectedEmployeeSalary = 0;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('hr_emp')
        .select('salary')
        .eq('emp_id', selectedWorkerId)
        .single();

      if (error) throw error;
      selectedEmployeeSalary = data?.salary || 0;
      console.log(`Employee salary loaded: ₹${selectedEmployeeSalary} for worker ${selectedWorkerId}`);
      console.log('Raw salary data:', data);
    } catch (error) {
      console.error('Error loading employee salary:', error);
      selectedEmployeeSalary = 0;
    }
  }

  function calculateActualTime() {
    console.log(`⏰ Calculating actual time: fromTime=${fromTime}, toTime=${toTime}`);
    
    if (!fromTime || !toTime) {
      actualTimeMinutes = 0;
      hoursWorkedToday = 0;
      console.log(`❌ Missing time values, setting to 0`);
      return;
    }

    try {
      const from = new Date(`2000-01-01T${fromTime}`);
      const to = new Date(`2000-01-01T${toTime}`);
      
      console.log(`📅 Time objects: from=${from}, to=${to}`);
      
      if (to < from) {
        to.setDate(to.getDate() + 1);
        console.log(`📅 Adjusted to next day: ${to}`);
      }
      
      const diffMs = to.getTime() - from.getTime();
      actualTimeMinutes = diffMs / (1000 * 60);
      hoursWorkedToday = actualTimeMinutes / 60;
      
      console.log(`✅ Calculated actual time: ${actualTimeMinutes} minutes (${hoursWorkedToday.toFixed(2)} hours)`);
    } catch (error) {
      console.error('Error calculating actual time:', error);
      actualTimeMinutes = 0;
      hoursWorkedToday = 0;
    }
  }

  function calculateLostTime() {
    console.log(`🕐 Calculating lost time: actual=${actualTimeMinutes}min, standard=${standardTimeMinutes}min`);
    console.log('Selected worker:', selectedWorkerId);
    
    if (actualTimeMinutes > standardTimeMinutes && selectedWorkerId) {
      // Calculate lost time per worker based on their skill competency
      const lostTimePerWorker = Math.max(0, actualTimeMinutes - standardTimeMinutes);
      
      // For now, distribute lost time equally among selected workers
      // In a more sophisticated system, this could be weighted by skill competency
      ltMinutes = lostTimePerWorker;
      ltCost = 0; // No cost calculation as per requirement
      showLostTimeSection = true;
      console.log(`⚠️ Lost time detected: ${ltMinutes} minutes per worker, showing lost time section`);
    } else {
      ltMinutes = 0;
      ltCost = 0;
      showLostTimeSection = false;
      console.log(`✅ No lost time detected - actual time is within standard time or no worker selected`);
    }
  }

  async function handleReasonChange() {
    if (ltReasonId) {
      try {
        // Update payable status based on selected reason
        const reasonId = parseInt(ltReasonId);
        isLtPayable = await getDefaultPayableStatus(reasonId);
      } catch (error) {
        console.error('Error updating reason defaults:', error);
      }
    }
  }

  function handleBreakdownChange(event: CustomEvent) {
    // This function is no longer used in the multi-step approach
    console.log('Breakdown changed:', event.detail);
  }

  async function checkWorkerConflict() {
    try {
      // Convert time range to datetime for comparison
      const fromDateTime = new Date(`${fromDate}T${fromTime}`);
      const toDateTime = new Date(`${toDate}T${toTime}`);
      
      // Check for existing work reports for the same worker in overlapping time periods
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
        .eq('worker_id', selectedWorkerId)
        .eq('is_deleted', false)
        .neq('planning_id', plannedWork.id); // Exclude current planning record

      if (error) throw error;

      // Check for time conflicts
      const conflicts = existingReports.filter(report => {
        const reportFromDateTime = new Date(`${report.from_date}T${report.from_time}`);
        const reportToDateTime = new Date(`${report.to_date}T${report.to_time}`);
        
        // Check if time ranges overlap
        return (fromDateTime < reportToDateTime && toDateTime > reportFromDateTime);
      });

      if (conflicts.length > 0) {
        // Build conflict message
        const conflictDetails = conflicts.map(conflict => {
          const workName = conflict.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || 'Unknown Work';
          const workCode = conflict.prdn_work_planning?.std_work_type_details?.derived_sw_code || conflict.prdn_work_planning?.std_work_type_details?.sw_code || 'Unknown';
          const conflictFromTime = new Date(`${conflict.from_date}T${conflict.from_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          const conflictToTime = new Date(`${conflict.to_date}T${conflict.to_time}`).toLocaleString('en-GB', { 
            day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
          });
          
          return `• ${workName} (${workCode})\n  ${conflictFromTime} - ${conflictToTime}`;
        }).join('\n\n');

        const workerName = availableWorkers.find(w => w.emp_id === selectedWorkerId)?.emp_name || 'Unknown Worker';
        const currentFromTime = fromDateTime.toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        const currentToTime = toDateTime.toLocaleString('en-GB', { 
          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });

        const message = `⚠️ WORKER CONFLICT DETECTED!\n\nWorker: ${workerName}\nCurrent Assignment: ${currentFromTime} - ${currentToTime}\n\nThis worker is already assigned to:\n\n${conflictDetails}\n\nDo you want to proceed anyway?`;

        const proceed = confirm(message);
        return !proceed; // Return true if user cancels (has conflict)
      }

      return false; // No conflicts found
    } catch (error) {
      console.error('Error checking worker conflict:', error);
      // If there's an error checking conflicts, allow the save to proceed
      return false;
    }
  }

  async function updateProductionDatesIfFirstReport(reportData: any) {
    try {
      // Get the planning record to get stage_code and wo_details_id
      const { data: planningData, error: planningError } = await supabase
        .from('prdn_work_planning')
        .select('stage_code, wo_details_id')
        .eq('id', reportData.planning_id)
        .single();

      if (planningError) {
        console.error('Error fetching planning data:', planningError);
        return;
      }

      const stageCode = planningData.stage_code;
      const woDetailsId = planningData.wo_details_id;

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
        return;
      }

      // If this is the first report (only one record and it's the one we just created)
      if (existingReports && existingReports.length === 1 && existingReports[0].id === reportData.id) {
        console.log(`🎯 First work report for WO ${woDetailsId} in stage ${stageCode}, updating prdn_dates`);
        
        // Update the prdn_dates table with the actual start date
        const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
        const currentUser = getCurrentUsername();
        const now = getCurrentTimestamp();
        
        const { error: datesError } = await supabase
          .from('prdn_dates')
          .update({
            actual_date: reportData.from_date,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('sales_order_id', woDetailsId)
          .eq('stage_code', stageCode)
          .eq('date_type', 'entry');

        if (datesError) {
          console.error('Error updating prdn_dates:', datesError);
        } else {
          console.log(`✅ Updated prdn_dates with actual start date: ${reportData.from_date}`);
        }
      } else {
        console.log(`📝 Not the first work report for WO ${woDetailsId} in stage ${stageCode}, skipping prdn_dates update`);
      }
    } catch (error) {
      console.error('Error in updateProductionDatesIfFirstReport:', error);
    }
  }

  async function handleSave() {
    console.log('🚀 Save button clicked - Starting save process');
    console.log('Selected worker:', selectedWorkerId);
    console.log('Time range:', { fromDate, fromTime, toDate, toTime });
    console.log('Lost time minutes:', ltMinutes);
    console.log('Lost time chunks:', lostTimeChunks);
    console.log('Lost time reason ID:', ltReasonId);
    
    if (!selectedWorkerId || !fromDate || !fromTime || !toDate || !toTime) {
      alert('Please fill in all required fields');
      return;
    }

    // Check for worker conflicts
    const hasConflict = await checkWorkerConflict();
    if (hasConflict) {
      return; // User chose to cancel
    }

    // Validate lost time chunks
    if (showLostTimeSection && ltMinutes > 0) {
      if (lostTimeChunks.length === 0) {
        alert('Please add at least one lost time chunk');
        return;
      }
      
      // Check that all chunks have reasons assigned
      if (lostTimeChunks.some(chunk => !chunk.reasonId)) {
        alert('Please assign reasons to all lost time chunks');
        return;
      }
      
      // Check that all lost time minutes are accounted for
      const totalAllocatedMinutes = lostTimeChunks.reduce((sum, chunk) => sum + chunk.minutes, 0);
      console.log(`Lost time validation - Total lost: ${ltMinutes} minutes, Total allocated: ${totalAllocatedMinutes} minutes`);
      
      if (totalAllocatedMinutes !== ltMinutes) {
        alert(`Lost time allocation incomplete!\n\nTotal Lost Time: ${ltMinutes} minutes\nTotal Allocated: ${totalAllocatedMinutes} minutes\nRemaining: ${ltMinutes - totalAllocatedMinutes} minutes\n\nPlease allocate all ${ltMinutes} minutes before saving.`);
        return;
      }
    }
    
    console.log('✅ Validation passed - proceeding with save');

    try {
      isLoading = true;
      // Get current username (throws error if not found)
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();
      
      // Prepare lost time details for JSON storage
      let ltDetails = null;
      
      if (ltMinutes > 0 && lostTimeChunks.length > 0) {
        // Use chunk data from multi-step process
        ltDetails = lostTimeChunks.map(chunk => ({
          lt_minutes: chunk.minutes,
          lt_reason: chunk.reasonName,
          is_lt_payable: chunk.isPayable,
          lt_value: chunk.cost
        }));
      }
      
      // Create work reporting record
      const insertData = {
        planning_id: plannedWork.id,
        worker_id: selectedWorkerId,
        from_date: fromDate,
        from_time: fromTime,
        to_date: toDate,
        to_time: toTime,
        // Only set hours_worked_till_date if work is not completed (NC)
        // If completed (C), hours_worked_till_date should be 0
        hours_worked_till_date: completionStatus === 'NC' ? hoursWorkedTillDate + hoursWorkedToday : 0,
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
      };
      
      console.log('📝 Inserting work report:', insertData);
      
      const { data, error } = await supabase
        .from('prdn_work_reporting')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating work report:', error);
        alert('Error creating work report: ' + (error.message || 'Unknown error'));
        return;
      }
      
      console.log('✅ Work report created successfully:', data);

      // Breakdown details are now stored in lt_details JSON field

      // Update prdn_dates table if this is the first work report for this stage
      await updateProductionDatesIfFirstReport(data);

      // Update the planning record status
      const { error: updateError } = await supabase
        .from('prdn_work_planning')
        .update({
          status: 'submitted',
          // Only update time_worked_till_date if work is not completed (NC)
          // If completed (C), time_worked_till_date should remain 0
          time_worked_till_date: completionStatus === 'NC' ? hoursWorkedTillDate + hoursWorkedToday : 0,
          remaining_time: Math.max(0, plannedWork.planned_hours - (hoursWorkedTillDate + hoursWorkedToday)),
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('id', plannedWork.id);

      if (updateError) {
        console.error('Error updating work planning:', updateError);
        alert('Work report created but failed to update planning status');
        return;
      }

      // Update prdn_work_status based on completion status
      // Get the planning record to get derived_sw_code and other_work_code
      const { data: planningRecord, error: planningError } = await supabase
        .from('prdn_work_planning')
        .select('derived_sw_code, other_work_code, wo_details_id, stage_code')
        .eq('id', plannedWork.id)
        .single();

      if (!planningError && planningRecord) {
        const newStatus = completionStatus === 'C' ? 'Completed' : 'In Progress';
        
        // Update by derived_sw_code (standard works) or other_work_code (non-standard works)
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
        }

        const { error: statusError } = await statusUpdateQuery;

        if (statusError) {
          console.error('Error updating work status:', statusError);
          // Note: Report was created, but status update failed
          // This is logged but we still continue
        } else {
          console.log(`✅ Updated work status to ${newStatus}`);
        }
      }

      console.log('Work report created successfully:', data);
      
      // Dispatch success event
      dispatch('save', {
        success: true,
        reportId: data.id,
        message: 'Work report created successfully'
      });
      
      handleClose();
    } catch (error) {
      console.error('Error creating work report:', error);
      alert('Error creating work report: ' + ((error as Error)?.message || 'Unknown error'));
    } finally {
      isLoading = false;
    }
  }

  function handleClose() {
    dispatch('close');
    resetForm();
  }

  function resetForm() {
    selectedWorkerId = '';
    fromDate = '';
    fromTime = '';
    toDate = '';
    toTime = '';
    completionStatus = 'C';
    hoursWorkedToday = 0;
    hoursWorkedTillDate = 0;
    ltMinutes = 0;
    ltReasonId = '';
    isLtPayable = false;
    ltCost = 0;
    ltComments = '';
    showLostTimeSection = false;
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
    class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-[9999] w-full h-full border-none p-0"
    on:click={handleClose}
    aria-label="Close modal"
  ></button>
  
  <!-- Modal content -->
  <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-2xl dark:shadow-black/50 border-2 border-gray-300 dark:border-gray-600 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="px-6 py-4 border-b theme-border">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-medium theme-text-primary">Report Work</h3>
              <div class="flex items-center space-x-4 mt-2">
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {currentStage >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">1</div>
                  <span class="text-sm theme-text-secondary">Worker & Time</span>
                </div>
                <div class="w-8 h-px bg-gray-300 dark:bg-gray-600"></div>
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {currentStage >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">2</div>
                  <span class="text-sm theme-text-secondary">Split Lost Time</span>
                </div>
                <div class="w-8 h-px bg-gray-300 dark:bg-gray-600"></div>
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium {currentStage >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}">3+</div>
                  <span class="text-sm theme-text-secondary">Assign Reasons</span>
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
              <div><span class="theme-text-secondary">Work Code:</span> <span class="theme-text-primary">{plannedWork?.std_work_type_details?.derived_sw_code || plannedWork?.derived_sw_code || plannedWork?.std_work_type_details?.sw_code}</span></div>
              <div><span class="theme-text-secondary">Work Name:</span> <span class="theme-text-primary">{plannedWork?.std_work_type_details?.type_description || 'N/A'}</span></div>
              <div><span class="theme-text-secondary">Standard Time:</span> <span class="theme-text-primary">{formatMinutes(standardTimeMinutes)}</span></div>
              <div><span class="theme-text-secondary">Time Worked Till Date:</span> <span class="theme-text-primary">{formatTime(hoursWorkedTillDate)}</span></div>
            </div>
          </div>

          <!-- Stage 1: Employee & Time Selection -->
          {#if currentStage === 1}

          <!-- Worker Selection -->
          <div>
            <label for="worker-select" class="block text-sm font-medium theme-text-primary mb-2">Worker</label>
            <select
              id="worker-select"
              bind:value={selectedWorkerId}
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

          <!-- Date and Time -->
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

          <!-- Time Calculation Display -->
          {#if actualTimeMinutes > 0}
            <div class="theme-bg-blue-50 dark:theme-bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div class="flex items-center">
                <Clock class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                <span class="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Actual Time: {formatMinutes(actualTimeMinutes)} | Hours Worked Today: {hoursWorkedToday.toFixed(1)}h
                </span>
              </div>
            </div>
          {/if}

          <!-- Completion Status -->
          <div>
            <div class="block text-sm font-medium theme-text-primary mb-2">Completion Status</div>
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

          <!-- Stage 2: Lost Time Splitting -->
          {#if currentStage === 2}
            <!-- Time Summary -->
            <div class="theme-bg-blue-50 dark:theme-bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h4 class="font-medium text-blue-800 dark:text-blue-200 mb-3">Time Summary</h4>
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
                  <span class="theme-text-primary font-medium ml-2">{formatMinutes(totalLostTimeMinutes)} per worker</span>
                </div>
                <div>
                  <span class="theme-text-secondary">Status:</span>
                  <span class="theme-text-primary font-medium ml-2">{completionStatus === 'C' ? 'Completed' : 'Not Completed'}</span>
                </div>
              </div>
            </div>

            <!-- Lost Time Splitting -->
            <div class="theme-bg-orange-50 dark:theme-bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <div class="flex items-center justify-between mb-4">
                <h4 class="font-medium text-orange-800 dark:text-orange-200">Split Lost Time</h4>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  on:click={addLostTimeChunk}
                  disabled={remainingMinutesToSplit <= 0}
                >
                  <Plus class="w-4 h-4 mr-1" />
                  Add Chunk
                </Button>
              </div>

              <div class="text-sm mb-4 {remainingMinutesToSplit === 0 ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}">
                Total Lost Time: {totalLostTimeMinutes} minutes | 
                Allocated: {lostTimeChunks.reduce((sum, chunk) => sum + chunk.minutes, 0)} minutes | 
                Remaining: {remainingMinutesToSplit} minutes
                {#if remainingMinutesToSplit === 0}
                  ✅ All minutes allocated
                {:else if remainingMinutesToSplit > 0}
                  ⚠️ {remainingMinutesToSplit} minutes not allocated
                {/if}
              </div>

              {#if lostTimeChunks.length === 0}
                <div class="text-center py-4 text-orange-600 dark:text-orange-400">
                  <p>No lost time chunks added yet.</p>
                  <p class="text-sm mt-1">Click "Add Chunk" to start splitting the lost time.</p>
                </div>
              {:else}
                <div class="space-y-3">
                  {#each lostTimeChunks as chunk, index}
                    <div class="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <div class="w-8 text-sm font-medium text-gray-900 dark:text-gray-100">
                        #{index + 1}
                      </div>
                      <div class="w-24">
                        <input
                          type="number"
                          bind:value={chunk.minutes}
                          on:input={(e) => updateChunkMinutes(chunk.id, parseInt((e.target as HTMLInputElement)?.value || '0'))}
                          min="1"
                          max={remainingMinutesToSplit + chunk.minutes}
                          class="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Minutes"
                        />
                      </div>
                      <div class="flex-1 text-sm text-gray-900 dark:text-gray-100">
                        {#if currentStage >= 3}
                          {chunk.reasonName || 'No reason assigned'}
                          {#if chunk.reasonName}
                            <span class="ml-2 text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                              ✓ Assigned
                            </span>
                          {/if}
                        {:else}
                          <span class="text-orange-600 dark:text-orange-400">Reason will be assigned in next step</span>
                        {/if}
                      </div>
                      <div class="w-20 text-sm text-gray-900 dark:text-gray-100">
                        {#if currentStage >= 3}
                          ₹{chunk.cost.toFixed(2)}
                        {:else}
                          <span class="text-orange-600 dark:text-orange-400">TBD</span>
                        {/if}
                      </div>
                      <button
                        type="button"
                        on:click={() => removeLostTimeChunk(chunk.id)}
                        class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Stage 3+: Reason Assignment -->
          {#if currentStage >= 3}
            {@const currentChunk = lostTimeChunks[currentChunkIndex]}
            <div class="theme-bg-green-50 dark:theme-bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div class="flex items-center justify-between mb-4">
                <h4 class="font-medium text-green-800 dark:text-green-200">
                  Assign Reason - Chunk {currentChunkIndex + 1} of {lostTimeChunks.length}
                </h4>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  {currentChunkIndex + 1} / {lostTimeChunks.length}
                </div>
              </div>

              <!-- Current Chunk Info -->
              <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-600">
                <div class="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">Minutes:</span>
                    <span class="text-gray-900 dark:text-gray-100 font-medium ml-2">{currentChunk?.minutes || 0}</span>
                  </div>
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">Current Reason:</span>
                    <span class="text-gray-900 dark:text-gray-100 font-medium ml-2">{currentChunk?.reasonName || 'None'}</span>
                  </div>
                  <div>
                    <span class="text-gray-600 dark:text-gray-400">Cost:</span>
                    <span class="text-gray-900 dark:text-gray-100 font-medium ml-2">₹{currentChunk?.cost?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>

              <!-- Reason Selection -->
              <div>
                <label for="reason-select" class="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  Select Reason for {lostTimeChunks[currentChunkIndex]?.minutes || 0} minutes
                </label>
                <select
                  id="reason-select"
                  value={lostTimeChunks[currentChunkIndex]?.reasonId || ''}
                  on:change={(e) => {
                    const target = e.target as HTMLSelectElement;
                    assignReasonToChunk(parseInt(target?.value || '0'));
                  }}
                  class="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select reason...</option>
                  {#each lostTimeReasons as reason}
                    {@const isAlreadyUsed = lostTimeChunks.some(chunk => chunk.reasonId === reason.id && chunk.id !== lostTimeChunks[currentChunkIndex]?.id)}
                    <option value={reason.id} disabled={isAlreadyUsed}>
                      {reason.lost_time_reason} ({reason.p_head}){isAlreadyUsed ? ' - Already used' : ''}
                    </option>
                  {/each}
                </select>
              </div>

              <!-- Progress Bar -->
              <div class="mt-4">
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>Progress</span>
                  <span>{Math.round(((currentChunkIndex + 1) / lostTimeChunks.length) * 100)}%</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style="width: {((currentChunkIndex + 1) / lostTimeChunks.length) * 100}%"
                  ></div>
                </div>
              </div>
            </div>
          {/if}

        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t theme-border flex justify-end space-x-3">
          <Button variant="secondary" on:click={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          {#if currentStage === 1}
            <Button variant="primary" on:click={proceedToStage2} disabled={isLoading || !selectedWorkerId || !fromDate || !fromTime || !toDate || !toTime}>
              Next: Split Lost Time
            </Button>
          {:else if currentStage === 2}
            <Button variant="secondary" on:click={goBackToStage1} disabled={isLoading}>
              Back
            </Button>
            <Button variant="primary" on:click={proceedToStage3} disabled={isLoading || remainingMinutesToSplit > 0 || lostTimeChunks.length === 0}>
              Next: Assign Reasons
            </Button>
            <!-- Debug info -->
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Debug: remainingMinutes={remainingMinutesToSplit}, chunks={lostTimeChunks.length}, loading={isLoading}
              <br>
              Button disabled: {isLoading || remainingMinutesToSplit > 0 || lostTimeChunks.length === 0}
              <br>
              Individual checks: loading={isLoading}, remaining>0={remainingMinutesToSplit > 0}, chunks=0={lostTimeChunks.length === 0}
            </div>
          {:else if currentStage >= 3}
            <Button variant="secondary" on:click={goBackToPreviousChunk} disabled={isLoading}>
              {currentChunkIndex === 0 ? 'Back to Split' : 'Previous'}
            </Button>
            <Button variant="primary" on:click={proceedToNextChunk} disabled={isLoading || !lostTimeChunks[currentChunkIndex]?.reasonId}>
              {currentChunkIndex >= lostTimeChunks.length - 1 ? 'Save Report' : 'Next Chunk'}
            </Button>
            <!-- Debug info for Stage 3+ -->
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Debug Stage 3+: currentChunkIndex={currentChunkIndex}, totalChunks={lostTimeChunks.length}, loading={isLoading}
              <br>
              Current chunk reason: {lostTimeChunks[currentChunkIndex]?.reasonId ? 'Assigned' : 'Not assigned'}
              <br>
              Button disabled: {isLoading || !lostTimeChunks[currentChunkIndex]?.reasonId}
            </div>
          {/if}
        </div>
    </div>
  </div>
{/if}
