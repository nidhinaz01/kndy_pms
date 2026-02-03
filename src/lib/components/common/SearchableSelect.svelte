<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { ChevronDown, X } from 'lucide-svelte';

  export let options: Array<{ value: string | number; label: string }> = [];
  export let value: string | number | null = null;
  export let placeholder: string = 'Select an option...';
  export let disabled: boolean = false;
  export let id: string = '';
  export let filterPlaceholder: string = 'Type to search...';

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let searchQuery = '';
  let filteredOptions: Array<{ value: string | number; label: string }> = [];
  let selectedOption: { value: string | number; label: string } | null = null;
  let containerElement: HTMLDivElement;
  let inputElement: HTMLInputElement;
  let highlightedIndex = -1;

  // Filter options based on search query
  $: {
    if (!searchQuery.trim()) {
      filteredOptions = options;
    } else {
      const query = searchQuery.toLowerCase().trim();
      filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(query)
      );
    }
    highlightedIndex = -1;
  }

  // Update selected option when value changes
  $: {
    if (value !== null && value !== undefined) {
      selectedOption = options.find(opt => opt.value === value) || null;
      if (selectedOption) {
        searchQuery = selectedOption.label;
      } else {
        searchQuery = '';
      }
    } else {
      selectedOption = null;
      searchQuery = '';
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    searchQuery = target.value;
    isOpen = true;
    highlightedIndex = -1;
  }

  function handleSelect(option: { value: string | number; label: string }) {
    value = option.value;
    searchQuery = option.label;
    isOpen = false;
    dispatch('change', option.value);
    inputElement?.blur();
  }

  function handleClear(e: Event) {
    e.stopPropagation();
    value = null;
    searchQuery = '';
    selectedOption = null;
    isOpen = false;
    dispatch('change', null);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          isOpen = true;
        } else {
          highlightedIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          highlightedIndex = Math.max(highlightedIndex - 1, -1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (filteredOptions.length === 1) {
          handleSelect(filteredOptions[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        isOpen = false;
        if (selectedOption) {
          searchQuery = selectedOption.label;
        } else {
          searchQuery = '';
        }
        inputElement?.blur();
        break;
      case 'Tab':
        isOpen = false;
        break;
    }
  }

  function handleFocus() {
    if (!disabled) {
      isOpen = true;
      // Select all text when focusing
      setTimeout(() => {
        inputElement?.select();
      }, 0);
    }
  }

  function handleBlur(e: FocusEvent) {
    // Delay closing to allow click events to fire
    setTimeout(() => {
      // Check if focus moved to an element inside the container
      const relatedTarget = e.relatedTarget as Node;
      if (containerElement && !containerElement.contains(relatedTarget)) {
        isOpen = false;
        // Restore selected option label if one is selected
        if (selectedOption) {
          searchQuery = selectedOption.label;
        } else {
          searchQuery = '';
        }
      }
    }, 200);
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (containerElement && !containerElement.contains(event.target as Node)) {
      isOpen = false;
      if (selectedOption) {
        searchQuery = selectedOption.label;
      } else {
        searchQuery = '';
      }
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="relative" bind:this={containerElement}>
  <div class="relative">
    <input
      type="text"
      bind:this={inputElement}
      {id}
      value={searchQuery}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:focus={handleFocus}
      on:blur={handleBlur}
      {disabled}
      placeholder={selectedOption ? selectedOption.label : placeholder}
      class="w-full px-3 py-2 pr-20 theme-bg-primary theme-border theme-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
      autocomplete="off"
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
    />
    <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
      {#if selectedOption && !disabled}
        <button
          type="button"
          on:click={handleClear}
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="Clear selection"
        >
          <X class="w-4 h-4 theme-text-secondary" />
        </button>
      {/if}
      <ChevronDown
        class="w-4 h-4 theme-text-secondary transition-transform {isOpen ? 'rotate-180' : ''}"
      />
    </div>
  </div>

  {#if isOpen && !disabled}
    <div
      class="absolute z-50 w-full mt-1 max-h-60 overflow-auto theme-bg-primary theme-border border rounded-lg shadow-lg"
      role="listbox"
    >
      {#if filteredOptions.length === 0}
        <div class="px-3 py-2 text-sm theme-text-secondary">
          No options found
        </div>
      {:else}
        {#each filteredOptions as option, index (option.value)}
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm theme-text-primary hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors {highlightedIndex === index ? 'bg-blue-100 dark:bg-blue-900/30' : ''}"
            on:click={() => handleSelect(option)}
            role="option"
            aria-selected={value === option.value}
          >
            {option.label}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Ensure dropdown appears above other elements */
  :global(.relative) {
    position: relative;
  }
</style>
