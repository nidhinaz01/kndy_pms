import type { WorkOrderFormData, ValidationResult } from '$lib/types/workOrder';

type ValidationRule = {
  field: string;
  required?: boolean;
  trim?: boolean;
  min?: number;
  message?: string;
  custom?: (data: WorkOrderFormData) => string | { field: string; message: string } | null;
};

const VALIDATION_SCHEMA: Record<number, ValidationRule[]> = {
  1: [
    {
      field: 'wo_pwo',
      custom: (data) => {
        if (!data.wo_no && !data.pwo_no) {
          return 'Either WO Number or PWO Number is required';
        }
        return null;
      }
    },
    { field: 'customer_name', required: true, trim: true },
    { field: 'wo_model', required: true },
    {
      field: 'wo_date',
      required: true,
      message: 'Date WO placed is required',
      custom: (data) => {
        if (!data.wo_date) return null; // required check handles this
        const selectedDate = new Date(data.wo_date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (selectedDate > today) {
          return 'Date cannot be in the future';
        }
        return null;
      }
    }
  ],
  2: [
    { field: 'wo_chassis', required: true },
    { field: 'body_width_mm', required: true },
    { field: 'height', required: true },
    { field: 'wheel_base', required: true },
    { field: 'voltage', required: true }
  ],
  3: [
    { field: 'passenger_door_nos', required: true },
    { field: 'emergency_door_nos', required: true },
    { field: 'air_ventilation_nos', required: true },
    { field: 'door_position_front', required: true },
    { field: 'door_position_rear', required: true },
    { field: 'escape_hatch', required: true },
    { field: 'side_ventilation', required: true }
  ],
  4: [
    { field: 'front', required: true },
    { field: 'front_glass', required: true },
    { field: 'rear', required: true },
    { field: 'rear_glass', required: true },
    { field: 'paint', required: true }
  ],
  5: [
    { field: 'platform', required: true },
    { field: 'inside_side_panel', required: true },
    { field: 'inside_top_panel', required: true },
    { field: 'inside_grab_rails', required: true },
    { field: 'inside_luggage_rack', required: true }
  ],
  6: [
    { field: 'seat_type', required: true },
    { field: 'seat_fabrics', required: true },
    { field: 'no_of_seats', required: true },
    { field: 'seat_configuration', required: true }
  ],
  7: [
    { field: 'wiper', required: true },
    { field: 'route_board', required: true },
    { field: 'sound_system', required: true },
    { field: 'driver_cabin_partition', required: true },
    { field: 'record_box_nos', required: true },
    { field: 'fire_extinguisher_kg', required: true },
    { field: 'stepney', required: true },
    { field: 'dickey', required: true }
  ],
  8: [
    {
      field: 'additional_requirements',
      custom: (data) => {
        for (let i = 0; i < data.additional_requirements.length; i++) {
          const row = data.additional_requirements[i];
          if (row.work_details) {
            if (!row.work_qty || row.work_qty <= 0) {
              return { field: `work_qty_${i}`, message: 'Quantity must be greater than 0' };
            }
            if (!row.work_rate || row.work_rate <= 0) {
              return { field: `work_rate_${i}`, message: 'Rate must be greater than 0' };
            }
          }
        }
        return null;
      }
    }
  ],
  9: [
    {
      field: 'work_order_cost',
      required: true,
      min: 0,
      message: 'WO Cost must be a valid positive number'
    }
  ],
  10: [
    {
      field: 'confirmation',
      required: true,
      message: 'You must confirm that all information is correct before creating the work order'
    }
  ]
};

export function validateSection(section: number, formData: WorkOrderFormData): ValidationResult {
  const rules = VALIDATION_SCHEMA[section] || [];
  const errors: Record<string, string> = {};

  for (const rule of rules) {
    // Check custom validation first
    if (rule.custom) {
      const result = rule.custom(formData);
      if (result) {
        if (typeof result === 'string') {
          errors[rule.field] = result;
        } else {
          errors[result.field] = result.message;
        }
        // If custom validation found an error, skip required check
        continue;
      }
    }
    
    // Check required validation (even if custom function exists and returned null)
    if (rule.required) {
      const value = (formData as any)[rule.field];
      if (value === null || value === undefined || value === '') {
        errors[rule.field] = rule.message || `${rule.field} is required`;
      } else if (rule.trim && typeof value === 'string' && !value.trim()) {
        errors[rule.field] = rule.message || `${rule.field} is required`;
      } else if (rule.min !== undefined && (typeof value === 'number' && value < rule.min)) {
        errors[rule.field] = rule.message || `${rule.field} must be at least ${rule.min}`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function getSectionFields(section: number): string[] {
  const rules = VALIDATION_SCHEMA[section] || [];
  return rules.map(rule => rule.field);
}

export function hasSectionErrors(section: number, errors: Record<string, string>): boolean {
  const sectionFields = getSectionFields(section);
  return sectionFields.some(field => errors[field]);
}

