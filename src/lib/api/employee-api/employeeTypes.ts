// Employee API Types and Interfaces

export interface Employee {
  id: number;
  emp_id: string;
  emp_cat: string;
  emp_name: string;
  skill_short: string;
  emp_doj: string;
  last_appraisal_date: string;
  basic_da: number;
  salary: number;
  stage: string;
  shift_code: string;
  modified_dt: string;
  modified_by: string;
  is_active: boolean;
  is_deleted: boolean;
  created_by: string;
  created_dt: string;
}

export interface EmployeeFormData {
  emp_id: string;
  emp_cat: string;
  emp_name: string;
  skill_short: string;
  emp_doj: string;
  last_appraisal_date: string;
  basic_da: number;
  salary: number;
  stage: string;
  shift_code: string;
  is_active?: boolean;
}

