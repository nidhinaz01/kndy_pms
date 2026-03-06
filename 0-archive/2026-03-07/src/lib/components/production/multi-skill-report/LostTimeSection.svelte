<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  import LostTimeBreakdown from '../LostTimeBreakdown.svelte';
  import { formatMinutes } from '$lib/utils/multiSkillReportUtils';
  import type { MultiSkillReportFormData } from '$lib/types/multiSkillReport';
  import type { LostTimeReason } from '$lib/api/lostTimeReasons';

  export let formData: MultiSkillReportFormData;
  export let lostTimeReasons: LostTimeReason[] = [];
  export let averageEmployeeSalary: number = 0;
  export let standardTimeMinutes: number = 0;
  export let actualTimeMinutes: number = 0;
  export let showLostTimeSection: boolean = false;
  export let workers: Array<{ emp_id: string; emp_name: string; salary: number }> = [];
  export let onBreakdownChange: (event: CustomEvent) => void = () => {};
  export let onCommentsChange: (value: string) => void = () => {};
</script>

<div class="theme-bg-secondary rounded-lg p-4 border-2 border-blue-300 dark:border-blue-600">
  <h4 class="font-medium theme-text-primary mb-3">Time Summary</h4>
  <div class="grid grid-cols-2 gap-4 text-sm">
    <div>
      <span class="theme-text-secondary">Standard Time:</span>
      <span class="theme-text-primary font-medium ml-2">{formatMinutes(standardTimeMinutes)}</span>
    </div>
    <div>
      <span class="theme-text-secondary">Actual Time:</span>
      <span class="theme-text-primary font-medium ml-2">{formatMinutes(actualTimeMinutes)}</span>
    </div>
    <div>
      <span class="theme-text-secondary">Lost Time:</span>
      <span class="theme-text-primary font-medium ml-2">{formatMinutes(formData.ltMinutes)}</span>
    </div>
    <div>
      <span class="theme-text-secondary">Status:</span>
      <span class="theme-text-primary font-medium ml-2">
        {formData.completionStatus === 'C' ? 'Completed' : 'Not Completed'}
      </span>
    </div>
  </div>
</div>

{#if showLostTimeSection}
  <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
    <div class="flex items-start">
      <AlertTriangle class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-2 flex-shrink-0" />
      <div class="flex-1">
        <h4 class="font-medium text-orange-800 dark:text-orange-200 mb-3">Lost Time Detected</h4>
        
        <div class="space-y-4">
          <div>
            <div class="block text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
              Total Lost Time
            </div>
            <div class="text-sm text-orange-700 dark:text-orange-300">
              {formatMinutes(formData.ltMinutes)} (Auto-calculated)
            </div>
          </div>
          
          <LostTimeBreakdown 
            {lostTimeReasons}
            totalLostTimeMinutes={formData.ltMinutes}
            employeeSalary={averageEmployeeSalary}
            {workers}
            on:totalsChanged={onBreakdownChange}
          />
          
          <div>
            <label for="lt-comments" class="block text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
              Comments
            </label>
            <textarea
              id="lt-comments"
              value={formData.ltComments}
              on:input={(e) => onCommentsChange(e.currentTarget.value)}
              rows="2"
              class="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Additional comments about the lost time..."
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

