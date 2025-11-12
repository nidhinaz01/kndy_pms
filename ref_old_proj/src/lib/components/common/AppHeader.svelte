<script lang="ts">
  export let title: string;
  export let onSidebarToggle: () => void = () => {};
  export let showLogo = true;
</script>

<div class="flex items-center justify-between p-4 border-b theme-border">
  <div class="text-2xl font-extrabold tracking-tight theme-text-primary flex items-center gap-2 transition-colors duration-200">
    <button 
      class="mr-2 p-1 rounded hover:bg-blue-100 focus:outline-none transition-colors duration-200" 
      on:click={onSidebarToggle} 
      aria-label="Show sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    {title}
  </div>
  
  {#if showLogo}
    <div class="flex items-center">
      <img src="/logo_kdy.png" alt="Company Logo" class="h-8 w-auto" />
    </div>
  {/if}
</div> 