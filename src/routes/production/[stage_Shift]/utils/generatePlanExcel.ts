import * as XLSX from 'xlsx';
import { formatStageShiftExportFilename } from '../../utils/stageUtils';
import { formatTime, calculateBreakTimeInRange } from './timeUtils';
import { groupPlannedWorks } from './planTabUtils';

interface PlannedWork {
  id: number;
  prdn_wo_details?: { wo_no: string; pwo_no: string; wo_model?: string; customer_name?: string };
  std_work_type_details?: { derived_sw_code?: string; sw_code?: string; type_description?: string; std_work_details?: { sw_name: string } };
  other_work_code?: string;
  hr_emp?: { emp_name: string; skill_short: string };
  sc_required?: string;
  from_time?: string;
  to_time?: string;
  planned_hours?: number;
  vehicleWorkFlow?: { estimated_duration_minutes?: number };
  skillTimeStandard?: { standard_time_minutes?: number };
  std_work_skill_mapping?: { sc_name?: string };
  time_worked_till_date?: number;
  remaining_time?: number;
  workLifecycleStatus?: string;
}

export function generatePlanExcel(
  plannedWorks: PlannedWork[],
  stageCode: string,
  shiftCode: string,
  planningDate: string,
  shiftBreakTimes: Array<{ start_time: string; end_time: string }> = []
): void {
  try {
    // Group works by work code
    const groupedPlannedWorks = groupPlannedWorks(plannedWorks);
    
    // Calculate totals for summary
    // Count unique work codes/names (number of groups) instead of total planned work rows
    let totalPlannedWorks = Object.keys(groupedPlannedWorks).length;
    let totalPlannedManhours = 0;

    // Prepare Planned Works data - grouped format
    const plannedWorksData: any[] = [];

    Object.values(groupedPlannedWorks).forEach((group: any) => {
      group.items.forEach((work: PlannedWork, index: number) => {
        const workCode = work.other_work_code || work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code || 'N/A';
        const workName = work.other_work_code 
          ? (work.workAdditionData?.other_work_desc || work.other_work_code)
          : (work.std_work_type_details?.std_work_details?.sw_name || '');
        const typeDescription = work.std_work_type_details?.type_description || '';
        const fullWorkName = workName + (typeDescription ? (workName ? ' - ' : '') + typeDescription : '');

        // Calculate planned hours from time range if not available
        let plannedHours = work.planned_hours || 0;
        if (plannedHours === 0 && work.from_time && work.to_time) {
          const fromMinutes = timeToMinutes(work.from_time);
          const toMinutes = timeToMinutes(work.to_time);
          const breakTime = calculateBreakTimeInRange(work.from_time, work.to_time, shiftBreakTimes);
          plannedHours = (toMinutes - fromMinutes - breakTime) / 60;
        }
        totalPlannedManhours += plannedHours;

        // Get standard time
        const standardTimeMinutes = work.vehicleWorkFlow?.estimated_duration_minutes || 
                                   work.skillTimeStandard?.standard_time_minutes || 0;
        const standardTime = standardTimeMinutes > 0 ? formatTime(standardTimeMinutes / 60) : 'N/A';

        // Format time strings
        const fromTimeFormatted = work.from_time ? formatTimeString(work.from_time) : 'N/A';
        const toTimeFormatted = work.to_time ? formatTimeString(work.to_time) : 'N/A';

        const row: any = {
          'Work Order Number': index === 0 ? (work.prdn_wo_details?.wo_no || 'N/A') : '',
          'Pre Work Order Number': index === 0 ? (work.prdn_wo_details?.pwo_no || 'N/A') : '',
          'Work Code': index === 0 ? workCode : '',
          'Work Name': index === 0 ? fullWorkName : '',
          'Skill Competency': work.std_work_skill_mapping?.sc_name || work.sc_required || 'N/A',
          'Standard Time': index === 0 ? standardTime : '',
          'Worker': work.hr_emp?.emp_name || 'N/A',
          'SC': work.hr_emp?.skill_short || 'N/A',
          'Time Worked Till Date': formatTime((work.time_worked_till_date || 0) / 60),
          'From Time': fromTimeFormatted,
          'To Time': toTimeFormatted,
          'Planned Hours': formatTime(plannedHours)
        };

        plannedWorksData.push(row);
      });
    });

    // Create Summary sheet
    const summaryData = [
      [`${stageCode}${shiftCode} - Production Plan - ${formatDateForSummary(planningDate)}`],
      [],
      ['Summary'],
      ['Total Planned Works:', totalPlannedWorks],
      ['Total Planned Manhours:', totalPlannedManhours.toFixed(2)]
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [
      { wch: 50 },
      { wch: 20 }
    ];

    // Create Planned Works sheet
    const plannedWorksWs = XLSX.utils.json_to_sheet(plannedWorksData);

    // Set column widths for Planned Works
    plannedWorksWs['!cols'] = [
      { wch: 18 }, // Work Order Number
      { wch: 20 }, // Pre Work Order Number
      { wch: 15 }, // Work Code
      { wch: 50 }, // Work Name
      { wch: 20 }, // Skill Competency
      { wch: 15 }, // Standard Time
      { wch: 20 }, // Worker
      { wch: 10 }, // SC
      { wch: 22 }, // Time Worked Till Date
      { wch: 12 }, // From Time
      { wch: 12 }, // To Time
      { wch: 18 }  // Planned Hours
    ];

    // Add borders and styling to Planned Works sheet
    const range = XLSX.utils.decode_range(plannedWorksWs['!ref'] || 'A1');
    for (let R = 0; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!plannedWorksWs[cellAddress]) continue;
        const cell = plannedWorksWs[cellAddress] as any;
        if (!cell.s) cell.s = {};
        cell.s.border = {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        };
        // Header row styling
        if (R === 0) {
          cell.s.font = { bold: true };
          cell.s.fill = { fgColor: { rgb: 'F3F4F6' } };
        }
      }
    }

    // Create workbook and add sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    XLSX.utils.book_append_sheet(wb, plannedWorksWs, 'Planned Works');
    
    XLSX.writeFile(wb, formatStageShiftExportFilename(stageCode, shiftCode, planningDate, 'Work_Planning'));

    console.log('✅ Excel plan generated successfully');
  } catch (error) {
    console.error('Error generating Excel:', error);
    alert('Error generating Excel file. Please try again.');
  }
}

// Helper function to convert time string to minutes
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to format time string (HH:MM:SS to HH:MM:SS AM/PM)
function formatTimeString(timeStr: string): string {
  try {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, seconds || 0);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch {
    return timeStr;
  }
}

// Helper function to format date for summary (e.g., "08 Nov 25")
function formatDateForSummary(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return dateStr;
  }
}

