import * as XLSX from 'xlsx';
import { groupReportWorks } from './planTabUtils';
import { formatTime } from './timeUtils';

interface ReportWork {
  id: number;
  planning_id: number;
  worker_id: string;
  from_date: string;
  from_time: string;
  to_date: string;
  to_time: string;
  hours_worked_till_date: number;
  hours_worked_today: number;
  completion_status: 'C' | 'NC';
  lt_minutes_total?: number;
  lt_details?: Array<{ lt_minutes: number; lt_reason: string; is_lt_payable: boolean; lt_value: number }>;
  overtime_minutes?: number | null;
  overtime_amount?: number | null;
  prdn_work_planning?: any;
  vehicleWorkFlow?: any;
  skillTimeStandard?: any;
  skillMapping?: any;
  workAdditionData?: any;
  remainingTimeMinutes?: number;
  created_dt?: string;
}

/**
 * Generate Excel for Report tab - shows reported works with actual times and lost time
 */
export function generateReportExcel(
  reportWorks: ReportWork[],
  stageCode: string,
  shiftCode: string,
  reportingDate: string
): void {
  try {
    // Group works
    const groupedReportWorks = groupReportWorks(reportWorks);

    // Prepare data for Excel - flatten grouped structure
    const reportData: any[] = [];
    
    Object.values(groupedReportWorks).forEach((group: any) => {
      group.items.forEach((report: ReportWork, index: number) => {
        const planning = report.prdn_work_planning;
        
        // Work Code and Work Name - only show for first item in group
        const workCode = index === 0 
          ? (planning?.other_work_code || planning?.std_work_type_details?.derived_sw_code || planning?.std_work_type_details?.sw_code || 'N/A')
          : '';
        
        let workName = '';
        if (index === 0) {
          if (planning?.other_work_code) {
            workName = report.workAdditionData?.other_work_desc || planning.other_work_code || 'N/A';
          } else {
            const swName = planning?.std_work_type_details?.std_work_details?.sw_name || '';
            const typeDesc = planning?.std_work_type_details?.type_description || '';
            workName = swName + (typeDesc ? (swName ? ' - ' : '') + typeDesc : '') || 'N/A';
          }
        }

        // Standard Time - only show for first item in group
        const standardTime = index === 0
          ? (report.vehicleWorkFlow?.estimated_duration_minutes 
              ? formatTime(report.vehicleWorkFlow.estimated_duration_minutes / 60)
              : report.skillTimeStandard?.standard_time_minutes
                ? formatTime(report.skillTimeStandard.standard_time_minutes / 60)
                : 'N/A')
          : '';

        reportData.push({
          'Work Order Number': index === 0 ? (group.woNo || 'N/A') : '',
          'Pre Work Order Number': index === 0 ? (group.pwoNo || 'N/A') : '',
          'Work Code': workCode,
          'Work Name': workName,
          'Skill Competency': report.skillMapping?.sc_name || planning?.sc_required || 'N/A',
          'Standard Time': standardTime,
          'Worker': planning?.hr_emp?.emp_name || 'N/A',
          'SC': planning?.hr_emp?.skill_short || 'N/A',
          'Time Worked Till Date': formatTime(report.hours_worked_till_date || 0),
          'From Time': report.from_time || 'N/A',
          'To Time': report.to_time || 'N/A',
          'Hours Worked': formatTime(report.hours_worked_today || 0),
          'Total Hours Worked': formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0)),
          'OT Hours': report.overtime_minutes && report.overtime_minutes > 0 ? formatTime((report.overtime_minutes || 0) / 60) : '-',
          'Lost Time (minutes)': report.lt_minutes_total || 0,
          'Lost Time Details': report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0
            ? report.lt_details.map((lt: any) => `${lt.lt_minutes} min - ${lt.lt_reason} (${lt.is_lt_payable ? 'Payable' : 'Non-Payable'})`).join('; ')
            : '',
          'Status': report.completion_status === 'C' ? 'Completed' : report.completion_status === 'NC' ? 'Not Completed' : 'Unknown',
          'Reported On': report.created_dt 
            ? new Date(report.created_dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
            : 'N/A'
        });
      });
    });

    // Create Summary sheet
    const totalReports = reportWorks.length;
    const completedReports = reportWorks.filter(r => r.completion_status === 'C').length;
    const notCompletedReports = reportWorks.filter(r => r.completion_status === 'NC').length;
    const totalLostTime = reportWorks.reduce((sum, r) => sum + (r.lt_minutes_total || 0), 0);
    const uniqueWorks = Object.keys(groupedReportWorks).length;

    const summaryData = [
      { Metric: 'Stage', Value: `${stageCode}${shiftCode}` },
      { Metric: 'Reporting Date', Value: formatDateForSummary(reportingDate) },
      { Metric: 'Total Reported Works', Value: totalReports },
      { Metric: 'Unique Works', Value: uniqueWorks },
      { Metric: 'Completed', Value: completedReports },
      { Metric: 'Not Completed', Value: notCompletedReports },
      { Metric: 'Total Lost Time (minutes)', Value: totalLostTime },
      { Metric: 'Total Lost Time (hours)', Value: (totalLostTime / 60).toFixed(2) }
    ];

    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    summaryWs['!cols'] = [
      { wch: 30 },
      { wch: 20 }
    ];

    // Create Reported Works sheet
    const reportedWorksWs = XLSX.utils.json_to_sheet(reportData);

    // Set column widths for Reported Works
    reportedWorksWs['!cols'] = [
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
      { wch: 15 }, // Hours Worked
      { wch: 18 }, // Total Hours Worked
      { wch: 15 }, // OT Hours
      { wch: 18 }, // Lost Time (minutes)
      { wch: 50 }, // Lost Time Details
      { wch: 15 }, // Status
      { wch: 25 }  // Reported On
    ];

    // Add borders and styling to Reported Works sheet
    const range = XLSX.utils.decode_range(reportedWorksWs['!ref'] || 'A1');
    for (let R = 0; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!reportedWorksWs[cellAddress]) continue;
        const cell = reportedWorksWs[cellAddress] as any;
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

    // Add borders and styling to Summary sheet
    const summaryRange = XLSX.utils.decode_range(summaryWs['!ref'] || 'A1');
    for (let R = 0; R <= summaryRange.e.r; R++) {
      for (let C = 0; C <= summaryRange.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!summaryWs[cellAddress]) continue;
        const cell = summaryWs[cellAddress] as any;
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
    XLSX.utils.book_append_sheet(wb, reportedWorksWs, 'Reported Works');
    
    XLSX.writeFile(wb, formatStageShiftExportFilename(stageCode, shiftCode, reportingDate, 'Work_Reporting'));

    console.log('✅ Excel report generated successfully');
  } catch (error) {
    console.error('Error generating Excel:', error);
    alert('Error generating Excel file. Please try again.');
  }
}

// Helper function to format date for summary
function formatDateForSummary(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch (error) {
    return dateStr;
  }
}

// Helper function to format filename
function formatStageShiftExportFilename(stageCode: string, shiftCode: string, date: string, type: string): string {
  const dateStr = new Date(date).toISOString().split('T')[0];
  return `${stageCode}${shiftCode}_${type}_${dateStr}.xlsx`;
}

