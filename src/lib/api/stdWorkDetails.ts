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

// Interface for import data (without required database fields)
export interface WorkImportData {
  sw_code?: string; // Optional - will be auto-generated
  sw_name: string;
  plant_stage: string;
  sw_type: 'Parent' | 'Mother' | 'Child';
  sw_seq_no?: number; // Optional - execution sequence order
}

export interface WorkImportResult {
  success: number;
  failed: number;
  errors: string[];
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

// Fetch max sw_code sequence number for a given type (for work code generation)
export async function fetchMaxSeqNo(sw_type: string): Promise<number> {
  const { data, error } = await supabase
    .from('std_work_details')
    .select('sw_code')
    .eq('sw_type', sw_type)
    .eq('is_deleted', false)
    .order('sw_code', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  
  if (!data?.sw_code) {
    return 0; // No records exist, will start from 101
  }
  
  // Extract numeric part from sw_code (e.g., "C0114" -> 114)
  const numericPart = data.sw_code.substring(1); // Remove first character (P/M/C)
  const seqNo = parseInt(numericPart);
  
  return isNaN(seqNo) ? 0 : seqNo;
}

// Fetch max sw_seq_no for a given type (for execution sequence)
export async function fetchMaxExecutionSeqNo(sw_type: string): Promise<number> {
  const { data, error } = await supabase
    .from('std_work_details')
    .select('sw_seq_no')
    .eq('sw_type', sw_type)
    .eq('is_deleted', false)
    .order('sw_seq_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  // Return 0 if no records exist (will trigger starting from 1)
  // Return the actual max if records exist
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
    .eq('is_deleted', false)
    .order('modified_dt', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Check if work code already exists
export async function checkWorkCodeExists(sw_code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('std_work_details')
    .select('sw_id')
    .eq('sw_code', sw_code)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// Check multiple work codes for existence
export async function checkWorkCodesExist(sw_codes: string[]): Promise<string[]> {
  const { data, error } = await supabase
    .from('std_work_details')
    .select('sw_code')
    .eq('is_deleted', false)
    .in('sw_code', sw_codes);
  if (error) throw error;
  return data ? data.map(row => row.sw_code) : [];
}

// Import multiple work details
export async function importWorkDetails(workDetails: WorkImportData[], createdBy: string): Promise<WorkImportResult> {
  const result: WorkImportResult = {
    success: 0,
    failed: 0,
    errors: []
  };

  // sw_codes are auto-generated, no need to check for duplicates or conflicts

  // Get valid plant stages from database
  const validPlantStages = await fetchPlantStages();
  
  // Validate required fields and auto-generate sequence numbers
  const workDetailsToInsert: StdWorkDetail[] = [];
  const seqNoMap = new Map<string, number>(); // Track max seq_no for each type
  const codeSeqMap = new Map<string, number>(); // Track max code sequence for each type
  
  // Initialize sequence maps with existing database records
  const existingMaxCodeSeqs = await Promise.all([
    fetchMaxSeqNo('Parent'),
    fetchMaxSeqNo('Mother'),
    fetchMaxSeqNo('Child')
  ]);
  
  const existingMaxExecutionSeqs = await Promise.all([
    fetchMaxExecutionSeqNo('Parent'),
    fetchMaxExecutionSeqNo('Mother'),
    fetchMaxExecutionSeqNo('Child')
  ]);
  
  // Initialize code sequence maps (for sw_code generation)
  codeSeqMap.set('Parent', existingMaxCodeSeqs[0]);
  codeSeqMap.set('Mother', existingMaxCodeSeqs[1]);
  codeSeqMap.set('Child', existingMaxCodeSeqs[2]);
  
  // Initialize execution sequence maps (for sw_seq_no)
  seqNoMap.set('Parent', existingMaxExecutionSeqs[0]);
  seqNoMap.set('Mother', existingMaxExecutionSeqs[1]);
  seqNoMap.set('Child', existingMaxExecutionSeqs[2]);

  for (let i = 0; i < workDetails.length; i++) {
    const work = workDetails[i];
    const rowNumber = i + 2; // Excel rows start from 1, and header is row 1

    // sw_code is auto-generated, no need to validate

    if (!work.sw_name?.trim()) {
      result.errors.push(`Row ${rowNumber}: Work Name is required`);
      result.failed++;
      continue;
    }

    if (!work.plant_stage?.trim()) {
      result.errors.push(`Row ${rowNumber}: Plant Stage is required`);
      result.failed++;
      continue;
    }

    // Validate plant stage exists in database
    if (!validPlantStages.includes(work.plant_stage.trim())) {
      result.errors.push(`Row ${rowNumber}: Plant Stage "${work.plant_stage}" is not valid. Valid stages: ${validPlantStages.join(', ')}`);
      result.failed++;
      continue;
    }

    if (!work.sw_type || !['Parent', 'Mother', 'Child'].includes(work.sw_type)) {
      result.errors.push(`Row ${rowNumber}: Work Type must be one of: Parent, Mother, Child`);
      result.failed++;
      continue;
    }

    // Handle sequence number (execution order) - can be any positive number
    let seqNo = work.sw_seq_no;
    if (!seqNo || isNaN(Number(seqNo))) {
      // If not provided, auto-generate based on existing records for this type
      const currentMax = seqNoMap.get(work.sw_type) || 0;
      seqNo = currentMax + 1;
      seqNoMap.set(work.sw_type, seqNo);
    } else {
      // If provided, validate it's a positive number
      if (seqNo < 1) {
        result.errors.push(`Row ${rowNumber}: Sequence Number must be 1 or greater`);
        result.failed++;
        continue;
      }
      // Update the max for this type
      const currentMax = seqNoMap.get(work.sw_type) || 0;
      seqNoMap.set(work.sw_type, Math.max(currentMax, seqNo));
    }

    // Generate sw_code based on work type and auto-incrementing sequence
    // This is separate from sw_seq_no (execution order)
    const currentCodeSeq = codeSeqMap.get(work.sw_type) || 0;
    const nextCodeSeq = currentCodeSeq === 0 ? 101 : currentCodeSeq + 1;
    codeSeqMap.set(work.sw_type, nextCodeSeq);
    
    const generatedSwCode = `${work.sw_type.charAt(0).toUpperCase()}${nextCodeSeq.toString().padStart(4, '0')}`;

    workDetailsToInsert.push({
      sw_code: generatedSwCode,
      sw_name: work.sw_name.trim(),
      plant_stage: work.plant_stage.trim(),
      sw_type: work.sw_type,
      sw_seq_no: seqNo,
      created_by: createdBy,
      created_dt: new Date().toISOString(),
      modified_by: createdBy,
      modified_dt: new Date().toISOString(),
      is_active: true
    });
  }

  if (result.failed > 0) {
    return result;
  }

  try {
    const { error } = await supabase
      .from('std_work_details')
      .insert(workDetailsToInsert);

    if (error) {
      result.failed = workDetails.length;
      result.errors.push(`Database error: ${error.message}`);
    } else {
      result.success = workDetails.length;
    }
  } catch (error) {
    result.failed = workDetails.length;
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
} 