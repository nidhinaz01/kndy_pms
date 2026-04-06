<script lang="ts">
  import type { ShiftInfo } from '$lib/types/planWork';
  import type { RowTimeOverride } from '$lib/types/planWork';
  import { generateTimeSlots } from '$lib/utils/planWorkUtils';

  /** Stable key for this row (e.g. US-0, trainee-1). */
  export let rowKey: string;
  export let shiftInfo: ShiftInfo | null = null;
  export let override: RowTimeOverride | undefined = undefined;
  export let globalFromTime: string = '';
  export let globalToTime: string = '';
  /** `null` clears custom override for this row. */
  export let onChange: (rowKey: string, next: RowTimeOverride | null) => void = () => {};

  $: useCustom = override?.useCustom === true;
  $: timeSlots =
    shiftInfo?.hr_shift_master?.start_time && shiftInfo?.hr_shift_master?.end_time
      ? generateTimeSlots(shiftInfo.hr_shift_master.start_time, shiftInfo.hr_shift_master.end_time)
      : [];

  $: effectiveFrom = useCustom && override?.fromTime ? override.fromTime : globalFromTime;
  $: effectiveTo = useCustom && override?.toTime ? override.toTime : globalToTime;

  function toggle(e: Event) {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    if (checked) {
      onChange(rowKey, {
        useCustom: true,
        fromTime: globalFromTime || '',
        toTime: globalToTime || ''
      });
    } else {
      onChange(rowKey, null);
    }
  }

  function updateFrom(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    onChange(rowKey, {
      useCustom: true,
      fromTime: v,
      toTime: effectiveTo || globalToTime
    });
  }

  function updateTo(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    onChange(rowKey, {
      useCustom: true,
      fromTime: effectiveFrom || globalFromTime,
      toTime: v
    });
  }
</script>

<div class="mt-2 pl-2 border-l-2 border-dashed border-gray-300 dark:border-gray-600">
  <label class="flex items-center gap-2 text-sm theme-text-secondary cursor-pointer">
    <input
      type="checkbox"
      checked={useCustom}
      on:change={toggle}
      class="rounded border-gray-300 dark:border-gray-600"
    />
    <span>Custom from/to times for this assignment (optional)</span>
  </label>
  {#if useCustom}
    {#if timeSlots.length === 0}
      <p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
        Shift times not loaded; set times in Step 1 or reload the modal.
      </p>
    {:else}
      <div class="grid grid-cols-2 gap-2 mt-2">
        <div>
          <label class="block text-xs font-medium theme-text-primary mb-1" for="custom-from-{rowKey}">From time</label>
          <select
            id="custom-from-{rowKey}"
            class="w-full px-2 py-1.5 text-sm border theme-border rounded-lg theme-bg-primary theme-text-primary"
            value={effectiveFrom}
            on:change={updateFrom}
          >
            {#each timeSlots as slot}
              <option value={slot.value}>{slot.display}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium theme-text-primary mb-1" for="custom-to-{rowKey}">To time</label>
          <select
            id="custom-to-{rowKey}"
            class="w-full px-2 py-1.5 text-sm border theme-border rounded-lg theme-bg-primary theme-text-primary"
            value={effectiveTo}
            on:change={updateTo}
          >
            {#each timeSlots as slot}
              <option value={slot.value}>{slot.display}</option>
            {/each}
          </select>
        </div>
      </div>
    {/if}
  {/if}
</div>
