<script lang="ts">
  import { onMount } from 'svelte';
  import { formatDate } from '$lib/utils/formatDate';
  import Button from '$lib/components/common/Button.svelte';
  import { 
    fetchWorkOrderDetails, 
    fetchAdditionalRequirements, 
    fetchWorkOrderAmendments,
    type WorkOrderDetails,
    type AdditionalRequirement,
    type WorkOrderAmendment
  } from '$lib/api/workOrders';

  export let workOrderId: number | null = null;
  export let onClose: () => void;

  let activeTab = 'details';
  let isLoading = true;
  let workOrderDetails: WorkOrderDetails | null = null;
  let additionalRequirements: AdditionalRequirement[] = [];
  let amendments: WorkOrderAmendment[] = [];

  async function loadWorkOrderData() {
    if (!workOrderId) return;
    
    isLoading = true;
    try {
      const [details, requirements, amendmentsData] = await Promise.all([
        fetchWorkOrderDetails(workOrderId),
        fetchAdditionalRequirements(workOrderId),
        fetchWorkOrderAmendments(workOrderId)
      ]);
      
      workOrderDetails = details;
      additionalRequirements = requirements;
      amendments = amendmentsData;
    } catch (error) {
      console.error('Error loading work order data:', error);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    if (workOrderId) {
      loadWorkOrderData();
    }
  });

  $: if (workOrderId) {
    loadWorkOrderData();
  }

  function handleTabClick(tab: string) {
    activeTab = tab;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

{#if workOrderId}
    <!-- Modal Overlay -->
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
    role="dialog"
    aria-modal="true"
    tabindex="0"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
        Work Order Details
        {#if workOrderDetails}
          - {workOrderDetails.wo_no || workOrderDetails.pwo_no}
        {/if}
      </h2>
      <button
        on:click={onClose}
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Close modal"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Loading State -->
    {#if isLoading}
      <div class="flex items-center justify-center p-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-3 text-gray-600 dark:text-gray-300">Loading work order details...</span>
      </div>
    {:else if workOrderDetails}
      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav class="flex space-x-8 px-6">
          <button
            class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'details' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
            on:click={() => handleTabClick('details')}
          >
            Work Order Details
          </button>
          <button
            class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'requirements' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
            on:click={() => handleTabClick('requirements')}
          >
            Additional Requirements ({additionalRequirements.length})
          </button>
          <button
            class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'amendments' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
            on:click={() => handleTabClick('amendments')}
          >
            Amendments ({amendments.length})
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="p-6 overflow-y-auto max-h-[60vh]">
        {#if activeTab === 'details'}
          <!-- Work Order Details Tab -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">Basic Information</h3>
              <div class="space-y-3">
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">WO Number</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.wo_no || '-'}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">PWO Number</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.pwo_no || '-'}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.wo_type}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.wo_model}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(workOrderDetails.wo_date)}</p>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">Vehicle Specifications</h3>
              <div class="space-y-3">
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Chassis</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.wo_chassis}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Wheel Base</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.wheel_base}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Body Width</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.body_width_mm}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Height</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.height}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Model Rate</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">₹{workOrderDetails.model_rate?.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">Seating & Doors</h3>
              <div class="space-y-3">
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Passenger Doors</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.passenger_door_nos}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Number of Seats</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.no_of_seats}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Seat Configuration</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.seat_configuration}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Seat Type</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.seat_type}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Seat Fabrics</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.seat_fabrics}</p>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">Features</h3>
              <div class="space-y-3">
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Air Ventilation</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.air_ventilation_nos}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Side Ventilation</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.side_ventilation}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Emergency Door</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.emergency_door_nos}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Escape Hatch</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.escape_hatch}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Fire Extinguisher</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.fire_extinguisher_kg}</p>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">Interior</h3>
              <div class="space-y-3">
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Inside Grab Rails</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.inside_grab_rails}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Inside Top Panel</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.inside_top_panel}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Inside Side Panel</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.inside_side_panel}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Inside Luggage Rack</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.inside_luggage_rack}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Driver Cabin Partition</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{workOrderDetails.driver_cabin_partition}</p>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">Cost Information</h3>
              <div class="space-y-3">
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Work Order Cost</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">₹{workOrderDetails.work_order_cost?.toLocaleString()}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">GST</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">₹{workOrderDetails.gst?.toLocaleString()}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">CESS</span>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">₹{workOrderDetails.cess?.toLocaleString()}</p>
                </div>
                <div>
                  <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Total Cost</span>
                  <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">₹{workOrderDetails.total_cost?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

        {:else if activeTab === 'requirements'}
          <!-- Additional Requirements Tab -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">Additional Requirements</h3>
            {#if additionalRequirements.length === 0}
              <p class="text-gray-500 dark:text-gray-400 text-center py-8">No additional requirements found.</p>
            {:else}
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Position</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Work Details</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Quantity</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rate</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {#each additionalRequirements as requirement}
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{requirement.pos_num}</td>
                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{requirement.work_details}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{requirement.work_qty}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">₹{requirement.work_rate?.toLocaleString()}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">₹{(requirement.work_qty * requirement.work_rate)?.toLocaleString()}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'amendments'}
          <!-- Amendments Tab -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white border-b pb-2">Amendments</h3>
            {#if amendments.length === 0}
              <p class="text-gray-500 dark:text-gray-400 text-center py-8">No amendments found.</p>
            {:else}
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Position</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Work Type</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Work Details</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Work Cost</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">GST</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amend Date</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {#each amendments as amendment}
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{amendment.pos_num}</td>
                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{amendment.work_type}</td>
                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{amendment.work_details}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">₹{amendment.work_cost?.toLocaleString()}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">₹{amendment.gst?.toLocaleString()}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(amendment.amend_date)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <div class="p-8 text-center">
        <p class="text-gray-500 dark:text-gray-400">No work order details found.</p>
      </div>
    {/if}
  </div>
</div>
{/if} 