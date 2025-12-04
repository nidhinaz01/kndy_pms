<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { Edit, Trash2 } from 'lucide-svelte';
  import { fetchSupabaseAuthUsers, type SupabaseAuthUser } from '$lib/api/userManagement';
  
  export let users: any[] = [];
  export let isLoading: boolean = false;
  export let isSaving: boolean = false;
  export let isEditMode: boolean = false;
  export let selectedUser: any = null;
  export let userForm: {
    username: string;
    email: string;
    password: string;
    role: string;
    desig: string;
    emp_id: string;
    is_active: boolean;
    auth_user_id: string;
  };
  
  let supabaseAuthUsers: SupabaseAuthUser[] = [];
  let isLoadingAuthUsers = false;
  
  const dispatch = createEventDispatcher();
  
  const roles = [
    'Admin', 'SalesExecutive', 'SalesManager', 'PlanningEngineer', 'PlanningManager',
    'RDEngineer', 'RDManager', 'ProductionEngineer', 'PlantManager', 'ProductionManager',
    'QCEngineer', 'QCManager', 'OperationsManager', 'GeneralManager', 'ManagingDirector',
    'FinanceExecutive', 'FinanceManager', 'HRExecutive', 'HRManager'
  ];
  
  async function loadSupabaseAuthUsers() {
    isLoadingAuthUsers = true;
    supabaseAuthUsers = [];
    try {
      const result = await fetchSupabaseAuthUsers();
      supabaseAuthUsers = result;
      if (supabaseAuthUsers.length === 0) {
        dispatch('message', { text: 'No Supabase Auth users found. Please create a user in Supabase Dashboard first.', type: 'error' });
      }
    } catch (error) {
      console.error('Error loading Supabase Auth users:', error);
      dispatch('message', { text: 'Error loading Supabase Auth users: ' + ((error as Error)?.message || 'Unknown error'), type: 'error' });
      supabaseAuthUsers = [];
    } finally {
      isLoadingAuthUsers = false;
    }
  }
  
  function handleEdit(user: any) {
    dispatch('edit-user', user);
  }
  
  function handleDelete(user: any) {
    dispatch('delete-user', user);
  }
  
  function handleSave() {
    dispatch('save-user');
  }
  
  function handleReset() {
    dispatch('reset-form');
    loadSupabaseAuthUsers();
  }
  
  // Load auth users when component mounts or when switching to new user mode
  $: if (!isEditMode) {
    loadSupabaseAuthUsers();
  }
</script>

<div class="flex flex-1 gap-6">
  <!-- Left Side - User Form -->
  <div class="w-3/10">
    <div class="theme-bg-primary rounded-lg shadow-lg p-6 border theme-border h-full">
      <h3 class="text-lg font-semibold theme-text-primary mb-6">
        {isEditMode ? 'Edit User' : 'Add New User'}
      </h3>
      
      <form on:submit|preventDefault={handleSave} class="space-y-6">
        <!-- Username -->
        <div>
          <label for="username" class="block text-sm font-medium theme-text-primary mb-2">
            Username *
          </label>
          <input
            id="username"
            type="text"
            bind:value={userForm.username}
            required
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter username"
          />
        </div>

        {#if !isEditMode}
          <!-- Link to Supabase Auth User -->
          <div>
            <label for="auth_user_id" class="block text-sm font-medium theme-text-primary mb-2">
              Link to Supabase Auth User *
            </label>
            {#if isLoadingAuthUsers}
              <div class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary flex items-center">
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                <span class="text-sm theme-text-secondary">Loading Supabase Auth users...</span>
              </div>
            {:else}
              <select
                id="auth_user_id"
                bind:value={userForm.auth_user_id}
                required
                class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                on:change={(e) => {
                  const selectedId = (e.target as HTMLSelectElement).value;
                  const selectedAuthUser = supabaseAuthUsers.find(u => u.id === selectedId);
                  if (selectedAuthUser) {
                    userForm.email = selectedAuthUser.email;
                  }
                }}
              >
                <option value="">Select Supabase Auth User</option>
                {#each supabaseAuthUsers as authUser}
                  <option 
                    value={authUser.id} 
                    disabled={authUser.is_linked}
                  >
                    {authUser.email} {authUser.is_linked ? '(Already Linked)' : ''}
                  </option>
                {/each}
              </select>
              <p class="mt-1 text-xs theme-text-secondary">
                Select a user from Supabase Authentication. Only unlinked users can be selected.
                Email will be auto-filled from the selected user.
              </p>
              <button
                type="button"
                class="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                on:click={loadSupabaseAuthUsers}
              >
                Refresh List
              </button>
            {/if}
          </div>

          <!-- Email (auto-filled, read-only) -->
          <div>
            <label for="email" class="block text-sm font-medium theme-text-primary mb-2">
              Email (from Supabase Auth)
            </label>
            <input
              id="email"
              type="email"
              bind:value={userForm.email}
              readonly
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-gray-100 dark:theme-bg-gray-700 theme-text-primary cursor-not-allowed"
              placeholder="Will be auto-filled from selected Supabase Auth user"
            />
          </div>
        {:else}
          <!-- Email (read-only in edit mode) -->
          <div>
            <label for="email" class="block text-sm font-medium theme-text-primary mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              bind:value={userForm.email}
              readonly
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-gray-100 dark:theme-bg-gray-700 theme-text-primary cursor-not-allowed"
            />
            <p class="mt-1 text-xs theme-text-secondary">Email cannot be changed</p>
          </div>
        {/if}

        <!-- Role -->
        <div>
          <label for="role" class="block text-sm font-medium theme-text-primary mb-2">
            Role *
          </label>
          <select
            id="role"
            bind:value={userForm.role}
            required
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Role</option>
            {#each roles as role}
              <option value={role}>{role}</option>
            {/each}
          </select>
        </div>

        <!-- Designation -->
        <div>
          <label for="desig" class="block text-sm font-medium theme-text-primary mb-2">
            Designation *
          </label>
          <input
            id="desig"
            type="text"
            bind:value={userForm.desig}
            required
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter designation"
          />
        </div>

        <!-- Employee ID -->
        <div>
          <label for="emp_id" class="block text-sm font-medium theme-text-primary mb-2">
            Employee ID *
          </label>
          <input
            id="emp_id"
            type="text"
            bind:value={userForm.emp_id}
            required
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter employee ID"
          />
        </div>

        <!-- Status -->
        <div>
          <div class="block text-sm font-medium theme-text-primary mb-2">
            Status *
          </div>
          <div class="space-y-2" role="radiogroup">
            <label class="flex items-center space-x-2">
              <input
                id="status-active"
                type="radio"
                bind:group={userForm.is_active}
                value={true}
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
              />
              <span class="text-sm theme-text-primary">Active</span>
            </label>
            <label class="flex items-center space-x-2">
              <input
                id="status-inactive"
                type="radio"
                bind:group={userForm.is_active}
                value={false}
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
              />
              <span class="text-sm theme-text-primary">Inactive</span>
            </label>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            class="px-6 py-3 text-base font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-600 text-white border-2 border-blue-600 hover:bg-blue-700 hover:border-blue-700 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : (isEditMode ? 'Update User' : 'Save User')}
          </button>
        </div>
      </form>

      <!-- Help Section -->
      <div class="mt-8 pt-6 border-t theme-border">
        <h4 class="text-sm font-semibold theme-text-primary mb-3">How to use this form:</h4>
        <div class="space-y-2 text-xs theme-text-secondary">
          <div class="flex items-start space-x-2">
            <span class="text-blue-500 font-semibold">•</span>
            <span>Enter a unique username and email for the new user.</span>
          </div>
          <div class="flex items-start space-x-2">
            <span class="text-blue-500 font-semibold">•</span>
            <span>Select the appropriate role from the dropdown.</span>
          </div>
          <div class="flex items-start space-x-2">
            <span class="text-blue-500 font-semibold">•</span>
            <span>Email cannot be changed once created.</span>
          </div>
          <div class="flex items-start space-x-2">
            <span class="text-blue-500 font-semibold">•</span>
            <span>All fields marked with * are required.</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Right Side - Users Table -->
  <div class="w-7/10">
    <DataTable
      data={users}
      columns={[
        { key: 'username', label: 'Username', sortable: true, filterable: true, type: 'text' },
        { key: 'email', label: 'Email', sortable: true, filterable: true, type: 'text' },
        { key: 'role', label: 'Role', sortable: true, filterable: true, type: 'text' },
        { key: 'desig', label: 'Designation', sortable: true, filterable: true, type: 'text' },
        { key: 'emp_id', label: 'Employee ID', sortable: true, filterable: true, type: 'text' },
        { key: 'is_active', label: 'Status', sortable: true, filterable: true, type: 'status' },
        { key: 'last_login_time', label: 'Last Login', sortable: true, filterable: false, type: 'text' }
      ]}
      actions={[
        {
          label: 'Edit',
          icon: Edit,
          onClick: handleEdit
        },
        {
          label: 'Delete',
          icon: Trash2,
          onClick: handleDelete
        }
      ]}
      title="Users"
      isLoading={isLoading}
    />
  </div>
</div>

