import { calculateWorkingDays } from '$lib/api/holidays';
import { formatDateLocal } from '$lib/utils/formatDate';

/**
 * Calculate working days difference between planned and actual dates
 */
export async function getDateDifference(plannedDate: string, actualDate: string | null): Promise<number> {
  const planned = new Date(plannedDate);
  const today = new Date();
  
  if (!actualDate) {
    if (planned.getTime() <= today.getTime()) {
      try {
        const workingDays = await calculateWorkingDays(planned, today);
        return workingDays;
      } catch (error) {
        console.error('Error calculating working days:', error);
        const diffTime = today.getTime() - planned.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }
    return 0;
  }
  
  const actual = new Date(actualDate);
  try {
    const workingDays = await calculateWorkingDays(planned, actual);
    return workingDays;
  } catch (error) {
    console.error('Error calculating working days:', error);
    const diffTime = actual.getTime() - planned.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

/**
 * Get color class based on days difference
 */
export function getDateColor(daysDiff: number): string {
  if (daysDiff === 0) return 'text-green-600';
  if (daysDiff <= 2) return 'text-yellow-600';
  if (daysDiff <= 5) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Get row background color class based on days difference
 */
export function getRowBackgroundColor(daysDiff: number): string {
  if (daysDiff === 0) return 'on-time';
  if (daysDiff <= 2) return 'slight-delay';
  if (daysDiff <= 5) return 'moderate-delay';
  return 'significant-delay';
}

/**
 * Format date string for display
 */
export function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  return formatDateLocal(dateString);
}

/**
 * Get planned start date from work order
 */
export function getPlannedStartDate(workOrder: any): string {
  const firstEntry = workOrder.entryDates?.[0];
  return firstEntry ? formatDate(firstEntry.planned_date) : 'N/A';
}

/**
 * Get planned end date from work order
 */
export function getPlannedEndDate(workOrder: any): string {
  const lastExit = workOrder.exitDates?.[workOrder.exitDates?.length - 1];
  return lastExit ? formatDate(lastExit.planned_date) : 'N/A';
}

/**
 * Get actual start date from work order
 */
export function getActualStartDate(workOrder: any): string {
  if (workOrder.actualStartDate) {
    return formatDate(workOrder.actualStartDate);
  }
  
  const firstActualEntry = workOrder.entryDates?.find((entry: any) => entry.actual_date);
  return firstActualEntry ? formatDate(firstActualEntry.actual_date) : 'N/A';
}

/**
 * Get actual end date from work order
 */
export function getActualEndDate(workOrder: any): string {
  const lastActualExit = workOrder.exitDates?.find((exit: any) => exit.actual_date);
  return lastActualExit ? formatDate(lastActualExit.actual_date) : 'N/A';
}

/**
 * Get document release date for current stage
 */
export function getDocumentReleaseDate(workOrder: any, stageCode: string): string {
  const docRelease = workOrder.documentReleaseDates?.find((doc: any) => 
    doc.stage_code === stageCode && doc.actual_date
  );
  return docRelease ? formatDate(docRelease.actual_date) : 'N/A';
}

/**
 * Get current stage from work order
 */
export function getCurrentStage(workOrder: any): string {
  return workOrder.currentStage || 'N/A';
}

/**
 * Get work order status
 */
export function getWorkOrderStatus(workOrder: any): { status: string, color: string } {
  const hasActualStart = getActualStartDate(workOrder) !== 'N/A';
  const hasActualEnd = getActualEndDate(workOrder) !== 'N/A';
  
  if (!hasActualStart) {
    return { status: 'Not Started', color: 'text-red-600 dark:text-red-400' };
  } else if (hasActualStart && !hasActualEnd) {
    return { status: 'In Progress', color: 'text-yellow-600 dark:text-yellow-400' };
  } else {
    return { status: 'Completed', color: 'text-green-600 dark:text-green-400' };
  }
}

