<script lang="ts">
  import { onMount } from 'svelte';
  import { setupDataElementsMenu, checkDataElementsMenu } from '$lib/api/setupDataElementsMenu';
  import { supabase } from '$lib/supabaseClient';

  let isLoading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let menuExists = false;

  async function checkMenuStatus() {
    try {
      menuExists = await checkDataElementsMenu();
    } catch (error) {
      console.error('Error checking menu status:', error);
    }
  }

  async function setupMenu() {
    isLoading = true;
    message = '';

    try {
      const result = await setupDataElementsMenu();
      
      if (result.success) {
        message = result.message;
        messageType = 'success';
        await checkMenuStatus();
      } else {
        message = result.message;
        messageType = 'error';
      }
    } catch (error) {
      console.error('Error setting up menu:', error);
      message = 'An unexpected error occurred';
      messageType = 'error';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    checkMenuStatus();
  });
</script>

<svelte:head>
  <title>Setup Data Elements Menu</title>
</svelte:head>

<div class="max-w-2xl mx-auto p-6">
  <div class="mb-8">
    <h1 class="text-3xl font-bold theme-text-primary mb-2">Setup Data Elements Menu</h1>
    <p class="theme-text-secondary">This page helps you set up the menu entries for the Data Elements functionality.</p>
  </div>

  <!-- Status Display -->
  <div class="mb-6 p-4 rounded-lg theme-bg-primary border theme-border">
    <h3 class="text-lg font-semibold theme-text-primary mb-2">Current Status</h3>
    <div class="flex items-center space-x-2">
      <div class={`w-3 h-3 rounded-full ${menuExists ? 'bg-green-500' : 'bg-red-500'}`}></div>
      <span class="theme-text-primary">
        {menuExists ? 'Data Elements menu is configured' : 'Data Elements menu is not configured'}
      </span>
    </div>
  </div>

  <!-- Message Display -->
  {#if message}
    <div class={`mb-6 p-4 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
      {message}
    </div>
  {/if}

  <!-- Setup Button -->
  <div class="theme-bg-primary rounded-lg shadow p-6 border theme-border">
    <h3 class="text-lg font-semibold theme-text-primary mb-4">Setup Menu</h3>
    <p class="theme-text-secondary mb-4">
      Click the button below to add the necessary menu entries to your database. 
      This will create a "System Admin" menu with a "Data Elements" submenu.
    </p>
    
    <button
      on:click={setupMenu}
      disabled={isLoading || menuExists}
      class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {#if isLoading}
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Setting up...
      {:else if menuExists}
        Menu Already Configured
      {:else}
        Setup Data Elements Menu
      {/if}
    </button>
  </div>

  <!-- Instructions -->
  <div class="mt-8 theme-bg-primary rounded-lg shadow p-6 border theme-border">
    <h3 class="text-lg font-semibold theme-text-primary mb-4">What this does:</h3>
    <div class="space-y-3 text-sm theme-text-secondary">
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>Creates a "System Admin" parent menu in your navigation</span>
      </div>
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>Adds a "Data Elements" submenu under System Admin</span>
      </div>
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>Grants admin user access to both menus</span>
      </div>
      <div class="flex items-start space-x-2">
        <span class="text-blue-500 font-semibold">•</span>
        <span>After setup, you can navigate to System Admin → Data Elements</span>
      </div>
    </div>
  </div>

  <!-- Manual SQL Option -->
  <div class="mt-8 theme-bg-primary rounded-lg shadow p-6 border theme-border">
    <h3 class="text-lg font-semibold theme-text-primary mb-4">Manual Setup</h3>
    <p class="theme-text-secondary mb-4">
      If the automatic setup doesn't work, you can run the SQL script manually in your database:
    </p>
    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm font-mono theme-text-primary overflow-x-auto">
      <pre>-- Run this in your Supabase SQL editor:
INSERT INTO menu (menu_id, menu_name, menu_path, parent_menu_id, menu_order, is_visible, is_enabled)
VALUES 
  ('system-admin', 'System Admin', '/system-admin', NULL, 100, true, true),
  ('data-elements', 'Data Elements', '/system-admin/data-elements', 'system-admin', 1, true, true)
ON CONFLICT (menu_id) DO NOTHING;</pre>
    </div>
  </div>
</div> 