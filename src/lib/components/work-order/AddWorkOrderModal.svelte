<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  
  export let showAddModal: boolean;
  export let onClose: () => void;
  export let onWorkOrderAdded: () => void;

  let formData = {
    wo_no: '',
    pwo_no: '',
    wo_type: '',
    wo_model: '',
    wo_chassis: '',
    wheel_base: '',
    model_rate: 0,
    body_width_mm: '',
    height: '',
    air_ventilation_nos: '',
    escape_hatch: '',
    front: '',
    rear: '',
    front_glass: '',
    emergency_door_nos: '',
    platform: '',
    inside_grab_rails: '',
    seat_type: '',
    no_of_seats: '',
    seat_configuration: '',
    dickey: '',
    passenger_door_nos: '',
    side_ventilation: '',
    door_position_front: '',
    door_position_rear: '',
    inside_top_panel: '',
    inside_side_panel: '',
    inside_luggage_rack: '',
    sound_system: '',
    paint: '',
    fire_extinguisher_kg: '',
    wiper: '',
    stepney: '',
    record_box_nos: '',
    route_board: '',
    seat_fabrics: '',
    rear_glass: '',
    driver_cabin_partition: '',
    voltage: '',
    work_order_cost: 0,
    gst: 0,
    cess: 0,
    total_cost: 0,
    wo_date: new Date().toISOString().split('T')[0]
  };

  let errors: Record<string, string> = {};
  let isSubmitting = false;
  let workOrderTypes: string[] = [];

  onMount(async () => {
    await loadWorkOrderTypes();
  });

  async function loadWorkOrderTypes() {
    try {
      const { data, error } = await supabase
        .from('mstr_wo_type')
        .select('wo_type_name')
        .eq('is_deleted', false)
        .order('wo_type_name');

      if (error) {
        console.error('Error loading work order types:', error);
      } else {
        workOrderTypes = data?.map(item => item.wo_type_name) || [];
      }
    } catch (error) {
      console.error('Error loading work order types:', error);
    }
  }

  function calculateTotalCost() {
    const baseCost = formData.work_order_cost || 0;
    const gstAmount = (baseCost * (formData.gst || 0)) / 100;
    const cessAmount = (baseCost * (formData.cess || 0)) / 100;
    formData.total_cost = baseCost + gstAmount + cessAmount;
  }

  $: if (formData.work_order_cost || formData.gst || formData.cess) {
    calculateTotalCost();
  }

  async function handleSubmit() {
    isSubmitting = true;

    try {
      // Validate required fields
      if (!formData.wo_type || !formData.wo_model || !formData.wo_chassis) {
        alert('Please fill in all required fields (Type, Model, Chassis)');
        return;
      }

      // Validate that either WO No or PWO No is provided
      if (!formData.wo_no && !formData.pwo_no) {
        alert('Please provide either WO No or PWO No');
        return;
      }

      console.log('Submitting work order:', formData);

      const { data, error } = await supabase
        .from('prdn_wo_details')
        .insert(formData)
        .select('id')
        .single();

      if (error) {
        console.error('Error creating work order:', error);
        alert('Failed to create work order. Please try again.');
      } else {
        console.log('Work order created successfully:', data);
        onWorkOrderAdded();
      }
    } catch (error) {
      console.error('Exception during work order creation:', error);
      alert('Failed to create work order. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add New Work Order
        </div>
        <button 
          class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200" 
          on:click={handleClose} 
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <!-- Basic Information -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label for="wo_no" class="block text-sm font-medium theme-text-primary mb-1">WO No</label>
            <input 
              type="text" 
              id="wo_no"
              bind:value={formData.wo_no}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              placeholder="Work Order Number"
            />
          </div>

          <div>
            <label for="pwo_no" class="block text-sm font-medium theme-text-primary mb-1">PWO No</label>
            <input 
              type="text" 
              id="pwo_no"
              bind:value={formData.pwo_no}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              placeholder="Purchase Work Order Number"
            />
          </div>

          <div>
            <label for="wo_type" class="block text-sm font-medium theme-text-primary mb-1">Type *</label>
            <input 
              type="text" 
              id="wo_type"
              bind:value={formData.wo_type}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              placeholder="Work Order Type"
              required
            />
          </div>

          <div>
            <label for="wo_model" class="block text-sm font-medium theme-text-primary mb-1">Model *</label>
            <select 
              id="wo_model"
              bind:value={formData.wo_model}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              required
            >
              <option value="">Select Model</option>
              {#each workOrderTypes as type}
                <option value={type}>{type}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="wo_chassis" class="block text-sm font-medium theme-text-primary mb-1">Chassis *</label>
            <input 
              type="text" 
              id="wo_chassis"
              bind:value={formData.wo_chassis}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              placeholder="Chassis Number"
              required
            />
          </div>

          <div>
            <label for="wo_date" class="block text-sm font-medium theme-text-primary mb-1">Work Order Date *</label>
            <input 
              type="date" 
              id="wo_date"
              bind:value={formData.wo_date}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              required
            />
          </div>
        </div>

        <!-- Financial Information -->
        <div class="border-t theme-border pt-4">
          <h3 class="text-lg font-semibold theme-text-primary mb-4">Financial Information</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label for="model_rate" class="block text-sm font-medium theme-text-primary mb-1">Model Rate *</label>
              <input 
                type="number" 
                id="model_rate"
                bind:value={formData.model_rate}
                class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>

            <div>
              <label for="work_order_cost" class="block text-sm font-medium theme-text-primary mb-1">Work Order Cost *</label>
              <input 
                type="number" 
                id="work_order_cost"
                bind:value={formData.work_order_cost}
                class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>

            <div>
              <label for="gst" class="block text-sm font-medium theme-text-primary mb-1">GST % *</label>
              <input 
                type="number" 
                id="gst"
                bind:value={formData.gst}
                class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>

            <div>
              <label for="cess" class="block text-sm font-medium theme-text-primary mb-1">CESS % *</label>
              <input 
                type="number" 
                id="cess"
                bind:value={formData.cess}
                class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>
          </div>

          <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <span class="text-sm font-medium theme-text-primary">Total Cost: ₹{formData.total_cost.toLocaleString()}</span>
          </div>
        </div>

        <div class="flex justify-between gap-3 pt-4">
          <button 
            type="submit"
            class="px-4 py-2 bg-green-500 text-white rounded-lg border-2 border-green-500 shadow hover:bg-green-600 hover:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 active:bg-green-700 active:border-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            {:else}
              Create Work Order
            {/if}
          </button>
          <button 
            type="button"
            class="px-4 py-2 bg-gray-500 text-white rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
            on:click={handleClose}
          >
            Cancel
          </button>
        </div>
      </form>
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