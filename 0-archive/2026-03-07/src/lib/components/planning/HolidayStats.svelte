<script lang="ts">
  import type { HolidayStats } from '$lib/api/planning';

  export let stats: HolidayStats;
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
  <!-- Total Holidays -->
  <div class="theme-bg-primary p-4 rounded-xl shadow transition-colors duration-200">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm theme-text-secondary transition-colors duration-200">Total Holidays</p>
        <p class="text-2xl font-bold theme-text-primary transition-colors duration-200">{stats.total}</p>
      </div>
      <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  </div>

  <!-- Active Holidays -->
  <div class="theme-bg-primary p-4 rounded-xl shadow transition-colors duration-200">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm theme-text-secondary transition-colors duration-200">Active</p>
        <p class="text-2xl font-bold text-green-600 dark:text-green-400 transition-colors duration-200">{stats.active}</p>
      </div>
      <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>
  </div>

  <!-- Inactive Holidays -->
  <div class="theme-bg-primary p-4 rounded-xl shadow transition-colors duration-200">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm theme-text-secondary transition-colors duration-200">Inactive</p>
        <p class="text-2xl font-bold text-red-600 dark:text-red-400 transition-colors duration-200">{stats.inactive}</p>
      </div>
      <div class="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>
  </div>

</div>

 