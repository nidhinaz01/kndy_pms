// P1S2-General Page Types

export interface GroupedPlannedWork {
  workCode: string;
  workName: string;
  woNo: string;
  pwoNo: string;
  items: any[];
}

export interface GroupedReportWork {
  workCode: string;
  workName: string;
  woNo: string;
  pwoNo: string;
  items: any[];
  hasLostTime: boolean;
  totalLostTime: number;
}

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
}

export interface WorkOrderData {
  sales_order_id: number;
  prdn_wo_details: {
    id: number;
    wo_no: string | null;
    pwo_no: string | null;
    wo_model: string;
    customer_name: string;
  };
  entryDates: Array<{
    planned_date: string;
    actual_date: string | null;
    stage_code: string;
  }>;
  exitDates: Array<{
    planned_date: string;
    actual_date: string | null;
    stage_code: string;
  }>;
  actualStartDate?: string;
  workingDaysDiff?: number;
  endWorkingDaysDiff?: number;
  currentStage?: string;
}

