<script lang="ts">
  import Button from './Button.svelte';
  
  export let title: string;
  export let onSidebarToggle: () => void = () => {};
  export let showLogo = true;
  export let showImportButton = false;
  export let onImportClick: () => void = () => {};
</script>

<div class="flex items-center justify-between p-4 border-b theme-border theme-bg-primary transition-colors duration-200">
  <div class="text-2xl font-extrabold tracking-tight theme-text-primary flex items-center gap-2 transition-colors duration-200">
    <button 
      class="mr-2 p-1 rounded hover:theme-bg-secondary focus:outline-none transition-colors duration-200" 
      on:click={onSidebarToggle} 
      aria-label="Show sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    {title}
  </div>
  
  <div class="flex items-center gap-4">
    {#if showImportButton}
      <Button
        variant="primary"
        size="md"
        on:click={onImportClick}
      >
        Import Data
      </Button>
    {/if}
    {#if showLogo}
      <div class="flex items-center">
        <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
      </div>
    {/if}
  </div>
</div> 