import { supabase } from '$lib/supabaseClient';

export async function getAvailableStandardWorks(
  woDetailsId: number,
  stageCode: string
): Promise<Array<{ derived_sw_code: string; type_description: string; sw_name: string }>> {
  try {
    const { data: woDetails, error: woError } = await supabase
      .from('prdn_wo_details')
      .select('wo_model')
      .eq('id', woDetailsId)
      .single();

    if (woError || !woDetails) {
      console.error('Error fetching work order details:', woError);
      return [];
    }

    const { data: workType, error: workTypeError } = await supabase
      .from('mstr_wo_type')
      .select('id')
      .eq('wo_type_name', woDetails.wo_model)
      .single();

    if (workTypeError || !workType) {
      console.error('Error fetching work type:', workTypeError);
      return [];
    }

    const { data: linkedWorks, error: linkedError } = await supabase
      .from('std_vehicle_work_flow')
      .select('derived_sw_code')
      .eq('wo_type_id', workType.id)
      .eq('is_active', true)
      .eq('is_deleted', false);

    const linkedCodes = new Set((linkedWorks || []).map(w => w.derived_sw_code));

    const { data: removedWorks, error: removedError } = await supabase
      .from('prdn_work_removals')
      .select('derived_sw_code')
      .eq('wo_details_id', woDetailsId)
      .eq('stage_code', stageCode);

    const removedCodes = new Set((removedWorks || []).map(r => r.derived_sw_code));

    // Get works already added to this work order
    const { data: addedWorks, error: addedError } = await supabase
      .from('prdn_work_additions')
      .select('derived_sw_code')
      .eq('wo_details_id', woDetailsId)
      .eq('stage_code', stageCode)
      .not('derived_sw_code', 'is', null);

    const addedCodes = new Set((addedWorks || []).map(a => a.derived_sw_code));

    const { data: allWorkTypeDetails, error: allError } = await supabase
      .from('std_work_type_details')
      .select(`
        derived_sw_code,
        type_description,
        std_work_details!inner(sw_name)
      `)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (allError) {
      console.error('Error fetching work type details:', allError);
      return [];
    }

    const available = (allWorkTypeDetails || [])
      .filter(wtd => {
        const code = wtd.derived_sw_code;
        // Show works that ARE in the vehicle work flow, but NOT already added and NOT removed
        return linkedCodes.has(code) && !addedCodes.has(code) && !removedCodes.has(code);
      })
      .map(wtd => ({
        derived_sw_code: wtd.derived_sw_code,
        type_description: wtd.type_description || '',
        sw_name: (wtd.std_work_details as any)?.sw_name || ''
      }))
      .sort((a, b) => a.derived_sw_code.localeCompare(b.derived_sw_code));

    return available;
  } catch (error) {
    console.error('Error getting available standard works:', error);
    return [];
  }
}

export async function getNextNonStandardWorkCode(woDetailsId: number): Promise<string> {
  try {
    const { data: existingCodes, error: existingError } = await supabase
      .from('prdn_work_additions')
      .select('other_work_code')
      .eq('wo_details_id', woDetailsId)
      .not('other_work_code', 'is', null);

    if (existingError) {
      console.error('Error fetching existing work codes:', existingError);
      return 'OW001';
    }

    const usedNumbers = new Set<number>();
    (existingCodes || []).forEach(code => {
      const match = code.other_work_code?.match(/^OW(\d+)$/);
      if (match) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    });

    for (let i = 1; i <= 999; i++) {
      if (!usedNumbers.has(i)) {
        return `OW${i.toString().padStart(3, '0')}`;
      }
    }

    throw new Error('All work codes (OW001-OW999) are already used for this work order');
  } catch (error) {
    console.error('Error getting next non-standard work code:', error);
    throw error;
  }
}

export async function getSkillCombinations(): Promise<Array<{ sc_name: string; skill_combination: any; skill_combination_display: string }>> {
  try {
    const { data, error } = await supabase
      .from('std_skill_combinations')
      .select('sc_name, skill_combination')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('sc_name');

    if (error) {
      console.error('Error fetching skill combinations:', error);
      return [];
    }

    return (data || []).map(sc => {
      let displayText = '';
      if (sc.skill_combination && Array.isArray(sc.skill_combination)) {
        const sorted = [...sc.skill_combination].sort((a, b) => (a.skill_order || 0) - (b.skill_order || 0));
        displayText = sorted.map(s => s.skill_name || s.skill_id).join(', ');
      } else if (typeof sc.skill_combination === 'string') {
        displayText = sc.skill_combination;
      }
      
      return {
        sc_name: sc.sc_name,
        skill_combination: sc.skill_combination,
        skill_combination_display: displayText || 'No skills'
      };
    });
  } catch (error) {
    console.error('Error getting skill combinations:', error);
    return [];
  }
}
