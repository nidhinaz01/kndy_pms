import { loadWorkOrdersData as loadWorkOrdersDataService, loadWorksData as loadWorksDataService, loadPlannedWorksData as loadPlannedWorksDataService, loadManpowerPlanData as loadManpowerPlanDataService, loadDraftPlanData as loadDraftPlanDataService, loadManpowerReportData as loadManpowerReportDataService, loadDraftReportData as loadDraftReportDataService, loadShiftBreakTimesData } from './pageDataService';
import { loadReportData as loadReportDataService, calculatePlannedWorksStatus } from './reportDataService';

export interface DataLoadingContext {
  // State setters
  setWorkOrdersData: (value: any[]) => void;
  setIsWorkOrdersLoading: (value: boolean) => void;
  setWorksData: (value: any[]) => void;
  setIsWorksLoading: (value: boolean) => void;
  setPlannedWorksData: (value: any[]) => void;
  setIsPlannedWorksLoading: (value: boolean) => void;
  setPlannedWorksWithStatus: (value: any[]) => void;
  setManpowerPlanData: (value: any[]) => void;
  setIsManpowerPlanLoading: (value: boolean) => void;
  setDraftPlanData: (value: any[]) => void;
  setDraftManpowerPlanData: (value: any[]) => void;
  setIsDraftPlanLoading: (value: boolean) => void;
  setPlanningSubmissionStatus: (value: any) => void;
  setManpowerReportData: (value: any[]) => void;
  setIsManpowerReportLoading: (value: boolean) => void;
  setDraftReportData: (value: any[]) => void;
  setDraftManpowerReportData: (value: any[]) => void;
  setIsDraftReportLoading: (value: boolean) => void;
  setReportingSubmissionStatus: (value: any) => void;
  setReportData: (value: any[]) => void;
  setIsReportLoading: (value: boolean) => void;
  setShiftBreakTimes: (value: any[]) => void;
  
  // Parameters
  stageCode: string;
  shiftCode: string;
  selectedDate: string;
}

/**
 * Load work orders data
 */
export async function loadWorkOrdersData(context: DataLoadingContext) {
  context.setIsWorkOrdersLoading(true);
  const data = await loadWorkOrdersDataService(context.stageCode, context.selectedDate);
  context.setWorkOrdersData(data);
  context.setIsWorkOrdersLoading(false);
}

/**
 * Load works data
 */
export async function loadWorksData(context: DataLoadingContext) {
  context.setIsWorksLoading(true);
  const data = await loadWorksDataService(context.stageCode, context.selectedDate);
  context.setWorksData(data);
  context.setIsWorksLoading(false);
}

/**
 * Load planned works data
 */
export async function loadPlannedWorksData(context: DataLoadingContext) {
  context.setIsPlannedWorksLoading(true);
  const plannedWorks = await loadPlannedWorksDataService(context.stageCode, context.selectedDate);
  context.setPlannedWorksData(plannedWorks);
  const worksWithStatus = await calculatePlannedWorksStatus(plannedWorks);
  context.setPlannedWorksWithStatus(worksWithStatus);
  context.setIsPlannedWorksLoading(false);
}

/**
 * Load manpower plan data
 */
export async function loadManpowerPlanData(context: DataLoadingContext) {
  console.log(`📊 loadManpowerPlanData (dataLoadingService) called with:`, {
    stageCode: context.stageCode,
    shiftCode: context.shiftCode,
    selectedDate: context.selectedDate,
    selectedDateType: typeof context.selectedDate
  });
  context.setIsManpowerPlanLoading(true);
  const data = await loadManpowerPlanDataService(context.stageCode, context.shiftCode, context.selectedDate);
  console.log(`📊 loadManpowerPlanData (dataLoadingService): received ${data.length} employees`);
  context.setManpowerPlanData(data);
  context.setIsManpowerPlanLoading(false);
}

/**
 * Load draft plan data
 */
export async function loadDraftPlanData(context: DataLoadingContext) {
  context.setIsDraftPlanLoading(true);
  const result = await loadDraftPlanDataService(context.stageCode, context.selectedDate);
  context.setDraftPlanData(result.workPlans);
  context.setDraftManpowerPlanData(result.manpowerPlans);
  
  // Also load submission status
  const { getPlanningSubmissionStatus } = await import('./pageDataService');
  const submissionStatus = await getPlanningSubmissionStatus(context.stageCode, context.selectedDate);
  context.setPlanningSubmissionStatus(submissionStatus);
  
  context.setIsDraftPlanLoading(false);
}

/**
 * Load manpower report data
 */
export async function loadManpowerReportData(context: DataLoadingContext) {
  try {
    context.setIsManpowerReportLoading(true);
    const data = await loadManpowerReportDataService(context.stageCode, context.shiftCode, context.selectedDate);
    context.setManpowerReportData(data);
    
    // Also load submission status to check if attendance should be locked
    const { getReportingSubmissionStatus } = await import('./pageDataService');
    const submissionStatus = await getReportingSubmissionStatus(context.stageCode, context.selectedDate);
    context.setReportingSubmissionStatus(submissionStatus);
  } catch (error) {
    console.error('Error loading manpower report data:', error);
    context.setManpowerReportData([]);
    context.setReportingSubmissionStatus(null);
  } finally {
    context.setIsManpowerReportLoading(false);
  }
}

/**
 * Load draft report data
 */
export async function loadDraftReportData(context: DataLoadingContext) {
  try {
    context.setIsDraftReportLoading(true);
    const result = await loadDraftReportDataService(context.stageCode, context.selectedDate);
    context.setDraftReportData(result.workReports);
    context.setDraftManpowerReportData(result.manpowerReports);
    
    // Also load submission status
    const { getReportingSubmissionStatus } = await import('./pageDataService');
    const submissionStatus = await getReportingSubmissionStatus(context.stageCode, context.selectedDate);
    context.setReportingSubmissionStatus(submissionStatus);
  } catch (error) {
    console.error('Error loading draft report data:', error);
    context.setDraftReportData([]);
    context.setDraftManpowerReportData([]);
    context.setReportingSubmissionStatus(null);
  } finally {
    context.setIsDraftReportLoading(false);
  }
}

/**
 * Load report data
 */
export async function loadReportData(context: DataLoadingContext) {
  try {
    context.setIsReportLoading(true);
    const data = await loadReportDataService(context.stageCode, context.selectedDate);
    context.setReportData(data);
  } catch (error) {
    console.error('Error loading report data:', error);
    context.setReportData([]);
  } finally {
    context.setIsReportLoading(false);
  }
}

/**
 * Load shift break times
 */
export async function loadShiftBreakTimes(context: DataLoadingContext) {
  if (!context.selectedDate) {
    context.setShiftBreakTimes([]);
    return;
  }
  const data = await loadShiftBreakTimesData(context.selectedDate);
  context.setShiftBreakTimes(data);
}

