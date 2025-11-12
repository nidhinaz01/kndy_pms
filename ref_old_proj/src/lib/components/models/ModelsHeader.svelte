<script lang="ts">
  export let onSidebarToggle: () => void;
  export let onAddModel: () => void;
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
    Models
  </div>
  <div class="flex items-center gap-4">
    <button 
      class="px-4 py-2 bg-green-500 text-white rounded-full shadow hover:bg-green-600 flex items-center gap-2 transition-colors duration-200" 
      on:click={onAddModel}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Add Model
    </button>
    <img src="/logo_kdy.png" alt="Company Logo" class="h-8 w-auto" />
  </div>
</div> 