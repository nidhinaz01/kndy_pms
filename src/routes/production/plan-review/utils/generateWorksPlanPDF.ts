import jsPDF from 'jspdf';
import { formatTime, calculateBreakTimeInRange } from '../../[stage_Shift]/utils/timeUtils';
import { groupPlannedWorks } from '../../[stage_Shift]/utils/planTabUtils';

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
  remainingTimeMinutes?: number;
  workLifecycleStatus?: string;
}

export function generateWorksPlanPDF(
  worksPlanData: PlannedWork[],
  stageCode: string,
  planningDate: string,
  shiftBreakTimes: Array<{ start_time: string; end_time: string }> = []
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
  doc.text('Works Plan', pageWidth / 2, currentY, { align: 'center' });
  currentY += lineHeight;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Stage: ${stageCode}`, margin, currentY);
  doc.text(`Date: ${new Date(planningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += lineHeight * 1.5;

  // Group works using the same function as Plan tab
  const groupedPlannedWorks = groupPlannedWorks(worksPlanData);

  // Table headers - matching Plan tab column order (Status removed)
  // Increased column widths to use more of the page width
  const headers = ['Work Order', 'PWO Number', 'Work Code', 'Work Name', 'Skills Required', 'Standard Time', 'Worker', 'SC', 'From Time', 'To Time', 'Planned Hours', 'Time Worked', 'Remaining Time'];
  const colWidths = [22, 22, 24, 55, 28, 22, 35, 24, 18, 18, 22, 22, 22];
  const startX = margin;
  let x = startX;

  // Helper function to draw header with proper height for word wrap
  const drawHeader = () => {
    doc.setFontSize(10);
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
    
    x = startX;
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
    doc.setFontSize(10);
  };

  // Draw initial header
  drawHeader();

  // Draw table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  Object.values(groupedPlannedWorks).forEach((group) => {
    const workCode = group.workCode;
    const woNo = group.woNo;
    const pwoNo = group.pwoNo;
    const workName = group.workName;
    
    // Get first item for group-level data
    const firstItem = group.items[0];
    // Get all skills required from std_work_skill_mapping for this work
    // Collect unique skill combinations from all items in the group
    const skillMappings = new Set<string>();
    group.items.forEach(item => {
      // Try to get skill from std_work_skill_mapping first
      if (item.std_work_skill_mapping?.sc_name) {
        skillMappings.add(item.std_work_skill_mapping.sc_name);
      } else if (item.sc_required) {
        // Fallback to sc_required if mapping not available
        skillMappings.add(item.sc_required);
      }
    });
    const allSkillsRequired = skillMappings.size > 0 ? Array.from(skillMappings).join(' + ') : 'N/A';
    const standardTime = firstItem?.vehicleWorkFlow?.estimated_duration_minutes 
      ? formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60)
      : (firstItem?.skillTimeStandard?.standard_time_minutes 
          ? formatTime(firstItem.skillTimeStandard.standard_time_minutes / 60)
          : 'N/A');

    // Calculate total height needed for all skill rows in this group
    const skillRowHeights: number[] = [];
    group.items.forEach((work) => {
      const worker = work.hr_emp?.emp_name || 'N/A';
      const workerSkill = work.hr_emp?.skill_short || 'N/A';
      const fromTime = work.from_time || 'N/A';
      const toTime = work.to_time || 'N/A';
      
      let plannedHours = work.planned_hours || 0;
      if (plannedHours === 0 && work.from_time && work.to_time) {
        try {
          const from = new Date(`2000-01-01T${work.from_time}`);
          const to = new Date(`2000-01-01T${work.to_time}`);
          if (to < from) to.setDate(to.getDate() + 1);
          const totalHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
          const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time, shiftBreakTimes);
          const breakHours = breakMinutes / 60;
          plannedHours = totalHours - breakHours;
        } catch (error) {
          console.error('Error calculating planned hours:', error);
        }
      }
      const hoursText = plannedHours > 0 ? formatTime(plannedHours) : 'N/A';
      const timeWorked = work.time_worked_till_date ? formatTime(work.time_worked_till_date) : '0h 0m';
      const remainingTime = work.remaining_time ? formatTime(work.remaining_time) : 'N/A';

      // Calculate row height for skill-specific columns only
      const skillRowData = [worker, workerSkill, fromTime, toTime, hoursText, timeWorked, remainingTime];
      let rowHeight = lineHeight * 1.5;
      skillRowData.forEach((text, idx) => {
        const colIndex = 6 + idx; // Start from column 6 (Worker)
        const lines = doc.splitTextToSize(String(text), colWidths[colIndex] - 4);
        const cellHeight = lines.length * lineHeight + 2;
        if (cellHeight > rowHeight) {
          rowHeight = cellHeight;
        }
      });
      skillRowHeights.push(rowHeight);
    });

    // Calculate merged cell height (total height of all skill rows)
    const mergedCellHeight = skillRowHeights.reduce((sum, h) => sum + h + 2, 0) - 2; // Subtract last spacing
    
    // Check if we need a new page before starting the group
    if (currentY + mergedCellHeight > maxY - lineHeight * 2) {
      doc.addPage();
      currentY = startY;
      drawHeader();
    }

    const groupStartY = currentY;

    // Ensure font is normal for data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Draw merged cells for first 6 columns (Work Order, PWO Number, Work Code, Work Name, Skills Required, Standard Time)
    const mergedData = [woNo, pwoNo, workCode, workName, allSkillsRequired, standardTime];
    x = startX;
    mergedData.forEach((text, colIndex) => {
      const lines = doc.splitTextToSize(String(text), colWidths[colIndex] - 4);
      // Center vertically in merged cell
      const textStartY = groupStartY + (mergedCellHeight / 2) - ((lines.length - 1) * lineHeight / 2);
      lines.forEach((line: string, lineIndex: number) => {
        doc.text(line, x + 2, textStartY + (lineIndex * lineHeight), { maxWidth: colWidths[colIndex] - 4, align: 'left' });
      });
      
      // Draw vertical borders for merged cell
      doc.setDrawColor(200, 200, 200);
      doc.line(x, groupStartY, x, groupStartY + mergedCellHeight);
      x += colWidths[colIndex];
    });
    // Draw right border of merged cells
    doc.line(x, groupStartY, x, groupStartY + mergedCellHeight);

    // Draw individual skill rows with skill-specific data
    let skillRowY = groupStartY;
    group.items.forEach((work, itemIndex) => {
      const worker = work.hr_emp?.emp_name || 'N/A';
      const workerSkill = work.hr_emp?.skill_short || 'N/A';
      const fromTime = work.from_time || 'N/A';
      const toTime = work.to_time || 'N/A';
      
      let plannedHours = work.planned_hours || 0;
      if (plannedHours === 0 && work.from_time && work.to_time) {
        try {
          const from = new Date(`2000-01-01T${work.from_time}`);
          const to = new Date(`2000-01-01T${work.to_time}`);
          if (to < from) to.setDate(to.getDate() + 1);
          const totalHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
          const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time, shiftBreakTimes);
          const breakHours = breakMinutes / 60;
          plannedHours = totalHours - breakHours;
        } catch (error) {
          console.error('Error calculating planned hours:', error);
        }
      }
      const hoursText = plannedHours > 0 ? formatTime(plannedHours) : 'N/A';
      const timeWorked = work.time_worked_till_date ? formatTime(work.time_worked_till_date) : '0h 0m';
      const remainingTime = work.remaining_time ? formatTime(work.remaining_time) : 'N/A';

      const rowHeight = skillRowHeights[itemIndex];
      const skillRowData = [worker, workerSkill, fromTime, toTime, hoursText, timeWorked, remainingTime];
      
      // Draw skill-specific columns (starting from column 6)
      x = startX;
      // Skip first 6 columns (merged)
      for (let i = 0; i < 6; i++) {
        x += colWidths[i];
      }
      
      skillRowData.forEach((text, idx) => {
        const colIndex = 6 + idx;
        const lines = doc.splitTextToSize(String(text), colWidths[colIndex] - 4);
        lines.forEach((line: string, lineIndex: number) => {
          doc.text(line, x + 2, skillRowY + (lineIndex + 1) * lineHeight + 1, { maxWidth: colWidths[colIndex] - 4, align: 'left' });
        });
        
        // Draw vertical borders
        doc.setDrawColor(200, 200, 200);
        doc.line(x, skillRowY, x, skillRowY + rowHeight);
        x += colWidths[colIndex];
      });
      
      // Draw horizontal border between rows
      doc.setDrawColor(200, 200, 200);
      doc.line(startX, skillRowY + rowHeight, pageWidth - margin, skillRowY + rowHeight);
      
      skillRowY += rowHeight + 2;
    });
    
    // Draw top border for the entire group
    doc.setDrawColor(200, 200, 200);
    doc.line(startX, groupStartY, pageWidth - margin, groupStartY);
    
    // Draw bottom border for the entire group
    doc.line(startX, groupStartY + mergedCellHeight, pageWidth - margin, groupStartY + mergedCellHeight);
    
    currentY = groupStartY + mergedCellHeight + 2;
  });

  return doc;
}

