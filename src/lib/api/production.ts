// Production API - Re-export all functions and types for backward compatibility
// This file has been refactored into multiple service files under ./production/

// Types
export type {
  ProductionEmployee,
  ShiftSchedule,
  WorkPlanning,
  WorkReporting,
  CreateWorkPlanningData,
  ProductionWork
} from './production/productionTypes';

// Employee Services
export { fetchProductionEmployees } from './production/productionEmployeeFetchService';
export {
  markAttendance,
  reassignEmployee,
  getEmployeeCurrentStage,
  getEmployeeStageJourney
} from './production/productionEmployeeAttendanceService';

// Shift Services
export {
  fetchShiftSchedule,
  fetchAvailableStages,
  fetchShiftDetails
} from './production/productionShiftService';

// Work Fetch Services
export { fetchProductionWorks } from './production/productionWorkFetchService';

// Work Planning Services
export {
  createWorkPlanning,
  fetchWorkPlanning,
  updateWorkPlanning,
  deleteWorkPlanning
} from './production/productionWorkPlanningService';

// Work Validation Services
export { canPlanWork } from './production/productionWorkValidationService';

// Work Removal Services
export { removeWorkFromProduction } from './production/productionWorkRemovalService';

// Work Order Services
export {
  getAvailableStandardWorks,
  getNextNonStandardWorkCode,
  getSkillCombinations
} from './production/productionWorkOrderService';

// Work Addition Services
export { addWorkToProduction } from './production/productionWorkAdditionService';
