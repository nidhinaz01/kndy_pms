<script lang="ts">
  import type { HolidayFormData } from '$lib/api/planning';

  export let showModal: boolean;
  export let onSave: (holiday: HolidayFormData) => void;
  export let onClose: () => void;

  let formData: HolidayFormData = {
    dt_day: 1,
    dt_month: 'January',
    dt_year: new Date().getFullYear(),
    dt_value: null,
    description: '',
    is_active: true
  };

  let isActive = true;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  function handleSubmit() {
    if (!formData.description.trim()) {
      alert('Please enter a description');
      return;
    }

    // Calculate dt_value from day, month, year
    const monthIndex = months.indexOf(formData.dt_month);
    if (monthIndex === -1) {
      alert('Invalid month selected');
      return;
    }

    // Validate date
    const date = new Date(formData.dt_year, monthIndex, formData.dt_day);
    
    // Check if date is valid (e.g., Feb 30 would be invalid)
    if (date.getDate() !== formData.dt_day || 
        date.getMonth() !== monthIndex || 
        date.getFullYear() !== formData.dt_year) {
      alert(`Invalid date: ${formData.dt_day} ${formData.dt_month} ${formData.dt_year} does not exist.`);
      return;
    }

    formData.dt_value = date.toISOString().split('T')[0];
    formData.is_active = isActive;

    onSave(formData);
    resetForm();
  }

  function resetForm() {
    formData = {
      dt_day: 1,
      dt_month: 'January',
      dt_year: new Date().getFullYear(),
      dt_value: null,
      description: '',
      is_active: true
    };
    isActive = true;
  }

  function handleClose() {
    resetForm();
    onClose();
  }
</script>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 transition-opacity duration-200">
    <div class="theme-bg-primary rounded-2xl shadow-2xl p-8 w-[32rem] animate-fade-in transition-colors duration-200">
      <div class="flex items-center justify-between mb-6">
        <div class="font-bold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Add Holiday
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
        <!-- Date Fields -->
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label for="day" class="block text-sm font-medium theme-text-primary mb-2">Day</label>
            <input
              type="number"
              id="day"
              bind:value={formData.dt_day}
              min="1"
              max="31"
              class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              required
            />
          </div>
          <div>
            <label for="month" class="block text-sm font-medium theme-text-primary mb-2">Month</label>
            <select
              id="month"
              bind:value={formData.dt_month}
              class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              required
            >
              {#each months as month}
                <option value={month}>{month}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="year" class="block text-sm font-medium theme-text-primary mb-2">Year</label>
            <select
              id="year"
              bind:value={formData.dt_year}
              class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
              required
            >
              {#each years as year}
                <option value={year}>{year}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Description -->
        <div>
          <label for="description" class="block text-sm font-medium theme-text-primary mb-2">Description</label>
          <textarea
            id="description"
            bind:value={formData.description}
            rows="3"
            placeholder="Enter holiday description..."
            class="w-full px-3 py-2 border theme-border rounded theme-bg-secondary theme-text-primary focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:outline-none"
            required
          ></textarea>
        </div>

        <!-- Status -->
        <div>
          <span class="block text-sm font-medium theme-text-primary mb-2">Status</span>
          <div class="space-y-2">
            <label class="flex items-center">
              <input
                type="radio"
                bind:group={isActive}
                value={true}
                class="border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span class="ml-2 text-sm theme-text-primary transition-colors duration-200">Active</span>
            </label>
            <label class="flex items-center">
              <input
                type="radio"
                bind:group={isActive}
                value={false}
                class="border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span class="ml-2 text-sm theme-text-primary transition-colors duration-200">Inactive</span>
            </label>
          </div>
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
            Save Holiday
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