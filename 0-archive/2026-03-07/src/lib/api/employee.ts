// Employee API - Re-export all functions and types for backward compatibility
// This file has been refactored into multiple service files under ./employee-api/

// Types
export type { Employee } from './employee-api/employeeTypes';

// Dropdown Services
export {
  fetchEmployeeCategories,
  fetchSkillShorts,
  fetchStages,
  fetchShifts
} from './employee-api/employeeDropdownService';

// Employee Services
export {
  fetchEmployees,
  saveEmployee,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus
} from './employee-api/employeeService';

// Utility Functions
export { checkEmployeeIdExists } from './employee-api/employeeUtils';

// Import/Export Services
export {
  exportTemplate,
  importEmployees
} from './employee-api/employeeImportExportService';
