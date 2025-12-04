/**
 * Service for work order entry and exit operations
 */

import { supabase } from '$lib/supabaseClient';

/**
 * Get work orders waiting for entry (have planned entry date but no actual entry date)
 */
export async function getWaitingWorkOrdersForEntry(
  stageCode: string,
  selectedDate: string
): Promise<any[]> {
  try {
    const { data: waitingWorkOrders, error: waitingError } = await supabase
      .from('prdn_dates')
      .select(`
        *,
        prdn_wo_details!inner(
          id,
          wo_no,
          pwo_no,
          wo_model
        )
      `)
      .eq('stage_code', stageCode)
      .eq('date_type', 'entry')
      .is('actual_date', null)
      .order('planned_date', { ascending: true });

    if (waitingError) {
      console.error('Error fetching work orders waiting for entry:', waitingError);
      throw waitingError;
    }

    return waitingWorkOrders || [];
  } catch (error) {
    console.error(`Error getting waiting work orders for ${stageCode}:`, error);
    throw error;
  }
}

/**
 * Get available work orders for exit (have been entered but not exited)
 */
export async function getAvailableWorkOrdersForExit(
  stageCode: string
): Promise<any[]> {
  try {
    // Get work orders that have been entered (have actual entry date) but not exited
    const { data: enteredWorkOrders, error: enteredError } = await supabase
      .from('prdn_dates')
      .select(`
        *,
        prdn_wo_details!inner(
          id,
          wo_no,
          pwo_no,
          wo_model
        )
      `)
      .eq('stage_code', stageCode)
      .eq('date_type', 'entry')
      .not('actual_date', 'is', null);

    if (enteredError) {
      console.error('Error fetching entered work orders:', enteredError);
      throw enteredError;
    }

    if (!enteredWorkOrders || enteredWorkOrders.length === 0) {
      return [];
    }

    // Get work orders that have been exited (have actual exit date)
    const { data: exitedWorkOrders, error: exitedError } = await supabase
      .from('prdn_dates')
      .select('sales_order_id')
      .eq('stage_code', stageCode)
      .eq('date_type', 'exit')
      .not('actual_date', 'is', null);

    if (exitedError) {
      console.error('Error fetching exited work orders:', exitedError);
      throw exitedError;
    }

    const exitedWoIds = new Set((exitedWorkOrders || []).map((wo: any) => wo.sales_order_id));

    // Filter out already exited work orders
    const availableWorkOrders = enteredWorkOrders.filter((wo: any) => 
      !exitedWoIds.has(wo.sales_order_id)
    );

    // Remove duplicates by sales_order_id
    const uniqueWorkOrders = new Map();
    availableWorkOrders.forEach((wo: any) => {
      const woId = wo.sales_order_id;
      if (!uniqueWorkOrders.has(woId)) {
        uniqueWorkOrders.set(woId, wo);
      }
    });

    return Array.from(uniqueWorkOrders.values());
  } catch (error) {
    console.error(`Error getting available work orders for exit from ${stageCode}:`, error);
    throw error;
  }
}

/**
 * Record work order entry into a stage
 */
export async function recordWorkOrderEntry(
  stageCode: string,
  woDetailsId: number,
  woModel: string,
  entryDate: string,
  onProgress?: (message: string) => void
): Promise<{ success: boolean; statusRecordsCount: number; error?: string }> {
  try {
    onProgress?.('Fetching work type information...');
    
    // Get work type for this model
    const { data: workType, error: workTypeError } = await supabase
      .from('mstr_wo_type')
      .select('*')
      .eq('wo_type_name', woModel)
      .single();

    if (workTypeError || !workType) {
      throw new Error(`No work type found for model ${woModel}`);
    }

    // Get work flow for this work type
    onProgress?.('Fetching work flow details...');
    const { data: workFlow, error: workFlowError } = await supabase
      .from('std_vehicle_work_flow')
      .select('derived_sw_code')
      .eq('wo_type_id', workType.id)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (workFlowError || !workFlow || workFlow.length === 0) {
      throw new Error(`No work flow found for work type ${workType.id}`);
    }

    const derivedWorkCodes = workFlow.map((wf: any) => wf.derived_sw_code);

    // Get current username and timestamp
    onProgress?.('Preparing work status records...');
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    // Prepare records for prdn_work_status
    const statusRecords = derivedWorkCodes.map((derivedSwCode: string) => ({
      stage_code: stageCode,
      wo_details_id: woDetailsId,
      derived_sw_code: derivedSwCode,
      other_work_code: null,
      current_status: 'To be Planned',
      created_by: currentUser,
      created_dt: now,
      modified_by: currentUser,
      modified_dt: now
    }));

    // Insert into prdn_work_status
    onProgress?.(`Creating work status records (${statusRecords.length} works)...`);
    const { error: statusError } = await supabase
      .from('prdn_work_status')
      .insert(statusRecords);

    if (statusError) {
      console.error('Error inserting work status records:', statusError);
      throw new Error('Error creating work status records');
    }

    console.log(`✅ Created ${statusRecords.length} work status records for work order ${woDetailsId}`);

    // Update prdn_dates table with actual entry date
    onProgress?.('Updating entry date...');
    const { error: datesError } = await supabase
      .from('prdn_dates')
      .update({
        actual_date: entryDate,
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('sales_order_id', woDetailsId)
      .eq('stage_code', stageCode)
      .eq('date_type', 'entry');

    if (datesError) {
      console.error('Error updating prdn_dates:', datesError);
      throw new Error('Work status created but failed to update entry date');
    }

    console.log(`✅ Marked work order ${woDetailsId} entry on ${entryDate}`);

    // Check if this is the first entry date for this work order (across all stages)
    // and update wo_prdn_start if needed
    onProgress?.('Checking production start date...');
    const { data: allEntryDates, error: entryDatesError } = await supabase
      .from('prdn_dates')
      .select('actual_date')
      .eq('sales_order_id', woDetailsId)
      .eq('date_type', 'entry')
      .not('actual_date', 'is', null);

    if (!entryDatesError && allEntryDates && allEntryDates.length > 0) {
      // Find the earliest entry date
      const entryDates = allEntryDates
        .map((d: any) => d.actual_date)
        .filter(Boolean)
        .sort();
      
      if (entryDates.length > 0) {
        const firstEntryDate = entryDates[0];
        
        // Update wo_prdn_start with the earliest entry date
        const { error: woUpdateError } = await supabase
          .from('prdn_wo_details')
          .update({
            wo_prdn_start: firstEntryDate,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('id', woDetailsId);

        if (woUpdateError) {
          console.error('Error updating wo_prdn_start:', woUpdateError);
          // Don't throw error, just log it as this is a secondary operation
        } else {
          console.log(`✅ Updated wo_prdn_start to ${firstEntryDate} for work order ${woDetailsId}`);
        }
      }
    }
    
    return {
      success: true,
      statusRecordsCount: statusRecords.length
    };
  } catch (error) {
    console.error('Error recording work order entry:', error);
    return {
      success: false,
      statusRecordsCount: 0,
      error: (error as Error)?.message || 'Unknown error'
    };
  }
}

/**
 * Record work order exit from a stage
 */
export async function recordWorkOrderExit(
  stageCode: string,
  woDetailsId: number,
  exitDate: string,
  onProgress?: (message: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    onProgress?.('Validating work statuses...');
    
    // Validate that all works for this work order are either 'Completed' or 'Removed'
    const { data: workStatuses, error: statusError } = await supabase
      .from('prdn_work_status')
      .select('current_status')
      .eq('stage_code', stageCode)
      .eq('wo_details_id', woDetailsId);

    if (statusError) {
      throw new Error('Error validating work statuses');
    }

    if (!workStatuses || workStatuses.length === 0) {
      throw new Error('No works found for this work order. Cannot exit.');
    }

    // Check for works that are not 'Completed' or 'Removed'
    const invalidStatuses = workStatuses.filter((ws: any) => 
      ws.current_status !== 'Completed' && ws.current_status !== 'Removed'
    );

    if (invalidStatuses.length > 0) {
      const statusCounts = invalidStatuses.reduce((acc: any, ws: any) => {
        acc[ws.current_status] = (acc[ws.current_status] || 0) + 1;
        return acc;
      }, {});

      const statusMessage = Object.entries(statusCounts)
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ');

      throw new Error(`Cannot exit work order. There are works that are not completed or removed:\n\n${statusMessage}\n\nPlease ensure all works are either 'Completed' or 'Removed' before exiting.`);
    }

    // Update prdn_dates table with actual exit date
    onProgress?.('Updating exit date...');
    const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
    const currentUser = getCurrentUsername();
    const now = getCurrentTimestamp();

    const { error: datesError } = await supabase
      .from('prdn_dates')
      .update({
        actual_date: exitDate,
        modified_by: currentUser,
        modified_dt: now
      })
      .eq('sales_order_id', woDetailsId)
      .eq('stage_code', stageCode)
      .eq('date_type', 'exit');

    if (datesError) {
      console.error('Error updating prdn_dates:', datesError);
      throw new Error('Error updating exit date');
    }

    console.log(`✅ Marked work order ${woDetailsId} exit on ${exitDate}`);

    // Check if this is the last exit date for this work order (across all stages)
    // and update wo_prdn_end if needed
    onProgress?.('Checking production end date...');
    const { data: allExitDates, error: exitDatesError } = await supabase
      .from('prdn_dates')
      .select('actual_date')
      .eq('sales_order_id', woDetailsId)
      .eq('date_type', 'exit')
      .not('actual_date', 'is', null);

    if (!exitDatesError && allExitDates && allExitDates.length > 0) {
      // Find the latest exit date
      const exitDates = allExitDates
        .map((d: any) => d.actual_date)
        .filter(Boolean)
        .sort()
        .reverse(); // Sort descending to get latest first
      
      if (exitDates.length > 0) {
        const lastExitDate = exitDates[0];
        
        // Update wo_prdn_end with the latest exit date
        const { error: woUpdateError } = await supabase
          .from('prdn_wo_details')
          .update({
            wo_prdn_end: lastExitDate,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('id', woDetailsId);

        if (woUpdateError) {
          console.error('Error updating wo_prdn_end:', woUpdateError);
          // Don't throw error, just log it as this is a secondary operation
        } else {
          console.log(`✅ Updated wo_prdn_end to ${lastExitDate} for work order ${woDetailsId}`);
        }
      }
    }
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error recording work order exit:', error);
    return {
      success: false,
      error: (error as Error)?.message || 'Unknown error'
    };
  }
}

