export function getDateDifference(plannedDate: string, actualDate: string | null): number {
  if (!actualDate) return 0;
  const planned = new Date(plannedDate);
  const actual = new Date(actualDate);
  const diffTime = actual.getTime() - planned.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDateColor(daysDiff: number): string {
  if (daysDiff === 0) return 'text-green-600';
  if (daysDiff <= 2) return 'text-yellow-600';
  if (daysDiff <= 5) return 'text-orange-600';
  return 'text-red-600';
}

export function getRowBackgroundColor(daysDiff: number): string {
  if (daysDiff === 0) return 'on-time';
  if (daysDiff <= 2) return 'slight-delay';
  if (daysDiff <= 5) return 'moderate-delay';
  return 'significant-delay';
}

export function validateInspectionForm(
  form: { inspection_date: string; inspector_name: string },
  selectedTemplate: any,
  fieldResponses: Record<string, any>
): string[] {
  const errors: string[] = [];

  // Validate basic inspection form fields
  if (!form.inspection_date) {
    errors.push('• Inspection Date is required');
  }
  if (!form.inspector_name?.trim()) {
    errors.push('• Inspector Name is required');
  }

  // Validate template fields
  if (selectedTemplate?.sys_chassis_receival_template_fields) {
    selectedTemplate.sys_chassis_receival_template_fields.forEach((field: any) => {
      if (field.is_required) {
        const fieldValue = fieldResponses[field.field_name];
        
        // Check if field is empty or only whitespace
        if (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim())) {
          errors.push(`• ${field.field_label} is required`);
        }
        
        // Additional validation based on field type
        if (fieldValue && field.field_type === 'number') {
          const numValue = parseFloat(fieldValue);
          if (isNaN(numValue)) {
            errors.push(`• ${field.field_label} must be a valid number`);
          }
        }
        
        if (fieldValue && field.field_type === 'date') {
          const dateValue = new Date(fieldValue);
          if (isNaN(dateValue.getTime())) {
            errors.push(`• ${field.field_label} must be a valid date`);
          }
        }
      }
    });
  }

  return errors;
}

