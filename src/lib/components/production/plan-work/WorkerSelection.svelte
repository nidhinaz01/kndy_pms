<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import type { Worker, SelectedWorker } from '$lib/types/planWork';
  import { getSkillShort, getIndividualSkills } from '$lib/utils/planWorkUtils';

  export let work: any = null;
  export let availableWorkers: Worker[] = [];
  export let selectedWorkers: { [skill: string]: SelectedWorker | null } = {};
  export let selectedSkillMappingIndex: number = -1;
  export let selectedDate: string = '';
  export let fromTime: string = '';
  export let toTime: string = '';
  export let onWorkerChange: (event: Event, skillKey: string) => void = () => {};
  export let onSkillMappingChange: (index: number) => void = () => {};
  export let excludePlanIds: number[] = []; // Plan IDs to exclude from conflict checks (for edit mode)

  // Track which workers are already assigned to other work plans at the same time
  let workersAssignedToOtherPlans: Set<string> = new Set();

  // Check for workers already assigned to other work plans when time is selected
  $: if (selectedDate && fromTime && toTime) {
    checkWorkersAssignedToOtherPlans();
  } else {
    workersAssignedToOtherPlans = new Set();
  }

  // Helper function to convert time string (HH:MM or HH:MM:SS) to minutes
  function timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async function checkWorkersAssignedToOtherPlans() {
    if (!selectedDate || !fromTime || !toTime || availableWorkers.length === 0) {
      workersAssignedToOtherPlans = new Set();
      return;
    }

    try {
      const workerIds = availableWorkers.map(w => w.emp_id);
      
      // Check existing work plans for these workers at the same time
      let query = supabase
        .from('prdn_work_planning')
        .select('id, worker_id, from_date, from_time, to_date, to_time')
        .in('worker_id', workerIds)
        .eq('from_date', selectedDate)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .eq('status', 'draft');
      
      const { data: allExistingPlans, error } = await query;
      
      if (error) {
        console.error('Error checking existing plans:', error);
        return;
      }
      
      // Exclude plans being edited (for edit mode) - filter after query
      const existingPlans = excludePlanIds.length > 0
        ? (allExistingPlans || []).filter((plan: any) => !excludePlanIds.includes(plan.id))
        : (allExistingPlans || []);
      
      console.log(`🔍 Checking worker conflicts: ${existingPlans.length} plans (excluding ${excludePlanIds.length} being edited)`);

      const assignedWorkerIds = new Set<string>();
      
      // Convert selected time to minutes for comparison
      const fromMinutes = timeToMinutes(fromTime);
      const toMinutes = timeToMinutes(toTime);
      let adjustedToMinutes = toMinutes;
      if (adjustedToMinutes < fromMinutes) {
        adjustedToMinutes += 24 * 60; // Handle overnight
      }
      
      (existingPlans || []).forEach((plan: any) => {
        if (!plan.from_time || !plan.to_time) return;
        
        const planFromMinutes = timeToMinutes(plan.from_time);
        const planToMinutes = timeToMinutes(plan.to_time);
        let adjustedPlanToMinutes = planToMinutes;
        if (adjustedPlanToMinutes < planFromMinutes) {
          adjustedPlanToMinutes += 24 * 60; // Handle overnight
        }
        
        // Check if time ranges overlap (excluding adjacent slots)
        // Two ranges overlap if: start1 < end2 && end1 > start2
        // Adjacent slots (where one ends exactly when another starts) are allowed
        // This means we only mark as unavailable if there's actual overlap, not just adjacency
        const hasOverlap = fromMinutes < adjustedPlanToMinutes && adjustedToMinutes > planFromMinutes;
        // Also check if they're exactly adjacent (one ends when another starts)
        const isAdjacent = (fromMinutes === adjustedPlanToMinutes) || (adjustedToMinutes === planFromMinutes);
        if (hasOverlap && !isAdjacent) {
          assignedWorkerIds.add(plan.worker_id);
        }
      });

      workersAssignedToOtherPlans = assignedWorkerIds;
    } catch (error) {
      console.error('Error checking workers assigned to other plans:', error);
      workersAssignedToOtherPlans = new Set();
    }
  }
</script>

{#if work?.skill_mappings && work.skill_mappings.length > 0}
  <div>
    <h4 class="font-medium theme-text-primary mb-3">Assign Workers by Skill</h4>
    
    <!-- If multiple skill mappings, allow selecting only one -->
    {#if work.skill_mappings.length > 1}
      <div class="mb-4">
        <p class="text-sm theme-text-secondary mb-2">
          This work has multiple alternative skill combinations. Select ONE to plan:
        </p>
        <div class="space-y-2">
          {#each work.skill_mappings as skill, index}
            {@const skillAny = skill as any}
            {@const skillShort = getSkillShort(skillAny)}
            <label class="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors {
              selectedSkillMappingIndex === index 
                ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 dark:text-gray-100' 
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            }">
              <input
                type="radio"
                name="skill-mapping"
                value={index}
                checked={selectedSkillMappingIndex === index}
                on:change={() => onSkillMappingChange(index)}
                class="mr-3 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
              />
              <div class="flex-1">
                <div class="font-medium text-gray-900 dark:text-gray-100">
                  {skillShort || skillAny.sc_name}
                </div>
              </div>
            </label>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Auto-select first (and only) skill mapping -->
    {/if}
    
    {#if selectedSkillMappingIndex >= 0 || work.skill_mappings.length === 1}
      {#key selectedSkillMappingIndex}
        {#if work.skill_mappings.length > 1}
          {#if selectedSkillMappingIndex >= 0}
            {@const skill = work.skill_mappings[selectedSkillMappingIndex]}
            {@const skillShort = getSkillShort(skill)}
            {@const individualSkills = getIndividualSkills(skill)}
            
            <div class="space-y-4">
              {#if individualSkills.length > 1}
                <!-- Multiple skills in combination -->
                <div class="border-l-4 border-blue-500 pl-4">
                  <h5 class="font-medium theme-text-primary mb-2">{skillShort || skill.sc_name}</h5>
                  <div class="space-y-3">
                    {#each individualSkills as individualSkill, skillIndex}
                      {@const currentSkillKey = `${individualSkill}-${skillIndex}`}
                      {@const selectedWorkerForThisSkill = selectedWorkers[currentSkillKey]}
                      <div>
                        <label 
                          for="worker-{skill.sc_name}-{individualSkill}-{skillIndex}" 
                          class="block text-sm font-medium theme-text-primary mb-1"
                        >
                          {individualSkill} Worker {skillIndex > 0 ? `(${skillIndex + 1})` : ''}
                        </label>
                        <select
                          id="worker-{skill.sc_name}-{individualSkill}-{skillIndex}"
                          class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={selectedWorkerForThisSkill?.emp_id || ''}
                          on:change={(e) => onWorkerChange(e, currentSkillKey)}
                        >
                          <option value="">Choose a worker for {individualSkill}...</option>
                          {#each availableWorkers as worker}
                            {@const currentSkillKey = `${individualSkill}-${skillIndex}`}
                            {@const isAlreadySelected = (() => {
                              // Filter out null/undefined entries and current skill slot
                              const otherSelectedWorkers = Object.entries(selectedWorkers)
                                .filter(([key, selectedWorker]) => 
                                  key !== currentSkillKey && 
                                  selectedWorker !== null && 
                                  selectedWorker !== undefined &&
                                  selectedWorker.emp_id
                                );
                              // Check if this worker is selected in any other skill slot
                              return otherSelectedWorkers.some(([_, selectedWorker]) => 
                                selectedWorker && selectedWorker.emp_id === worker.emp_id
                              );
                            })()}
                            {@const isAssignedToOtherPlan = workersAssignedToOtherPlans.has(worker.emp_id)}
                            {@const isBlocked = isAlreadySelected || isAssignedToOtherPlan}
                            <option value={worker.emp_id} disabled={isBlocked}>
                              {worker.emp_name} ({worker.skill_short}){isBlocked ? (isAssignedToOtherPlan ? ' - Already assigned to other work' : ' - Already assigned') : ''}
                            </option>
                          {/each}
                        </select>
                        {#if selectedWorkers[`${individualSkill}-${skillIndex}`]}
                          {@const selectedWorker = selectedWorkers[`${individualSkill}-${skillIndex}`]}
                          {#if selectedWorker}
                            <div class="mt-1 text-xs theme-text-secondary">
                              Selected: {selectedWorker.emp_name} ({selectedWorker.skill_short})
                            </div>
                          {/if}
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {:else}
                <!-- Single skill -->
                {@const workerKey = skillShort || skill.sc_name}
                {@const selectedWorkerForThisSkill = selectedWorkers[workerKey]}
                <div>
                  <label 
                    for="worker-{skill.sc_name}" 
                    class="block text-sm font-medium theme-text-primary mb-2"
                  >
                    {skillShort || skill.sc_name} Worker
                  </label>
                  <select
                    id="worker-{skill.sc_name}"
                    class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={selectedWorkerForThisSkill?.emp_id || ''}
                    on:change={(e) => onWorkerChange(e, workerKey)}
                  >
                    <option value="">Choose a worker for {skillShort || skill.sc_name}...</option>
                    {#each availableWorkers as worker}
                      <option value={worker.emp_id}>
                        {worker.emp_name} ({worker.skill_short})
                      </option>
                    {/each}
                  </select>
                  {#if selectedWorkers[skillShort || skill.sc_name]}
                    {@const selectedWorker = selectedWorkers[skillShort || skill.sc_name]}
                    {#if selectedWorker}
                      <div class="mt-1 text-xs theme-text-secondary">
                        Selected: {selectedWorker.emp_name} ({selectedWorker.skill_short})
                      </div>
                    {/if}
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        {:else}
          <!-- Case when there's only 1 skill mapping -->
          {@const skill = work.skill_mappings[0]}
          {@const skillShort = getSkillShort(skill)}
          {@const individualSkills = getIndividualSkills(skill)}
          
          <div class="space-y-4">
            {#if individualSkills.length > 1}
              <div class="border-l-4 border-blue-500 pl-4">
                <h5 class="font-medium theme-text-primary mb-2">{skillShort || skill.sc_name}</h5>
                <div class="space-y-3">
                  {#each individualSkills as individualSkill, skillIndex}
                    {@const currentSkillKey = `${individualSkill}-${skillIndex}`}
                    {@const selectedWorkerForThisSkill = selectedWorkers[currentSkillKey]}
                    <div>
                      <label 
                        for="worker-single-{individualSkill}-{skillIndex}" 
                        class="block text-sm font-medium theme-text-primary mb-1"
                      >
                        {individualSkill} Worker {skillIndex > 0 ? `(${skillIndex + 1})` : ''}
                      </label>
                      <select
                        id="worker-single-{individualSkill}-{skillIndex}"
                        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={selectedWorkerForThisSkill?.emp_id || ''}
                        on:change={(e) => onWorkerChange(e, currentSkillKey)}
                      >
                        <option value="">Choose a worker for {individualSkill}...</option>
                        {#each availableWorkers as worker}
                          {@const currentSkillKey = `${individualSkill}-${skillIndex}`}
                          {@const isAlreadySelected = (() => {
                              // Filter out null/undefined entries and current skill slot
                              const otherSelectedWorkers = Object.entries(selectedWorkers)
                                .filter(([key, selectedWorker]) => 
                                  key !== currentSkillKey && 
                                  selectedWorker !== null && 
                                  selectedWorker !== undefined &&
                                  selectedWorker.emp_id
                                );
                              // Check if this worker is selected in any other skill slot
                              return otherSelectedWorkers.some(([_, selectedWorker]) => 
                                selectedWorker && selectedWorker.emp_id === worker.emp_id
                              );
                            })()}
                          {@const isAssignedToOtherPlan = workersAssignedToOtherPlans.has(worker.emp_id)}
                          {@const isBlocked = isAlreadySelected || isAssignedToOtherPlan}
                          <option value={worker.emp_id} disabled={isBlocked}>
                            {worker.emp_name} ({worker.skill_short}){isBlocked ? (isAssignedToOtherPlan ? ' - Already assigned to other work' : ' - Already assigned') : ''}
                          </option>
                        {/each}
                      </select>
                      {#if selectedWorkers[`${individualSkill}-${skillIndex}`]}
                        {@const selectedWorker = selectedWorkers[`${individualSkill}-${skillIndex}`]}
                        {#if selectedWorker}
                          <div class="mt-1 text-xs theme-text-secondary">
                            Selected: {selectedWorker.emp_name} ({selectedWorker.skill_short})
                          </div>
                        {/if}
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              {@const workerKey = skillShort || skill.sc_name}
              {@const selectedWorkerForThisSkill = selectedWorkers[workerKey]}
              <div>
                <label 
                  for="worker-single-skill" 
                  class="block text-sm font-medium theme-text-primary mb-2"
                >
                  {skillShort || skill.sc_name} Worker
                </label>
                <select
                  id="worker-single-skill"
                  class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={selectedWorkerForThisSkill?.emp_id || ''}
                  on:change={(e) => onWorkerChange(e, workerKey)}
                >
                  <option value="">Choose a worker for {skillShort || skill.sc_name}...</option>
                  {#each availableWorkers as worker}
                    <option value={worker.emp_id}>
                      {worker.emp_name} ({worker.skill_short})
                    </option>
                  {/each}
                </select>
                {#if selectedWorkers[skillShort || skill.sc_name]}
                  {@const selectedWorker = selectedWorkers[skillShort || skill.sc_name]}
                  {#if selectedWorker}
                    <div class="mt-1 text-xs theme-text-secondary">
                      Selected: {selectedWorker.emp_name} ({selectedWorker.skill_short})
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      {/key}
    {/if}
  </div>
{:else}
  <!-- Fallback for works without specific skills -->
  <div>
    <label for="worker-select" class="block text-sm font-medium theme-text-primary mb-2">
      Select Worker
    </label>
    <select
      id="worker-select"
      class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      on:change={(e) => onWorkerChange(e, 'general')}
    >
      <option value="">Choose a worker...</option>
      {#each availableWorkers as worker}
        <option value={worker.emp_id}>
          {worker.emp_name} ({worker.skill_short})
        </option>
      {/each}
    </select>
  </div>
{/if}

