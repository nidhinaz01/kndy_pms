// Work Order Types and Interfaces

export interface DataElement {
  de_value: string;
  de_name: string;
}

export interface ModelOption {
  wo_type_name: string;
  wo_type_code: string;
  wo_comfort_level: string;
  wo_capacity: string;
  wo_carrier_type: string;
}

export interface AdditionalRequirement {
  work_details: string;
  work_qty: number;
  work_rate: number;
  amount: number;
}

export interface WorkOrderFormData {
  // Work Order Details
  wo_no: string;
  pwo_no: string;
  wo_type: string;
  wo_model: string;
  wo_date: string;
  customer_name: string;
  wo_comfort_level: string;
  wo_capacity: string;
  wo_carrier_type: string;
  
  // Chassis Related
  wo_chassis: string;
  wheel_base: string;
  model_rate: number;
  
  // Openings
  body_width_mm: string;
  height: string;
  air_ventilation_nos: string;
  escape_hatch: string;
  front: string;
  rear: string;
  front_glass: string;
  emergency_door_nos: string;
  
  // Exterior
  platform: string;
  inside_grab_rails: string;
  paint: string;
  fire_extinguisher_kg: string;
  wiper: string;
  stepney: string;
  record_box_nos: string;
  route_board: string;
  rear_glass: string;
  driver_cabin_partition: string;
  voltage: string;
  
  // Interior
  inside_top_panel: string;
  inside_side_panel: string;
  inside_luggage_rack: string;
  sound_system: string;
  
  // Seats
  seat_type: string;
  no_of_seats: string;
  seat_configuration: string;
  seat_fabrics: string;
  
  // Others
  dickey: string;
  passenger_door_nos: string;
  side_ventilation: string;
  door_position_front: string;
  door_position_rear: string;
  
  // Additional Requirements
  wo_prdn_start: string;
  wo_prdn_end: string;
  wo_delivery: string;
  additional_requirements: AdditionalRequirement[];
  
  // Costs
  work_order_cost: number;
  gst: number;
  cess: number;
  total_cost: number;
  
  // Tax Rates
  gst_tax_rate: string;
  cess_tax_rate: string;
  
  // Confirmation
  confirmation: boolean;
}

export interface WorkOrderDropdownOptions {
  typeOptions: DataElement[];
  modelOptions: ModelOption[];
  chassisOptions: DataElement[];
  bodyWidthOptions: DataElement[];
  heightOptions: DataElement[];
  wheelbaseOptions: DataElement[];
  voltageOptions: DataElement[];
  passengerDoorNosOptions: DataElement[];
  emergencyDoorNosOptions: DataElement[];
  airVentilationNosOptions: DataElement[];
  doorPositionFrontOptions: DataElement[];
  doorPositionRearOptions: DataElement[];
  escapeHatchOptions: DataElement[];
  sideVentilationOptions: DataElement[];
  frontOptions: DataElement[];
  frontGlassOptions: DataElement[];
  rearOptions: DataElement[];
  rearGlassOptions: DataElement[];
  paintOptions: DataElement[];
  platformOptions: DataElement[];
  sidePanelOptions: DataElement[];
  topPanelOptions: DataElement[];
  grabRailsOptions: DataElement[];
  luggageRackOptions: DataElement[];
  seatTypeOptions: DataElement[];
  seatFabricsOptions: DataElement[];
  noOfSeatsOptions: DataElement[];
  seatConfigurationOptions: DataElement[];
  wiperOptions: DataElement[];
  routeBoardOptions: DataElement[];
  soundSystemOptions: DataElement[];
  driverCabinPartitionOptions: DataElement[];
  recordBoxNosOptions: DataElement[];
  fireExtinguisherOptions: DataElement[];
  stepneyOptions: DataElement[];
  dickeyOptions: DataElement[];
  additionalRequirementsOptions: DataElement[];
  gstTaxRateOptions: DataElement[];
  cessTaxRateOptions: DataElement[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const initialFormData: WorkOrderFormData = {
  wo_no: '',
  pwo_no: '',
  wo_type: '',
  wo_model: '',
  wo_date: new Date().toISOString().split('T')[0],
  customer_name: '',
  wo_comfort_level: '',
  wo_capacity: '',
  wo_carrier_type: '',
  wo_chassis: '',
  wheel_base: '',
  model_rate: 0,
  body_width_mm: '',
  height: '',
  air_ventilation_nos: '',
  escape_hatch: '',
  front: '',
  rear: '',
  front_glass: '',
  emergency_door_nos: '',
  platform: '',
  inside_grab_rails: '',
  paint: '',
  fire_extinguisher_kg: '',
  wiper: '',
  stepney: '',
  record_box_nos: '',
  route_board: '',
  rear_glass: '',
  driver_cabin_partition: '',
  voltage: '',
  inside_top_panel: '',
  inside_side_panel: '',
  inside_luggage_rack: '',
  sound_system: '',
  seat_type: '',
  no_of_seats: '',
  seat_configuration: '',
  seat_fabrics: '',
  dickey: '',
  passenger_door_nos: '',
  side_ventilation: '',
  door_position_front: '',
  door_position_rear: '',
  wo_prdn_start: '',
  wo_prdn_end: '',
  wo_delivery: '',
  additional_requirements: [{ work_details: '', work_qty: 1, work_rate: 0, amount: 0 }],
  work_order_cost: 0,
  gst: 0,
  cess: 0,
  total_cost: 0,
  gst_tax_rate: '',
  cess_tax_rate: '',
  confirmation: false
};

