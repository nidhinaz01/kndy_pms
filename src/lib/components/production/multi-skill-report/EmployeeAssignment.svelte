<script lang="ts">
  import type { MultiSkillReportFormData } from '$lib/types/multiSkillReport';

  export let selectedWorks: any[] = [];
  export let availableWorkers: any[] = [];
  export let formData: MultiSkillReportFormData;
  export let onEmployeeChange: (workId: string, employeeId: string) => void = () => {};
  export let onDeviationChange: (workId: string, hasDeviation: boolean, reason: string) => void = () => {};

  // Sort selectedWorks by skill_order from std_work_skill_mapping
  $: sortedWorks = (() => {
    if (selectedWorks.length === 0) return [];
    
    // Get the skill combination from the first work's mapping (all works should have the same mapping)
    const firstWork = selectedWorks[0];
    const skillMapping = firstWork?.std_work_skill_mapping;
    
    if (!skillMapping?.std_skill_combinations) {
      return selectedWorks; // Return as-is if no mapping available
    }
    
    // Extract skill combination
    const skillCombinations = skillMapping.std_skill_combinations;
    const skillCombination = Array.isArray(skillCombinations)
      ? skillCombinations[0]?.skill_combination
      : skillCombinations?.skill_combination;
    
    if (!skillCombination || !Array.isArray(skillCombination)) {
      return selectedWorks; // Return as-is if no valid combination
    }
    
    // Create a map of skill identifier -> skill_order
    // sc_required can match with either skill_name or skill_short
    const skillOrderMap = new Map<string, number>();
    skillCombination.forEach((skill: any) => {
      if (skill.skill_order !== undefined) {
        // Map both skill_name and skill_short to the same order
        if (skill.skill_name) {
          skillOrderMap.set(skill.skill_name, skill.skill_order);
        }
        if (skill.skill_short) {
          skillOrderMap.set(skill.skill_short, skill.skill_order);
        }
      }
    });
    
    // Sort works by skill_order
    return [...selectedWorks].sort((a, b) => {
      const skillA = a.sc_required || '';
      const skillB = b.sc_required || '';
      
      // Try to find order by matching sc_required with skill_name or skill_short
      let orderA = 999; // Default to 999 if not found
      let orderB = 999;
      
      // Check if sc_required matches any skill in the combination
      for (const skill of skillCombination) {
        if ((skill.skill_name === skillA || skill.skill_short === skillA) && skill.skill_order !== undefined) {
          orderA = skill.skill_order;
          break;
        }
      }
      
      for (const skill of skillCombination) {
        if ((skill.skill_name === skillB || skill.skill_short === skillB) && skill.skill_order !== undefined) {
          orderB = skill.skill_order;
          break;
        }
      }
      
      return orderA - orderB;
    });
  })();

  // Handle employee change for a specific work
  function handleEmployeeChange(workId: string, employeeId: string, selectElement: HTMLSelectElement) {
    // If a worker is selected, clear deviation and check if they're already assigned to another skill competency
    if (employeeId) {
      // Clear deviation when worker is selected
      const currentDeviation = formData.deviations[workId];
      if (currentDeviation?.hasDeviation) {
        onDeviationChange(workId, false, '');
      }
      
      const selectedWorker = availableWorkers.find(w => w.emp_id === employeeId);
      const currentWork = selectedWorks.find(w => w.id === workId);
      const currentSkillName = currentWork?.sc_required || currentWork?.std_work_skill_mapping?.sc_name || 'N/A';
      
      // Check if this worker is already assigned to a different skill competency
      for (const work of selectedWorks) {
        if (work.id === workId) continue; // Skip the current work
        
        const workSkillName = work.sc_required || work.std_work_skill_mapping?.sc_name || 'N/A';
        const workEmployeeId = formData.skillEmployees[work.id];
        
        // If this work has a different skill and the same employee is assigned
        if (workSkillName !== currentSkillName && workEmployeeId === employeeId) {
          // Worker is already assigned to another skill competency
          alert(`Worker ${selectedWorker?.emp_name || employeeId} is already assigned to another skill competency (${workSkillName}). One worker can only be assigned to one skill competency at a time.`);
          // Reset the select to the previous value
          const previousValue = formData.skillEmployees[workId] || '';
          selectElement.value = previousValue;
          return; // Don't assign, keep the current selection
        }
      }
    }
    
    // Worker is not already assigned to another skill, proceed with assignment
    onEmployeeChange(workId, employeeId);
  }

  // Handle deviation checkbox change
  function handleDeviationToggle(workId: string, checked: boolean) {
    if (checked) {
      // When deviation is checked, clear worker selection
      onEmployeeChange(workId, '');
      onDeviationChange(workId, true, formData.deviations[workId]?.reason || '');
    } else {
      // When deviation is unchecked, clear deviation
      onDeviationChange(workId, false, '');
    }
  }

  // Handle deviation reason change
  function handleDeviationReasonChange(workId: string, reason: string) {
    onDeviationChange(workId, true, reason);
  }
</script>

<div>
  <h4 class="font-medium theme-text-primary mb-3">Assign Workers to Skills</h4>
  <div class="space-y-3">
    {#each sortedWorks as work}
      {@const workId = work.id}
      {@const hasDeviation = formData.deviations[workId]?.hasDeviation || false}
      {@const deviationReason = formData.deviations[workId]?.reason || ''}
      <div class="p-3 border theme-border rounded-lg theme-bg-primary space-y-3">
        <div class="flex items-center space-x-4">
          <div class="flex-1">
            <div class="text-sm font-medium theme-text-primary">
              {work.sc_required || work.std_work_skill_mapping?.sc_name || 'N/A'}
            </div>
            <div class="text-xs theme-text-secondary">Skill Competency</div>
          </div>
          <div class="flex-1">
            <select
              value={formData.skillEmployees[workId] || ''}
              on:change={(e) => handleEmployeeChange(workId, e.currentTarget.value, e.currentTarget)}
              disabled={hasDeviation}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Choose a worker...</option>
              {#each availableWorkers as availableWorker}
                {@const currentWorkSkill = work.sc_required || work.std_work_skill_mapping?.sc_name || 'N/A'}
                {@const isAlreadyAssigned = (() => {
                  // Check if this worker is already assigned to a different skill competency
                  for (const w of selectedWorks) {
                    if (w.id === workId) continue; // Skip the current work
                    
                    const workSkillName = w.sc_required || w.std_work_skill_mapping?.sc_name || 'N/A';
                    const workEmployeeId = formData.skillEmployees[w.id];
                    
                    // If this work has a different skill and the same employee is assigned
                    if (workSkillName !== currentWorkSkill && workEmployeeId === availableWorker.emp_id) {
                      return true;
                    }
                  }
                  return false;
                })()}
                <option value={availableWorker.emp_id} disabled={isAlreadyAssigned}>
                  {availableWorker.emp_name} ({availableWorker.skill_short}){isAlreadyAssigned ? ' - Already assigned to another skill' : ''}
                </option>
              {/each}
            </select>
          </div>
          <div class="flex items-center space-x-2">
            <input
              type="checkbox"
              id="deviation-{workId}"
              checked={hasDeviation}
              on:change={(e) => handleDeviationToggle(workId, e.currentTarget.checked)}
              class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <label for="deviation-{workId}" class="text-sm theme-text-primary cursor-pointer">
              No worker available (Deviation)
            </label>
          </div>
        </div>
        {#if hasDeviation}
          <div class="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <label for="deviation-reason-{workId}" class="block text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">
              Deviation Reason <span class="text-red-500">*</span>
            </label>
            <textarea
              id="deviation-reason-{workId}"
              value={deviationReason}
              on:input={(e) => handleDeviationReasonChange(workId, e.currentTarget.value)}
              placeholder="Please provide a reason for this deviation..."
              rows="2"
              class="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            ></textarea>
            <p class="mt-1 text-xs text-orange-600 dark:text-orange-400">
              This deviation will be recorded and visible in reports and approval workflows.
            </p>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

