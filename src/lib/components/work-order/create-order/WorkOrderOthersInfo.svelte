<script lang="ts">
  import type { WorkOrderFormData, DataElement } from '$lib/types/workOrder';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let wiperOptions: DataElement[];
  export let routeBoardOptions: DataElement[];
  export let soundSystemOptions: DataElement[];
  export let driverCabinPartitionOptions: DataElement[];
  export let recordBoxNosOptions: DataElement[];
  export let fireExtinguisherOptions: DataElement[];
  export let stepneyOptions: DataElement[];
  export let dickeyOptions: DataElement[];
  export let onFieldChange: (field: string, value: any) => void;
</script>

<div class="space-y-4">
  <h3 class="text-xl font-semibold theme-text-primary mb-4">7. Others</h3>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="wiper" class="block text-sm font-medium theme-text-primary mb-2">Wiper *</label>
      <select
        id="wiper"
        value={formData.wiper}
        on:change={(e) => onFieldChange('wiper', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wiper ? 'border-red-500' : ''}"
      >
        <option value="">Select Wiper</option>
        {#each wiperOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.wiper}
        <p class="text-red-600 text-sm mt-1">{validationErrors.wiper}</p>
      {/if}
    </div>
    <div>
      <label for="route_board" class="block text-sm font-medium theme-text-primary mb-2">Route Board *</label>
      <select
        id="route_board"
        value={formData.route_board}
        on:change={(e) => onFieldChange('route_board', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.route_board ? 'border-red-500' : ''}"
      >
        <option value="">Select Route Board</option>
        {#each routeBoardOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.route_board}
        <p class="text-red-600 text-sm mt-1">{validationErrors.route_board}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="sound_system" class="block text-sm font-medium theme-text-primary mb-2">Sound System *</label>
      <select
        id="sound_system"
        value={formData.sound_system}
        on:change={(e) => onFieldChange('sound_system', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.sound_system ? 'border-red-500' : ''}"
      >
        <option value="">Select Sound System</option>
        {#each soundSystemOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.sound_system}
        <p class="text-red-600 text-sm mt-1">{validationErrors.sound_system}</p>
      {/if}
    </div>
    <div>
      <label for="driver_cabin_partition" class="block text-sm font-medium theme-text-primary mb-2">Driver Cabin Partition *</label>
      <select
        id="driver_cabin_partition"
        value={formData.driver_cabin_partition}
        on:change={(e) => onFieldChange('driver_cabin_partition', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.driver_cabin_partition ? 'border-red-500' : ''}"
      >
        <option value="">Select Driver Cabin Partition</option>
        {#each driverCabinPartitionOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.driver_cabin_partition}
        <p class="text-red-600 text-sm mt-1">{validationErrors.driver_cabin_partition}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="record_box_nos" class="block text-sm font-medium theme-text-primary mb-2">Number of Record Box *</label>
      <select
        id="record_box_nos"
        value={formData.record_box_nos}
        on:change={(e) => onFieldChange('record_box_nos', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.record_box_nos ? 'border-red-500' : ''}"
      >
        <option value="">Select Number of Record Box</option>
        {#each recordBoxNosOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.record_box_nos}
        <p class="text-red-600 text-sm mt-1">{validationErrors.record_box_nos}</p>
      {/if}
    </div>
    <div>
      <label for="fire_extinguisher_kg" class="block text-sm font-medium theme-text-primary mb-2">Fire Extinguisher *</label>
      <select
        id="fire_extinguisher_kg"
        value={formData.fire_extinguisher_kg}
        on:change={(e) => onFieldChange('fire_extinguisher_kg', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.fire_extinguisher_kg ? 'border-red-500' : ''}"
      >
        <option value="">Select Fire Extinguisher</option>
        {#each fireExtinguisherOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.fire_extinguisher_kg}
        <p class="text-red-600 text-sm mt-1">{validationErrors.fire_extinguisher_kg}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="stepney" class="block text-sm font-medium theme-text-primary mb-2">Stepney *</label>
      <select
        id="stepney"
        value={formData.stepney}
        on:change={(e) => onFieldChange('stepney', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.stepney ? 'border-red-500' : ''}"
      >
        <option value="">Select Stepney</option>
        {#each stepneyOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.stepney}
        <p class="text-red-600 text-sm mt-1">{validationErrors.stepney}</p>
      {/if}
    </div>
    <div>
      <label for="dickey" class="block text-sm font-medium theme-text-primary mb-2">Dickey *</label>
      <select
        id="dickey"
        value={formData.dickey}
        on:change={(e) => onFieldChange('dickey', e.currentTarget.value)}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.dickey ? 'border-red-500' : ''}"
      >
        <option value="">Select Dickey</option>
        {#each dickeyOptions as option}
          <option value={option.de_value}>{option.de_value}</option>
        {/each}
      </select>
      {#if validationErrors.dickey}
        <p class="text-red-600 text-sm mt-1">{validationErrors.dickey}</p>
      {/if}
    </div>
  </div>
</div>

