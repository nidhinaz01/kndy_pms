<script lang="ts">
  import { onMount } from 'svelte';
  import { formatDate } from '$lib/utils/formatDate';
  import type { Holiday } from '$lib/api/holidays';
  import Button from '$lib/components/common/Button.svelte';

  export let holidays: Holiday[] = [];
  export let isLoading = false;
  export let onEdit: (holiday: Holiday) => void;
  export let onDelete: (id: number, description: string) => void;

  let sortColumn: string = 'dt_value';
  let sortDirection: 'asc' | 'desc' = 'asc';
  let filteredHolidays: Holiday[] = [];

  $: {
    filteredHolidays = [...holidays].sort((a, b) => {
      let aValue: any = a[sortColumn as keyof Holiday];
      let bValue: any = b[sortColumn as keyof Holiday];

      if (sortColumn === 'dt_value') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function handleSort(column: string) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  function getSortIcon(column: string) {
    if (sortColumn !== column) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  }
</script>

<div class="theme-bg-primary rounded-lg shadow-lg border theme-border overflow-hidden">
  <div class="px-6 py-4 border-b theme-border">
    <h3 class="text-lg font-semibold theme-text-primary">Holiday List</h3>
  </div>

  {#if isLoading}
    <div class="p-8 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 theme-text-secondary">Loading holidays...</p>
    </div>
  {:else if filteredHolidays.length === 0}
    <div class="p-8 text-center">
      <p class="theme-text-secondary">No holidays found.</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="theme-bg-secondary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider cursor-pointer" on:click={() => handleSort('dt_value')}>
              Date {getSortIcon('dt_value')}
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider cursor-pointer" on:click={() => handleSort('description')}>
              Description {getSortIcon('description')}
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider cursor-pointer" on:click={() => handleSort('created_by')}>
              Created By {getSortIcon('created_by')}
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider cursor-pointer" on:click={() => handleSort('created_dt')}>
              Created Date {getSortIcon('created_dt')}
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider cursor-pointer" on:click={() => handleSort('modified_by')}>
              Modified By {getSortIcon('modified_by')}
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium theme-text-primary uppercase tracking-wider cursor-pointer" on:click={() => handleSort('modified_dt')}>
              Modified Date {getSortIcon('modified_dt')}
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium theme-text-primary uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="theme-bg-primary divide-y theme-border">
          {#each filteredHolidays as holiday}
            <tr class="hover:theme-bg-secondary transition-colors">
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {holiday.dt_value ? formatDate(holiday.dt_value) : `${holiday.dt_day} ${holiday.dt_month} ${holiday.dt_year}`}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {holiday.description}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {holiday.created_by}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {formatDate(holiday.created_dt)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {holiday.modified_by}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                {formatDate(holiday.modified_dt)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex justify-end space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    on:click={() => onEdit(holiday)}
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    on:click={() => onDelete(holiday.id, holiday.description)}
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div> 