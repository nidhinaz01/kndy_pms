import { supabase } from '$lib/supabaseClient';
import type { WorkOrderFormData, ModelOption } from '$lib/types/workOrder';

export function calculateTotalCost(
  workOrderCost: number,
  gstTaxRateOptions: Array<{ de_value: string }>,
  cessTaxRateOptions: Array<{ de_value: string }>
): { gst: number; cess: number; total: number } {
  let gst = 0;
  let cess = 0;

  // Calculate GST based on tax rate from database
  if (gstTaxRateOptions.length > 0 && workOrderCost > 0) {
    const gstRate = parseFloat(gstTaxRateOptions[0].de_value);
    gst = (workOrderCost * gstRate) / 100;
  }

  // Calculate Cess based on tax rate from database
  if (cessTaxRateOptions.length > 0 && workOrderCost > 0) {
    const cessRate = parseFloat(cessTaxRateOptions[0].de_value);
    cess = (workOrderCost * cessRate) / 100;
  }

  // Calculate total cost
  const total = workOrderCost + gst + cess;

  return { gst, cess, total };
}

export function calculateAmount(workQty: number, workRate: number): number {
  const qty = Number(workQty) || 0;
  const rate = Number(workRate) || 0;
  return qty * rate;
}

export function updateFieldsFromModel(
  selectedModelName: string,
  modelOptions: ModelOption[]
): Partial<WorkOrderFormData> {
  const selectedModel = modelOptions.find(option => option.wo_type_name === selectedModelName);

  if (selectedModel) {
    return {
      wo_type: selectedModel.wo_type_code || '',
      wo_comfort_level: selectedModel.wo_comfort_level || '',
      wo_capacity: selectedModel.wo_capacity || '',
      wo_carrier_type: selectedModel.wo_carrier_type || ''
    };
  }

  return {};
}

export async function checkUniqueness(wo_no: string, pwo_no: string): Promise<{
  isValid: boolean;
  error: string;
}> {
  if (!wo_no && !pwo_no) {
    return { isValid: false, error: 'Either WO Number or PWO Number is required' };
  }

  try {
    // Check WO Number uniqueness if provided
    if (wo_no && wo_no.trim() !== '') {
      const { data: woData, error: woError } = await supabase
        .from('prdn_wo_details')
        .select('id')
        .eq('wo_no', wo_no.trim());

      if (woError) throw woError;
      if (woData && woData.length > 0) {
        return { isValid: false, error: 'WO Number already exists' };
      }
    }

    // Check PWO Number uniqueness if provided
    if (pwo_no && pwo_no.trim() !== '') {
      const { data: pwoData, error: pwoError } = await supabase
        .from('prdn_wo_details')
        .select('id')
        .eq('pwo_no', pwo_no.trim());

      if (pwoError) throw pwoError;
      if (pwoData && pwoData.length > 0) {
        return { isValid: false, error: 'PWO Number already exists' };
      }
    }

    return { isValid: true, error: '' };
  } catch (error) {
    console.error('Error checking uniqueness:', error);
    return { isValid: false, error: 'Error checking uniqueness' };
  }
}

