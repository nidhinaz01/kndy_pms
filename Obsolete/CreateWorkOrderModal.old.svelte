<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { X } from 'lucide-svelte';
  import { supabase } from '$lib/supabaseClient';

  const dispatch = createEventDispatcher();

  export let showModal = false;

  // Debug: Log when showModal changes
  $: console.log('CreateWorkOrderModal showModal changed to:', showModal);

  // Form data structure based on the database table
  let formData = {
    // Work Order Details
    wo_no: '',
    pwo_no: '',
    wo_type: '',
    wo_model: '',
    wo_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    wo_comfort_level: '',
    wo_capacity: '',
    wo_carrier_type: '',
    
    // Chassis Related
    wo_chassis: '',
    wheel_base: '',
    model_rate: 0,
    
    // Openings
    body_width_mm: '',
    height: '',
    air_ventilation_nos: '',
    escape_hatch: '',
    front: '',
    rear: '',
    front_glass: '',
    emergency_door_nos: '',
    
    // Exterior
    platform: '',
    inside_grab_rails: '',
    paint: '',
    fire_extinguisher_kg: '',
    wiper: '',
    stepney: '',
    record_box_nos: '',
    route_board: '',
    rear_glass: '',
    driver_cabin_partition: '',
    voltage: '',
    
    // Interior
    inside_top_panel: '',
    inside_side_panel: '',
    inside_luggage_rack: '',
    sound_system: '',
    
    // Seats
    seat_type: '',
    no_of_seats: '',
    seat_configuration: '',
    seat_fabrics: '',
    
    // Others
    dickey: '',
    passenger_door_nos: '',
    side_ventilation: '',
    door_position_front: '',
    door_position_rear: '',
    
    // Additional Requirements
    wo_prdn_start: '',
    wo_prdn_end: '',
    wo_delivery: '',
    
         // Additional Requirements (dynamic rows)
     additional_requirements: [{ work_details: '', work_qty: 1, work_rate: 0, amount: 0 }],
    
    // Costs
    work_order_cost: 0,
    gst: 0,
    cess: 0,
    total_cost: 0,
    
    // Tax Rates (for calculations)
    gst_tax_rate: '',
    cess_tax_rate: '',

    // Confirmation
    confirmation: false
  };

  // Dropdown data
  let typeOptions: Array<{de_value: string, de_name: string}> = [];
  let modelOptions: Array<{
    wo_type_name: string;
    wo_type_code: string;
    wo_comfort_level: string;
    wo_capacity: string;
    wo_carrier_type: string;
  }> = [];
  
  // Section 2: Chassis Related dropdowns
  let chassisOptions: Array<{de_value: string, de_name: string}> = [];
  let bodyWidthOptions: Array<{de_value: string, de_name: string}> = [];
  let heightOptions: Array<{de_value: string, de_name: string}> = [];
  let wheelbaseOptions: Array<{de_value: string, de_name: string}> = [];
  let voltageOptions: Array<{de_value: string, de_name: string}> = [];
  
  // Section 3: Openings dropdowns
  let passengerDoorNosOptions: Array<{de_value: string, de_name: string}> = [];
  let emergencyDoorNosOptions: Array<{de_value: string, de_name: string}> = [];
  let airVentilationNosOptions: Array<{de_value: string, de_name: string}> = [];
  let doorPositionFrontOptions: Array<{de_value: string, de_name: string}> = [];
  let doorPositionRearOptions: Array<{de_value: string, de_name: string}> = [];
  let escapeHatchOptions: Array<{de_value: string, de_name: string}> = [];
  let sideVentilationOptions: Array<{de_value: string, de_name: string}> = [];
  
  // Section 4: Exterior dropdowns
  let frontOptions: Array<{de_value: string, de_name: string}> = [];
  let frontGlassOptions: Array<{de_value: string, de_name: string}> = [];
  let rearOptions: Array<{de_value: string, de_name: string}> = [];
  let rearGlassOptions: Array<{de_value: string, de_name: string}> = [];
  let paintOptions: Array<{de_value: string, de_name: string}> = [];
  
  // Section 5: Interior dropdowns
  let platformOptions: Array<{de_value: string, de_name: string}> = [];
  let sidePanelOptions: Array<{de_value: string, de_name: string}> = [];
  let topPanelOptions: Array<{de_value: string, de_name: string}> = [];
  let grabRailsOptions: Array<{de_value: string, de_name: string}> = [];
  let luggageRackOptions: Array<{de_value: string, de_name: string}> = [];
  
  // Section 6: Seats dropdowns
  let seatTypeOptions: Array<{de_value: string, de_name: string}> = [];
  let seatFabricsOptions: Array<{de_value: string, de_name: string}> = [];
  let noOfSeatsOptions: Array<{de_value: string, de_name: string}> = [];
  let seatConfigurationOptions: Array<{de_value: string, de_name: string}> = [];
  
  // Section 7: Others dropdowns
  let wiperOptions: Array<{de_value: string, de_name: string}> = [];
  let routeBoardOptions: Array<{de_value: string, de_name: string}> = [];
  let soundSystemOptions: Array<{de_value: string, de_name: string}> = [];
  let driverCabinPartitionOptions: Array<{de_value: string, de_name: string}> = [];
  let recordBoxNosOptions: Array<{de_value: string, de_name: string}> = [];
  let fireExtinguisherOptions: Array<{de_value: string, de_name: string}> = [];
  let stepneyOptions: Array<{de_value: string, de_name: string}> = [];
  let dickeyOptions: Array<{de_value: string, de_name: string}> = [];
  
  // Section 8: Additional Requirements dropdowns
  let additionalRequirementsOptions: Array<{de_value: string, de_name: string}> = [];
  
  // Section 9: Costs dropdowns
  let gstTaxRateOptions: Array<{de_value: string, de_name: string}> = [];
  let cessTaxRateOptions: Array<{de_value: string, de_name: string}> = [];

  // Validation state
  let validationErrors: Record<string, string> = {};
  let isCheckingUniqueness = false;
  let isSubmitting = false;

  let currentSection = 1;
  const totalSections = 10;

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



     function calculateTotalCost() {
     // Calculate GST based on tax rate from database
     if (gstTaxRateOptions.length > 0 && formData.work_order_cost > 0) {
       const gstRate = parseFloat(gstTaxRateOptions[0].de_value);
       formData.gst = (formData.work_order_cost * gstRate) / 100;
     } else {
       formData.gst = 0;
     }
     
     // Calculate Cess based on tax rate from database
     if (cessTaxRateOptions.length > 0 && formData.work_order_cost > 0) {
       const cessRate = parseFloat(cessTaxRateOptions[0].de_value);
       formData.cess = (formData.work_order_cost * cessRate) / 100;
     } else {
       formData.cess = 0;
     }
     
     // Calculate total cost
     formData.total_cost = formData.work_order_cost + formData.gst + formData.cess;
   }

     // Add new additional requirement row
   function addAdditionalRequirement() {
     formData.additional_requirements = [...formData.additional_requirements, { work_details: '', work_qty: 1, work_rate: 0, amount: 0 }];
   }

     // Remove additional requirement row
   function removeAdditionalRequirement(index: number) {
     formData.additional_requirements = formData.additional_requirements.filter((_, i) => i !== index);
   }
   
       // Calculate amount for additional requirement
    function calculateAmount(index: number) {
      const row = formData.additional_requirements[index];
      if (row) {
        // Convert to numbers to ensure proper multiplication
        const qty = Number(row.work_qty) || 0;
        const rate = Number(row.work_rate) || 0;
        // Use Svelte's reactivity by reassigning the array
        formData.additional_requirements[index] = {
          ...row,
          amount: qty * rate
        };
        // Trigger reactivity
        formData.additional_requirements = [...formData.additional_requirements];
      }
    }

  // Load dropdown data
  async function loadDropdownData() {
    try {
      // Load Type options
      const { data: typeData, error: typeError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'type code')
        .eq('is_active', true);

      if (typeError) throw typeError;
      typeOptions = (typeData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));



      // Load Section 2: Chassis Related options
      // Chassis options
      const { data: chassisData, error: chassisError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_chassis')
        .eq('is_active', true);

      if (chassisError) throw chassisError;
      chassisOptions = (chassisData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Body Width options
      const { data: bodyWidthData, error: bodyWidthError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_body_width')
        .eq('is_active', true);

      if (bodyWidthError) throw bodyWidthError;
      bodyWidthOptions = (bodyWidthData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Height options
      const { data: heightData, error: heightError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_height')
        .eq('is_active', true);

      if (heightError) throw heightError;
      heightOptions = (heightData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Wheelbase options
      const { data: wheelbaseData, error: wheelbaseError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_wheelbase')
        .eq('is_active', true);

      if (wheelbaseError) throw wheelbaseError;
      wheelbaseOptions = (wheelbaseData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Voltage options
      const { data: voltageData, error: voltageError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_voltage')
        .eq('is_active', true);

      if (voltageError) throw voltageError;
      voltageOptions = (voltageData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Passenger Door Nos options
      const { data: passengerDoorNosData, error: passengerDoorNosError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_passenger_door_nos')
        .eq('is_active', true);

      if (passengerDoorNosError) throw passengerDoorNosError;
      passengerDoorNosOptions = (passengerDoorNosData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Emergency Door Nos options
      const { data: emergencyDoorNosData, error: emergencyDoorNosError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_emergency_door_nos')
        .eq('is_active', true);

      if (emergencyDoorNosError) throw emergencyDoorNosError;
      emergencyDoorNosOptions = (emergencyDoorNosData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Air Ventilation Nos options
      const { data: airVentilationNosData, error: airVentilationNosError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_air_ventilation_nos')
        .eq('is_active', true);

      if (airVentilationNosError) throw airVentilationNosError;
      airVentilationNosOptions = (airVentilationNosData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Door Position Front options
      const { data: doorPositionFrontData, error: doorPositionFrontError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_door_position_front')
        .eq('is_active', true);

      if (doorPositionFrontError) throw doorPositionFrontError;
      doorPositionFrontOptions = (doorPositionFrontData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Door Position Rear options
      const { data: doorPositionRearData, error: doorPositionRearError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_door_position_rear')
        .eq('is_active', true);

      if (doorPositionRearError) throw doorPositionRearError;
      doorPositionRearOptions = (doorPositionRearData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Escape Hatch options
      const { data: escapeHatchData, error: escapeHatchError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_escape_hatch')
        .eq('is_active', true);

      if (escapeHatchError) throw escapeHatchError;
      escapeHatchOptions = (escapeHatchData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Side Ventilation options
      const { data: sideVentilationData, error: sideVentilationError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_side_ventilation')
        .eq('is_active', true);

      if (sideVentilationError) throw sideVentilationError;
      sideVentilationOptions = (sideVentilationData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Front options
      const { data: frontData, error: frontError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_front')
        .eq('is_active', true);

      if (frontError) throw frontError;
      frontOptions = (frontData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Front Glass options
      const { data: frontGlassData, error: frontGlassError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_front_glass')
        .eq('is_active', true);

      if (frontGlassError) throw frontGlassError;
      frontGlassOptions = (frontGlassData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Rear options
      const { data: rearData, error: rearError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_rear')
        .eq('is_active', true);

      if (rearError) throw rearError;
      rearOptions = (rearData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Rear Glass options
      const { data: rearGlassData, error: rearGlassError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_rear_glass')
        .eq('is_active', true);

      if (rearGlassError) throw rearGlassError;
      rearGlassOptions = (rearGlassData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Paint options
      const { data: paintData, error: paintError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_paint')
        .eq('is_active', true);

      if (paintError) throw paintError;
      paintOptions = (paintData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Platform options
      const { data: platformData, error: platformError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_platform')
        .eq('is_active', true);

      if (platformError) throw platformError;
      platformOptions = (platformData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Side Panel options
      const { data: sidePanelData, error: sidePanelError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_inside_side_panel')
        .eq('is_active', true);

      if (sidePanelError) throw sidePanelError;
      sidePanelOptions = (sidePanelData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Top Panel options
      const { data: topPanelData, error: topPanelError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_inside_top_panel')
        .eq('is_active', true);

      if (topPanelError) throw topPanelError;
      topPanelOptions = (topPanelData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Grab Rails options
      const { data: grabRailsData, error: grabRailsError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_inside_grab_rails')
        .eq('is_active', true);

      if (grabRailsError) throw grabRailsError;
      grabRailsOptions = (grabRailsData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Luggage Rack options
      const { data: luggageRackData, error: luggageRackError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_inside_luggage_rack')
        .eq('is_active', true);

      if (luggageRackError) throw luggageRackError;
      luggageRackOptions = (luggageRackData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Seat Type options
      const { data: seatTypeData, error: seatTypeError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_seat_type')
        .eq('is_active', true);

      if (seatTypeError) throw seatTypeError;
      seatTypeOptions = (seatTypeData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Seat Fabrics options
      const { data: seatFabricsData, error: seatFabricsError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_seat_fabrics')
        .eq('is_active', true);

      if (seatFabricsError) throw seatFabricsError;
      seatFabricsOptions = (seatFabricsData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // No of Seats options
      const { data: noOfSeatsData, error: noOfSeatsError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_no_of_seats')
        .eq('is_active', true);

      if (noOfSeatsError) throw noOfSeatsError;
      noOfSeatsOptions = (noOfSeatsData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Seat Configuration options
      const { data: seatConfigurationData, error: seatConfigurationError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_seat_configuration')
        .eq('is_active', true);

      if (seatConfigurationError) throw seatConfigurationError;
      seatConfigurationOptions = (seatConfigurationData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Wiper options
      const { data: wiperData, error: wiperError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_wiper')
        .eq('is_active', true);

      if (wiperError) throw wiperError;
      wiperOptions = (wiperData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Route Board options
      const { data: routeBoardData, error: routeBoardError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_route_board')
        .eq('is_active', true);

      if (routeBoardError) throw routeBoardError;
      routeBoardOptions = (routeBoardData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Sound System options
      const { data: soundSystemData, error: soundSystemError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_sound_system')
        .eq('is_active', true);

      if (soundSystemError) throw soundSystemError;
      soundSystemOptions = (soundSystemData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Driver Cabin Partition options
      const { data: driverCabinPartitionData, error: driverCabinPartitionError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_driver_cabin_partition')
        .eq('is_active', true);

      if (driverCabinPartitionError) throw driverCabinPartitionError;
      driverCabinPartitionOptions = (driverCabinPartitionData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Record Box Nos options
      const { data: recordBoxNosData, error: recordBoxNosError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_record_box_nos')
        .eq('is_active', true);

      if (recordBoxNosError) throw recordBoxNosError;
      recordBoxNosOptions = (recordBoxNosData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Fire Extinguisher options
      const { data: fireExtinguisherData, error: fireExtinguisherError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_fire_extinguisher_kg')
        .eq('is_active', true);

      if (fireExtinguisherError) throw fireExtinguisherError;
      fireExtinguisherOptions = (fireExtinguisherData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Stepney options
      const { data: stepneyData, error: stepneyError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_stepney')
        .eq('is_active', true);

      if (stepneyError) throw stepneyError;
      stepneyOptions = (stepneyData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Dickey options
      const { data: dickeyData, error: dickeyError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', 'wo_dickey')
        .eq('is_active', true);

      if (dickeyError) throw dickeyError;
      dickeyOptions = (dickeyData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

      // Additional Requirements options
      const { data: additionalRequirementsData, error: additionalRequirementsError } = await supabase
        .from('sys_data_elements')
        .select('de_value, de_name')
        .ilike('de_name', '%additional%')
        .eq('is_active', true);

      if (additionalRequirementsError) throw additionalRequirementsError;
      
      additionalRequirementsOptions = (additionalRequirementsData || []).sort((a, b) => a.de_value.localeCompare(b.de_value));

             // GST Tax Rate options (only 1 record expected)
       const { data: gstTaxRateData, error: gstTaxRateError } = await supabase
         .from('sys_data_elements')
         .select('de_value, de_name')
         .ilike('de_name', 'tax gst')
         .eq('is_active', true)
         .limit(1);

       if (gstTaxRateError) throw gstTaxRateError;
       gstTaxRateOptions = (gstTaxRateData || []);

       // Cess Tax Rate options (only 1 record expected)
       const { data: cessTaxRateData, error: cessTaxRateError } = await supabase
         .from('sys_data_elements')
         .select('de_value, de_name')
         .ilike('de_name', 'tax cess')
         .eq('is_active', true)
         .limit(1);

       if (cessTaxRateError) throw cessTaxRateError;
       cessTaxRateOptions = (cessTaxRateData || []);

    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  }

  // Load model options from mstr_wo_type table
  async function loadModelOptions() {
    try {
      console.log('🔍 Loading model options...');
      const { data: modelData, error: modelError } = await supabase
        .from('mstr_wo_type')
        .select('wo_type_name, wo_type_code, wo_comfort_level, wo_capacity, wo_carrier_type')
        .eq('is_active', true);

      if (modelError) {
        console.error('❌ Error loading model options:', modelError);
        modelOptions = [];
        return;
      }
      
      console.log('📋 Raw model data from database:', modelData);
      modelOptions = (modelData || []).sort((a, b) => a.wo_type_name.localeCompare(b.wo_type_name));
      console.log('✅ Model options loaded:', modelOptions);
      console.log('📊 Total models available:', modelOptions.length);
      
    } catch (error) {
      console.error('❌ Error loading model options:', error);
      modelOptions = [];
    }
  }

  // Update other fields when model is selected
  function updateFieldsFromModel(selectedModelName: string) {
    const selectedModel = modelOptions.find(option => option.wo_type_name === selectedModelName);
    
    if (selectedModel) {
      formData.wo_type = selectedModel.wo_type_code || '';
      formData.wo_comfort_level = selectedModel.wo_comfort_level || '';
      formData.wo_capacity = selectedModel.wo_capacity || '';
      formData.wo_carrier_type = selectedModel.wo_carrier_type || '';
      
      // Trigger Svelte reactivity
      formData = { ...formData };
      
      console.log('Fields updated from model:', {
        type: formData.wo_type,
        comfort_level: formData.wo_comfort_level,
        capacity: formData.wo_capacity,
        carrier_type: formData.wo_carrier_type
      });
    }
  }





     // Load dropdown data on mount
   onMount(() => {
     loadDropdownData();
     loadModelOptions();
   });

   // Reset form when modal is opened
   $: if (showModal) {
     resetForm();
   }

   // Auto-populate tax rates when they become available
   $: if (gstTaxRateOptions.length > 0 && !formData.gst_tax_rate) {
     formData.gst_tax_rate = gstTaxRateOptions[0].de_value;
   }
   
   $: if (cessTaxRateOptions.length > 0 && !formData.cess_tax_rate) {
     formData.cess_tax_rate = cessTaxRateOptions[0].de_value;
   }

  // Check uniqueness of WO/PWO numbers
  async function checkUniqueness() {
    if (!formData.wo_no && !formData.pwo_no) {
      return { isValid: false, error: 'Either WO Number or PWO Number is required' };
    }

    isCheckingUniqueness = true;
    try {
      // Check WO Number uniqueness if provided
      if (formData.wo_no && formData.wo_no.trim() !== '') {
        const { data: woData, error: woError } = await supabase
          .from('prdn_wo_details')
          .select('id')
          .eq('wo_no', formData.wo_no.trim());
        
        if (woError) throw woError;
        if (woData && woData.length > 0) {
          return { isValid: false, error: 'WO Number already exists' };
        }
      }

      // Check PWO Number uniqueness if provided
      if (formData.pwo_no && formData.pwo_no.trim() !== '') {
        const { data: pwoData, error: pwoError } = await supabase
          .from('prdn_wo_details')
          .select('id')
          .eq('pwo_no', formData.pwo_no.trim());
        
        if (pwoError) throw pwoError;
        if (pwoData && pwoData.length > 0) {
          return { isValid: false, error: 'PWO Number already exists' };
        }
      }

      return { isValid: true, error: '' };
    } catch (error) {
      console.error('Error checking uniqueness:', error);
      return { isValid: false, error: 'Error checking uniqueness' };
    } finally {
      isCheckingUniqueness = false;
    }
  }

  // Validate current section
  function validateCurrentSection() {
    validationErrors = {};

    if (currentSection === 1) {
      // Validate WO/PWO numbers - either one is mandatory
      if (!formData.wo_no && !formData.pwo_no) {
        validationErrors.wo_pwo = 'Either WO Number or PWO Number is required';
      }

      // Customer name is mandatory
      if (!formData.customer_name || formData.customer_name.trim() === '') {
        validationErrors.customer_name = 'Customer name is required';
      }

      // Model is mandatory
      if (!formData.wo_model) {
        validationErrors.wo_model = 'Model is required';
      }
      
      // Date is mandatory
      if (!formData.wo_date) {
        validationErrors.wo_date = 'Date is required';
      }

      // Validate date is not in future
      const selectedDate = new Date(formData.wo_date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      if (selectedDate > today) {
        validationErrors.wo_date = 'Date cannot be in the future';
      }
    }

    if (currentSection === 2) {
      // Section 2: Chassis Related - all mandatory
      if (!formData.wo_chassis) {
        validationErrors.wo_chassis = 'Chassis is required';
      }
      if (!formData.body_width_mm) {
        validationErrors.body_width_mm = 'Body Width is required';
      }
      if (!formData.height) {
        validationErrors.height = 'Height is required';
      }
      if (!formData.wheel_base) {
        validationErrors.wheel_base = 'Wheelbase is required';
      }
      if (!formData.voltage) {
        validationErrors.voltage = 'Voltage is required';
      }
    }

    if (currentSection === 3) {
      // Section 3: Openings - all mandatory
      if (!formData.passenger_door_nos) {
        validationErrors.passenger_door_nos = 'Number of Passenger Doors is required';
      }
      if (!formData.emergency_door_nos) {
        validationErrors.emergency_door_nos = 'Number of Emergency Doors is required';
      }
      if (!formData.air_ventilation_nos) {
        validationErrors.air_ventilation_nos = 'Number of Air Ventilations is required';
      }
      if (!formData.door_position_front) {
        validationErrors.door_position_front = 'Position of Front Passenger Door is required';
      }
      if (!formData.door_position_rear) {
        validationErrors.door_position_rear = 'Position of Rear Passenger Door is required';
      }
      if (!formData.escape_hatch) {
        validationErrors.escape_hatch = 'Escape Hatch is required';
      }
      if (!formData.side_ventilation) {
        validationErrors.side_ventilation = 'Side Ventilation is required';
      }
    }

    if (currentSection === 4) {
      // Section 4: Exterior - all mandatory
      if (!formData.front) {
        validationErrors.front = 'Front is required';
      }
      if (!formData.front_glass) {
        validationErrors.front_glass = 'Front Glass is required';
      }
      if (!formData.rear) {
        validationErrors.rear = 'Rear is required';
      }
      if (!formData.rear_glass) {
        validationErrors.rear_glass = 'Rear Glass is required';
      }
      if (!formData.paint) {
        validationErrors.paint = 'Paint is required';
      }
    }

    if (currentSection === 5) {
      // Section 5: Interior - all mandatory
      if (!formData.platform) {
        validationErrors.platform = 'Platform is required';
      }
      if (!formData.inside_side_panel) {
        validationErrors.inside_side_panel = 'Side Panel is required';
      }
      if (!formData.inside_top_panel) {
        validationErrors.inside_top_panel = 'Top Panel is required';
      }
      if (!formData.inside_grab_rails) {
        validationErrors.inside_grab_rails = 'Grab Rails is required';
      }
      if (!formData.inside_luggage_rack) {
        validationErrors.inside_luggage_rack = 'Luggage Rack is required';
      }
    }

    if (currentSection === 6) {
      // Section 6: Seats - all mandatory
      if (!formData.seat_type) {
        validationErrors.seat_type = 'Seat Type is required';
      }
      if (!formData.seat_fabrics) {
        validationErrors.seat_fabrics = 'Seat Fabric is required';
      }
      if (!formData.no_of_seats) {
        validationErrors.no_of_seats = 'Number of Seats is required';
      }
      if (!formData.seat_configuration) {
        validationErrors.seat_configuration = 'Seat Configuration is required';
      }
    }

    if (currentSection === 7) {
      // Section 7: Others - all mandatory
      if (!formData.wiper) {
        validationErrors.wiper = 'Wiper is required';
      }
      if (!formData.route_board) {
        validationErrors.route_board = 'Route Board is required';
      }
      if (!formData.sound_system) {
        validationErrors.sound_system = 'Sound System is required';
      }
      if (!formData.driver_cabin_partition) {
        validationErrors.driver_cabin_partition = 'Driver Cabin Partition is required';
      }
      if (!formData.record_box_nos) {
        validationErrors.record_box_nos = 'Number of Record Box is required';
      }
      if (!formData.fire_extinguisher_kg) {
        validationErrors.fire_extinguisher_kg = 'Fire Extinguisher is required';
      }
      if (!formData.stepney) {
        validationErrors.stepney = 'Stepney is required';
      }
      if (!formData.dickey) {
        validationErrors.dickey = 'Dickey is required';
      }
    }

    if (currentSection === 8) {
      // Section 8: Additional Requirements - non mandatory, but if added, quantity and rate are mandatory
      for (let i = 0; i < formData.additional_requirements.length; i++) {
        const row = formData.additional_requirements[i];
        
        // If work details is filled, then quantity and rate become mandatory
        if (row.work_details) {
          if (!row.work_qty || row.work_qty <= 0) {
            validationErrors[`work_qty_${i}`] = 'Quantity must be greater than 0';
          }
          if (!row.work_rate || row.work_rate <= 0) {
            validationErrors[`work_rate_${i}`] = 'Rate must be greater than 0';
          }
        }
      }
    }

    if (currentSection === 9) {
      // Section 9: Costs - WO Cost is mandatory and must be positive
      if (!formData.work_order_cost || formData.work_order_cost <= 0) {
        validationErrors.work_order_cost = 'WO Cost must be a valid positive number';
      }
    }

    if (currentSection === 10) {
      // Section 10: Confirmation - tick is mandatory
      if (!formData.confirmation) {
        validationErrors.confirmation = 'You must confirm that all information is correct before creating the work order';
      }
    }

    return Object.keys(validationErrors).length === 0;
  }

  // Check if a section has validation errors
  function hasSectionErrors(section: number): boolean {
    const sectionFields = getSectionFields(section);
    return sectionFields.some(field => validationErrors[field]);
  }

  // Get fields for a specific section
  function getSectionFields(section: number): string[] {
    switch (section) {
      case 1:
        return ['wo_pwo', 'wo_model', 'wo_date'];
      case 2:
        return ['wo_chassis', 'body_width_mm', 'height', 'wheel_base', 'voltage'];
      case 3:
        return ['passenger_door_nos', 'emergency_door_nos', 'air_ventilation_nos', 'door_position_front', 'door_position_rear', 'escape_hatch', 'side_ventilation'];
      case 4:
        return ['front', 'front_glass', 'rear', 'rear_glass', 'paint'];
      case 5:
        return ['platform', 'inside_side_panel', 'inside_top_panel', 'inside_grab_rails', 'inside_luggage_rack'];
      case 6:
        return ['seat_type', 'seat_fabrics', 'no_of_seats', 'seat_configuration'];
      case 7:
        return ['wiper', 'route_board', 'sound_system', 'driver_cabin_partition', 'record_box_nos', 'fire_extinguisher_kg', 'stepney', 'dickey'];
      case 8:
        // For section 8, check if any additional requirements have errors
        return Object.keys(validationErrors).filter(key => key.startsWith('work_qty_') || key.startsWith('work_rate_'));
      case 9:
        return ['work_order_cost'];
      case 10:
        return ['confirmation'];
      default:
        return [];
    }
  }

  // Clear validation error for a specific field
  function clearValidationError(fieldName: string) {
    if (validationErrors[fieldName]) {
      delete validationErrors[fieldName];
      validationErrors = { ...validationErrors };
    }
  }

  // Enhanced next section with validation
  async function nextSection() {
    if (!validateCurrentSection()) {
      return;
    }

    // Check uniqueness before proceeding
    if (currentSection === 1) {
      const uniquenessCheck = await checkUniqueness();
      if (!uniquenessCheck.isValid) {
        validationErrors.wo_pwo = uniquenessCheck.error;
        return;
      }
    }

    if (currentSection < totalSections) {
      currentSection++;
      // Clear validation errors when moving to next section
      validationErrors = {};
    }
  }

  async function handleSubmit() {
    // Prevent duplicate submissions
    if (isSubmitting) {
      console.log('⚠️ Submission already in progress, ignoring duplicate click');
      return;
    }

    try {
      // Validate confirmation checkbox
      if (!formData.confirmation) {
        validationErrors.confirmation = 'Please confirm that all information is correct before creating the work order.';
        return;
      }

      // Clear any previous validation errors
      validationErrors = {};

      // Check uniqueness before submitting
      const uniquenessCheck = await checkUniqueness();
      if (!uniquenessCheck.isValid) {
        validationErrors.wo_pwo = uniquenessCheck.error;
        // Scroll to section 1 to show the error
        currentSection = 1;
        return;
      }

      // Set submitting flag to prevent duplicate submissions
      isSubmitting = true;

      console.log('🚀 Starting work order creation...');
      console.log('📋 Form data:', formData);

      // Step 1: Insert into prdn_wo_details table
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
        console.error('❌ Error inserting work order:', woError);
        throw new Error(`Failed to create work order: ${woError.message}`);
      }

      // Get the inserted work order ID by querying with unique identifiers
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
        console.error('❌ Error querying inserted work order:', woQueryError);
        throw new Error(`Failed to retrieve work order ID: ${woQueryError.message}`);
      }

      console.log('✅ Work order created successfully:', woData);
      const woId = woData.id;
      console.log('🆔 Retrieved Work Order ID:', woId);

      // Step 2: Insert additional requirements into prdn_wo_add_req table
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
          const { data: addReqData, error: addReqError } = await supabase
            .from('prdn_wo_add_req')
            .insert(additionalReqs)
            .select();

          if (addReqError) {
            console.error('❌ Error inserting additional requirements:', addReqError);
            // Note: We don't throw here as the main work order was created successfully
            console.warn('⚠️ Additional requirements could not be saved, but work order was created');
          } else {
            console.log('✅ Additional requirements saved successfully:', addReqData);
          }
        }
      }

      // Success! Show success message and close modal
      console.log('🎉 Work order creation completed successfully!');
      alert(`Work Order created successfully!\n\nWork Order ID: ${woId}\nTotal Cost: ₹${formData.total_cost.toFixed(2)}`);
      
      // Close the modal
      closeModal();
      
      // Reset the form
      resetForm();
      
      // Dispatch event to notify parent component
      dispatch('workOrderCreated', { 
        woId, 
        woNo: formData.wo_no || formData.pwo_no,
        totalCost: formData.total_cost 
      });

    } catch (error: any) {
      console.error('❌ Error in handleSubmit:', error);
      alert(`Error creating work order: ${error.message || 'Unknown error occurred'}`);
    } finally {
      // Always reset submitting flag
      isSubmitting = false;
    }
  }

  function resetForm() {
    formData = {
      wo_no: '',
      pwo_no: '',
      wo_type: '',
      wo_model: '',
      wo_date: new Date().toISOString().split('T')[0],
      customer_name: '',
      wo_comfort_level: '',
      wo_capacity: '',
      wo_carrier_type: '',
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
      paint: '',
      fire_extinguisher_kg: '',
      wiper: '',
      stepney: '',
      record_box_nos: '',
      route_board: '',
      rear_glass: '',
      driver_cabin_partition: '',
      voltage: '',
      inside_top_panel: '',
      inside_side_panel: '',
      inside_luggage_rack: '',
      sound_system: '',
      seat_type: '',
      no_of_seats: '',
      seat_configuration: '',
      seat_fabrics: '',
      dickey: '',
      passenger_door_nos: '',
      side_ventilation: '',
      door_position_front: '',
      door_position_rear: '',
      wo_prdn_start: '',
      wo_prdn_end: '',
      wo_delivery: '',
      work_order_cost: 0,
      gst: 0,
      cess: 0,
      total_cost: 0,
      gst_tax_rate: '',
      cess_tax_rate: '',
      confirmation: false,
             additional_requirements: [{ work_details: '', work_qty: 1, work_rate: 0, amount: 0 }]
    };
    validationErrors = {};
    currentSection = 1;
  }
</script>

<!-- Modal Overlay -->
{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">

         <div class="theme-bg-primary rounded-lg shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b theme-border theme-bg-primary">
        <h2 class="text-2xl font-bold theme-text-primary">Create Work Order</h2>
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
             {@const isFuture = sectionNum > currentSection}
             {@const hasErrors = sectionNum < currentSection && hasSectionErrors(sectionNum)}
            
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
               title="Section {sectionNum} - Navigation locked, use Next/Previous buttons"
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
        <!-- Section 1: Work Order Details -->
        {#if currentSection === 1}
          <div class="space-y-4">
            <h3 class="text-xl font-semibold theme-text-primary mb-4">1. Work Order Details</h3>
            
            <!-- WO/PWO Numbers -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="wo_no" class="block text-sm font-medium theme-text-primary mb-2">WO Number *</label>
                <input
                  type="text"
                  id="wo_no"
                  bind:value={formData.wo_no}
                  placeholder="Enter WO number"
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_pwo ? 'border-red-500' : ''}"
                />
              </div>
              <div>
                <label for="pwo_no" class="block text-sm font-medium theme-text-primary mb-2">PWO Number *</label>
                <input
                  type="text"
                  id="pwo_no"
                  bind:value={formData.pwo_no}
                  placeholder="Enter PWO number"
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_pwo ? 'border-red-500' : ''}"
                />
              </div>
            </div>
            
            <!-- WO/PWO validation error -->
            {#if validationErrors.wo_pwo}
              <div class="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                {validationErrors.wo_pwo}
              </div>
            {/if}

            <!-- Customer Name -->
            <div>
              <label for="customer_name" class="block text-sm font-medium theme-text-primary mb-2">Customer Name *</label>
              <input
                type="text"
                id="customer_name"
                bind:value={formData.customer_name}
                placeholder="Enter customer name"
                required
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.customer_name ? 'border-red-500' : ''}"
              />
              {#if validationErrors.customer_name}
                <p class="text-red-600 text-sm mt-1">{validationErrors.customer_name}</p>
              {/if}
            </div>

            <!-- Row 2: Date WO placed + Model -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="wo_date" class="block text-sm font-medium theme-text-primary mb-2">Date WO placed *</label>
                <input
                  type="date"
                  id="wo_date"
                  bind:value={formData.wo_date}
                  max={new Date().toISOString().split('T')[0]}
                  required
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_date ? 'border-red-500' : ''}"
                />
                {#if validationErrors.wo_date}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.wo_date}</p>
                {/if}
              </div>
              <div>
                <label for="wo_model" class="block text-sm font-medium theme-text-primary mb-2">Model *</label>
                <select
                  id="wo_model"
                  bind:value={formData.wo_model}
                  required
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_model ? 'border-red-500' : ''}"
                  on:change={(e) => {
                    const target = e.target as HTMLSelectElement;
                    if (target.value) {
                      updateFieldsFromModel(target.value);
                    }
                  }}
                >
                  <option value="">Select Model</option>
                  {#each modelOptions as option}
                    <option value={option.wo_type_name}>{option.wo_type_name}</option>
                  {/each}
                </select>
                {#if validationErrors.wo_model}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.wo_model}</p>
                {/if}
              </div>
            </div>

            <!-- Row 3: Type + Comfort Level -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="wo_type" class="block text-sm font-medium theme-text-primary mb-2">Type</label>
                <input
                  type="text"
                  id="wo_type"
                  value={formData.wo_type}
                  readonly
                  class="w-full px-3 py-2 border theme-border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label for="wo_comfort_level" class="block text-sm font-medium theme-text-primary mb-2">Comfort Level</label>
                <input
                  type="text"
                  id="wo_comfort_level"
                  value={formData.wo_comfort_level}
                  readonly
                  class="w-full px-3 py-2 border theme-border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>

            <!-- Row 4: Capacity + Carrier Type -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="wo_capacity" class="block text-sm font-medium theme-text-primary mb-2">Capacity</label>
                <input
                  type="text"
                  id="wo_capacity"
                  value={formData.wo_capacity}
                  readonly
                  class="w-full px-3 py-2 border theme-border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label for="wo_carrier_type" class="block text-sm font-medium theme-text-primary mb-2">Carrier Type</label>
                <input
                  type="text"
                  id="wo_carrier_type"
                  value={formData.wo_carrier_type}
                  readonly
                  class="w-full px-3 py-2 border theme-border rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>

            <!-- Loading indicator for uniqueness check -->
            {#if isCheckingUniqueness}
              <div class="flex items-center justify-center p-4">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                <span class="text-sm theme-text-secondary">Checking uniqueness...</span>
              </div>
            {/if}
          </div>
        {/if}

                 <!-- Section 2: Chassis Related -->
         {#if currentSection === 2}
           <div class="space-y-4">
             <h3 class="text-xl font-semibold theme-text-primary mb-4">2. Chassis Related</h3>
             
             <!-- Section Validation Summary -->
             {#if hasSectionErrors(2)}
               <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                 <div class="flex items-center">
                   <svg class="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                     <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                   </svg>
                   <span class="text-red-800 dark:text-red-200 font-medium">Please complete all required fields marked with * before proceeding to the next section.</span>
                 </div>
               </div>
             {/if}
            
                         <!-- Row 1: Chassis + Body Width -->
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <label for="wo_chassis" class="block text-sm font-medium theme-text-primary mb-2">Chassis *</label>
                 <select
                   id="wo_chassis"
                   bind:value={formData.wo_chassis}
                   required
                   class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wo_chassis ? 'border-red-500' : ''}"
                   on:change={() => clearValidationError('wo_chassis')}
                 >
                   <option value="">Select Chassis</option>
                   {#each chassisOptions as option}
                     <option value={option.de_value}>{option.de_value}</option>
                   {/each}
                 </select>
                 {#if validationErrors.wo_chassis}
                   <p class="text-red-600 text-sm mt-1">{validationErrors.wo_chassis}</p>
                 {/if}
               </div>
               <div>
                 <label for="body_width_mm" class="block text-sm font-medium theme-text-primary mb-2">Body Width *</label>
                 <select
                   id="body_width_mm"
                   bind:value={formData.body_width_mm}
                   required
                   class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.body_width_mm ? 'border-red-500' : ''}"
                 >
                   <option value="">Select Body Width</option>
                   {#each bodyWidthOptions as option}
                     <option value={option.de_value}>{option.de_value}</option>
                   {/each}
                 </select>
                 {#if validationErrors.body_width_mm}
                   <p class="text-red-600 text-sm mt-1">{validationErrors.body_width_mm}</p>
                 {/if}
               </div>
             </div>

                         <!-- Row 2: Height + Wheelbase -->
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <label for="height" class="block text-sm font-medium theme-text-primary mb-2">Height *</label>
                 <select
                   id="height"
                   bind:value={formData.height}
                   required
                   class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.height ? 'border-red-500' : ''}"
                 >
                   <option value="">Select Height</option>
                   {#each heightOptions as option}
                     <option value={option.de_value}>{option.de_value}</option>
                   {/each}
                 </select>
                 {#if validationErrors.height}
                   <p class="text-red-600 text-sm mt-1">{validationErrors.height}</p>
                 {/if}
               </div>
               <div>
                 <label for="wheel_base" class="block text-sm font-medium theme-text-primary mb-2">Wheelbase *</label>
                 <select
                   id="wheel_base"
                   bind:value={formData.wheel_base}
                   required
                   class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.wheel_base ? 'border-red-500' : ''}"
                 >
                   <option value="">Select Wheelbase</option>
                   {#each wheelbaseOptions as option}
                     <option value={option.de_value}>{option.de_value}</option>
                   {/each}
                 </select>
                 {#if validationErrors.wheel_base}
                   <p class="text-red-600 text-sm mt-1">{validationErrors.wheel_base}</p>
                 {/if}
               </div>
             </div>

             <!-- Row 3: Voltage -->
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <label for="voltage" class="block text-sm font-medium theme-text-primary mb-2">Voltage *</label>
                 <select
                   id="voltage"
                   bind:value={formData.voltage}
                   required
                   class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.voltage ? 'border-red-500' : ''}"
                 >
                   <option value="">Select Voltage</option>
                   {#each voltageOptions as option}
                     <option value={option.de_value}>{option.de_value}</option>
                   {/each}
                 </select>
                 {#if validationErrors.voltage}
                   <p class="text-red-600 text-sm mt-1">{validationErrors.voltage}</p>
                 {/if}
               </div>
             </div>
          </div>
        {/if}

        <!-- Section 3: Openings -->
        {#if currentSection === 3}
          <div class="space-y-4">
            <h3 class="text-xl font-semibold theme-text-primary mb-4">3. Openings</h3>
            
                         <!-- Row 1: Number of Passenger Doors + Number of Emergency Doors + Number of Air Ventilations -->
             <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                 <label for="passenger_door_nos" class="block text-sm font-medium theme-text-primary mb-2">Number of Passenger Doors *</label>
                 <select
                   id="passenger_door_nos"
                   bind:value={formData.passenger_door_nos}
                   required
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
                   bind:value={formData.emergency_door_nos}
                   required
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
                   bind:value={formData.air_ventilation_nos}
                   required
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

            <!-- Row 2: Position of Front Passenger Door + Position of Rear Passenger Door -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="door_position_front" class="block text-sm font-medium theme-text-primary mb-2">Position of Front Passenger Door *</label>
                <select
                  id="door_position_front"
                  bind:value={formData.door_position_front}
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
                  bind:value={formData.door_position_rear}
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

            <!-- Row 3: Escape Hatch + Side Ventilation -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="escape_hatch" class="block text-sm font-medium theme-text-primary mb-2">Escape Hatch *</label>
                <select
                  id="escape_hatch"
                  bind:value={formData.escape_hatch}
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
                  bind:value={formData.side_ventilation}
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
        {/if}

        <!-- Section 4: Exterior -->
        {#if currentSection === 4}
          <div class="space-y-4">
            <h3 class="text-xl font-semibold theme-text-primary mb-4">4. Exterior</h3>
            
            <!-- Row 1: Front + Front Glass -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="front" class="block text-sm font-medium theme-text-primary mb-2">Front *</label>
                <select
                  id="front"
                  bind:value={formData.front}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.front ? 'border-red-500' : ''}"
                >
                  <option value="">Select Front</option>
                  {#each frontOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.front}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.front}</p>
                {/if}
              </div>
              <div>
                <label for="front_glass" class="block text-sm font-medium theme-text-primary mb-2">Front Glass *</label>
                <select
                  id="front_glass"
                  bind:value={formData.front_glass}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.front_glass ? 'border-red-500' : ''}"
                >
                  <option value="">Select Front Glass</option>
                  {#each frontGlassOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.front_glass}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.front_glass}</p>
                {/if}
              </div>
            </div>

            <!-- Row 2: Rear + Rear Glass -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="rear" class="block text-sm font-medium theme-text-primary mb-2">Rear *</label>
                <select
                  id="rear"
                  bind:value={formData.rear}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.rear ? 'border-red-500' : ''}"
                >
                  <option value="">Select Rear</option>
                  {#each rearOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.rear}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.rear}</p>
                {/if}
              </div>
              <div>
                <label for="rear_glass" class="block text-sm font-medium theme-text-primary mb-2">Rear Glass *</label>
                <select
                  id="rear_glass"
                  bind:value={formData.rear_glass}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.rear_glass ? 'border-red-500' : ''}"
                >
                  <option value="">Select Rear Glass</option>
                  {#each rearGlassOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.rear_glass}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.rear_glass}</p>
                {/if}
              </div>
            </div>

            <!-- Row 3: Paint -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="paint" class="block text-sm font-medium theme-text-primary mb-2">Paint *</label>
                <select
                  id="paint"
                  bind:value={formData.paint}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.paint ? 'border-red-500' : ''}"
                >
                  <option value="">Select Paint</option>
                  {#each paintOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.paint}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.paint}</p>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- Section 5: Interior -->
        {#if currentSection === 5}
          <div class="space-y-4">
            <h3 class="text-xl font-semibold theme-text-primary mb-4">5. Interior</h3>
            
            <!-- Row 1: Platform -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="platform" class="block text-sm font-medium theme-text-primary mb-2">Platform *</label>
                <select
                  id="platform"
                  bind:value={formData.platform}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.platform ? 'border-red-500' : ''}"
                >
                  <option value="">Select Platform</option>
                  {#each platformOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.platform}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.platform}</p>
                {/if}
              </div>
            </div>

            <!-- Row 2: Side Panel + Top Panel -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="inside_side_panel" class="block text-sm font-medium theme-text-primary mb-2">Side Panel *</label>
                <select
                  id="inside_side_panel"
                  bind:value={formData.inside_side_panel}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.inside_side_panel ? 'border-red-500' : ''}"
                >
                  <option value="">Select Side Panel</option>
                  {#each sidePanelOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.inside_side_panel}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.inside_side_panel}</p>
                {/if}
              </div>
              <div>
                <label for="inside_top_panel" class="block text-sm font-medium theme-text-primary mb-2">Top Panel *</label>
                <select
                  id="inside_top_panel"
                  bind:value={formData.inside_top_panel}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.inside_top_panel ? 'border-red-500' : ''}"
                >
                  <option value="">Select Top Panel</option>
                  {#each topPanelOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.inside_top_panel}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.inside_top_panel}</p>
                {/if}
              </div>
            </div>

            <!-- Row 3: Grab Rails + Luggage Rack -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="inside_grab_rails" class="block text-sm font-medium theme-text-primary mb-2">Grab Rails *</label>
                <select
                  id="inside_grab_rails"
                  bind:value={formData.inside_grab_rails}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.inside_grab_rails ? 'border-red-500' : ''}"
                >
                  <option value="">Select Grab Rails</option>
                  {#each grabRailsOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.inside_grab_rails}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.inside_grab_rails}</p>
                {/if}
              </div>
              <div>
                <label for="inside_luggage_rack" class="block text-sm font-medium theme-text-primary mb-2">Luggage Rack *</label>
                <select
                  id="inside_luggage_rack"
                  bind:value={formData.inside_luggage_rack}
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.inside_luggage_rack ? 'border-red-500' : ''}"
                >
                  <option value="">Select Luggage Rack</option>
                  {#each luggageRackOptions as option}
                    <option value={option.de_value}>{option.de_value}</option>
                  {/each}
                </select>
                {#if validationErrors.inside_luggage_rack}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.inside_luggage_rack}</p>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- Section 6: Seats -->
        {#if currentSection === 6}
          <div class="space-y-4">
            <h3 class="text-xl font-semibold theme-text-primary mb-4">6. Seats</h3>
            
            <!-- Row 1: Seat Type + Seat Fabric -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="seat_type" class="block text-sm font-medium theme-text-primary mb-2">Seat Type *</label>
                <select
                  id="seat_type"
                  bind:value={formData.seat_type}
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
                  bind:value={formData.seat_fabrics}
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

            <!-- Row 2: Number of Seats + Seat Configuration -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="no_of_seats" class="block text-sm font-medium theme-text-primary mb-2">Number of Seats *</label>
                <select
                  id="no_of_seats"
                  bind:value={formData.no_of_seats}
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
                  bind:value={formData.seat_configuration}
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
        {/if}

        <!-- Section 7: Others -->
        {#if currentSection === 7}
          <div class="space-y-4">
            <h3 class="text-xl font-semibold theme-text-primary mb-4">7. Others</h3>
            
            <!-- Row 1: Wiper + Route Board -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="wiper" class="block text-sm font-medium theme-text-primary mb-2">Wiper *</label>
                <select
                  id="wiper"
                  bind:value={formData.wiper}
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
                  bind:value={formData.route_board}
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

            <!-- Row 2: Sound System + Driver Cabin Partition -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="sound_system" class="block text-sm font-medium theme-text-primary mb-2">Sound System *</label>
                <select
                  id="sound_system"
                  bind:value={formData.sound_system}
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
                  bind:value={formData.driver_cabin_partition}
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

            <!-- Row 3: Record Box Nos + Fire Extinguisher -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="record_box_nos" class="block text-sm font-medium theme-text-primary mb-2">Number of Record Box *</label>
                <select
                  id="record_box_nos"
                  bind:value={formData.record_box_nos}
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
                  bind:value={formData.fire_extinguisher_kg}
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

            <!-- Row 4: Stepney + Dickey -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="stepney" class="block text-sm font-medium theme-text-primary mb-2">Stepney *</label>
                <select
                  id="stepney"
                  bind:value={formData.stepney}
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
                  bind:value={formData.dickey}
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
        {/if}

        <!-- Section 8: Additional Requirements -->
        {#if currentSection === 8}
          <div class="space-y-4">
            <h3 class="text-xl font-semibold theme-text-primary mb-4">8. Additional Requirements</h3>
            
            <div class="theme-bg-secondary theme-border border rounded-lg p-4 mb-6">
              <div class="flex items-center">
                <svg class="w-5 h-5 theme-text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
                <span class="theme-text-secondary text-sm">Add additional work requirements with quantity and rate. Amount will be calculated automatically.</span>
              </div>
            </div>

            <!-- Dynamic Additional Requirements Rows -->
            {#each formData.additional_requirements as row, index}
              <div class="theme-border border rounded-lg p-4 theme-bg-secondary">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-medium theme-text-primary">Requirement {index + 1}</h4>
                  {#if formData.additional_requirements.length > 1}
                    <button
                      type="button"
                      on:click={() => removeAdditionalRequirement(index)}
                      class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:theme-bg-tertiary transition-colors"
                      aria-label="Remove requirement {index + 1}"
                      title="Remove this requirement"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  {/if}
                </div>
                
                                 <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div class="md:col-span-2">
                     <label for="work_details_{index}" class="block text-sm font-medium theme-text-primary mb-2">Work Details *</label>
                     <select
                       id="work_details_{index}"
                       bind:value={row.work_details}
                       required
                       class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors[`work_details_${index}`] ? 'border-red-500' : ''}"
                     >
                       <option value="">Select Work Details</option>
                       {#each additionalRequirementsOptions as option}
                         <option value={option.de_value}>{option.de_value}</option>
                       {/each}
                     </select>
                     {#if validationErrors[`work_details_${index}`]}
                       <p class="text-red-600 text-sm mt-1">{validationErrors[`work_details_${index}`]}</p>
                     {/if}
                   </div>
                   <div>
                     <label for="work_qty_{index}" class="block text-sm font-medium theme-text-primary mb-2">Quantity {row.work_details ? '*' : ''}</label>
                     <input
                       type="number"
                       id="work_qty_{index}"
                       bind:value={row.work_qty}
                       min="1"
                       step="1"
                       required={!!row.work_details}
                       class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors[`work_qty_${index}`] ? 'border-red-500' : ''}"
                       on:input={() => calculateAmount(index)}
                     />
                     {#if validationErrors[`work_qty_${index}`]}
                       <p class="text-red-600 text-sm mt-1">{validationErrors[`work_qty_${index}`]}</p>
                     {/if}
                   </div>
                   <div>
                     <label for="work_rate_{index}" class="block text-sm font-medium theme-text-primary mb-2">Rate (₹) {row.work_details ? '*' : ''}</label>
                     <input
                       type="number"
                       id="work_rate_{index}"
                       bind:value={row.work_rate}
                       min="0"
                       step="0.01"
                       required={!!row.work_details}
                       class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors[`work_rate_${index}`] ? 'border-red-500' : ''}"
                       on:input={() => calculateAmount(index)}
                     />
                     {#if validationErrors[`work_rate_${index}`]}
                       <p class="text-red-600 text-sm mt-1">{validationErrors[`work_rate_${index}`]}</p>
                     {/if}
                   </div>
                   <div>
                     <label for="amount_{index}" class="block text-sm font-medium theme-text-primary mb-2">Amount</label>
                     <div class="w-full px-3 py-2 theme-bg-secondary theme-border border rounded-lg text-center">
                       <span class="text-lg font-bold theme-text-accent">₹{row.amount.toFixed(2)}</span>
                       <p class="text-xs theme-text-secondary mt-1">
                         {row.work_qty} × ₹{row.work_rate.toFixed(2)}
                       </p>
                     </div>
                   </div>
                 </div>
              </div>
            {/each}

            <!-- Add New Requirement Button -->
            <div class="flex justify-center">
              <button
                type="button"
                on:click={addAdditionalRequirement}
                class="inline-flex items-center px-4 py-2 theme-border border rounded-md shadow-sm text-sm font-medium theme-text-primary theme-bg-primary hover:theme-bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Add Another Requirement
              </button>
            </div>
          </div>
        {/if}

        <!-- Section 9: Costs -->
        {#if currentSection === 9}
          <div class="space-y-4">
            <h3 class="text-xl font-semibold theme-text-primary mb-4">9. Costs</h3>
            
            <div class="theme-bg-secondary theme-border border rounded-lg p-4 mb-6">
              <div class="flex items-center">
                <svg class="w-5 h-5 theme-text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
                <span class="theme-text-secondary text-sm">Enter the Work Order Cost. GST and Cess will be calculated automatically based on the selected tax rates.</span>
              </div>
            </div>

            <!-- Row 1: WO Cost -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="work_order_cost" class="block text-sm font-medium theme-text-primary mb-2">WO Cost *</label>
                                 <input
                   type="number"
                   id="work_order_cost"
                   bind:value={formData.work_order_cost}
                   min="0"
                   step="0.01"
                   placeholder="0.00"
                   required
                   class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:outline-none {validationErrors.work_order_cost ? 'border-red-500' : ''}"
                   on:input={calculateTotalCost}
                   on:change={calculateTotalCost}
                 />
                {#if validationErrors.work_order_cost}
                  <p class="text-red-600 text-sm mt-1">{validationErrors.work_order_cost}</p>
                {/if}
                <p class="text-sm theme-text-secondary mt-1">Enter the base cost for the work order</p>
              </div>
            </div>

                         

                         <!-- Row 3: Calculated Values Display -->
             <div class="theme-bg-secondary rounded-lg p-4 theme-border border">
               <h4 class="text-sm font-medium theme-text-primary mb-3">Calculated Values</h4>
               <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div class="text-center">
                   <span class="block text-xs font-medium theme-text-secondary mb-1">GST Amount</span>
                   <div id="gst_amount_display" class="text-lg font-semibold theme-text-primary">
                     ₹{formData.gst.toFixed(2)}
                   </div>
                   <p class="text-xs theme-text-secondary">
                     {gstTaxRateOptions.length > 0 ? `${gstTaxRateOptions[0].de_value}% of ₹${formData.work_order_cost.toFixed(2)}` : 'Not calculated'}
                   </p>
                 </div>
                 <div class="text-center">
                   <span class="block text-xs font-medium theme-text-secondary mb-1">Cess Amount</span>
                   <div id="cess_amount_display" class="text-lg font-semibold theme-text-primary">
                     ₹{formData.cess.toFixed(2)}
                   </div>
                   <p class="text-xs theme-text-secondary">
                     {cessTaxRateOptions.length > 0 ? `${cessTaxRateOptions[0].de_value}% of ₹${formData.work_order_cost.toFixed(2)}` : 'Not calculated'}
                   </p>
                 </div>
                 <div class="text-center">
                   <span class="block text-xs font-medium theme-text-secondary mb-1">Total Cost</span>
                   <div id="total_cost_display" class="text-xl font-bold theme-text-accent">
                     ₹{formData.total_cost.toFixed(2)}
                   </div>
                   <p class="text-xs theme-text-secondary">
                     Base + GST + Cess
                   </p>
                 </div>
               </div>
             </div>
          </div>
        {/if}

        <!-- Placeholder for other sections -->
        {#if currentSection > 9 && currentSection < 10}
          <div class="text-center py-12">
            <h3 class="text-xl font-semibold theme-text-primary mb-4">Section {currentSection}</h3>
            <p class="theme-text-secondary">This section will be implemented next.</p>
          </div>
        {/if}

        <!-- Section 10: Confirmation -->
        {#if currentSection === 10}
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

            <!-- Work Order Summary -->
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
                  <div><span class="font-medium">Work Order Cost:</span> <span class="theme-text-secondary">{formData.work_order_cost.toFixed(2)}</span></div>
                  <div><span class="font-medium">GST:</span> <span class="theme-text-secondary">{formData.gst.toFixed(2)}</span></div>
                  <div><span class="font-medium">Cess:</span> <span class="theme-text-secondary">{formData.cess.toFixed(2)}</span></div>
                  <div><span class="font-medium">Total Cost:</span> <span class="theme-text-secondary">{formData.total_cost.toFixed(2)}</span></div>
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
                bind:checked={formData.confirmation}
                class="w-4 h-4 text-blue-600 theme-bg-primary theme-border border rounded focus:ring-blue-500 focus:ring-2"
              />
              <label for="confirmation" class="text-sm font-medium theme-text-primary">
                I confirm that all the information provided above is correct and I want to create this work order.
              </label>
            </div>

            <!-- Final Validation Error -->
            {#if validationErrors.confirmation}
              <div class="text-red-600 dark:text-red-400 text-sm theme-bg-secondary theme-border border p-3 rounded-lg">
                {validationErrors.confirmation}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-6 border-t theme-border theme-bg-primary">
        <div class="flex gap-2">
          <Button
            variant="secondary"
            on:click={resetForm}
          >
            Reset Form
          </Button>
        </div>
        <div class="flex gap-2">
          {#if currentSection > 1}
            <Button
              variant="secondary"
              on:click={previousSection}
            >
              Previous
            </Button>
          {/if}
          {#if currentSection < totalSections}
            <Button
              variant="primary"
              on:click={nextSection}
            >
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

