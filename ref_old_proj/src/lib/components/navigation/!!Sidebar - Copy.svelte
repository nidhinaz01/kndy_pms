<script lang="ts">
  import { onMount } from 'svelte';
  import { ChevronDown, Menu } from 'lucide-svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import MenuIcon from './MenuIcon.svelte';

  export let menus: any[] = [];

  let expanded: Record<string, boolean> = {};
  let sidebarOpen = true;
  const currentPath = get(page).url.pathname;

  function toggle(menuId: string) {
    expanded[menuId] = !expanded[menuId];
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function logout() {
    localStorage.clear();
    goto('/login');
  }
</script>

<div class="flex h-screen">
  <!-- Sidebar -->
  <aside class={`transition-all duration-300 bg-white text-gray-900 border-r border-gray-300 overflow-y-auto relative ${sidebarOpen ? 'w-64 p-4' : 'w-12 p-2'}`}>
    {#if sidebarOpen}
      {#each menus as menu}
        <div class="mb-2">
          <div
            class="flex items-center justify-between cursor-pointer mb-1"
            on:click={() => toggle(menu.menu_id)}
            role="button"
            tabindex="0"
            on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(menu.menu_id)}
          >
            <div class="flex items-center gap-2 font-semibold text-base">
              <MenuIcon name={menu.menu_name} />
              {menu.menu_name}
            </div>
            {#if menu.submenus.length > 0}
              <span class={`transition-transform duration-200 ${expanded[menu.menu_id] ? 'rotate-180' : ''}`}>
                <ChevronDown class="w-4 h-4" />
              </span>
            {/if}
          </div>

          {#if menu.submenus.length > 0 && expanded[menu.menu_id]}
            <ul class="ml-4 space-y-1">
              {@html SidebarItem({ sub: menu, currentPath, isRecursive: false })}
            </ul>
          {/if}
        </div>
      {/each}

      <!-- Logout Button -->
      <div class="absolute bottom-4 left-4 w-56">
        <button
          on:click={logout}
          class="w-full text-left flex items-center gap-2 px-4 py-2 rounded text-sm text-red-600 hover:bg-red-100"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 002 2h3a2 2 0 002-2V7a2 2 0 00-2-2h-3a2 2 0 00-2 2v1" />
          </svg>
          Logout
        </button>
      </div>
    {/if}
  </aside>

  <!-- Toggle Sidebar Button -->
  <button
    class="absolute top-2 left-2 z-50 bg-gray-200 rounded-full p-1 shadow"
    on:click={toggleSidebar}
    aria-label="Toggle sidebar"
  >
    <Menu class="w-5 h-5" />
  </button>

  <!-- Main content -->
  <main class="flex-1 bg-gray-100 p-4 overflow-auto">
    <slot />
  </main>
</div>

<!-- Recursive SidebarItem -->
<script context="module" lang="ts">
  export function SidebarItem({ sub, currentPath, isRecursive = true }: { sub: any, currentPath: string, isRecursive?: boolean }): string {
    const isActive = currentPath === sub.menu_path;
    const base = `
      <li>
        <a
          href="${sub.menu_path}"
          class="flex items-center gap-2 text-sm px-2 py-1 rounded transition hover:bg-gray-200
            ${isActive ? 'bg-blue-100 text-blue-600 font-medium' : 'text-gray-700'}"
        >
          <span class="w-2 h-2">
            <svg class="w-2 h-2 fill-current">
              <circle cx="5" cy="5" r="5" />
            </svg>
          </span>
          ${sub.menu_name}
        </a>
    `;

    const nested = sub.submenus && sub.submenus.length > 0
      ? `<ul class="ml-5 mt-1 space-y-1">
          ${sub.submenus.map((child: any) => SidebarItem({ sub: child, currentPath })).join('')}
        </ul>`
      : '';

    return base + nested + '</li>';
  }
</script>
