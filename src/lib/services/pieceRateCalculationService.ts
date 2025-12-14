/**
 * Piece Rate Calculation Service
 * 
 * Calculates piece rates for work reports when work is marked as completed.
 * - Standard work: Based on skill competency rate and standard time
 * - Non-standard work: Based on hourly salary * 1.15 * hours worked
 * 
 * When any worker marks work as completed, piece rate is calculated for ALL
 * workers who worked on that planning_id, split by skill competency.
 */

import { supabase } from '$lib/supabaseClient';
import { getCurrentTimestamp } from '$lib/utils/userUtils';
import { fetchHolidaysByYear, getHolidayDates } from '$lib/api/holidays';

/**
 * Calculate piece rate for all reports of a planning_id when work is completed
 */
export async function calculatePieceRateForPlanning(
  planningId: number
): Promise<{ success: boolean; error?: string; calculatedCount?: number }> {
  try {
    // Get planning record to determine if it's standard or non-standard work
    const { data: planningRecord, error: planningError } = await supabase
      .from('prdn_work_planning')
      .select('id, derived_sw_code, other_work_code, wsm_id, sc_required')
      .eq('id', planningId)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .single();

    if (planningError || !planningRecord) {
      return { success: false, error: 'Planning record not found' };
    }

    // Check if any report for this planning_id is marked as completed
    const { data: reports, error: reportsError } = await supabase
      .from('prdn_work_reporting')
      .select('id, worker_id, hours_worked_today, completion_status, from_date')
      .eq('planning_id', planningId)
      .eq('is_deleted', false)
      .eq('is_active', true);

    if (reportsError || !reports || reports.length === 0) {
      return { success: false, error: 'No reports found for this planning' };
    }

    // Check if at least one report is completed
    const hasCompletedReport = reports.some(r => r.completion_status === 'C');
    if (!hasCompletedReport) {
      // If no completed reports, clear piece rate for all reports
      await clearPieceRateForPlanning(planningId);
      return { success: true, calculatedCount: 0 };
    }

    // Determine work type
    const isStandardWork = !!planningRecord.derived_sw_code;
    
    if (isStandardWork) {
      return await calculateStandardWorkPieceRate(planningId, planningRecord, reports);
    } else {
      return await calculateNonStandardWorkPieceRate(planningId, planningRecord, reports);
    }
  } catch (error) {
    console.error('Error calculating piece rate for planning:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Calculate piece rate for standard work
 */
async function calculateStandardWorkPieceRate(
  planningId: number,
  planningRecord: any,
  reports: any[]
): Promise<{ success: boolean; error?: string; calculatedCount?: number }> {
  try {
    const wsmId = planningRecord.wsm_id;
    if (!wsmId) {
      return { success: false, error: 'WSM ID not found for standard work' };
    }

    // Get skill time standards for this wsm_id
    const { data: timeStandards, error: timeStandardsError } = await supabase
      .from('std_skill_time_standards')
      .select('skill_short, standard_time_minutes')
      .eq('wsm_id', wsmId)
      .eq('is_deleted', false)
      .eq('is_active', true);

    if (timeStandardsError || !timeStandards || timeStandards.length === 0) {
      return { success: false, error: 'Time standards not found for this work' };
    }

    // Get skill combination to understand which skills are involved
    const { data: skillMapping, error: mappingError } = await supabase
      .from('std_work_skill_mapping')
      .select(`
        sc_name,
        std_skill_combinations!inner(
          skill_combination
        )
      `)
      .eq('wsm_id', wsmId)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .maybeSingle();

    if (mappingError) {
      return { success: false, error: 'Error fetching skill mapping' };
    }

    // All reports for the same planning_id have the same sc_required
    const scRequired = planningRecord.sc_required;
    if (!scRequired) {
      return { success: false, error: 'Skill competency (sc_required) not found in planning record' };
    }

    // Find the skill mapping that matches this sc_required
    // sc_required is the skill combination name (e.g., "SS", "US", "SS+US")
    // We need to find the skill combination and get the individual skills
    const skillCombination = skillMapping?.std_skill_combinations?.skill_combination;
    if (!skillCombination || !Array.isArray(skillCombination)) {
      return { success: false, error: 'Skill combination not found for this work' };
    }

    // Get all skill shorts from the combination
    const skillShorts: string[] = [];
    skillCombination.forEach((skill: any) => {
      if (skill.skill_short) {
        skillShorts.push(skill.skill_short);
      }
    });

    if (skillShorts.length === 0) {
      return { success: false, error: 'No skills found in skill combination' };
    }

    // Calculate total piece rate for this work
    // For each skill in the combination, calculate: rate_per_hour * standard_time_hours
    let totalPieceRateForWork = 0;
    let totalStandardTimeMinutes = 0;
    const skillRates = new Map<string, number>(); // skill_short -> rate_per_hour

    // Use the earliest report date to determine which rate to use
    const workDate = reports[0]?.from_date;
    if (!workDate) {
      return { success: false, error: 'Work date not found' };
    }

    for (const skillShort of skillShorts) {
      // Get standard time for this skill
      const timeStandard = timeStandards.find(ts => ts.skill_short === skillShort);
      if (!timeStandard) continue;

      const standardTimeHours = timeStandard.standard_time_minutes / 60;

      // Get rate for this skill (using wef date from the work date)
      const rate = await getApplicableSkillRate(skillShort, workDate);
      if (!rate) continue;

      skillRates.set(skillShort, rate);
      const pieceRateForThisSkill = rate * standardTimeHours;
      totalPieceRateForWork += pieceRateForThisSkill;
      totalStandardTimeMinutes += timeStandard.standard_time_minutes;
    }

    if (totalPieceRateForWork === 0) {
      return { success: false, error: 'Could not calculate piece rate (no valid rates found)' };
    }

    // Calculate total minutes worked by all workers on this planning_id
    const totalMinutesWorked = reports.reduce((sum, report) => {
      return sum + (report.hours_worked_today || 0) * 60;
    }, 0);

    if (totalMinutesWorked === 0) {
      return { success: false, error: 'No hours worked found in reports' };
    }

    const now = getCurrentTimestamp();
    let calculatedCount = 0;

    // Distribute piece rate proportionally among all workers
    for (const report of reports) {
      const workerMinutes = (report.hours_worked_today || 0) * 60;
      const prPow = totalMinutesWorked > 0 ? workerMinutes / totalMinutesWorked : 0;
      const prAmount = totalPieceRateForWork * prPow;

      // Use the average rate from all skills in the combination
      const avgRate = skillRates.size > 0 
        ? Array.from(skillRates.values()).reduce((sum, r) => sum + r, 0) / skillRates.size
        : 0;

      // Update report with piece rate
      const { error: updateError } = await supabase
        .from('prdn_work_reporting')
        .update({
          pr_amount: Math.round(prAmount * 100) / 100,
          pr_calculated_dt: now,
          pr_rate: Math.round(avgRate * 100) / 100,
          pr_std_time: totalStandardTimeMinutes,
          pr_pow: Math.round(prPow * 10000) / 10000, // Round to 4 decimal places
          pr_type: 'PR', // Piece Rate for standard work
          modified_by: (await import('$lib/utils/userUtils')).getCurrentUsername(),
          modified_dt: now
        })
        .eq('id', report.id);

      if (updateError) {
        console.error(`Error updating piece rate for report ${report.id}:`, updateError);
      } else {
        calculatedCount++;
      }
    }

    return { success: true, calculatedCount };
  } catch (error) {
    console.error('Error calculating standard work piece rate:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Calculate piece rate for non-standard work
 */
async function calculateNonStandardWorkPieceRate(
  planningId: number,
  planningRecord: any,
  reports: any[]
): Promise<{ success: boolean; error?: string; calculatedCount?: number }> {
  try {
    const now = getCurrentTimestamp();
    let calculatedCount = 0;

    // For non-standard work, calculate individually for each worker
    for (const report of reports) {
      if (!report.worker_id) {
        // Skip reports without worker (deviations)
        continue;
      }

      const hoursWorked = report.hours_worked_today || 0;
      if (hoursWorked === 0) {
        continue;
      }

      // Get employee salary
      const { data: employee, error: empError } = await supabase
        .from('hr_emp')
        .select('salary')
        .eq('emp_id', report.worker_id)
        .eq('is_deleted', false)
        .eq('is_active', true)
        .maybeSingle();

      if (empError || !employee || !employee.salary) {
        console.warn(`Employee ${report.worker_id} not found or has no salary`);
        continue;
      }

      // Calculate working days in the month of the work date
      const workDate = new Date(report.from_date);
      const year = workDate.getFullYear();
      const month = workDate.getMonth() + 1; // 1-12

      const workingDays = await calculateWorkingDaysInMonth(year, month);

      if (workingDays === 0) {
        console.warn(`No working days found for ${year}-${month}`);
        continue;
      }

      // Calculate hourly salary
      const hourlySalary = employee.salary / workingDays / 8; // Assuming 8 hours per day

      // Calculate piece rate: hourly_salary * 1.15 * hours_worked
      const prAmount = hourlySalary * 1.15 * hoursWorked;
      const prRate = hourlySalary * 1.15;

      // Update report with piece rate
      const { error: updateError } = await supabase
        .from('prdn_work_reporting')
        .update({
          pr_amount: Math.round(prAmount * 100) / 100,
          pr_calculated_dt: now,
          pr_rate: Math.round(prRate * 100) / 100,
          pr_std_time: null, // No standard time for non-standard work
          pr_pow: 1.0, // Each worker gets full amount for non-standard work
          pr_type: 'SL', // Salary for non-standard work
          modified_by: (await import('$lib/utils/userUtils')).getCurrentUsername(),
          modified_dt: now
        })
        .eq('id', report.id);

      if (updateError) {
        console.error(`Error updating piece rate for report ${report.id}:`, updateError);
      } else {
        calculatedCount++;
      }
    }

    return { success: true, calculatedCount };
  } catch (error) {
    console.error('Error calculating non-standard work piece rate:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get applicable skill rate based on wef date
 */
async function getApplicableSkillRate(
  skillShort: string,
  workDate: string
): Promise<number | null> {
  try {
    const workDateObj = new Date(workDate);
    
    // Get all rates for this skill, ordered by wef date descending
    const { data: skillRates, error } = await supabase
      .from('hr_skill_master')
      .select('rate_per_hour, wef')
      .eq('skill_short', skillShort)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .lte('wef', workDateObj.toISOString().split('T')[0]) // wef <= work_date
      .order('wef', { ascending: false }); // Latest wef first

    if (error || !skillRates || skillRates.length === 0) {
      return null;
    }

    // Return the rate with the latest wef date that is <= work_date
    return skillRates[0].rate_per_hour;
  } catch (error) {
    console.error(`Error getting skill rate for ${skillShort}:`, error);
    return null;
  }
}

/**
 * Calculate working days in a specific month (excluding weekends and holidays)
 */
async function calculateWorkingDaysInMonth(year: number, month: number): Promise<number> {
  try {
    // Get holidays for this year
    const holidays = await getHolidayDates(year, year);
    
    // Get first and last day of the month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0); // Last day of the month
    
    let workingDays = 0;
    const currentDate = new Date(firstDay);
    
    while (currentDate <= lastDay) {
      const dayOfWeek = currentDate.getDay();
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Check if it's not a holiday
        const isHolidayDate = holidays.some(holiday => 
          holiday.getFullYear() === currentDate.getFullYear() &&
          holiday.getMonth() === currentDate.getMonth() &&
          holiday.getDate() === currentDate.getDate()
        );
        
        if (!isHolidayDate) {
          workingDays++;
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  } catch (error) {
    console.error('Error calculating working days in month:', error);
    // Fallback: assume 26 working days per month
    return 26;
  }
}

/**
 * Clear piece rate for all reports of a planning_id
 */
async function clearPieceRateForPlanning(planningId: number): Promise<void> {
  try {
    const now = getCurrentTimestamp();
    const { getCurrentUsername } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();

    await supabase
      .from('prdn_work_reporting')
      .update({
        pr_amount: null,
        pr_calculated_dt: null,
        pr_rate: null,
        pr_std_time: null,
        pr_pow: null,
        pr_type: null,
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('planning_id', planningId)
      .eq('is_deleted', false);
  } catch (error) {
    console.error('Error clearing piece rate:', error);
  }
}

