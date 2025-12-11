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

    // Table headers - Report tab columns
    const headers = ['Work Order', 'PWO Number', 'Work Code', 'Work Name', 'Skill Competency', 'Standard Time', 'Worker', 'SC', 'Time Worked Till Date', 'From Time', 'To Time', 'Hours Worked', 'Total Hours', 'OT Hours', 'Lost Time', 'Status', 'Reported On'];
    const colWidths = [22, 22, 24, 50, 28, 22, 35, 18, 25, 18, 18, 20, 20, 18, 20, 20, 30];
    const startX = margin;
    let x = startX;

    // Helper function to draw header with proper height for word wrap
    function drawHeader(text: string, x: number, y: number, width: number): number {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const lines = doc.splitTextToSize(text, width);
      lines.forEach((line: string, index: number) => {
        doc.text(line, x, y + (index * lineHeight));
      });
      return lines.length * lineHeight;
    }

    // Draw headers
    headers.forEach((header, idx) => {
      const headerHeight = drawHeader(header, x, currentY, colWidths[idx]);
      x += colWidths[idx];
    });
    currentY += lineHeight * 2 + 2;

    // Draw data rows
    Object.values(groupedReportWorks).forEach((group: any) => {
      const firstItem = group.items[0];
      
      group.items.forEach((report: ReportWork, index: number) => {
        // Check if we need a new page
        if (currentY > maxY - lineHeight * 3) {
          doc.addPage();
          currentY = startY;
          
          // Redraw headers on new page
          x = startX;
          headers.forEach((header, idx) => {
            const headerHeight = drawHeader(header, x, currentY, colWidths[idx]);
            x += colWidths[idx];
          });
          currentY += lineHeight * 2 + 2;
        }

        x = startX;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');

        // Work Order Number - only show for first item in group
        const woNo = index === 0 ? (group.woNo || 'N/A') : '';
        doc.text(woNo, x, currentY);
        x += colWidths[0];

        // Pre Work Order Number - only show for first item in group
        const pwoNo = index === 0 ? (group.pwoNo || 'N/A') : '';
        doc.text(pwoNo, x, currentY);
        x += colWidths[1];

        // Work Code - only show for first item in group
        const workCode = index === 0 ? (group.workCode || 'N/A') : '';
        doc.text(workCode, x, currentY);
        x += colWidths[2];

        // Work Name - only show for first item in group
        const workName = index === 0 ? (group.workName || 'N/A') : '';
        const workNameLines = doc.splitTextToSize(workName, colWidths[3]);
        workNameLines.forEach((line: string, lineIdx: number) => {
          doc.text(line, x, currentY + (lineIdx * lineHeight));
        });
        x += colWidths[3];

        // Skill Competency - only show for first item in group
        const skillCompetency = index === 0 ? (report.skillMapping?.sc_name || report.prdn_work_planning?.sc_required || 'N/A') : '';
        doc.text(skillCompetency, x, currentY);
        x += colWidths[4];

        // Standard Time - only show for first item in group
        const standardTime = index === 0 
          ? (report.vehicleWorkFlow?.estimated_duration_minutes 
              ? formatTime(report.vehicleWorkFlow.estimated_duration_minutes / 60) 
              : report.skillTimeStandard?.standard_time_minutes 
                ? formatTime(report.skillTimeStandard.standard_time_minutes / 60)
                : 'N/A')
          : '';
        doc.text(standardTime, x, currentY);
        x += colWidths[5];

        // Worker
        const workerName = report.prdn_work_planning?.hr_emp?.emp_name || 'N/A';
        doc.text(workerName, x, currentY);
        x += colWidths[6];

        // SC (Skill Short)
        const skillShort = report.prdn_work_planning?.hr_emp?.skill_short || 'N/A';
        doc.text(skillShort, x, currentY);
        x += colWidths[7];

        // Time Worked Till Date
        const timeWorkedTillDate = formatTime(report.hours_worked_till_date || 0);
        doc.text(timeWorkedTillDate, x, currentY);
        x += colWidths[8];

        // From Time
        doc.text(report.from_time || 'N/A', x, currentY);
        x += colWidths[9];

        // To Time
        doc.text(report.to_time || 'N/A', x, currentY);
        x += colWidths[10];

        // Hours Worked (Today)
        const hoursWorked = formatTime(report.hours_worked_today || 0);
        doc.text(hoursWorked, x, currentY);
        x += colWidths[11];

        // Total Hours Worked
        const totalHours = formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0));
        doc.text(totalHours, x, currentY);
        x += colWidths[12];

        // OT Hours
        const otHours = report.overtime_minutes && report.overtime_minutes > 0 
          ? formatTime((report.overtime_minutes || 0) / 60)
          : '-';
        if (report.overtime_minutes && report.overtime_minutes > 0) {
          doc.setTextColor(255, 140, 0); // Orange color for OT
        }
        doc.text(otHours, x, currentY);
        doc.setTextColor(0, 0, 0); // Reset to black
        x += colWidths[13];

        // Lost Time
        const lostTime = report.lt_minutes_total ? `${report.lt_minutes_total} min` : '0 min';
        if (report.lt_minutes_total && report.lt_minutes_total > 0) {
          doc.setTextColor(255, 165, 0); // Orange color for lost time
        }
        doc.text(lostTime, x, currentY);
        doc.setTextColor(0, 0, 0); // Reset to black
        x += colWidths[14];

        // Status
        const status = report.completion_status === 'C' ? 'Completed' : report.completion_status === 'NC' ? 'Not Completed' : 'Unknown';
        doc.text(status, x, currentY);
        x += colWidths[15];

        // Reported On
        const reportedOn = report.created_dt 
          ? new Date(report.created_dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
          : 'N/A';
        doc.text(reportedOn, x, currentY);
        x += colWidths[16];

        currentY += lineHeight + 1;
      });
    });

    // Generate PDF blob and open in new tab
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    
    // Clean up the URL after a delay to free memory
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 100);
    
    console.log('✅ PDF report generated successfully and opened in new tab');
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

