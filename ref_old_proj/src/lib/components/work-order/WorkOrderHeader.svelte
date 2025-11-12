<script lang="ts">
  export let period: string;
  export let onSidebarToggle: () => void;
  export let onPeriodClick: () => void;
</script>

<div class="flex items-center justify-between">
  <div class="text-2xl font-extrabold tracking-tight theme-text-primary flex items-center gap-2 transition-colors duration-200">
    <button 
      class="mr-2 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 focus:outline-none transition-colors duration-200" 
      on:click={onSidebarToggle} 
      aria-label="Show sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    Work Orders
  </div>
  <div class="flex items-center gap-4">
    <span class="theme-text-secondary font-medium transition-colors duration-200">Period:</span>
    <button 
      class="flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full shadow-sm hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors duration-200" 
      on:click={onPeriodClick}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
      </svg>
      <span>{period}</span>
    </button>
    <img src="/logo_kdy.png" alt="Company Logo" class="h-8 w-auto" />
  </div>
</div> 