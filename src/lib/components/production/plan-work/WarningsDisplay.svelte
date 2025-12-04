<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  import type { PlanWorkWarnings } from '$lib/types/planWork';

  export let warnings: PlanWorkWarnings;
</script>

<!-- Alternative Skill Combination Conflict Warning -->
{#if warnings.hasAlternativePlanningConflict}
  <div class="theme-bg-red-50 dark:theme-bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
    <div class="flex items-start">
      <AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
      <div>
        <h4 class="font-medium text-red-800 dark:text-red-200">Alternative Combination Conflict</h4>
        <p class="text-sm text-red-700 dark:text-red-300 mt-1 whitespace-pre-line">
          {warnings.alternativeConflictDetails}
        </p>
      </div>
    </div>
  </div>
{/if}

<!-- Skill Mismatch Warning -->
{#if warnings.showSkillMismatchWarning}
  <div class="theme-bg-red-50 dark:theme-bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
    <div class="flex items-start">
      <AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
      <div>
        <h4 class="font-medium text-red-800 dark:text-red-200">Skill Mismatch Warning</h4>
        <p class="text-sm text-red-700 dark:text-red-300 mt-1">
          {warnings.skillMismatchDetails}
        </p>
      </div>
    </div>
  </div>
{/if}

<!-- Time Overlap Warning -->
{#if warnings.showTimeOverlapWarning}
  <div class="theme-bg-orange-50 dark:theme-bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
    <div class="flex items-start">
      <AlertTriangle class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-2 flex-shrink-0" />
      <div>
        <h4 class="font-medium text-orange-800 dark:text-orange-200">Time Overlap Warning</h4>
        <p class="text-sm text-orange-700 dark:text-orange-300 mt-1">
          {warnings.timeOverlapDetails}
        </p>
      </div>
    </div>
  </div>
{/if}

<!-- Time Excess Warning -->
{#if warnings.showTimeExcessWarning}
  <div class="theme-bg-yellow-50 dark:theme-bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
    <div class="flex items-start">
      <AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
      <div>
        <h4 class="font-medium text-yellow-800 dark:text-yellow-200">Time Excess Warning</h4>
        <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1 whitespace-pre-line">
          {warnings.timeExcessDetails}
        </p>
      </div>
    </div>
  </div>
{/if}

