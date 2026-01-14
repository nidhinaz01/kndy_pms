<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Calendar, CheckCircle, AlertCircle, CheckSquare } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { fetchHolidays } from '$lib/api/planning';
  import { theme } from '$lib/stores/theme';
  import { calculateDateAfter, isHoliday } from '$lib/utils/dateCalculationUtils';
  import { formatDateWithWeekday, formatDateTime } from '$lib/utils/formatDate';
  import { 
    calculateExitTimeWithShifts,
    clearShiftInfoCache,
    getShiftInfoForDate
  } from '$lib/utils/stageDateCalculationUtils';

  const dispatch = createEventDispatcher();

  export let showModal = false;
  export let workOrder: any = null;
  export let selectedSlot: any = null;
  export let calculatedDates: any = null;
  export let isPastEntryMode = false; // Whether this is a past entry

  // State
  let isLoading = false;
  let error = '';
  let holidays: any[] = [];
  let stageDates: Array<{
    stage: string;
    entryDate: string;
    exitDate: string;
    entryTime: string;
    exitTime: string;
    leadTime: number;
  }> = [];

  async function loadStageDates() {
    try {
      isLoading = true;
      error = '';

      // Load holidays for date calculations
      const currentYear = new Date().getFullYear();
      holidays = await fetchHolidays(currentYear);

      // Get stage order for this work order type
      console.log('Loading stage order for work order model:', workOrder.wo_model);
      const { data: stageOrderData, error: stageError } = await supabase
        .from('plan_wo_stage_order')
        .select('*')
        .eq('wo_type_name', workOrder.wo_model)
        .order('order_no', { ascending: true });

      if (stageError) {
        console.error('Error loading stage order:', stageError);
        throw new Error(`Error loading stage order: ${stageError.message}`);
      }

      console.log('Stage order data found:', stageOrderData);

      // Check if any stages were found
      if (!stageOrderData || stageOrderData.length === 0) {
        throw new Error(`No production stages found for work order type "${workOrder.wo_model}". Please configure stage order and lead times in the Lead Times page.`);
      }

      // Calculate stage dates and times sequentially
      // Use productionEntryTime if available (for past entries), otherwise use selectedSlot.time
      const entryTime = calculatedDates.productionEntryTime || selectedSlot.time;
      let currentDateTime = new Date(calculatedDates.productionEntryDate + 'T' + entryTime);
      stageDates = [];
      clearShiftInfoCache(); // Clear cache for new calculation

      for (const stage of stageOrderData || []) {
        const entryDateTime = new Date(currentDateTime);
        
        // Calculate exit time using actual shift schedules, breaks, weekends, and holidays
        // Now uses the shift associated with this stage via hr_shift_stage_master
        const exitDateTime = await calculateExitTimeWithShifts(
          entryDateTime,
          stage.lead_time_hours,
          stage.plant_stage,
          holidays
        );

        const stageData = {
          stage: stage.plant_stage,
          entryDate: entryDateTime.toISOString().split('T')[0],
          exitDate: exitDateTime.toISOString().split('T')[0],
          entryTime: entryDateTime.toTimeString().slice(0, 5),
          exitTime: exitDateTime.toTimeString().slice(0, 5),
          leadTime: stage.lead_time_hours
        };
        console.log('Adding stage data:', stageData);
        stageDates.push(stageData);

        // Find next available entry slot for the next stage
        currentDateTime = await findNextAvailableEntrySlot(exitDateTime);
      }

    } catch (err) {
      console.error('Error loading stage dates:', err as Error);
      error = (err as Error).message || 'Failed to calculate stage dates';
    } finally {
      isLoading = false;
    }
  }

  function validateDateTimeCombination(): boolean {
    if (!selectedSlot?.date || !selectedSlot?.time) {
      error = 'Invalid date-time combination: Missing date or time slot';
      return false;
    }

    // Skip past date validation if this is a past entry mode
    if (!isPastEntryMode) {
      // Validate that the selected date is not in the past
      const selectedDate = new Date(selectedSlot.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        error = 'Cannot schedule production for past dates';
        return false;
      }
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(selectedSlot.time)) {
      error = 'Invalid time format. Please use HH:MM format';
      return false;
    }

    return true;
  }

  async function handleSave() {
    try {
      isLoading = true;
      error = '';

      // Validate date-time combination
      if (!validateDateTimeCombination()) {
        return;
      }

      // Validate that stages are loaded
      if (!stageDates || stageDates.length === 0) {
        error = 'No production stages available. Please ensure stage order and lead times are configured for this work order type.';
        isLoading = false;
        return;
      }

      // Get current username (throws error if not found)
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      const now = getCurrentTimestamp();

      // Save all dates to prdn_dates table
      // Use productionEntryTime if available (for past entries), otherwise use selectedSlot.time
      const entryTime = calculatedDates.productionEntryTime || selectedSlot?.time;
      const datesToSave = [
        // Chassis arrival - using same time as production entry
        {
          sales_order_id: workOrder.id,
          date_type: 'chassis_arrival',
          planned_date: `${calculatedDates.chassisArrivalDate}T${entryTime}:00`,
          stage_code: null,
          created_by: username,
          created_dt: now,
          // modified_by and modified_dt should equal created_by and created_dt on insert
          modified_by: username,
          modified_dt: now
        }
      ];

      // Add stage entry/exit dates - combining date and time into timestamp
      // Note: This loop handles ALL stages including the first one, so we don't need a separate first stage entry
      console.log('Stage dates to save:', stageDates);
      stageDates.forEach(stage => {
        console.log('Adding stage entry/exit for:', stage.stage);
        datesToSave.push({
          sales_order_id: workOrder.id,
          date_type: 'entry',
          planned_date: `${stage.entryDate}T${stage.entryTime}:00`,
          stage_code: stage.stage,
          created_by: username,
          created_dt: now,
          // modified_by and modified_dt should equal created_by and created_dt on insert
          modified_by: username,
          modified_dt: now
        });
        datesToSave.push({
          sales_order_id: workOrder.id,
          date_type: 'exit',
          planned_date: `${stage.exitDate}T${stage.exitTime}:00`,
          stage_code: stage.stage,
          created_by: username,
          created_dt: now,
          // modified_by and modified_dt should equal created_by and created_dt on insert
          modified_by: username,
          modified_dt: now
        });
      });

      // Add single rnd_documents row (no stage_code) - using same time as production entry
      datesToSave.push({
        sales_order_id: workOrder.id,
        date_type: 'rnd_documents',
        planned_date: `${calculatedDates.documentReleaseDate}T${entryTime}:00`,
        stage_code: null,
        created_by: username,
        created_dt: now,
        // modified_by and modified_dt should equal created_by and created_dt on insert
        modified_by: username,
        modified_dt: now
      });

      // Add final inspection date (using configurable lead time after last stage exit)
      if (stageDates.length > 0) {
        const lastStageExit = new Date(stageDates[stageDates.length - 1].exitDate);
        const lastStageCode = stageDates[stageDates.length - 1].stage;
        const finalInspectionDate = calculateDateAfter(lastStageExit.toISOString().split('T')[0], calculatedDates.finalInspectionLeadTime, holidays);
        
        // Get shift start time for final inspection date (using last stage's shift as reference)
        let finalInspectionTime = '08:00'; // Default fallback
        try {
          const shiftInfo = await getShiftInfoForDate(finalInspectionDate, lastStageCode);
          if (shiftInfo && shiftInfo.hr_shift_master && shiftInfo.hr_shift_master.start_time) {
            // Extract HH:MM from start_time (which might be HH:MM:SS)
            const timeStr = shiftInfo.hr_shift_master.start_time;
            finalInspectionTime = timeStr.substring(0, 5); // Get first 5 chars (HH:MM)
          }
        } catch (err) {
          console.warn('Could not get shift info for final inspection date, using default 08:00', err);
        }
        
        datesToSave.push({
          sales_order_id: workOrder.id,
          date_type: 'final_inspection',
          planned_date: `${finalInspectionDate}T${finalInspectionTime}:00`,
          stage_code: null,
          created_by: username,
          created_dt: now,
          // modified_by and modified_dt should equal created_by and created_dt on insert
          modified_by: username,
          modified_dt: now
        });

        // Add delivery date (using configurable lead time after final inspection)
        const deliveryDate = calculateDateAfter(finalInspectionDate, calculatedDates.deliveryLeadTime, holidays);

        // Get shift start time for delivery date (using last stage's shift as reference)
        let deliveryTime = '08:00'; // Default fallback
        try {
          const shiftInfo = await getShiftInfoForDate(deliveryDate, lastStageCode);
          if (shiftInfo && shiftInfo.hr_shift_master && shiftInfo.hr_shift_master.start_time) {
            // Extract HH:MM from start_time (which might be HH:MM:SS)
            const timeStr = shiftInfo.hr_shift_master.start_time;
            deliveryTime = timeStr.substring(0, 5); // Get first 5 chars (HH:MM)
          }
        } catch (err) {
          console.warn('Could not get shift info for delivery date, using default 08:00', err);
        }

        datesToSave.push({
          sales_order_id: workOrder.id,
          date_type: 'delivery',
          planned_date: `${deliveryDate}T${deliveryTime}:00`,
          stage_code: null,
          created_by: username,
          created_dt: now,
          // modified_by and modified_dt should equal created_by and created_dt on insert
          modified_by: username,
          modified_dt: now
        });
      }

      // Insert all dates
      const { error: insertError } = await supabase
        .from('prdn_dates')
        .insert(datesToSave);

      if (insertError) {
        throw new Error(`Error saving dates: ${insertError.message}`);
      }

      // Dispatch success event
      dispatch('saved', {
        workOrder,
        selectedSlot,
        calculatedDates,
        stageDates
      });

      closeModal();

    } catch (err) {
      console.error('Error saving plan:', err as Error);
      error = (err as Error).message || 'Failed to save production plan';
    } finally {
      isLoading = false;
    }
  }

  function closeModal() {
    error = '';
    dispatch('close');
  }


  async function findNextAvailableEntrySlot(afterDateTime: Date): Promise<Date> {
    try {
      // Get the next day after exit time
      const nextDay = new Date(afterDateTime);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(8, 0, 0, 0); // Start at 8 AM

      // Find the next available entry slot from production plans
      const { data: activePlans } = await supabase
        .from('plan_prod_plan_per_shift')
        .select('*')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .gte('to_date', nextDay.toISOString().split('T')[0]);

      if (!activePlans || activePlans.length === 0) {
        // Fallback: start at 9 AM next day if no plans found
        const fallbackDate = new Date(afterDateTime);
        fallbackDate.setDate(fallbackDate.getDate() + 1);
        fallbackDate.setHours(9, 0, 0, 0);
        return fallbackDate;
      }

      // Find the next available slot from the active plan
      const plan = activePlans[0]; // Use the first active plan
      const nextDateStr = nextDay.toISOString().split('T')[0];
      
      // Skip holidays when finding next slot
      let checkDate = new Date(nextDay);
      while (isHoliday(checkDate.toISOString().split('T')[0], holidays)) {
        checkDate.setDate(checkDate.getDate() + 1);
      }

      // Set to 9 AM (typical start time)
      checkDate.setHours(9, 0, 0, 0);
      return checkDate;

    } catch (error) {
      console.error('Error finding next available entry slot:', error);
      // Fallback: start at 9 AM next day
      const fallbackDate = new Date(afterDateTime);
      fallbackDate.setDate(fallbackDate.getDate() + 1);
      fallbackDate.setHours(9, 0, 0, 0);
      return fallbackDate;
    }
  }


  // Reactive theme-based classes
  $: isDark = $theme === 'dark';
  $: bgPrimary = isDark ? 'bg-slate-800' : 'bg-white';
  $: bgSecondary = isDark ? 'bg-slate-700' : 'bg-gray-50';
  $: bgTertiary = isDark ? 'bg-slate-600' : 'bg-gray-100';
  $: textPrimary = isDark ? 'text-white' : 'text-gray-900';
  $: textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  $: textTertiary = isDark ? 'text-gray-400' : 'text-gray-500';
  $: borderColor = isDark ? 'border-slate-600' : 'border-gray-200';
  $: cardBg = isDark ? 'bg-slate-700' : 'bg-white';
  $: infoBoxBg = isDark ? 'bg-slate-700' : 'bg-blue-50';
  $: infoBoxBorder = isDark ? 'border-slate-600' : 'border-blue-200';
  $: preProdBg = isDark ? 'bg-slate-700' : 'bg-green-50';
  $: preProdBorder = isDark ? 'border-slate-600' : 'border-green-200';
  $: stagesBg = isDark ? 'bg-slate-700' : 'bg-blue-50';
  $: stagesBorder = isDark ? 'border-slate-600' : 'border-blue-200';
  $: postProdBg = isDark ? 'bg-slate-700' : 'bg-purple-50';
  $: postProdBorder = isDark ? 'border-slate-600' : 'border-purple-200';
  $: summaryBg = isDark ? 'bg-slate-700' : 'bg-gray-50';

  // Load stage dates when modal opens
  $: if (showModal && calculatedDates) {
    loadStageDates();
  }
</script>

<!-- Modal Overlay -->
{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="{bgPrimary} rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b {borderColor} {bgPrimary}">
        <h2 class="text-2xl font-bold {textPrimary}">Production Plan Summary</h2>
        <button
          on:click={closeModal}
          class="p-2 {isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} rounded-lg transition-colors duration-200"
        >
          <X class="w-6 h-6 {textSecondary}" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 {bgPrimary}">
        
        <!-- Work Order Info -->
        <div class="mb-6 p-4 {infoBoxBg} rounded-lg border {infoBoxBorder}">
          <h3 class="text-lg font-semibold {textPrimary} mb-2">Work Order Details</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="font-medium {textSecondary}">WO No:</span>
              <span class="{textPrimary} ml-2">{workOrder?.wo_no || 'N/A'}</span>
            </div>
            <div>
              <span class="font-medium {textSecondary}">Model:</span>
              <span class="{textPrimary} ml-2">{workOrder?.wo_model}</span>
            </div>
            <div>
              <span class="font-medium {textSecondary}">Customer:</span>
              <span class="{textPrimary} ml-2">{workOrder?.customer_name || 'N/A'}</span>
            </div>
            <div>
              <span class="font-medium {textSecondary}">Production Start:</span>
              <div class="ml-2">
                <div class="{textPrimary} font-medium">{formatDateWithWeekday(calculatedDates.productionEntryDate || selectedSlot?.date)}</div>
                <div class="{textSecondary} text-sm">at {calculatedDates.productionEntryTime || selectedSlot?.time}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        {#if isLoading}
          <div class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p class="{textPrimary}">Calculating production timeline...</p>
            </div>
          </div>
        {:else if error}
          <div class="text-center p-8">
            <div class="text-red-600 mb-4">
              <AlertCircle class="w-12 h-12 mx-auto mb-2" />
              <p class="text-lg font-medium {textPrimary}">{error}</p>
            </div>
            <Button variant="primary" on:click={loadStageDates}>
              Try Again
            </Button>
          </div>
        {:else}
          <!-- Calculated Dates -->
          <div class="space-y-6">
            
            <!-- Pre-Production Dates -->
            <div class="{preProdBg} rounded-lg p-4 border {preProdBorder}">
              <h3 class="text-lg font-semibold {textPrimary} mb-3 flex items-center">
                <Calendar class="w-5 h-5 mr-2 {textPrimary}" />
                Pre-Production Timeline
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center p-3 {cardBg} rounded-lg">
                  <div class="text-sm {textSecondary} mb-1">Chassis Arrival</div>
                  <div class="text-lg font-semibold {textPrimary}">{formatDateWithWeekday(calculatedDates.chassisArrivalDate)}</div>
                  <div class="text-sm {textSecondary}">at {calculatedDates.productionEntryTime || selectedSlot?.time}</div>
                </div>
                <div class="text-center p-3 {cardBg} rounded-lg">
                  <div class="text-sm {textSecondary} mb-1">Document Release</div>
                  <div class="text-lg font-semibold {textPrimary}">{formatDateWithWeekday(calculatedDates.documentReleaseDate)}</div>
                  <div class="text-sm {textSecondary}">at {calculatedDates.productionEntryTime || selectedSlot?.time}</div>
                </div>
                <div class="text-center p-3 {cardBg} rounded-lg">
                  <div class="text-sm {textSecondary} mb-1">Production Start</div>
                  <div class="text-lg font-semibold {textPrimary}">{formatDateWithWeekday(calculatedDates.productionEntryDate)}</div>
                  <div class="text-sm {textSecondary}">at {calculatedDates.productionEntryTime || selectedSlot?.time}</div>
                </div>
              </div>
            </div>

            <!-- Production Stages -->
            <div class="{stagesBg} rounded-lg p-4 border {stagesBorder}">
              <h3 class="text-lg font-semibold {textPrimary} mb-3 flex items-center">
                <CheckCircle class="w-5 h-5 mr-2 {textPrimary}" />
                Production Stages Timeline
              </h3>
              <div class="space-y-3">
                {#each stageDates as stage, index}
                  <div class="flex items-center justify-between p-3 {cardBg} rounded-lg">
                    <div class="flex items-center space-x-3">
                      <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <div class="font-medium {textPrimary}">{stage.stage}</div>
                        <div class="text-sm {textSecondary}">Lead Time: {stage.leadTime} hours</div>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-sm {textSecondary} mb-1">
                        <span class="font-medium">Entry:</span> {formatDateTime(stage.entryDate, stage.entryTime)}
                      </div>
                      <div class="text-sm {textSecondary}">
                        <span class="font-medium">Exit:</span> {formatDateTime(stage.exitDate, stage.exitTime)}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Post-Production Dates -->
            {#if stageDates.length > 0}
              <div class="{postProdBg} rounded-lg p-4 border {postProdBorder}">
                <h3 class="text-lg font-semibold {textPrimary} mb-3 flex items-center">
                  <CheckSquare class="w-5 h-5 mr-2 {textPrimary}" />
                  Post-Production Timeline
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="text-center p-3 {cardBg} rounded-lg">
                    <div class="text-sm {textSecondary} mb-1">Final Inspection</div>
                    <div class="text-lg font-semibold {textPrimary}">
                      {(() => {
                        const lastStageExit = new Date(stageDates[stageDates.length - 1].exitDate);
                        const finalInspectionDate = calculateDateAfter(lastStageExit.toISOString().split('T')[0], calculatedDates.finalInspectionLeadTime, holidays);
                        return formatDateWithWeekday(finalInspectionDate);
                      })()}
                    </div>
                  </div>
                  <div class="text-center p-3 {cardBg} rounded-lg">
                    <div class="text-sm {textSecondary} mb-1">Delivery</div>
                    <div class="text-lg font-semibold {textPrimary}">
                      {(() => {
                        const lastStageExit = new Date(stageDates[stageDates.length - 1].exitDate);
                        const finalInspectionDate = calculateDateAfter(lastStageExit.toISOString().split('T')[0], calculatedDates.finalInspectionLeadTime, holidays);
                        const deliveryDate = calculateDateAfter(finalInspectionDate, calculatedDates.deliveryLeadTime, holidays);
                        return formatDateWithWeekday(deliveryDate);
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Summary -->
            <div class="{summaryBg} rounded-lg p-4">
              <h4 class="text-sm font-medium {textPrimary} mb-2">Summary</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="{textSecondary}">Total Stages:</span>
                  <span class="{textPrimary} ml-2">{stageDates.length}</span>
                </div>
                <div>
                  <span class="{textSecondary}">Production Duration:</span>
                  <span class="{textPrimary} ml-2">
                    {stageDates.length > 0 ? 
                      `${Math.ceil((new Date(stageDates[stageDates.length - 1].exitDate).getTime() - new Date(stageDates[0].entryDate).getTime()) / (1000 * 60 * 60 * 24))} days` : 
                      'N/A'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-6 border-t {borderColor} {bgPrimary}">
        <Button variant="secondary" on:click={() => dispatch('back')}>
          Back
        </Button>
        <div class="flex space-x-3">
          <Button variant="secondary" on:click={closeModal}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            on:click={handleSave}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Production Plan'}
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}
