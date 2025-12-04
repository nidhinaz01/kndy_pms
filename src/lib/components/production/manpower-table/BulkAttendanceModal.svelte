<script lang="ts">
  import Button from '$lib/components/common/Button.svelte';
  import { Users, X } from 'lucide-svelte';

  export let showModal: boolean = false;
  export let selectedCount: number = 0;
  export let selectedDate: string = '';
  export let bulkAttendanceStatus: 'present' | 'absent' = 'present';
  export let bulkNotes: string = '';
  export let isSubmitting: boolean = false;
  export let onStatusChange: (status: 'present' | 'absent') => void = () => {};
  export let onNotesChange: (notes: string) => void = () => {};
  export let onSubmit: () => void = () => {};
  export let onClose: () => void = () => {};
</script>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-1000 flex items-center justify-center" on:click={onClose}>
    <div class="theme-bg-primary theme-border rounded-lg shadow-lg p-5 min-w-[500px] max-w-[600px]" on:click|stopPropagation>
      <div class="flex items-center mb-5">
        <div class="bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center mr-4">
          <Users class="text-white text-xl" />
        </div>
        <div>
          <h3 class="theme-text-primary text-lg font-semibold m-0">Bulk Attendance Marking</h3>
          <p class="theme-text-secondary text-sm mt-1 m-0">
            Mark attendance for {selectedCount} selected employee{selectedCount > 1 ? 's' : ''}
          </p>
        </div>
        <button on:click={onClose} class="ml-auto theme-text-secondary hover:theme-text-primary">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="theme-bg-secondary theme-border rounded-lg p-4 mb-5">
        <p class="theme-text-primary text-sm m-1">
          <strong>Date:</strong> {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </p>
        <p class="theme-text-primary text-sm m-1">
          <strong>Selected Employees:</strong> {selectedCount}
        </p>
      </div>

      <div class="mb-5">
        <fieldset>
          <legend class="theme-text-primary mb-2 font-medium">Attendance Status:</legend>
          <div>
            <label class="flex items-center mb-2">
              <input 
                type="radio" 
                checked={bulkAttendanceStatus === 'present'}
                on:change={() => onStatusChange('present')}
                class="mr-2"
              />
              <span class="theme-text-primary">Present</span>
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                checked={bulkAttendanceStatus === 'absent'}
                on:change={() => onStatusChange('absent')}
                class="mr-2"
              />
              <span class="theme-text-primary">Absent</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div class="mb-5">
        <label for="bulk-notes" class="block text-sm font-medium theme-text-primary mb-2">
          Notes (Optional):
        </label>
        <textarea
          id="bulk-notes"
          value={bulkNotes}
          on:input={(e) => onNotesChange(e.currentTarget.value)}
          placeholder="Add any notes about this attendance marking..."
          class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows="3"
        />
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="secondary" on:click={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" on:click={onSubmit} disabled={isSubmitting || selectedCount === 0}>
          {isSubmitting ? 'Submitting...' : 'Mark Attendance'}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.z-1000) {
    z-index: 1000;
  }
</style>

