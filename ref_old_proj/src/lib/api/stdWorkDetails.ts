import { supabase } from '$lib/supabaseClient';

export interface StdWorkDetail {
  sw_id?: number;
  sw_code: string;
  sw_name: string;
  plant_stage: string;
  sw_type: 'Parent' | 'Mother' | 'Child';
  sw_seq_no: number;
  created_by: string;
  created_dt: string;
  modified_by: string;
  modified_dt?: string;
  is_active?: boolean;
}

// Fetch plant-stage options from data elements (assuming de_name = 'Plant-Stage')
export async function fetchPlantStages(): Promise<string[]> {
  const { data, error } = await supabase
    .from('sys_data_elements')
    .select('de_value')
    .eq('de_name', 'Plant-Stage');
  if (error) throw error;
  return data ? data.map((row: any) => row.de_value) : [];
}

// Fetch max sw_seq_no for a given type
export async function fetchMaxSeqNo(sw_type: string): Promise<number> {
  const { data, error } = await supabase
    .from('std_work_details')
    .select('sw_seq_no')
    .eq('sw_type', sw_type)
    .order('sw_seq_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.sw_seq_no ? Number(data.sw_seq_no) : 0;
}

// Insert a new work detail
export async function insertStdWorkDetail(detail: StdWorkDetail): Promise<void> {
  const { error } = await supabase
    .from('std_work_details')
    .insert([detail]);
  if (error) throw error;
}

// Fetch all std_work_details (not deleted)
export async function fetchAllStdWorkDetails(): Promise<StdWorkDetail[]> {
  const { data, error } = await supabase
    .from('std_work_details')
    .select('*')
    .order('modified_dt', { ascending: false });
  if (error) throw error;
  return data || [];
} 