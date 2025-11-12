<script lang="ts">
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/theme';
  import { fetchEmployees, deleteEmployee, getUsernameFromEmail } from '$lib/api/employee';
  import { formatDate, formatDateDDMMMYYYY } from '$lib/utils/formatDate';

  export let refreshTrigger = 0;
  export let onEdit: (employee: any) => void = () => {};

  let employees: any[] = [];
  let isLoading = true;
  let error = '';

  async function loadEmployees() {
    try {
      isLoading = true;
      error = '';
      const rawEmployees = await fetchEmployees();
      
      // Convert emails to usernames for display
      employees = await Promise.all(
        rawEmployees.map(async (employee) => {
          // Check if modified_by looks like an email
          if (employee.modified_by && employee.modified_by.includes('@')) {
            const username = await getUsernameFromEmail(employee.modified_by);
            return { ...employee, modified_by: username };
          }
          return employee;
        })
      );
    } catch (err) {
      console.error('Error loading employees:', err);
      error = 'Failed to load employees';
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete(id: number, empName: string) {
    if (!confirm(`Are you sure you want to delete "${empName}"?`)) {
      return;
    }

    try {
      await deleteEmployee(id);
      await loadEmployees();
    } catch (err) {
      console.error('Error deleting employee:', err);
      alert('Failed to delete employee');
    }
  }

  $: if (refreshTrigger > 0) {
    loadEmployees();
  }

  onMount(() => {
    loadEmployees();
  });
</script>

<div class="theme-bg-primary shadow rounded-lg overflow-hidden">
  <div class="px-6 py-4 border-b theme-border">
    <h3 class="text-lg font-semibold theme-text-primary">Employee Records</h3>
  </div>

  {#if isLoading}
    <div class="p-6 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 theme-text-secondary">Loading employees...</p>
    </div>
  {:else if error}
    <div class="p-6 text-center">
      <p class="text-red-600">{error}</p>
    </div>
  {:else if employees.length === 0}
    <div class="p-6 text-center">
      <p class="theme-text-tertiary">No employee records found</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y theme-border">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Employee ID
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Category
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Name
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Skill Code
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              DOJ
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Last Appraisal
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Basic DA
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Salary
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Stage
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Modified By
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Modified Date
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y theme-border">
          {#each employees as employee}
            <tr class="hover:theme-bg-tertiary">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                {employee.emp_id}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {employee.emp_cat}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {employee.emp_name}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {employee.skill_short}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {formatDateDDMMMYYYY(employee.emp_doj)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {formatDateDDMMMYYYY(employee.last_appraisal_date)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                ₹{employee.basic_da.toLocaleString()}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                ₹{employee.salary.toLocaleString()}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {employee.stage}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {employee.modified_by}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {formatDate(employee.modified_dt)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                  <button
                    on:click={() => onEdit(employee)}
                    class="text-blue-600 hover:text-blue-900"
                    title="Edit employee"
                    aria-label="Edit employee"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    on:click={() => handleDelete(employee.id, employee.emp_name)}
                    class="text-red-600 hover:text-red-900"
                    title="Delete employee"
                    aria-label="Delete employee"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div> 