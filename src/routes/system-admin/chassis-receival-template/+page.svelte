<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { formatDateLocal } from '$lib/utils/formatDate';

  // Page state
  let isLoading = true;
  let showSidebar = false;
  let menus: any[] = [];

  // Data
  let templates: any[] = [];
  let selectedTemplate: any = null;
  let showTemplateModal = false;
  let showFieldModal = false;
  let showCopyModal = false;
  let showViewModal = false;

  // Template form
  let templateForm = {
    template_name: '',
    template_description: '',
    is_active: true
  };

  // Field form
  let fieldForm = {
    field_name: '',
    field_label: '',
    field_type: 'text',
    is_required: false,
    field_order: 1,
    validation_rules: {},
    dropdown_options: { options: [] }
  };

  // Copy form
  let copyForm = {
    template_name: '',
    template_description: ''
  };

  // Field types
  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'dropdown', label: 'Dropdown' }
  ];

  onMount(async () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadTemplates();
    isLoading = false;
  });

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('sys_chassis_receival_templates')
        .select(`
          *,
          sys_chassis_receival_template_fields(*)
        `)
        .eq('is_deleted', false)
        .order('created_dt', { ascending: false });

      if (error) throw error;
      templates = data || [];
    } catch (error) {
      console.error('Error loading templates:', error);
      templates = [];
    }
  }

  function handleCreateTemplate() {
    templateForm = {
      template_name: '',
      template_description: '',
      is_active: true
    };
    selectedTemplate = null;
    showTemplateModal = true;
  }

  function handleEditTemplate(template: any) {
    templateForm = {
      template_name: template.template_name,
      template_description: template.template_description,
      is_active: template.is_active
    };
    selectedTemplate = template;
    showTemplateModal = true;
  }

  function handleCopyTemplate(template: any) {
    copyForm = {
      template_name: `${template.template_name} (Copy)`,
      template_description: template.template_description
    };
    selectedTemplate = template;
    showCopyModal = true;
  }

  function handleViewTemplate(template: any) {
    selectedTemplate = template;
    showViewModal = true;
  }

  async function saveTemplate() {
    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      const now = new Date().toISOString();

      if (selectedTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('sys_chassis_receival_templates')
          .update({
            template_name: templateForm.template_name,
            template_description: templateForm.template_description,
            is_active: templateForm.is_active,
            modified_by: username,
            modified_dt: now
          })
          .eq('id', selectedTemplate.id);

        if (error) throw error;
      } else {
        // Create new template
        const { error } = await supabase
          .from('sys_chassis_receival_templates')
          .insert({
            template_name: templateForm.template_name,
            template_description: templateForm.template_description,
            is_active: templateForm.is_active,
            created_by: username,
            created_dt: now
          });

        if (error) throw error;
      }

      await loadTemplates();
      showTemplateModal = false;
      selectedTemplate = null;
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error saving template. Please try again.');
    }
  }

  async function copyTemplate() {
    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      const now = new Date().toISOString();

      // Create new template
      const { data: newTemplate, error: templateError } = await supabase
        .from('sys_chassis_receival_templates')
        .insert({
          template_name: copyForm.template_name,
          template_description: copyForm.template_description,
          is_active: true,
          created_by: username,
          created_dt: now
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Copy fields from original template
      if (selectedTemplate.sys_chassis_receival_template_fields?.length > 0) {
        const fieldsToInsert = selectedTemplate.sys_chassis_receival_template_fields.map((field: any) => ({
          template_id: newTemplate.id,
          field_name: field.field_name,
          field_label: field.field_label,
          field_type: field.field_type,
          is_required: field.is_required,
          field_order: field.field_order,
          validation_rules: field.validation_rules,
          dropdown_options: field.dropdown_options,
          created_by: username,
          created_dt: now
        }));

        const { error: fieldsError } = await supabase
          .from('sys_chassis_receival_template_fields')
          .insert(fieldsToInsert);

        if (fieldsError) throw fieldsError;
      }

      await loadTemplates();
      showCopyModal = false;
      selectedTemplate = null;
    } catch (error) {
      console.error('Error copying template:', error);
      alert('Error copying template. Please try again.');
    }
  }

  async function deleteTemplate(template: any) {
    if (!confirm(`Are you sure you want to delete "${template.template_name}"?`)) {
      return;
    }

    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('sys_chassis_receival_templates')
        .update({
          is_deleted: true,
          modified_by: username,
          modified_dt: now
        })
        .eq('id', template.id);

      if (error) throw error;

      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error deleting template. Please try again.');
    }
  }

  function handleAddField(template: any) {
    selectedTemplate = template;
    fieldForm = {
      field_name: '',
      field_label: '',
      field_type: 'text',
      is_required: false,
      field_order: (template.sys_chassis_receival_template_fields?.length || 0) + 1,
      validation_rules: {},
      dropdown_options: { options: [] }
    };
    showFieldModal = true;
  }

  async function saveField() {
    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('sys_chassis_receival_template_fields')
        .insert({
          template_id: selectedTemplate.id,
          field_name: fieldForm.field_name,
          field_label: fieldForm.field_label,
          field_type: fieldForm.field_type,
          is_required: fieldForm.is_required,
          field_order: fieldForm.field_order,
          validation_rules: fieldForm.validation_rules,
          dropdown_options: fieldForm.dropdown_options,
          created_by: username,
          created_dt: now
        });

      if (error) throw error;

      await loadTemplates();
      showFieldModal = false;
      selectedTemplate = null;
    } catch (error) {
      console.error('Error saving field:', error);
      alert('Error saving field. Please try again.');
    }
  }

  async function deleteField(field: any) {
    if (!confirm(`Are you sure you want to delete this field?`)) {
      return;
    }

    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('sys_chassis_receival_template_fields')
        .update({
          is_deleted: true,
          modified_by: username,
          modified_dt: now
        })
        .eq('id', field.id);

      if (error) throw error;

      await loadTemplates();
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Error deleting field. Please try again.');
    }
  }

  function getFieldTypeLabel(type: string): string {
    const fieldType = fieldTypes.find(ft => ft.value === type);
    return fieldType ? fieldType.label : type;
  }
</script>

<svelte:head>
  <title>Chassis Receival Templates - System Admin</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={() => showSidebar = false}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showSidebar = false)}
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="min-h-screen theme-bg-primary">
  <!-- Header -->
  <div class="theme-bg-primary shadow-sm border-b theme-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between py-4">
        <!-- Burger Menu -->
        <button 
          class="p-2 rounded hover:theme-bg-tertiary focus:outline-none transition-colors duration-200" 
          on:click={() => showSidebar = !showSidebar} 
          aria-label="Show sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Page Title -->
        <h1 class="text-2xl font-bold theme-text-primary">Chassis Receival Templates</h1>

        <!-- Favicon -->
        <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {#if isLoading}
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 theme-accent mx-auto mb-4"></div>
          <p class="theme-text-primary">Loading templates...</p>
        </div>
      </div>
    {:else}
      <!-- Action Buttons -->
      <div class="mb-6">
        <Button variant="primary" size="md" on:click={handleCreateTemplate}>
          ➕ Create New Template
        </Button>
      </div>

      <!-- Templates List -->
      <div class="theme-bg-primary rounded-lg shadow-lg">
        {#if templates.length === 0}
          <div class="text-center py-8">
            <p class="text-lg theme-text-secondary mb-4">No templates found</p>
            <p class="text-sm theme-text-tertiary">Create your first chassis receival template to get started</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b theme-border">
                  <th class="px-4 py-3 text-left font-medium theme-text-primary">Template Name</th>
                  <th class="px-4 py-3 text-left font-medium theme-text-primary">Description</th>
                  <th class="px-4 py-3 text-left font-medium theme-text-primary">Fields</th>
                  <th class="px-4 py-3 text-left font-medium theme-text-primary">Status</th>
                  <th class="px-4 py-3 text-left font-medium theme-text-primary">Created</th>
                  <th class="px-4 py-3 text-center font-medium theme-text-primary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each templates as template}
                  <tr class="border-b theme-border hover:theme-bg-secondary">
                    <td class="px-4 py-3 font-medium theme-text-primary">
                      {template.template_name}
                    </td>
                    <td class="px-4 py-3 theme-text-primary">
                      {template.template_description || 'No description'}
                    </td>
                    <td class="px-4 py-3 theme-text-primary">
                      {template.sys_chassis_receival_template_fields?.length || 0} fields
                    </td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-1 rounded-full text-xs {template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        {template.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td class="px-4 py-3 theme-text-primary">
                      {formatDateLocal(template.created_dt)}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <div class="flex items-center justify-center gap-2">
                        <Button variant="secondary" size="sm" on:click={() => handleViewTemplate(template)}>
                          View
                        </Button>
                        <Button variant="primary" size="sm" on:click={() => handleAddField(template)}>
                          Add Field
                        </Button>
                        <Button variant="secondary" size="sm" on:click={() => handleCopyTemplate(template)}>
                          Copy
                        </Button>
                        <Button variant="danger" size="sm" on:click={() => deleteTemplate(template)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Template Modal -->
{#if showTemplateModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={() => showTemplateModal = false}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showTemplateModal = false)}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
      <h2 class="text-xl font-bold theme-text-primary mb-4">
        {selectedTemplate ? 'Edit Template' : 'Create New Template'}
      </h2>
      
      <form on:submit|preventDefault={saveTemplate}>
        <div class="mb-4">
          <label for="template-name" class="block text-sm font-medium theme-text-primary mb-2">Template Name</label>
          <input
            id="template-name"
            type="text"
            bind:value={templateForm.template_name}
            required
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div class="mb-4">
          <label for="template-description" class="block text-sm font-medium theme-text-primary mb-2">Description</label>
          <textarea
            id="template-description"
            bind:value={templateForm.template_description}
            rows="3"
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></textarea>
        </div>
        
        <div class="mb-6">
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={templateForm.is_active}
              class="mr-2"
            />
            <span class="text-sm theme-text-primary">Active</span>
          </label>
        </div>
        
        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="md" on:click={() => showTemplateModal = false}>
            Cancel
          </Button>
          <Button variant="primary" size="md" on:click={() => saveTemplate()}>
            {selectedTemplate ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Copy Template Modal -->
{#if showCopyModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={() => showCopyModal = false}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showCopyModal = false)}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Copy Template</h2>
      
      <form on:submit|preventDefault={copyTemplate}>
        <div class="mb-4">
          <label for="copy-template-name" class="block text-sm font-medium theme-text-primary mb-2">New Template Name</label>
          <input
            id="copy-template-name"
            type="text"
            bind:value={copyForm.template_name}
            required
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div class="mb-6">
          <label for="copy-template-description" class="block text-sm font-medium theme-text-primary mb-2">Description</label>
          <textarea
            id="copy-template-description"
            bind:value={copyForm.template_description}
            rows="3"
            class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          ></textarea>
        </div>
        
        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="md" on:click={() => showCopyModal = false}>
            Cancel
          </Button>
          <Button variant="primary" size="md" on:click={() => copyTemplate()}>
            Copy Template
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Field Modal -->
{#if showFieldModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={() => showFieldModal = false}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showFieldModal = false)}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Add Field to Template</h2>
      
      <form on:submit|preventDefault={saveField}>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="field-name" class="block text-sm font-medium theme-text-primary mb-2">Field Name</label>
            <input
              id="field-name"
              type="text"
              bind:value={fieldForm.field_name}
              required
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label for="field-label" class="block text-sm font-medium theme-text-primary mb-2">Field Label</label>
            <input
              id="field-label"
              type="text"
              bind:value={fieldForm.field_label}
              required
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="field-type" class="block text-sm font-medium theme-text-primary mb-2">Field Type</label>
            <select
              id="field-type"
              bind:value={fieldForm.field_type}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {#each fieldTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </div>
          
          <div>
            <label for="field-order" class="block text-sm font-medium theme-text-primary mb-2">Field Order</label>
            <input
              id="field-order"
              type="number"
              bind:value={fieldForm.field_order}
              min="1"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div class="mb-4">
          <div class="flex items-center">
            <input
              id="field-required"
              type="checkbox"
              bind:checked={fieldForm.is_required}
              class="mr-2"
            />
            <label for="field-required" class="text-sm theme-text-primary">Required Field</label>
          </div>
        </div>
        
        {#if fieldForm.field_type === 'dropdown'}
          <div class="mb-4">
            <label for="dropdown-options" class="block text-sm font-medium theme-text-primary mb-2">Dropdown Options</label>
            <textarea
              id="dropdown-options"
              bind:value={fieldForm.dropdown_options.options}
              placeholder="Enter options separated by commas"
              rows="3"
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            ></textarea>
          </div>
        {/if}
        
        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="md" on:click={() => showFieldModal = false}>
            Cancel
          </Button>
          <Button variant="primary" size="md" on:click={() => saveField()}>
            Add Field
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- View Template Modal -->
{#if showViewModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         role="button" 
         tabindex="0"
         on:click={() => showViewModal = false}
         on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showViewModal = false)}></div>
    <div class="relative theme-bg-primary rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-bold theme-text-primary mb-4">Template Details</h2>
      
      <!-- Template Information -->
      <div class="mb-6 p-4 theme-bg-secondary border theme-border rounded-lg">
        <h3 class="text-lg font-semibold theme-text-primary mb-2">{selectedTemplate?.template_name}</h3>
        <p class="text-sm theme-text-secondary mb-2">
          <strong>Description:</strong> {selectedTemplate?.template_description || 'No description'}
        </p>
        <p class="text-sm theme-text-secondary mb-2">
          <strong>Status:</strong> 
          <span class="px-2 py-1 rounded-full text-xs {selectedTemplate?.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">
            {selectedTemplate?.is_active ? 'Active' : 'Inactive'}
          </span>
        </p>
        <p class="text-sm theme-text-secondary">
          <strong>Created:</strong> {selectedTemplate?.created_dt ? formatDateLocal(selectedTemplate.created_dt) : 'N/A'}
        </p>
      </div>

      <!-- Template Fields -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold theme-text-primary mb-4">
          Template Fields ({selectedTemplate?.sys_chassis_receival_template_fields?.length || 0})
        </h3>
        
        {#if selectedTemplate?.sys_chassis_receival_template_fields?.length > 0}
          <div class="space-y-4">
            {#each selectedTemplate.sys_chassis_receival_template_fields.sort((a: any, b: any) => (a as any).field_order - (b as any).field_order) as field}
              <div class="p-4 border theme-border rounded-lg">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h4 class="font-medium theme-text-primary">{field.field_label}</h4>
                    <p class="text-sm theme-text-secondary">Field Name: {field.field_name}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">
                      {field.field_type}
                    </span>
                    {#if field.is_required}
                      <span class="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs rounded">
                        Required
                      </span>
                    {/if}
                  </div>
                </div>
                
                <div class="text-sm theme-text-secondary">
                  <p><strong>Order:</strong> {field.field_order}</p>
                  
                  {#if field.field_type === 'dropdown' && field.dropdown_options?.options?.length > 0}
                    <p class="mt-2"><strong>Options:</strong></p>
                    <ul class="list-disc list-inside ml-4">
                      {#each field.dropdown_options.options as option}
                        <li>{option}</li>
                      {/each}
                    </ul>
                  {/if}
                  
                  {#if field.validation_rules && Object.keys(field.validation_rules).length > 0}
                    <p class="mt-2"><strong>Validation Rules:</strong></p>
                    <ul class="list-disc list-inside ml-4">
                      {#each Object.entries(field.validation_rules) as [key, value]}
                        <li>{key}: {value}</li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-8">
            <p class="text-gray-500 dark:text-gray-400">No fields added to this template yet.</p>
            <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">Click "Add Field" to start building the template.</p>
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="md" on:click={() => showViewModal = false}>
          Close
        </Button>
        <Button variant="primary" size="md" on:click={() => {
          showViewModal = false;
          handleAddField(selectedTemplate);
        }}>
          Add Field
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />
