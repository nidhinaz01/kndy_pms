<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  export let onSidebarToggle: () => void;
  export let onAddItem: () => void;
  export let onImportClick: () => void;
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
    Work-Skill Mapping
  </div>
  <div class="flex items-center gap-4">
    <Button variant="secondary" size="md" on:click={onImportClick}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      Import
    </Button>
    <Button variant="primary" size="md" on:click={onAddItem}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Add Mapping
    </Button>
    <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
  </div>
</div> 