<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';

  export let skillNames: string[] = [];
  export let skillShorts: string[] = [];
  export let selectedSkillName = '';
  export let selectedSkillShort = '';
  export let newSkillName = '';
  export let newSkillCode = '';
  export let useExistingSkills = true;
  export let ratePerHour = '';
  export let minSalary = '';
  export let maxSalary = '';
  export let wef = '';
  export let isActive = true;
  export let isEditMode = false;
  export let isLoading = false;
  export let onSave: () => void;
</script>

<div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border h-full">
  <h3 class="text-lg font-semibold theme-text-primary mb-6">
    {isEditMode ? 'Edit Skill' : 'Add New Skill'}
  </h3>
  
  <form on:submit|preventDefault={onSave} class="space-y-6">
    <!-- Skill Selection Toggle -->
    {#if !isEditMode}
      <fieldset>
        <legend class="block text-sm font-medium theme-text-primary mb-3">
          Skill Selection Method
        </legend>
        <div class="flex space-x-4">
          <label for="useExisting" class="flex items-center">
            <input
              id="useExisting"
              type="radio"
              bind:group={useExistingSkills}
              value={true}
              class="mr-2"
            />
            <span class="text-sm theme-text-primary">Use Existing Skills</span>
          </label>
          <label for="addNew" class="flex items-center">
            <input
              id="addNew"
              type="radio"
              bind:group={useExistingSkills}
              value={false}
              class="mr-2"
            />
            <span class="text-sm theme-text-primary">Add New Skills</span>
          </label>
        </div>
      </fieldset>
    {/if}

    <!-- Skill Name -->
    <div>
      <label for="skillName" class="block text-sm font-medium theme-text-primary mb-2">
        Skill Name *
      </label>
      {#if useExistingSkills || isEditMode}
        <select
          id="skillName"
          bind:value={selectedSkillName}
          class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
          disabled={isEditMode}
        >
          <option value="">Select a skill name</option>
          {#each skillNames as name}
            <option value={name}>{name}</option>
          {/each}
        </select>
      {:else}
        <input
          id="skillName"
          type="text"
          bind:value={newSkillName}
          class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter new skill name"
          required
        />
      {/if}
      <p class="mt-1 text-xs theme-text-secondary">
        {isEditMode ? 'Skill name cannot be changed in edit mode' : 'Skill name must be unique'}
      </p>
    </div>

    <!-- Skill Code -->
    <div>
      <label for="skillShort" class="block text-sm font-medium theme-text-primary mb-2">
        Skill Code *
      </label>
      {#if useExistingSkills || isEditMode}
        <select
          id="skillShort"
          bind:value={selectedSkillShort}
          class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
          disabled={isEditMode}
        >
          <option value="">Select a skill code</option>
          {#each skillShorts as short}
            <option value={short}>{short}</option>
          {/each}
        </select>
      {:else}
        <input
          id="skillShort"
          type="text"
          bind:value={newSkillCode}
          class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter new skill code"
          required
        />
      {/if}
      <p class="mt-1 text-xs theme-text-secondary">
        {isEditMode ? 'Skill code cannot be changed in edit mode' : 'Skill code must be unique'}
      </p>
    </div>

    <!-- Rate Per Hour -->
    <div>
      <label for="ratePerHour" class="block text-sm font-medium theme-text-primary mb-2">
        Rate Per Hour (₹) *
      </label>
      <input
        id="ratePerHour"
        type="number"
        bind:value={ratePerHour}
        min="0"
        step="0.01"
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Enter rate per hour (0 is acceptable)"
        required
      />
    </div>

    <!-- Min Salary -->
    <div>
      <label for="minSalary" class="block text-sm font-medium theme-text-primary mb-2">
        Minimum Salary (₹) *
      </label>
      <input
        id="minSalary"
        type="number"
        bind:value={minSalary}
        min="0"
        step="0.01"
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Enter minimum salary"
        required
      />
    </div>

    <!-- Max Salary -->
    <div>
      <label for="maxSalary" class="block text-sm font-medium theme-text-primary mb-2">
        Maximum Salary (₹) *
      </label>
      <input
        id="maxSalary"
        type="number"
        bind:value={maxSalary}
        min="0"
        step="0.01"
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Enter maximum salary"
        required
      />
    </div>

    <!-- WEF Date -->
    <div>
      <label for="wef" class="block text-sm font-medium theme-text-primary mb-2">
        WEF (With Effect From) *
      </label>
      <input
        id="wef"
        type="date"
        bind:value={wef}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required
      />
    </div>

    <!-- Status -->
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
        Select the status for this skill
      </p>
    </div>

    <!-- Submit Button -->
    <div class="flex justify-end">
      <Button
        variant="primary"
        size="lg"
        disabled={isLoading}
        on:click={onSave}
      >
        {#if isLoading}
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {isEditMode ? 'Updating...' : 'Saving...'}
        {:else}
          {isEditMode ? 'Update Skill Master' : 'Save Skill Master'}
        {/if}
      </Button>
    </div>
  </form>

  <!-- Help Section -->
  <div class="mt-8 pt-6 border-t theme-border">
    <h4 class="text-sm font-semibold theme-text-primary mb-3">How to use this form:</h4>
    <div class="space-y-2 text-xs theme-text-secondary">
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>Select a skill name and skill code from the dropdowns. These must be pre-defined in the Data Elements.</span>
      </div>
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>Enter the rate per hour, minimum salary, and maximum salary for the skill.</span>
      </div>
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>Set the WEF (With Effect From) date when this skill rate becomes effective.</span>
      </div>
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>Maximum salary must be greater than minimum salary.</span>
      </div>
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>WEF date can be a future date, but you'll be prompted to confirm.</span>
      </div>
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>Select Active or Inactive status for the skill.</span>
      </div>
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>All fields marked with * are required.</span>
      </div>
    </div>
  </div>
</div>

