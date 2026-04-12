<script lang="ts">
  import { ArrowRight, UserCheck, Lock, Map, ClipboardList } from 'lucide-svelte';
</script>

<div
  class="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1 text-[11px] sm:text-xs theme-text-secondary"
  aria-label="Key for row action icons"
>
  <span class="inline-flex items-center gap-1 whitespace-nowrap" title="Reassign to another stage">
    <ArrowRight class="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
    <span>Reassign</span>
  </span>
  <span class="select-none text-gray-400 dark:text-gray-500" aria-hidden="true">|</span>
  <span class="inline-flex items-center gap-1 whitespace-nowrap" title="Mark attendance">
    <UserCheck class="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
    <span>Mark attendance</span>
  </span>
  <span class="select-none text-gray-400 dark:text-gray-500" aria-hidden="true">|</span>
  <span
    class="inline-flex items-center gap-1 whitespace-nowrap"
    title="Attendance locked after plan or report is submitted"
  >
    <Lock class="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
    <span>Locked</span>
  </span>
  <span class="select-none text-gray-400 dark:text-gray-500" aria-hidden="true">|</span>
  <span class="inline-flex items-center gap-1 whitespace-nowrap" title="View stage journey">
    <Map class="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
    <span>Journey</span>
  </span>
  <span class="select-none text-gray-400 dark:text-gray-500" aria-hidden="true">|</span>
  <span class="inline-flex items-center gap-1 whitespace-nowrap" title="View works for this employee">
    <ClipboardList class="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
    <span>Works</span>
  </span>
</div>
