// Planning API - Re-export all functions and types for backward compatibility
// This file has been refactored into multiple service files under ./planning/

// Types
export type {
  Holiday,
  HolidayFormData,
  HolidayStats,
  ProductionPlan,
  SlotConfig,
  ProductionPlanFormData,
  ProductionTime,
  ProductionTimeFormData,
  ProductionPlanWithTimes,
  ProductionPlanHistoryWithTimes,
  ProductionPlanStats,
  WorkOrderStageOrder,
  WorkOrderStageOrderFormData,
  WorkOrderStageOrderStats
} from './planning/planningTypes';

// Utils
export { calculatePattern, validatePattern } from './planning/planningUtils';

// Holiday Services
export {
  fetchHolidays,
  saveHoliday,
  updateHoliday,
  deleteHoliday,
  getHolidayStats,
  addSundaysForYear,
  importHolidays
} from './planning/planningHolidayService';

// Production Plan Services
export {
  fetchProductionPlans,
  fetchProductionPlanWithTimes,
  fetchCurrentProductionPlanWithTimes,
  fetchProductionPlanHistory
} from './planning/planningProductionPlanFetchService';

export {
  saveProductionPlan,
  updateProductionPlan,
  updateProductionPlanByDate,
  deleteProductionPlan,
  getProductionPlanStats
} from './planning/planningProductionPlanService';

// Work Order Stage Order Services
export {
  fetchWorkOrderTypes,
  fetchPlantStages,
  fetchWorkOrderStageOrders,
  checkWorkOrderStageOrderExists,
  saveWorkOrderStageOrder,
  updateWorkOrderStageOrder,
  deleteWorkOrderStageOrder,
  getWorkOrderStageOrderStats
} from './planning/planningWorkOrderStageOrderService';
