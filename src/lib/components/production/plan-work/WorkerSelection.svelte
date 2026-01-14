<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import type { Worker, SelectedWorker } from '$lib/types/planWork';
  import { getSkillShort, getIndividualSkills } from '$lib/utils/planWorkUtils';

  export let work: any = null;
  export let availableWorkers: Worker[] = [];
  export let selectedWorkers: { [skill: string]: SelectedWorker | null } = {};
  export let selectedTrainees: SelectedWorker[] = [];
  export let traineeDeviationReason: string = '';
  export let selectedSkillMappingIndex: number = -1;
  export let selectedDate: string = '';
  export let fromTime: string = '';
  export let toTime: string = '';
  export let onWorkerChange: (event: Event, skillKey: string) => void = () => {};
  export let onTraineeAdd: (trainee: SelectedWorker) => void = () => {};
  export let onTraineeRemove: (index: number) => void = () => {};
  export let onTraineeReasonChange: (reason: string) => void = () => {};
  export let onSkillMappingChange: (index: number) => void = () => {};
  export let excludePlanIds: number[] = []; // Plan IDs to exclude from conflict checks (for edit mode)

  // Track which workers are already assigned to other work plans at the same time
  let workersAssignedToOtherPlans: Set<string> = new Set();
  
  // Trainee selection state
  let showTraineeSelector = false;
  let availableTrainees: Worker[] = [];
  
  // Filter trainees from available workers
  $: availableTrainees = availableWorkers.filter(w => w.skill_short === 'T');
  
  // Check if max trainees reached
  $: canAddTrainee = selectedTrainees.length < 2;

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

<!-- Trainee Selection Section -->
<div class="mt-6 pt-6 border-t theme-border">
  <div class="flex items-center justify-between mb-3">
    <h4 class="font-medium theme-text-primary">Additional Trainees (Optional)</h4>
    {#if canAddTrainee}
      <button
        type="button"
        on:click={() => showTraineeSelector = !showTraineeSelector}
        class="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
      >
        + Add Trainee
      </button>
    {:else}
      <span class="text-sm theme-text-secondary">Maximum 2 trainees</span>
    {/if}
  </div>
  
  {#if showTraineeSelector && canAddTrainee}
    <div class="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border theme-border">
      <label class="block text-sm font-medium theme-text-primary mb-2">
        Select Trainee
      </label>
      <select
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        on:change={(e) => {
          const traineeId = (e.target as HTMLSelectElement).value;
          if (traineeId) {
            const trainee = availableTrainees.find(t => t.emp_id === traineeId);
            if (trainee) {
              // Check if trainee is already selected
              const isAlreadySelected = selectedTrainees.some(t => t.emp_id === traineeId);
              if (!isAlreadySelected) {
                onTraineeAdd({
                  emp_id: trainee.emp_id,
                  emp_name: trainee.emp_name,
                  skill_short: trainee.skill_short
                });
                showTraineeSelector = false;
                (e.target as HTMLSelectElement).value = '';
              } else {
                alert('This trainee is already selected');
              }
            }
          }
        }}
      >
        <option value="">Choose a trainee...</option>
        {#each availableTrainees as trainee}
          {@const isAlreadySelected = selectedTrainees.some(t => t.emp_id === trainee.emp_id)}
          <option value={trainee.emp_id} disabled={isAlreadySelected}>
            {trainee.emp_name} {isAlreadySelected ? '(Already selected)' : ''}
          </option>
        {/each}
      </select>
      <button
        type="button"
        on:click={() => showTraineeSelector = false}
        class="mt-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        Cancel
      </button>
    </div>
  {/if}
  
  {#if selectedTrainees.length > 0}
    <!-- Warning Indicator -->
    <div class="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div class="flex items-start">
        <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Trainees Selected: This will be recorded as a deviation
          </p>
          <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            {selectedTrainees.length} trainee{selectedTrainees.length > 1 ? 's' : ''} selected
          </p>
        </div>
      </div>
    </div>
    
    <!-- Selected Trainees List -->
    <div class="space-y-2 mb-3">
      {#each selectedTrainees as trainee, index}
        <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border theme-border">
          <div class="flex items-center">
            <span class="text-sm font-medium theme-text-primary mr-2">
              {trainee.emp_name}
            </span>
            <span class="text-xs theme-text-secondary">({trainee.skill_short})</span>
          </div>
          <button
            type="button"
            on:click={() => onTraineeRemove(index)}
            class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
          >
            Remove
          </button>
        </div>
      {/each}
    </div>
    
    <!-- Deviation Reason Input -->
    <div>
      <label class="block text-sm font-medium theme-text-primary mb-2">
        Deviation Reason <span class="text-red-500">*</span>
      </label>
      <textarea
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        rows="3"
        placeholder="Enter reason for adding trainees..."
        value={traineeDeviationReason}
        on:input={(e) => onTraineeReasonChange((e.target as HTMLTextAreaElement).value)}
      ></textarea>
      {#if selectedTrainees.length > 0 && !traineeDeviationReason.trim()}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">
          Please provide a reason for adding trainees
        </p>
      {/if}
    </div>
  {/if}
</div>
