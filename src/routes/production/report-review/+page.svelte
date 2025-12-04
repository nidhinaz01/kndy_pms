<script lang="ts">
  import { onMount } from 'svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import { supabase } from '$lib/supabaseClient';
  import { getCurrentUsername, getCurrentTimestamp } from '$lib/utils/userUtils';
  import { formatDateTimeLocal } from '$lib/utils/formatDate';
  import { goto } from '$app/navigation';
  import PDFViewer from '../plan-review/components/PDFViewer.svelte';
  import { X } from 'lucide-svelte';

  let showSidebar = false;
  let menus: any[] = [];
  let selectedDate = new Date().toISOString().split('T')[0];
  let selectedStage: string = '';
  let availableStages: string[] = ['P1S1', 'P1S2', 'P1S3', 'P2S1', 'P2S2', 'P2S3', 'P3S1'];
  
  let activeTab = 'works-report';
  const tabs = [
    { id: 'manpower-report', label: 'Manpower Report', icon: '👥' },
    { id: 'works-report', label: 'Works Report', icon: '🔧' }
  ];

  // Submissions data
  let pendingSubmissions: any[] = [];
  let approvedSubmissions: any[] = [];
  let selectedSubmission: any = null;
  let isLoading = false;
  let isSubmissionsLoading = false;
  let isApprovedSubmissionsLoading = false;
  
  // PDF viewing
  let pdfBlob: Blob | null = null;
  let isGeneratingPDF = false;
  let showWorksReportFullscreen = false;
  let hasManuallyClosedFullscreen = false;
  
  // Generate PDF when data changes (only after loading is complete)
  $: if (worksReportData.length > 0 && selectedSubmission && !isLoading && activeTab === 'works-report') {
    generateWorksReportPDF();
  }
  
  // Open fullscreen when PDF is ready and user is on Works Report tab (only if not manually closed)
  $: if (pdfBlob && activeTab === 'works-report' && !isGeneratingPDF && !showWorksReportFullscreen && !hasManuallyClosedFullscreen) {
    // Small delay to ensure UI is ready
    setTimeout(() => {
      if (!hasManuallyClosedFullscreen) {
        showWorksReportFullscreen = true;
      }
    }, 100);
  }

  // Works report data
  let worksReportData: any[] = [];
  let isWorksReportLoading = false;

  // Manpower report data
  let manpowerReportData: any[] = [];
  let isManpowerReportLoading = false;

  // Approval state
  let showApprovalModal = false;
  let approvalAction: 'approve' | 'reject' = 'approve';
  let rejectionReason = '';

  onMount(async () => {
    const username = localStorage.getItem('username');
    if (username) {
      menus = await fetchUserMenus(username);
    }
    await loadPendingSubmissions();
    await loadApprovedSubmissions();
  });
  
  // Reload submissions when date changes
  $: if (selectedDate) {
    // Clear selected submission if it doesn't match the new date
    if (selectedSubmission && selectedSubmission.reporting_date !== selectedDate) {
      selectedSubmission = null;
      worksReportData = [];
      manpowerReportData = [];
    }
    loadPendingSubmissions();
    loadApprovedSubmissions();
  }

  async function loadPendingSubmissions() {
    isSubmissionsLoading = true;
    try {
      let query = supabase
        .from('prdn_reporting_submissions')
        .select('*')
        .eq('status', 'pending_approval')
        .eq('is_deleted', false);
      
      // Filter by date if selected
      if (selectedDate) {
        query = query.eq('reporting_date', selectedDate);
      }
      
      // Filter by stage if selected
      if (selectedStage) {
        query = query.eq('stage_code', selectedStage);
      }
      
      const { data, error } = await query.order('submitted_dt', { ascending: false });

      if (error) {
        console.error('Error loading pending submissions:', error);
        throw error;
      }
      
      pendingSubmissions = data || [];
      console.log('Loaded pending submissions:', pendingSubmissions.length, data);
    } catch (error) {
      console.error('Error loading pending submissions:', error);
      pendingSubmissions = [];
    } finally {
      isSubmissionsLoading = false;
    }
  }
  
  async function loadApprovedSubmissions() {
    isApprovedSubmissionsLoading = true;
    try {
      let query = supabase
        .from('prdn_reporting_submissions')
        .select('*')
        .eq('status', 'approved')
        .eq('is_deleted', false);
      
      // Filter by date if selected
      if (selectedDate) {
        query = query.eq('reporting_date', selectedDate);
      }
      
      // Filter by stage if selected
      if (selectedStage) {
        query = query.eq('stage_code', selectedStage);
      }
      
      const { data, error } = await query.order('reviewed_dt', { ascending: false });

      if (error) throw error;
      approvedSubmissions = data || [];
    } catch (error) {
      console.error('Error loading approved submissions:', error);
      approvedSubmissions = [];
    } finally {
      isApprovedSubmissionsLoading = false;
    }
  }

  async function handleSubmissionSelect(submission: any) {
    selectedSubmission = submission;
    selectedStage = submission.stage_code;
    await loadSubmissionDetails();
  }
  
  async function handleApprovedSubmissionSelect(submission: any) {
    selectedSubmission = submission;
    selectedStage = submission.stage_code;
    await loadSubmissionDetails();
  }

  async function loadSubmissionDetails() {
    if (!selectedSubmission) return;

    isLoading = true;
    try {
      // Load works reports
      const { data: worksData, error: worksError } = await supabase
        .from('prdn_work_reporting')
        .select(`
          *,
          prdn_work_planning!inner(
            *,
            std_work_type_details(derived_sw_code, sw_code, type_description, std_work_details(sw_name)),
            hr_emp(emp_id, emp_name, skill_short),
            prdn_wo_details!inner(wo_no, pwo_no, wo_model, customer_name),
            std_work_skill_mapping(wsm_id, sc_name)
          )
        `)
        .eq('reporting_submission_id', selectedSubmission.id)
        .eq('is_deleted', false)
        .order('from_time', { ascending: true });

      if (worksError) throw worksError;
      worksReportData = worksData || [];
      
      // Load deviations for all reports
      const reportIds = (worksReportData || []).map((r: any) => r.id).filter(Boolean);
      if (reportIds.length > 0) {
        const { getDeviationsForReportings } = await import('$lib/services/workReportingDeviationService');
        const deviationsMap = await getDeviationsForReportings(reportIds);
        // Attach deviations to reports
        worksReportData = worksReportData.map((report: any) => ({
          ...report,
          deviations: deviationsMap.get(report.id) || []
        }));
      }

      // Load manpower reports
      const { data: manpowerData, error: manpowerError } = await supabase
        .from('prdn_reporting_manpower')
        .select(`
          *,
          hr_emp!inner(emp_id, emp_name, skill_short)
        `)
        .eq('reporting_submission_id', selectedSubmission.id)
        .eq('is_deleted', false);

      if (manpowerError) throw manpowerError;
      manpowerReportData = manpowerData || [];

      // Load stage reassignments
      const { data: reassignmentsData, error: reassignmentsError } = await supabase
        .from('prdn_reporting_stage_reassignment')
        .select(`
          *,
          hr_emp!inner(emp_id, emp_name, skill_short)
        `)
        .eq('reporting_submission_id', selectedSubmission.id)
        .eq('is_deleted', false);

      if (reassignmentsError) throw reassignmentsError;
      // Combine with manpower report data
      manpowerReportData = [...manpowerReportData, ...(reassignmentsData || [])];
      
      // Calculate LTNP hours from work reports for each employee
      // Group work reports by employee
      const employeeLTNP: Map<string, number> = new Map();
      worksReportData.forEach((report: any) => {
        const empId = report.prdn_work_planning?.hr_emp?.emp_id;
        if (!empId) return;
        
        // Parse lt_details and calculate LTNP (non-payable lost time)
        let ltnpMinutes = 0;
        if (report.lt_details && Array.isArray(report.lt_details)) {
          ltnpMinutes = report.lt_details
            .filter((lt: any) => !lt.is_lt_payable)
            .reduce((sum: number, lt: any) => sum + (lt.lt_minutes || 0), 0);
        }
        
        const currentLTNP = employeeLTNP.get(empId) || 0;
        employeeLTNP.set(empId, currentLTNP + ltnpMinutes);
      });
      
      // Update manpower report data with calculated LTNP
      manpowerReportData = manpowerReportData.map((report: any) => {
        const empId = report.hr_emp?.emp_id || report.emp_id;
        const calculatedLTNP = employeeLTNP.get(empId) || 0;
        const calculatedLTNPHours = calculatedLTNP / 60;
        
        // Use calculated LTNP if it's greater than stored value, or if stored is 0
        const ltnpHours = report.ltnp_hours && report.ltnp_hours > 0 
          ? report.ltnp_hours 
          : calculatedLTNPHours;
        
        return {
          ...report,
          ltnp_hours: ltnpHours,
          calculated_ltnp_hours: calculatedLTNPHours
        };
      });
      
      // Generate PDF for works report
      await generateWorksReportPDF();
    } catch (error) {
      console.error('Error loading submission details:', error);
    } finally {
      isLoading = false;
    }
  }
  
  async function generateWorksReportPDF() {
    if (worksReportData.length === 0 || !selectedSubmission) {
      pdfBlob = null;
      return;
    }
    
    isGeneratingPDF = true;
    try {
      // Import PDF generator (we'll create this)
      const { generateWorksReportPDF } = await import('./utils/generateWorksReportPDF');
      const doc = generateWorksReportPDF(worksReportData, selectedSubmission.stage_code, selectedSubmission.reporting_date);
      pdfBlob = doc.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      pdfBlob = null;
    } finally {
      isGeneratingPDF = false;
    }
  }
  
  function closeWorksReportFullscreen() {
    showWorksReportFullscreen = false;
    hasManuallyClosedFullscreen = true;
  }
  
  function openWorksReportFullscreen() {
    showWorksReportFullscreen = true;
    hasManuallyClosedFullscreen = false;
  }
  
  function handleGeneratePDF() {
    generateWorksReportPDF();
  }

  function handleApprove() {
    approvalAction = 'approve';
    showApprovalModal = true;
  }

  function handleReject() {
    approvalAction = 'reject';
    showApprovalModal = true;
  }

  async function handleApprovalConfirm() {
    if (!selectedSubmission) return;

    if (approvalAction === 'reject' && !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    isLoading = true;
    try {
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();

      const updateData: any = {
        status: approvalAction === 'approve' ? 'approved' : 'rejected',
        reviewed_by: currentUser,
        reviewed_dt: now,
        modified_by: currentUser,
        modified_dt: now
      };

      if (approvalAction === 'reject') {
        updateData.rejection_reason = rejectionReason.trim();
      }

      // Update submission
      const { error: submissionError } = await supabase
        .from('prdn_reporting_submissions')
        .update(updateData)
        .eq('id', selectedSubmission.id);

      if (submissionError) throw submissionError;

      // Update all linked records
      const newStatus = approvalAction === 'approve' ? 'approved' : 'rejected';
      
      // Update work reports
      const { error: worksError } = await supabase
        .from('prdn_work_reporting')
        .update({
          status: newStatus,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('reporting_submission_id', selectedSubmission.id);

      if (worksError) throw worksError;

      // Update manpower reports
      const { error: manpowerError } = await supabase
        .from('prdn_reporting_manpower')
        .update({
          status: newStatus,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('reporting_submission_id', selectedSubmission.id);

      if (manpowerError) throw manpowerError;

      // Update stage reassignments (only if table has status column)
      try {
        const { error: reassignmentsError } = await supabase
          .from('prdn_reporting_stage_reassignment')
          .update({
            status: newStatus,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('reporting_submission_id', selectedSubmission.id);

        if (reassignmentsError) {
          // If error is about missing column, log but don't fail
          if (reassignmentsError.message?.includes('status') || reassignmentsError.message?.includes('column')) {
            console.warn('prdn_reporting_stage_reassignment table may not have status column:', reassignmentsError.message);
            // Try updating without status column
            const { error: reassignmentsErrorNoStatus } = await supabase
              .from('prdn_reporting_stage_reassignment')
              .update({
                modified_by: currentUser,
                modified_dt: now
              })
              .eq('reporting_submission_id', selectedSubmission.id);
            if (reassignmentsErrorNoStatus) {
              console.error('Error updating stage reassignments:', reassignmentsErrorNoStatus);
            }
          } else {
            throw reassignmentsError;
          }
        }
      } catch (error) {
        console.error('Error updating stage reassignments:', error);
        // Don't throw - allow approval to continue even if stage reassignment update fails
      }

      if (approvalAction === 'reject') {
        // Revert all reports to 'draft' status and remove submission_id
        await supabase
          .from('prdn_work_reporting')
          .update({
            status: 'draft',
            reporting_submission_id: null,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('reporting_submission_id', selectedSubmission.id);

        await supabase
          .from('prdn_reporting_manpower')
          .update({
            status: 'draft',
            reporting_submission_id: null,
            modified_by: currentUser,
            modified_dt: now
          })
          .eq('reporting_submission_id', selectedSubmission.id);

        // Update stage reassignments (only if table has status column)
        try {
          const { error: reassignmentsRejectError } = await supabase
            .from('prdn_reporting_stage_reassignment')
            .update({
              status: 'draft',
              reporting_submission_id: null,
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('reporting_submission_id', selectedSubmission.id);
          
          if (reassignmentsRejectError) {
            // If error is about missing column, try without status
            if (reassignmentsRejectError.message?.includes('status') || reassignmentsRejectError.message?.includes('column')) {
              console.warn('prdn_reporting_stage_reassignment table may not have status column:', reassignmentsRejectError.message);
              await supabase
                .from('prdn_reporting_stage_reassignment')
                .update({
                  reporting_submission_id: null,
                  modified_by: currentUser,
                  modified_dt: now
                })
                .eq('reporting_submission_id', selectedSubmission.id);
            } else {
              console.error('Error updating stage reassignments on reject:', reassignmentsRejectError);
            }
          }
        } catch (error) {
          console.error('Error updating stage reassignments on reject:', error);
          // Don't throw - allow rejection to continue
        }
      }

      alert(approvalAction === 'approve' 
        ? 'Reporting approved successfully!' 
        : 'Reporting rejected. Engineer can now modify and resubmit.');
      
      showApprovalModal = false;
      rejectionReason = '';
      selectedSubmission = null;
      await loadPendingSubmissions();
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Error processing approval: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      isLoading = false;
    }
  }

  function handleApprovalCancel() {
    showApprovalModal = false;
    rejectionReason = '';
  }

  async function handleTabChange(tabId: string) {
    activeTab = tabId;
    if (selectedSubmission) {
      await loadSubmissionDetails();
    }
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }
</script>

<svelte:head>
  <title>Reporting Review</title>
</svelte:head>

<!-- Sidebar Overlay -->
{#if showSidebar}
  <div class="fixed inset-0 z-50">
    <button
      type="button"
      aria-label="Close sidebar overlay"
      class="fixed inset-0 bg-black bg-opacity-40 z-40"
      on:click={handleSidebarToggle}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSidebarToggle()}
      style="cursor: pointer; border: none; width: 100%; height: 100%; position: fixed; left: 0; top: 0; background-color: rgba(0,0,0,0.4);"
    ></button>
    <div class="fixed left-0 top-0 h-full w-64 z-50 theme-bg-primary shadow-lg">
      <Sidebar {menus} />
    </div>
  </div>
{/if}

<div class="flex flex-col h-full w-full theme-bg-secondary transition-colors duration-200" style="min-height: 100vh;">
  <!-- Header with Date Selector -->
  <div class="theme-bg-primary border-b theme-border">
    <div class="flex items-center justify-between px-6 py-4">
      <div class="flex items-center gap-4">
        <button 
          class="p-2 theme-bg-secondary hover:theme-bg-secondary rounded-lg transition-colors" 
          on:click={handleSidebarToggle} 
          aria-label="Show sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="text-2xl font-semibold theme-text-primary">Reporting Review</h1>
      </div>
      <div class="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
        <label for="date-selector" class="text-sm font-medium theme-text-secondary">Date:</label>
        <input
          id="date-selector"
          type="date"
          bind:value={selectedDate}
          class="px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg text-sm border"
        />
      </div>
      <div class="flex items-center">
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
  <div class="flex flex-1 p-4 gap-6">
    <!-- Left Sidebar - Split into Pending and Approved Submissions (stacked vertically) -->
    <div class="w-1/3 flex flex-col gap-4">
      <!-- Pending Submissions Section (Above) -->
      <div class="flex-1 theme-bg-primary rounded-lg shadow border theme-border p-4 flex flex-col">
        <div class="mb-4">
          <h3 class="text-lg font-semibold theme-text-primary mb-2">Pending Submissions</h3>
          <select
            bind:value={selectedStage}
            on:change={() => { loadPendingSubmissions(); loadApprovedSubmissions(); }}
            class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg text-sm"
          >
            <option value="">All Stages</option>
            {#each availableStages as stage}
              <option value={stage}>{stage}</option>
            {/each}
          </select>
        </div>

        {#if isSubmissionsLoading}
          <div class="flex items-center justify-center py-8 flex-1">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        {:else if pendingSubmissions.length === 0}
          <div class="text-center py-8 flex-1">
            <p class="theme-text-secondary">No pending submissions</p>
          </div>
        {:else}
          <div class="space-y-2 overflow-y-auto flex-1">
            {#each pendingSubmissions.filter(s => !selectedStage || s.stage_code === selectedStage) as submission}
              <button
                on:click={() => handleSubmissionSelect(submission)}
                class="w-full text-left p-3 rounded-lg border theme-border transition-colors {selectedSubmission?.id === submission.id && selectedSubmission?.status === 'pending_approval' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300' : 'theme-bg-secondary hover:theme-bg-secondary'}"
              >
                <div class="font-medium theme-text-primary">{submission.stage_code}</div>
                <div class="text-sm theme-text-secondary">{submission.reporting_date}</div>
                <div class="text-xs theme-text-secondary mt-1">
                  By: {submission.submitted_by} | {formatDateTimeLocal(submission.submitted_dt)}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
      <!-- Approved Submissions Section (Below) -->
      <div class="flex-1 theme-bg-primary rounded-lg shadow border theme-border p-4 flex flex-col">
        <div class="mb-4">
          <h3 class="text-lg font-semibold theme-text-primary mb-2">Approved Submissions</h3>
        </div>

        {#if isApprovedSubmissionsLoading}
          <div class="flex items-center justify-center py-8 flex-1">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          </div>
        {:else if approvedSubmissions.length === 0}
          <div class="text-center py-8 flex-1">
            <p class="theme-text-secondary">No approved submissions</p>
          </div>
        {:else}
          <div class="space-y-2 overflow-y-auto flex-1">
            {#each approvedSubmissions.filter(s => !selectedStage || s.stage_code === selectedStage) as submission}
              <button
                on:click={() => handleApprovedSubmissionSelect(submission)}
                class="w-full text-left p-3 rounded-lg border theme-border transition-colors {selectedSubmission?.id === submission.id && selectedSubmission?.status === 'approved' ? 'bg-green-50 dark:bg-green-900/20 border-green-300' : 'theme-bg-secondary hover:theme-bg-secondary'}"
              >
                <div class="font-medium theme-text-primary">{submission.stage_code}</div>
                <div class="text-sm theme-text-secondary">{submission.reporting_date}</div>
                <div class="text-xs theme-text-secondary mt-1">
                  Reviewed: {submission.reviewed_by} | {formatDateTimeLocal(submission.reviewed_dt)}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right Content - Submission Details -->
    <div class="flex-1 theme-bg-primary rounded-lg shadow border theme-border p-6">
      {#if !selectedSubmission}
        <div class="text-center py-12">
          <div class="text-6xl mb-4">📊</div>
          <p class="theme-text-secondary text-lg">Select a submission to review</p>
        </div>
      {:else}
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold theme-text-primary">
              Review: {selectedSubmission.stage_code} - {selectedSubmission.reporting_date}
            </h2>
            <p class="text-sm theme-text-secondary mt-1">
              {selectedSubmission.status === 'pending_approval' 
                ? `Submitted by ${selectedSubmission.submitted_by} on ${formatDateTimeLocal(selectedSubmission.submitted_dt)}`
                : `Reviewed by ${selectedSubmission.reviewed_by} on ${formatDateTimeLocal(selectedSubmission.reviewed_dt)}`}
            </p>
          </div>
          <div class="flex gap-2">
            {#if selectedSubmission.status === 'pending_approval'}
              <Button variant="danger" size="sm" on:click={handleReject} disabled={isLoading}>
                Reject
              </Button>
              <Button variant="primary" size="sm" on:click={handleApprove} disabled={isLoading}>
                Approve
              </Button>
            {/if}
            {#if activeTab === 'works-report' && pdfBlob}
              <Button variant="secondary" size="sm" on:click={openWorksReportFullscreen}>
                View PDF
              </Button>
            {/if}
            {#if activeTab === 'works-report'}
              <Button variant="primary" size="sm" on:click={handleGeneratePDF} disabled={isGeneratingPDF || worksReportData.length === 0}>
                {isGeneratingPDF ? 'Generating...' : 'Generate PDF'}
              </Button>
            {/if}
          </div>
        </div>

        <!-- Tabs -->
        <div class="border-b theme-border mb-4">
          <nav class="flex space-x-4">
            {#each tabs as tab}
              <button
                on:click={() => handleTabChange(tab.id)}
                class="px-4 py-2 border-b-2 transition-colors {activeTab === tab.id 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-medium' 
                  : 'border-transparent theme-text-secondary hover:theme-text-primary'}"
              >
                <span class="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            {/each}
          </nav>
        </div>

        <!-- Tab Content -->
        {#if activeTab === 'works-report'}
          {#if isWorksReportLoading}
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
              <span class="theme-text-secondary">Loading works reports...</span>
            </div>
          {:else if worksReportData.length === 0}
            <div class="text-center py-12">
              <p class="theme-text-secondary">No work reports in this submission</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="theme-bg-secondary">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Work Order</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Work Code</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Worker</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Hours Worked</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Status</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Lost Time</th>
                  </tr>
                </thead>
                <tbody class="divide-y theme-border">
                  {#each worksReportData as report}
                    <tr class="hover:theme-bg-secondary">
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {report.prdn_work_planning?.prdn_wo_details?.wo_no || 'N/A'}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {report.prdn_work_planning?.derived_sw_code || report.prdn_work_planning?.other_work_code || 'N/A'}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {#if report.deviations && report.deviations.length > 0}
                          {@const deviation = report.deviations[0]}
                          <div class="flex items-center space-x-2">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                              ⚠️ Deviation: {deviation.deviation_type}
                            </span>
                          </div>
                          <div class="mt-1 text-xs text-orange-600 dark:text-orange-400">
                            {deviation.reason}
                          </div>
                        {:else if report.prdn_work_planning?.hr_emp?.emp_name}
                          {report.prdn_work_planning.hr_emp.emp_name}
                        {:else}
                          <span class="text-gray-400 italic">No worker assigned</span>
                        {/if}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">{report.hours_worked_today || 0}h</td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {report.completion_status === 'C' ? 'Completed' : 'Not Completed'}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {report.lt_minutes_total || 0} min
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {:else if activeTab === 'manpower-report'}
          {#if isManpowerReportLoading}
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
              <span class="theme-text-secondary">Loading manpower reports...</span>
            </div>
          {:else if manpowerReportData.length === 0}
            <div class="text-center py-12">
              <p class="theme-text-secondary">No manpower reports in this submission</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="theme-bg-secondary">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Employee</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Type</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">Details</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">LTP Hours</th>
                    <th class="px-4 py-2 text-left text-xs font-medium theme-text-secondary uppercase">LTNP Hours</th>
                  </tr>
                </thead>
                <tbody class="divide-y theme-border">
                  {#each manpowerReportData as report}
                    <tr class="hover:theme-bg-secondary">
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {report.hr_emp?.emp_name || 'N/A'}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {report.from_stage_code ? 'Reassignment' : 'Attendance'}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {#if report.from_stage_code}
                          {report.from_stage_code} → {report.to_stage_code} ({report.from_time} - {report.to_time})
                        {:else}
                          {report.attendance_status}
                        {/if}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {report.ltp_hours || 0}
                      </td>
                      <td class="px-4 py-2 text-sm theme-text-primary">
                        {report.ltnp_hours || report.calculated_ltnp_hours || 0}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {/if}
      {/if}
    </div>
  </div>
</div>

<!-- Approval Modal -->
{#if showApprovalModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="theme-bg-primary rounded-lg shadow-xl border theme-border p-6 max-w-md w-full mx-4">
      <h3 class="text-lg font-semibold theme-text-primary mb-4">
        {approvalAction === 'approve' ? 'Approve Reporting' : 'Reject Reporting'}
      </h3>
      
      {#if approvalAction === 'reject'}
        <div class="mb-4">
          <label class="block text-sm font-medium theme-text-primary mb-2">
            Reason for Rejection <span class="text-red-500">*</span>
          </label>
          <textarea
            bind:value={rejectionReason}
            rows="4"
            placeholder="Enter reason for rejection..."
            class="w-full px-3 py-2 theme-bg-primary theme-border theme-text-primary rounded-lg"
          ></textarea>
        </div>
      {:else}
        <p class="theme-text-secondary mb-4">
          Are you sure you want to approve this reporting submission?
        </p>
      {/if}

      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" on:click={handleApprovalCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button 
          variant={approvalAction === 'approve' ? 'primary' : 'danger'} 
          size="sm" 
          on:click={handleApprovalConfirm}
          disabled={isLoading || (approvalAction === 'reject' && !rejectionReason.trim())}
        >
          {isLoading ? 'Processing...' : (approvalAction === 'approve' ? 'Approve' : 'Reject')}
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- Fullscreen Works Report PDF Viewer -->
{#if showWorksReportFullscreen && pdfBlob}
  <div class="fixed inset-0 z-[10000] theme-bg-primary flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b theme-border">
      <div>
        <h2 class="text-xl font-semibold theme-text-primary">📊 Works Report - Fullscreen</h2>
        <p class="text-sm theme-text-secondary mt-1">
          {selectedSubmission?.stage_code} - {selectedSubmission?.reporting_date ? new Date(selectedSubmission.reporting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : ''}
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <Button variant="primary" size="sm" on:click={handleGeneratePDF} disabled={isGeneratingPDF}>
          {isGeneratingPDF ? 'Generating...' : 'Regenerate PDF'}
        </Button>
        <button
          on:click={closeWorksReportFullscreen}
          class="p-2 theme-bg-secondary hover:theme-bg-secondary rounded-lg transition-colors"
          title="Close fullscreen"
        >
          <X class="w-6 h-6 theme-text-primary" />
        </button>
      </div>
    </div>
    
    <!-- PDF Viewer - Fullscreen -->
    <div class="flex-1 overflow-hidden" style="height: calc(100vh - 80px);">
      <PDFViewer {pdfBlob} isLoading={isGeneratingPDF} />
    </div>
  </div>
{/if}

<FloatingThemeToggle />

