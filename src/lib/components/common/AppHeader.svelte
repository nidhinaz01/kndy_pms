<script lang="ts">
  import Button from './Button.svelte';
  import { goto } from '$app/navigation';
  
  export let title: string;
  export let onSidebarToggle: () => void = () => {};
  export let showLogo = true;
  export let showImportButton = false;
  export let onImportClick: () => void = () => {};
  export let showSearch = false;
  export let searchValue = '';
  export let onSearchInput: ((value: string) => void) | null = null;
  export let searchPlaceholder = 'Search...';
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
  
  <div class="flex items-center gap-4 flex-1 justify-end">
    {#if showSearch}
      <div class="flex-1 max-w-md mx-4">
        <div class="relative">
          <input
            type="text"
            class="w-full px-4 py-2 pl-10 theme-bg-secondary theme-text-primary theme-border border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={searchPlaceholder}
            value={searchValue}
            on:input={(e) => onSearchInput && onSearchInput(e.currentTarget.value)}
          />
          <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 theme-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    {/if}
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
      <button
        on:click={() => goto('/dashboard')}
        class="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
        aria-label="Go to dashboard"
      >
        <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
      </button>
    {/if}
  </div>
</div> 