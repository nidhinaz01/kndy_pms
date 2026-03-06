import jsPDF from 'jspdf';
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
 * Generate PDF for Report tab - shows reported works with actual times and lost time
 */
export function generateReportPDF(
  reportWorks: ReportWork[],
  stageCode: string,
  shiftCode: string,
  reportingDate: string
): void {
  try {
    // Use A3 landscape for wider format
    const doc = new jsPDF('l', 'mm', 'a3');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const startY = 20;
    let currentY = startY;
    const lineHeight = 7;
    const maxY = pageHeight - margin;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const headerText = `${stageCode}${shiftCode} - Work Reporting - ${formatDateForSummary(reportingDate)}`;
    doc.text(headerText, pageWidth / 2, currentY, { align: 'center' });
    currentY += lineHeight * 2;

    // Group works
    const groupedReportWorks = groupReportWorks(reportWorks);

    // Table headers - Report tab columns (merged WO/PWO, reduced Work Name, include Lost Time Details, include Status)
    const headers = ['WO / PWO No.', 'Work Code', 'Work Name', 'Skill Competency', 'Standard Time', 'Worker', 'SC', 'Time Worked Till Date', 'From Time', 'To Time', 'Hours Worked', 'Total Hours', 'OT Hours', 'Lost Time Details', 'Status'];
    const colWidths = [22, 24, 51, 28, 22, 35, 18, 25, 18, 18, 20, 20, 18, 50, 20];
    const startX = margin;
    let x = startX;

    // Helper function to draw header with proper height for word wrap (match Plan style)
    const drawHeader = () => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(200, 200, 200);
      let maxHeight = lineHeight * 2.5;
      headers.forEach((header, index) => {
        const lines = doc.splitTextToSize(header, colWidths[index] - 2);
        const headerHeight = lines.length * lineHeight * 1.2;
        if (headerHeight > maxHeight) maxHeight = headerHeight;
      });
      if (maxHeight < lineHeight * 2.5) maxHeight = lineHeight * 2.5;
      doc.rect(startX, currentY, pageWidth - 2 * margin, maxHeight + 4, 'F');
      x = startX;
      headers.forEach((header, index) => {
        const lines = doc.splitTextToSize(header, colWidths[index] - 2);
        const verticalCenter = currentY + (maxHeight / 2) - ((lines.length - 1) * lineHeight / 2);
        lines.forEach((line: string, lineIndex: number) => {
          doc.text(line, x + 2, verticalCenter + (lineIndex * lineHeight) + 1, { maxWidth: colWidths[index] - 4, align: 'left' });
        });
        x += colWidths[index];
      });
      currentY += maxHeight + 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    };

    // Draw headers
    drawHeader();

    // Draw data rows grouped by work (keep each group's rows together on same page)
    Object.values(groupedReportWorks).forEach((group: any) => {
      const firstItem = group.items[0];

      // Precompute per-item row heights so we can keep the entire group together on a page
      const perItemRowHeights = group.items.map((report: ReportWork, index: number) => {
        const woNo = index === 0 ? (group.woNo || '') : '';
        const pwoNo = index === 0 ? (group.pwoNo || '') : '';
        let combinedWoPwo = '';
        if (index === 0) {
          const hasWo = !!woNo;
          const hasPwo = !!pwoNo;
          if (hasWo) combinedWoPwo = woNo;
          else if (hasPwo) combinedWoPwo = pwoNo;
          else combinedWoPwo = 'N/A';
        }
        const workCode = index === 0 ? (group.workCode || 'N/A') : '';
        const workName = index === 0 ? (group.workName || 'N/A') : '';
        const skillCompetency = index === 0 ? (firstItem?.prdn_work_planning?.std_work_skill_mapping?.sc_name || firstItem?.skillMapping?.sc_name || firstItem?.prdn_work_planning?.sc_required || 'N/A') : '';
        const standardTime = index === 0
          ? (firstItem?.vehicleWorkFlow?.estimated_duration_minutes
              ? formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60)
              : firstItem?.skillTimeStandard?.standard_time_minutes
                ? formatTime(firstItem.skillTimeStandard.standard_time_minutes / 60)
                : 'N/A')
          : '';
        const workerName = report.prdn_work_planning?.hr_emp?.emp_name || 'N/A';
        const skillShort = report.prdn_work_planning?.hr_emp?.skill_short || 'N/A';
        const timeWorkedTillDate = formatTime(report.hours_worked_till_date || 0);
        const fromTime = report.from_time ? formatTimeString(report.from_time) : 'N/A';
        const toTime = report.to_time ? formatTimeString(report.to_time) : 'N/A';
        const hoursWorked = formatTime(report.hours_worked_today || 0);
        const totalHours = formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0));
        const otHours = report.overtime_minutes && report.overtime_minutes > 0 ? formatTime((report.overtime_minutes || 0) / 60) : '-';
        const lostTime = report.lt_minutes_total ? `${report.lt_minutes_total} min` : '0 min';
        const lostTimeDetails = (report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0)
          ? report.lt_details.map((lt: any) => `${lt.lt_minutes} min - ${lt.lt_reason} (${lt.is_lt_payable ? 'Payable' : 'Non-Payable'})`).join('; ')
          : '';
        const status = report.completion_status === 'C' ? 'C' : report.completion_status === 'NC' ? 'NC' : '';

        const rowValues = [
          combinedWoPwo, workCode, workName, skillCompetency, standardTime,
          workerName, skillShort, timeWorkedTillDate, fromTime, toTime,
          hoursWorked, totalHours, otHours, lostTimeDetails, status
        ];

        const requiredHeights = rowValues.map((val, idx) => {
          const colW = colWidths[idx] - 4;
          const lines = doc.splitTextToSize(String(val), colW);
          return lines.length * lineHeight;
        });

        const maxRequiredHeight = Math.max(...requiredHeights, 0);
        const minHeight = lineHeight;
        return Math.max(minHeight, Math.ceil(maxRequiredHeight) + 1);
      });

      const groupHeight = perItemRowHeights.reduce((s: number, h: number) => s + h, 0);

      // If group doesn't fit, start new page
      if (currentY > maxY - groupHeight) {
        doc.addPage();
        currentY = startY;
        drawHeader();
      }

      // Draw each item row for this group using computed heights
      group.items.forEach((report: ReportWork, index: number) => {
        const rowHeight = perItemRowHeights[index];

        const woNo = index === 0 ? (group.woNo || '') : '';
        const pwoNo = index === 0 ? (group.pwoNo || '') : '';
        let combinedWoPwo = '';
        if (index === 0) {
          const hasWo = !!woNo;
          const hasPwo = !!pwoNo;
          if (hasWo) combinedWoPwo = woNo;
          else if (hasPwo) combinedWoPwo = pwoNo;
          else combinedWoPwo = 'N/A';
        }
        const workCode = index === 0 ? (group.workCode || 'N/A') : '';
        const workName = index === 0 ? (group.workName || 'N/A') : '';
        const skillCompetency = index === 0 ? (firstItem?.prdn_work_planning?.std_work_skill_mapping?.sc_name || firstItem?.skillMapping?.sc_name || firstItem?.prdn_work_planning?.sc_required || 'N/A') : '';
        const standardTime = index === 0
          ? (firstItem?.vehicleWorkFlow?.estimated_duration_minutes
              ? formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60)
              : firstItem?.skillTimeStandard?.standard_time_minutes
                ? formatTime(firstItem.skillTimeStandard.standard_time_minutes / 60)
                : 'N/A')
          : '';
        const workerName = report.prdn_work_planning?.hr_emp?.emp_name || 'N/A';
        const skillShort = report.prdn_work_planning?.hr_emp?.skill_short || 'N/A';
        const timeWorkedTillDate = formatTime(report.hours_worked_till_date || 0);
        const fromTime = report.from_time ? formatTimeString(report.from_time) : 'N/A';
        const toTime = report.to_time ? formatTimeString(report.to_time) : 'N/A';
        const hoursWorked = formatTime(report.hours_worked_today || 0);
        const totalHours = formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0));
        const otHours = report.overtime_minutes && report.overtime_minutes > 0 ? formatTime((report.overtime_minutes || 0) / 60) : '-';
        const lostTime = report.lt_minutes_total ? `${report.lt_minutes_total} min` : '0 min';
        const lostTimeDetails = (report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0)
          ? report.lt_details.map((lt: any) => `${lt.lt_minutes} min - ${lt.lt_reason} (${lt.is_lt_payable ? 'Payable' : 'Non-Payable'})`).join('; ')
          : '';
        const status = report.completion_status === 'C' ? 'C' : report.completion_status === 'NC' ? 'NC' : '';

        const rowValues = [
          combinedWoPwo, workCode, workName, skillCompetency, standardTime,
          workerName, skillShort, timeWorkedTillDate, fromTime, toTime,
          hoursWorked, totalHours, otHours, lostTimeDetails, status
        ];

        // Draw cells top-aligned
        x = startX;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        for (let i = 0; i < rowValues.length; i++) {
          const val = String(rowValues[i]);
          const lines = doc.splitTextToSize(val, colWidths[i] - 4);
          lines.forEach((line: string, li: number) => {
            doc.text(line, x + 2, currentY + (li * lineHeight));
          });
          x += colWidths[i];
        }

        currentY += rowHeight;
      });
    });

    // Build a user-friendly, unique filename and trigger direct download.
    // Filename pattern: Report - <stage> - <shift> - <dd MMM yyyy> - <YYYY-MM-DD_HH-mm-ss>.pdf
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

    const filename = `Report - ${sanitize(stageCode)} - ${sanitize(shiftCode)} - ${userDate} - ${generatedTimestamp}.pdf`;

    // Use jsPDF's save() to trigger a direct download with the chosen filename.
    doc.save(filename);
    console.log(`✅ PDF report generated and download started: ${filename}`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF file. Please try again.');
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

