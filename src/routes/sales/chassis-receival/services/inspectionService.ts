import { supabase } from '$lib/supabaseClient';

export interface InspectionForm {
  inspection_date: string;
  inspector_name: string;
  inspection_notes: string;
  field_responses: Record<string, any>;
}

export interface ExistingInspection {
  id: string;
  sales_order_id: string;
  template_id: string;
  inspection_date: string;
  inspector_name: string;
  inspection_status: string;
  inspection_notes: string;
  field_responses: Record<string, any>;
}

export async function checkExistingInspection(workOrderId: string): Promise<ExistingInspection | null> {
  try {
    const { data, error } = await supabase
      .from('sales_chassis_receival_records')
      .select('*')
      .eq('sales_order_id', workOrderId)
      .eq('inspection_status', 'ongoing')
      .eq('is_deleted', false)
      .order('created_dt', { ascending: false }) // Get the most recent one if multiple exist
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error checking for existing inspection:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error checking for existing inspection:', error);
    return null;
  }
}

export async function loadTemplate(templateId: string) {
  try {
    const { data, error } = await supabase
      .from('sys_chassis_receival_templates')
      .select(`
        *,
        sys_chassis_receival_template_fields(*)
      `)
      .eq('id', templateId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error loading template:', error);
    throw error;
  }
}

export async function saveInspectionProgress(
  workOrderId: string,
  templateId: string,
  form: InspectionForm,
  fieldResponses: Record<string, any>,
  existingInspection: ExistingInspection | null,
  username: string | null
): Promise<void> {
  const now = new Date().toISOString();

  if (existingInspection) {
    // Update existing inspection
    const { error } = await supabase
      .from('sales_chassis_receival_records')
      .update({
        inspection_date: form.inspection_date,
        inspector_name: form.inspector_name,
        inspection_status: 'ongoing',
        inspection_notes: form.inspection_notes,
        field_responses: fieldResponses,
        modified_by: username,
        modified_dt: now
      })
      .eq('id', existingInspection.id);

    if (error) throw error;
  } else {
    // Create new inspection record
    const { error } = await supabase
      .from('sales_chassis_receival_records')
      .insert({
        sales_order_id: workOrderId,
        template_id: templateId,
        inspection_date: form.inspection_date,
        inspector_name: form.inspector_name,
        inspection_status: 'ongoing',
        inspection_notes: form.inspection_notes,
        field_responses: fieldResponses,
        created_by: username,
        created_dt: now
      });

    if (error) throw error;
  }
}

export async function completeInspection(
  workOrderId: string,
  templateId: string,
  form: InspectionForm,
  fieldResponses: Record<string, any>,
  existingInspection: ExistingInspection | null,
  username: string | null
): Promise<void> {
  const now = new Date().toISOString();

  if (existingInspection) {
    // Update existing inspection to completed
    const { error } = await supabase
      .from('sales_chassis_receival_records')
      .update({
        inspection_date: form.inspection_date,
        inspector_name: form.inspector_name,
        inspection_status: 'completed',
        inspection_notes: form.inspection_notes,
        field_responses: fieldResponses,
        modified_by: username,
        modified_dt: now
      })
      .eq('id', existingInspection.id);

    if (error) throw error;
  } else {
    // Create new completed inspection record
    const { error } = await supabase
      .from('sales_chassis_receival_records')
      .insert({
        sales_order_id: workOrderId,
        template_id: templateId,
        inspection_date: form.inspection_date,
        inspector_name: form.inspector_name,
        inspection_status: 'completed',
        inspection_notes: form.inspection_notes,
        field_responses: fieldResponses,
        created_by: username,
        created_dt: now
      });

    if (error) throw error;
  }

  // Update prdn_dates with actual chassis arrival date (using current timestamp)
  const { error: dateError } = await supabase
    .from('prdn_dates')
    .update({
      actual_date: now, // Use current timestamp instead of just the date
      modified_by: username,
      modified_dt: now
    })
    .eq('sales_order_id', workOrderId)
    .eq('date_type', 'chassis_arrival');

  if (dateError) throw dateError;
}

