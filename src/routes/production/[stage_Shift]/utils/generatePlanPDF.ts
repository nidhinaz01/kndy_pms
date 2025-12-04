import jsPDF from 'jspdf';
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

/**
 * Generate PDF for Plan tab - matches Planned Works Excel format
 * This is separate from the plan review PDF function
 */
export function generatePlanPDF(
  plannedWorks: PlannedWork[],
  stageCode: string,
  shiftCode: string,
  planningDate: string,
  shiftBreakTimes: Array<{ start_time: string; end_time: string }> = []
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

    // Header - match Excel format
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const headerText = `${stageCode}${shiftCode} - Production Plan - ${formatDateForSummary(planningDate)}`;
    doc.text(headerText, pageWidth / 2, currentY, { align: 'center' });
    currentY += lineHeight * 2;

    // Group works
    const groupedPlannedWorks = groupPlannedWorks(plannedWorks);

    // Table headers - match Excel Planned Works sheet format
    // Column widths as specified
    const headers = ['Work Order Number', 'Pre Work Order Number', 'Work Code', 'Work Name', 'Skill Competency', 'Standard Time', 'Worker', 'SC', 'Time Worked Till Date', 'From Time', 'To Time', 'Planned Hours'];
    const colWidths = [25, 25, 25, 60, 40, 25, 50, 18, 30, 30, 30, 30];
    const startX = margin;
    let x = startX;

    // Helper function to draw header with proper height for word wrap
    const drawHeader = () => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(200, 200, 200);
      
      // Calculate max height needed for headers with word wrap - increased header height
      let maxHeight = lineHeight * 2.5; // Increased from 1.5 to 2.5 for taller header
      headers.forEach((header, index) => {
        const lines = doc.splitTextToSize(header, colWidths[index] - 2);
        const headerHeight = lines.length * lineHeight * 1.2; // Add extra spacing for wrapped lines
        if (headerHeight > maxHeight) {
          maxHeight = headerHeight;
        }
      });
      
      // Ensure minimum header height
      if (maxHeight < lineHeight * 2.5) {
        maxHeight = lineHeight * 2.5;
      }
      
      doc.rect(startX, currentY, pageWidth - 2 * margin, maxHeight + 4, 'F');
      
      x = startX;
      headers.forEach((header, index) => {
        const lines = doc.splitTextToSize(header, colWidths[index] - 2);
        const verticalCenter = currentY + (maxHeight / 2) - ((lines.length - 1) * lineHeight / 2);
        lines.forEach((line: string, lineIndex: number) => {
          doc.text(line, x + 2, verticalCenter + (lineIndex * lineHeight), { maxWidth: colWidths[index] - 4, align: 'left' });
        });
        x += colWidths[index];
      });
      currentY += maxHeight + 6; // Increased spacing after header
      
      // Reset font to normal after drawing header
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    };

    // Draw initial header
    drawHeader();

    // Data rows - grouped format like Excel
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    Object.values(groupedPlannedWorks).forEach((group: any) => {
      // Get first item for group-level data (skill competency, standard time, etc.)
      const firstItem = group.items[0];
      const groupSkillCompetency = firstItem?.std_work_skill_mapping?.sc_name || firstItem?.sc_required || 'N/A';
      
      group.items.forEach((work: PlannedWork, index: number) => {
        // Check if we need a new page
        if (currentY > maxY - lineHeight * 3) {
          doc.addPage();
          currentY = startY;
          // Redraw header on new page
          drawHeader();
        }

        const workCode = work.other_work_code || work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code || 'N/A';
        const workName = work.other_work_code 
          ? (work.workAdditionData?.other_work_desc || work.other_work_code)
          : (work.std_work_type_details?.std_work_details?.sw_name || '');
        const typeDescription = work.std_work_type_details?.type_description || '';
        const fullWorkName = workName + (typeDescription ? (workName ? ' - ' : '') + typeDescription : '');

        // Calculate planned hours
        let plannedHours = work.planned_hours || 0;
        if (plannedHours === 0 && work.from_time && work.to_time) {
          const fromMinutes = timeToMinutes(work.from_time);
          const toMinutes = timeToMinutes(work.to_time);
          const breakTime = calculateBreakTimeInRange(work.from_time, work.to_time, shiftBreakTimes);
          plannedHours = (toMinutes - fromMinutes - breakTime) / 60;
        }

        // Get standard time from first item
        const standardTimeMinutes = firstItem?.vehicleWorkFlow?.estimated_duration_minutes || 
                                   firstItem?.skillTimeStandard?.standard_time_minutes || 0;
        const standardTime = standardTimeMinutes > 0 ? formatTime(standardTimeMinutes / 60) : 'N/A';

        // Format time strings
        const fromTimeFormatted = work.from_time ? formatTimeString(work.from_time) : 'N/A';
        const toTimeFormatted = work.to_time ? formatTimeString(work.to_time) : 'N/A';

        // Grouped format - work details only on first row
        // No truncation needed since word wrap is enabled
        const rowData = [
          index === 0 ? (work.prdn_wo_details?.wo_no || 'N/A') : '',
          index === 0 ? (work.prdn_wo_details?.pwo_no || 'N/A') : '',
          index === 0 ? workCode : '',
          index === 0 ? fullWorkName : '',
          index === 0 ? groupSkillCompetency : '',
          index === 0 ? standardTime : '',
          work.hr_emp?.emp_name || 'N/A',
          work.hr_emp?.skill_short || 'N/A',
          formatTime((work.time_worked_till_date || 0) / 60),
          fromTimeFormatted,
          toTimeFormatted,
          formatTime(plannedHours)
        ];

        x = startX;
        let maxRowHeight = lineHeight;
        rowData.forEach((cell, idx) => {
          const cellText = String(cell);
          if (cellText) {
            // Enable word wrap for all columns
            const lines = doc.splitTextToSize(cellText, colWidths[idx] - 4);
            const cellHeight = lines.length * lineHeight;
            if (cellHeight > maxRowHeight) {
              maxRowHeight = cellHeight;
            }
          }
        });
        
        // Draw cells with word wrap
        rowData.forEach((cell, idx) => {
          const cellText = String(cell);
          if (cellText) {
            const lines = doc.splitTextToSize(cellText, colWidths[idx] - 4);
            lines.forEach((line: string, lineIndex: number) => {
              doc.text(line, x + 2, currentY + (lineIndex * lineHeight), { maxWidth: colWidths[idx] - 4, align: 'left' });
            });
          }
          x += colWidths[idx];
        });
        currentY += maxRowHeight + 1; // Use max row height for spacing
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
    
    console.log('✅ PDF plan generated successfully and opened in new tab');
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF file. Please try again.');
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

