import * as XLSX from 'xlsx';
import { groupReportWorks } from './planTabUtils';
import { formatTime } from './timeUtils';
import { formatManpowerAttendanceLong } from '$lib/utils/manpowerAttendanceStatus';
import { getWorkDisplayCode, getWorkDisplayName } from '$lib/utils/workDisplayUtils';

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
  reportingDate: string,
  manpowerEmployees: any[] = []
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
          ? (getWorkDisplayCode(planning) || 'N/A')
          : '';
        
        const workName = index === 0 ? (getWorkDisplayName({ ...report, ...planning, prdn_work_planning: planning }) || 'N/A') : '';

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
          'From Date': report.from_date || 'N/A',
          'From Time': report.from_time || 'N/A',
          'To Date': report.to_date || 'N/A',
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

    // Create Worker Summary sheet (from Manpower Report data)
    // Columns: Employee, Skill, Attendance Status, Hours Planned, Hours Reported, Manpower OT, Work OT, LT Hours, ...
    const workerSummaryData = (manpowerEmployees || []).map(emp => ({
      'Employee': emp.emp_name || '',
      'Skill': emp.skill_short || '',
      'Attendance Status': formatManpowerAttendanceLong(emp.attendance_status),
      'Hours Planned': emp.hours_planned != null ? emp.hours_planned : '',
      'Hours Reported': emp.hours_reported != null ? emp.hours_reported : 0,
      'Manpower OT (h)': emp.manpower_ot_hours != null ? emp.manpower_ot_hours : 0,
      'Work OT (h)': emp.ot_hours != null ? emp.ot_hours : 0,
      'LT Hours': emp.lt_hours != null ? emp.lt_hours : 0,
      'LTP Hours': emp.ltp_hours != null ? emp.ltp_hours : 0,
      'LTNP Hours': emp.ltnp_hours != null ? emp.ltnp_hours : 0,
      'To Other Stage': emp.to_other_stage_hours != null ? emp.to_other_stage_hours : 0,
      'From Other Stage': emp.from_other_stage_hours != null ? emp.from_other_stage_hours : 0
    })).sort((a, b) => {
      const na = (a.Employee || '').toLowerCase();
      const nb = (b.Employee || '').toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });

    const workerSummaryWs = XLSX.utils.json_to_sheet(workerSummaryData);
    // Set some reasonable column widths
    workerSummaryWs['!cols'] = [
      { wch: 30 }, // Employee
      { wch: 10 }, // Skill
      { wch: 18 }, // Attendance Status
      { wch: 15 }, // Hours Planned
      { wch: 15 }, // Hours Reported
      { wch: 14 }, // Manpower OT
      { wch: 12 }, // Work OT
      { wch: 12 }, // LT Hours
      { wch: 12 }, // LTP Hours
      { wch: 12 }, // LTNP Hours
      { wch: 15 }, // To Other Stage
      { wch: 15 }  // From Other Stage
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
      { wch: 14 }, // From Date
      { wch: 12 }, // From Time
      { wch: 14 }, // To Date
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
    XLSX.utils.book_append_sheet(wb, workerSummaryWs, 'Worker Summary');
    XLSX.utils.book_append_sheet(wb, reportedWorksWs, 'Reported Works');
    
    // Build filename with generated timestamp similar to PDF naming:
    // Report - <stage> - <shift> - <dd MMM yyyy> - <YYYY-MM-DD_HH-mm-ss>.xlsx
    const generatedAt = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const generatedTimestamp = `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())}_${pad(generatedAt.getHours())}-${pad(generatedAt.getMinutes())}-${pad(generatedAt.getSeconds())}`;
    const userDate = (() => {
      try {
        const d = new Date(reportingDate);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        return reportingDate;
      }
    })();
    const sanitize = (s: string) => String(s || '').replace(/[\/\\:<>?"|*]/g, '-').trim();
    const filename = `Report - ${sanitize(stageCode)} - ${sanitize(shiftCode)} - ${userDate} - ${generatedTimestamp}.xlsx`;
    XLSX.writeFile(wb, filename);

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

