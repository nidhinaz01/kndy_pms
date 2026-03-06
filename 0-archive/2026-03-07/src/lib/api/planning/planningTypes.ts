// Planning API Types and Interfaces

export interface Holiday {
  id: number;
  dt_day: number;
  dt_month: string;
  dt_year: number;
  dt_value: string | null;
  created_dt: string;
  created_by: string;
  description: string;
  modified_by: string;
  modified_dt: string;
  is_active: boolean;
  is_deleted: boolean;
}

export interface HolidayFormData {
  dt_day: number;
  dt_month: string;
  dt_year: number;
  dt_value: string | null;
  description: string;
  is_active: boolean;
}

export interface HolidayStats {
  total: number;
  active: number;
  inactive: number;
  byYear: Record<number, number>;
}

export interface ProductionPlan {
  id: number;
  ppd_count: number;
  production_rate: number;
  pattern_cycle: number;
  pattern_data: number[];
  slot_configuration: SlotConfig[];
  dt_wef: string;
  created_by: string;
  created_dt: string;
}

export interface SlotConfig {
  day: number;
  slots: Array<{
    slot_order: number;
    entry_time: string;
  }>;
}

export interface ProductionPlanFormData {
  production_rate: number;
  dt_wef: string;
  pattern_cycle: number;
  pattern_data: number[];
  slot_configuration: SlotConfig[];
}

export interface ProductionTime {
  id: number;
  plan_id: number;
  slot_order: number;
  entry_time: string;
}

export interface ProductionTimeFormData {
  plan_id: number;
  slot_order: number;
  entry_time: string;
}

export interface ProductionPlanWithTimes extends ProductionPlan {
  times: ProductionTime[];
}

export interface ProductionPlanHistoryWithTimes extends ProductionPlan {
  his_id: number;
  times: ProductionTime[];
  end_date?: string;
}

export interface ProductionPlanStats {
  total: number;
  totalSlots: number;
  averageSlots: number;
}

export interface WorkOrderStageOrder {
  id: number;
  wo_type_name: string;
  plant_stage: string;
  order_no: number;
  lead_time_hours: number;
  created_by: string;
  created_dt: string;
}

export interface WorkOrderStageOrderFormData {
  wo_type_name: string;
  plant_stage: string;
  order_no: number;
  lead_time_hours: number;
}

export interface WorkOrderStageOrderStats {
  total: number;
  active: number;
  inactive: number;
  byType: Record<string, number>;
  byStage: Record<string, number>;
}

