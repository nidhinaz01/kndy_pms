import type { WorksTableFilters } from '$lib/types/worksTable';
import { formatTimeFromMinutes } from './timeFormatUtils';

export function parseTimeToHours(timeStr: string | number): number {
  if (typeof timeStr === 'number') return timeStr;
  if (!timeStr || timeStr === '0h 0m') return 0;
  
  const match = timeStr.toString().match(/(\d+)h\s*(\d+)?m?/);
  if (match) {
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    return hours + (minutes / 60);
  }
  return 0;
}

// Use shared utility
export const formatTime = formatTimeFromMinutes;

export function getSkillLevelColor(skill: string): string {
  const skillColors: { [key: string]: string } = {
    'S1': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    'S2': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    'S3': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    'S4': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
  };
  return skillColors[skill] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
}

export function getWorkId(work: any): string {
  const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
  const woDetailsId = work.wo_details_id;
  return `${derivedSwCode}_${woDetailsId}`;
}

export function applyFilters(data: any[], filters: WorksTableFilters): any[] {
  let filtered = data;

  if (filters.searchTerm) {
    filtered = filtered.filter(work => 
      (work.std_work_type_details?.derived_sw_code || work.sw_code)?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      work.sw_name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      work.std_work_type_details?.type_description?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      work.mstr_wo_type?.wo_type_name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      (work.wo_no || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      (work.pwo_no || '').toLowerCase().includes(filters.searchTerm.toLowerCase())
    );
  }

  if (filters.woNoFilter) {
    filtered = filtered.filter(work => 
      (work.wo_no || '').toLowerCase().includes(filters.woNoFilter.toLowerCase())
    );
  }

  if (filters.pwoNoFilter) {
    filtered = filtered.filter(work => 
      (work.pwo_no || '').toLowerCase().includes(filters.pwoNoFilter.toLowerCase())
    );
  }

  if (filters.vehicleModelFilter) {
    filtered = filtered.filter(work => 
      (work.mstr_wo_type?.wo_type_name || '').toLowerCase().includes(filters.vehicleModelFilter.toLowerCase())
    );
  }

  if (filters.workCodeFilter) {
    filtered = filtered.filter(work => {
      const code = (work.std_work_type_details?.derived_sw_code || work.sw_code || '').toLowerCase();
      return code.includes(filters.workCodeFilter.toLowerCase());
    });
  }

  if (filters.workNameFilter) {
    filtered = filtered.filter(work => 
      (work.sw_name || '').toLowerCase().includes(filters.workNameFilter.toLowerCase()) ||
      (work.std_work_type_details?.type_description || '').toLowerCase().includes(filters.workNameFilter.toLowerCase())
    );
  }

  if (filters.requiredSkillsFilter) {
    filtered = filtered.filter(work => {
      if (!work.skill_mappings || work.skill_mappings.length === 0) return false;
      return work.skill_mappings.some((skill: any) => 
        (skill.sc_name || '').toLowerCase().includes(filters.requiredSkillsFilter.toLowerCase())
      );
    });
  }

  return filtered;
}

export function enrichWorkData(work: any): any {
  // Use vehicle work flow duration if available, otherwise try skill time standards
  let duration = work.std_vehicle_work_flow?.estimated_duration_minutes || 0;
  
  // If no vehicle work flow duration, try to get from skill time standards
  if (!duration && work.skill_time_standards) {
    if (work.skill_time_standards.isUniform && work.skill_time_standards.values.length > 0) {
      // All values are the same, use the first one
      duration = work.skill_time_standards.values[0].standard_time_minutes;
    } else if (work.skill_time_standards.values.length > 0) {
      // Different values, use the maximum (or could use sum depending on requirement)
      duration = Math.max(...work.skill_time_standards.values.map(v => v.standard_time_minutes));
    }
  }
  
  const durationHours = duration / 60;
  const timeTakenHours = work.time_taken || 0;
  const remainingTime = Math.max(0, durationHours - timeTakenHours);
  
  return {
    ...work,
    remaining_time: remainingTime,
    time_exceeded: timeTakenHours > durationHours
  };
}

