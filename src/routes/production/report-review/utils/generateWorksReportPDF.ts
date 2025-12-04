import jsPDF from 'jspdf';
import { formatTime } from '../../[stage_Shift]/utils/timeUtils';
import { groupPlannedWorks } from '../../[stage_Shift]/utils/planTabUtils';

interface WorkReport {
  id: number;
  prdn_work_planning?: {
    prdn_wo_details?: { wo_no: string; pwo_no: string; wo_model?: string; customer_name?: string };
    std_work_type_details?: { derived_sw_code?: string; sw_code?: string; type_description?: string; std_work_details?: { sw_name: string } };
    other_work_code?: string;
    hr_emp?: { emp_name: string; skill_short: string };
    std_work_skill_mapping?: { sc_name?: string };
  };
  hours_worked_today?: number;
  hours_worked_till_date?: number;
  completion_status?: string;
  lt_minutes_total?: number;
  lt_details?: Array<{ lt_minutes: number; lt_reason: string; is_lt_payable: boolean; lt_value: number }>;
  from_time?: string;
  to_time?: string;
}

function formatDateForSummary(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function generateWorksReportPDF(
  worksReportData: WorkReport[],
  stageCode: string,
  reportingDate: string
): jsPDF {
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
  const headerText = `${stageCode} - Works Report - ${formatDateForSummary(reportingDate)}`;
  doc.text(headerText, pageWidth / 2, currentY, { align: 'center' });
  currentY += lineHeight * 2;

  // Group works by work code (similar to plan)
  const groupedReports = groupPlannedWorks(worksReportData.map(report => ({
    ...report,
    derived_sw_code: report.prdn_work_planning?.std_work_type_details?.derived_sw_code || report.prdn_work_planning?.other_work_code,
    hr_emp: report.prdn_work_planning?.hr_emp,
    prdn_wo_details: report.prdn_work_planning?.prdn_wo_details,
    std_work_type_details: report.prdn_work_planning?.std_work_type_details,
    std_work_skill_mapping: report.prdn_work_planning?.std_work_skill_mapping
  })));

  // Table headers
  const headers = ['Work Order', 'PWO Number', 'Work Code', 'Work Name', 'Skill Competency', 'Worker', 'SC', 'Hours Worked Today', 'Hours Worked Till Date', 'Status', 'Lost Time (min)', 'From Time', 'To Time'];
  const colWidths = [22, 22, 24, 50, 28, 30, 18, 25, 25, 20, 25, 18, 18];
  const startX = margin;

  // Helper function to draw header with proper height for word wrap
  const drawHeader = () => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(200, 200, 200);
    
    // Calculate max height needed for headers with word wrap
    let maxHeight = lineHeight * 1.5;
    headers.forEach((header, index) => {
      const lines = doc.splitTextToSize(header, colWidths[index] - 2);
      const headerHeight = lines.length * lineHeight;
      if (headerHeight > maxHeight) {
        maxHeight = headerHeight;
      }
    });
    
    doc.rect(startX, currentY, pageWidth - 2 * margin, maxHeight + 3, 'F');
    
    let x = startX;
    headers.forEach((header, index) => {
      const lines = doc.splitTextToSize(header, colWidths[index] - 2);
      lines.forEach((line: string, lineIndex: number) => {
        doc.text(line, x + 2, currentY + (lineIndex + 1) * lineHeight + 1, { maxWidth: colWidths[index] - 4, align: 'left' });
      });
      x += colWidths[index];
    });
    currentY += maxHeight + 4;
    
    // Reset font to normal after drawing header
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
  };

  // Draw initial header
  drawHeader();

  // Draw table rows
  Object.values(groupedReports).forEach((group: any) => {
    group.items.forEach((report: WorkReport, index: number) => {
      if (currentY > maxY - lineHeight * 3) {
        doc.addPage();
        currentY = startY;
        drawHeader(); // Redraw header on new page
      }

      const workCode = report.prdn_work_planning?.std_work_type_details?.derived_sw_code || report.prdn_work_planning?.other_work_code || 'N/A';
      const fullWorkName = report.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || 
                          report.prdn_work_planning?.std_work_type_details?.type_description || 'N/A';

      const rowData = [
        index === 0 ? (report.prdn_work_planning?.prdn_wo_details?.wo_no || 'N/A') : '',
        index === 0 ? (report.prdn_work_planning?.prdn_wo_details?.pwo_no || 'N/A') : '',
        index === 0 ? workCode : '',
        index === 0 ? (fullWorkName.length > 40 ? fullWorkName.substring(0, 37) + '...' : fullWorkName) : '',
        report.prdn_work_planning?.std_work_skill_mapping?.sc_name || 'N/A',
        report.prdn_work_planning?.hr_emp?.emp_name || 'N/A',
        report.prdn_work_planning?.hr_emp?.skill_short || 'N/A',
        formatTime((report.hours_worked_today || 0) * 60),
        formatTime((report.hours_worked_till_date || 0) * 60),
        report.completion_status === 'C' ? 'Completed' : 'Not Completed',
        String(report.lt_minutes_total || 0),
        report.from_time || 'N/A',
        report.to_time || 'N/A'
      ];

      let x = startX;
      rowData.forEach((cell, idx) => {
        doc.text(String(cell), x, currentY);
        x += colWidths[idx];
      });
      currentY += lineHeight;
    });
  });

  return doc;
}

