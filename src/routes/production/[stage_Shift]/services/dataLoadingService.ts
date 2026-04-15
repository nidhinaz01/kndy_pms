import { loadWorkOrdersData as loadWorkOrdersDataService, loadWorksData as loadWorksDataService, loadPlannedWorksData as loadPlannedWorksDataService, loadManpowerPlanData as loadManpowerPlanDataService, loadDraftPlanData as loadDraftPlanDataService, loadManpowerReportData as loadManpowerReportDataService, loadDraftReportData as loadDraftReportDataService, loadShiftBreakTimesData } from './pageDataService';
import { loadReportData as loadReportDataService, calculatePlannedWorksStatus } from './reportDataService';
import { requestDeduplicator } from './requestDeduplication';
import { submissionStatusCache } from './submissionStatusCache';

/**
 * Track latest in-flight request per scope so stale responses do not overwrite
 * newer tab/date state.
 */
const latestRequestTokenByScope = new Map<string, number>();
let requestTokenCounter = 0;

function beginTrackedRequest(scope: string): number {
  requestTokenCounter += 1;
  latestRequestTokenByScope.set(scope, requestTokenCounter);
  return requestTokenCounter;
}

function isLatestRequest(scope: string, token: number): boolean {
  return latestRequestTokenByScope.get(scope) === token;
}

function logStaleDrop(scope: string, token: number): void {
  const latest = latestRequestTokenByScope.get(scope);
  console.debug(
    `[dataLoadingService] Dropping stale response for scope="${scope}" token=${token} latest=${latest}`
  );
}

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
 * Optimized: Uses request deduplication to prevent duplicate concurrent requests
 */
export async function loadWorkOrdersData(context: DataLoadingContext) {
  const requestKey = `work-orders:${context.stageCode}`;
  const scope = `loadWorkOrdersData:${context.stageCode}:${context.selectedDate}`;
  const token = beginTrackedRequest(scope);
  
  context.setIsWorkOrdersLoading(true);
  try {
    const data = await requestDeduplicator.getOrCreate(requestKey, () =>
      loadWorkOrdersDataService(context.stageCode, context.selectedDate)
    );
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setWorkOrdersData(data);
  } finally {
    if (isLatestRequest(scope, token)) {
      context.setIsWorkOrdersLoading(false);
    }
  }
}

/**
 * Load works data
 * Optimized: Uses request deduplication to prevent duplicate concurrent requests
 */
export async function loadWorksData(context: DataLoadingContext) {
  const requestKey = `works:${context.stageCode}`;
  const scope = `loadWorksData:${context.stageCode}:${context.selectedDate}`;
  const token = beginTrackedRequest(scope);
  
  context.setIsWorksLoading(true);
  try {
    const data = await requestDeduplicator.getOrCreate(requestKey, () =>
      loadWorksDataService(context.stageCode, context.selectedDate)
    );
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setWorksData(data);
  } finally {
    if (isLatestRequest(scope, token)) {
      context.setIsWorksLoading(false);
    }
  }
}

/**
 * Load planned works data
 * Optimized: Uses request deduplication to prevent duplicate concurrent requests
 */
export async function loadPlannedWorksData(context: DataLoadingContext) {
  const requestKey = `planned-works:${context.stageCode}:${context.shiftCode}:${context.selectedDate}`;
  const scope = `loadPlannedWorksData:${context.stageCode}:${context.shiftCode}:${context.selectedDate}`;
  const token = beginTrackedRequest(scope);
  
  context.setIsPlannedWorksLoading(true);
  try {
    const plannedWorks = await requestDeduplicator.getOrCreate(requestKey, () =>
      loadPlannedWorksDataService(context.stageCode, context.shiftCode, context.selectedDate)
    );
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setPlannedWorksData(plannedWorks);
    
    const statusKey = `planned-works-status:${context.stageCode}:${context.shiftCode}:${context.selectedDate}`;
    const worksWithStatus = await requestDeduplicator.getOrCreate(statusKey, () =>
      calculatePlannedWorksStatus(plannedWorks)
    );
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setPlannedWorksWithStatus(worksWithStatus);
  } finally {
    if (isLatestRequest(scope, token)) {
      context.setIsPlannedWorksLoading(false);
    }
  }
}

/**
 * Load manpower plan data
 */
export async function loadManpowerPlanData(context: DataLoadingContext) {
  const scope = `loadManpowerPlanData:${context.stageCode}:${context.shiftCode}:${context.selectedDate}`;
  const token = beginTrackedRequest(scope);
  console.log(`📊 loadManpowerPlanData (dataLoadingService) called with:`, {
    stageCode: context.stageCode,
    shiftCode: context.shiftCode,
    selectedDate: context.selectedDate,
    selectedDateType: typeof context.selectedDate
  });
  context.setIsManpowerPlanLoading(true);
  try {
    const data = await loadManpowerPlanDataService(context.stageCode, context.shiftCode, context.selectedDate);
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    console.log(`📊 loadManpowerPlanData (dataLoadingService): received ${data.length} employees`);
    context.setManpowerPlanData(data);
  } finally {
    if (isLatestRequest(scope, token)) {
      context.setIsManpowerPlanLoading(false);
    }
  }
}

/**
 * Load draft plan data
 */
export async function loadDraftPlanData(context: DataLoadingContext) {
  const scope = `loadDraftPlanData:${context.stageCode}:${context.shiftCode}:${context.selectedDate}`;
  const token = beginTrackedRequest(scope);
  context.setIsDraftPlanLoading(true);
  try {
    submissionStatusCache.clearForStageShiftDate(context.stageCode, context.shiftCode, context.selectedDate);
    const result = await loadDraftPlanDataService(context.stageCode, context.shiftCode, context.selectedDate);
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setDraftPlanData(result.workPlans);
    context.setDraftManpowerPlanData(result.manpowerPlans);
    
    // Also load submission status
    const { getPlanningSubmissionStatus } = await import('./pageDataService');
    const submissionStatus = await getPlanningSubmissionStatus(context.stageCode, context.shiftCode, context.selectedDate);
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setPlanningSubmissionStatus(submissionStatus);
  } finally {
    if (isLatestRequest(scope, token)) {
      context.setIsDraftPlanLoading(false);
    }
  }
}

/**
 * Load manpower report data
 */
export async function loadManpowerReportData(context: DataLoadingContext) {
  const scope = `loadManpowerReportData:${context.stageCode}:${context.shiftCode}:${context.selectedDate}`;
  const token = beginTrackedRequest(scope);
  try {
    context.setIsManpowerReportLoading(true);
    const data = await loadManpowerReportDataService(context.stageCode, context.shiftCode, context.selectedDate);
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setManpowerReportData(data);
    
    // Also load submission status to check if attendance should be locked
    const { getReportingSubmissionStatus } = await import('./pageDataService');
    const submissionStatus = await getReportingSubmissionStatus(context.stageCode, context.shiftCode, context.selectedDate);
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setReportingSubmissionStatus(submissionStatus);
  } catch (error) {
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    console.error('Error loading manpower report data:', error);
    context.setManpowerReportData([]);
    context.setReportingSubmissionStatus(null);
  } finally {
    if (isLatestRequest(scope, token)) {
      context.setIsManpowerReportLoading(false);
    }
  }
}

/**
 * Load draft report data
 */
export async function loadDraftReportData(context: DataLoadingContext) {
  const scope = `loadDraftReportData:${context.stageCode}:${context.shiftCode}:${context.selectedDate}`;
  const token = beginTrackedRequest(scope);
  try {
    context.setIsDraftReportLoading(true);
    submissionStatusCache.clearForStageShiftDate(context.stageCode, context.shiftCode, context.selectedDate);
    const result = await loadDraftReportDataService(context.stageCode, context.shiftCode, context.selectedDate);
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setDraftReportData(result.workReports);
    context.setDraftManpowerReportData(result.manpowerReports);
    
    // Also load submission status
    const { getReportingSubmissionStatus } = await import('./pageDataService');
    const submissionStatus = await getReportingSubmissionStatus(context.stageCode, context.shiftCode, context.selectedDate);
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setReportingSubmissionStatus(submissionStatus);
  } catch (error) {
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    console.error('Error loading draft report data:', error);
    context.setDraftReportData([]);
    context.setDraftManpowerReportData([]);
    context.setReportingSubmissionStatus(null);
  } finally {
    if (isLatestRequest(scope, token)) {
      context.setIsDraftReportLoading(false);
    }
  }
}

/**
 * Load report data
 */
export async function loadReportData(context: DataLoadingContext) {
  const scope = `loadReportData:${context.stageCode}:${context.shiftCode}:${context.selectedDate}`;
  const token = beginTrackedRequest(scope);
  try {
    context.setIsReportLoading(true);
    const data = await loadReportDataService(context.stageCode, context.shiftCode, context.selectedDate);
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    context.setReportData(data);
  } catch (error) {
    if (!isLatestRequest(scope, token)) {
      logStaleDrop(scope, token);
      return;
    }
    console.error('Error loading report data:', error);
    context.setReportData([]);
  } finally {
    if (isLatestRequest(scope, token)) {
      context.setIsReportLoading(false);
    }
  }
}

/**
 * Load shift break times
 */
export async function loadShiftBreakTimes(context: DataLoadingContext) {
  const scope = `loadShiftBreakTimes:${context.selectedDate}`;
  const token = beginTrackedRequest(scope);
  if (!context.selectedDate) {
    context.setShiftBreakTimes([]);
    return;
  }
  const data = await loadShiftBreakTimesData(context.selectedDate);
  if (!isLatestRequest(scope, token)) {
    logStaleDrop(scope, token);
    return;
  }
  context.setShiftBreakTimes(data);
}

