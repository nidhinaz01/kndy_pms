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

  // Group works by work code (using groupReportWorks)
  const groupedReports = groupReportWorks(worksReportData);

  // Table headers - matching the new single-row format
  const headers = ['Work Order', 'PWO', 'Work Code', 'Work Name', 'Skills', 'Std Time', 'Status', 'Worker (Skill)', 'Till Date', 'From', 'To', 'Hours', 'Total Hours', 'OT Hours', 'Lost Time (Minutes)', 'Reason'];
  const colWidths = [18, 18, 20, 45, 30, 18, 20, 35, 18, 15, 15, 20, 20, 18, 18, 55];
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
    const rowHeight = numWorkers * lineHeight + 4; // Height based on number of workers
    
    if (currentY > maxY - rowHeight) {
      doc.addPage();
      currentY = startY;
      drawHeader(); // Redraw header on new page
    }

    // Collect all worker info for this work - each worker gets its own entry
    const workerData: Array<{
      worker: string;
      skill: string;
      status: string;
      tillDate: string;
      fromTime: string;
      toTime: string;
      hoursWorked: string;
      totalHours: string;
      otHours: string;
      lostTime: string;
      reason: string;
    }> = [];
    
    // Collect unique skills for display
    const uniqueSkills = new Set<string>();
    
    group.items.forEach((report: WorkReport) => {
      // Skills - collect all unique skills
      const skillName = report.skillMapping?.sc_name || report.prdn_work_planning?.std_work_skill_mapping?.sc_name || report.prdn_work_planning?.sc_required || 'N/A';
      uniqueSkills.add(skillName);
      
      // Worker info - fix HTML entities
      let workerText = 'No worker';
      if (report.deviations && report.deviations.length > 0) {
        const deviation = report.deviations[0];
        // Clean HTML entities
        const cleanDeviationType = deviation.deviation_type?.replace(/&nbsp;/g, ' ').replace(/&p/g, '').trim() || 'deviation';
        workerText = `⚠️ ${cleanDeviationType}`;
      } else if (report.worker_id && report.prdn_work_planning?.hr_emp) {
        const empName = report.prdn_work_planning.hr_emp.emp_name || 'N/A';
        const skillShort = report.prdn_work_planning.hr_emp.skill_short || 'N/A';
        workerText = `${empName} (${skillShort})`;
      }
      
      // Status (all workers have same status, so we'll show it once)
      const status = report.completion_status === 'C' ? 'Completed' : report.completion_status === 'NC' ? 'Not Completed' : 'Unknown';
      
      // Times - formatTime expects hours, not minutes
      const tillDate = formatTime(report.hours_worked_till_date || 0);
      const fromTime = report.from_time || 'N/A';
      const toTime = report.to_time || 'N/A';
      const hoursWorked = formatTime(report.hours_worked_today || 0);
      const totalHoursWorked = formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0));
      const otHours = report.overtime_minutes && report.overtime_minutes > 0 
        ? formatTime((report.overtime_minutes || 0) / 60) 
        : '-';
      const lostTime = report.lt_minutes_total ? `${report.lt_minutes_total}` : '0';
      
      // Lost time reason - format properly and fix encoding issues
      let reasonText = '-';
      if (report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0) {
        reasonText = report.lt_details.map(lt => {
          // Fix character encoding issues (e.g., "(Badequate" -> "Inadequate")
          let cleanReason = lt.lt_reason || 'N/A';
          // Fix common encoding issues
          cleanReason = cleanReason.replace(/\(B/g, 'In').replace(/&nbsp;/g, ' ').trim();
          return `${cleanReason} (${lt.lt_minutes}m)`;
        }).join(', ');
      }
      
      workerData.push({
        worker: workerText,
        skill: skillName,
        status,
        tillDate,
        fromTime,
        toTime,
        hoursWorked,
        totalHours: totalHoursWorked,
        otHours,
        lostTime,
        reason: reasonText
      });
    });

    // Get standard time from first item
    const firstItem = group.items[0];
    let standardTime = 'N/A';
    if (firstItem?.vehicleWorkFlow?.estimated_duration_minutes) {
      standardTime = formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60);
    } else if (firstItem?.skillTimeStandard?.standard_time_minutes) {
      standardTime = formatTime(firstItem.skillTimeStandard.standard_time_minutes / 60);
    }

    // Get status (same for all workers)
    const status = workerData[0]?.status || 'Unknown';
    
    // Build skills string (all unique skills)
    const skillsString = Array.from(uniqueSkills).join(', ');

    // Common data for the work (same across all workers)
    const workOrder = group.woNo || 'N/A';
    const pwoNo = group.pwoNo || 'N/A';
    const workCode = group.workCode || 'N/A';
    const workName = (group.workName || 'N/A').length > 35 ? (group.workName || 'N/A').substring(0, 32) + '...' : (group.workName || 'N/A');

    // Draw the row with cell borders - common columns span full height, worker columns stack
    let x = startX;
    const startRowY = currentY;
    
    // Column 1: Work Order (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[0], rowHeight, workOrder, 'left', 'middle');
    x += colWidths[0];
    
    // Column 2: PWO Number (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[1], rowHeight, pwoNo, 'left', 'middle');
    x += colWidths[1];
    
    // Column 3: Work Code (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[2], rowHeight, workCode, 'left', 'middle');
    x += colWidths[2];
    
    // Column 4: Work Name (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[3], rowHeight, workName, 'left', 'middle');
    x += colWidths[3];
    
    // Column 5: Skills (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[4], rowHeight, skillsString, 'left', 'middle');
    x += colWidths[4];
    
    // Column 6: Standard Time (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[5], rowHeight, standardTime, 'left', 'middle');
    x += colWidths[5];
    
    // Column 7: Status (spans all workers, centered vertically)
    drawCell(x, startRowY, colWidths[6], rowHeight, status, 'left', 'middle');
    x += colWidths[6];
    
    // Column 8: Worker (Skill) - one per worker, stacked vertically
    const workerTexts = workerData.map(data => data.worker);
    drawCell(x, startRowY, colWidths[7], rowHeight, workerTexts, 'left', 'top');
    x += colWidths[7];
    
    // Column 9: Till Date - one per worker, stacked vertically
    const tillDates = workerData.map(data => data.tillDate);
    drawCell(x, startRowY, colWidths[8], rowHeight, tillDates, 'left', 'top');
    x += colWidths[8];
    
    // Column 10: From Time - one per worker, stacked vertically
    const fromTimes = workerData.map(data => data.fromTime);
    drawCell(x, startRowY, colWidths[9], rowHeight, fromTimes, 'left', 'top');
    x += colWidths[9];
    
    // Column 11: To Time - one per worker, stacked vertically
    const toTimes = workerData.map(data => data.toTime);
    drawCell(x, startRowY, colWidths[10], rowHeight, toTimes, 'left', 'top');
    x += colWidths[10];
    
    // Column 12: Hours Worked - one per worker, stacked vertically
    const hoursWorked = workerData.map(data => data.hoursWorked);
    drawCell(x, startRowY, colWidths[11], rowHeight, hoursWorked, 'left', 'top');
    x += colWidths[11];
    
    // Column 13: Total Hours - one per worker, stacked vertically
    const totalHours = workerData.map(data => data.totalHours);
    drawCell(x, startRowY, colWidths[12], rowHeight, totalHours, 'left', 'top');
    x += colWidths[12];
    
    // Column 14: OT Hours - one per worker, stacked vertically
    const otHours = workerData.map(data => data.otHours);
    drawCell(x, startRowY, colWidths[13], rowHeight, otHours, 'left', 'top');
    x += colWidths[13];
    
    // Column 15: Lost Time - one per worker, stacked vertically
    const lostTimes = workerData.map(data => data.lostTime);
    drawCell(x, startRowY, colWidths[14], rowHeight, lostTimes, 'left', 'top');
    x += colWidths[14];
    
    // Column 16: Reason - one per worker, stacked vertically (with word wrap)
    const reasons = workerData.map(data => data.reason);
    drawCell(x, startRowY, colWidths[15], rowHeight, reasons, 'left', 'top');
    
    // Move to next row
    currentY += rowHeight;
  });

  return doc;
}

