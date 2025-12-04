import { supabase } from '$lib/supabaseClient';
import type { WorkPlanning, CreateWorkPlanningData } from './productionTypes';

export async function createWorkPlanning(planningData: CreateWorkPlanningData, createdBy: string): Promise<WorkPlanning> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('prdn_work_planning')
      .insert({
        ...planningData,
        time_worked_till_date: planningData.time_worked_till_date || 0,
        remaining_time: planningData.remaining_time || planningData.planned_hours,
        status: planningData.status || 'planned',
        created_by: createdBy,
        created_dt: now,
        modified_by: createdBy,
        modified_dt: now
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating work planning:', error);
    throw error;
  }
}

export async function fetchWorkPlanning(
  stageCode: string, 
  date: string, 
  status?: 'draft' | 'approved' | 'pending_approval' | 'rejected'
): Promise<WorkPlanning[]> {
  try {
    let query = supabase
      .from('prdn_work_planning')
      .select(`
        *,
        hr_emp!inner(
          emp_id,
          emp_name,
          skill_short
        ),
        std_work_type_details(
          derived_sw_code,
          sw_code,
          type_description,
          std_work_details(sw_name)
        ),
        prdn_wo_details!inner(
          wo_no,
          pwo_no,
          wo_model,
          customer_name
        ),
        std_work_skill_mapping(
          wsm_id,
          sc_name
        )
      `)
      .eq('stage_code', stageCode)
      .eq('from_date', date)
      .eq('is_active', true)
      .eq('is_deleted', false);
    
    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query.order('from_time', { ascending: true });

    if (error) throw error;
    
    console.log(`🔍 fetchWorkPlanning: Retrieved ${(data || []).length} records from database for ${stageCode} on ${date}`);
    
    const filteredData = (data || []).filter(record => {
      const isDeleted = record.is_deleted;
      const isActuallyDeleted = isDeleted === true || 
                                isDeleted === 'true' || 
                                isDeleted === 'True' || 
                                isDeleted === 'TRUE' ||
                                isDeleted === 1 ||
                                isDeleted === '1' ||
                                String(isDeleted).toLowerCase() === 'true';
      
      if (isActuallyDeleted) {
        console.warn(`⚠️ Filtered out soft-deleted planning record ID ${record.id}:`, {
          derived_sw_code: record.derived_sw_code,
          other_work_code: record.other_work_code,
          is_deleted: isDeleted,
          is_deleted_type: typeof isDeleted
        });
        return false;
      }
      return true;
    });
    
    if (filteredData.length !== (data || []).length) {
      console.log(`🔍 Filtered out ${(data || []).length - filteredData.length} soft-deleted planning records`);
    }
    
    console.log(`✅ fetchWorkPlanning: Returning ${filteredData.length} active planning records after filtering`);
    
    return filteredData;
  } catch (error) {
    console.error('Error fetching work planning:', error);
    throw error;
  }
}

export async function updateWorkPlanning(id: number, planningData: Partial<CreateWorkPlanningData>, modifiedBy: string): Promise<WorkPlanning> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('prdn_work_planning')
      .update({
        ...planningData,
        modified_by: modifiedBy,
        modified_dt: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating work planning:', error);
    throw error;
  }
}

export async function deleteWorkPlanning(id: number, modifiedBy: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('prdn_work_planning')
      .update({
        is_deleted: true,
        modified_by: modifiedBy,
        modified_dt: now
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting work planning:', error);
    throw error;
  }
}

