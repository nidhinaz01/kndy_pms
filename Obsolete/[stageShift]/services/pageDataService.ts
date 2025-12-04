import { loadStageWorkOrders, loadStageWorks, loadStagePlannedWorks, loadStageManpower, loadShiftBreakTimes } from '../../services/stageProductionService';
import { getDraftWorkPlans, getDraftManpowerPlans, getDraftWorkReports, getDraftManpowerReports } from '$lib/api/production/planningReportingService';

/**
 * Load work orders data
 */
export async function loadWorkOrdersData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    console.log(`🔍 Loading work orders for ${stageCode} on date: ${selectedDate}`);
    const data = await loadStageWorkOrders(stageCode, selectedDate);
    console.log(`📦 Active Work Orders found for ${stageCode} on ${selectedDate}:`, data.length);
    return data;
  } catch (error) {
    console.error('Error loading work orders data:', error);
    return [];
  }
}

/**
 * Load works data
 */
export async function loadWorksData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    return await loadStageWorks(stageCode, selectedDate);
  } catch (error) {
    console.error('Error loading works data:', error);
    return [];
  }
}

/**
 * Load planned works data
 */
export async function loadPlannedWorksData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    let dateStr: string;
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else if (selectedDate && typeof selectedDate === 'object' && 'toISOString' in selectedDate) {
      dateStr = (selectedDate as Date).toISOString().split('T')[0];
    } else {
      dateStr = String(selectedDate || '').split('T')[0];
    }
    
    const data = await loadStagePlannedWorks(stageCode, dateStr, 'approved');
    console.log(`📋 Loaded ${data.length} planned works for ${stageCode} on ${dateStr}`);
    return data;
  } catch (error) {
    console.error('Error loading planned works data:', error);
    return [];
  }
}

/**
 * Load manpower plan data
 */
export async function loadManpowerPlanData(stageCode: string, shiftCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const dateStr = nextDate.toISOString().split('T')[0];
    return await loadStageManpower(stageCode, shiftCode, dateStr, 'planning');
  } catch (error) {
    console.error('Error loading manpower plan data:', error);
    return [];
  }
}

/**
 * Load manpower report data
 */
export async function loadManpowerReportData(stageCode: string, shiftCode: string, selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    let dateStr: string;
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else {
      dateStr = new Date(selectedDate).toISOString().split('T')[0];
    }
    return await loadStageManpower(stageCode, shiftCode, dateStr, 'reporting');
  } catch (error) {
    console.error('Error loading manpower report data:', error);
    return [];
  }
}

/**
 * Load draft plan data
 */
export async function loadDraftPlanData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return { workPlans: [], manpowerPlans: [] };
  
  try {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const dateStr = nextDate.toISOString().split('T')[0];
    
    const [workPlans, manpowerPlans] = await Promise.all([
      getDraftWorkPlans(stageCode, dateStr),
      getDraftManpowerPlans(stageCode, dateStr)
    ]);
    
    return { workPlans, manpowerPlans };
  } catch (error) {
    console.error('Error loading draft plan data:', error);
    return { workPlans: [], manpowerPlans: [] };
  }
}

/**
 * Load draft report data
 */
export async function loadDraftReportData(stageCode: string, selectedDate: string) {
  if (!selectedDate) return { workReports: [], manpowerReports: [] };
  
  try {
    let dateStr: string;
    if (typeof selectedDate === 'string') {
      dateStr = selectedDate.split('T')[0];
    } else {
      dateStr = new Date(selectedDate).toISOString().split('T')[0];
    }
    
    const [workReports, manpowerReports] = await Promise.all([
      getDraftWorkReports(stageCode, dateStr),
      getDraftManpowerReports(stageCode, dateStr)
    ]);
    
    return { workReports, manpowerReports };
  } catch (error) {
    console.error('Error loading draft report data:', error);
    return { workReports: [], manpowerReports: [] };
  }
}

/**
 * Load shift break times
 */
export async function loadShiftBreakTimesData(selectedDate: string) {
  if (!selectedDate) return [];
  
  try {
    return await loadShiftBreakTimes(selectedDate);
  } catch (error) {
    console.error('Error loading shift break times:', error);
    return [];
  }
}

