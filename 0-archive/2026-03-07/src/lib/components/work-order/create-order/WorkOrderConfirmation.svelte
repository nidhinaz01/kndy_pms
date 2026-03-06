<script lang="ts">
  import type { WorkOrderFormData, DataElement } from '$lib/types/workOrder';

  export let formData: WorkOrderFormData;
  export let validationErrors: Record<string, string>;
  export let gstTaxRateOptions: DataElement[];
  export let cessTaxRateOptions: DataElement[];
  export let onFieldChange: (field: string, value: any) => void;
</script>

<div class="space-y-6">
  <h3 class="text-xl font-semibold theme-text-primary mb-6">10. Confirmation</h3>
  
  <div class="theme-bg-secondary theme-border border rounded-lg p-4">
    <div class="flex items-center">
      <svg class="w-5 h-5 theme-text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
      </svg>
      <span class="theme-text-secondary font-medium">Please review all the information below before creating the work order.</span>
    </div>
  </div>

  <div class="space-y-4">
    <h4 class="text-lg font-medium theme-text-primary border-b theme-border pb-2">Work Order Summary</h4>
    
    <!-- Section 1 Summary -->
    <div class="theme-bg-secondary rounded-lg p-4">
      <h5 class="font-medium theme-text-primary mb-3">1. Work Order Details</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span class="font-medium">WO Number:</span> <span class="theme-text-secondary">{formData.wo_no || 'Not provided'}</span></div>
        <div><span class="font-medium">PWO Number:</span> <span class="theme-text-secondary">{formData.pwo_no || 'Not provided'}</span></div>
        <div><span class="font-medium">Type:</span> <span class="theme-text-secondary">{formData.wo_type || 'Not selected'}</span></div>
        <div><span class="font-medium">Model:</span> <span class="theme-text-secondary">{formData.wo_model || 'Not selected'}</span></div>
        <div><span class="font-medium">Date WO Placed:</span> <span class="theme-text-secondary">{formData.wo_date || 'Not selected'}</span></div>
      </div>
    </div>

    <!-- Section 2 Summary -->
    <div class="theme-bg-secondary rounded-lg p-4">
      <h5 class="font-medium theme-text-primary mb-3">2. Chassis Related</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span class="font-medium">Chassis:</span> <span class="theme-text-secondary">{formData.wo_chassis || 'Not selected'}</span></div>
        <div><span class="font-medium">Body Width:</span> <span class="theme-text-secondary">{formData.body_width_mm || 'Not selected'}</span></div>
        <div><span class="font-medium">Height:</span> <span class="theme-text-secondary">{formData.height || 'Not selected'}</span></div>
        <div><span class="font-medium">Wheelbase:</span> <span class="theme-text-secondary">{formData.wheel_base || 'Not selected'}</span></div>
        <div><span class="font-medium">Voltage:</span> <span class="theme-text-secondary">{formData.voltage || 'Not selected'}</span></div>
      </div>
    </div>

    <!-- Section 3 Summary -->
    <div class="theme-bg-secondary rounded-lg p-4">
      <h5 class="font-medium theme-text-primary mb-3">3. Openings</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span class="font-medium">Number of Passenger Doors:</span> <span class="theme-text-secondary">{formData.passenger_door_nos || 'Not selected'}</span></div>
        <div><span class="font-medium">Number of Emergency Doors:</span> <span class="theme-text-secondary">{formData.emergency_door_nos || 'Not selected'}</span></div>
        <div><span class="font-medium">Number of Air Ventilations:</span> <span class="theme-text-secondary">{formData.air_ventilation_nos || 'Not selected'}</span></div>
        <div><span class="font-medium">Position of Front Passenger Door:</span> <span class="theme-text-secondary">{formData.door_position_front || 'Not selected'}</span></div>
        <div><span class="font-medium">Position of Rear Passenger Door:</span> <span class="theme-text-secondary">{formData.door_position_rear || 'Not selected'}</span></div>
        <div><span class="font-medium">Escape Hatch:</span> <span class="theme-text-secondary">{formData.escape_hatch || 'Not selected'}</span></div>
        <div><span class="font-medium">Side Ventilation:</span> <span class="theme-text-secondary">{formData.side_ventilation || 'Not selected'}</span></div>
      </div>
    </div>

    <!-- Section 4 Summary -->
    <div class="theme-bg-secondary rounded-lg p-4">
      <h5 class="font-medium theme-text-primary mb-3">4. Exterior</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span class="font-medium">Front:</span> <span class="theme-text-secondary">{formData.front || 'Not selected'}</span></div>
        <div><span class="font-medium">Front Glass:</span> <span class="theme-text-secondary">{formData.front_glass || 'Not selected'}</span></div>
        <div><span class="font-medium">Rear:</span> <span class="theme-text-secondary">{formData.rear || 'Not selected'}</span></div>
        <div><span class="font-medium">Rear Glass:</span> <span class="theme-text-secondary">{formData.rear_glass || 'Not selected'}</span></div>
        <div><span class="font-medium">Paint:</span> <span class="theme-text-secondary">{formData.paint || 'Not selected'}</span></div>
      </div>
    </div>

    <!-- Section 5 Summary -->
    <div class="theme-bg-secondary rounded-lg p-4">
      <h5 class="font-medium theme-text-primary mb-3">5. Interior</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span class="font-medium">Platform:</span> <span class="theme-text-secondary">{formData.platform || 'Not selected'}</span></div>
        <div><span class="font-medium">Side Panel:</span> <span class="theme-text-secondary">{formData.inside_side_panel || 'Not selected'}</span></div>
        <div><span class="font-medium">Top Panel:</span> <span class="theme-text-secondary">{formData.inside_top_panel || 'Not selected'}</span></div>
        <div><span class="font-medium">Grab Rails:</span> <span class="theme-text-secondary">{formData.inside_grab_rails || 'Not selected'}</span></div>
        <div><span class="font-medium">Luggage Rack:</span> <span class="theme-text-secondary">{formData.inside_luggage_rack || 'Not selected'}</span></div>
      </div>
    </div>

    <!-- Section 6 Summary -->
    <div class="theme-bg-secondary rounded-lg p-4">
      <h5 class="font-medium theme-text-primary mb-3">6. Seats</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span class="font-medium">Seat Type:</span> <span class="theme-text-secondary">{formData.seat_type || 'Not selected'}</span></div>
        <div><span class="font-medium">Seat Fabric:</span> <span class="theme-text-secondary">{formData.seat_fabrics || 'Not selected'}</span></div>
        <div><span class="font-medium">Number of Seats:</span> <span class="theme-text-secondary">{formData.no_of_seats || 'Not selected'}</span></div>
        <div><span class="font-medium">Seat Configuration:</span> <span class="theme-text-secondary">{formData.seat_configuration || 'Not selected'}</span></div>
      </div>
    </div>

    <!-- Section 7 Summary -->
    <div class="theme-bg-secondary rounded-lg p-4">
      <h5 class="font-medium theme-text-primary mb-3">7. Others</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span class="font-medium">Wiper:</span> <span class="theme-text-secondary">{formData.wiper || 'Not selected'}</span></div>
        <div><span class="font-medium">Route Board:</span> <span class="theme-text-secondary">{formData.route_board || 'Not selected'}</span></div>
        <div><span class="font-medium">Sound System:</span> <span class="theme-text-secondary">{formData.sound_system || 'Not selected'}</span></div>
        <div><span class="font-medium">Driver Cabin Partition:</span> <span class="theme-text-secondary">{formData.driver_cabin_partition || 'Not selected'}</span></div>
        <div><span class="font-medium">Record Box Nos:</span> <span class="theme-text-secondary">{formData.record_box_nos || 'Not selected'}</span></div>
        <div><span class="font-medium">Fire Extinguisher:</span> <span class="theme-text-secondary">{formData.fire_extinguisher_kg || 'Not selected'}</span></div>
        <div><span class="font-medium">Stepney:</span> <span class="theme-text-secondary">{formData.stepney || 'Not selected'}</span></div>
        <div><span class="font-medium">Dickey:</span> <span class="theme-text-secondary">{formData.dickey || 'Not selected'}</span></div>
      </div>
    </div>

    <!-- Section 8 Summary -->
    <div class="theme-bg-secondary rounded-lg p-4">
      <h5 class="font-medium theme-text-primary mb-3">8. Additional Requirements</h5>
      <div class="space-y-2">
        {#each formData.additional_requirements as row, index}
          {#if row.work_details || row.work_qty > 0 || row.work_rate > 0}
            <div class="theme-bg-primary rounded-lg p-3 theme-border border">
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div><span class="font-medium">Work Details:</span> <span class="theme-text-secondary">{row.work_details || 'Not selected'}</span></div>
                <div><span class="font-medium">Quantity:</span> <span class="theme-text-secondary">{row.work_qty || '0'}</span></div>
                <div><span class="font-medium">Rate:</span> <span class="theme-text-secondary">₹{row.work_rate || '0.00'}</span></div>
                <div><span class="font-medium">Amount:</span> <span class="theme-text-secondary">₹{row.amount || '0.00'}</span></div>
              </div>
            </div>
          {:else}
            <div class="text-sm theme-text-secondary italic">No additional requirements added</div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Section 9 Summary -->
    <div class="theme-bg-secondary rounded-lg p-4">
      <h5 class="font-medium theme-text-primary mb-3">9. Costs</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span class="font-medium">Work Order Cost:</span> <span class="theme-text-secondary">₹{formData.work_order_cost.toFixed(2)}</span></div>
        <div><span class="font-medium">GST:</span> <span class="theme-text-secondary">₹{formData.gst.toFixed(2)}</span></div>
        <div><span class="font-medium">Cess:</span> <span class="theme-text-secondary">₹{formData.cess.toFixed(2)}</span></div>
        <div><span class="font-medium">Total Cost:</span> <span class="theme-text-secondary">₹{formData.total_cost.toFixed(2)}</span></div>
        <div><span class="font-medium">GST Tax Rate:</span> <span class="theme-text-secondary">{gstTaxRateOptions.length > 0 ? `${gstTaxRateOptions[0].de_value}%` : 'Not available'}</span></div>
        <div><span class="font-medium">Cess Tax Rate:</span> <span class="theme-text-secondary">{cessTaxRateOptions.length > 0 ? `${cessTaxRateOptions[0].de_value}%` : 'Not available'}</span></div>
      </div>
    </div>
  </div>

  <!-- Confirmation Checkbox -->
  <div class="flex items-center space-x-3 p-4 theme-bg-secondary theme-border border rounded-lg">
    <input
      type="checkbox"
      id="confirmation"
      checked={formData.confirmation}
      on:change={(e) => onFieldChange('confirmation', e.currentTarget.checked)}
      class="w-4 h-4 text-blue-600 theme-bg-primary theme-border border rounded focus:ring-blue-500 focus:ring-2"
    />
    <label for="confirmation" class="text-sm font-medium theme-text-primary">
      I confirm that all the information provided above is correct and I want to create this work order.
    </label>
  </div>

  {#if validationErrors.confirmation}
    <div class="text-red-600 dark:text-red-400 text-sm theme-bg-secondary theme-border border p-3 rounded-lg">
      {validationErrors.confirmation}
    </div>
  {/if}
</div>

