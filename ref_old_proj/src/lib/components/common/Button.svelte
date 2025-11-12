<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let variant: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let fullWidth = false;
  export let icon: string | null = null;
  export let iconPosition: 'left' | 'right' = 'left';
  
  const dispatch = createEventDispatcher();
  
  // Button base classes
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  
  // Width classes
  const widthClasses = fullWidth ? 'w-full' : '';
  
  // Variant classes with theme support
  const variantClasses = {
    primary: 'theme-accent-bg text-white border-transparent hover:!bg-blue-700 focus:ring-theme-accent shadow-sm',
    secondary: 'theme-bg-tertiary theme-text-primary border-theme-border hover:!bg-gray-200 dark:hover:!bg-gray-600 focus:ring-theme-accent shadow-sm',
    success: 'bg-green-600 text-white border-transparent hover:!bg-green-700 focus:ring-green-500 shadow-sm',
    danger: 'bg-red-600 text-white border-transparent hover:!bg-red-700 focus:ring-red-500 shadow-sm',
    warning: 'bg-yellow-600 text-white border-transparent hover:!bg-yellow-700 focus:ring-yellow-500 shadow-sm'
  };
  
  // Combine all classes
  $: classes = `${baseClasses} ${sizeClasses[size]} ${widthClasses} ${variantClasses[variant]}`;
  
  function handleClick(event: MouseEvent) {
    dispatch('click', event);
  }
</script>

<button
  {type}
  {disabled}
  class={classes}
  on:click={handleClick}
  on:submit
  on:reset
>
  {#if icon && iconPosition === 'left'}
    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {@html icon}
    </svg>
  {/if}
  
  <slot />
  
  {#if icon && iconPosition === 'right'}
    <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {@html icon}
    </svg>
  {/if}
</button> 