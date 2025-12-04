<script lang="ts">
  export let isActive = true;
</script>

<div>
  <div class="block text-sm font-medium theme-text-primary mb-2">
    Status *
  </div>
  <div class="space-y-2" role="radiogroup" aria-labelledby="status-label">
    <label class="flex items-center space-x-2">
      <input
        id="status-active"
        type="radio"
        bind:group={isActive}
        value={true}
        class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
      />
      <span class="text-sm theme-text-primary">Active</span>
    </label>
    <label class="flex items-center space-x-2">
      <input
        id="status-inactive"
        type="radio"
        bind:group={isActive}
        value={false}
        class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
      />
      <span class="text-sm theme-text-primary">Inactive</span>
    </label>
  </div>
  <p class="mt-1 text-xs theme-text-secondary">
    Select the status for this employee
  </p>
</div>

