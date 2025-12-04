/**
 * Get skill order from skillMapping for sorting
 */
function getSkillOrderMap(skillMapping: any): Map<string, number> {
  const skillOrderMap = new Map<string, number>();
  
  if (!skillMapping) return skillOrderMap;
  
  // Try to get order from skill_combination array (preferred method)
  const skillCombination = skillMapping.std_skill_combinations;
  const combination = skillCombination
    ? (Array.isArray(skillCombination)
      ? skillCombination[0]?.skill_combination
      : skillCombination?.skill_combination)
    : null;
  
  if (combination && Array.isArray(combination)) {
    // Sort by skill_order to maintain the hierarchy
    const sortedCombination = [...combination].sort((a, b) => {
      const orderA = a.skill_order ?? 999;
      const orderB = b.skill_order ?? 999;
      return orderA - orderB;
    });
    
    // Create a map of skill_name and skill_short -> index (order)
    // This handles cases where sc_required might be either skill_name or skill_short
    sortedCombination.forEach((skill, index) => {
      if (skill.skill_name) {
        skillOrderMap.set(skill.skill_name, index);
      }
      if (skill.skill_short) {
        skillOrderMap.set(skill.skill_short, index);
      }
      // Also map skill_id if available (for completeness)
      if (skill.skill_id) {
        skillOrderMap.set(String(skill.skill_id), index);
      }
    });
  }
  
  // Fallback: parse from sc_name if skill_combination is not available
  if (skillOrderMap.size === 0 && skillMapping.sc_name && typeof skillMapping.sc_name === 'string') {
    const scName = skillMapping.sc_name.trim();
    if (scName.includes(' + ')) {
      const individualSkills = scName.split(' + ').map((s: string) => s.trim()).filter(Boolean);
      individualSkills.forEach((skill, index) => {
        skillOrderMap.set(skill, index);
      });
    } else {
      // Single skill
      skillOrderMap.set(scName, 0);
    }
  }
  
  return skillOrderMap;
}

/**
 * Group planned works by work code and sort items by skill order
 */
export function groupPlannedWorks(plannedWorks: any[]): Record<string, any> {
  const groups = (plannedWorks || []).reduce((groups, work) => {
    if (!work) return groups;
    
    const workCode = work.other_work_code || work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code || 'unknown';
    
    let workName = '';
    if (work.other_work_code) {
      if (work.workAdditionData?.other_work_desc) {
        workName = work.workAdditionData.other_work_desc;
      } else {
        workName = work.other_work_code;
      }
    } else {
      workName = work.std_work_type_details?.std_work_details?.sw_name || '';
    }
    
    const typeDescription = work.std_work_type_details?.type_description || '';
    const fullWorkName = workName + (typeDescription ? (workName ? ' - ' : '') + typeDescription : '');
    
    if (!groups[workCode]) {
      groups[workCode] = {
        workCode,
        workName: fullWorkName,
        woNo: work.prdn_wo_details?.wo_no || 'N/A',
        pwoNo: work.prdn_wo_details?.pwo_no || 'N/A',
        items: []
      };
    }
    groups[workCode].items.push(work);
    return groups;
  }, {});
  
  // Sort items within each group by skill order
  Object.values(groups).forEach((group: any) => {
    if (!group.items || group.items.length === 0) return;
    
    // Get skill order from the first item's skillMapping
    const firstItem = group.items[0];
    const skillMapping = firstItem?.skillMapping || firstItem?.std_work_skill_mapping;
    const skillOrderMap = getSkillOrderMap(skillMapping);
    
    if (skillOrderMap.size > 0) {
      // Sort items by their sc_required skill order
      group.items.sort((a: any, b: any) => {
        const skillA = a.sc_required || '';
        const skillB = b.sc_required || '';
        
        // Try to get order for skillA
        let orderA = skillOrderMap.get(skillA);
        if (orderA === undefined) {
          // Try to find by matching with skill_short from hr_emp
          const empSkillA = a.hr_emp?.skill_short;
          if (empSkillA) {
            orderA = skillOrderMap.get(empSkillA);
          }
        }
        orderA = orderA ?? 999;
        
        // Try to get order for skillB
        let orderB = skillOrderMap.get(skillB);
        if (orderB === undefined) {
          // Try to find by matching with skill_short from hr_emp
          const empSkillB = b.hr_emp?.skill_short;
          if (empSkillB) {
            orderB = skillOrderMap.get(empSkillB);
          }
        }
        orderB = orderB ?? 999;
        
        // If same order, maintain original order
        if (orderA === orderB) {
          return 0;
        }
        
        return orderA - orderB;
      });
    }
  });
  
  return groups;
}

/**
 * Group report works by work code
 */
export function groupReportWorks(reportData: any[]): Record<string, any> {
  return reportData.reduce((groups, report) => {
    const planning = report.prdn_work_planning;
    const workCode = planning?.other_work_code || 
                     planning?.std_work_type_details?.derived_sw_code || 
                     planning?.std_work_type_details?.sw_code || 'unknown';
    
    let workName = '';
    if (planning?.other_work_code) {
      // For non-standard work, try to get description from work addition data or use code
      workName = planning.other_work_code; // Could be enhanced with workAdditionData if available
    } else {
      workName = planning?.std_work_type_details?.std_work_details?.sw_name || '';
    }
    const typeDescription = planning?.std_work_type_details?.type_description || '';
    const fullWorkName = workName + (typeDescription ? (workName ? ' - ' : '') + typeDescription : '');
    
    if (!groups[workCode]) {
      groups[workCode] = {
        workCode,
        workName: fullWorkName,
        woNo: planning?.prdn_wo_details?.wo_no || 'N/A',
        pwoNo: planning?.prdn_wo_details?.pwo_no || 'N/A',
        items: [],
        hasLostTime: false,
        totalLostTime: 0
      };
    }
    
    const lostTime = report.lt_minutes_total || 0;
    if (lostTime > 0) {
      groups[workCode].hasLostTime = true;
      groups[workCode].totalLostTime += lostTime;
    }
    
    groups[workCode].items.push(report);
    return groups;
  }, {});
}

/**
 * Check if all skill competencies for a work are reported
 */
export function areAllSkillsReported(workCode: string, plannedWorks: any[]): boolean {
  const allWorksForThisCode = plannedWorks.filter(work => {
    const code = work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code;
    return code === workCode;
  });

  if (allWorksForThisCode.length === 0) return false;

  return allWorksForThisCode.every(work => 
    work.workLifecycleStatus && work.workLifecycleStatus !== 'Planned'
  );
}

/**
 * Check if any selected works are already reported
 */
export function hasReportedSkillsSelected(selectedRows: Set<string>, plannedWorks: any[]): boolean {
  if (selectedRows.size === 0) return false;
  
  const selectedWorks = plannedWorks.filter(work => selectedRows.has(work.id));
  return selectedWorks.some(work => 
    work.workLifecycleStatus && work.workLifecycleStatus !== 'Planned'
  );
}

