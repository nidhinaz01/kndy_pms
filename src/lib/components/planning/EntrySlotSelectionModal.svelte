<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X, Calendar, Clock } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  import { theme } from '$lib/stores/theme';
  import { getActivePlanForDate, getCurrentActivePlan } from '$lib/api/productionPlanService';
  import { fetchHolidays } from '$lib/api/planning';
  import { calculateDateBefore, isHoliday } from '$lib/utils/dateCalculationUtils';
  import { formatDateWithWeekday } from '$lib/utils/formatDate';
  import { fetchShiftsForStage } from '$lib/api/hrShiftStageMaster';

  const dispatch = createEventDispatcher();

  export let showModal = false;
  export let workOrder: any = null;

  // State
  let availableSlots: Array<{
    date: string;
    shift: string;
    time: string;
    shift_code?: string; // Add shift_code to track which shift this slot belongs to
    available_entries: number;
    max_entries: number;
  }> = [];
  let selectedSlot: any = null;
  let isLoading = true;
  let error = '';
  let holidays: any[] = [];
  let allowedShiftCodes: string[] = []; // Shifts allowed for the first stage

  // Lead time configuration
  let chassisLeadTime = 5;
  let documentLeadTime = 3;
  let finalInspectionLeadTime = 1;
  let deliveryLeadTime = 1;

  async function loadAvailableSlots() {
    try {
      isLoading = true;
      error = '';

      // First, get the first stage for this work order type
      let firstStageCode: string | null = null;
      if (workOrder?.wo_model) {
        const { data: stageOrderData } = await supabase
          .from('plan_wo_stage_order')
          .select('plant_stage')
          .eq('wo_type_name', workOrder.wo_model)
          .order('order_no', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (stageOrderData) {
          firstStageCode = stageOrderData.plant_stage;
        }
      }

      // Get allowed shifts for the first stage
      if (firstStageCode) {
        try {
          allowedShiftCodes = await fetchShiftsForStage(firstStageCode);
          console.log(`Allowed shifts for first stage ${firstStageCode}:`, allowedShiftCodes);
        } catch (err) {
          console.error('Error fetching shifts for stage:', err);
          // If we can't get shifts, allow all (fallback behavior)
          allowedShiftCodes = [];
        }
      } else {
        // If no first stage found, allow all shifts (fallback)
        allowedShiftCodes = [];
        console.warn('No first stage found for work order model:', workOrder?.wo_model);
      }

      // Get tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Fetch available entry slots from entry-per-shift data
      // Only fetch plans that are active or future plans
      const { data: slotsData, error: slotsError } = await supabase
        .from('plan_prod_plan_per_shift')
        .select('*')
        .or(`to_date.gte.${tomorrowStr},from_date.gte.${tomorrowStr}`)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('from_date', { ascending: true });

      if (slotsError) {
        throw new Error(`Error loading slots: ${slotsError.message}`);
      }

      // Build a map of shift_id to shift_code from shift_distribution
      const shiftIdToCodeMap = new Map<number, string>();
      if (slotsData && slotsData.length > 0) {
        // Collect all unique shift_ids from all plans
        const allShiftIds = new Set<number>();
        slotsData.forEach(plan => {
          if (plan.shift_distribution && Array.isArray(plan.shift_distribution)) {
            plan.shift_distribution.forEach((dist: any) => {
              if (dist.shift_id) {
                allShiftIds.add(dist.shift_id);
              }
            });
          }
        });

        // Fetch all shift codes in one query
        if (allShiftIds.size > 0) {
          const { data: shiftsData } = await supabase
            .from('hr_shift_master')
            .select('shift_id, shift_code')
            .in('shift_id', Array.from(allShiftIds))
            .eq('is_active', true)
            .eq('is_deleted', false);

          if (shiftsData) {
            shiftsData.forEach(shift => {
              shiftIdToCodeMap.set(shift.shift_id, shift.shift_code);
            });
          }
        }
      }

      // Process slots data from entry_slots JSONB
      availableSlots = [];
      console.log('Raw slots data:', slotsData);
      console.log('Tomorrow string:', tomorrowStr);
      console.log('Number of plans found:', slotsData?.length || 0);
      console.log('Allowed shift codes:', allowedShiftCodes);
      console.log('Shift ID to Code map:', shiftIdToCodeMap);
      
             (slotsData || []).forEach(plan => {
        console.log('Processing plan:', plan);
        
        // Generate dates for the plan period, but start from tomorrow
        const startDate = new Date(Math.max(new Date(plan.from_date).getTime(), tomorrow.getTime()));
        const endDate = new Date(plan.to_date);
        const currentDate = new Date(startDate);
        
        // Track the actual production day number (starting from 1)
        let productionDayNumber = 1;
        
        while (currentDate <= endDate) {
          const currentDateStr = currentDate.toISOString().split('T')[0];
          
          // Process entry_slots JSONB - handle both old array structure and new object structure
          if (plan.entry_slots) {
            console.log('Entry slots structure:', plan.entry_slots);
            
                          // Handle new object structure with pattern_time_slots
             if (plan.entry_slots.pattern_time_slots && Array.isArray(plan.entry_slots.pattern_time_slots)) {
                // Find the pattern day that corresponds to this production day
                // Pattern repeats: Day 1, Day 2, Day 1, Day 2, etc.
                const patternDayIndex = ((productionDayNumber - 1) % plan.entry_slots.pattern_time_slots.length);
                const daySlot = plan.entry_slots.pattern_time_slots[patternDayIndex];
                
                if (daySlot && daySlot.slots && Array.isArray(daySlot.slots)) {
                  daySlot.slots.forEach((slot: any) => {
                    console.log('Pattern slot:', slot);
                    // For pattern_time_slots, we need to determine shift from shift_distribution
                    // Use the first shift from shift_distribution as default, or check time against shift schedules
                    let slotShiftCode: string | undefined = undefined;
                    if (plan.shift_distribution && Array.isArray(plan.shift_distribution) && plan.shift_distribution.length > 0) {
                      const firstShiftId = plan.shift_distribution[0].shift_id;
                      slotShiftCode = shiftIdToCodeMap.get(firstShiftId);
                    }
                    
                    // Only add slot if it belongs to an allowed shift (or if no restrictions)
                    if (allowedShiftCodes.length === 0 || (slotShiftCode && allowedShiftCodes.includes(slotShiftCode))) {
                      availableSlots.push({
                        date: currentDateStr,
                        shift: `Day ${productionDayNumber}`,
                        time: slot.entry_time || '09:00',
                        shift_code: slotShiftCode,
                        available_entries: daySlot.vehicles || 1,
                        max_entries: daySlot.vehicles || 1
                      });
                    }
                  });
                }
              }
                         // Handle old array structure (fallback)
            else if (Array.isArray(plan.entry_slots)) {
              plan.entry_slots.forEach((shiftSlot: any) => {
                if (shiftSlot.slots && Array.isArray(shiftSlot.slots)) {
                  const shiftCode = shiftIdToCodeMap.get(shiftSlot.shift_id);
                  
                  // Only process slots for allowed shifts (or if no restrictions)
                  if (allowedShiftCodes.length === 0 || (shiftCode && allowedShiftCodes.includes(shiftCode))) {
                    shiftSlot.slots.forEach((slot: any) => {
                      console.log('Shift slot:', slot);
                      availableSlots.push({
                        date: currentDateStr,
                        shift: `Day ${productionDayNumber}`,
                        time: slot.entry_time || '09:00',
                        shift_code: shiftCode,
                        available_entries: 1,
                        max_entries: 1
                      });
                    });
                  }
                }
              });
            }
          }
          
          // Increment production day number for next iteration
          productionDayNumber++;
          
          // Move to next day
          currentDate.setDate(currentDate.getDate() + 1);
       }
     });
      
      console.log('Processed available slots:', availableSlots);

      // Check slot availability (how many vehicles are already planned for each slot)
      const slotAvailabilityPromises = availableSlots.map(async (slot) => {
        try {
          const { data: existingPlans, error: availabilityError } = await supabase
            .from('prdn_dates')
            .select('sales_order_id')
            .eq('date_type', 'entry')
            .eq('planned_date', slot.date)
            .not('sales_order_id', 'is', null);

          if (availabilityError) {
            console.error('Error checking slot availability:', availabilityError);
            return slot;
          }

          const occupiedSlots = existingPlans?.length || 0;
          const availableEntries = Math.max(0, slot.max_entries - occupiedSlots);

          return {
            ...slot,
            available_entries: availableEntries,
            occupied_entries: occupiedSlots
          };
        } catch (error) {
          console.error('Error checking slot availability:', error);
          return slot;
        }
      });

      // Wait for all availability checks to complete
      availableSlots = await Promise.all(slotAvailabilityPromises);

      // Filter out fully occupied slots
      availableSlots = availableSlots.filter(slot => slot.available_entries > 0);

      // Limit to next 10 slots for better usability
      availableSlots = availableSlots.slice(0, 10);
      console.log('Limited to next 10 slots:', availableSlots);

      // Check if we have any plans that cover the date range we need
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() + 1);
      const checkDateStr = checkDate.toISOString().split('T')[0];
      
      // Check if there's an active plan that covers tomorrow onwards
      const activePlan = await getCurrentActivePlan();
      
      if (!activePlan) {
        error = 'No production plans are currently active. Please create a production plan in the Entry-per-Shift page first.';
      } else if (activePlan.to_date < checkDateStr) {
        error = `The current active production plan (${activePlan.from_date} to ${activePlan.to_date}) has expired. Please create a new production plan in the Entry-per-Shift page that covers future dates.`;
      } else if (availableSlots.length === 0) {
        error = 'No available entry slots found in the current production plan. Please check the Entry-per-Shift page configuration.';
      }

      // Load holidays and lead time configuration
      const currentYear = new Date().getFullYear();
      holidays = await fetchHolidays(currentYear);
      await loadLeadTimeConfig();

    } catch (err) {
      console.error('Error loading available slots:', err as Error);
      error = (err as Error).message || 'Failed to load available slots';
    } finally {
      isLoading = false;
    }
  }

  async function loadLeadTimeConfig() {
    try {
      // Load chassis lead time
      const { data: chassisData } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Lead time for chassis receival')
        .single();

      if (chassisData?.de_value) {
        chassisLeadTime = parseInt(chassisData.de_value) || 5;
      }

      // Load document lead time
      const { data: documentData } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Lead time for document release')
        .single();

      if (documentData?.de_value) {
        documentLeadTime = parseInt(documentData.de_value) || 3;
      }

      // Load final inspection lead time
      const { data: finalInspectionData } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Lead time for final inspection')
        .single();

      if (finalInspectionData?.de_value) {
        finalInspectionLeadTime = parseInt(finalInspectionData.de_value) || 1;
      }

      // Load delivery lead time
      const { data: deliveryData } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Lead time for delivery')
        .single();

      if (deliveryData?.de_value) {
        deliveryLeadTime = parseInt(deliveryData.de_value) || 1;
      }

    } catch (err) {
      console.error('Error loading lead time config:', err as Error);
      // Use defaults if config fails to load
    }
  }

  function selectSlot(slot: any) {
    selectedSlot = slot;
  }

  function handleConfirm() {
    if (!selectedSlot) {
      error = 'Please select an entry slot';
      return;
    }

    // Calculate dates
    const productionEntryDate = selectedSlot.date;
    const documentReleaseDate = calculateDateBefore(productionEntryDate, documentLeadTime, holidays);
    const chassisArrivalDate = calculateDateBefore(productionEntryDate, chassisLeadTime, holidays);

    // Dispatch event with calculated dates
    dispatch('confirm', {
      workOrder,
      selectedSlot,
      calculatedDates: {
        productionEntryDate,
        documentReleaseDate,
        chassisArrivalDate,
        finalInspectionLeadTime,
        deliveryLeadTime
      }
    });

    closeModal();
  }


  function closeModal() {
    selectedSlot = null;
    error = '';
    dispatch('close');
  }


  // Load slots when modal opens
  $: if (showModal && workOrder) {
    loadAvailableSlots();
  }

  // Get current theme
  $: currentTheme = $theme;
</script>

<!-- Modal Overlay -->
{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col {currentTheme === 'dark' ? 'bg-gray-800' : 'bg-white'}">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b {currentTheme === 'dark' ? 'border-gray-700' : 'border-gray-200'}">
        <h2 class="text-2xl font-bold {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">Select Entry Slot</h2>
        <button
          on:click={closeModal}
          class="p-2 rounded-lg transition-colors duration-200 {currentTheme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}"
        >
          <X class="w-6 h-6 {currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        
        <!-- Work Order Info -->
        <div class="mb-6 p-4 rounded-lg border {currentTheme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}">
          <h3 class="text-lg font-semibold mb-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">Work Order Details</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="font-medium {currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">WO No:</span>
              <span class="ml-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">{workOrder?.wo_no || 'N/A'}</span>
            </div>
            <div>
              <span class="font-medium {currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">Model:</span>
              <span class="ml-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">{workOrder?.wo_model}</span>
            </div>
            <div>
              <span class="font-medium {currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">Customer:</span>
              <span class="ml-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">{workOrder?.customer_name || 'N/A'}</span>
            </div>
            <div>
              <span class="font-medium {currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">Order Date:</span>
              <span class="ml-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">{workOrder?.wo_date}</span>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        {#if isLoading}
          <div class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p class="{currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">Loading available entry slots...</p>
            </div>
          </div>
        {:else if error}
          <div class="text-center p-8">
            <div class="text-red-600 mb-4">
              <X class="w-12 h-12 mx-auto mb-2" />
              <p class="text-lg font-medium">{error}</p>
            </div>
            <Button variant="primary" on:click={loadAvailableSlots}>
              Try Again
            </Button>
          </div>
        {:else if availableSlots.length === 0}
          <div class="text-center p-8">
            <div class="text-yellow-600 mb-4">
              <Calendar class="w-12 h-12 mx-auto mb-2" />
              <p class="text-lg font-medium">No available entry slots found</p>
            </div>
            <p class="{currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-4">
              {error || 'Please check the entry-per-shift configuration.'}
            </p>
            <div class="text-sm {currentTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'}">
              <p>• Ensure you have created production plans in the Entry-per-Shift page</p>
              <p>• Plans should cover dates from tomorrow onwards</p>
              <p>• Plans must be marked as active and not deleted</p>
            </div>
          </div>
        {:else}
          <!-- Available Slots -->
          <div class="space-y-4">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">Available Entry Slots</h3>
              <p class="text-sm {currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">
                Select a specific date and time slot for production entry. Each slot combines a date with a specific time.
              </p>
            </div>
            
            <div class="grid gap-4">
              {#each availableSlots as slot}
                <div 
                  class="border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 {selectedSlot === slot ? (currentTheme === 'dark' ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50') : (currentTheme === 'dark' ? 'border-gray-700 hover:border-blue-600' : 'border-gray-200 hover:border-blue-300')}"
                  on:click={() => selectSlot(slot)}
                  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectSlot(slot)}
                  role="button"
                  tabindex="0"
                  aria-label="Select entry slot for {formatDateWithWeekday(slot.date)} at {slot.time}"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                      <!-- Combined Date-Time Display -->
                      <div class="flex items-center space-x-2">
                        <Calendar class="w-5 h-5 {currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}" />
                        <div class="flex flex-col">
                          <span class="font-medium {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">{formatDateWithWeekday(slot.date)}</span>
                          <div class="flex items-center space-x-1">
                            <Clock class="w-4 h-4 {currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}" />
                            <span class="text-sm {currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'}">{slot.time}</span>
                          </div>
                        </div>
                      </div>
                      <!-- Combined DateTime Badge -->
                      <div class="px-3 py-2 rounded-lg border {currentTheme === 'dark' ? 'bg-blue-900/30 border-blue-700 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-800'}">
                        <div class="text-sm font-medium">
                          {formatDateWithWeekday(slot.date)} at {slot.time}
                        </div>
                        <div class="text-xs {currentTheme === 'dark' ? 'text-blue-300' : 'text-blue-600'}">
                          {slot.shift}
                        </div>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-sm {currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">
                        Available: {slot.available_entries}/{slot.max_entries}
                      </div>
                      {#if selectedSlot === slot}
                        <div class="text-sm font-medium mt-1 {currentTheme === 'dark' ? 'text-blue-400' : 'text-blue-600'}">
                          ✓ Selected
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>

                         <!-- Lead Time Info -->
             <div class="mt-6 p-4 rounded-lg {currentTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}">
               <h4 class="text-sm font-medium mb-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">Lead Time Configuration</h4>
               <div class="grid grid-cols-2 gap-4 text-sm">
                 <div>
                   <span class="{currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">Chassis Arrival:</span>
                   <span class="ml-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">{chassisLeadTime} working days before production</span>
                 </div>
                 <div>
                   <span class="{currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">Document Release:</span>
                   <span class="ml-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">{documentLeadTime} working days before production</span>
                 </div>
                 <div>
                   <span class="{currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">Final Inspection:</span>
                   <span class="ml-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">{finalInspectionLeadTime} working days after production</span>
                 </div>
                 <div>
                   <span class="{currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}">Delivery:</span>
                   <span class="ml-2 {currentTheme === 'dark' ? 'text-white' : 'text-gray-900'}">{deliveryLeadTime} working days after inspection</span>
                 </div>
               </div>
             </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-6 border-t {currentTheme === 'dark' ? 'border-gray-700' : 'border-gray-200'}">
        <Button variant="secondary" on:click={closeModal}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          on:click={handleConfirm}
          disabled={!selectedSlot}
        >
          Confirm Selection
        </Button>
      </div>
    </div>
  </div>
{/if}
