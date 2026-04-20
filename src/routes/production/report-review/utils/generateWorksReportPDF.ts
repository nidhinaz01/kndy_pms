import jsPDF from 'jspdf';
import { formatTime } from '../../[stage_Shift]/utils/timeUtils';
import { groupReportWorks } from '../../[stage_Shift]/utils/planTabUtils';

interface WorkReport {
  id: number;
  prdn_work_planning?: {
    prdn_wo_details?: { wo_no: string; pwo_no: string; wo_model?: string; customer_name?: string };
    std_work_type_details?: { derived_sw_code?: string; sw_code?: string; type_description?: string; std_work_details?: { sw_name: string } };
    other_work_code?: string;
    hr_emp?: { emp_name: string; skill_short: string };
    std_work_skill_mapping?: { sc_name?: string };
    sc_required?: string;
  };
  hours_worked_today?: number;
  hours_worked_till_date?: number;
  completion_status?: string;
  overtime_minutes?: number | null;
  lt_minutes_total?: number;
  lt_details?: Array<{ lt_minutes: number; lt_reason: string; is_lt_payable: boolean; lt_value: number }>;
  from_time?: string;
  to_time?: string;
  skillMapping?: { sc_name?: string };
  skillTimeStandard?: { standard_time_minutes: number };
  vehicleWorkFlow?: { estimated_duration_minutes: number };
  deviations?: Array<{ deviation_type: string; reason: string }>;
  worker_id?: string | null;
}

interface ReportPdfOptions {
  compact?: boolean;
}

function formatDateForSummary(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function generateCompactWorksReportPDF(
  worksReportData: WorkReport[],
  stageCode: string,
  reportingDate: string
): jsPDF {
  const doc = new jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const rowHeight = 7;
  const maxY = pageHeight - margin;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Works Report', pageWidth / 2, y, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Stage: ${stageCode}`, margin, y);
  doc.text(`Date: ${formatDateForSummary(reportingDate)}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  const headers = ['WO', 'Work Code', 'Worker', 'Hours', 'Total', 'Status'];
  const widths = [28, 44, 58, 22, 24, 34];
  const drawHeader = () => {
    let x = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(220, 220, 220);
    doc.rect(margin, y, widths.reduce((a, b) => a + b, 0), rowHeight + 1, 'F');
    headers.forEach((h, i) => {
      doc.text(h, x + 2, y + 5);
      x += widths[i];
    });
    y += rowHeight + 1;
    doc.setFont('helvetica', 'normal');
  };

  drawHeader();

  for (const report of worksReportData || []) {
    if (y + rowHeight > maxY) {
      doc.addPage();
      y = 16;
      drawHeader();
    }
    const plan = report.prdn_work_planning;
    const wo = plan?.prdn_wo_details?.wo_no || 'N/A';
    const code =
      plan?.other_work_code ||
      plan?.std_work_type_details?.derived_sw_code ||
      plan?.std_work_type_details?.sw_code ||
      'N/A';
    const worker = plan?.hr_emp?.emp_name || report.worker_id || 'N/A';
    const hours = formatTime(report.hours_worked_today || 0);
    const total = formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0));
    const status =
      report.completion_status === 'C'
        ? 'Completed'
        : report.completion_status === 'NC'
          ? 'Not Completed'
          : 'Unknown';

    const values = [wo, code, worker, hours, total, status];
    let x = margin;
    values.forEach((v, i) => {
      const clipped = doc.splitTextToSize(String(v), widths[i] - 3)[0] || '';
      doc.text(clipped, x + 1.5, y + 5);
      x += widths[i];
    });
    y += rowHeight;
  }

  return doc;
}

export function generateWorksReportPDF(
  worksReportData: WorkReport[],
  stageCode: string,
  reportingDate: string,
  options: ReportPdfOptions = {}
): jsPDF {
  if (options.compact) {
    return generateCompactWorksReportPDF(worksReportData, stageCode, reportingDate);
  }
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

  // Group works by work code (using groupReportWorks)
  const groupedReports = groupReportWorks(worksReportData);

  // Table headers - matching the new single-row format
  const headers = ['Work Order', 'PWO', 'Work Code', 'Work Name', 'Skills', 'Std Time', 'Status', 'Worker (Skill)', 'Till Date', 'From', 'To', 'Hours', 'Total Hours', 'OT Hours', 'Lost Time (Minutes)', 'Reason'];
  // Adjusted widths to match Plan PDF feel (wider Work Name column) and reduce wrapping
  const colWidths = [18, 18, 20, 60, 30, 18, 20, 35, 18, 15, 15, 20, 20, 18, 18, 55];
  const startX = margin;

  // Helper function to draw header with proper height for word wrap
  const drawHeader = () => {
    // Match Plan PDF header sizing: slightly taller headers and use same header font size
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(200, 200, 200);
    
    // Calculate max height needed for headers with word wrap - use multiplier like Plan
    let maxHeight = lineHeight * 2.5;
    headers.forEach((header, index) => {
      const lines = doc.splitTextToSize(header, colWidths[index] - 2);
      const headerHeight = lines.length * lineHeight * 1.2; // extra spacing for wrapped lines
      if (headerHeight > maxHeight) {
        maxHeight = headerHeight;
      }
    });
    
    if (maxHeight < lineHeight * 2.5) maxHeight = lineHeight * 2.5;
    
    doc.rect(startX, currentY, pageWidth - 2 * margin, maxHeight + 4, 'F');
    
    let x = startX;
    headers.forEach((header, index) => {
      const lines = doc.splitTextToSize(header, colWidths[index] - 2);
      const verticalCenter = currentY + (maxHeight / 2) - ((lines.length - 1) * lineHeight / 2);
      lines.forEach((line: string, lineIndex: number) => {
        doc.text(line, x + 2, verticalCenter + (lineIndex * lineHeight) + 1, { maxWidth: colWidths[index] - 4, align: 'left' });
      });
      x += colWidths[index];
    });
    currentY += maxHeight + 6;
    
    // Reset font to normal after drawing header and set data font to match Plan
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  // Draw initial header
  drawHeader();

  // Helper function to draw a cell with border and text
  const drawCell = (x: number, y: number, width: number, height: number, text: string | string[], align: 'left' | 'center' | 'right' = 'left', verticalAlign: 'top' | 'middle' | 'bottom' = 'top') => {
    // Draw cell border
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.rect(x, y, width, height);
    
    // Calculate total text height
    let totalTextHeight = 0;
    if (Array.isArray(text)) {
      // For arrays, calculate total height needed
      text.forEach(line => {
        const wrappedLines = doc.splitTextToSize(line, width - 4);
        totalTextHeight += wrappedLines.length * lineHeight;
      });
    } else {
      const wrappedLines = doc.splitTextToSize(text, width - 4);
      totalTextHeight = wrappedLines.length * lineHeight;
    }
    
    // Calculate text Y position based on vertical alignment
    let textY = y + 2; // Default top padding
    if (verticalAlign === 'middle') {
      textY = y + (height - totalTextHeight) / 2 + lineHeight;
    } else if (verticalAlign === 'bottom') {
      textY = y + height - totalTextHeight - 2;
    }
    
    // Draw text
    if (Array.isArray(text)) {
      // Multiple items - stack vertically (one per worker)
      let currentTextY = textY;
      text.forEach((line, idx) => {
        const wrappedLines = doc.splitTextToSize(line, width - 4);
        wrappedLines.forEach((splitLine: string, lineIdx: number) => {
          const textX = align === 'center' ? x + (width - doc.getTextWidth(splitLine)) / 2 : 
                       align === 'right' ? x + width - doc.getTextWidth(splitLine) - 2 : 
                       x + 2;
          doc.text(splitLine, textX, currentTextY + (lineIdx * lineHeight));
        });
        // Move to next item (worker)
        currentTextY += wrappedLines.length * lineHeight;
      });
    } else {
      // Single text - may wrap to multiple lines
      const wrappedLines = doc.splitTextToSize(text, width - 4);
      wrappedLines.forEach((line: string, lineIdx: number) => {
        const textX = align === 'center' ? x + (width - doc.getTextWidth(line)) / 2 : 
                     align === 'right' ? x + width - doc.getTextWidth(line) - 2 : 
                     x + 2;
        doc.text(line, textX, textY + (lineIdx * lineHeight));
      });
    }
  };

  // Draw table rows - single row per work with all workers stacked vertically
  Object.values(groupedReports).forEach((group: any) => {
    const numWorkers = group.items.length;

    // Build column texts (single or array) in the same order as columns drawn below
    const workOrder = group.woNo || 'N/A';
    const pwoNo = group.pwoNo || 'N/A';
    const workCode = group.workCode || 'N/A';
    // Use full workName (no truncation) and let wrapping handle width
    const workName = group.workName || 'N/A';
    const uniqueSkills = new Set<string>();
    group.items.forEach((r: any) => {
      const skillName = r.skillMapping?.sc_name || r.prdn_work_planning?.std_work_skill_mapping?.sc_name || r.prdn_work_planning?.sc_required || 'N/A';
      uniqueSkills.add(skillName);
    });
    const skillsString = Array.from(uniqueSkills).join(', ');
    const firstItem = group.items[0];
    const standardTime = firstItem?.vehicleWorkFlow?.estimated_duration_minutes
      ? formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60)
      : firstItem?.skillTimeStandard?.standard_time_minutes
        ? formatTime(firstItem.skillTimeStandard.standard_time_minutes / 60)
        : 'N/A';
    const status = group.items[0] ? (group.items[0].completion_status === 'C' ? 'Completed' : group.items[0].completion_status === 'NC' ? 'Not Completed' : 'Unknown') : 'Unknown';

    const workerTexts = group.items.map((it: any) => {
      if (it.deviations && it.deviations.length > 0) {
        const d = it.deviations[0];
        const cleanDeviationType = d.deviation_type?.replace(/&nbsp;/g, ' ').replace(/&p/g, '').trim() || 'deviation';
        return `⚠️ ${cleanDeviationType}`;
      } else if (it.worker_id && it.prdn_work_planning?.hr_emp) {
        const empName = it.prdn_work_planning.hr_emp.emp_name || 'N/A';
        const skillShort = it.prdn_work_planning.hr_emp.skill_short || 'N/A';
        return `${empName} (${skillShort})`;
      } else {
        return 'No worker';
      }
    });
    const tillDates = group.items.map((it: any) => formatTime(it.hours_worked_till_date || 0));
    const fromTimes = group.items.map((it: any) => it.from_time || 'N/A');
    const toTimes = group.items.map((it: any) => it.to_time || 'N/A');
    const hoursWorked = group.items.map((it: any) => formatTime(it.hours_worked_today || 0));
    const totalHours = group.items.map((it: any) => formatTime((it.hours_worked_till_date || 0) + (it.hours_worked_today || 0)));
    const otHours = group.items.map((it: any) => (it.overtime_minutes && it.overtime_minutes > 0) ? formatTime((it.overtime_minutes || 0) / 60) : '-');
    const lostTimes = group.items.map((it: any) => it.lt_minutes_total ? `${it.lt_minutes_total}` : '0');
    const reasons = group.items.map((it: any) => {
      if (it.lt_details && Array.isArray(it.lt_details) && it.lt_details.length > 0) {
        return it.lt_details.map((lt: any) => lt.lt_reason?.replace(/\(B/g, 'In').replace(/&nbsp;/g, ' ').trim() || 'N/A').join(', ');
      }
      return '-';
    });

    // Prepare column texts array for height calculation
    const columnValues: Array<string | string[]> = [
      workOrder,
      pwoNo,
      workCode,
      workName,
      skillsString,
      standardTime,
      status,
      workerTexts,
      tillDates,
      fromTimes,
      toTimes,
      hoursWorked,
      totalHours,
      otHours,
      lostTimes,
      reasons
    ];

    // Calculate required heights per column using splitTextToSize logic
    let requiredHeights: number[] = columnValues.map((val, idx) => {
      const colW = colWidths[idx] - 4;
      if (Array.isArray(val)) {
        // sum wrapped lines for each item
        let linesCount = 0;
        val.forEach(item => {
          const lines = doc.splitTextToSize(String(item), colW);
          linesCount += lines.length;
        });
        return linesCount * lineHeight;
      } else {
        const lines = doc.splitTextToSize(String(val), colW);
        return lines.length * lineHeight;
      }
    });

    const maxRequiredHeight = Math.max(...requiredHeights, 0);
    const minHeight = numWorkers * lineHeight + 1;
    const rowHeight = Math.max(minHeight, Math.ceil(maxRequiredHeight) + 1);

    if (currentY > maxY - rowHeight) {
      doc.addPage();
      currentY = startY;
      drawHeader(); // Redraw header on new page
    }

    // (Using values computed earlier: firstItem, standardTime, workOrder/pwoNo/workCode/workName)

    // Draw the row with cell borders - common columns span full height, worker columns stack
    let x = startX;
    const startRowY = currentY;
    
    // Column 1: Work Order (spans all workers, top aligned to match Plan)
    drawCell(x, startRowY, colWidths[0], rowHeight, workOrder, 'left', 'top');
    x += colWidths[0];
    
    // Column 2: PWO Number (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[1], rowHeight, pwoNo, 'left', 'top');
    x += colWidths[1];
    
    // Column 3: Work Code (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[2], rowHeight, workCode, 'left', 'top');
    x += colWidths[2];
    
    // Column 4: Work Name (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[3], rowHeight, workName, 'left', 'top');
    x += colWidths[3];
    
    // Column 5: Skills (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[4], rowHeight, skillsString, 'left', 'top');
    x += colWidths[4];
    
    // Column 6: Standard Time (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[5], rowHeight, standardTime, 'left', 'top');
    x += colWidths[5];
    
    // Column 7: Status (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[6], rowHeight, status, 'left', 'top');
    x += colWidths[6];
    
    // Column 8: Worker (Skill) - one per worker, stacked vertically
    drawCell(x, startRowY, colWidths[7], rowHeight, workerTexts, 'left', 'top');
    x += colWidths[7];
    
    // Column 9: Till Date - one per worker, stacked vertically (use arrays computed above)
    drawCell(x, startRowY, colWidths[8], rowHeight, tillDates, 'left', 'top');
    x += colWidths[8];
    
    // Column 10: From Time - one per worker, stacked vertically
    drawCell(x, startRowY, colWidths[9], rowHeight, fromTimes, 'left', 'top');
    x += colWidths[9];
    
    // Column 11: To Time - one per worker, stacked vertically
    drawCell(x, startRowY, colWidths[10], rowHeight, toTimes, 'left', 'top');
    x += colWidths[10];
    
    // Column 12: Hours Worked - one per worker, stacked vertically
    drawCell(x, startRowY, colWidths[11], rowHeight, hoursWorked, 'left', 'top');
    x += colWidths[11];
    
    // Column 13: Total Hours - one per worker, stacked vertically
    drawCell(x, startRowY, colWidths[12], rowHeight, totalHours, 'left', 'top');
    x += colWidths[12];
    
    // Column 14: OT Hours - one per worker, stacked vertically
    drawCell(x, startRowY, colWidths[13], rowHeight, otHours, 'left', 'top');
    x += colWidths[13];
    
    // Column 15: Lost Time - one per worker, stacked vertically
    drawCell(x, startRowY, colWidths[14], rowHeight, lostTimes, 'left', 'top');
    x += colWidths[14];
    
    // Column 16: Reason - one per worker, stacked vertically (with word wrap)
    drawCell(x, startRowY, colWidths[15], rowHeight, reasons, 'left', 'top');
    
    // Move to next row
    currentY += rowHeight;
  });

  return doc;
}

