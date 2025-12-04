import { supabase } from '$lib/supabaseClient';
import type { WorkOrderDropdownOptions, DataElement, ModelOption } from '$lib/types/workOrder';

interface DropdownConfig {
  key: keyof WorkOrderDropdownOptions;
  filter: string;
  limit?: number;
}

const DROPDOWN_CONFIG: DropdownConfig[] = [
  { key: 'typeOptions', filter: 'type code' },
  { key: 'chassisOptions', filter: 'wo_chassis' },
  { key: 'bodyWidthOptions', filter: 'wo_body_width' },
  { key: 'heightOptions', filter: 'wo_height' },
  { key: 'wheelbaseOptions', filter: 'wo_wheelbase' },
  { key: 'voltageOptions', filter: 'wo_voltage' },
  { key: 'passengerDoorNosOptions', filter: 'wo_passenger_door_nos' },
  { key: 'emergencyDoorNosOptions', filter: 'wo_emergency_door_nos' },
  { key: 'airVentilationNosOptions', filter: 'wo_air_ventilation_nos' },
  { key: 'doorPositionFrontOptions', filter: 'wo_door_position_front' },
  { key: 'doorPositionRearOptions', filter: 'wo_door_position_rear' },
  { key: 'escapeHatchOptions', filter: 'wo_escape_hatch' },
  { key: 'sideVentilationOptions', filter: 'wo_side_ventilation' },
  { key: 'frontOptions', filter: 'wo_front' },
  { key: 'frontGlassOptions', filter: 'wo_front_glass' },
  { key: 'rearOptions', filter: 'wo_rear' },
  { key: 'rearGlassOptions', filter: 'wo_rear_glass' },
  { key: 'paintOptions', filter: 'wo_paint' },
  { key: 'platformOptions', filter: 'wo_platform' },
  { key: 'sidePanelOptions', filter: 'wo_inside_side_panel' },
  { key: 'topPanelOptions', filter: 'wo_inside_top_panel' },
  { key: 'grabRailsOptions', filter: 'wo_inside_grab_rails' },
  { key: 'luggageRackOptions', filter: 'wo_inside_luggage_rack' },
  { key: 'seatTypeOptions', filter: 'wo_seat_type' },
  { key: 'seatFabricsOptions', filter: 'wo_seat_fabrics' },
  { key: 'noOfSeatsOptions', filter: 'wo_no_of_seats' },
  { key: 'seatConfigurationOptions', filter: 'wo_seat_configuration' },
  { key: 'wiperOptions', filter: 'wo_wiper' },
  { key: 'routeBoardOptions', filter: 'wo_route_board' },
  { key: 'soundSystemOptions', filter: 'wo_sound_system' },
  { key: 'driverCabinPartitionOptions', filter: 'wo_driver_cabin_partition' },
  { key: 'recordBoxNosOptions', filter: 'wo_record_box_nos' },
  { key: 'fireExtinguisherOptions', filter: 'wo_fire_extinguisher_kg' },
  { key: 'stepneyOptions', filter: 'wo_stepney' },
  { key: 'dickeyOptions', filter: 'wo_dickey' },
  { key: 'additionalRequirementsOptions', filter: '%additional%' },
  { key: 'gstTaxRateOptions', filter: 'tax gst', limit: 1 },
  { key: 'cessTaxRateOptions', filter: 'tax cess', limit: 1 }
];

async function loadDropdownOption(config: DropdownConfig): Promise<{ key: string; data: DataElement[] }> {
  let query = supabase
    .from('sys_data_elements')
    .select('de_value, de_name')
    .ilike('de_name', config.filter)
    .eq('is_active', true);

  if (config.limit) {
    query = query.limit(config.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const sortedData = (data || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

  return {
    key: config.key,
    data: sortedData
  };
}

export async function loadAllDropdownData(): Promise<WorkOrderDropdownOptions> {
  try {
    const results = await Promise.all(
      DROPDOWN_CONFIG.map(config => loadDropdownOption(config))
    );

    const options: Partial<WorkOrderDropdownOptions> = {};
    results.forEach(({ key, data }) => {
      (options as any)[key] = data;
    });

    // Load model options separately
    const { data: modelData, error: modelError } = await supabase
      .from('mstr_wo_type')
      .select('wo_type_name, wo_type_code, wo_comfort_level, wo_capacity, wo_carrier_type')
      .eq('is_active', true)
      .order('wo_type_name');

    if (modelError) throw modelError;

    return {
      ...options,
      modelOptions: (modelData || []) as ModelOption[]
    } as WorkOrderDropdownOptions;
  } catch (error) {
    console.error('Error loading dropdown data:', error);
    throw error;
  }
}

