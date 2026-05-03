<script lang="ts">
  import type { PlanningSlotDeviation } from '$lib/types/planWork';

  /** Stable id suffix for label/textarea (e.g. worker slot key). */
  export let idSuffix: string = 'slot';
  export let deviation: PlanningSlotDeviation | undefined;
  export let onDeviationChange: (next: PlanningSlotDeviation | null) => void = () => {};

  function toggleNoWorker(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      onDeviationChange({ noWorker: true, reason: deviation?.reason?.trim() || '' });
    } else {
      onDeviationChange(null);
    }
  }

  function setReason(e: Event) {
    const reason = (e.target as HTMLTextAreaElement).value;
    onDeviationChange({ noWorker: true, reason });
  }
</script>

<div class="mt-2 space-y-2 rounded-md border border-amber-200/80 bg-amber-50/50 p-2 dark:border-amber-800/60 dark:bg-amber-950/30">
  <label class="flex cursor-pointer items-start gap-2 text-sm theme-text-primary">
    <input
      type="checkbox"
      class="mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700"
      checked={!!deviation?.noWorker}
      on:change={toggleNoWorker}
    />
    <span>No worker available — record a deviation (requires reason)</span>
  </label>
  {#if deviation?.noWorker}
    <div>
      <label class="mb-1 block text-xs font-medium theme-text-secondary" for="nw-reason-{idSuffix}">
        Reason <span class="text-red-500">*</span>
      </label>
      <textarea
        id="nw-reason-{idSuffix}"
        class="w-full resize-none rounded-lg border theme-border bg-white px-2 py-1.5 text-sm theme-text-primary focus:border-transparent focus:ring-2 focus:ring-amber-500 dark:bg-gray-900"
        rows="2"
        placeholder="Why is no one available for this competency?"
        value={deviation.reason}
        on:input={setReason}
      ></textarea>
    </div>
  {/if}
</div>
