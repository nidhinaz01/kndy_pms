<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import MonthNavigator from './MonthNavigator.svelte';
  
  export let onSidebarToggle: () => void;
  export let onAddItem: () => void;
  export let currentDate: Date = new Date();
  export let onMonthChanged: (event: CustomEvent<Date>) => void;
</script>

<div class="flex items-center justify-between theme-bg-primary rounded-t-xl shadow py-4 px-6">
  <div class="text-2xl font-extrabold tracking-tight theme-text-primary flex items-center gap-2 transition-colors duration-200">
    <button 
      class="mr-2 p-1 rounded hover:theme-bg-tertiary focus:outline-none transition-colors duration-200" 
      on:click={onSidebarToggle} 
      aria-label="Show sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    Daily Shift Schedule
  </div>
  
  <div class="flex items-center gap-4">
    <MonthNavigator 
      {currentDate}
      on:monthChanged={onMonthChanged}
    />
    <Button variant="primary" size="md" on:click={onAddItem}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Add Schedule
    </Button>
    <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
  </div>
</div> 