/**
 * Group planned works by work code
 */
export function groupPlannedWorks(plannedWorks: any[]): Record<string, any> {
  return (plannedWorks || []).reduce((groups, work) => {
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
}

/**
 * Group report works by work code
 */
export function groupReportWorks(reportData: any[]): Record<string, any> {
  return reportData.reduce((groups, report) => {
    const workCode = report.prdn_work_planning?.std_work_type_details?.derived_sw_code || 
                     report.prdn_work_planning?.std_work_type_details?.sw_code || 'unknown';
    const workName = report.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || '';
    const typeDescription = report.prdn_work_planning?.std_work_type_details?.type_description || '';
    const fullWorkName = workName + (typeDescription ? (workName ? ' - ' : '') + typeDescription : '');
    
    if (!groups[workCode]) {
      groups[workCode] = {
        workCode,
        workName: fullWorkName,
        woNo: report.prdn_work_planning?.prdn_wo_details?.wo_no || 'N/A',
        pwoNo: report.prdn_work_planning?.prdn_wo_details?.pwo_no || 'N/A',
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

