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
  import { formatTime, formatLostTimeDetails } from '../[stage_Shift]/utils/timeUtils';
  import { groupReportWorks } from '../[stage_Shift]/utils/planTabUtils';

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
  
  // Group works report data
  $: groupedReportWorks = groupReportWorks(worksReportData);

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
        .select('*, version')
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
      
      const { data, error } = await query.order('version', { ascending: false }).order('submitted_dt', { ascending: false });

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
        .select('*, version')
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
      
      const { data, error } = await query.order('version', { ascending: false }).order('reviewed_dt', { ascending: false });

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
          prdn_work_planning(
            *,
            std_work_type_details(derived_sw_code, sw_code, type_description, std_work_details(sw_name)),
            hr_emp(emp_id, emp_name, skill_short),
            prdn_wo_details(wo_no, pwo_no, wo_model, customer_name),
            std_work_skill_mapping(wsm_id, sc_name)
          )
        `)
        .eq('reporting_submission_id', selectedSubmission.id)
        .eq('is_deleted', false)
        .order('from_time', { ascending: true });

      if (worksError) throw worksError;
      let rawWorksReportData = worksData || [];
      
      // Load deviations for all reports
      const reportIds = (rawWorksReportData || []).map((r: any) => r.id).filter(Boolean);
      let deviationsMap = new Map<number, any[]>();
      if (reportIds.length > 0) {
        const { getDeviationsForReportings } = await import('$lib/services/workReportingDeviationService');
        deviationsMap = await getDeviationsForReportings(reportIds);
      }
      
      // Enrich work reports with skill-specific time standards and vehicle work flow
      worksReportData = await Promise.all(
        rawWorksReportData.map(async (report: any) => {
          // Attach deviations to report
          const deviations = deviationsMap.get(report.id) || [];
          report.deviations = deviations;
          
          const planningRecord = report.prdn_work_planning;
          const derivedSwCode = planningRecord?.std_work_type_details?.derived_sw_code;
          const skillShort = planningRecord?.hr_emp?.skill_short;
          const scRequired = planningRecord?.sc_required;
          
          // Fetch vehicle work flow
          let vehicleWorkFlow = null;
          if (derivedSwCode) {
            try {
              const { data: vwfData } = await supabase
                .from('std_vehicle_work_flow')
                .select('estimated_duration_minutes')
                .eq('derived_sw_code', derivedSwCode)
                .eq('is_deleted', false)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();
              vehicleWorkFlow = vwfData;
            } catch (error) {
              console.error('Error fetching vehicle work flow:', error);
            }
          }
          
          if (!derivedSwCode || !skillShort || !scRequired) {
            return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
          }

          // Find skill combination that contains the required skill
          let matchingWsm = null;
          try {
            const { data: allMappings } = await supabase
              .from('std_work_skill_mapping')
              .select(`
                wsm_id,
                sc_name,
                std_skill_combinations!inner(
                  skill_combination
                )
              `)
              .eq('derived_sw_code', derivedSwCode)
              .eq('is_deleted', false)
              .eq('is_active', true);

            if (allMappings && allMappings.length > 0) {
              for (const mapping of allMappings) {
                const skillCombination = (mapping as any).std_skill_combinations?.skill_combination;
                if (skillCombination && Array.isArray(skillCombination)) {
                  const hasSkill = skillCombination.some((skill: any) => 
                    skill.skill_name === scRequired || skill.skill_short === scRequired
                  );
                  if (hasSkill) {
                    matchingWsm = mapping;
                    break;
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching skill mappings:', error);
          }

          if (!matchingWsm) {
            return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
          }

          // Get skill time standard
          let skillTimeStandard = null;
          try {
            const { data: stsData } = await supabase
              .from('std_skill_time_standards')
              .select('*')
              .eq('wsm_id', matchingWsm.wsm_id)
              .eq('skill_short', scRequired)
              .eq('is_deleted', false)
              .eq('is_active', true)
              .maybeSingle();
            skillTimeStandard = stsData;
          } catch (error) {
            console.error('Error fetching skill time standard:', error);
          }
          
          // Calculate remaining time
          let remainingTimeMinutes = null;
          if (skillTimeStandard && skillTimeStandard.standard_time_minutes) {
            const totalWorkedMinutes = ((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0)) * 60;
            remainingTimeMinutes = Math.max(0, skillTimeStandard.standard_time_minutes - totalWorkedMinutes);
          }

          return {
            ...report,
            skillTimeStandard: skillTimeStandard,
            skillMapping: matchingWsm,
            vehicleWorkFlow: vehicleWorkFlow,
            remainingTimeMinutes: remainingTimeMinutes
          };
        })
      );

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
      // Try with reporting_submission_id first, fallback to date/stage if column doesn't exist
      let reassignmentsData: any[] = [];
      let reassignmentsError: any = null;
      
      try {
        const { data, error } = await supabase
          .from('prdn_reporting_stage_reassignment')
          .select(`
            *,
            hr_emp!inner(emp_id, emp_name, skill_short)
          `)
          .eq('reporting_submission_id', selectedSubmission.id)
          .eq('is_deleted', false);
        
        reassignmentsData = data || [];
        reassignmentsError = error;
      } catch (err: any) {
        // If column doesn't exist, try querying by date and stage
        if (err?.message?.includes('reporting_submission_id') || err?.code === '42703') {
          console.warn('reporting_submission_id column not found, using fallback query');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('prdn_reporting_stage_reassignment')
            .select(`
              *,
              hr_emp!inner(emp_id, emp_name, skill_short)
            `)
            .eq('reporting_date', selectedSubmission.reporting_date)
            .eq('to_stage_code', selectedSubmission.stage_code)
            .eq('is_deleted', false);
          
          reassignmentsData = fallbackData || [];
          reassignmentsError = fallbackError;
        } else {
          reassignmentsError = err;
        }
      }
      
      if (reassignmentsError && !reassignmentsError.message?.includes('reporting_submission_id')) {
        console.warn('Error loading stage reassignments:', reassignmentsError);
        // Don't throw - continue without stage reassignments
      }
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

      // Update stage reassignments (only if table has status column and reporting_submission_id)
      try {
        // First try with reporting_submission_id
        let reassignmentsError: any = null;
        try {
          const { error } = await supabase
            .from('prdn_reporting_stage_reassignment')
            .update({
              status: newStatus,
              modified_by: currentUser,
              modified_dt: now
            })
            .eq('reporting_submission_id', selectedSubmission.id);
          
          reassignmentsError = error;
        } catch (err: any) {
          // If reporting_submission_id column doesn't exist, use fallback
          if (err?.message?.includes('reporting_submission_id') || err?.code === '42703') {
            console.warn('reporting_submission_id column not found, using fallback update');
            const { error: fallbackError } = await supabase
              .from('prdn_reporting_stage_reassignment')
              .update({
                status: newStatus,
                modified_by: currentUser,
                modified_dt: now
              })
              .eq('reporting_date', selectedSubmission.reporting_date)
              .eq('to_stage_code', selectedSubmission.stage_code);
            
            reassignmentsError = fallbackError;
          } else {
            reassignmentsError = err;
          }
        }

        if (reassignmentsError) {
          // If error is about missing column, log but don't fail
          if (reassignmentsError.message?.includes('status') || reassignmentsError.message?.includes('column')) {
            console.warn('prdn_reporting_stage_reassignment table may not have status column:', reassignmentsError.message);
            // Try updating without status column
            let updateError: any = null;
            try {
              const { error } = await supabase
                .from('prdn_reporting_stage_reassignment')
                .update({
                  modified_by: currentUser,
                  modified_dt: now
                })
                .eq('reporting_submission_id', selectedSubmission.id);
              
              updateError = error;
            } catch (err: any) {
              // If reporting_submission_id doesn't exist, use fallback
              if (err?.message?.includes('reporting_submission_id') || err?.code === '42703') {
                const { error: fallbackError } = await supabase
                  .from('prdn_reporting_stage_reassignment')
                  .update({
                    modified_by: currentUser,
                    modified_dt: now
                  })
                  .eq('reporting_date', selectedSubmission.reporting_date)
                  .eq('to_stage_code', selectedSubmission.stage_code);
                
                updateError = fallbackError;
              } else {
                updateError = err;
              }
            }
            
            if (updateError) {
              console.error('Error updating stage reassignments:', updateError);
            }
          } else {
            console.warn('Error updating stage reassignments:', reassignmentsError);
            // Don't throw - allow approval to continue even if stage reassignment update fails
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

        // Update stage reassignments (only if table has status column and reporting_submission_id)
        try {
          let reassignmentsRejectError: any = null;
          try {
            const { error } = await supabase
              .from('prdn_reporting_stage_reassignment')
              .update({
                status: 'draft',
                reporting_submission_id: null,
                modified_by: currentUser,
                modified_dt: now
              })
              .eq('reporting_submission_id', selectedSubmission.id);
            
            reassignmentsRejectError = error;
          } catch (err: any) {
            // If reporting_submission_id column doesn't exist, use fallback
            if (err?.message?.includes('reporting_submission_id') || err?.code === '42703') {
              console.warn('reporting_submission_id column not found, using fallback update for reject');
              const { error: fallbackError } = await supabase
                .from('prdn_reporting_stage_reassignment')
                .update({
                  status: 'draft',
                  modified_by: currentUser,
                  modified_dt: now
                })
                .eq('reporting_date', selectedSubmission.reporting_date)
                .eq('to_stage_code', selectedSubmission.stage_code);
              
              reassignmentsRejectError = fallbackError;
            } else {
              reassignmentsRejectError = err;
            }
          }
          
          if (reassignmentsRejectError) {
            // If error is about missing column, try without status
            if (reassignmentsRejectError.message?.includes('status') || reassignmentsRejectError.message?.includes('column')) {
              console.warn('prdn_reporting_stage_reassignment table may not have status column:', reassignmentsRejectError.message);
              let updateError: any = null;
              try {
                const { error } = await supabase
                  .from('prdn_reporting_stage_reassignment')
                  .update({
                    reporting_submission_id: null,
                    modified_by: currentUser,
                    modified_dt: now
                  })
                  .eq('reporting_submission_id', selectedSubmission.id);
                
                updateError = error;
              } catch (err: any) {
                // If reporting_submission_id doesn't exist, use fallback
                if (err?.message?.includes('reporting_submission_id') || err?.code === '42703') {
                  const { error: fallbackError } = await supabase
                    .from('prdn_reporting_stage_reassignment')
                    .update({
                      modified_by: currentUser,
                      modified_dt: now
                    })
                    .eq('reporting_date', selectedSubmission.reporting_date)
                    .eq('to_stage_code', selectedSubmission.stage_code);
                  
                  updateError = fallbackError;
                } else {
                  updateError = err;
                }
              }
              
              if (updateError) {
                console.error('Error updating stage reassignments on reject:', updateError);
              }
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
                <div class="font-medium theme-text-primary">
                  {submission.stage_code}
                  {#if submission.version && submission.version > 1}
                    <span class="text-xs font-normal theme-text-secondary"> (v{submission.version})</span>
                  {/if}
                </div>
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
                <div class="font-medium theme-text-primary">
                  {submission.stage_code}
                  {#if submission.version && submission.version > 1}
                    <span class="text-xs font-normal theme-text-secondary"> (v{submission.version})</span>
                  {/if}
                </div>
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
              {#if selectedSubmission.version && selectedSubmission.version > 1}
                <span class="text-sm font-normal theme-text-secondary">(v{selectedSubmission.version})</span>
              {/if}
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
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: fixed; width: 100%;">
                <thead class="theme-bg-secondary">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 100px;">Work Order</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">PWO Number</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Work Code</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 250px;">Work Name</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 180px;">Skills Required</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Standard Time</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 180px;">Worker (Skill)</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Time Worked Till Date</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 100px;">From Time</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 100px;">To Time</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Hours Worked</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 140px;">Total Hours Worked</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">OT Hours</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 120px;">Lost Time</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 200px;">Reason</th>
                    <th class="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="width: 150px;">Reported On</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {#each Object.values(groupedReportWorks) as group (group.workCode)}
                    {@const typedGroup = group}
                    <!-- Single Row per Work -->
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
                        class:lost-time={typedGroup.hasLostTime}>
                      <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {typedGroup.woNo}
                      </td>
                      <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {typedGroup.pwoNo}
                      </td>
                      <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {typedGroup.workCode}
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100" style="word-wrap: break-word;">
                        {typedGroup.workName}
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-wrap gap-1">
                          {#each typedGroup.items as report}
                            {@const skillName = report.skillMapping?.sc_name || report.prdn_work_planning?.std_work_skill_mapping?.sc_name || report.prdn_work_planning?.sc_required || 'N/A'}
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              {skillName}
                            </span>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {#if typedGroup.items && typedGroup.items.length > 0}
                          {@const firstItem = typedGroup.items[0]}
                          {#if firstItem?.vehicleWorkFlow?.estimated_duration_minutes}
                            {formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60)}
                          {:else if firstItem?.skillTimeStandard?.standard_time_minutes}
                            {formatTime(firstItem.skillTimeStandard.standard_time_minutes / 60)}
                          {:else}
                            N/A
                          {/if}
                        {:else}
                          N/A
                        {/if}
                      </td>
                      <td class="px-4 py-2 text-sm">
                        <div class="flex flex-wrap gap-1">
                          {#each typedGroup.items as report}
                            {#if report.completion_status === 'C'}
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Completed</span>
                            {:else if report.completion_status === 'NC'}
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">Not Completed</span>
                            {:else}
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                {report.completion_status || 'Unknown'}
                              </span>
                            {/if}
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">
                              {#if report.deviations && report.deviations.length > 0}
                                {@const deviation = report.deviations[0]}
                                <div class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                                  ⚠️ {deviation.deviation_type}
                                </div>
                                <div class="mt-0.5 text-xs text-orange-600 dark:text-orange-400 truncate" title={deviation.reason}>
                                  {deviation.reason}
                                </div>
                              {:else if report.worker_id && report.prdn_work_planning?.hr_emp}
                                <span class="font-medium">{report.prdn_work_planning.hr_emp.emp_name || 'N/A'}</span>
                                <span class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}"> ({report.prdn_work_planning.hr_emp.skill_short || 'N/A'})</span>
                              {:else}
                                <span class="text-gray-400 italic text-xs">No worker</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs font-medium">
                              {formatTime(report.hours_worked_till_date || 0)}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">{report.from_time || 'N/A'}</div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">{report.to_time || 'N/A'}</div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">
                              <div class="font-medium">
                                {formatTime(report.hours_worked_today || 0)}
                              </div>
                              {#if report.skillTimeStandard}
                                <div class="text-xs text-gray-600 dark:text-gray-400">
                                  Std: {formatTime(report.skillTimeStandard.standard_time_minutes / 60)}
                                </div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">
                                  Rem: {formatTime(report.remainingTimeMinutes / 60)}
                                </div>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs font-medium">
                              {formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0))}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">
                              {#if report.overtime_minutes && report.overtime_minutes > 0}
                                <span class="text-orange-600 dark:text-orange-400 font-medium">
                                  {formatTime((report.overtime_minutes || 0) / 60)}
                                </span>
                              {:else}
                                <span class="text-gray-400">-</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">
                              {#if report.lt_minutes_total > 0}
                                <span class="text-yellow-600 dark:text-yellow-400 font-medium">
                                  {report.lt_minutes_total}m
                                </span>
                              {:else}
                                <span class="text-green-600 dark:text-green-400">-</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs truncate text-gray-700 dark:text-gray-300" title={report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0 ? formatLostTimeDetails(report.lt_details) : ''}>
                              {#if report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0}
                                {formatLostTimeDetails(report.lt_details)}
                              {:else if report.lt_minutes_total > 0}
                                <span class="text-gray-500 dark:text-gray-400">N/A</span>
                              {:else}
                                <span class="text-gray-500 dark:text-gray-400">-</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <div class="flex flex-col gap-0.5">
                          {#each typedGroup.items as report}
                            <div class="text-xs">{formatDateTimeLocal(report.created_dt)}</div>
                          {/each}
                        </div>
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

