<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { sanitizeString, isValidTrimmedString } from '$lib/utils/inputSanitization';
  import { onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  
  export let showAddModal: boolean;
  export let onClose: () => void;
  export let onModelAdded: () => void;

  let formData = {
    wo_type_code: '',
    wo_type_name: '',
    wo_comfort_level: '',
    wo_capacity: '',
    wo_carrier_type: ''
  };

  let errors: Record<string, string> = {};
  let isSubmitting = false;
  let isLoading = false;

  // Dropdown options
  let typeCodes: string[] = [];
  let comfortLevels: string[] = [];
  let capacities: string[] = [];
  let carrierTypes: string[] = [];

  // Load dropdown data from sys_data_elements
  async function loadDropdownData() {
    isLoading = true;
    try {
      // Load Type Codes
      const { data: typeCodeData, error: typeCodeError } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Type Code')
        .order('de_value');

      if (typeCodeError) {
        console.error('Error loading type codes:', typeCodeError);
      } else {
        typeCodes = typeCodeData?.map(item => item.de_value) || [];
      }

      // Load Comfort Levels
      const { data: comfortData, error: comfortError } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Comfort Level')
        .order('de_value');

      if (comfortError) {
        console.error('Error loading comfort levels:', comfortError);
      } else {
        comfortLevels = comfortData?.map(item => item.de_value) || [];
      }

      // Load Capacities
      const { data: capacityData, error: capacityError } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Capacity')
        .order('de_value');

      if (capacityError) {
        console.error('Error loading capacities:', capacityError);
      } else {
        capacities = capacityData?.map(item => item.de_value) || [];
      }

      // Load Carrier Types
      const { data: carrierData, error: carrierError } = await supabase
        .from('sys_data_elements')
        .select('de_value')
        .eq('de_name', 'Carrier Type')
        .order('de_value');

      if (carrierError) {
        console.error('Error loading carrier types:', carrierError);
      } else {
        carrierTypes = carrierData?.map(item => item.de_value) || [];
      }
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    } finally {
      isLoading = false;
    }
  }

  function validateForm(): boolean {
    errors = {};
    
    if (!isValidTrimmedString(formData.wo_type_code)) {
      errors.wo_type_code = 'Type Code is required';
    }
    
    if (!isValidTrimmedString(formData.wo_type_name)) {
      errors.wo_type_name = 'Type Name is required';
    }
    
    if (!isValidTrimmedString(formData.wo_comfort_level)) {
      errors.wo_comfort_level = 'Comfort Level is required';
    }
    
    if (!isValidTrimmedString(formData.wo_capacity)) {
      errors.wo_capacity = 'Capacity is required';
    }
    
    if (!isValidTrimmedString(formData.wo_carrier_type)) {
      errors.wo_carrier_type = 'Carrier Type is required';
    }

    return Object.keys(errors).length === 0;
  }

  async function checkNameUniqueness(name: string): Promise<boolean> {
    const sanitizedName = sanitizeString(name);
    const { data, error } = await supabase
      .from('mstr_wo_type')
      .select('wo_type_name')
      .eq('wo_type_name', sanitizedName)
      .maybeSingle();

    if (error) {
      console.error('Error checking name uniqueness:', error);
      return false;
    }

    return !data; // Return true if name is unique (no existing record)
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    // Check if name is unique
    const isNameUnique = await checkNameUniqueness(formData.wo_type_name);
    if (!isNameUnique) {
      errors.wo_type_name = 'Type Name must be unique';
      return;
    }

    isSubmitting = true;

    try {
      const username = localStorage.getItem('username') || 'unknown';
      const currentDate = new Date().toISOString(); // Full ISO string for timestampz

      console.log('Attempting to insert model:', {
        wo_type_code: formData.wo_type_code,
        wo_type_name: formData.wo_type_name,
        wo_comfort_level: formData.wo_comfort_level,
        wo_capacity: formData.wo_capacity,
        wo_carrier_type: formData.wo_carrier_type,
        is_deleted: false,
        modified_by: username,
        modified_dt: currentDate
      });

      const { data, error } = await supabase
        .from('mstr_wo_type')
        .insert({
          wo_type_code: sanitizeString(formData.wo_type_code),
          wo_type_name: sanitizeString(formData.wo_type_name),
          wo_comfort_level: sanitizeString(formData.wo_comfort_level),
          wo_capacity: sanitizeString(formData.wo_capacity),
          wo_carrier_type: sanitizeString(formData.wo_carrier_type),
          is_deleted: false,
          modified_by: username,
          modified_dt: currentDate
        });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Error adding model:', error);
        alert('Failed to add model. Please try again.');
      } else {
        console.log('Model added successfully');
        // Success - reset form and close modal
        formData = {
          wo_type_code: '',
          wo_type_name: '',
          wo_comfort_level: '',
          wo_capacity: '',
          wo_carrier_type: ''
        };
        errors = {};
        onModelAdded();
      }
    } catch (error) {
      console.error('Exception during model addition:', error);
      alert('Failed to add model. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    // Reset form when closing
    formData = {
      wo_type_code: '',
      wo_type_name: '',
      wo_comfort_level: '',
      wo_capacity: '',
      wo_carrier_type: ''
    };
    errors = {};
    onClose();
  }

  // Load dropdown data when modal opens
  $: if (showAddModal) {
    loadDropdownData();
  }
</script>

{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add New Model
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

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label for="wo_type_code" class="block text-sm font-medium theme-text-primary mb-1">Type Code *</label>
          <select 
            id="wo_type_code"
            bind:value={formData.wo_type_code}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            required
          >
            <option value="">Select Type Code</option>
            {#each typeCodes as code}
              <option value={code}>{code}</option>
            {/each}
          </select>
          {#if errors.wo_type_code}
            <p class="text-red-500 text-xs mt-1">{errors.wo_type_code}</p>
          {/if}
        </div>

        <div>
          <label for="wo_type_name" class="block text-sm font-medium theme-text-primary mb-1">Type Name *</label>
          <input 
            id="wo_type_name"
            type="text" 
            bind:value={formData.wo_type_name}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none" 
            placeholder="Enter type name"
            maxlength="20"
            required
          />
          {#if errors.wo_type_name}
            <p class="text-red-500 text-xs mt-1">{errors.wo_type_name}</p>
          {/if}
        </div>

        <div>
          <label for="wo_comfort_level" class="block text-sm font-medium theme-text-primary mb-1">Comfort Level *</label>
          <select 
            id="wo_comfort_level"
            bind:value={formData.wo_comfort_level}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            required
          >
            <option value="">Select Comfort Level</option>
            {#each comfortLevels as level}
              <option value={level}>{level}</option>
            {/each}
          </select>
          {#if errors.wo_comfort_level}
            <p class="text-red-500 text-xs mt-1">{errors.wo_comfort_level}</p>
          {/if}
        </div>

        <div>
          <label for="wo_capacity" class="block text-sm font-medium theme-text-primary mb-1">Capacity *</label>
          <select 
            id="wo_capacity"
            bind:value={formData.wo_capacity}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            required
          >
            <option value="">Select Capacity</option>
            {#each capacities as capacity}
              <option value={capacity}>{capacity}</option>
            {/each}
          </select>
          {#if errors.wo_capacity}
            <p class="text-red-500 text-xs mt-1">{errors.wo_capacity}</p>
          {/if}
        </div>

        <div>
          <label for="wo_carrier_type" class="block text-sm font-medium theme-text-primary mb-1">Carrier Type *</label>
          <select 
            id="wo_carrier_type"
            bind:value={formData.wo_carrier_type}
            class="w-full border theme-border rounded px-3 py-2 theme-bg-secondary theme-text-primary transition-colors duration-200 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            required
          >
            <option value="">Select Carrier Type</option>
            {#each carrierTypes as carrier}
              <option value={carrier}>{carrier}</option>
            {/each}
          </select>
          {#if errors.wo_carrier_type}
            <p class="text-red-500 text-xs mt-1">{errors.wo_carrier_type}</p>
          {/if}
        </div>

        <div class="flex justify-between gap-3 pt-4">
          <Button 
            type="submit"
            variant="success"
            size="md"
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adding...
            {:else}
              Add Model
            {/if}
          </Button>
          <Button 
            type="button"
            variant="secondary"
            size="md"
            on:click={handleClose}
          >
            Cancel
          </Button>
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