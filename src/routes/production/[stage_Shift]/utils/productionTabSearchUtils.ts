/**
 * Shared search utilities for production tabs
 * Provides consistent search functionality across Plan, Draft Plan, Report, and Draft Report tabs
 */

/**
 * Filter planned works/reports by search term
 * Searches across: work code, work name, WO number, PWO number, worker name, skill
 */
export function filterPlannedWorksBySearch(
  items: any[],
  searchTerm: string
): any[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return items;
  }

  const searchLower = searchTerm.toLowerCase().trim();

  return items.filter(item => {
    const planning = item.prdn_work_planning || item;
    
    // Work code
    const workCode = planning?.other_work_code || 
                     planning?.std_work_type_details?.derived_sw_code || 
                     planning?.std_work_type_details?.sw_code || '';
    
    // Work name
    let workName = '';
    if (planning?.other_work_code) {
      workName = planning?.workAdditionData?.other_work_desc || planning?.other_work_code || '';
    } else {
      workName = planning?.std_work_type_details?.std_work_details?.sw_name || '';
    }
    const typeDescription = planning?.std_work_type_details?.type_description || '';
    const fullWorkName = workName + (typeDescription ? (workName ? ' - ' : '') + typeDescription : '');
    
    // WO and PWO numbers
    const woNo = planning?.prdn_wo_details?.wo_no || item.prdn_wo_details?.wo_no || '';
    const pwoNo = planning?.prdn_wo_details?.pwo_no || item.prdn_wo_details?.pwo_no || '';
    
    // Worker name and skill
    const workerName = planning?.hr_emp?.emp_name || item.hr_emp?.emp_name || '';
    const skillShort = planning?.hr_emp?.skill_short || item.hr_emp?.skill_short || '';
    const scRequired = planning?.sc_required || item.sc_required || '';
    
    // Skill mapping name
    const skillMappingName = planning?.std_work_skill_mapping?.sc_name || 
                            planning?.skillMapping?.sc_name || 
                            item.skillMapping?.sc_name || '';

    return (
      workCode.toLowerCase().includes(searchLower) ||
      fullWorkName.toLowerCase().includes(searchLower) ||
      woNo.toLowerCase().includes(searchLower) ||
      pwoNo.toLowerCase().includes(searchLower) ||
      workerName.toLowerCase().includes(searchLower) ||
      skillShort.toLowerCase().includes(searchLower) ||
      scRequired.toLowerCase().includes(searchLower) ||
      skillMappingName.toLowerCase().includes(searchLower)
    );
  });
}

/**
 * Filter grouped works by search term
 * Used for tabs that display grouped data (Plan, Draft Plan, Report, Draft Report)
 */
export function filterGroupedWorksBySearch(
  groupedWorks: Record<string, any>,
  searchTerm: string
): Record<string, any> {
  if (!searchTerm || searchTerm.trim() === '') {
    return groupedWorks;
  }

  const searchLower = searchTerm.toLowerCase().trim();
  const filtered: Record<string, any> = {};

  Object.entries(groupedWorks).forEach(([workCode, group]) => {
    // Check group-level fields
    const matchesGroup = 
      (group.workCode || '').toLowerCase().includes(searchLower) ||
      (group.workName || '').toLowerCase().includes(searchLower) ||
      (group.woNo || '').toLowerCase().includes(searchLower) ||
      (group.pwoNo || '').toLowerCase().includes(searchLower);

    // Check item-level fields (worker, skill, etc.)
    const matchesItems = group.items?.some((item: any) => {
      const planning = item.prdn_work_planning || item;
      const workerName = planning?.hr_emp?.emp_name || item.hr_emp?.emp_name || '';
      const skillShort = planning?.hr_emp?.skill_short || item.hr_emp?.skill_short || '';
      const scRequired = planning?.sc_required || item.sc_required || '';
      const skillMappingName = planning?.std_work_skill_mapping?.sc_name || 
                              planning?.skillMapping?.sc_name || 
                              item.skillMapping?.sc_name || '';

      return (
        workerName.toLowerCase().includes(searchLower) ||
        skillShort.toLowerCase().includes(searchLower) ||
        scRequired.toLowerCase().includes(searchLower) ||
        skillMappingName.toLowerCase().includes(searchLower)
      );
    });

    if (matchesGroup || matchesItems) {
      filtered[workCode] = group;
    }
  });

  return filtered;
}

/**
 * Filter manpower data by search term
 * Searches across: employee name, employee ID, skill
 */
export function filterManpowerBySearch(
  items: any[],
  searchTerm: string
): any[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return items;
  }

  const searchLower = searchTerm.toLowerCase().trim();

  return items.filter(item => {
    const empName = item.hr_emp?.emp_name || item.emp_name || '';
    const empId = item.hr_emp?.emp_id || item.emp_id || item.worker_id || '';
    const skillShort = item.hr_emp?.skill_short || item.skill_short || '';

    return (
      empName.toLowerCase().includes(searchLower) ||
      empId.toLowerCase().includes(searchLower) ||
      skillShort.toLowerCase().includes(searchLower)
    );
  });
}

