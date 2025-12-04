<script lang="ts">
  import EmployeeFormStatusSection from './EmployeeFormStatusSection.svelte';
  import EmployeeFormSubmitButton from './EmployeeFormSubmitButton.svelte';
  import EmployeeFormHelpSection from './EmployeeFormHelpSection.svelte';

  export let employeeCategories: string[] = [];
  export let skillShorts: string[] = [];
  export let stages: string[] = [];
  export let shifts: string[] = [];
  export let empId = '';
  export let selectedEmpCategory = '';
  export let empName = '';
  export let selectedSkillShort = '';
  export let empDoj = '';
  export let lastAppraisalDate = '';
  export let basicDa = '';
  export let salary = '';
  export let selectedStage = '';
  export let selectedShiftCode = '';
  export let isActive = true;
  export let isEditMode = false;
  export let isLoading = false;
  export let onSave: () => void;
</script>

<div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border h-full">
  <h3 class="text-lg font-semibold theme-text-primary mb-6">
    {isEditMode ? 'Edit Employee' : 'Add New Employee'}
  </h3>
  
  <form on:submit|preventDefault={onSave} class="space-y-6">
    <div>
      <label for="empId" class="block text-sm font-medium theme-text-primary mb-2">
        Employee ID *
      </label>
      <input
        id="empId"
        type="text"
        bind:value={empId}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Enter employee ID"
        required
        disabled={isEditMode}
      />
      <p class="mt-1 text-xs theme-text-secondary">
        {isEditMode ? 'Employee ID cannot be changed in edit mode' : 'Employee ID must be unique'}
      </p>
    </div>
    <div>
      <label for="empCategory" class="block text-sm font-medium theme-text-primary mb-2">
        Employee Category *
      </label>
      <select
        id="empCategory"
        bind:value={selectedEmpCategory}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required
      >
        <option value="">Select employee category</option>
        {#each employeeCategories as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
    </div>

    <!-- Employee Name -->
    <div>
      <label for="empName" class="block text-sm font-medium theme-text-primary mb-2">
        Employee Name *
      </label>
      <input
        id="empName"
        type="text"
        bind:value={empName}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Enter employee name"
        required
      />
    </div>

    <!-- Skill -->
    <div>
      <label for="skillShort" class="block text-sm font-medium theme-text-primary mb-2">
        Skill *
      </label>
      <select
        id="skillShort"
        bind:value={selectedSkillShort}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required
      >
        <option value="">Select skill</option>
        {#each skillShorts as skill}
          <option value={skill}>{skill}</option>
        {/each}
      </select>
    </div>

    <!-- Date of Joining -->
    <div>
      <label for="empDoj" class="block text-sm font-medium theme-text-primary mb-2">
        Date of Joining *
      </label>
      <input
        id="empDoj"
        type="date"
        bind:value={empDoj}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required
      />
    </div>

    <!-- Last Appraisal Date -->
    <div>
      <label for="lastAppraisalDate" class="block text-sm font-medium theme-text-primary mb-2">
        Last Appraisal Date *
      </label>
      <input
        id="lastAppraisalDate"
        type="date"
        bind:value={lastAppraisalDate}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required
      />
    </div>

    <!-- Basic DA -->
    <div>
      <label for="basicDa" class="block text-sm font-medium theme-text-primary mb-2">
        Basic DA (₹) *
      </label>
      <input
        id="basicDa"
        type="number"
        bind:value={basicDa}
        min="0"
        step="0.01"
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Enter basic DA"
        required
      />
    </div>

    <!-- Salary -->
    <div>
      <label for="salary" class="block text-sm font-medium theme-text-primary mb-2">
        Salary (₹) *
      </label>
      <input
        id="salary"
        type="number"
        bind:value={salary}
        min="0"
        step="0.01"
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Enter salary"
        required
      />
    </div>

    <!-- Stage -->
    <div>
      <label for="stage" class="block text-sm font-medium theme-text-primary mb-2">
        Stage *
      </label>
      <select
        id="stage"
        bind:value={selectedStage}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required
      >
        <option value="">Select stage</option>
        {#each stages as stage}
          <option value={stage}>{stage}</option>
        {/each}
      </select>
      <p class="mt-1 text-xs theme-text-secondary">
        Select the employee stage
      </p>
    </div>

    <!-- Shift Code -->
    <div>
      <label for="shiftCode" class="block text-sm font-medium theme-text-primary mb-2">
        Shift Code *
      </label>
      <select
        id="shiftCode"
        bind:value={selectedShiftCode}
        class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required
      >
        <option value="">Select shift code</option>
        {#each shifts as shift}
          <option value={shift}>{shift}</option>
        {/each}
      </select>
      <p class="mt-1 text-xs theme-text-secondary">
        Select the shift code for this employee
      </p>
    </div>

    <!-- Status -->
    <EmployeeFormStatusSection bind:isActive />

    <!-- Submit Button -->
    <EmployeeFormSubmitButton {isLoading} {isEditMode} {onSave} />
  </form>

  <!-- Help Section -->
  <EmployeeFormHelpSection />
</div>