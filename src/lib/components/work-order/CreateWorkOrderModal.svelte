<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';
  
  // Types and utilities
  import type { WorkOrderFormData, WorkOrderDropdownOptions } from '$lib/types/workOrder';
  import { initialFormData } from '$lib/types/workOrder';
  import { validateSection, hasSectionErrors, getSectionFields } from '$lib/utils/workOrderValidation';
  import { loadAllDropdownData } from '$lib/services/workOrderDropdownService';
  import { checkUniqueness, updateFieldsFromModel, calculateTotalCost as calcTotalCost } from '$lib/utils/workOrderUtils';
  
  // Section components
  import WorkOrderBasicInfo from './create-order/WorkOrderBasicInfo.svelte';
  import WorkOrderChassisInfo from './create-order/WorkOrderChassisInfo.svelte';
  import WorkOrderOpeningsInfo from './create-order/WorkOrderOpeningsInfo.svelte';
  import WorkOrderExteriorInfo from './create-order/WorkOrderExteriorInfo.svelte';
  import WorkOrderInteriorInfo from './create-order/WorkOrderInteriorInfo.svelte';
  import WorkOrderSeatsInfo from './create-order/WorkOrderSeatsInfo.svelte';
  import WorkOrderOthersInfo from './create-order/WorkOrderOthersInfo.svelte';
  import WorkOrderAdditionalRequirements from './create-order/WorkOrderAdditionalRequirements.svelte';
  import WorkOrderCosts from './create-order/WorkOrderCosts.svelte';
  import WorkOrderConfirmation from './create-order/WorkOrderConfirmation.svelte';

  const dispatch = createEventDispatcher();

  export let showModal = false;
  export let initialData: any = null; // Data to pre-fill when duplicating

  // Form data
  let formData: WorkOrderFormData = { ...initialFormData };
  
  // Dropdown options
  let dropdownOptions: WorkOrderDropdownOptions = {
    typeOptions: [],
    modelOptions: [],
    chassisOptions: [],
    bodyWidthOptions: [],
    heightOptions: [],
    wheelbaseOptions: [],
    voltageOptions: [],
    passengerDoorNosOptions: [],
    emergencyDoorNosOptions: [],
    airVentilationNosOptions: [],
    doorPositionFrontOptions: [],
    doorPositionRearOptions: [],
    escapeHatchOptions: [],
    sideVentilationOptions: [],
    frontOptions: [],
    frontGlassOptions: [],
    rearOptions: [],
    rearGlassOptions: [],
    paintOptions: [],
    platformOptions: [],
    sidePanelOptions: [],
    topPanelOptions: [],
    grabRailsOptions: [],
    luggageRackOptions: [],
    seatTypeOptions: [],
    seatFabricsOptions: [],
    noOfSeatsOptions: [],
    seatConfigurationOptions: [],
    wiperOptions: [],
    routeBoardOptions: [],
    soundSystemOptions: [],
    driverCabinPartitionOptions: [],
    recordBoxNosOptions: [],
    fireExtinguisherOptions: [],
    stepneyOptions: [],
    dickeyOptions: [],
    additionalRequirementsOptions: [],
    gstTaxRateOptions: [],
    cessTaxRateOptions: []
  };

  // Validation state
  let validationErrors: Record<string, string> = {};
  let isCheckingUniqueness = false;
  let isSubmitting = false;

  let currentSection = 1;
  const totalSections = 10;

  // Load dropdown data on mount
  onMount(async () => {
    try {
      dropdownOptions = await loadAllDropdownData();
      // Auto-populate tax rates
      if (dropdownOptions.gstTaxRateOptions.length > 0 && !formData.gst_tax_rate) {
        formData.gst_tax_rate = dropdownOptions.gstTaxRateOptions[0].de_value;
      }
      if (dropdownOptions.cessTaxRateOptions.length > 0 && !formData.cess_tax_rate) {
        formData.cess_tax_rate = dropdownOptions.cessTaxRateOptions[0].de_value;
      }
      
      // If we have initial data (duplicating), populate model-related fields after dropdowns are loaded
      if (initialData && formData.wo_model) {
        populateModelFields(formData.wo_model);
      }
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  });

  // Reset form when modal is opened, or populate from initialData if duplicating
  $: if (showModal) {
    if (initialData) {
      populateFormFromWorkOrder(initialData);
    } else {
      resetForm();
    }
  }
  
  // Watch for model options to be loaded and populate model fields if duplicating
  // This ensures Type, Comfort Level, Capacity, and Carrier Type are populated from model options
  $: if (showModal && initialData && dropdownOptions.modelOptions.length > 0 && formData.wo_model) {
    // Only populate if fields are empty (to avoid overwriting if user has already changed them)
    if (!formData.wo_comfort_level || !formData.wo_capacity || !formData.wo_carrier_type) {
      populateModelFields(formData.wo_model);
    }
  }

  function closeModal() {
    showModal = false;
    resetForm();
    dispatch('close');
  }

  function previousSection() {
    if (currentSection > 1) {
      currentSection--;
    }
  }

  function handleFieldChange(field: string, value: any) {
    (formData as any)[field] = value;
    formData = { ...formData }; // Trigger reactivity
  }

  function clearValidationError(fieldName: string) {
    delete validationErrors[fieldName];
    validationErrors = { ...validationErrors };
  }

  function addAdditionalRequirement() {
    formData.additional_requirements = [
      ...formData.additional_requirements,
      { work_details: '', work_qty: 1, work_rate: 0, amount: 0 }
    ];
  }

  function removeAdditionalRequirement(index: number) {
    formData.additional_requirements = formData.additional_requirements.filter((_, i) => i !== index);
  }

  function calculateTotalCost() {
    const { gst, cess, total } = calcTotalCost(
      formData.work_order_cost,
      dropdownOptions.gstTaxRateOptions,
      dropdownOptions.cessTaxRateOptions
    );
    formData.gst = gst;
    formData.cess = cess;
    formData.total_cost = total;
    formData = { ...formData };
  }

  async function nextSection() {
    const validation = validateSection(currentSection, formData);
    if (!validation.isValid) {
      validationErrors = validation.errors;
      return;
    }

    // Check uniqueness before proceeding from section 1
    if (currentSection === 1) {
      isCheckingUniqueness = true;
      const uniquenessCheck = await checkUniqueness(formData.wo_no, formData.pwo_no);
      isCheckingUniqueness = false;
      
      if (!uniquenessCheck.isValid) {
        validationErrors.wo_pwo = uniquenessCheck.error;
        return;
      }
    }

    if (currentSection < totalSections) {
      currentSection++;
      validationErrors = {};
    }
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    try {
      // Validate confirmation checkbox
      if (!formData.confirmation) {
        validationErrors.confirmation = 'Please confirm that all information is correct before creating the work order.';
        return;
      }

      validationErrors = {};

      // Check uniqueness before submitting
      isCheckingUniqueness = true;
      const uniquenessCheck = await checkUniqueness(formData.wo_no, formData.pwo_no);
      isCheckingUniqueness = false;
      
      if (!uniquenessCheck.isValid) {
        validationErrors.wo_pwo = uniquenessCheck.error;
        currentSection = 1;
        return;
      }

      isSubmitting = true;

      // Insert into prdn_wo_details table
      const { error: woError } = await supabase
        .from('prdn_wo_details')
        .insert({
          wo_no: formData.wo_no || null,
          pwo_no: formData.pwo_no || null,
          wo_type: formData.wo_type,
          wo_model: formData.wo_model,
          customer_name: formData.customer_name,
          wo_chassis: formData.wo_chassis,
          wheel_base: formData.wheel_base,
          model_rate: formData.model_rate,
          body_width_mm: formData.body_width_mm,
          height: formData.height,
          air_ventilation_nos: formData.air_ventilation_nos,
          escape_hatch: formData.escape_hatch,
          front: formData.front,
          rear: formData.rear,
          front_glass: formData.front_glass,
          emergency_door_nos: formData.emergency_door_nos,
          platform: formData.platform,
          inside_grab_rails: formData.inside_grab_rails,
          seat_type: formData.seat_type,
          no_of_seats: formData.no_of_seats,
          seat_configuration: formData.seat_configuration,
          dickey: formData.dickey,
          passenger_door_nos: formData.passenger_door_nos,
          side_ventilation: formData.side_ventilation,
          door_position_front: formData.door_position_front,
          door_position_rear: formData.door_position_rear,
          inside_top_panel: formData.inside_top_panel,
          inside_side_panel: formData.inside_side_panel,
          inside_luggage_rack: formData.inside_luggage_rack,
          sound_system: formData.sound_system,
          paint: formData.paint,
          fire_extinguisher_kg: formData.fire_extinguisher_kg,
          wiper: formData.wiper,
          stepney: formData.stepney,
          record_box_nos: formData.record_box_nos,
          route_board: formData.route_board,
          seat_fabrics: formData.seat_fabrics,
          rear_glass: formData.rear_glass,
          driver_cabin_partition: formData.driver_cabin_partition,
          voltage: formData.voltage,
          work_order_cost: formData.work_order_cost,
          gst: formData.gst,
          cess: formData.cess,
          total_cost: formData.total_cost,
          wo_date: formData.wo_date
        });

      if (woError) {
        throw new Error(`Failed to create work order: ${woError.message}`);
      }

      // Get the inserted work order ID
      const { data: woData, error: woQueryError } = await supabase
        .from('prdn_wo_details')
        .select('id')
        .eq('wo_type', formData.wo_type)
        .eq('wo_model', formData.wo_model)
        .eq('wo_date', formData.wo_date)
        .eq('work_order_cost', formData.work_order_cost)
        .eq('total_cost', formData.total_cost)
        .order('id', { ascending: false })
        .limit(1)
        .single();

      if (woQueryError) {
        throw new Error(`Failed to retrieve work order ID: ${woQueryError.message}`);
      }

      const woId = woData.id;

      // Insert additional requirements
      if (formData.additional_requirements && formData.additional_requirements.length > 0) {
        const additionalReqs = formData.additional_requirements
          .filter(row => row.work_details && row.work_details.trim() !== '')
          .map((row, index) => ({
            pos_num: index + 1,
            work_details: row.work_details,
            work_qty: row.work_qty,
            work_rate: row.work_rate,
            wo_id: woId
          }));

        if (additionalReqs.length > 0) {
          const { error: addReqError } = await supabase
            .from('prdn_wo_add_req')
            .insert(additionalReqs);

          if (addReqError) {
            console.warn('Additional requirements could not be saved, but work order was created');
          }
        }
      }

      const woNoText = formData.wo_no ? `WO Number: ${formData.wo_no}` : '';
      const pwoNoText = formData.pwo_no ? `PWO Number: ${formData.pwo_no}` : '';
      const woPwoText = [woNoText, pwoNoText].filter(Boolean).join('\n');
      
      alert(`Work Order created successfully!\n\nWork Order ID: ${woId}${woPwoText ? '\n' + woPwoText : ''}\nTotal Cost: ₹${formData.total_cost.toFixed(2)}`);
      
      closeModal();
      resetForm();
      
      dispatch('workOrderCreated', { 
        woId, 
        woNo: formData.wo_no || formData.pwo_no,
        totalCost: formData.total_cost 
      });

    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      alert(`Error creating work order: ${error.message || 'Unknown error occurred'}`);
    } finally {
      isSubmitting = false;
    }
  }

  function resetForm() {
    formData = { ...initialFormData };
    validationErrors = {};
    currentSection = 1;
  }

  /**
   * Populate form data from work order details (for duplication)
   * Clears WO/PWO numbers and production dates as per requirements
   */
  function populateFormFromWorkOrder(workOrderData: any) {
    formData = {
      // Clear WO/PWO numbers - user must enter new values
      wo_no: '',
      pwo_no: '',
      
      // Copy basic info
      wo_type: workOrderData.wo_type || '',
      wo_model: workOrderData.wo_model || '',
      // Clear wo_date - user must enter new date for the duplicate work order
      wo_date: '',
      customer_name: workOrderData.customer_name || '',
      
      // Model-related fields - will be populated from model options via populateModelFields()
      // These are set to empty initially and will be populated when dropdowns load
      wo_comfort_level: '',
      wo_capacity: '',
      wo_carrier_type: '',
      
      // Chassis info
      wo_chassis: workOrderData.wo_chassis || '',
      wheel_base: workOrderData.wheel_base || '',
      model_rate: workOrderData.model_rate || 0,
      
      // Openings
      body_width_mm: workOrderData.body_width_mm || '',
      height: workOrderData.height || '',
      air_ventilation_nos: workOrderData.air_ventilation_nos || '',
      escape_hatch: workOrderData.escape_hatch || '',
      front: workOrderData.front || '',
      rear: workOrderData.rear || '',
      front_glass: workOrderData.front_glass || '',
      emergency_door_nos: workOrderData.emergency_door_nos || '',
      
      // Exterior
      platform: workOrderData.platform || '',
      inside_grab_rails: workOrderData.inside_grab_rails || '',
      paint: workOrderData.paint || '',
      fire_extinguisher_kg: workOrderData.fire_extinguisher_kg || '',
      wiper: workOrderData.wiper || '',
      stepney: workOrderData.stepney || '',
      record_box_nos: workOrderData.record_box_nos || '',
      route_board: workOrderData.route_board || '',
      rear_glass: workOrderData.rear_glass || '',
      driver_cabin_partition: workOrderData.driver_cabin_partition || '',
      voltage: workOrderData.voltage || '',
      
      // Interior
      inside_top_panel: workOrderData.inside_top_panel || '',
      inside_side_panel: workOrderData.inside_side_panel || '',
      inside_luggage_rack: workOrderData.inside_luggage_rack || '',
      sound_system: workOrderData.sound_system || '',
      
      // Seats
      seat_type: workOrderData.seat_type || '',
      no_of_seats: workOrderData.no_of_seats || '',
      seat_configuration: workOrderData.seat_configuration || '',
      seat_fabrics: workOrderData.seat_fabrics || '',
      
      // Others
      dickey: workOrderData.dickey || '',
      passenger_door_nos: workOrderData.passenger_door_nos || '',
      side_ventilation: workOrderData.side_ventilation || '',
      door_position_front: workOrderData.door_position_front || '',
      door_position_rear: workOrderData.door_position_rear || '',
      
      // Clear production dates - this is a new work order
      wo_prdn_start: '',
      wo_prdn_end: '',
      wo_delivery: '',
      
      // Copy additional requirements (including quantity and rate)
      additional_requirements: workOrderData.additional_requirements && workOrderData.additional_requirements.length > 0
        ? workOrderData.additional_requirements.map((req: any) => ({
            work_details: req.work_details || '',
            work_qty: req.work_qty || 1,
            work_rate: req.work_rate || 0,
            amount: (req.work_qty || 1) * (req.work_rate || 0)
          }))
        : [{ work_details: '', work_qty: 1, work_rate: 0, amount: 0 }],
      
      // Copy costs
      work_order_cost: workOrderData.work_order_cost || 0,
      gst: workOrderData.gst || 0,
      cess: workOrderData.cess || 0,
      total_cost: workOrderData.total_cost || 0,
      
      // Tax rates (will be auto-populated from dropdown if available)
      gst_tax_rate: '',
      cess_tax_rate: '',
      
      // Confirmation
      confirmation: false
    };
    
    // Note: We preserve the original costs as-is. User can recalculate if needed.
    // calculateTotalCost() is not called here to preserve the exact costs from the original work order.
    
    validationErrors = {};
    currentSection = 1;
  }

  function handleModelChange(modelName: string) {
    populateModelFields(modelName);
  }
  
  function populateModelFields(modelName: string) {
    const updates = updateFieldsFromModel(modelName, dropdownOptions.modelOptions);
    Object.entries(updates).forEach(([key, value]) => {
      handleFieldChange(key, value);
    });
  }
</script>

<!-- Modal Overlay -->
{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="theme-bg-primary rounded-lg shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b theme-border theme-bg-primary">
        <h2 class="text-2xl font-bold theme-text-primary">
          {initialData ? 'Duplicate Work Order' : 'Create Work Order'}
          {#if formData.wo_no || formData.pwo_no}
            : 
            {#if formData.wo_no}WO {formData.wo_no}{/if}
            {#if formData.wo_no && formData.pwo_no} - {/if}
            {#if formData.pwo_no}PWO {formData.pwo_no}{/if}
          {/if}
        </h2>
        <button
          on:click={closeModal}
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
        >
          <X class="w-6 h-6 theme-text-secondary" />
        </button>
      </div>

      <!-- Progress Bar -->
      <div class="px-6 py-4 border-b theme-border theme-bg-primary">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium theme-text-secondary">Progress: Section {currentSection} of {totalSections}</span>
          <span class="text-sm font-medium theme-text-primary">{Math.round((currentSection / totalSections) * 100)}%</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style="width: {(currentSection / totalSections) * 100}%"
          ></div>
        </div>
      </div>

      <!-- Section Navigation -->
      <div class="px-6 py-4 border-b theme-border theme-bg-primary">
        <div class="flex justify-between items-center">
          {#each Array(totalSections) as _, i}
            {@const sectionNum = i + 1}
            {@const isCompleted = sectionNum < currentSection}
            {@const isCurrent = sectionNum === currentSection}
            {@const hasErrors = sectionNum < currentSection && hasSectionErrors(sectionNum, validationErrors)}
            
            <button
              disabled
              class="relative flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-all duration-300 cursor-not-allowed opacity-75"
              style="
                background-color: {hasErrors ? '#dc2626' : isCompleted ? '#059669' : isCurrent ? '#fbbf24' : '#ef4444'} !important;
                color: {hasErrors ? 'white' : isCompleted ? 'white' : isCurrent ? 'black' : 'white'} !important;
                border: 2px solid {hasErrors ? '#dc2626' : isCompleted ? '#047857' : isCurrent ? '#f59e0b' : '#dc2626'} !important;
                box-shadow: {hasErrors || isCompleted || isCurrent ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'} !important;
                animation: {isCurrent ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'} !important;
              "
              aria-label="Section {sectionNum} (locked)"
            >
              {sectionNum}
              {#if hasErrors}
                <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">!</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Form Content -->
      <div class="flex-1 overflow-y-auto p-6 max-h-[60vh] theme-bg-primary">
        {#if currentSection === 1}
          <WorkOrderBasicInfo
            {formData}
            {validationErrors}
            modelOptions={dropdownOptions.modelOptions}
            {isCheckingUniqueness}
            onFieldChange={handleFieldChange}
            {clearValidationError}
            onModelChange={handleModelChange}
          />
        {:else if currentSection === 2}
          <WorkOrderChassisInfo
            {formData}
            {validationErrors}
            chassisOptions={dropdownOptions.chassisOptions}
            bodyWidthOptions={dropdownOptions.bodyWidthOptions}
            heightOptions={dropdownOptions.heightOptions}
            wheelbaseOptions={dropdownOptions.wheelbaseOptions}
            voltageOptions={dropdownOptions.voltageOptions}
            onFieldChange={handleFieldChange}
            {clearValidationError}
            hasSectionErrors={(s) => hasSectionErrors(s, validationErrors)}
          />
        {:else if currentSection === 3}
          <WorkOrderOpeningsInfo
            {formData}
            {validationErrors}
            passengerDoorNosOptions={dropdownOptions.passengerDoorNosOptions}
            emergencyDoorNosOptions={dropdownOptions.emergencyDoorNosOptions}
            airVentilationNosOptions={dropdownOptions.airVentilationNosOptions}
            doorPositionFrontOptions={dropdownOptions.doorPositionFrontOptions}
            doorPositionRearOptions={dropdownOptions.doorPositionRearOptions}
            escapeHatchOptions={dropdownOptions.escapeHatchOptions}
            sideVentilationOptions={dropdownOptions.sideVentilationOptions}
            onFieldChange={handleFieldChange}
          />
        {:else if currentSection === 4}
          <WorkOrderExteriorInfo
            {formData}
            {validationErrors}
            frontOptions={dropdownOptions.frontOptions}
            frontGlassOptions={dropdownOptions.frontGlassOptions}
            rearOptions={dropdownOptions.rearOptions}
            rearGlassOptions={dropdownOptions.rearGlassOptions}
            paintOptions={dropdownOptions.paintOptions}
            onFieldChange={handleFieldChange}
          />
        {:else if currentSection === 5}
          <WorkOrderInteriorInfo
            {formData}
            {validationErrors}
            platformOptions={dropdownOptions.platformOptions}
            sidePanelOptions={dropdownOptions.sidePanelOptions}
            topPanelOptions={dropdownOptions.topPanelOptions}
            grabRailsOptions={dropdownOptions.grabRailsOptions}
            luggageRackOptions={dropdownOptions.luggageRackOptions}
            onFieldChange={handleFieldChange}
          />
        {:else if currentSection === 6}
          <WorkOrderSeatsInfo
            {formData}
            {validationErrors}
            seatTypeOptions={dropdownOptions.seatTypeOptions}
            seatFabricsOptions={dropdownOptions.seatFabricsOptions}
            noOfSeatsOptions={dropdownOptions.noOfSeatsOptions}
            seatConfigurationOptions={dropdownOptions.seatConfigurationOptions}
            onFieldChange={handleFieldChange}
          />
        {:else if currentSection === 7}
          <WorkOrderOthersInfo
            {formData}
            {validationErrors}
            wiperOptions={dropdownOptions.wiperOptions}
            routeBoardOptions={dropdownOptions.routeBoardOptions}
            soundSystemOptions={dropdownOptions.soundSystemOptions}
            driverCabinPartitionOptions={dropdownOptions.driverCabinPartitionOptions}
            recordBoxNosOptions={dropdownOptions.recordBoxNosOptions}
            fireExtinguisherOptions={dropdownOptions.fireExtinguisherOptions}
            stepneyOptions={dropdownOptions.stepneyOptions}
            dickeyOptions={dropdownOptions.dickeyOptions}
            onFieldChange={handleFieldChange}
          />
        {:else if currentSection === 8}
          <WorkOrderAdditionalRequirements
            {formData}
            {validationErrors}
            additionalRequirementsOptions={dropdownOptions.additionalRequirementsOptions}
            onFieldChange={handleFieldChange}
            {addAdditionalRequirement}
            {removeAdditionalRequirement}
          />
        {:else if currentSection === 9}
          <WorkOrderCosts
            {formData}
            {validationErrors}
            gstTaxRateOptions={dropdownOptions.gstTaxRateOptions}
            cessTaxRateOptions={dropdownOptions.cessTaxRateOptions}
            onFieldChange={handleFieldChange}
          />
        {:else if currentSection === 10}
          <WorkOrderConfirmation
            {formData}
            {validationErrors}
            gstTaxRateOptions={dropdownOptions.gstTaxRateOptions}
            cessTaxRateOptions={dropdownOptions.cessTaxRateOptions}
            onFieldChange={handleFieldChange}
          />
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-6 border-t theme-border theme-bg-primary">
        <div class="flex gap-2">
          <Button variant="secondary" on:click={resetForm}>
            Reset Form
          </Button>
        </div>
        <div class="flex gap-2">
          {#if currentSection > 1}
            <Button variant="secondary" on:click={previousSection}>
              Previous
            </Button>
          {/if}
          {#if currentSection < totalSections}
            <Button variant="primary" on:click={nextSection}>
              Next
            </Button>
          {:else}
            <Button
              variant="primary"
              on:click={handleSubmit}
              disabled={isSubmitting || isCheckingUniqueness}
            >
              {isSubmitting ? 'Creating...' : 'Create Work Order'}
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

