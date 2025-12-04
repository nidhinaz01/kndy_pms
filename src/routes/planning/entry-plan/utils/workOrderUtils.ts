import { formatDate, formatDateTimeLocal, getDateDifference, getWorkingDaysDifference, getDateColor } from './dateUtils';

export function getWorkOrderDates(workOrder: any, productionDates: any[]) {
  const woDates = productionDates.filter(d => d.sales_order_id === workOrder.id);
  return {
    chassisArrival: woDates.find(d => d.date_type === 'chassis_arrival'),
    rndDocuments: woDates.find(d => d.date_type === 'rnd_documents'),
    entryDates: woDates.filter(d => d.date_type === 'entry').sort((a, b) => a.planned_date.localeCompare(b.planned_date)),
    exitDates: woDates.filter(d => d.date_type === 'exit').sort((a, b) => a.planned_date.localeCompare(b.planned_date)),
    finalInspection: woDates.find(d => d.date_type === 'final_inspection'),
    delivery: woDates.find(d => d.date_type === 'delivery')
  };
}

export function isWorkOrderInTab(workOrder: any, tabId: string, productionDates: any[]): boolean {
  const woDates = productionDates.filter(d => d.sales_order_id === workOrder.id);
  
  const chassisArrival = woDates.find(d => d.date_type === 'chassis_arrival');
  const rndDocuments = woDates.find(d => d.date_type === 'rnd_documents');
  const allEntryDates = woDates.filter(d => d.date_type === 'entry');
  const allExitDates = woDates.filter(d => d.date_type === 'exit');
  const finalInspection = woDates.find(d => d.date_type === 'final_inspection');
  const delivery = woDates.find(d => d.date_type === 'delivery');
  
  switch (tabId) {
    case 'to-be-planned':
      return woDates.length === 0;
      
    case 'chassis-to-be-received':
      return chassisArrival?.planned_date && !chassisArrival?.actual_date;
      
    case 'documents-to-be-released':
      return rndDocuments?.planned_date && !rndDocuments?.actual_date;
      
    case 'wip':
      return allEntryDates.length > 0;
      
    case 'to-be-inspected':
      return finalInspection?.planned_date && !finalInspection?.actual_date;
      
    case 'to-be-delivered':
      return delivery?.planned_date && !delivery?.actual_date;
      
    default:
      return false;
  }
}

export function isWorkOrderInStage(workOrder: any, stage: string, productionDates: any[]): boolean {
  const woDates = productionDates.filter(d => d.sales_order_id === workOrder.id);
  const stageEntry = woDates.find(d => d.date_type === 'entry' && d.stage_code === stage);
  const stageExit = woDates.find(d => d.date_type === 'exit' && d.stage_code === stage);
  
  return stageEntry?.actual_date && !stageExit?.actual_date;
}

export function getCurrentStage(workOrder: any, productionDates: any[]): string {
  const dates = getWorkOrderDates(workOrder, productionDates);
  const currentEntry = dates.entryDates.find(entry => 
    entry.actual_date && 
    !dates.exitDates.find(exit => 
      exit.stage_code === entry.stage_code && exit.actual_date
    )
  );
  return currentEntry?.stage_code || 'N/A';
}

export function getTabDateComparison(
  workOrder: any,
  tabId: string,
  productionDates: any[],
  holidays: any[]
): { planned: string; actual: string; diff: number; color: string } {
  const dates = getWorkOrderDates(workOrder, productionDates);
  
  switch (tabId) {
    case 'chassis-to-be-received':
      if (!dates.chassisArrival) {
        return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
      }
      const planned = formatDate(dates.chassisArrival.planned_date);
      const actual = dates.chassisArrival.actual_date ? formatDate(dates.chassisArrival.actual_date) : 'N/A';
      const diff = getWorkingDaysDifference(dates.chassisArrival.planned_date, dates.chassisArrival.actual_date, holidays);
      return { planned, actual, diff, color: getDateColor(diff) };
      
    case 'documents-to-be-released':
      if (!dates.rndDocuments) {
        return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
      }
      const plannedDoc = formatDate(dates.rndDocuments.planned_date);
      const actualDoc = dates.rndDocuments.actual_date ? formatDate(dates.rndDocuments.actual_date) : 'N/A';
      const diffDoc = getWorkingDaysDifference(dates.rndDocuments.planned_date, dates.rndDocuments.actual_date, holidays);
      return { planned: plannedDoc, actual: actualDoc, diff: diffDoc, color: getDateColor(diffDoc) };
      
    case 'to-be-inspected':
      if (!dates.finalInspection) {
        return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
      }
      const plannedInsp = formatDateTimeLocal(dates.finalInspection.planned_date);
      const actualInsp = dates.finalInspection.actual_date ? formatDate(dates.finalInspection.actual_date) : 'N/A';
      const diffInsp = getWorkingDaysDifference(dates.finalInspection.planned_date, dates.finalInspection.actual_date, holidays);
      return { planned: plannedInsp, actual: actualInsp, diff: diffInsp, color: getDateColor(diffInsp) };
      
    case 'to-be-delivered':
      if (!dates.delivery) {
        return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
      }
      const plannedDel = formatDateTimeLocal(dates.delivery.planned_date);
      const actualDel = dates.delivery.actual_date ? formatDate(dates.delivery.actual_date) : 'N/A';
      const diffDel = getWorkingDaysDifference(dates.delivery.planned_date, dates.delivery.actual_date, holidays);
      return { planned: plannedDel, actual: actualDel, diff: diffDel, color: getDateColor(diffDel) };
      
    case 'wip':
      const firstEntry = dates.entryDates[0];
      const firstActualEntry = dates.entryDates.find(entry => entry.actual_date);
      
      if (!firstEntry) {
        return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
      }

      const plannedWip = formatDateTimeLocal(firstEntry.planned_date);
      const actualWip = firstActualEntry ? formatDate(firstActualEntry.actual_date) : 'N/A';
      const diffWip = getWorkingDaysDifference(firstEntry.planned_date, firstActualEntry?.actual_date || null, holidays);
      return { planned: plannedWip, actual: actualWip, diff: diffWip, color: getDateColor(diffWip) };
      
    default:
      return { planned: 'N/A', actual: 'N/A', diff: 0, color: 'text-gray-600' };
  }
}

