<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { formatDateLocal } from '$lib/utils/formatDate';
  import { loadTemplates, saveTemplate as saveTemplateService, copyTemplate as copyTemplateService, deleteTemplate as deleteTemplateService, saveField as saveFieldService, deleteField as deleteFieldService } from './services/templateService';
  import TemplateModal from './components/TemplateModal.svelte';
  import FieldModal from './components/FieldModal.svelte';
  import CopyTemplateModal from './components/CopyTemplateModal.svelte';
  import ViewTemplateModal from './components/ViewTemplateModal.svelte';

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
    await loadTemplatesData();
    isLoading = false;
  });

  async function loadTemplatesData() {
    templates = await loadTemplates();
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

  async function handleSaveTemplate() {
    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      await saveTemplateService(templateForm, !!selectedTemplate, selectedTemplate?.id, username);
      await loadTemplatesData();
      showTemplateModal = false;
      selectedTemplate = null;
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error saving template. Please try again.');
    }
  }

  async function handleSaveCopyTemplate() {
    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      await copyTemplateService(selectedTemplate, copyForm.template_name, copyForm.template_description, username);
      await loadTemplatesData();
      showCopyModal = false;
      selectedTemplate = null;
    } catch (error) {
      console.error('Error copying template:', error);
      alert('Error copying template. Please try again.');
    }
  }

  async function handleDeleteTemplate(template: any) {
    if (!confirm(`Are you sure you want to delete "${template.template_name}"?`)) {
      return;
    }

    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      await deleteTemplateService(template.id, username);
      await loadTemplatesData();
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

  async function handleSaveField() {
    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      await saveFieldService(selectedTemplate.id, fieldForm, username);
      await loadTemplatesData();
      showFieldModal = false;
      selectedTemplate = null;
    } catch (error) {
      console.error('Error saving field:', error);
      alert('Error saving field. Please try again.');
    }
  }

  async function handleDeleteField(field: any) {
    if (!confirm(`Are you sure you want to delete this field?`)) {
      return;
    }

    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
      await deleteFieldService(field.id, username);
      await loadTemplatesData();
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
        <button
          on:click={() => goto('/dashboard')}
          class="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Go to dashboard"
        >
          <img src="/favicon.png" alt="Company Logo" class="h-8 w-auto" />
        </button>
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
                        <Button variant="danger" size="sm" on:click={() => handleDeleteTemplate(template)}>
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
<TemplateModal
  bind:showModal={showTemplateModal}
  bind:templateForm
  isEditMode={!!selectedTemplate}
  onSave={handleSaveTemplate}
  onCancel={() => {
    showTemplateModal = false;
    selectedTemplate = null;
  }}
/>

<!-- Copy Template Modal -->
<CopyTemplateModal
  bind:showModal={showCopyModal}
  bind:copyForm
  onSave={handleSaveCopyTemplate}
  onCancel={() => {
    showCopyModal = false;
    selectedTemplate = null;
  }}
/>

<!-- Field Modal -->
<FieldModal
  bind:showModal={showFieldModal}
  bind:fieldForm
  {fieldTypes}
  onSave={handleSaveField}
  onCancel={() => {
    showFieldModal = false;
    selectedTemplate = null;
  }}
/>

<!-- View Template Modal -->
<ViewTemplateModal
  bind:showModal={showViewModal}
  bind:selectedTemplate
  onAddField={() => {
    showViewModal = false;
    handleAddField(selectedTemplate);
  }}
  onClose={() => {
    showViewModal = false;
    selectedTemplate = null;
  }}
  onDeleteField={handleDeleteField}
/>

<!-- Floating Theme Toggle -->
<FloatingThemeToggle />
