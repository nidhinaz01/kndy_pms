/**
 * Service for loading production data for a specific stage and shift combination
 */

import { supabase } from '$lib/supabaseClient';
import { fetchProductionEmployees, fetchProductionWorks, fetchWorkPlanning } from '$lib/api/production';
import type { ProductionEmployee, ProductionWork } from '$lib/api/production';

/**
 * Get metadata about why employees might be empty for a stage-shift-date combination
 * This helps the UI show appropriate warning messages
 */
export async function getManpowerLoadMetadata(
  stageCode: string,
  shiftCode: string,
  date: string,
  mode: 'planning' | 'reporting' | 'current' = 'current'
): Promise<{
  reason: 'no_shift_schedule' | 'no_employees' | 'no_shift_match' | 'null_shift_codes' | 'success';
  availableShiftCodes?: string[];
  totalEmployees?: number;
  nullShiftCodeCount?: number;
}> {
  try {
    const dateStr = date.split('T')[0];
    
    // Check for shift schedules
    const { data: shiftSchedules } = await supabase
      .from('hr_daily_shift_schedule')
      .select('shift_id')
      .eq('schedule_date', dateStr)
      .eq('is_working_day', true)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (!shiftSchedules || shiftSchedules.length === 0) {
      return { reason: 'no_shift_schedule' };
    }
    
    // Fetch all employees for the stage
    const allEmployees = await fetchProductionEmployees(stageCode, dateStr, mode);
    
    if (allEmployees.length === 0) {
      return { reason: 'no_employees' };
    }
    
    // Analyze shift code distribution
    const shiftCodeCounts = new Map<string, number>();
    const nullShiftCodes: string[] = [];
    allEmployees.forEach(emp => {
      const shift = emp.shift_code || null;
      if (shift === null || shift === undefined) {
        nullShiftCodes.push(emp.emp_id || 'unknown');
      } else {
        shiftCodeCounts.set(shift, (shiftCodeCounts.get(shift) || 0) + 1);
      }
    });
    
    // Check if any employees match the shift code
    const hasMatchingShift = Array.from(shiftCodeCounts.keys()).some(
      code => code.toUpperCase() === shiftCode.toUpperCase()
    );
    
    if (!hasMatchingShift && nullShiftCodes.length === 0) {
      return {
        reason: 'no_shift_match',
        availableShiftCodes: Array.from(shiftCodeCounts.keys()),
        totalEmployees: allEmployees.length
      };
    }
    
    if (nullShiftCodes.length > 0 && !hasMatchingShift) {
      return {
        reason: 'null_shift_codes',
        availableShiftCodes: Array.from(shiftCodeCounts.keys()),
        totalEmployees: allEmployees.length,
        nullShiftCodeCount: nullShiftCodes.length
      };
    }
    
    return { reason: 'success' };
  } catch (error) {
    console.error('Error getting manpower load metadata:', error);
    return { reason: 'no_employees' }; // Default to no employees on error
  }
}

/**
 * Load manpower data for a specific stage and shift
 * Note: This wraps fetchProductionEmployees and filters by shift_code
 */
export async function loadStageManpower(
  stageCode: string,
  shiftCode: string,
  date: string,
  mode: 'planning' | 'reporting' | 'current' = 'current'
): Promise<ProductionEmployee[]> {
  try {
    // Ensure date is in YYYY-MM-DD format (no time component)
    const dateStr = date.split('T')[0];
    console.log(`🔍 loadStageManpower called with:`, {
      stageCode,
      shiftCode,
      date,
      dateStr,
      mode
    });
    
    // Check for shift schedules first
    const { data: shiftSchedules, error: scheduleError } = await supabase
      .from('hr_daily_shift_schedule')
      .select('shift_id')
      .eq('schedule_date', dateStr)
      .eq('is_working_day', true)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (scheduleError) {
      console.error('❌ Error fetching shift schedules:', scheduleError);
      throw scheduleError;
    }

    if (!shiftSchedules || shiftSchedules.length === 0) {
      console.warn(`⚠️ No active shift schedules found for date: ${dateStr}. Employees cannot be loaded without shift schedules.`);
      // Return empty array - the UI will show a warning
      return [];
    }
    
    // Fetch all employees for the stage
    const allEmployees = await fetchProductionEmployees(stageCode, dateStr, mode);
    console.log(`📊 fetchProductionEmployees returned ${allEmployees.length} employees for stage ${stageCode}`);
    
    // Case 2: No employees assigned to stage (but shift schedules exist)
    if (allEmployees.length === 0) {
      console.warn(`⚠️ No employees found for stage ${stageCode} on ${dateStr}, but shift schedules exist.`);
      // Return empty array - UI will show appropriate message
      return [];
    }
    
    // Debug: Log shift_code distribution
    const shiftCodeCounts = new Map<string, number>();
    const nullShiftCodes: string[] = [];
    allEmployees.forEach(emp => {
      const shift = emp.shift_code || null;
      if (shift === null || shift === undefined) {
        nullShiftCodes.push(emp.emp_id || 'unknown');
      } else {
        shiftCodeCounts.set(shift, (shiftCodeCounts.get(shift) || 0) + 1);
      }
    });
    console.log(`📊 Shift code distribution:`, Object.fromEntries(shiftCodeCounts));
    if (nullShiftCodes.length > 0) {
      console.log(`⚠️ Found ${nullShiftCodes.length} employees with null/undefined shift_code:`, nullShiftCodes);
    }
    console.log(`🔍 Filtering for shiftCode="${shiftCode}" (normalized: "${shiftCode.toUpperCase()}")`);
    
    // Filter by shift_code
    const filteredEmployees = allEmployees.filter(emp => {
      const empShiftCode = emp.shift_code?.toUpperCase();
      const targetShiftCode = shiftCode.toUpperCase();
      const matches = empShiftCode === targetShiftCode;
      if (!matches && allEmployees.length <= 10) {
        // Log details for small datasets
        console.log(`  - ${emp.emp_id} (${emp.emp_name}): shift_code="${emp.shift_code}" (normalized: "${empShiftCode}") ${matches ? '✓' : '✗'}`);
      }
      return matches;
    });
    
    console.log(`✅ Filtered result: ${filteredEmployees.length} employees for ${stageCode}-${shiftCode} on ${dateStr} (mode: ${mode})`);
    
    // Case 3: Employees exist but none match the shift code
    if (filteredEmployees.length === 0 && allEmployees.length > 0) {
      const availableShiftCodes = Array.from(shiftCodeCounts.keys());
      console.warn(`⚠️ No employees matched shiftCode "${shiftCode}" but ${allEmployees.length} employees were found for stage ${stageCode}`);
      console.warn(`   Available shift codes: ${availableShiftCodes.length > 0 ? availableShiftCodes.join(', ') : 'none (all have null shift_code)'}`);
    }
    
    // Case 4: Some employees have null shift_code
    if (nullShiftCodes.length > 0 && filteredEmployees.length === 0) {
      console.warn(`⚠️ ${nullShiftCodes.length} employee(s) have null/undefined shift_code and cannot be matched`);
    }
    
    return filteredEmployees;
  } catch (error) {
    console.error(`❌ Error loading manpower for ${stageCode}-${shiftCode}:`, error);
    throw error;
  }
}

/**
 * Load work orders data for a specific stage
 */
export async function loadStageWorkOrders(
  stageCode: string,
  date: string
): Promise<any[]> {
  try {
    console.log(`🔍 Loading work orders for ${stageCode} on date: ${date}`);
    
    // Get all prdn_dates records for the stage (both entry and exit)
    const { data: allDates, error: datesError } = await supabase
      .from('prdn_dates')
      .select(`
        *,
        prdn_wo_details!inner(
          id,
          wo_no,
          wo_model,
          customer_name,
          pwo_no
        )
      `)
      .eq('stage_code', stageCode)
      .order('planned_date', { ascending: true });

    if (datesError) {
      console.error('Error loading work orders data:', datesError);
      throw datesError;
    }

    // Group dates by sales_order_id to get complete work order information
    const workOrderMap = new Map();
    
    allDates?.forEach(dateRecord => {
      const salesOrderId = dateRecord.sales_order_id;
      
      if (!workOrderMap.has(salesOrderId)) {
        workOrderMap.set(salesOrderId, {
          sales_order_id: salesOrderId,
          prdn_wo_details: dateRecord.prdn_wo_details,
          entryDates: [],
          exitDates: [],
          documentReleaseDates: []
        });
      }
      
      const workOrder = workOrderMap.get(salesOrderId);
      
      if (dateRecord.date_type === 'entry') {
        workOrder.entryDates.push({
          planned_date: dateRecord.planned_date,
          actual_date: dateRecord.actual_date,
          stage_code: dateRecord.stage_code
        });
      } else if (dateRecord.date_type === 'exit') {
        workOrder.exitDates.push({
          planned_date: dateRecord.planned_date,
          actual_date: dateRecord.actual_date,
          stage_code: dateRecord.stage_code
        });
      } else if (dateRecord.date_type === 'rnd_documents') {
        workOrder.documentReleaseDates.push({
          planned_date: dateRecord.planned_date,
          actual_date: dateRecord.actual_date,
          stage_code: dateRecord.stage_code
        });
      }
    });

    // Convert map to array
    const workOrdersArray = Array.from(workOrderMap.values());
    
    // Fetch actual start dates from work reporting for all work orders
    const salesOrderIds = workOrdersArray.map(wo => wo.sales_order_id);
    
    if (salesOrderIds.length > 0) {
      const { data: reportingData, error: reportingError } = await supabase
        .from('prdn_work_reporting')
        .select(`
          from_date,
          from_time,
          prdn_work_planning!inner(
            wo_details_id,
            stage_code
          )
        `)
        .eq('prdn_work_planning.stage_code', stageCode)
        .in('prdn_work_planning.wo_details_id', salesOrderIds)
        .order('from_date', { ascending: true })
        .order('from_time', { ascending: true })
        .limit(1);

      if (!reportingError && reportingData && reportingData.length > 0) {
        // Group by wo_details_id to get earliest start date for each work order
        const startDateMap = new Map();
        reportingData.forEach((report: any) => {
          const woId = report.prdn_work_planning?.wo_details_id;
          if (woId) {
            const reportDate = report.from_date;
            if (!startDateMap.has(woId) || reportDate < startDateMap.get(woId)) {
              startDateMap.set(woId, reportDate);
            }
          }
        });

        // Add actual start date to work orders
        workOrdersArray.forEach((workOrder: any) => {
          workOrder.actualStartDate = startDateMap.get(workOrder.sales_order_id) || null;
        });
      }
    }

    // Process work orders to determine current stage
    const workOrdersData = await Promise.all(
      workOrdersArray.map(async (workOrder: any) => {
        const { entryDates, exitDates } = workOrder;
        
        if (entryDates.length === 0) {
          workOrder.currentStage = 'N/A';
        } else {
          // Sort entries by actual_date descending (most recent first)
          entryDates.sort((a: any, b: any) => {
            const dateA = new Date(a.actual_date || '').getTime();
            const dateB = new Date(b.actual_date || '').getTime();
            return dateB - dateA;
          });
          
          // Check each entry to see if it has a corresponding exit
          let currentStage = 'Completed';
          for (const entry of entryDates) {
            const hasExit = exitDates.some((exit: any) => 
              exit.stage_code === entry.stage_code
            );
            
            if (!hasExit) {
              // This is the current stage - has entry but no exit
              currentStage = entry.stage_code || 'N/A';
              break;
            }
          }
          workOrder.currentStage = currentStage;
        }
        
        return workOrder;
      })
    );

    console.log(`📦 Active Work Orders found for ${stageCode} on ${date}:`, workOrdersData.length);
    return workOrdersData;
  } catch (error) {
    console.error('Error loading work orders data:', error);
    throw error;
  }
}

/**
 * Load works data for a specific stage
 */
export async function loadStageWorks(
  stageCode: string,
  date: string
): Promise<ProductionWork[]> {
  try {
    const works = await fetchProductionWorks(stageCode, date);
    console.log(`✅ Loaded ${works.length} works for ${stageCode} on ${date}`);
    return works;
  } catch (error) {
    console.error(`Error loading works for ${stageCode}:`, error);
    throw error;
  }
}

/**
 * Load planned works data for a specific stage
 */
export async function loadStagePlannedWorks(
  stageCode: string,
  date: string,
  status?: 'draft' | 'approved' | 'pending_approval' | 'rejected' | 'planned'
): Promise<any[]> {
  try {
    // Ensure date is in YYYY-MM-DD format for the query
    const dateStr = date instanceof Date 
      ? date.toISOString().split('T')[0]
      : date.split('T')[0];
    
    const plannedWorks = await fetchWorkPlanning(stageCode, dateStr, status);
    console.log(`📋 Loaded ${plannedWorks.length} planned works for ${stageCode} on ${dateStr}${status ? ` with status ${status}` : ''}`);
    return plannedWorks;
  } catch (error) {
    console.error(`Error loading planned works for ${stageCode}:`, error);
    throw error;
  }
}

/**
 * Load shift break times for a specific date
 */
export async function loadShiftBreakTimes(date: string): Promise<Array<{ start_time: string; end_time: string }>> {
  try {
    // Get shift schedule for the selected date
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('hr_daily_shift_schedule')
      .select(`
        shift_id,
        hr_shift_master!inner(
          shift_id,
          shift_code,
          shift_name
        )
      `)
      .eq('schedule_date', date)
      .eq('is_working_day', true)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .limit(1);

    if (scheduleError) {
      console.error('Error loading shift schedule:', scheduleError);
      return [];
    }

    if (!scheduleData || scheduleData.length === 0) {
      console.log('⚠️ No shift schedule found for date:', date);
      return [];
    }

    const shiftId = (scheduleData[0].hr_shift_master as any)?.shift_id;
    if (!shiftId) {
      return [];
    }

    // Fetch break times for this shift
    const { data: breakData, error: breakError } = await supabase
      .from('hr_shift_break_master')
      .select('start_time, end_time')
      .eq('shift_id', shiftId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('start_time', { ascending: true });

    if (breakError) {
      console.error('Error loading break times:', breakError);
      return [];
    }

    const breakTimes = breakData || [];
    console.log(`🕐 Loaded ${breakTimes.length} break times for shift ${shiftId}`);
    return breakTimes;
  } catch (error) {
    console.error('Error loading shift break times:', error);
    return [];
  }
}

/**
 * Load report data for a specific stage
 */
export async function loadStageReports(
  stageCode: string,
  date: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('prdn_work_reporting')
      .select(`
        *,
        prdn_work_planning!inner(
          *,
          std_work_type_details(
            *,
            std_work_details(sw_name)
          ),
          hr_emp!inner(emp_name, skill_short),
          prdn_wo_details!inner(wo_no, pwo_no, wo_model, customer_name),
          std_work_skill_mapping(
            wsm_id,
            sc_name
          )
        )
      `)
      .eq('prdn_work_planning.stage_code', stageCode)
      .gte('from_date', date)
      .lte('from_date', date)
      .eq('status', 'approved')
      .eq('is_deleted', false);

    if (error) throw error;
    
    // Enrich with skill-specific time standards and vehicle work flow
    const enrichedReportData = await Promise.all(
      (data || []).map(async (report) => {
        const planningRecord = report.prdn_work_planning;
        const derivedSwCode = planningRecord.std_work_type_details?.derived_sw_code;
        const otherWorkCode = planningRecord.other_work_code;
        const skillShort = planningRecord.hr_emp?.skill_short;
        const scRequired = planningRecord.sc_required;
        
        // For non-standard works, fetch work addition data
        let workAdditionData = null;
        if (otherWorkCode) {
          try {
            let query = supabase
              .from('prdn_work_additions')
              .select('other_work_code, other_work_desc, other_work_sc')
              .eq('other_work_code', otherWorkCode)
              .eq('stage_code', stageCode);
            
            // Include wo_details_id in filter if available for more precise matching
            if (report.wo_details_id) {
              query = query.eq('wo_details_id', report.wo_details_id);
            }
            
            const { data: additionData, error: additionError } = await query.limit(1).maybeSingle();
            
            if (additionError) {
              // Log the error but don't throw - this is non-critical data
              console.warn(`Error fetching work addition data for ${otherWorkCode} in ${stageCode}:`, additionError);
            } else {
              workAdditionData = additionData;
            }
          } catch (error) {
            // Log but don't throw - this is enrichment data, not critical
            console.warn(`Error fetching work addition data for ${otherWorkCode}:`, error);
          }
        }
        
        // For non-standard works (other_work_code), skip skill time standard enrichment
        if (otherWorkCode) {
          return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: null, workAdditionData: workAdditionData };
        }
        
        // Fetch vehicle work flow
        let vehicleWorkFlow = null;
        if (derivedSwCode) {
          try {
            const { data: vwfData } = await supabase
              .from('std_vehicle_work_flow')
              .select('estimated_duration_minutes')
              .eq('derived_sw_code', derivedSwCode)
              .eq('is_deleted', false)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            vehicleWorkFlow = vwfData;
          } catch (error) {
            console.error('Error fetching vehicle work flow:', error);
          }
        }
        
        if (!derivedSwCode || !skillShort || !scRequired) {
          return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow, workAdditionData: workAdditionData };
        }

        // Find skill combination that contains the required skill
        let matchingWsm = null;
        try {
          const { data: allMappings } = await supabase
            .from('std_work_skill_mapping')
            .select(`
              wsm_id,
              sc_name,
              std_skill_combinations!inner(
                skill_combination
              )
            `)
            .eq('derived_sw_code', derivedSwCode)
            .eq('is_deleted', false)
            .eq('is_active', true);

          if (allMappings && allMappings.length > 0) {
            for (const mapping of allMappings) {
              const skillCombination = (mapping as any).std_skill_combinations?.skill_combination;
              if (skillCombination && Array.isArray(skillCombination)) {
                const hasSkill = skillCombination.some((skill: any) => 
                  skill.skill_name === scRequired || skill.skill_short === scRequired
                );
                if (hasSkill) {
                  matchingWsm = mapping;
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching skill mappings:', error);
        }

        if (!matchingWsm) {
          return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow, workAdditionData: workAdditionData };
        }

        // Get skill time standard
        let skillTimeStandard = null;
        try {
          const { data: stsData } = await supabase
            .from('std_skill_time_standards')
            .select('*')
            .eq('wsm_id', matchingWsm.wsm_id)
            .eq('skill_short', scRequired)
            .eq('is_deleted', false)
            .eq('is_active', true)
            .maybeSingle();
          skillTimeStandard = stsData;
        } catch (error) {
          console.error('Error fetching skill time standard:', error);
        }

        const planningWsm = planningRecord.std_work_skill_mapping;
        const finalSkillMapping = planningWsm || matchingWsm;
        
        // Calculate remaining time
        const hoursWorkedTillDate = report.hours_worked_till_date || 0;
        const hoursWorkedToday = report.hours_worked_today || 0;
        const remainingTimeMinutes = skillTimeStandard 
          ? Math.max(0, skillTimeStandard.standard_time_minutes - ((hoursWorkedTillDate + hoursWorkedToday) * 60))
          : 0;
        
        return {
          ...report,
          vehicleWorkFlow,
          skillTimeStandard,
          remainingTimeMinutes,
          skillMapping: finalSkillMapping,
          workAdditionData: workAdditionData
        };
      })
    );
    
    console.log(`📊 Loaded ${enrichedReportData.length} reports for ${stageCode} on ${date}`);
    return enrichedReportData;
  } catch (error) {
    console.error(`Error loading reports for ${stageCode}:`, error);
    throw error;
  }
}

