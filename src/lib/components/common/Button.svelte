<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let variant: 'primary' | 'secondary' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let fullWidth = false;
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';

  const dispatch = createEventDispatcher();

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClass = disabled ? 'cursor-not-allowed' : 'cursor-pointer';

  $: classes = `${baseClasses} ${sizeClasses[size]} ${widthClass} ${disabledClass}`;
</script>

<button 
  {type}
  class={classes}
  class:btn-primary={variant === 'primary'}
  class:btn-secondary={variant === 'secondary'}
  class:btn-danger={variant === 'danger'}
  {disabled}
  on:click={() => {
    if (!disabled) {
      dispatch('click');
    }
  }}
  on:keydown={(e) => e.key === 'Enter' && !disabled && dispatch('click')}
>
  <slot />
</button>

<style>
  .btn-primary {
    background-color: #2563eb !important;
    color: white !important;
    border: 2px solid #2563eb !important;
    cursor: pointer !important;
    font-weight: 500 !important;
    text-shadow: none !important;
  }
  
  .btn-primary:hover:not(:disabled) {
    background-color: #1d4ed8 !important;
    border-color: #1d4ed8 !important;
  }
  
  .btn-primary:focus {
    box-shadow: 0 0 0 2px #3b82f6 !important;
  }
  
  .btn-primary:disabled {
    opacity: 0.6 !important;
    background-color: #2563eb !important;
    color: white !important;
    border-color: #2563eb !important;
  }
  
  .btn-secondary {
    background-color: #f3f4f6 !important;
    color: #374151 !important;
    border: 2px solid #d1d5db !important;
    cursor: pointer !important;
  }
  
  .btn-secondary:hover {
    background-color: #e5e7eb !important;
    border-color: #9ca3af !important;
  }
  
  .btn-secondary:focus {
    box-shadow: 0 0 0 2px #6b7280 !important;
  }
  
  .btn-danger {
    background-color: #dc2626 !important;
    color: white !important;
    border: 2px solid #dc2626 !important;
    cursor: pointer !important;
  }
  
  .btn-danger:hover {
    background-color: #b91c1c !important;
    border-color: #b91c1c !important;
  }
  
  .btn-danger:focus {
    box-shadow: 0 0 0 2px #ef4444 !important;
  }
  
  /* Dark mode support */
  :global([data-theme="dark"]) .btn-secondary {
    background-color: #4b5563 !important;
    color: #e5e7eb !important;
    border-color: #6b7280 !important;
  }
  
  :global([data-theme="dark"]) .btn-secondary:hover {
    background-color: #6b7280 !important;
    border-color: #9ca3af !important;
  }
  
  /* Disabled state styling */
  button:disabled {
    cursor: not-allowed !important;
  }
  
  button:not(:disabled) {
    cursor: pointer !important;
  }
</style> 