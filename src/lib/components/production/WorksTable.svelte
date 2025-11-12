<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { Search, Filter, Download, Plus } from 'lucide-svelte';
  import { canPlanWork } from '$lib/api/production';
  import { supabase } from '$lib/supabaseClient';

  export let data: any[] = [];
  export let isLoading: boolean = false;

  const dispatch = createEventDispatcher();

  // Table state
  let searchTerm = '';
  let showFilters = false;
  let filteredData: any[] = [];

  // Filter state
  let woNoFilter = '';
  let pwoNoFilter = '';
  let vehicleModelFilter = '';
  let workCodeFilter = '';
  let workNameFilter = '';
  let requiredSkillsFilter = '';

  // Planning status for each work
  let workPlanningStatus: { [key: string]: { canPlan: boolean; reason?: string } } = {};
  
  // Work status for each work
  let workStatus: { [key: string]: 'Yet to be planned' | 'Planned' | 'In progress' | 'Completed' } = {};

  // Multi-select state
  let selectedRows: Set<string> = new Set();

  // Helper function to parse time string to hours
  function parseTimeToHours(timeStr: string | number): number {
    if (typeof timeStr === 'number') return timeStr;
    if (!timeStr || timeStr === '0h 0m') return 0;
    
    // Parse "1h 30m" format
    const match = timeStr.toString().match(/(\d+)h\s*(\d+)?m?/);
    if (match) {
      const hours = parseInt(match[1]) || 0;
      const minutes = parseInt(match[2]) || 0;
      return hours + (minutes / 60);
    }
    return 0;
  }

  // Check work status for all works when data changes
  async function checkWorkStatus() {
    const stageCode = 'P1S2'; // This should be passed as a prop
    
    console.log(`🔍 Checking work status for ${data.length} works...`);
    
    for (const work of data) {
      // Determine if this is a standard or non-standard work
      // Standard work: has std_work_type_details.derived_sw_code and is_added_work is false/undefined
      // Non-standard work: is_added_work is true OR doesn't have std_work_type_details.derived_sw_code
      const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
      const isNonStandardWork = work.is_added_work === true || !hasDerivedSwCode;
      
      const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details.derived_sw_code : null;
      const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
      const workCode = derivedSwCode || otherWorkCode || 'Unknown';
      const woDetailsId = work.wo_details_id;
      const workKey = `${workCode}_${stageCode}`;
      
      try {
        console.log(`📋 Checking status for work: ${workCode} (${isNonStandardWork ? 'non-standard' : 'standard'})`, {
          derivedSwCode,
          otherWorkCode,
          woDetailsId,
          hasDerivedSwCode,
          is_added_work: work.is_added_work
        });
        
        if (!woDetailsId) {
          console.warn(`⚠️ No wo_details_id for work ${workCode}`);
          workStatus[workKey] = 'Yet to be planned';
          continue;
        }
        
        // First, check prdn_work_status for the current status
        // Use combination of wo_details_id and COALESCE(derived_sw_code, other_work_code) = workCode
        // This matches the database structure where one of these fields will be set
        if (!workCode || workCode === 'Unknown') {
          console.warn(`⚠️ Cannot check work status: no valid work code`);
          workStatus[workKey] = 'Yet to be planned';
          continue;
        }

        // Query using OR condition to match either derived_sw_code or other_work_code
        // This is equivalent to COALESCE(derived_sw_code, other_work_code) = workCode
        const { data: statusData, error: statusError } = await supabase
          .from('prdn_work_status')
          .select('current_status')
          .eq('stage_code', stageCode)
          .eq('wo_details_id', woDetailsId)
          .or(`derived_sw_code.eq.${workCode},other_work_code.eq.${workCode}`)
          .maybeSingle();
        
        console.log(`🔍 Querying prdn_work_status: stage_code=${stageCode}, wo_details_id=${woDetailsId}, workCode=${workCode} (matches derived_sw_code OR other_work_code)`);
        
        console.log(`📊 Status query result for ${workCode}:`, {
          statusData,
          statusError,
          current_status: statusData?.current_status
        });

        if (!statusError && statusData?.current_status) {
          // Map database status to display status
          const dbStatus = statusData.current_status;
          if (dbStatus === 'Yet to be Planned') {
            workStatus[workKey] = 'Yet to be planned';
            console.log(`📝 Work ${workCode}: Yet to be planned (from prdn_work_status)`);
            continue;
          } else if (dbStatus === 'Planned') {
            workStatus[workKey] = 'Planned';
            console.log(`📝 Work ${workCode}: Planned (from prdn_work_status)`);
            continue;
          } else if (dbStatus === 'In Progress') {
            workStatus[workKey] = 'In progress';
            console.log(`🔄 Work ${workCode}: In progress (from prdn_work_status)`);
            continue;
          } else if (dbStatus === 'Completed') {
            workStatus[workKey] = 'Completed';
            console.log(`✅ Work ${workCode}: Completed (from prdn_work_status)`);
            continue;
          }
        }

        // Fallback: Check if work is planned in prdn_work_planning
        let planningQuery = supabase
          .from('prdn_work_planning')
          .select('id, status')
          .eq('stage_code', stageCode)
          .eq('is_deleted', false);

        if (derivedSwCode) {
          planningQuery = planningQuery.eq('derived_sw_code', derivedSwCode);
        } else if (otherWorkCode) {
          planningQuery = planningQuery.eq('other_work_code', otherWorkCode);
        } else {
          workStatus[workKey] = 'Yet to be planned';
          continue;
        }

        const { data: planningData, error: planningError } = await planningQuery;

        if (planningError) {
          console.error(`❌ Error checking planning data for ${workCode}:`, planningError);
          workStatus[workKey] = 'Yet to be planned';
          continue;
        }

        if (!planningData || planningData.length === 0) {
          workStatus[workKey] = 'Yet to be planned';
          console.log(`📝 Work ${workCode}: Yet to be planned`);
          continue;
        }

        // Check if work is reported/completed
        const { data: reportingData, error: reportingError } = await supabase
          .from('prdn_work_reporting')
          .select('id, planning_id, created_dt')
          .in('planning_id', planningData.map(p => p.id))
          .eq('is_deleted', false);

        if (reportingError) {
          console.error(`❌ Error checking reporting data for ${workCode}:`, reportingError);
          workStatus[workKey] = 'Planned';
          continue;
        }

        if (!reportingData || reportingData.length === 0) {
          workStatus[workKey] = 'Planned';
          console.log(`📝 Work ${workCode}: Planned`);
          continue;
        }

        // Check if all planned works are reported
        const allPlannedWorksReported = planningData.every(plan => 
          reportingData.some(report => (report as any).planning_id === plan.id)
        );

        if (allPlannedWorksReported) {
          // Check if work is completed (has completion status or all reports are finished)
          const { data: completedReports, error: completedError } = await supabase
            .from('prdn_work_reporting')
            .select('completion_status')
            .in('planning_id', planningData.map(p => p.id))
            .eq('is_deleted', false);

          if (completedError) {
            console.error(`❌ Error checking completion status for ${workCode}:`, completedError);
            workStatus[workKey] = 'In progress';
            continue;
          }

          // Check if all reports are completed
          // completion_status values are 'C' (Completed) or 'NC' (Not Completed)
          const allReportsCompleted = completedReports?.every(report => 
            report.completion_status === 'C'
          ) || false;

          if (allReportsCompleted) {
            workStatus[workKey] = 'Completed';
            console.log(`✅ Work ${workCode}: Completed`);
          } else {
            // Check if work has been planned again for the next day (cycle continues)
            let newerPlanningQuery = supabase
              .from('prdn_work_planning')
              .select('id, created_dt')
              .eq('stage_code', stageCode)
              .eq('is_deleted', false)
              .order('created_dt', { ascending: false })
              .limit(1);

            if (derivedSwCode) {
              newerPlanningQuery = newerPlanningQuery.eq('derived_sw_code', derivedSwCode);
            } else if (otherWorkCode) {
              newerPlanningQuery = newerPlanningQuery.eq('other_work_code', otherWorkCode);
            }

            const { data: newerPlanningData, error: newerPlanningError } = await newerPlanningQuery;

            if (newerPlanningError) {
              console.error(`❌ Error checking newer planning data for ${workCode}:`, newerPlanningError);
              workStatus[workKey] = 'In progress';
              continue;
            }

            // Check if there's a newer planning record created after the latest report
            // Use parseUTCDate for proper UTC handling
            const { parseUTCDate } = await import('$lib/utils/formatDate');
            
            const latestReportDate = reportingData?.reduce((latest, report) => {
              const reportDate = parseUTCDate((report as any).created_dt || '1970-01-01T00:00:00Z');
              return reportDate > latest ? reportDate : latest;
            }, new Date(0));

            const hasNewerPlanning = newerPlanningData?.some(plan => {
              const planDate = parseUTCDate(plan.created_dt);
              return planDate > latestReportDate;
            }) || false;

            if (hasNewerPlanning) {
              workStatus[workKey] = 'Planned';
              console.log(`📝 Work ${workCode}: Planned (cycle continues)`);
            } else {
              workStatus[workKey] = 'In progress';
              console.log(`🔄 Work ${workCode}: In progress (needs to be planned again)`);
            }
          }
        } else {
          workStatus[workKey] = 'In progress';
          console.log(`🔄 Work ${workCode}: In progress (some works not reported)`);
        }

      } catch (error) {
        console.error(`❌ Error checking work status for ${workCode}:`, error);
        workStatus[workKey] = 'Yet to be planned';
      }
    }
    
    console.log(`📊 Work status check complete for all works`);
  }

  // Check planning status for all works when data changes
  async function checkPlanningStatus() {
    const stageCode = 'P1S2'; // This should be passed as a prop
    
    console.log(`🔍 Checking planning status for ${data.length} works...`);
    
    for (const work of data) {
      // Determine if this is a standard or non-standard work
      const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
      const isNonStandardWork = work.is_added_work === true || !hasDerivedSwCode;
      
      const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details.derived_sw_code : null;
      const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
      const workCode = derivedSwCode || otherWorkCode || 'Unknown';
      const woDetailsId = work.wo_details_id;
      const workKey = `${workCode}_${stageCode}`;
      
      try {
        console.log(`📋 Checking planning status for work: ${workCode} (${isNonStandardWork ? 'non-standard' : 'standard'})`);
        const validation = await canPlanWork(derivedSwCode, stageCode, woDetailsId, otherWorkCode);
        workPlanningStatus[workKey] = validation;
        console.log(`✅ Planning status for ${workCode}:`, validation);
      } catch (error) {
        console.error(`❌ Error checking planning status for ${workCode}:`, error);
        workPlanningStatus[workKey] = { 
          canPlan: false, 
          reason: `Error checking status: ${(error as Error)?.message || 'Unknown error'}` 
        };
      }
    }
    
    console.log(`📊 Planning status check complete for all works`);
  }

  // Watch for data changes and apply filters
  $: data, searchTerm, woNoFilter, pwoNoFilter, vehicleModelFilter, workCodeFilter, workNameFilter, requiredSkillsFilter, filteredData = applyFilters().map(work => {
      // Calculate remaining time = duration - time taken
      const duration = work.std_vehicle_work_flow?.estimated_duration_minutes || 0;
      const durationHours = duration / 60;
      const timeTakenHours = work.time_taken || 0; // time_taken is already in hours from API
      const remainingTime = Math.max(0, durationHours - timeTakenHours);
      
      return {
        ...work,
        remaining_time: remainingTime,
        time_exceeded: timeTakenHours > durationHours // Flag for highlighting
      };
    });
  
  // Check planning status and work status when data changes
  $: if (data.length > 0) {
    checkPlanningStatus();
    checkWorkStatus();
  }

  function applyFilters() {
    let filtered = data;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(work => 
        (work.std_work_type_details?.derived_sw_code || work.sw_code)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        work.sw_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        work.std_work_type_details?.type_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        work.mstr_wo_type?.wo_type_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply work order number filter
    if (woNoFilter) {
      filtered = filtered.filter(work => 
        (work.wo_no || '').toLowerCase().includes(woNoFilter.toLowerCase())
      );
    }

    // Apply pre-work order number filter
    if (pwoNoFilter) {
      filtered = filtered.filter(work => 
        (work.pwo_no || '').toLowerCase().includes(pwoNoFilter.toLowerCase())
      );
    }

    // Apply vehicle model filter
    if (vehicleModelFilter) {
      filtered = filtered.filter(work => 
        (work.mstr_wo_type?.wo_type_name || '').toLowerCase().includes(vehicleModelFilter.toLowerCase())
      );
    }

    // Apply work code filter
    if (workCodeFilter) {
      filtered = filtered.filter(work => {
        const code = (work.std_work_type_details?.derived_sw_code || work.sw_code || '').toLowerCase();
        return code.includes(workCodeFilter.toLowerCase());
      });
    }

    // Apply work name filter
    if (workNameFilter) {
      filtered = filtered.filter(work => 
        (work.sw_name || '').toLowerCase().includes(workNameFilter.toLowerCase()) ||
        (work.std_work_type_details?.type_description || '').toLowerCase().includes(workNameFilter.toLowerCase())
      );
    }

    // Apply required skills filter
    if (requiredSkillsFilter) {
      filtered = filtered.filter(work => {
        if (!work.skill_mappings || work.skill_mappings.length === 0) return false;
        return work.skill_mappings.some((skill: any) => 
          (skill.sc_name || '').toLowerCase().includes(requiredSkillsFilter.toLowerCase())
        );
      });
    }

    return filtered;
  }

  function handleExport() {
    dispatch('export', { data: filteredData, type: 'works' });
  }

  function handleAddWork() {
    console.log('Add Work button clicked');
    dispatch('addWork');
  }

  function handleViewWork(work: any) {
    dispatch('viewWork', { work });
  }

  function handleEditWork(work: any) {
    dispatch('editWork', { work });
  }

  function handleRemoveWork(work: any) {
    dispatch('removeWork', { work });
  }

  // Multi-select functions
  function toggleRowSelection(work: any) {
    const workId = getWorkId(work);
    if (!workId) return;

    if (selectedRows.has(workId)) {
      selectedRows.delete(workId);
    } else {
      selectedRows.add(workId);
    }
    selectedRows = new Set(selectedRows); // Trigger reactivity
  }

  function getWorkId(work: any): string {
    // Create a unique ID for the work
    const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    const woDetailsId = work.wo_details_id;
    return `${derivedSwCode}_${woDetailsId}`;
  }

  function handleRemoveSelected() {
    const selectedWorks = filteredData.filter(work => selectedRows.has(getWorkId(work)));
    
    // Filter out works that are already planned (cannot be removed)
    const removableWorks = selectedWorks.filter(work => !isWorkPlanned(work));
    
    if (removableWorks.length === 0) {
      alert('No removable works selected. Works that are already planned cannot be removed.');
      return;
    }

    if (removableWorks.length < selectedWorks.length) {
      const plannedCount = selectedWorks.length - removableWorks.length;
      if (!confirm(`${plannedCount} selected work(s) are already planned and cannot be removed. Proceed with removing ${removableWorks.length} work(s)?`)) {
        return;
      }
    }

    dispatch('removeSelected', { works: removableWorks });
    clearAllSelections();
  }

  function clearAllSelections() {
    selectedRows.clear();
    selectedRows = new Set(selectedRows); // Trigger reactivity
  }

  function selectAllRemovable() {
    const removableWorks = filteredData.filter(work => !isWorkPlanned(work));
    removableWorks.forEach(work => {
      const workId = getWorkId(work);
      if (workId) {
        selectedRows.add(workId);
      }
    });
    selectedRows = new Set(selectedRows); // Trigger reactivity
  }

  function getPlanningStatus(work: any): { canPlan: boolean; reason?: string } {
    const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    const stageCode = 'P1S2';
    const workKey = `${derivedSwCode}_${stageCode}`;
    return workPlanningStatus[workKey] || { canPlan: true }; // Default to true if not checked yet
  }

  function isWorkPlanned(work: any): boolean {
    const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
    const stageCode = 'P1S2';
    const workKey = `${derivedSwCode}_${stageCode}`;
    const status = workStatus[workKey];
    // Work is planned if status is 'Planned', 'In progress', or 'Completed'
    return status === 'Planned' || status === 'In progress' || status === 'Completed';
  }

  async function handlePlanWork(work: any) {
    try {
      // Determine if this is a standard or non-standard work
      const hasDerivedSwCode = !!work.std_work_type_details?.derived_sw_code;
      const isNonStandardWork = work.is_added_work === true || !hasDerivedSwCode;
      const derivedSwCode = hasDerivedSwCode ? work.std_work_type_details.derived_sw_code : null;
      const otherWorkCode = isNonStandardWork ? (work.sw_code || null) : null;
      const workCode = derivedSwCode || otherWorkCode || 'Unknown';
      const woDetailsId = work.wo_details_id;
      const stageCode = 'P1S2'; // This should be passed as a prop or determined dynamically
      
      console.log(`🔍 Checking if work ${workCode} can be planned...`);
      
      const validation = await canPlanWork(derivedSwCode, stageCode, woDetailsId, otherWorkCode);
      
      if (validation.canPlan) {
        console.log(`✅ Work ${workCode} can be planned`);
        dispatch('planWork', { work });
      } else {
        console.log(`❌ Work ${workCode} cannot be planned:`, validation.reason);
        alert(validation.reason || 'This work cannot be planned at this time.');
      }
    } catch (error) {
      console.error('Error checking work planning status:', error);
      alert('Error checking work planning status. Please try again.');
    }
  }

  function formatTime(minutes: number): string {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  function getSkillLevelColor(skill: string): string {
    const skillColors: { [key: string]: string } = {
      'S1': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      'S2': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'S3': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      'S4': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };
    return skillColors[skill] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }

</script>

<div class="theme-bg-primary rounded-lg shadow border theme-border">
  <!-- Header with Search, Filters, and Actions -->
  <div class="p-4 border-b theme-border">
    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <!-- Page Title -->
      <h2 class="text-xl font-semibold theme-text-primary">Works to be Planned</h2>
      
      <!-- Search and Filters -->
      <div class="flex flex-col sm:flex-row gap-4 flex-1">
        <!-- Search Bar -->
        <div class="relative flex-1 max-w-md">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="Search works..."
            class="w-full pl-10 pr-4 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Show Filters Button -->
        <Button
          variant="secondary"
          size="sm"
          on:click={() => showFilters = !showFilters}
        >
          <Filter class="w-4 h-4 mr-2" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          on:click={() => dispatch('refresh')}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          on:click={handleExport}
        >
          <Download class="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button
          variant="primary"
          size="sm"
          on:click={handleAddWork}
        >
          <Plus class="w-4 h-4 mr-2" />
          Add Work
        </Button>
      </div>
    </div>

    <!-- Multi-select controls -->
    {#if selectedRows.size > 0}
      {@const selectedWorks = filteredData.filter(work => selectedRows.has(getWorkId(work)))}
      {@const removableWorks = selectedWorks.filter(work => !isWorkPlanned(work))}
      <div class="px-4 py-3 border-b theme-border bg-blue-50 dark:bg-blue-900/20">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <span class="text-sm theme-text-primary">
              {selectedRows.size} work{selectedRows.size === 1 ? '' : 's'} selected
              {#if removableWorks.length < selectedWorks.length}
                <span class="text-orange-600 dark:text-orange-400">
                  ({removableWorks.length} removable, {selectedWorks.length - removableWorks.length} already planned)
                </span>
              {/if}
            </span>
            <Button 
              variant="danger" 
              size="sm" 
              on:click={handleRemoveSelected}
              disabled={removableWorks.length === 0}
            >
              Remove Selected ({removableWorks.length})
            </Button>
            {#if removableWorks.length < selectedWorks.length}
              <span class="text-xs text-orange-600 dark:text-orange-400">
                Some selected works are already planned and cannot be removed
              </span>
            {/if}
          </div>
          <div class="flex items-center gap-2">
            <Button variant="secondary" size="sm" on:click={selectAllRemovable}>
              Select All Removable
            </Button>
            <Button variant="secondary" size="sm" on:click={clearAllSelections}>
              Clear Selection
            </Button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Filters Panel -->
    {#if showFilters}
      <div class="mt-4 p-4 theme-bg-secondary rounded-lg border theme-border">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Work Order Number Filter -->
          <div>
            <label for="woNoFilter" class="block text-sm font-medium theme-text-primary mb-2">
              Work Order Number
            </label>
            <input
              type="text"
              id="woNoFilter"
              bind:value={woNoFilter}
              placeholder="Filter by WO Number..."
              class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- Pre-Work Order Number Filter -->
          <div>
            <label for="pwoNoFilter" class="block text-sm font-medium theme-text-primary mb-2">
              Pre-Work Order Number
            </label>
            <input
              type="text"
              id="pwoNoFilter"
              bind:value={pwoNoFilter}
              placeholder="Filter by PWO Number..."
              class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- Vehicle Model Filter -->
          <div>
            <label for="vehicleModelFilter" class="block text-sm font-medium theme-text-primary mb-2">
              Vehicle Model
            </label>
            <input
              type="text"
              id="vehicleModelFilter"
              bind:value={vehicleModelFilter}
              placeholder="Filter by Vehicle Model..."
              class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- Work Code Filter -->
          <div>
            <label for="workCodeFilter" class="block text-sm font-medium theme-text-primary mb-2">
              Work Code
            </label>
            <input
              type="text"
              id="workCodeFilter"
              bind:value={workCodeFilter}
              placeholder="Filter by Work Code..."
              class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- Work Name Filter -->
          <div>
            <label for="workNameFilter" class="block text-sm font-medium theme-text-primary mb-2">
              Work Name
            </label>
            <input
              type="text"
              id="workNameFilter"
              bind:value={workNameFilter}
              placeholder="Filter by Work Name..."
              class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- Required Skills Filter -->
          <div>
            <label for="requiredSkillsFilter" class="block text-sm font-medium theme-text-primary mb-2">
              Required Skills
            </label>
            <input
              type="text"
              id="requiredSkillsFilter"
              bind:value={requiredSkillsFilter}
              placeholder="Filter by Skills..."
              class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Color Key Legend -->
  <div class="mb-4 p-4 theme-bg-secondary rounded-lg border theme-border">
    <h3 class="text-sm font-medium theme-text-primary mb-3">Color Legend</h3>
    <div class="flex flex-wrap gap-4 text-sm">
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded" style="background-color: #fecaca;"></div>
        <span class="theme-text-primary">Time Exceeded (Actual time > Planned duration)</span>
      </div>
    </div>
  </div>

  <!-- Table -->
  <div class="overflow-x-auto relative">
    <div class="overflow-x-auto pb-0" id="table-scroll-container">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="theme-bg-secondary sticky top-0 z-10">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider w-12">
            <input
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={filteredData.length > 0 && filteredData.filter(work => !isWorkPlanned(work)).every(work => selectedRows.has(getWorkId(work)))}
              on:change={(e) => {
                if (e.currentTarget.checked) {
                  selectAllRemovable();
                } else {
                  clearAllSelections();
                }
              }}
            />
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            WO Details ID
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Work Order Number
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Pre-Work Order Number
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Vehicle Model
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Work Code
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Work Name
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Status
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Required Skills
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Duration
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Time Taken
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Remaining Time
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
        {#if isLoading}
          <tr>
            <td colspan="13" class="px-6 py-4 text-center">
              <div class="flex items-center justify-center">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
                <span class="theme-text-secondary">Loading works...</span>
              </div>
            </td>
          </tr>
        {:else if filteredData.length === 0}
          <tr>
            <td colspan="13" class="px-6 py-4 text-center">
              <div class="text-center py-8">
                <div class="text-4xl mb-2">🔧</div>
                <p class="theme-text-secondary text-lg">No works found</p>
                <p class="theme-text-secondary text-sm mt-1">
                  {searchTerm || woNoFilter || pwoNoFilter || vehicleModelFilter || workCodeFilter || workNameFilter || requiredSkillsFilter ? 'Try adjusting your filters' : 'No works have been added yet'}
                </p>
              </div>
            </td>
          </tr>
        {:else}
          {#each filteredData as work}
            {@const planningStatus = getPlanningStatus(work)}
            {@const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code}
            {@const workKey = `${derivedSwCode}_P1S2`}
            {@const status = workStatus[workKey] || 'Yet to be planned'}
            <tr class="hover:theme-bg-secondary transition-colors duration-150 {selectedRows.has(getWorkId(work)) ? 'bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100' : ''}" 
                class:time-exceeded={work.time_exceeded}>
              <td class="px-6 py-4 whitespace-nowrap {selectedRows.has(getWorkId(work)) ? 'text-gray-900 dark:text-gray-100' : ''}">
                <input
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedRows.has(getWorkId(work))}
                  disabled={isWorkPlanned(work)}
                  on:change={() => toggleRowSelection(work)}
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {selectedRows.has(getWorkId(work)) ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
                {work.wo_details_id || 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {selectedRows.has(getWorkId(work)) ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
                {work.wo_no || 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {selectedRows.has(getWorkId(work)) ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
                {work.pwo_no || 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {selectedRows.has(getWorkId(work)) ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
                {work.mstr_wo_type?.wo_type_name || 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {selectedRows.has(getWorkId(work)) ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
                {work.std_work_type_details?.derived_sw_code || work.sw_code || 'N/A'}
              </td>
              <td class="px-6 py-4 text-sm {selectedRows.has(getWorkId(work)) ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'} max-w-xs">
                <div class="break-words">
                  {work.sw_name}{work.std_work_type_details?.type_description ? ' - ' + work.std_work_type_details.type_description : ''}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                {#if status === 'Yet to be planned'}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    Yet to be planned
                  </span>
                {:else if status === 'Planned'}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    Planned
                  </span>
                {:else if status === 'In progress'}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                    In progress
                  </span>
                {:else if status === 'Completed'}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                    Completed
                  </span>
                {:else}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    {status}
                  </span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                {#if work.skill_mappings && work.skill_mappings.length > 0}
                  <div class="flex flex-wrap gap-1">
                    {#each work.skill_mappings as skill}
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        {skill.sc_name}
                      </span>
                    {/each}
                  </div>
                {:else}
                  <span class="text-gray-400">No skills</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {selectedRows.has(getWorkId(work)) ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
                {work.std_vehicle_work_flow?.estimated_duration_minutes ? formatTime(work.std_vehicle_work_flow.estimated_duration_minutes) : 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {selectedRows.has(getWorkId(work)) ? (work.time_exceeded ? 'text-gray-900 dark:text-gray-900 font-bold' : 'text-gray-900 dark:text-gray-100') : (work.time_exceeded ? 'text-gray-900 dark:text-gray-900 font-bold' : 'theme-text-primary')}">
                <div>
                  <div class="font-medium">
                    {work.time_taken ? formatTime(work.time_taken * 60) : '0h 0m'}
                  </div>
                  {#if work.skill_time_breakdown && Object.keys(work.skill_time_breakdown).length > 0}
                    <div class="text-xs theme-text-secondary mt-1">
                      {#each Object.entries(work.skill_time_breakdown) as [skill, time]}
                        <div class="flex justify-between">
                          <span>{skill}:</span>
                          <span>{formatTime((time as number) * 60)}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {selectedRows.has(getWorkId(work)) ? (work.time_exceeded ? 'text-gray-900 dark:text-gray-900 font-bold' : 'text-gray-900 dark:text-gray-100') : (work.time_exceeded ? 'text-gray-900 dark:text-gray-900 font-bold' : 'theme-text-primary')}">
                {work.remaining_time ? formatTime(work.remaining_time * 60) : 'N/A'}
                {#if work.time_exceeded}
                  <span class="ml-2 text-xs px-2 py-1 rounded-full bg-red-200 text-red-900 dark:bg-red-700 dark:text-red-100 font-bold">
                    ⚠️ Exceeded
                  </span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm {selectedRows.has(getWorkId(work)) ? 'text-gray-900 dark:text-gray-100' : 'theme-text-primary'}">
                <div class="flex space-x-2">
                  <Button
                    variant={planningStatus.canPlan ? "primary" : "secondary"}
                    size="sm"
                    disabled={!planningStatus.canPlan}
                    on:click={() => handlePlanWork(work)}
                  >
                    {planningStatus.canPlan ? 'Plan' : 'Cannot Plan'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    on:click={() => handleViewWork(work)}
                  >
                    View
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isWorkPlanned(work)}
                    on:click={() => handleRemoveWork(work)}
                  >
                    Remove
                  </Button>
                </div>
                {#if !planningStatus.canPlan && planningStatus.reason}
                  <div class="text-xs text-red-600 dark:text-red-400 mt-1">
                    {planningStatus.reason}
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
    </div>
  </div>

  <!-- Summary Stats -->
  {#if filteredData.length > 0}
    <div class="px-6 py-4 theme-bg-secondary border-t theme-border">
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="theme-text-secondary">
          <span class="font-medium">Total Works:</span> {filteredData.length}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Estimated Duration:</span> {formatTime(filteredData.reduce((sum, work) => sum + (work.std_vehicle_work_flow?.estimated_duration_minutes || 0), 0))}
        </div>
        <div class="theme-text-secondary">
          <span class="font-medium">Total Works:</span> {filteredData.length} | 
          <span class="font-medium">Yet to be planned:</span> {filteredData.filter(work => {
            const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
            const workKey = `${derivedSwCode}_P1S2`;
            return workStatus[workKey] === 'Yet to be planned';
          }).length} | 
          <span class="font-medium">Planned:</span> {filteredData.filter(work => {
            const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
            const workKey = `${derivedSwCode}_P1S2`;
            return workStatus[workKey] === 'Planned';
          }).length} | 
          <span class="font-medium">In progress:</span> {filteredData.filter(work => {
            const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
            const workKey = `${derivedSwCode}_P1S2`;
            return workStatus[workKey] === 'In progress';
          }).length} | 
          <span class="font-medium">Completed:</span> {filteredData.filter(work => {
            const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
            const workKey = `${derivedSwCode}_P1S2`;
            return workStatus[workKey] === 'Completed';
          }).length}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Time exceeded highlighting for works */
  :global(.time-exceeded) {
    background-color: #fecaca !important; /* red-100 */
  }
  
  :global(.dark .time-exceeded) {
    background-color: #7f1d1d !important; /* red-900 */
  }
  
  /* Ensure black text in highlighted rows */
  :global(.time-exceeded td) {
    color: #111827 !important; /* gray-900 - black text */
  }
  
  :global(.dark .time-exceeded td) {
    color: #111827 !important; /* gray-900 - black text */
  }
</style>
