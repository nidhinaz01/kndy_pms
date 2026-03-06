import { supabase } from '$lib/supabaseClient';

export interface Template {
  id: string;
  template_name: string;
  template_description: string | null;
  is_active: boolean;
  created_dt: string;
  sys_chassis_receival_template_fields?: TemplateField[];
}

export interface TemplateField {
  id: string;
  template_id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  field_order: number;
  validation_rules: any;
  dropdown_options: { options: string[] };
}

export async function loadTemplates(): Promise<Template[]> {
  try {
    const { data, error } = await supabase
      .from('sys_chassis_receival_templates')
      .select(`
        *,
        sys_chassis_receival_template_fields(*)
      `)
      .eq('is_deleted', false)
      .order('created_dt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading templates:', error);
    return [];
  }
}

export async function saveTemplate(
  templateData: Partial<Template>,
  isEdit: boolean,
  templateId?: string,
  username?: string | null
): Promise<void> {
  const now = new Date().toISOString();

  if (isEdit && templateId) {
    const { error } = await supabase
      .from('sys_chassis_receival_templates')
      .update({
        template_name: templateData.template_name,
        template_description: templateData.template_description,
        is_active: templateData.is_active,
        modified_by: username,
        modified_dt: now
      })
      .eq('id', templateId);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('sys_chassis_receival_templates')
      .insert({
        template_name: templateData.template_name,
        template_description: templateData.template_description,
        is_active: templateData.is_active,
        created_by: username,
        created_dt: now
      });

    if (error) throw error;
  }
}

export async function copyTemplate(
  originalTemplate: Template,
  newTemplateName: string,
  newTemplateDescription: string,
  username?: string | null
): Promise<void> {
  const now = new Date().toISOString();

  const { data: newTemplate, error: templateError } = await supabase
    .from('sys_chassis_receival_templates')
    .insert({
      template_name: newTemplateName,
      template_description: newTemplateDescription,
      is_active: true,
      created_by: username,
      created_dt: now
    })
    .select()
    .single();

  if (templateError) throw templateError;

  if (originalTemplate.sys_chassis_receival_template_fields?.length > 0) {
    const fieldsToInsert = originalTemplate.sys_chassis_receival_template_fields.map((field) => ({
      template_id: newTemplate.id,
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      is_required: field.is_required,
      field_order: field.field_order,
      validation_rules: field.validation_rules,
      dropdown_options: field.dropdown_options,
      created_by: username,
      created_dt: now
    }));

    const { error: fieldsError } = await supabase
      .from('sys_chassis_receival_template_fields')
      .insert(fieldsToInsert);

    if (fieldsError) throw fieldsError;
  }
}

export async function deleteTemplate(templateId: string, username?: string | null): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('sys_chassis_receival_templates')
    .update({
      is_deleted: true,
      modified_by: username,
      modified_dt: now
    })
    .eq('id', templateId);

  if (error) throw error;
}

export async function saveField(
  templateId: string,
  fieldData: Partial<TemplateField>,
  username?: string | null
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('sys_chassis_receival_template_fields')
    .insert({
      template_id: templateId,
      field_name: fieldData.field_name,
      field_label: fieldData.field_label,
      field_type: fieldData.field_type,
      is_required: fieldData.is_required,
      field_order: fieldData.field_order,
      validation_rules: fieldData.validation_rules,
      dropdown_options: fieldData.dropdown_options,
      created_by: username,
      created_dt: now
    });

  if (error) throw error;
}

export async function deleteField(fieldId: string, username?: string | null): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('sys_chassis_receival_template_fields')
    .update({
      is_deleted: true,
      modified_by: username,
      modified_dt: now
    })
    .eq('id', fieldId);

  if (error) throw error;
}

