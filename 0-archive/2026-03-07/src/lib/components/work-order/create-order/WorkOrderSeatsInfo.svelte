<script lang="ts">
  import type { WorkOrderFormData, DataElement } from '$lib/types/workOrder';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let seatTypeOptions: DataElement[];
  export let seatFabricsOptions: DataElement[];
  export let noOfSeatsOptions: DataElement[];
  export let seatConfigurationOptions: DataElement[];
  export let onFieldChange: (field: string, value: any) => void;
</script>

<div class="space-y-4">
  <h3 class="text-xl font-semibold theme-text-primary mb-4">6. Seats</h3>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="seat_type" class="block text-sm font-medium theme-text-primary mb-2">Seat Type *</label>
      <select
        id="seat_type"
        value={formData.seat_type}
        on:change={(e) => onFieldChange('seat_type', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.seat_type ? 'border-red-500' : ''}"
      >
        <option value="">Select Seat Type</option>
        {#each seatTypeOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.seat_type}
        <p class="text-red-600 text-sm mt-1">{validationErrors.seat_type}</p>
      {/if}
    </div>
    <div>
      <label for="seat_fabrics" class="block text-sm font-medium theme-text-primary mb-2">Seat Fabric *</label>
      <select
        id="seat_fabrics"
        value={formData.seat_fabrics}
        on:change={(e) => onFieldChange('seat_fabrics', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.seat_fabrics ? 'border-red-500' : ''}"
      >
        <option value="">Select Seat Fabric</option>
        {#each seatFabricsOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.seat_fabrics}
        <p class="text-red-600 text-sm mt-1">{validationErrors.seat_fabrics}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="no_of_seats" class="block text-sm font-medium theme-text-primary mb-2">Number of Seats *</label>
      <select
        id="no_of_seats"
        value={formData.no_of_seats}
        on:change={(e) => onFieldChange('no_of_seats', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.no_of_seats ? 'border-red-500' : ''}"
      >
        <option value="">Select Number of Seats</option>
        {#each noOfSeatsOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.no_of_seats}
        <p class="text-red-600 text-sm mt-1">{validationErrors.no_of_seats}</p>
      {/if}
    </div>
    <div>
      <label for="seat_configuration" class="block text-sm font-medium theme-text-primary mb-2">Seat Configuration *</label>
      <select
        id="seat_configuration"
        value={formData.seat_configuration}
        on:change={(e) => onFieldChange('seat_configuration', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.seat_configuration ? 'border-red-500' : ''}"
      >
        <option value="">Select Seat Configuration</option>
        {#each seatConfigurationOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.seat_configuration}
        <p class="text-red-600 text-sm mt-1">{validationErrors.seat_configuration}</p>
      {/if}
    </div>
  </div>
</div>

