<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { fetchAllStdWorkTypeDetails } from '$lib/api/stdWorkTypeDetails';
  import { saveVehicleWorkFlow, getAvailableDerivativeWorksForVehicle } from '$lib/api/stdVehicleWorkFlow';
  import { getDetailedTimeBreakdownForDerivativeWork } from '$lib/api/stdSkillTimeStandards';
  import { formatTimeBreakdown } from '$lib/utils/formatDate';
  import Button from '$lib/components/common/Button.svelte';

  export let showAddModal: boolean;
  export let onClose: () => void;
  export let onItemAdded: () => void;

  let vehicleTypes: any[] = [];
  let availableDerivativeWorks: any[] = [];
  let dependencyDerivativeWorks: any[] = [];
  let selectedVehicleType = '';
  let selectedDerivedWork = '';
  let selectedDependency = '';
  let sequenceOrder = 1;
  let estimatedDurationMinutes = 0;
  let timeBreakdown: any = null;
  let errorMsg = '';
  let submitting = false;

  const dispatch = createEventDispatcher();

  // Filter dependency works to exclude the currently selected derivative work
  $: availableDependencyWorks = dependencyDerivativeWorks.filter(work => 
    work.derived_sw_code !== selectedDerivedWork
  );

  // Clear dependency when derivative work changes
  $: if (selectedDerivedWork && selectedDependency === selectedDerivedWork) {
    selectedDependency = '';
  }

  // Auto-populate estimated duration when derivative work changes
  $: if (selectedDerivedWork) {
    loadEstimatedDuration();
  } else {
    estimatedDurationMinutes = 0;
  }

  onMount(async () => {
    try {
      // Load vehicle types
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('mstr_wo_type')
        .select('id, wo_type_name')
        .eq('is_deleted', false)
        .order('wo_type_name');

      if (vehicleError) throw vehicleError;
      vehicleTypes = vehicleData || [];

      // Load all derivative works for dependency selection
      dependencyDerivativeWorks = await fetchAllStdWorkTypeDetails();
      
      console.log('Loaded vehicle types:', vehicleTypes);
      console.log('Loaded derivative works for dependencies:', dependencyDerivativeWorks);
    } catch (error) {
      console.error('Error loading data:', error);
      vehicleTypes = [];
      dependencyDerivativeWorks = [];
    }
  });

  // Load available derivative works when vehicle type changes
  $: if (selectedVehicleType) {
    loadAvailableDerivativeWorks();
  } else {
    availableDerivativeWorks = [];
    selectedDerivedWork = '';
  }

  async function loadAvailableDerivativeWorks() {
    if (!selectedVehicleType) return;
    
    try {
      availableDerivativeWorks = await getAvailableDerivativeWorksForVehicle(parseInt(selectedVehicleType));
      console.log('Available derivative works:', availableDerivativeWorks);
    } catch (error) {
      console.error('Error loading available derivative works:', error);
      availableDerivativeWorks = [];
    }
  }

  async function loadEstimatedDuration() {
    if (!selectedDerivedWork) return;
    
    try {
      const result = await getDetailedTimeBreakdownForDerivativeWork(selectedDerivedWork);
      estimatedDurationMinutes = result.totalMinutes;
      timeBreakdown = result;
      console.log(`Estimated duration for ${selectedDerivedWork}:`, result);
    } catch (error) {
      console.error('Error loading estimated duration:', error);
      estimatedDurationMinutes = 0;
      timeBreakdown = null;
    }
  }

  async function handleSubmit() {
    errorMsg = '';
    
    if (!selectedVehicleType) {
      errorMsg = 'Please select a vehicle type.';
      return;
    }

    if (!selectedDerivedWork) {
      errorMsg = 'Please select a derivative work.';
      return;
    }

    if (sequenceOrder <= 0) {
      errorMsg = 'Sequence order must be greater than 0.';
      return;
    }

    if (estimatedDurationMinutes <= 0) {
      errorMsg = 'Estimated duration must be greater than 0.';
      return;
    }

    submitting = true;
    try {
      await saveVehicleWorkFlow({
        wo_type_id: parseInt(selectedVehicleType),
        derived_sw_code: selectedDerivedWork,
        sequence_order: sequenceOrder,
        dependency_derived_sw_code: selectedDependency || undefined,
        estimated_duration_minutes: estimatedDurationMinutes
      });
      
      // Reset form
      selectedVehicleType = '';
      selectedDerivedWork = '';
      selectedDependency = '';
      sequenceOrder = 1;
      estimatedDurationMinutes = 0;
      availableDerivativeWorks = [];
      alert('Vehicle work flow created successfully!');
      onItemAdded();
    } catch (e: any) {
      errorMsg = 'Error saving vehicle work flow: ' + (e.message || e);
    } finally {
      submitting = false;
    }
  }

  function handleClose() {
    selectedVehicleType = '';
    selectedDerivedWork = '';
    selectedDependency = '';
    sequenceOrder = 1;
    estimatedDurationMinutes = 0;
    availableDerivativeWorks = [];
    errorMsg = '';
    onClose();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] max-h-[90vh] overflow-y-auto animate-fade-in">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg theme-text-accent flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Vehicle Work Flow
        </div>
        <button class="theme-text-secondary hover:theme-text-accent transition-colors" on:click={handleClose} aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {#if errorMsg}
        <div class="theme-text-danger mb-2">{errorMsg}</div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <!-- Vehicle Type Selection -->
        <div>
          <label for="vehicleType" class="block text-sm font-medium theme-text-primary mb-1">
            Vehicle Type *
          </label>
            <select
              id="vehicleType"
              bind:value={selectedVehicleType}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              required
            >
              <option value="">-- Select a vehicle type --</option>
              {#each vehicleTypes as vehicle}
                <option value={vehicle.id}>
                  {vehicle.wo_type_name}
                </option>
              {/each}
            </select>
            <p class="mt-1 text-xs theme-text-secondary">
              Select the vehicle type for this work flow.
            </p>
          </div>

        <!-- Derivative Work Selection -->
        <div>
          <label for="derivedWork" class="block text-sm font-medium theme-text-primary mb-1">
            Derivative Work *
          </label>
            <select
              id="derivedWork"
              bind:value={selectedDerivedWork}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              required
              disabled={!selectedVehicleType || availableDerivativeWorks.length === 0}
            >
              <option value="">-- Select a derivative work --</option>
              {#each availableDerivativeWorks as work}
                <option value={work.derived_sw_code}>
                  {work.derived_sw_code} - {work.type_description}
                </option>
              {/each}
            </select>
            <p class="mt-1 text-xs theme-text-secondary">
              {#if selectedVehicleType && availableDerivativeWorks.length === 0}
                No available derivative works for this vehicle type.
              {:else if selectedVehicleType}
                Select a derivative work to add to this vehicle's production flow.
              {:else}
                Select a vehicle type first to see available derivative works.
              {/if}
            </p>
          </div>

        <!-- Sequence Order -->
        <div>
          <label for="sequenceOrder" class="block text-sm font-medium theme-text-primary mb-1">
            Sequence Order *
          </label>
            <input
              id="sequenceOrder"
              type="number"
              bind:value={sequenceOrder}
              min="1"
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              placeholder="Enter sequence order"
              required
            />
            <p class="mt-1 text-xs theme-text-secondary">
              Enter the order of this work in the production sequence (1, 2, 3, etc.).
            </p>
          </div>

        <!-- Dependency Selection -->
        <div>
          <label for="dependency" class="block text-sm font-medium theme-text-primary mb-1">
            Dependency (Optional)
          </label>
            <select
              id="dependency"
              bind:value={selectedDependency}
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
            >
              <option value="">-- No dependency --</option>
              {#each availableDependencyWorks as work}
                <option value={work.derived_sw_code}>
                  {work.derived_sw_code} - {work.type_description}
                </option>
              {/each}
            </select>
            <p class="mt-1 text-xs theme-text-secondary">
              Select a work that must be completed before this work (optional).
            </p>
          </div>

        <!-- Estimated Duration -->
        <div>
          <label for="estimatedDuration" class="block text-sm font-medium theme-text-primary mb-1">
            Estimated Duration (minutes) *
          </label>
            <input
              id="estimatedDuration"
              type="number"
              bind:value={estimatedDurationMinutes}
              min="1"
              class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary"
              placeholder="Auto-calculated from time standards"
              required
              readonly
            />
            <p class="mt-1 text-xs theme-text-secondary">
              {#if selectedDerivedWork && estimatedDurationMinutes > 0}
                Auto-calculated from time standards for {selectedDerivedWork} ({formatTimeBreakdown(timeBreakdown.breakdown, timeBreakdown.isUniform, estimatedDurationMinutes)})
              {:else if selectedDerivedWork && estimatedDurationMinutes === 0}
                <span class="theme-text-danger">
                  No time standards found for {selectedDerivedWork}. Please add time standards first.
                </span>
              {:else}
                Duration will be auto-calculated from time standards when you select a derivative work.
              {/if}
            </p>
          </div>

        <!-- Action Buttons -->
        <div class="flex justify-between gap-3 pt-4">
          <Button variant="primary" size="md" type="submit" disabled={submitting || !selectedVehicleType || !selectedDerivedWork || sequenceOrder <= 0 || estimatedDurationMinutes <= 0}>
            {submitting ? 'Creating...' : 'Create Work Flow'}
          </Button>
          <Button variant="secondary" size="md" on:click={handleClose}>Cancel</Button>
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