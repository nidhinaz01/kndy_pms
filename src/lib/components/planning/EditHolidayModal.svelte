<script lang="ts">
  import type { Holiday } from '$lib/api/planning';

  export let showModal: boolean;
  export let holiday: Holiday | null;
  export let onSave: (id: number, isActive: boolean) => void;
  export let onClose: () => void;

  let isActive = false;

  $: if (holiday) {
    isActive = holiday.is_active;
  }

  function handleSubmit() {
    if (holiday) {
      onSave(holiday.id, isActive);
    }
  }

  function handleClose() {
    onClose();
  }
</script>

{#if showModal && holiday}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Holiday
        </div>
        <button 
          class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200" 
          on:click={handleClose} 
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <!-- Holiday Details (Read-only) -->
        <div class="space-y-4">
          <div>
            <span class="block text-sm font-medium theme-text-primary mb-2">Date</span>
            <div class="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded theme-text-primary">
              {holiday.dt_value ? new Date(holiday.dt_value).toLocaleDateString() : `${holiday.dt_day} ${holiday.dt_month} ${holiday.dt_year}`}
            </div>
          </div>
          
          <div>
            <span class="block text-sm font-medium theme-text-primary mb-2">Description</span>
            <div class="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded theme-text-primary">
              {holiday.description}
            </div>
          </div>
        </div>

        <!-- Status (Editable) -->
        <div>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={isActive}
              class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span class="ml-2 text-sm theme-text-primary transition-colors duration-200">Active</span>
          </label>
          <p class="text-xs theme-text-secondary mt-1">Toggle to activate or deactivate this holiday</p>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end gap-3 pt-4">
          <button
            type="button"
            class="px-4 py-2 bg-gray-500 text-white rounded-lg border-2 border-gray-500 shadow hover:bg-gray-600 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 active:bg-gray-700 active:border-gray-700 transition-all duration-200"
            on:click={handleClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg border-2 border-blue-500 shadow hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 active:bg-blue-700 active:border-blue-700 transition-all duration-200"
          >
            Update Status
          </button>
        </div>
      </form>
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