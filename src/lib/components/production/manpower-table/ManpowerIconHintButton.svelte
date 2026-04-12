<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';

  const dispatch = createEventDispatcher();

  /** Shown on hover (native title), aria-label, and long-press hint bubble */
  export let label: string;
  export let disabled = false;
  export let variant: 'primary' | 'secondary' | 'danger' | 'warning' = 'secondary';

  let bubble = false;
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let pressed = false;
  let startX = 0;
  let startY = 0;
  let consumeNextClick = false;

  const HOLD_MS = 500;
  const MOVE_PX = 12;
  const BUBBLE_MS = 2200;

  function clearHold() {
    if (holdTimer != null) {
      clearTimeout(holdTimer);
      holdTimer = undefined;
    }
  }

  function clearBubbleTimer() {
    if (bubbleTimer != null) {
      clearTimeout(bubbleTimer);
      bubbleTimer = undefined;
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (disabled) return;
    pressed = true;
    startX = e.clientX;
    startY = e.clientY;
    clearHold();
    holdTimer = setTimeout(() => {
      holdTimer = undefined;
      if (!pressed) return;
      bubble = true;
      clearBubbleTimer();
      bubbleTimer = setTimeout(() => {
        bubble = false;
        bubbleTimer = undefined;
      }, BUBBLE_MS);
      consumeNextClick = true;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
      } catch {
        /* ignore */
      }
    }, HOLD_MS);
  }

  function onPointerMove(e: PointerEvent) {
    if (!pressed || disabled) return;
    if (Math.abs(e.clientX - startX) > MOVE_PX || Math.abs(e.clientY - startY) > MOVE_PX) {
      pressed = false;
      clearHold();
    }
  }

  function onPointerEnd() {
    pressed = false;
    clearHold();
  }

  function onClickCapture(e: MouseEvent) {
    if (consumeNextClick) {
      e.preventDefault();
      e.stopPropagation();
      consumeNextClick = false;
    }
  }
</script>

<div
  class="relative inline-flex shrink-0"
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={onPointerEnd}
  on:pointercancel={onPointerEnd}
  on:pointerleave={onPointerEnd}
  on:click|capture={onClickCapture}
>
  {#if bubble}
    <div
      class="absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white shadow-lg pointer-events-none dark:border-gray-300 dark:bg-gray-100 dark:text-gray-900"
      role="tooltip"
    >
      {label}
    </div>
  {/if}
  <Button
    {variant}
    size="sm"
    {disabled}
    title={label}
    ariaLabel={label}
    class="!min-h-[2.25rem] !min-w-[2.25rem] !px-2 !py-1"
    on:click={() => dispatch('click')}
  >
    <slot />
  </Button>
</div>
