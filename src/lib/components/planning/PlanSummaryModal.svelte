<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Calendar, CheckCircle, AlertCircle, CheckSquare } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { fetchHolidays } from '$lib/api/planning';

  const dispatch = createEventDispatcher();

  export let showModal = false;
  export let workOrder: any = null;
  export let selectedSlot: any = null;
  export let calculatedDates: any = null;

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

      // Calculate stage dates and times sequentially
      let currentDateTime = new Date(calculatedDates.productionEntryDate + 'T' + selectedSlot.time);
      stageDates = [];

      for (const stage of stageOrderData || []) {
        const entryDateTime = new Date(currentDateTime);
        const exitDateTime = new Date(currentDateTime);
        
        // Add lead time hours (skip holidays and non-working hours)
        let hoursAdded = 0;
        while (hoursAdded < stage.lead_time_hours) {
          exitDateTime.setHours(exitDateTime.getHours() + 1);
          
          // Skip non-working hours (8 AM to 6 PM) and holidays
          const hour = exitDateTime.getHours();
          const dateStr = exitDateTime.toISOString().split('T')[0];
          
          if (hour >= 8 && hour < 18 && !isHoliday(dateStr)) {
            hoursAdded++;
          }
        }

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

        // Find next available entry slot instead of hardcoding 9 AM
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

    // Validate that the selected date is not in the past
    const selectedDate = new Date(selectedSlot.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      error = 'Cannot schedule production for past dates';
      return false;
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

      // Get current username (throws error if not found)
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const username = getCurrentUsername();
      const now = getCurrentTimestamp();

      // Save all dates to prdn_dates table
      const datesToSave = [
        // Chassis arrival - using same time as production entry
        {
          sales_order_id: workOrder.id,
          date_type: 'chassis_arrival',
          planned_date: `${calculatedDates.chassisArrivalDate}T${selectedSlot?.time}:00`,
          stage_code: null,
          created_by: username,
          created_dt: now,
          // modified_by and modified_dt should equal created_by and created_dt on insert
          modified_by: username,
          modified_dt: now
        },
        // Document release - using same time as production entry
        {
          sales_order_id: workOrder.id,
          date_type: 'rnd_documents',
          planned_date: `${calculatedDates.documentReleaseDate}T${selectedSlot?.time}:00`,
          stage_code: null,
          created_by: username,
          created_dt: now,
          // modified_by and modified_dt should equal created_by and created_dt on insert
          modified_by: username,
          modified_dt: now
        },
        // Production entry (first stage) - combining date and time into timestamp
        {
          sales_order_id: workOrder.id,
          date_type: 'entry',
          planned_date: `${calculatedDates.productionEntryDate}T${selectedSlot?.time}:00`,
          stage_code: stageDates[0]?.stage,
          created_by: username,
          created_dt: now,
          // modified_by and modified_dt should equal created_by and created_dt on insert
          modified_by: username,
          modified_dt: now
        }
      ];

      // Add stage entry/exit dates - combining date and time into timestamp
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

      // Add final inspection date (using configurable lead time after last stage exit)
      if (stageDates.length > 0) {
        const lastStageExit = new Date(stageDates[stageDates.length - 1].exitDate);
        const finalInspectionDate = calculateDateAfter(lastStageExit.toISOString().split('T')[0], calculatedDates.finalInspectionLeadTime);
        
        datesToSave.push({
          sales_order_id: workOrder.id,
          date_type: 'final_inspection',
          planned_date: finalInspectionDate,
          stage_code: null,
          created_by: username,
          created_dt: now,
          // modified_by and modified_dt should equal created_by and created_dt on insert
          modified_by: username,
          modified_dt: now
        });

        // Add delivery date (using configurable lead time after final inspection)
        const deliveryDate = calculateDateAfter(finalInspectionDate, calculatedDates.deliveryLeadTime);

        datesToSave.push({
          sales_order_id: workOrder.id,
          date_type: 'delivery',
          planned_date: deliveryDate,
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

  function isHoliday(dateStr: string): boolean {
    return holidays.some(holiday => holiday.dt_value === dateStr);
  }

  function calculateDateAfter(startDate: string, daysAfter: number): string {
    const date = new Date(startDate);
    let daysAdded = 0;
    let currentDate = new Date(date);

    while (daysAdded < daysAfter) {
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Skip holidays (using the existing holiday table)
      if (!isHoliday(currentDate.toISOString().split('T')[0])) {
        daysAdded++;
      }
    }

    return currentDate.toISOString().split('T')[0];
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
      while (isHoliday(checkDate.toISOString().split('T')[0])) {
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

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  // Load stage dates when modal opens
  $: if (showModal && calculatedDates) {
    loadStageDates();
  }
</script>

<!-- Modal Overlay -->
{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b theme-border theme-bg-primary">
        <h2 class="text-2xl font-bold theme-text-primary">Production Plan Summary</h2>
        <button
          on:click={closeModal}
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
        >
          <X class="w-6 h-6 theme-text-secondary" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 theme-bg-primary">
        
        <!-- Work Order Info -->
        <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 class="text-lg font-semibold theme-text-primary mb-2">Work Order Details</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="font-medium theme-text-secondary">WO No:</span>
              <span class="theme-text-primary ml-2">{workOrder?.wo_no || 'N/A'}</span>
            </div>
            <div>
              <span class="font-medium theme-text-secondary">Model:</span>
              <span class="theme-text-primary ml-2">{workOrder?.wo_model}</span>
            </div>
            <div>
              <span class="font-medium theme-text-secondary">Customer:</span>
              <span class="theme-text-primary ml-2">{workOrder?.customer_name || 'N/A'}</span>
            </div>
            <div>
              <span class="font-medium theme-text-secondary">Production Start:</span>
              <div class="ml-2">
                <div class="theme-text-primary font-medium">{formatDate(selectedSlot?.date)}</div>
                <div class="theme-text-secondary text-sm">at {selectedSlot?.time}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        {#if isLoading}
          <div class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p class="theme-text-primary">Calculating production timeline...</p>
            </div>
          </div>
        {:else if error}
          <div class="text-center p-8">
            <div class="text-red-600 mb-4">
              <AlertCircle class="w-12 h-12 mx-auto mb-2" />
              <p class="text-lg font-medium">{error}</p>
            </div>
            <Button variant="primary" on:click={loadStageDates}>
              Try Again
            </Button>
          </div>
        {:else}
          <!-- Calculated Dates -->
          <div class="space-y-6">
            
            <!-- Pre-Production Dates -->
            <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h3 class="text-lg font-semibold theme-text-primary mb-3 flex items-center">
                <Calendar class="w-5 h-5 mr-2" />
                Pre-Production Timeline
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div class="text-sm theme-text-secondary mb-1">Chassis Arrival</div>
                  <div class="text-lg font-semibold theme-text-primary">{formatDate(calculatedDates.chassisArrivalDate)}</div>
                </div>
                <div class="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div class="text-sm theme-text-secondary mb-1">Document Release</div>
                  <div class="text-lg font-semibold theme-text-primary">{formatDate(calculatedDates.documentReleaseDate)}</div>
                </div>
                <div class="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div class="text-sm theme-text-secondary mb-1">Production Start</div>
                  <div class="text-lg font-semibold theme-text-primary">{formatDate(calculatedDates.productionEntryDate)}</div>
                  <div class="text-sm theme-text-secondary">at {selectedSlot?.time}</div>
                </div>
              </div>
            </div>

            <!-- Production Stages -->
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h3 class="text-lg font-semibold theme-text-primary mb-3 flex items-center">
                <CheckCircle class="w-5 h-5 mr-2" />
                Production Stages Timeline
              </h3>
              <div class="space-y-3">
                {#each stageDates as stage, index}
                  <div class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div class="flex items-center space-x-3">
                      <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <div class="font-medium theme-text-primary">{stage.stage}</div>
                                                 <div class="text-sm theme-text-secondary">Lead Time: {stage.leadTime} hours</div>
                      </div>
                    </div>
                                         <div class="text-right">
                       <div class="text-sm theme-text-secondary">Entry: {formatDate(stage.entryDate)} {stage.entryTime}</div>
                       <div class="text-sm theme-text-secondary">Exit: {formatDate(stage.exitDate)} {stage.exitTime}</div>
                     </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Post-Production Dates -->
            {#if stageDates.length > 0}
              <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <h3 class="text-lg font-semibold theme-text-primary mb-3 flex items-center">
                  <CheckSquare class="w-5 h-5 mr-2" />
                  Post-Production Timeline
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div class="text-sm theme-text-secondary mb-1">Final Inspection</div>
                    <div class="text-lg font-semibold theme-text-primary">
                      {(() => {
                        const lastStageExit = new Date(stageDates[stageDates.length - 1].exitDate);
                        const finalInspectionDate = calculateDateAfter(lastStageExit.toISOString().split('T')[0], calculatedDates.finalInspectionLeadTime);
                        return formatDate(finalInspectionDate);
                      })()}
                    </div>
                  </div>
                  <div class="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div class="text-sm theme-text-secondary mb-1">Delivery</div>
                    <div class="text-lg font-semibold theme-text-primary">
                      {(() => {
                        const lastStageExit = new Date(stageDates[stageDates.length - 1].exitDate);
                        const finalInspectionDate = calculateDateAfter(lastStageExit.toISOString().split('T')[0], calculatedDates.finalInspectionLeadTime);
                        const deliveryDate = calculateDateAfter(finalInspectionDate, calculatedDates.deliveryLeadTime);
                        return formatDate(deliveryDate);
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Summary -->
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 class="text-sm font-medium theme-text-primary mb-2">Summary</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="theme-text-secondary">Total Stages:</span>
                  <span class="theme-text-primary ml-2">{stageDates.length}</span>
                </div>
                <div>
                  <span class="theme-text-secondary">Production Duration:</span>
                  <span class="theme-text-primary ml-2">
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
      <div class="flex items-center justify-between p-6 border-t theme-border theme-bg-primary">
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
