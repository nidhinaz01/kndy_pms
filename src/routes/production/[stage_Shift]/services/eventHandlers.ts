import { supabase } from '$lib/supabaseClient';
import { getWaitingWorkOrdersForEntry, getAvailableWorkOrdersForExit, recordWorkOrderEntry, recordWorkOrderExit } from '../../services/stageWorkOrderService';
import { submitPlanning, submitReporting } from '$lib/api/production/planningReportingService';
import { savePlannedAttendance, savePlannedStageReassignment, saveReportedManpower } from '$lib/api/production/manpowerPlanningReportingService';
import { convertPlanToDraftReport } from '$lib/services/convertPlanToDraftReportService';
import { validateReportingAttendance } from '$lib/utils/reportingAttendanceValidation';

/**
 * Update work status when skill competencies are deleted
 * Status should be 'To be Planned' when ANY skill is deleted (not just when all are deleted)
 */
async function updateWorkStatusAfterDeletion(
  stageCode: string,
  woDetailsId: number,
  derivedSwCode: string | null,
  otherWorkCode: string | null,
  selectedDate: string
): Promise<void> {
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // When any skill is deleted, update status to 'To be Planned'
    let statusQuery = supabase
      .from('prdn_work_status')
      .update({
        current_status: 'To be Planned',
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('stage_code', stageCode)
      .eq('wo_details_id', woDetailsId);

    if (derivedSwCode) {
      statusQuery = statusQuery.eq('derived_sw_code', derivedSwCode);
    } else if (otherWorkCode) {
      statusQuery = statusQuery.eq('other_work_code', otherWorkCode);
    } else {
      return; // Can't determine work code
    }

    await statusQuery;
    console.log(`✅ Updated work status to 'To be Planned' for work ${derivedSwCode || otherWorkCode} after skill deletion`);
  } catch (error) {
    console.error('Error updating work status after deletion:', error);
  }
}

export interface EventHandlerContext {
  // State setters
  setShowAddWorkModal: (value: boolean) => void;
  setAvailableWorkOrdersForAdd: (value: any[]) => void;
  setShowViewWorkHistoryModal: (value: boolean) => void;
  setSelectedWorkForHistory: (value: any) => void;
  setShowRemoveWorkModal: (value: boolean) => void;
  setSelectedWorkForRemoval: (value: any) => void;
  setShowPlanModal: (value: boolean) => void;
  setSelectedWorkForPlanning: (value: any) => void;
  setShowReportModal: (value: boolean) => void;
  setSelectedWorkForReporting: (value: any) => void;
  setShowMultiReportModal: (value: boolean) => void;
  setSelectedWorksForMultiReport: (value: any[]) => void;
  setShowCancelWorkModal: (value: boolean) => void;
  setSelectedWorksForCancellation: (value: any[]) => void;
  setShowEntryModal: (value: boolean) => void;
  setWaitingWorkOrdersForEntry: (value: any[]) => void;
  setSelectedWorkOrderForEntry: (value: any) => void;
  setEntryModalLoading: (value: boolean) => void;
  setEntryProgressMessage: (value: string) => void;
  setShowExitModal: (value: boolean) => void;
  setAvailableWorkOrdersForExit: (value: any[]) => void;
  setSelectedWorkOrderForExit: (value: any) => void;
  setExitModalLoading: (value: boolean) => void;
  setExitProgressMessage: (value: string) => void;
  setExitDate: (value: string) => void;
  setShowAddTraineesModal: (value: boolean) => void;
  setSelectedWorkGroupForTrainees: (value: any) => void;
  setShowReportUnplannedWorkModal: (value: boolean) => void;
  setShowUnplannedWorkReportModal: (value: boolean) => void;
  setSelectedWorkForUnplannedReporting: (value: any) => void;
  setExpandedGroups: (value: string[] | ((prev: string[]) => string[])) => void;
  setSelectedRows: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setExpandedReportGroups: (value: string[] | ((prev: string[]) => string[])) => void;
  setDraftPlanLoading: (value: boolean) => void;
  setDraftReportLoading: (value: boolean) => void;
  setIsPlannedWorksLoading: (value: boolean) => void;
  setIsReportLoading: (value: boolean) => void;
  setActiveTab?: (value: string) => void;
  
  // State getters
  workOrdersData: any[];
  plannedWorksWithStatus: any[];
  selectedRows: Set<string>;
  expandedGroups: string[];
  expandedReportGroups: string[];
  activeTab: string;
  stageCode: string;
  selectedDate: string;
  shiftCode: string;
  exitDate: string;
  selectedWorkOrderForEntry: any;
  selectedWorkOrderForExit: any;
  selectedWorksForCancellation: any[];
  shiftBreakTimes?: Array<{ start_time: string; end_time: string }>;
  
  // Data loading functions
  loadWorkOrdersData: () => Promise<void>;
  loadWorksData: () => Promise<void>;
  loadPlannedWorksData: () => Promise<void>;
  loadManpowerPlanData: () => Promise<void>;
  loadDraftPlanData: () => Promise<void>;
  loadManpowerReportData: () => Promise<void>;
  loadDraftReportData: () => Promise<void>;
  loadReportData: () => Promise<void>;
}

/**
 * Handle add work action
 */
export function handleAddWork(context: EventHandlerContext) {
  // Fix 1 & 4: Create fresh copies of work order objects to prevent cache buildup
  const availableWorkOrders = context.workOrdersData.map(wo => ({
    id: wo.prdn_wo_details?.id || 0,
    wo_no: wo.prdn_wo_details?.wo_no || null,
    pwo_no: wo.prdn_wo_details?.pwo_no || null,
    wo_model: wo.prdn_wo_details?.wo_model || ''
  })).filter(wo => wo.id > 0);
  context.setAvailableWorkOrdersForAdd(availableWorkOrders);
  context.setShowAddWorkModal(true);
}

/**
 * Handle add work close
 */
export function handleAddWorkClose(context: EventHandlerContext) {
  context.setShowAddWorkModal(false);
  context.setAvailableWorkOrdersForAdd([]);
}

/**
 * Handle work added
 */
export async function handleWorkAdded(context: EventHandlerContext) {
  await context.loadWorksData();
  handleAddWorkClose(context);
}

/**
 * Handle view work
 */
export function handleViewWork(context: EventHandlerContext, event: CustomEvent) {
  // Fix 1 & 4: Create a fresh copy of the work object to prevent cache buildup
  const originalWork = event.detail.work;
  const freshWork = { ...originalWork };
  
  context.setSelectedWorkForHistory(freshWork);
  context.setShowViewWorkHistoryModal(true);
}

/**
 * Handle view work history close
 */
export function handleViewWorkHistoryClose(context: EventHandlerContext) {
  context.setShowViewWorkHistoryModal(false);
  context.setSelectedWorkForHistory(null);
}

/**
 * Handle remove work
 */
export function handleRemoveWork(context: EventHandlerContext, event: CustomEvent) {
  // Fix 1 & 4: Create a fresh copy of the work object to prevent cache buildup
  const originalWork = event.detail.work;
  const freshWork = { ...originalWork };
  
  context.setSelectedWorkForRemoval(freshWork);
  context.setShowRemoveWorkModal(true);
}

/**
 * Handle remove work close
 */
export function handleRemoveWorkClose(context: EventHandlerContext) {
  context.setShowRemoveWorkModal(false);
  context.setSelectedWorkForRemoval(null);
}

/**
 * Handle work removed
 */
export async function handleWorkRemoved(context: EventHandlerContext) {
  await context.loadWorksData();
  handleRemoveWorkClose(context);
}

/**
 * Handle remove selected works
 */
export async function handleRemoveSelected(context: EventHandlerContext, event: CustomEvent) {
  const { works } = event.detail;
  if (!works || works.length === 0) return;
  await context.loadWorksData();
}

/**
 * Handle plan work
 */
export function handlePlanWork(context: EventHandlerContext, event: CustomEvent) {
  // Fix 1 & 4: Create a fresh copy of the work object to prevent cache buildup
  // This ensures we don't reuse object references that might have stale data
  const originalWork = event.detail.work;
  const freshWork = {
    ...originalWork,
    // Explicitly clear existingDraftPlans for new planning (Fix 2)
    // Only set it if we're actually editing (which would be set elsewhere)
    existingDraftPlans: originalWork.existingDraftPlans || undefined
  };
  
  // Remove existingDraftPlans if it's empty or shouldn't be there for new planning
  if (!freshWork.existingDraftPlans || (Array.isArray(freshWork.existingDraftPlans) && freshWork.existingDraftPlans.length === 0)) {
    delete freshWork.existingDraftPlans;
  }
  
  context.setSelectedWorkForPlanning(freshWork);
  context.setShowPlanModal(true);
}

/**
 * Handle plan modal close
 */
export function handlePlanModalClose(context: EventHandlerContext) {
  context.setShowPlanModal(false);
  context.setSelectedWorkForPlanning(null);
}

/**
 * Handle plan save
 */
export async function handlePlanSave(context: EventHandlerContext) {
  await Promise.all([
    context.loadWorksData(),
    context.loadDraftPlanData(),
    context.loadManpowerPlanData()
  ]);
  if (context.activeTab === 'plan') await context.loadPlannedWorksData();
  handlePlanModalClose(context);
}

/**
 * Handle report work (from Plan tab - all workers report together)
 */
export async function handleReportWork(context: EventHandlerContext, event: CustomEvent) {
  const { works, group } = event.detail;
  
  if (!works || !Array.isArray(works) || works.length === 0) {
    alert('No works to report');
    return;
  }

  // Validate that all employees have attendance marked in Manpower Report tab
  const validation = await validateReportingAttendance(
    context.stageCode,
    context.shiftCode,
    context.selectedDate
  );

  if (!validation.isValid) {
    if (validation.missingEmployees && validation.missingEmployees.length > 0) {
      const missingList = validation.missingEmployees.slice(0, 5).join(', ');
      const moreCount = validation.missingEmployees.length > 5 
        ? ` and ${validation.missingEmployees.length - 5} more` 
        : '';
      alert(
        `Cannot proceed with reporting. Please complete attendance marking in Manpower Report tab first.\n\n` +
        `Missing attendance for: ${missingList}${moreCount}\n\n` +
        `Please mark attendance for all employees in the Manpower Report tab before converting plans to reports.`
      );
    } else {
      alert(
        `Cannot proceed with reporting. Please complete attendance marking in Manpower Report tab first.\n\n` +
        (validation.error || 'All employees must have attendance marked before reporting.')
      );
    }
    return;
  }


  // Fix 1 & 4: Create fresh copies of work objects to prevent cache buildup
  const freshWorks = works.map(work => ({ ...work }));
  
  // Sort works by skill name (like handleMultiReport does)
  const sortedWorks = freshWorks.sort((a, b) => {
    const scNameA = a.std_work_skill_mapping?.sc_name || a.sc_required || '';
    const scNameB = b.std_work_skill_mapping?.sc_name || b.sc_required || '';
    return scNameA.localeCompare(scNameB);
  });

  context.setSelectedWorksForMultiReport(sortedWorks);
  context.setShowMultiReportModal(true);
}

/**
 * Handle cancel work (from Plan tab)
 */
export async function handleCancelWork(context: EventHandlerContext, event: CustomEvent) {
  const { works, group } = event.detail;
  
  console.log('🔴 handleCancelWork called with:', { works, group, worksLength: works?.length });
  
  if (!works || !Array.isArray(works) || works.length === 0) {
    alert('No works to cancel');
    return;
  }

  // Show cancellation modal
  // Make sure we're storing the actual work objects with their IDs
  const worksToCancel = works.map((work: any) => ({
    ...work,
    id: work.id || work.planning_id
  }));
  
  console.log('🔴 Setting works for cancellation:', worksToCancel);
  context.setSelectedWorksForCancellation(worksToCancel);
  context.setShowCancelWorkModal(true);
}

/**
 * Handle add trainees to existing planned work
 */
export function handleAddTrainees(context: EventHandlerContext, event: CustomEvent) {
  const { group } = event.detail;
  
  if (!group || !group.items || group.items.length === 0) {
    alert('No planned work found');
    return;
  }

  // Count existing trainees
  const existingTraineesCount = group.items.filter((item: any) => item.sc_required === 'T').length;
  
  if (existingTraineesCount >= 2) {
    alert('Maximum of 2 trainees already planned for this work');
    return;
  }

  context.setSelectedWorkGroupForTrainees(group);
  context.setShowAddTraineesModal(true);
}

/**
 * Handle add trainees modal close
 */
export function handleAddTraineesModalClose(context: EventHandlerContext) {
  context.setShowAddTraineesModal(false);
  context.setSelectedWorkGroupForTrainees(null);
}

/**
 * Handle add trainees save
 */
export async function handleAddTraineesSave(context: EventHandlerContext) {
  await context.loadPlannedWorksData();
  handleAddTraineesModalClose(context);
}

/**
 * Handle cancel work modal close
 */
export function handleCancelWorkModalClose(context: EventHandlerContext) {
  context.setShowCancelWorkModal(false);
  context.setSelectedWorksForCancellation([]);
}

/**
 * Handle cancel work confirmation
 */
export async function handleCancelWorkConfirm(context: EventHandlerContext, event: CustomEvent) {
  const { reason, works: eventWorks } = event.detail;
  
  // Prefer works from event (passed by modal), fallback to context
  const works = eventWorks || context.selectedWorksForCancellation || [];
  
  console.log('🔴 handleCancelWorkConfirm called with:', { 
    reason, 
    worksLength: works.length, 
    works,
    eventWorks,
    selectedWorksForCancellation: context.selectedWorksForCancellation 
  });
  
  if (!works || works.length === 0) {
    console.error('🔴 No works found in event or context');
    alert('No works to cancel. The selected works may have been cleared. Please try cancelling again.');
    context.setShowCancelWorkModal(false);
    return;
  }

  if (!reason || reason.trim().length === 0) {
    alert('Cancellation reason is required');
    return;
  }

  // Show final confirmation
  const confirmed = confirm(
    `Are you sure you want to cancel ${works.length} work plan(s)?\n\n` +
    'This action cannot be reversed. The workers will be freed and the plan will be marked as cancelled.\n\n' +
    `Reason: ${reason.trim()}`
  );

  if (!confirmed) {
    return; // User cancelled
  }

  // Try multiple ways to get the planning ID
  const planningIds = works
    .map((work: any) => work.id || work.planning_id || work.planningId)
    .filter((id: any) => id !== null && id !== undefined && id !== '');
  
  console.log('🔴 Extracted planning IDs:', planningIds);
  
  if (planningIds.length === 0) {
    console.error('🔴 No valid planning IDs found in works:', works);
    alert('No valid planning IDs found. Please try again.');
    return;
  }

  context.setIsPlannedWorksLoading(true);
  try {
    const { cancelWorkPlans } = await import('$lib/services/workCancellationService');
    const result = await cancelWorkPlans(planningIds, reason);
    
    if (result.success) {
      const cancelledCount = result.cancelledCount || planningIds.length;
      alert(`Successfully cancelled ${cancelledCount} work plan(s)`);
      await context.loadPlannedWorksData();
      handleCancelWorkModalClose(context);
    } else {
      alert(`Error cancelling work: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error cancelling work:', error);
    alert(`Error cancelling work: ${(error as Error).message}`);
  } finally {
    context.setIsPlannedWorksLoading(false);
  }
}

/**
 * Handle report work (for single work reporting - if ReportWorkModal is used)
 * Note: Currently most reporting goes through MultiSkillReportModal
 */
export function handleReportWorkSingle(context: EventHandlerContext, event: CustomEvent) {
  // Fix 1 & 4: Create a fresh copy of the work object to prevent cache buildup
  const originalWork = event.detail.work || event.detail;
  const freshWork = { ...originalWork };
  
  context.setSelectedWorkForReporting(freshWork);
  context.setShowReportModal(true);
}

/**
 * Handle report modal close
 */
export function handleReportModalClose(context: EventHandlerContext) {
  context.setShowReportModal(false);
  context.setSelectedWorkForReporting(null);
}

/**
 * Handle report save
 */
export async function handleReportSave(context: EventHandlerContext) {
  await context.loadPlannedWorksData();
  if (context.activeTab === 'report') await context.loadReportData();
  if (context.activeTab === 'draft-report') await context.loadDraftReportData();
  handleReportModalClose(context);
}

/**
 * Handle convert plan to draft report
 */
export async function handleConvertToDraftReport(context: EventHandlerContext) {
  const confirmed = confirm(
    'This will convert all approved plans to draft reports. ' +
    'Do you want to continue?'
  );
  
  if (!confirmed) return;

  try {
    // Get shift break times from context or load them
    let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];
    if (context.shiftBreakTimes && context.shiftBreakTimes.length > 0) {
      shiftBreakTimes = context.shiftBreakTimes;
    } else {
      // Load shift break times if not available
      const { loadShiftBreakTimesData } = await import('./pageDataService');
      const breakTimesData = await loadShiftBreakTimesData(context.stageCode, context.selectedDate);
      shiftBreakTimes = breakTimesData || [];
    }

    const result = await convertPlanToDraftReport(
      context.stageCode,
      context.selectedDate,
      shiftBreakTimes
    );

    if (result.success) {
      if (result.createdReports > 0) {
        alert(`Successfully created ${result.createdReports} draft report(s).`);
      } else {
        alert(result.errors[0] || 'No reports were created.');
      }
      
      // Reload data
      await context.loadPlannedWorksData();
      await context.loadDraftReportData();
      
      // Switch to draft-report tab
      if (context.setActiveTab) {
        context.setActiveTab('draft-report');
      }
    } else {
      alert(`Error: ${result.errors.join(', ')}`);
    }
  } catch (error) {
    console.error('Error converting plan to draft report:', error);
    alert('Error converting plan to draft report. Please try again.');
  }
}

/**
 * Handle multi report
 */
export async function handleMultiReport(context: EventHandlerContext) {
  if (!context.selectedRows || context.selectedRows.size === 0) {
    alert('Please select at least one row to report');
    return;
  }
  const selectedWorks = context.plannedWorksWithStatus.filter(work => context.selectedRows.has(work.id));
  const workCodes = [...new Set(selectedWorks.map(work => 
    work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code
  ))];
  if (workCodes.length > 1) {
    alert('Please select only skill competencies from the same work');
    return;
  }

  // Validate that all employees have attendance marked in Manpower Report tab
  const validation = await validateReportingAttendance(
    context.stageCode,
    context.shiftCode,
    context.selectedDate
  );

  if (!validation.isValid) {
    if (validation.missingEmployees && validation.missingEmployees.length > 0) {
      const missingList = validation.missingEmployees.slice(0, 5).join(', ');
      const moreCount = validation.missingEmployees.length > 5 
        ? ` and ${validation.missingEmployees.length - 5} more` 
        : '';
      alert(
        `Cannot proceed with reporting. Please complete attendance marking in Manpower Report tab first.\n\n` +
        `Missing attendance for: ${missingList}${moreCount}\n\n` +
        `Please mark attendance for all employees in the Manpower Report tab before converting plans to reports.`
      );
    } else {
      alert(
        `Cannot proceed with reporting. Please complete attendance marking in Manpower Report tab first.\n\n` +
        (validation.error || 'All employees must have attendance marked before reporting.')
      );
    }
    return;
  }


  // Sort selected works by std_work_skill_mapping.sc_name
  const sortedWorks = [...selectedWorks].sort((a, b) => {
    const scNameA = a.std_work_skill_mapping?.sc_name || a.sc_required || '';
    const scNameB = b.std_work_skill_mapping?.sc_name || b.sc_required || '';
    return scNameA.localeCompare(scNameB);
  });
  
  context.setSelectedWorksForMultiReport(sortedWorks);
  context.setShowMultiReportModal(true);
}

/**
 * Handle multi delete
 */
export async function handleMultiDelete(context: EventHandlerContext) {
  if (!context.selectedRows || context.selectedRows.size === 0) {
    alert('Please select at least one skill competency to delete');
    return;
  }
  const selectedCount = context.selectedRows.size;
  const confirmed = confirm(`Are you sure you want to delete ${selectedCount} skill competency${selectedCount === 1 ? '' : 'ies'}?`);
  if (!confirmed) return;
  try {
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const planningIds = Array.from(context.selectedRows).filter(Boolean);
    
    // Get work details before deletion to check status updates
    const { data: plansToDelete } = await supabase
      .from('prdn_work_planning')
      .select('wo_details_id, derived_sw_code, other_work_code')
      .in('id', planningIds);
    
    // Hard delete the selected plans
    const { error } = await supabase
      .from('prdn_work_planning')
      .delete()
      .in('id', planningIds);
    
    if (!error) {
      context.setSelectedRows(new Set());
      
      // Check and update work status for each unique work that had skills deleted
      if (plansToDelete) {
        const uniqueWorks = new Map<string, { woDetailsId: number; derivedSwCode: string | null; otherWorkCode: string | null }>();
        plansToDelete.forEach(plan => {
          const workKey = `${plan.wo_details_id}_${plan.derived_sw_code || plan.other_work_code}`;
          if (!uniqueWorks.has(workKey)) {
            uniqueWorks.set(workKey, {
              woDetailsId: plan.wo_details_id,
              derivedSwCode: plan.derived_sw_code || null,
              otherWorkCode: plan.other_work_code || null
            });
          }
        });
        
        // Update status for each unique work (to 'To be Planned' when any skill is deleted)
        await Promise.all(
          Array.from(uniqueWorks.values()).map(work =>
            updateWorkStatusAfterDeletion(
              context.stageCode,
              work.woDetailsId,
              work.derivedSwCode,
              work.otherWorkCode,
              context.selectedDate
            )
          )
        );
      }
      
      // Reload works data (for Works tab), planned works data (for Plan tab), draft plan data (for Draft Plan tab), and manpower plan data (for Manpower Plan tab)
      await Promise.all([
        context.loadWorksData(),
        context.loadPlannedWorksData(),
        context.loadDraftPlanData(),
        context.loadManpowerPlanData()
      ]);
    }
  } catch (error) {
    console.error('Error deleting work plans:', error);
    alert('Error deleting work plans. Please try again.');
  }
}

/**
 * Handle multi report modal close
 */
export function handleMultiReportModalClose(context: EventHandlerContext) {
  context.setShowMultiReportModal(false);
  context.setSelectedWorksForMultiReport([]);
}

/**
 * Handle multi skill report save
 */
export async function handleMultiSkillReportSave(context: EventHandlerContext) {
  await context.loadPlannedWorksData();
  if (context.activeTab === 'report') await context.loadReportData();
  context.setSelectedRows(new Set());
  handleMultiReportModalClose(context);
}

/**
 * Handle delete plan
 */
export async function handleDeletePlan(context: EventHandlerContext, event: CustomEvent) {
  const plannedWork = event.detail;
  const confirmed = confirm('Are you sure you want to delete this work plan?');
  if (!confirmed) return;
  const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
  const { error } = await supabase
    .from('prdn_work_planning')
    .update({ is_deleted: true, modified_by: getCurrentUsername(), modified_dt: getCurrentTimestamp() })
    .eq('id', plannedWork.id);
  if (!error) {
    // Update work status to 'To be Planned' when any skill is deleted
    await updateWorkStatusAfterDeletion(
      context.stageCode,
      plannedWork.wo_details_id,
      plannedWork.derived_sw_code || null,
      plannedWork.other_work_code || null,
      context.selectedDate
    );
    
    // Reload works data (for Works tab), planned works data (for Plan tab), draft plan data (for Draft Plan tab), and manpower plan data (for Manpower Plan tab)
    await Promise.all([
      context.loadWorksData(),
      context.loadPlannedWorksData(),
      context.loadDraftPlanData(),
      context.loadManpowerPlanData()
    ]);
  }
}

/**
 * Delete all skill competencies for a work
 */
export async function handleDeleteAllPlansForWork(context: EventHandlerContext, event: CustomEvent) {
  const group = event.detail;
  const workName = group.workName || group.workCode;
  const confirmed = confirm(`Are you sure you want to delete all plans for work "${workName}"? This will delete ${group.items.length} skill competency plan(s).`);
  if (!confirmed) return;
  
  // Hard delete all items in the group
  const planIds = group.items.map((item: any) => item.id).filter(Boolean);
  if (planIds.length === 0) return;
  
  const { error } = await supabase
    .from('prdn_work_planning')
    .delete()
    .in('id', planIds);
  
  if (!error && group.items.length > 0) {
    // Update work status to 'To be Planned' when all skills are deleted
    const firstItem = group.items[0];
    await updateWorkStatusAfterDeletion(
      context.stageCode,
      firstItem.wo_details_id,
      firstItem.derived_sw_code || null,
      firstItem.other_work_code || null,
      context.selectedDate
    );
    
    // Reload works data (for Works tab), planned works data (for Plan tab), draft plan data (for Draft Plan tab), and manpower plan data (for Manpower Plan tab)
    await Promise.all([
      context.loadWorksData(),
      context.loadPlannedWorksData(),
      context.loadDraftPlanData(),
      context.loadManpowerPlanData()
    ]);
  }
}

/**
 * Edit draft plan - open planning modal with work data
 */
export function handleEditPlan(context: EventHandlerContext, event: CustomEvent) {
  const group = event.detail;
  if (!group || !group.items || group.items.length === 0) return;
  
  // Get the first item to construct work object
  const firstItem = group.items[0];
  const currentWoDetailsId = firstItem.wo_details_id || firstItem.prdn_wo_details_id;
  
  // Fix 1 & 4: Create a fresh copy of the work object to prevent cache buildup
  // Fix 2: Filter existingDraftPlans to only include plans for the current work order
  const validExistingPlans = group.items.filter((item: any) => 
    (item.wo_details_id || item.prdn_wo_details_id) === currentWoDetailsId
  );
  
  // Construct work object from the draft plan data
  // The work object needs to have the structure expected by PlanWorkModal
  const work = {
    ...firstItem,
    wo_details_id: firstItem.wo_details_id,
    wo_no: group.woNo,
    pwo_no: group.pwoNo,
    std_work_type_details: firstItem.std_work_type_details || {
      derived_sw_code: firstItem.derived_sw_code,
      type_description: ''
    },
    std_vehicle_work_flow: firstItem.vehicleWorkFlow || firstItem.std_vehicle_work_flow,
    skill_mappings: firstItem.skillMapping ? [firstItem.skillMapping] : (firstItem.std_work_skill_mapping ? [firstItem.std_work_skill_mapping] : []),
    skill_time_standards: firstItem.skillTimeStandard ? {
      isUniform: true,
      values: [{
        skill_short: firstItem.hr_emp?.skill_short || '',
        standard_time_minutes: firstItem.skillTimeStandard.standard_time_minutes || 0
      }]
    } : undefined,
    // Include existing plans data so modal can show them (only for current work order)
    existingDraftPlans: validExistingPlans.length > 0 ? validExistingPlans : undefined
  };
  
  context.setSelectedWorkForPlanning(work);
  context.setShowPlanModal(true);
}

/**
 * Toggle group expansion
 */
export function toggleGroup(context: EventHandlerContext, workCode: string) {
  context.setExpandedGroups(prev => {
    if (prev.includes(workCode)) {
      return prev.filter(code => code !== workCode);
    } else {
      return [...prev, workCode];
    }
  });
}

/**
 * Toggle row selection
 */
export function toggleRowSelection(context: EventHandlerContext, rowId: string) {
  context.setSelectedRows(prev => {
    const newSet = new Set(prev);
    if (newSet.has(rowId)) {
      newSet.delete(rowId);
    } else {
      newSet.add(rowId);
    }
    return newSet;
  });
}

/**
 * Select all rows in group
 */
export function selectAllInGroup(context: EventHandlerContext, event: CustomEvent) {
  const group = event.detail;
  context.setSelectedRows(prev => {
    const newSet = new Set(prev);
    group.items.forEach((item: any) => newSet.add(item.id));
    return newSet;
  });
}

/**
 * Clear all selections
 */
export function clearSelections(context: EventHandlerContext) {
  context.setSelectedRows(new Set());
}

/**
 * Toggle report group
 */
export function toggleReportGroup(context: EventHandlerContext, workCode: string) {
  context.setExpandedReportGroups(prev => {
    if (prev.includes(workCode)) {
      return prev.filter(code => code !== workCode);
    } else {
      return [...prev, workCode];
    }
  });
}

/**
 * Handle work order entry
 */
export async function handleWorkOrderEntry(context: EventHandlerContext) {
  context.setEntryModalLoading(true);
  const waitingWorkOrders = await getWaitingWorkOrdersForEntry(context.stageCode, context.selectedDate);
  context.setWaitingWorkOrdersForEntry(waitingWorkOrders);
  context.setSelectedWorkOrderForEntry(null);
  context.setShowEntryModal(true);
  context.setEntryModalLoading(false);
}

/**
 * Handle entry confirm
 */
export async function handleEntryConfirm(context: EventHandlerContext) {
  if (!context.selectedWorkOrderForEntry || !context.selectedWorkOrderForEntry.prdn_wo_details) {
    alert('Please select a work order');
    return;
  }
  context.setEntryModalLoading(true);
  context.setEntryProgressMessage('Processing entry...');
  const result = await recordWorkOrderEntry(
    context.stageCode,
    context.selectedWorkOrderForEntry.prdn_wo_details.id,
    context.selectedWorkOrderForEntry.prdn_wo_details.wo_model,
    context.selectedDate,
    (msg) => { context.setEntryProgressMessage(msg); }
  );
  if (result.success) {
    await context.loadWorkOrdersData();
    await context.loadWorksData();
    context.setShowEntryModal(false);
    context.setSelectedWorkOrderForEntry(null);
    context.setWaitingWorkOrdersForEntry([]);
  }
  context.setEntryModalLoading(false);
  context.setEntryProgressMessage('');
}

/**
 * Handle entry modal close
 */
export function handleEntryModalClose(context: EventHandlerContext) {
  context.setShowEntryModal(false);
  context.setSelectedWorkOrderForEntry(null);
  context.setWaitingWorkOrdersForEntry([]);
  context.setEntryModalLoading(false);
  context.setEntryProgressMessage('');
}

/**
 * Handle work order exit
 */
export async function handleWorkOrderExit(context: EventHandlerContext) {
  context.setExitModalLoading(true);
  const availableWorkOrders = await getAvailableWorkOrdersForExit(context.stageCode);
  context.setAvailableWorkOrdersForExit(availableWorkOrders);
  context.setSelectedWorkOrderForExit(null);
  context.setExitDate(context.selectedDate);
  context.setShowExitModal(true);
  context.setExitModalLoading(false);
}

/**
 * Handle exit confirm
 */
export async function handleExitConfirm(context: EventHandlerContext) {
  if (!context.selectedWorkOrderForExit || !context.selectedWorkOrderForExit.prdn_wo_details || !context.exitDate) {
    alert('Please select a work order and enter an exit date');
    return;
  }
  context.setExitModalLoading(true);
  context.setExitProgressMessage('Processing exit...');
  try {
    const result = await recordWorkOrderExit(
      context.stageCode,
      context.selectedWorkOrderForExit.prdn_wo_details.id,
      context.exitDate,
      (msg) => { context.setExitProgressMessage(msg); }
    );
    if (result.success) {
      await context.loadWorkOrdersData();
      await context.loadWorksData();
      context.setShowExitModal(false);
      context.setSelectedWorkOrderForExit(null);
      context.setAvailableWorkOrdersForExit([]);
      context.setExitDate('');
      context.setExitProgressMessage('');
    } else {
      // Display error message
      context.setExitProgressMessage(result.error || 'Failed to exit work order');
    }
  } catch (error) {
    // Handle unexpected errors
    context.setExitProgressMessage((error as Error)?.message || 'An unexpected error occurred');
  } finally {
    context.setExitModalLoading(false);
  }
}

/**
 * Handle exit modal close
 */
export function handleExitModalClose(context: EventHandlerContext) {
  context.setShowExitModal(false);
  context.setSelectedWorkOrderForExit(null);
  context.setAvailableWorkOrdersForExit([]);
  context.setExitDate('');
  context.setExitModalLoading(false);
  context.setExitProgressMessage('');
}

/**
 * Handle attendance marked
 */
export async function handleAttendanceMarked(context: EventHandlerContext, event?: CustomEvent) {
  if (!event || !event.detail) {
    console.error('No event detail provided for attendance marking');
    return;
  }

  const { empId, stageCode, date, status, notes } = event.detail;
  
  try {
    let result;
    if (context.activeTab === 'manpower-plan') {
      // Save to planning table for the selected date
      result = await savePlannedAttendance(empId, stageCode, date, status, notes);
      if (!result.success) {
        alert('Error saving planned attendance: ' + (result.error || 'Unknown error'));
        return;
      }
  await context.loadManpowerPlanData();
    } else if (context.activeTab === 'manpower-report') {
      // Save to reporting table (for current day) - default LTP/LTNP to 0 if not provided
      const ltpHours = event.detail.ltpHours || 0;
      const ltnpHours = event.detail.ltnpHours || 0;
      result = await saveReportedManpower(empId, stageCode, date, status, ltpHours, ltnpHours, notes);
      if (!result.success) {
        alert('Error saving reported attendance: ' + (result.error || 'Unknown error'));
        return;
      }
      await context.loadManpowerReportData();
    } else {
      console.error('Unknown tab for attendance marking:', context.activeTab);
      return;
    }
  } catch (error) {
    console.error('Error marking attendance:', error);
    alert('Error marking attendance: ' + ((error as Error).message || 'Unknown error'));
  }
}

/**
 * Handle bulk attendance marked
 */
export async function handleBulkAttendanceMarked(context: EventHandlerContext, event?: CustomEvent) {
  if (!event || !event.detail) {
    console.error('No event detail provided for bulk attendance marking');
    return;
  }

  const { employees, date, status, notes } = event.detail;
  
  if (!employees || employees.length === 0) {
    alert('No employees selected for bulk attendance marking');
    return;
  }

  try {
    let results;
    if (context.activeTab === 'manpower-plan') {
      // Save to planning table for the selected date
      results = await Promise.all(
        employees.map((emp: { empId: string; stageCode: string }) =>
          savePlannedAttendance(emp.empId, emp.stageCode, date, status, notes)
        )
      );
    } else if (context.activeTab === 'manpower-report') {
      // Save to reporting table (for current day) - default LTP/LTNP to 0 if not provided
      const ltpHours = event.detail.ltpHours || 0;
      const ltnpHours = event.detail.ltnpHours || 0;
      results = await Promise.all(
        employees.map((emp: { empId: string; stageCode: string }) =>
          saveReportedManpower(emp.empId, emp.stageCode, date, status, ltpHours, ltnpHours, notes)
        )
      );
    } else {
      console.error('Unknown tab for bulk attendance marking:', context.activeTab);
      return;
    }

    // Check if any failed
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      alert(`Error saving attendance for ${failed.length} employee(s). Please try again.`);
      return;
    }

    if (context.activeTab === 'manpower-plan') {
  await context.loadManpowerPlanData();
    } else if (context.activeTab === 'manpower-report') {
      await context.loadManpowerReportData();
    }
  } catch (error) {
    console.error('Error marking bulk attendance:', error);
    alert('Error marking bulk attendance: ' + ((error as Error).message || 'Unknown error'));
  }
}

/**
 * Handle stage reassigned
 */
export async function handleStageReassigned(context: EventHandlerContext, event?: CustomEvent) {
  if (!event || !event.detail) {
    console.error('No event detail provided for stage reassignment');
    return;
  }

  const { empId, fromStageCode, toStageCode, date, shiftCode, fromTime, toTime, reason } = event.detail;
  
  try {
    const result = await savePlannedStageReassignment(
      empId,
      fromStageCode,
      toStageCode,
      date,
      shiftCode,
      fromTime,
      toTime,
      reason
    );
    if (!result.success) {
      alert('Error saving stage reassignment: ' + (result.error || 'Unknown error'));
      return;
    }
  await context.loadManpowerPlanData();
  } catch (error) {
    console.error('Error saving stage reassignment:', error);
    alert('Error saving stage reassignment: ' + ((error as Error).message || 'Unknown error'));
  }
}

/**
 * Handle submit planning
 */
export async function handleSubmitPlanning(context: EventHandlerContext) {
  context.setDraftPlanLoading(true);
  try {
    // Use selected date directly
    let dateStr: string;
    if (typeof context.selectedDate === 'string') {
      dateStr = context.selectedDate.split('T')[0];
    } else {
      dateStr = new Date(context.selectedDate).toISOString().split('T')[0];
    }

    // Validate employee shift planning
    const { validateEmployeeShiftPlanning } = await import('$lib/api/production/planningValidationService');
    const validation = await validateEmployeeShiftPlanning(
      context.stageCode,
      context.shiftCode,
      dateStr
    );

    if (!validation.isValid) {
      const errorMessage = validation.errors.join('\n');
      if (validation.warnings.length > 0) {
        const warningMessage = validation.warnings.join('\n');
        const proceed = confirm(
          `Validation Errors:\n${errorMessage}\n\nWarnings:\n${warningMessage}\n\nDo you want to proceed anyway?`
        );
        if (!proceed) {
          context.setDraftPlanLoading(false);
          return;
        }
      } else {
        alert(`Validation failed:\n${errorMessage}\n\nPlease fix these issues before submitting.`);
        context.setDraftPlanLoading(false);
        return;
      }
    } else if (validation.warnings.length > 0) {
      const warningMessage = validation.warnings.join('\n');
      const proceed = confirm(`Warnings:\n${warningMessage}\n\nDo you want to proceed?`);
      if (!proceed) {
        context.setDraftPlanLoading(false);
        return;
      }
    }

  await submitPlanning(context.stageCode, dateStr);
  await context.loadDraftPlanData();
    alert('Plan submitted successfully!');
  } catch (error) {
    console.error('Error submitting planning:', error);
    alert('Error submitting plan: ' + ((error as Error).message || 'Unknown error'));
  } finally {
  context.setDraftPlanLoading(false);
  }
}

/**
 * Handle report overtime
 */
export async function handleReportOvertime(context: EventHandlerContext, event: CustomEvent) {
  const { saveOvertimeValues } = await import('$lib/services/overtimeReportingService');
  const { overtimeData } = event.detail;
  
  if (!overtimeData || overtimeData.length === 0) {
    alert('No overtime data to save');
    return;
  }

  context.setDraftReportLoading(true);
  try {
    const result = await saveOvertimeValues(overtimeData);
    if (result.success) {
      alert('Overtime values saved successfully. You can now submit the report.');
      await context.loadDraftReportData();
    } else {
      alert(`Error saving overtime values: ${result.error}`);
    }
  } catch (error) {
    console.error('Error reporting overtime:', error);
    alert(`Error reporting overtime: ${(error as Error).message}`);
  } finally {
    context.setDraftReportLoading(false);
  }
}

/**
 * Handle report unplanned work
 */
export function handleReportUnplannedWork(context: EventHandlerContext) {
  console.log('handleReportUnplannedWork called');
  context.setShowReportUnplannedWorkModal(true);
  console.log('showReportUnplannedWorkModal set to true');
}

/**
 * Handle report unplanned work modal close
 */
export function handleReportUnplannedWorkModalClose(context: EventHandlerContext) {
  context.setShowReportUnplannedWorkModal(false);
}

/**
 * Handle report unplanned work selected
 */
export function handleReportUnplannedWorkSelected(context: EventHandlerContext, event: CustomEvent) {
  const { work } = event.detail;
  
  if (!work) {
    alert('No work selected');
    return;
  }

  // Open UnplannedWorkReportModal with the selected work
  // Don't create planning records here - the modal will handle that on save
  context.setSelectedWorkForUnplannedReporting(work);
  context.setShowUnplannedWorkReportModal(true);
  context.setShowReportUnplannedWorkModal(false);
}

/**
 * Handle submit reporting
 */
export async function handleSubmitReporting(context: EventHandlerContext) {
  context.setDraftReportLoading(true);
  try {
    // Parse date string
    let dateStr: string;
    if (typeof context.selectedDate === 'string') {
      dateStr = context.selectedDate.split('T')[0];
    } else {
      dateStr = new Date(context.selectedDate).toISOString().split('T')[0];
    }
    
    // Check for overtime before submitting
    const { calculateOvertime } = await import('$lib/services/overtimeCalculationService');
    let otResult;
    try {
      otResult = await calculateOvertime(context.stageCode, dateStr);
      
      // Log any errors from overtime calculation for debugging
      if (otResult.errors && otResult.errors.length > 0) {
        console.warn('Overtime calculation warnings:', otResult.errors);
      }
    } catch (error) {
      console.error('Error calculating overtime:', error);
      alert('Error checking overtime: ' + ((error as Error).message || 'Unknown error'));
      context.setDraftReportLoading(false);
      return;
    }
    
    // Fetch all reports for this stage and date to check OT status (both draft and pending_approval)
    // When submitting, we need to check OT for all reports regardless of status
    const { data: draftReports, error: draftReportsError } = await supabase
      .from('prdn_work_reporting')
      .select(`
        id,
        overtime_minutes,
        overtime_amount,
        worker_id,
        from_time,
        to_time,
        hours_worked_today,
        prdn_work_planning!inner(stage_code)
      `)
      .eq('from_date', dateStr)
      .in('status', ['draft', 'pending_approval'])
      .eq('is_deleted', false)
      .eq('prdn_work_planning.stage_code', context.stageCode);
    
    if (draftReportsError) {
      console.error('Error fetching draft reports for OT check:', draftReportsError);
      alert('Error checking overtime status: ' + draftReportsError.message);
      context.setDraftReportLoading(false);
      return;
    }
    
    if (otResult.hasOvertime) {
      // Check if all workers with OT have reported OT
      const allWorkersWithOTReported = otResult.workers.every(worker => 
        worker.works.every(work => {
          const report = draftReports?.find((r: any) => r.id === work.reportingId);
          return report && 
                 report.overtime_minutes !== null && 
                 report.overtime_minutes !== undefined &&
                 report.overtime_minutes > 0;
        })
      );
      
      if (!allWorkersWithOTReported) {
        alert(
          'Cannot submit report. Overtime has been detected but not all overtime values have been reported.\n\n' +
          'Please click "Report OT" to calculate and save overtime hours and amounts before submitting.'
        );
        context.setDraftReportLoading(false);
        return;
      }
      
      // Recalculate OT to validate stored values
      let revalidationResult;
      try {
        revalidationResult = await calculateOvertime(context.stageCode, dateStr);
      } catch (error) {
        console.error('Error revalidating overtime:', error);
        alert('Error validating overtime values: ' + ((error as Error).message || 'Unknown error'));
        context.setDraftReportLoading(false);
        return;
      }
      
      if (revalidationResult.hasOvertime) {
        // Compare stored values with calculated values
        let hasMismatch = false;
        const mismatches: string[] = [];
        
        for (const worker of revalidationResult.workers) {
          for (const work of worker.works) {
            const report = draftReports?.find((r: any) => r.id === work.reportingId);
            if (report) {
              const storedMinutes = report.overtime_minutes || 0;
              const calculatedMinutes = work.overtimeMinutes;
              
              // Allow small difference (1 minute) due to rounding
              if (Math.abs(storedMinutes - calculatedMinutes) > 1) {
                hasMismatch = true;
                mismatches.push(
                  `${worker.workerName}: Work ${work.workCode} - Stored: ${storedMinutes}min, Calculated: ${calculatedMinutes}min`
                );
              }
            } else {
              hasMismatch = true;
              mismatches.push(
                `${worker.workerName}: Work ${work.workCode} - Report not found`
              );
            }
          }
        }
        
        if (hasMismatch) {
          alert(
            'Cannot submit report. Overtime values do not match calculated values.\n\n' +
            'Please click "Report OT" again to recalculate and update overtime values.\n\n' +
            'Mismatches:\n' + mismatches.slice(0, 5).join('\n') +
            (mismatches.length > 5 ? `\n... and ${mismatches.length - 5} more` : '')
          );
          context.setDraftReportLoading(false);
          return;
        }
      }
    } else {
      // Secondary validation: Even if calculateOvertime didn't detect OT, manually verify
      // This catches cases where calculateOvertime fails due to missing data or errors
      const reportsWithWorkers = (draftReports || []).filter((r: any) => r.worker_id !== null);
      
      if (reportsWithWorkers.length > 0) {
        // Group reports by worker
        const reportsByWorker = new Map<string, any[]>();
        reportsWithWorkers.forEach((report: any) => {
          const workerId = report.worker_id;
          if (!reportsByWorker.has(workerId)) {
            reportsByWorker.set(workerId, []);
          }
          reportsByWorker.get(workerId)!.push(report);
        });
        
        // For each worker, check if OT might exist
        const workersNeedingOTCheck: Array<{ workerId: string; totalWorkedMinutes: number; shiftCode?: string }> = [];
        
        // Get unique worker IDs to fetch their shift details
        const workerIds = Array.from(reportsByWorker.keys());
        const { data: workerShiftData } = await supabase
          .from('hr_emp')
          .select('emp_id, emp_name, shift_code')
          .in('emp_id', workerIds)
          .eq('is_active', true)
          .eq('is_deleted', false);
        
        const workerShiftMap = new Map<string, { name: string; shiftCode?: string }>();
        (workerShiftData || []).forEach((w: any) => {
          workerShiftMap.set(w.emp_id, { name: w.emp_name || w.emp_id, shiftCode: w.shift_code });
        });
        
        // Get unique shift codes
        const shiftCodes = new Set<string>();
        workerShiftMap.forEach((w) => {
          if (w.shiftCode) shiftCodes.add(w.shiftCode);
        });
        
        // Fetch shift details
        const shiftDetailsMap = new Map<string, { startTime: string; endTime: string; breakTimes: any[] }>();
        for (const shiftCode of shiftCodes) {
          const { data: shiftData } = await supabase
            .from('hr_shift_master')
            .select('shift_id, start_time, end_time')
            .eq('shift_code', shiftCode)
            .eq('is_active', true)
            .eq('is_deleted', false)
            .maybeSingle();
          
          if (shiftData) {
            const { data: breaksData } = await supabase
              .from('hr_shift_break_master')
              .select('start_time, end_time')
              .eq('shift_id', shiftData.shift_id)
              .eq('is_active', true)
              .eq('is_deleted', false)
              .order('start_time', { ascending: true });
            
            shiftDetailsMap.set(shiftCode, {
              startTime: shiftData.start_time,
              endTime: shiftData.end_time,
              breakTimes: breaksData || []
            });
          }
        }
        
        // Helper function to convert time to minutes
        const timeToMinutes = (timeStr: string): number => {
          if (!timeStr) return 0;
          const parts = timeStr.split(':');
          const hours = parseInt(parts[0] || '0', 10);
          const minutes = parseInt(parts[1] || '0', 10);
          return hours * 60 + minutes;
        };
        
        // Helper function to calculate break time
        const calculateBreakTime = (startTime: string, endTime: string, breakTimes: any[]): number => {
          if (!breakTimes || breakTimes.length === 0) return 0;
          let totalBreak = 0;
          const startMin = timeToMinutes(startTime);
          let endMin = timeToMinutes(endTime);
          if (endMin < startMin) endMin += 24 * 60;
          
          breakTimes.forEach((bt: any) => {
            let breakStart = timeToMinutes(bt.start_time);
            let breakEnd = timeToMinutes(bt.end_time);
            if (breakEnd < breakStart) breakEnd += 24 * 60;
            
            const overlapStart = Math.max(startMin, breakStart);
            const overlapEnd = Math.min(endMin, breakEnd);
            if (overlapStart < overlapEnd) {
              totalBreak += (overlapEnd - overlapStart);
            }
          });
          return totalBreak;
        };
        
        // Check each worker for potential OT
        for (const [workerId, workerReports] of reportsByWorker.entries()) {
          const workerInfo = workerShiftMap.get(workerId);
          if (!workerInfo) continue;
          
          // Calculate total worked time for this worker
          let totalWorkedMinutes = 0;
          workerReports.forEach((report: any) => {
            const workedMinutes = report.hours_worked_today 
              ? Math.round(report.hours_worked_today * 60)
              : 0;
            totalWorkedMinutes += workedMinutes;
          });
          
          // Check if OT has been reported for this worker
          const hasReportedOT = workerReports.some((r: any) => 
            r.overtime_minutes !== null && 
            r.overtime_minutes !== undefined &&
            r.overtime_minutes > 0
          );
          
          if (hasReportedOT) continue; // OT already reported, skip
          
          // If worker has shift details, calculate available work time
          if (workerInfo.shiftCode) {
            const shiftDetails = shiftDetailsMap.get(workerInfo.shiftCode);
            if (shiftDetails) {
              const shiftStartMin = timeToMinutes(shiftDetails.startTime);
              let shiftEndMin = timeToMinutes(shiftDetails.endTime);
              if (shiftEndMin < shiftStartMin) shiftEndMin += 24 * 60;
              
              const shiftDuration = shiftEndMin - shiftStartMin;
              const breakMinutes = calculateBreakTime(shiftDetails.startTime, shiftDetails.endTime, shiftDetails.breakTimes);
              const availableWorkMinutes = shiftDuration - breakMinutes;
              
              // If total worked time exceeds available work time, OT exists
              if (totalWorkedMinutes > availableWorkMinutes) {
                workersNeedingOTCheck.push({
                  workerId,
                  totalWorkedMinutes,
                  shiftCode: workerInfo.shiftCode
                });
              }
            } else {
              // No shift details found - use conservative check (8 hours)
              if (totalWorkedMinutes > 480) {
                workersNeedingOTCheck.push({
                  workerId,
                  totalWorkedMinutes
                });
              }
            }
          } else {
            // No shift code - use conservative check (8 hours)
            if (totalWorkedMinutes > 480) {
              workersNeedingOTCheck.push({
                workerId,
                totalWorkedMinutes
              });
            }
          }
        }
        
        // If we found workers who have OT but haven't reported it, block submission
        if (workersNeedingOTCheck.length > 0) {
          const workerNames = workersNeedingOTCheck
            .map(w => {
              const workerInfo = workerShiftMap.get(w.workerId);
              return workerInfo?.name || w.workerId;
            })
            .join(', ');
          
          const hoursWorked = workersNeedingOTCheck
            .map(w => `${(w.totalWorkedMinutes / 60).toFixed(1)}h`)
            .join(', ');
          
          alert(
            `Cannot submit report. Overtime detected for worker(s): ${workerNames}\n\n` +
            `Total hours worked: ${hoursWorked}\n\n` +
            `Overtime has not been calculated or reported for these workers.\n\n` +
            `Please click "Report OT" to calculate and save overtime hours and amounts before submitting.\n\n` +
            `If calculateOvertime had errors, please check:\n` +
            `- Workers have shift codes assigned\n` +
            `- Shift details are configured correctly\n` +
            `- All reports have valid worker assignments`
          );
          context.setDraftReportLoading(false);
          return;
        }
        
        // If calculateOvertime had errors, log them for debugging
        if (otResult.errors && otResult.errors.length > 0) {
          console.warn('Overtime calculation had errors:', otResult.errors);
        }
      }
    }
    
    // Submit the reporting
    const result = await submitReporting(context.stageCode, dateStr);
    
    if (!result.success) {
      alert('Error submitting report: ' + (result.error || 'Unknown error'));
      context.setDraftReportLoading(false);
      return;
    }
    
    // Reload data and show success message
    await context.loadDraftReportData();
    alert('Report submitted successfully!');
  } catch (error) {
    console.error('Error submitting reporting:', error);
    alert('Error submitting report: ' + ((error as Error).message || 'Unknown error'));
  } finally {
    context.setDraftReportLoading(false);
  }
}

/**
 * Handle works export
 */
export async function handleWorksExport(context: EventHandlerContext, event: CustomEvent) {
  const { data: worksData } = event.detail;
  if (!worksData || worksData.length === 0) {
    alert('No data to export');
    return;
  }
  // TODO: Implement export logic
}

/**
 * Handle manpower export
 */
export function handleManpowerExport(context: EventHandlerContext) {
  // TODO: Implement export
}

