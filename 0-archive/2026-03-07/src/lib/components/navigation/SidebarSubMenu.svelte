<script context="module" lang="ts">
  import SidebarSubMenu from './SidebarSubMenu.svelte';
</script>

<script lang="ts">
  export let submenus: any[] = [];
  export let currentPath: string;
</script>

{#each submenus as sub}
  <li>
    <a
      href={sub.menu_path}
      class="block px-2 py-1 text-sm rounded hover:theme-bg-secondary
        {currentPath === sub.menu_path ? 'theme-bg-accent theme-text-accent font-medium' : 'theme-text-primary'}"
    >
      {sub.menu_name}
    </a>
    {#if sub.submenus?.length > 0}
      <ul class="ml-4 mt-1 space-y-1">
        <SidebarSubMenu submenus={sub.submenus} {currentPath} />
      </ul>
    {/if}
  </li>
{/each} 