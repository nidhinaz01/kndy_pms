<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    fetchWorkOrderDetails, 
    fetchAdditionalRequirements, 
    fetchWorkOrderAmendments,
    type WorkOrderDetails,
    type AdditionalRequirement,
    type WorkOrderAmendment
  } from '$lib/api/workOrders';
  import { formatDate } from '$lib/utils/formatDate';

  export let workOrderId: number | null;
  export let onClose: () => void;

  let workOrder: WorkOrderDetails | null = null;
  let additionalRequirements: AdditionalRequirement[] = [];
  let amendments: WorkOrderAmendment[] = [];
  let isLoading = true;
  let activeTab = 'details';

  // Load work order details when ID changes
  $: if (workOrderId) {
    loadWorkOrderData();
  }

  async function loadWorkOrderData() {
    if (!workOrderId) return;

    isLoading = true;
    try {
      const [details, requirements, amendmentsData] = await Promise.all([
        fetchWorkOrderDetails(workOrderId),
        fetchAdditionalRequirements(workOrderId),
        fetchWorkOrderAmendments(workOrderId)
      ]);

      workOrder = details;
      additionalRequirements = requirements;
      amendments = amendmentsData;
    } catch (error) {
      console.error('Error loading work order data:', error);
    } finally {
      isLoading = false;
    }
  }

  function getStatusColor(): string {
    if (!workOrder) return '';
    
    if (workOrder.wo_delivery) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    } else if (workOrder.wo_prdn_start) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    } else {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  }

  function getStatusText(): string {
    if (!workOrder) return '';
    
    if (workOrder.wo_delivery) {
      return 'Delivered';
    } else if (workOrder.wo_prdn_start) {
      return 'Work in Progress';
    } else {
      return 'Ordered';
    }
  }
</script>

{#if workOrderId && (workOrder || isLoading)}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[90vw] max-w-6xl max-h-[90vh] overflow-y-auto animate-fade-in transition-colors duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Work Order Details
          {#if workOrder}
            - {workOrder.wo_no || workOrder.pwo_no}
          {/if}
        </div>
        <button 
          class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200" 
          on:click={onClose} 
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {#if isLoading}
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 theme-accent"></div>
          <span class="ml-3 theme-text-primary">Loading work order details...</span>
        </div>
      {:else if workOrder}
        <!-- Status Badge -->
        <div class="mb-6">
          <span class="px-3 py-1 text-sm rounded-full {getStatusColor()}">
            {getStatusText()}
          </span>
        </div>

        <!-- Tabs -->
        <div class="border-b theme-border mb-6">
          <nav class="flex space-x-8">
            <button
              class="py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'details' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent theme-text-secondary hover:theme-text-primary'}"
              on:click={() => activeTab = 'details'}
            >
              Details
            </button>
            <button
              class="py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'requirements' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent theme-text-secondary hover:theme-text-primary'}"
              on:click={() => activeTab = 'requirements'}
            >
              Additional Requirements ({additionalRequirements.length})
            </button>
            <button
              class="py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'amendments' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent theme-text-secondary hover:theme-text-primary'}"
              on:click={() => activeTab = 'amendments'}
            >
              Amendments ({amendments.length})
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        {#if activeTab === 'details'}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Basic Information -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold theme-text-primary">Basic Information</h3>
              <div class="space-y-2">
                <div>
                  <span class="text-sm font-medium theme-text-secondary">WO No:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.wo_no || '-'}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">PWO No:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.pwo_no || '-'}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Type:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.wo_type}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Model:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.wo_model}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Chassis:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.wo_chassis}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Wheel Base:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.wheel_base}</span>
                </div>
              </div>
            </div>

            <!-- Specifications -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold theme-text-primary">Specifications</h3>
              <div class="space-y-2">
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Body Width:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.body_width_mm}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Height:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.height}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Air Ventilation:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.air_ventilation_nos}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Escape Hatch:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.escape_hatch}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Front:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.front}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Rear:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.rear}</span>
                </div>
              </div>
            </div>

            <!-- Seating & Doors -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold theme-text-primary">Seating & Doors</h3>
              <div class="space-y-2">
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Passenger Doors:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.passenger_door_nos}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Emergency Doors:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.emergency_door_nos}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Seat Type:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.seat_type}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">No. of Seats:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.no_of_seats}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Seat Configuration:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.seat_configuration}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Seat Fabrics:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.seat_fabrics}</span>
                </div>
              </div>
            </div>

            <!-- Additional Features -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold theme-text-primary">Additional Features</h3>
              <div class="space-y-2">
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Sound System:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.sound_system}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Paint:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.paint}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Fire Extinguisher:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.fire_extinguisher_kg}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Wiper:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.wiper}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Stepney:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.stepney}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Route Board:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.route_board}</span>
                </div>
              </div>
            </div>

            <!-- Financial Information -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold theme-text-primary">Financial Information</h3>
              <div class="space-y-2">
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Model Rate:</span>
                  <span class="ml-2 theme-text-primary">₹{workOrder.model_rate.toLocaleString()}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Work Order Cost:</span>
                  <span class="ml-2 theme-text-primary">₹{workOrder.work_order_cost.toLocaleString()}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">GST:</span>
                  <span class="ml-2 theme-text-primary">₹{workOrder.gst.toLocaleString()}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">CESS:</span>
                  <span class="ml-2 theme-text-primary">₹{workOrder.cess.toLocaleString()}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Total Cost:</span>
                  <span class="ml-2 font-bold theme-text-primary">₹{workOrder.total_cost.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <!-- Dates -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold theme-text-primary">Important Dates</h3>
              <div class="space-y-2">
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Work Order Date:</span>
                  <span class="ml-2 theme-text-primary">{formatDate(workOrder.wo_date)}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Production Start:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.wo_prdn_start ? formatDate(workOrder.wo_prdn_start) : '-'}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Production End:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.wo_prdn_end ? formatDate(workOrder.wo_prdn_end) : '-'}</span>
                </div>
                <div>
                  <span class="text-sm font-medium theme-text-secondary">Delivery Date:</span>
                  <span class="ml-2 theme-text-primary">{workOrder.wo_delivery ? formatDate(workOrder.wo_delivery) : '-'}</span>
                </div>
              </div>
            </div>
          </div>
        {:else if activeTab === 'requirements'}
          <div class="space-y-4">
            <h3 class="text-lg font-semibold theme-text-primary">Additional Requirements</h3>
            {#if additionalRequirements.length > 0}
              <div class="overflow-x-auto">
                <table class="min-w-full table-auto border-separate border-spacing-y-1">
                  <thead>
                    <tr class="theme-bg-secondary theme-text-primary text-sm">
                      <th class="px-4 py-2 text-left">Position</th>
                      <th class="px-4 py-2 text-left">Work Details</th>
                      <th class="px-4 py-2 text-left">Quantity</th>
                      <th class="px-4 py-2 text-left">Rate</th>
                      <th class="px-4 py-2 text-left">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each additionalRequirements as req}
                      <tr class="theme-bg-primary theme-text-primary">
                        <td class="px-4 py-2">{req.pos_num}</td>
                        <td class="px-4 py-2">{req.work_details}</td>
                        <td class="px-4 py-2">{req.work_qty}</td>
                        <td class="px-4 py-2">₹{req.work_rate.toLocaleString()}</td>
                        <td class="px-4 py-2">₹{(req.work_qty * req.work_rate).toLocaleString()}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="theme-text-secondary text-center py-8">No additional requirements found.</p>
            {/if}
          </div>
        {:else if activeTab === 'amendments'}
          <div class="space-y-4">
            <h3 class="text-lg font-semibold theme-text-primary">Amendments</h3>
            {#if amendments.length > 0}
              <div class="overflow-x-auto">
                <table class="min-w-full table-auto border-separate border-spacing-y-1">
                  <thead>
                    <tr class="theme-bg-secondary theme-text-primary text-sm">
                      <th class="px-4 py-2 text-left">Position</th>
                      <th class="px-4 py-2 text-left">Work Type</th>
                      <th class="px-4 py-2 text-left">Work Details</th>
                      <th class="px-4 py-2 text-left">Work Cost</th>
                      <th class="px-4 py-2 text-left">GST</th>
                      <th class="px-4 py-2 text-left">Total</th>
                      <th class="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each amendments as amendment}
                      <tr class="theme-bg-primary theme-text-primary">
                        <td class="px-4 py-2">{amendment.pos_num}</td>
                        <td class="px-4 py-2">{amendment.work_type}</td>
                        <td class="px-4 py-2">{amendment.work_details}</td>
                        <td class="px-4 py-2">₹{amendment.work_cost.toLocaleString()}</td>
                        <td class="px-4 py-2">₹{amendment.gst.toLocaleString()}</td>
                        <td class="px-4 py-2">₹{(amendment.work_cost + amendment.gst).toLocaleString()}</td>
                        <td class="px-4 py-2">{formatDate(amendment.amend_date)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="theme-text-secondary text-center py-8">No amendments found.</p>
            {/if}
          </div>
        {/if}
      {/if}

      <!-- Close Button -->
      <div class="flex justify-end mt-6">
        <button 
          class="px-4 py-2 bg-gray-500 text-white rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200" 
          on:click={onClose}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease;
  }
</style> 