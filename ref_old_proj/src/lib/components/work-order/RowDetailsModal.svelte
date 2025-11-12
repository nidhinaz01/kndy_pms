<script lang="ts">
  import { formatDate } from '$lib/utils/formatDate';
  
  export let selectedRow: any;
  export let onClose: () => void;
</script>

{#if selectedRow}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[28rem] animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-4">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 4h6a2 2 0 002-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          Order Details
        </div>
        <button 
          class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200" 
          on:click={onClose} 
          aria-label="Close details modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="theme-bg-tertiary rounded p-4 text-sm transition-colors duration-200">
        <div class="mb-2">
          <span class="font-semibold theme-text-secondary transition-colors duration-200">ID:</span> 
          <span class="theme-text-primary transition-colors duration-200">{selectedRow.id}</span>
        </div>
        <div class="mb-2">
          <span class="font-semibold theme-text-secondary transition-colors duration-200">Name:</span> 
          <span class="theme-text-primary transition-colors duration-200">{selectedRow.name}</span>
        </div>
        <div class="mb-2">
          <span class="font-semibold theme-text-secondary transition-colors duration-200">Type:</span> 
          <span class="theme-text-primary transition-colors duration-200">{selectedRow.type}</span>
        </div>
        <div class="mb-2">
          <span class="font-semibold theme-text-secondary transition-colors duration-200">Date:</span> 
          <span class="theme-text-primary transition-colors duration-200">{formatDate(selectedRow.date)}</span>
        </div>
        <div class="mb-2">
          <span class="font-semibold theme-text-secondary transition-colors duration-200">Status:</span> 
          <span class="theme-text-primary transition-colors duration-200">{selectedRow.status}</span>
        </div>
        <div class="mb-2">
          <span class="font-semibold theme-text-secondary transition-colors duration-200">Quantity:</span> 
          <span class="theme-text-primary transition-colors duration-200">{selectedRow.quantity}</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease;
  }
</style> 