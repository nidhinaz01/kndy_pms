<script lang="ts">
  import type { WorkOrderFormData, DataElement } from '$lib/types/workOrder';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let passengerDoorNosOptions: DataElement[];
  export let emergencyDoorNosOptions: DataElement[];
  export let airVentilationNosOptions: DataElement[];
  export let doorPositionFrontOptions: DataElement[];
  export let doorPositionRearOptions: DataElement[];
  export let escapeHatchOptions: DataElement[];
  export let sideVentilationOptions: DataElement[];
  export let onFieldChange: (field: string, value: any) => void;
</script>

<div class="space-y-4">
  <h3 class="text-xl font-semibold theme-text-primary mb-4">3. Openings</h3>
  
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div>
      <label for="passenger_door_nos" class="block text-sm font-medium theme-text-primary mb-2">Number of Passenger Doors *</label>
      <select
        id="passenger_door_nos"
        value={formData.passenger_door_nos}
        on:change={(e) => onFieldChange('passenger_door_nos', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.passenger_door_nos ? 'border-red-500' : ''}"
      >
        <option value="">Select Number</option>
        {#each passengerDoorNosOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.passenger_door_nos}
        <p class="text-red-600 text-sm mt-1">{validationErrors.passenger_door_nos}</p>
      {/if}
    </div>
    <div>
      <label for="emergency_door_nos" class="block text-sm font-medium theme-text-primary mb-2">Number of Emergency Doors *</label>
      <select
        id="emergency_door_nos"
        value={formData.emergency_door_nos}
        on:change={(e) => onFieldChange('emergency_door_nos', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.emergency_door_nos ? 'border-red-500' : ''}"
      >
        <option value="">Select Number</option>
        {#each emergencyDoorNosOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.emergency_door_nos}
        <p class="text-red-600 text-sm mt-1">{validationErrors.emergency_door_nos}</p>
      {/if}
    </div>
    <div>
      <label for="air_ventilation_nos" class="block text-sm font-medium theme-text-primary mb-2">Number of Air Ventilations *</label>
      <select
        id="air_ventilation_nos"
        value={formData.air_ventilation_nos}
        on:change={(e) => onFieldChange('air_ventilation_nos', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.air_ventilation_nos ? 'border-red-500' : ''}"
      >
        <option value="">Select Number</option>
        {#each airVentilationNosOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.air_ventilation_nos}
        <p class="text-red-600 text-sm mt-1">{validationErrors.air_ventilation_nos}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="door_position_front" class="block text-sm font-medium theme-text-primary mb-2">Position of Front Passenger Door *</label>
      <select
        id="door_position_front"
        value={formData.door_position_front}
        on:change={(e) => onFieldChange('door_position_front', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.door_position_front ? 'border-red-500' : ''}"
      >
        <option value="">Select Position</option>
        {#each doorPositionFrontOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.door_position_front}
        <p class="text-red-600 text-sm mt-1">{validationErrors.door_position_front}</p>
      {/if}
    </div>
    <div>
      <label for="door_position_rear" class="block text-sm font-medium theme-text-primary mb-2">Position of Rear Passenger Door *</label>
      <select
        id="door_position_rear"
        value={formData.door_position_rear}
        on:change={(e) => onFieldChange('door_position_rear', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.door_position_rear ? 'border-red-500' : ''}"
      >
        <option value="">Select Position</option>
        {#each doorPositionRearOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.door_position_rear}
        <p class="text-red-600 text-sm mt-1">{validationErrors.door_position_rear}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="escape_hatch" class="block text-sm font-medium theme-text-primary mb-2">Escape Hatch *</label>
      <select
        id="escape_hatch"
        value={formData.escape_hatch}
        on:change={(e) => onFieldChange('escape_hatch', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.escape_hatch ? 'border-red-500' : ''}"
      >
        <option value="">Select Escape Hatch</option>
        {#each escapeHatchOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.escape_hatch}
        <p class="text-red-600 text-sm mt-1">{validationErrors.escape_hatch}</p>
      {/if}
    </div>
    <div>
      <label for="side_ventilation" class="block text-sm font-medium theme-text-primary mb-2">Side Ventilation *</label>
      <select
        id="side_ventilation"
        value={formData.side_ventilation}
        on:change={(e) => onFieldChange('side_ventilation', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.side_ventilation ? 'border-red-500' : ''}"
      >
        <option value="">Select Side Ventilation</option>
        {#each sideVentilationOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.side_ventilation}
        <p class="text-red-600 text-sm mt-1">{validationErrors.side_ventilation}</p>
      {/if}
    </div>
  </div>
</div>

