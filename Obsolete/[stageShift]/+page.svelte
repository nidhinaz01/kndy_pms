<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabaseClient';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import FloatingThemeToggle from '$lib/components/common/FloatingThemeToggle.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { fetchUserMenus } from '$lib/services/menuService';
  import ManpowerTable from '$lib/components/production/ManpowerTable.svelte';
  import WorksTable from '$lib/components/production/WorksTable.svelte';
  import PlanWorkModal from '$lib/components/production/PlanWorkModal.svelte';
  import ReportWorkModal from '$lib/components/production/ReportWorkModal.svelte';
  import MultiSkillReportModal from '$lib/components/production/MultiSkillReportModal.svelte';
  import ViewWorkHistoryModal from '$lib/components/production/ViewWorkHistoryModal.svelte';
  import RemoveWorkModal from '$lib/components/production/RemoveWorkModal.svelte';
  import AddWorkModal from '$lib/components/production/AddWorkModal.svelte';
  import { calculateWorkingDays } from '$lib/api/holidays';
  import type { ProductionEmployee, ProductionWork } from '$lib/api/production';
  import { formatDateTimeLocal, formatDateLocal, parseUTCDate } from '$lib/utils/formatDate';
  import { formatTimeVerbose, formatTimeFromMinutes } from '$lib/utils/timeFormatUtils';
  import { calculateBreakTimeInMinutes } from '$lib/utils/breakTimeUtils';
  import * as XLSX from 'xlsx';
  import { exportToCSV } from '$lib/utils/exportUtils';
  // Import production services
  import { 
    loadStageManpower, 
    loadStageWorkOrders, 
    loadStageWorks, 
    loadStagePlannedWorks,
    loadShiftBreakTimes
  } from '../services/stageProductionService';
  import {
    getWaitingWorkOrdersForEntry,
    getAvailableWorkOrdersForExit,
    recordWorkOrderEntry,
    recordWorkOrderExit
  } from '../services/stageWorkOrderService';
  import {
    getDraftWorkPlans,
    getDraftManpowerPlans,
    getDraftStageReassignmentPlans,
    submitPlanning,
    getDraftWorkReports,
    getDraftManpowerReports,
    submitReporting
  } from '$lib/api/production/planningReportingService';
  import { 
    parseStageShiftParam, 
    getStageShiftDisplayName, 
    formatStageShiftExportFilename 
  } from '../utils/stageUtils';

  // Parse route parameters to get stage and shift codes
  $: stageShiftParam = $page.params.stageShift || '{stageCode}-GEN';
  $: parsedParams = parseStageShiftParam(stageShiftParam);
  $: stageCode = parsedParams?.stageCode || '{stageCode}';
  $: shiftCode = parsedParams?.shiftCode || 'GEN';
  
  // Validate route parameters
  $: if (!parsedParams) {
    console.error(`Invalid route parameter: ${stageShiftParam}. Expected format: STAGE-SHIFT (e.g., {stageCode}-GEN)`);
  }

  // CSV escaping helper function
  function escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If the value contains comma, newline, or double quote, wrap it in quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      // Escape any existing double quotes by doubling them
      const escapedValue = stringValue.replace(/"/g, '""');
      return `"${escapedValue}"`;
    }
    
    return stringValue;
  }

  // Tab management
  let activeTab = 'work-orders';
  const tabs = [
    { id: 'work-orders', label: 'Work Orders', icon: '📦' },
    { id: 'works', label: 'Works', icon: '🔧' },
    { id: 'manpower-plan', label: 'Manpower Plan', icon: '👥📋' },
    { id: 'draft-plan', label: 'Draft Plan', icon: '📝' },
    { id: 'plan', label: 'Plan', icon: '📋' },
    { id: 'manpower-report', label: 'Manpower Report', icon: '👥📊' },
    { id: 'draft-report', label: 'Draft Report', icon: '📝' },
    { id: 'report', label: 'Report', icon: '📊' }
  ];

  // Common state
  let showSidebar = false;
  let menus: any[] = [];
  let isLoading = true;
  let selectedDate = new Date().toISOString().split('T')[0]; // Current date as default

  // Manpower Plan tab state
  let manpowerPlanData: ProductionEmployee[] = [];
  let isManpowerPlanLoading = false;
  
  // Manpower Report tab state
  let manpowerReportData: ProductionEmployee[] = [];
  let isManpowerReportLoading = false;
  
  // Draft Plan tab state
  let draftPlanData: any[] = [];
  let draftManpowerPlanData: any[] = [];
  let isDraftPlanLoading = false;
  
  // Draft Report tab state
  let draftReportData: any[] = [];
  let draftManpowerReportData: any[] = [];
  let isDraftReportLoading = false;

  // Work Orders tab state
  let workOrdersData: any[] = [];
  let isWorkOrdersLoading = false;

  // Works tab state
  let worksData: ProductionWork[] = [];
  let isWorksLoading = false;

  // Plan modal state
  let showPlanModal = false;
  let selectedWorkForPlanning: any = null;

  // Report modal state
  let showReportModal = false;
  let selectedWorkForReporting: any = null;

  // View work history modal state
  let showViewWorkHistoryModal = false;
  let selectedWorkForHistory: any = null;

  // Remove work modal state
  let showRemoveWorkModal = false;
  let selectedWorkForRemoval: any = null;

  // Add work modal state
  let showAddWorkModal = false;
  let availableWorkOrdersForAdd: Array<{id: number, wo_no: string | null, pwo_no: string | null, wo_model: string}> = [];

  // Entry modal state
  let showEntryModal = false;
  let waitingWorkOrdersForEntry: any[] = [];
  let selectedWorkOrderForEntry: any = null;
  let isEntryModalLoading = false;
  let entryProgressMessage = '';

  // Exit modal state
  let showExitModal = false;
  let availableWorkOrdersForExit: any[] = [];
  let selectedWorkOrderForExit: any = null;
  let isExitModalLoading = false;
  let exitProgressMessage = '';
  let exitDate = '';

  // Shift break times cache (for break time calculation in Plan tab)
  let shiftBreakTimes: Array<{ start_time: string; end_time: string }> = [];

  // Debug: Log modal state changes
  $: if (showAddWorkModal) {
    console.log('showAddWorkModal changed to true');
  }

  // Report tab state
  let reportData: any[] = [];
  let isReportLoading = false;
  let expandedReportGroups: string[] = [];

  // Plan tab state
  let plannedWorksData: any[] = [];
  let isPlannedWorksLoading = false;
  let expandedGroups: string[] = [];
  let selectedRows: Set<string> = new Set();
  let showMultiReportModal = false;
  let selectedWorksForMultiReport: any[] = [];
  let plannedWorksWithStatus: any[] = [];

  // Type for grouped planned works
  interface GroupedPlannedWork {
    workCode: string;
    workName: string;
    woNo: string;
    pwoNo: string;
    items: any[];
  }

  // Type for grouped report works
  interface GroupedReportWork {
    workCode: string;
    workName: string;
    woNo: string;
    pwoNo: string;
    items: any[];
    hasLostTime: boolean;
    totalLostTime: number;
  }

  // Group planned works by work code
  $: groupedPlannedWorks = (plannedWorksWithStatus || []).reduce((groups, work) => {
    if (!work) return groups;
    // For non-standard works, use other_work_code; for standard works, use derived_sw_code
    const workCode = work.other_work_code || work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code || 'unknown';
    // For non-standard works, get name from workAdditionData; for standard works, use std_work_type_details
    let workName = '';
    if (work.other_work_code) {
      // Non-standard work
      if (work.workAdditionData?.other_work_desc) {
        workName = work.workAdditionData.other_work_desc;
      } else {
        console.warn(`⚠️ No workAdditionData.other_work_desc for non-standard work ${work.other_work_code}. workAdditionData:`, work.workAdditionData);
        workName = work.other_work_code; // Fallback to code
      }
    } else {
      // Standard work
      workName = work.std_work_type_details?.std_work_details?.sw_name || '';
    }
    const typeDescription = work.std_work_type_details?.type_description || '';
    const fullWorkName = workName + (typeDescription ? (workName ? ' - ' : '') + typeDescription : '');
    
    if (!groups[workCode]) {
      groups[workCode] = {
        workCode,
        workName: fullWorkName,
        woNo: work.prdn_wo_details?.wo_no || 'N/A',
        pwoNo: work.prdn_wo_details?.pwo_no || 'N/A',
        items: []
      };
    }
    groups[workCode].items.push(work);
    return groups;
  }, {});

  // Group report works by derived work code
  $: groupedReportWorks = reportData.reduce((groups, report) => {
    const workCode = report.prdn_work_planning?.std_work_type_details?.derived_sw_code || report.prdn_work_planning?.std_work_type_details?.sw_code || 'unknown';
    const workName = report.prdn_work_planning?.std_work_type_details?.std_work_details?.sw_name || '';
    const typeDescription = report.prdn_work_planning?.std_work_type_details?.type_description || '';
    const fullWorkName = workName + (typeDescription ? (workName ? ' - ' : '') + typeDescription : '');
    
    if (!groups[workCode]) {
      groups[workCode] = {
        workCode,
        workName: fullWorkName,
        woNo: report.prdn_work_planning?.prdn_wo_details?.wo_no || 'N/A',
        pwoNo: report.prdn_work_planning?.prdn_wo_details?.pwo_no || 'N/A',
        items: [],
        hasLostTime: false,
        totalLostTime: 0
      };
    }
    
    // Check for lost time
    const lostTime = report.lt_minutes_total || 0;
    if (lostTime > 0) {
      groups[workCode].hasLostTime = true;
      groups[workCode].totalLostTime += lostTime;
    }
    
    groups[workCode].items.push(report);
    return groups;
  }, {});

  // Debug grouped data (can be removed in production)
  $: {
    // console.log('📊 Planned works data:', plannedWorksData);
    // console.log('📊 Grouped planned works:', groupedPlannedWorks);
    // console.log('📊 Expanded groups:', expandedGroups);
    // console.log('📊 Report data:', reportData);
    // console.log('📊 Grouped report works:', groupedReportWorks);
  }

  // Functions for group expansion
  function toggleGroup(workCode: string) {
    if (expandedGroups.includes(workCode)) {
      expandedGroups = expandedGroups.filter(code => code !== workCode);
    } else {
      expandedGroups = [...expandedGroups, workCode];
    }
  }

  // Functions for report group expansion
  function toggleReportGroup(workCode: string) {
    if (expandedReportGroups.includes(workCode)) {
      expandedReportGroups = expandedReportGroups.filter(code => code !== workCode);
    } else {
      expandedReportGroups = [...expandedReportGroups, workCode];
    }
  }

  // Make this reactive to ensure UI updates
  $: isGroupExpanded = (workCode: string) => {
    return expandedGroups.includes(workCode);
  };

  // Make this reactive to ensure UI updates for reports
  $: isReportGroupExpanded = (workCode: string) => {
    return expandedReportGroups.includes(workCode);
  };

  // Tab change handler
  async function handleTabChange(tabId: string) {
    console.log(`🔄 Switching to tab: ${tabId}`);
    activeTab = tabId;
    
    // Load data for the selected tab
    if (tabId === 'work-orders') {
      await loadWorkOrdersData();
    } else if (tabId === 'works') {
      await loadWorksData();
    } else if (tabId === 'manpower-plan') {
      await loadManpowerPlanData();
    } else if (tabId === 'draft-plan') {
      await loadDraftPlanData();
    } else if (tabId === 'plan') {
      await loadPlannedWorksData();
    } else if (tabId === 'manpower-report') {
      await loadManpowerReportData();
    } else if (tabId === 'draft-report') {
      await loadDraftReportData();
    } else if (tabId === 'report') {
      await loadReportData();
    }
    
    console.log(`✅ Tab ${tabId} data loaded`);
  }

  function handleSidebarToggle() {
    showSidebar = !showSidebar;
  }


  // Load work orders data for the stage
  async function loadWorkOrdersData() {
    if (!selectedDate) return;
    
    isWorkOrdersLoading = true;
    try {
      console.log(`🔍 Loading work orders for ${stageCode} on date: ${selectedDate}`);
      workOrdersData = await loadStageWorkOrders(stageCode, selectedDate);
      console.log(`📦 Active Work Orders found for ${stageCode} on ${selectedDate}:`, workOrdersData.length);
    } catch (error) {
      console.error('Error loading work orders data:', error);
      workOrdersData = [];
    } finally {
      isWorkOrdersLoading = false;
    }
  }

  // Load works data for the stage
  async function loadWorksData() {
    if (!selectedDate) return;
    
    isWorksLoading = true;
    try {
      worksData = await loadStageWorks(stageCode, selectedDate);
    } catch (error) {
      console.error('Error loading works data:', error);
      worksData = [];
    } finally {
      isWorksLoading = false;
    }
  }

  // Load planned works data for the stage
  async function loadPlannedWorksData() {
    if (!selectedDate) return;
    
    isPlannedWorksLoading = true;
    try {
      // Ensure date is in YYYY-MM-DD format for the query
      let dateStr: string;
      if (typeof selectedDate === 'string') {
        dateStr = selectedDate.split('T')[0];
      } else if (selectedDate && typeof selectedDate === 'object' && 'toISOString' in selectedDate) {
        dateStr = (selectedDate as Date).toISOString().split('T')[0];
      } else {
        dateStr = String(selectedDate || '').split('T')[0];
      }
      
      // Only load approved plans for Plan tab
      plannedWorksData = await loadStagePlannedWorks(stageCode, dateStr, 'approved');
      console.log(`📋 Loaded ${plannedWorksData.length} planned works for ${stageCode} on ${dateStr}`);
      
      // Log any soft-deleted records that might have been filtered
      if (plannedWorksData.length === 0) {
        console.log(`ℹ️ No active planning records found for ${dateStr} (all may be soft-deleted or not planned)`);
      }
      
      // Enrich with skill-specific time standards
      // Track warned combinations to avoid duplicate warnings
      const warnedCombinations = new Set<string>();
      
      const enrichedPlannedWorks = await Promise.all(
        plannedWorksData.map(async (plannedWork) => {
          const derivedSwCode = plannedWork.derived_sw_code;
          const otherWorkCode = plannedWork.other_work_code;
          const skillShort = plannedWork.hr_emp?.skill_short;
          const scRequired = plannedWork.sc_required;
          const wsmId = plannedWork.wsm_id;
          
          // For non-standard works, fetch work description from prdn_work_additions
          let workAdditionData = null;
          if (otherWorkCode) {
            try {
              // Try to find the work addition record
              // First try with all conditions
              // Use dynamic stageCode from route params
              let query = supabase
                .from('prdn_work_additions')
                .select('other_work_code, other_work_desc, other_work_sc')
                .eq('other_work_code', otherWorkCode)
                .eq('stage_code', stageCode);
              
              if (plannedWork.wo_details_id) {
                query = query.eq('wo_details_id', plannedWork.wo_details_id);
              }
              
              const { data: additionData, error: additionError } = await query.maybeSingle();
              
              if (additionError) {
                console.error(`Error fetching work addition data for ${otherWorkCode}:`, additionError);
                // Try without wo_details_id filter as fallback
                const { data: fallbackData, error: fallbackError } = await supabase
                  .from('prdn_work_additions')
                  .select('other_work_code, other_work_desc, other_work_sc')
                  .eq('other_work_code', otherWorkCode)
                  .eq('stage_code', stageCode)
                  .maybeSingle();
                
                if (!fallbackError && fallbackData) {
                  workAdditionData = fallbackData;
                  console.log(`✅ Fetched work addition data (fallback) for ${otherWorkCode}:`, fallbackData);
                }
              } else if (additionData) {
                workAdditionData = additionData;
                console.log(`✅ Fetched work addition data for ${otherWorkCode}:`, additionData);
              } else {
                console.warn(`⚠️ No work addition data found for ${otherWorkCode} (stage: ${stageCode}, wo_details_id: ${plannedWork.wo_details_id})`);
              }
            } catch (error) {
              console.error(`Error fetching work addition data for ${otherWorkCode}:`, error);
            }
          }
          
          // First, try to get skill mapping using wsm_id if available
          let matchingWsm = null;
          if (wsmId) {
            try {
              const { data: wsmData, error: wsmError } = await supabase
                .from('std_work_skill_mapping')
                .select(`
                  wsm_id,
                  sc_name,
                  std_skill_combinations!inner(
                    skill_combination
                  )
                `)
                .eq('wsm_id', wsmId)
                .eq('is_deleted', false)
                .eq('is_active', true)
                .maybeSingle();
              
              if (!wsmError && wsmData) {
                matchingWsm = wsmData;
              }
            } catch (error) {
              console.debug(`Error fetching skill mapping by wsm_id ${wsmId}:`, error);
            }
          }
          
          // Fallback: if wsm_id not available or not found, search by derived_sw_code and sc_required
          if (!matchingWsm && derivedSwCode && scRequired) {
            try {
            // Get all work-skill mappings for this work code
            const { data: allMappings, error: mappingsError } = await supabase
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

              if (!mappingsError && allMappings && allMappings.length > 0) {
            // Find the skill combination that contains the required skill
            for (const mapping of allMappings) {
              const skillCombination = (mapping as any).std_skill_combinations?.skill_combination;
              if (skillCombination && Array.isArray(skillCombination)) {
                // Check if this skill combination contains the required skill
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
              console.debug(`Error fetching skill mappings for ${derivedSwCode}:`, error);
            }
          }
          
          // Fetch std_vehicle_work_flow to get estimated_duration_minutes (same as Duration in Works tab)
          // Just use derived_sw_code like Works tab does (no wo_type_id filter)
          let vehicleWorkFlow = null;
          if (derivedSwCode) {
            try {
              const { data: vwfData, error: vwfError } = await supabase
                .from('std_vehicle_work_flow')
                .select('estimated_duration_minutes')
                .eq('derived_sw_code', derivedSwCode)
                .eq('is_deleted', false)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();
              
              if (!vwfError && vwfData) {
                vehicleWorkFlow = vwfData;
              } else if (vwfError) {
                console.debug(`Error fetching vehicle work flow for ${derivedSwCode}:`, vwfError);
              }
            } catch (error) {
              console.debug(`Error fetching vehicle work flow for ${derivedSwCode}:`, error);
            }
          }
          
          // For non-standard works, skip skill time standard lookup (they don't have derived_sw_code)
          // But still return the work with skillMapping if found
          if (!derivedSwCode) {
            // This is a non-standard work - return it without skill time standard
            return { 
              ...plannedWork, 
              skillTimeStandard: null,
              skillMapping: matchingWsm,
              workAdditionData: workAdditionData,
              vehicleWorkFlow: vehicleWorkFlow // Include vehicle work flow data
            };
          }
          
          if (!skillShort || !scRequired) {
            return { 
              ...plannedWork, 
              skillTimeStandard: null,
              skillMapping: matchingWsm,
              workAdditionData: workAdditionData,
              vehicleWorkFlow: vehicleWorkFlow
            };
          }

          try {
            if (!matchingWsm) {
              const warningKey = `wsm:${derivedSwCode}:${scRequired}`;
              if (!warnedCombinations.has(warningKey)) {
                console.debug(`No work-skill mapping found for ${derivedSwCode} containing skill ${scRequired}`);
                warnedCombinations.add(warningKey);
              }
              return { 
                ...plannedWork, 
                skillTimeStandard: null,
                skillMapping: null,
                workAdditionData: workAdditionData,
                vehicleWorkFlow: vehicleWorkFlow
              };
            }

            // Get the skill time standard for this specific skill competency
            // Use sc_required (the skill required for the work) instead of skillShort (worker's skill)
            const { data: stsData, error: stsError } = await supabase
              .from('std_skill_time_standards')
              .select('*')
              .eq('wsm_id', matchingWsm.wsm_id)
              .eq('skill_short', scRequired) // Use sc_required (work's required skill), not worker's skill
              .eq('is_deleted', false)
              .eq('is_active', true)
              .maybeSingle();

            if (stsError || !stsData) {
              const warningKey = `sts:${derivedSwCode}:${scRequired}`;
              if (!warnedCombinations.has(warningKey)) {
                console.debug(`No skill time standard found for ${derivedSwCode} skill ${scRequired} (wsm_id: ${matchingWsm.wsm_id})`);
                warnedCombinations.add(warningKey);
              }
              return { 
                ...plannedWork, 
                skillTimeStandard: null,
                skillMapping: matchingWsm,
                workAdditionData: workAdditionData,
                vehicleWorkFlow: vehicleWorkFlow
              };
            }

            return { 
              ...plannedWork, 
              skillTimeStandard: stsData,
              skillMapping: matchingWsm,
              workAdditionData: workAdditionData,
              vehicleWorkFlow: vehicleWorkFlow,
              // Calculate remaining time for this skill competency
              remainingTimeMinutes: Math.max(0, stsData.standard_time_minutes - (plannedWork.time_worked_till_date || 0) * 60)
            };
          } catch (error) {
            console.error(`Error enriching planned work data for ${derivedSwCode}:`, error);
            return { 
              ...plannedWork, 
              skillTimeStandard: null,
              skillMapping: matchingWsm,
              workAdditionData: workAdditionData,
              vehicleWorkFlow: vehicleWorkFlow
            };
          }
        })
      );

      plannedWorksData = enrichedPlannedWorks;
      console.log(`📋 Enriched ${plannedWorksData.length} planned works with skill-specific data`);
      
      // Calculate work lifecycle status for each planned work
      await calculatePlannedWorksStatus();
    } catch (error) {
      console.error('Error loading planned works data:', error);
      plannedWorksData = [];
    } finally {
      isPlannedWorksLoading = false;
    }
  }

  // Calculate work lifecycle status for planned works
  async function calculatePlannedWorksStatus() {
    if (!plannedWorksData || plannedWorksData.length === 0) {
      plannedWorksWithStatus = [];
      return;
    }

    console.log(`🔍 Starting status calculation for ${plannedWorksData.length} planned works`);

    try {
      const worksWithStatus = await Promise.all(
        plannedWorksData.map(async (plannedWork) => {
          const derivedSwCode = plannedWork.derived_sw_code;
          // Use dynamic stageCode from route params
          
          console.log(`📋 Checking status for planning ID ${plannedWork.id}, work code ${derivedSwCode}`);
          
          try {
            // Check if this specific planning record has been reported
            const { data: reportData, error: reportError } = await supabase
              .from('prdn_work_reporting')
              .select('id, completion_status, created_dt')
              .eq('planning_id', plannedWork.id)
              .eq('is_deleted', false)
              .maybeSingle();

            console.log(`📊 Report query result for planning ${plannedWork.id}:`, { reportData, reportError });

            if (reportError) {
              console.error(`❌ Error checking report for planning ${plannedWork.id}:`, reportError);
              return { ...plannedWork, workLifecycleStatus: 'Planned' };
            }

            if (!reportData) {
              // No report found for this planning record
              console.log(`📝 No report found for planning ${plannedWork.id} - status: Planned`);
              return { ...plannedWork, workLifecycleStatus: 'Planned' };
            }

            // Report exists, check completion status
            console.log(`📊 Report found for planning ${plannedWork.id}, completion_status: ${reportData.completion_status}`);
            
            if (reportData.completion_status === 'NC') {
              // Work was reported but not completed (NC)
              console.log(`🔄 Planning ${plannedWork.id} not completed - status: In progress`);
              return { ...plannedWork, workLifecycleStatus: 'In progress' };
            } else {
              // Work was completed (anything that's not NC is considered completed)
              console.log(`✅ Planning ${plannedWork.id} completed - status: Completed`);
              return { ...plannedWork, workLifecycleStatus: 'Completed' };
            }
          } catch (error) {
            console.error(`❌ Error calculating status for planning ${plannedWork.id}:`, error);
            return { ...plannedWork, workLifecycleStatus: 'Planned' };
          }
        })
      );

      plannedWorksWithStatus = worksWithStatus;
      console.log(`📊 Calculated work lifecycle status for ${plannedWorksWithStatus.length} planned works:`, plannedWorksWithStatus.map(w => ({ id: w.id, status: w.workLifecycleStatus })));
    } catch (error) {
      console.error('Error calculating planned works status:', error);
      plannedWorksWithStatus = plannedWorksData.map(work => ({ ...work, workLifecycleStatus: 'Planned' }));
    }
  }

  async function loadReportData() {
    if (!selectedDate) return;
    
    isReportLoading = true;
    try {
      const { data, error } = await supabase
        .from('prdn_work_reporting')
        .select(`
          *,
          prdn_work_planning!inner(
            *,
            std_work_type_details!inner(
              *,
              std_work_details!inner(sw_name)
            ),
            hr_emp!inner(emp_name, skill_short),
            prdn_wo_details!inner(wo_no, pwo_no, wo_model, customer_name),
            std_work_skill_mapping(
              wsm_id,
              sc_name
            )
          )
        `)
        .eq('prdn_work_planning.stage_code', stageCode)
        .gte('from_date', selectedDate)
        .lte('from_date', selectedDate)
        .eq('status', 'approved')  // Only show approved reports
        .eq('is_deleted', false);

      if (error) throw error;
      
      // Now enrich with skill-specific time standards and vehicle work flow
      const enrichedReportData = await Promise.all(
        (data || []).map(async (report) => {
          const planningRecord = report.prdn_work_planning;
          const derivedSwCode = planningRecord.std_work_type_details?.derived_sw_code;
          const skillShort = planningRecord.hr_emp?.skill_short;
          const scRequired = planningRecord.sc_required;
          
          // Fetch std_vehicle_work_flow to get estimated_duration_minutes (same as Duration in Works tab)
          // Just use derived_sw_code like Works tab does (no wo_type_id filter)
          let vehicleWorkFlow = null;
          if (derivedSwCode) {
            try {
              const { data: vwfData, error: vwfError } = await supabase
                .from('std_vehicle_work_flow')
                .select('estimated_duration_minutes')
                .eq('derived_sw_code', derivedSwCode)
                .eq('is_deleted', false)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();
              
              if (!vwfError && vwfData) {
                vehicleWorkFlow = vwfData;
              } else if (vwfError) {
                console.debug(`Error fetching vehicle work flow for ${derivedSwCode}:`, vwfError);
              }
            } catch (error) {
              console.debug(`Error fetching vehicle work flow for ${derivedSwCode}:`, error);
            }
          }
          
          if (!derivedSwCode || !skillShort || !scRequired) {
            return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
          }

          try {
            // First, find the skill combination (sc_name) that contains this skill for this work
            // Get all work-skill mappings for this work code
            const { data: allMappings, error: mappingsError } = await supabase
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

            if (mappingsError || !allMappings || allMappings.length === 0) {
              console.warn(`No work-skill mappings found for ${derivedSwCode}`);
              return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
            }

            // Find the skill combination that contains the required skill
            let matchingWsm = null;
            for (const mapping of allMappings) {
              const skillCombination = (mapping as any).std_skill_combinations?.skill_combination;
              if (skillCombination && Array.isArray(skillCombination)) {
                // Check if this skill combination contains the required skill
                const hasSkill = skillCombination.some((skill: any) => 
                  skill.skill_name === scRequired || skill.skill_short === scRequired
                );
                if (hasSkill) {
                  matchingWsm = mapping;
                  break;
                }
              }
            }

            if (!matchingWsm) {
              console.warn(`No work-skill mapping found for ${derivedSwCode} containing skill ${scRequired}`);
              return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
            }

            // Get the skill time standard for this specific skill competency
            // Use sc_required (the skill required for the work) instead of skillShort (worker's skill)
            const { data: stsData, error: stsError } = await supabase
              .from('std_skill_time_standards')
              .select('*')
              .eq('wsm_id', matchingWsm.wsm_id)
              .eq('skill_short', scRequired) // Use sc_required (work's required skill), not worker's skill
              .eq('is_deleted', false)
              .eq('is_active', true)
              .maybeSingle();

            if (stsError || !stsData) {
              console.warn(`No skill time standard found for ${derivedSwCode} skill ${scRequired} (wsm_id: ${matchingWsm.wsm_id})`);
              // Get skill mapping from planning record if wsm_id is available, otherwise use the matching one we found
              const planningWsm = planningRecord.std_work_skill_mapping;
              const finalSkillMapping = planningWsm || matchingWsm;
              return { ...report, skillTimeStandard: null, skillMapping: finalSkillMapping, vehicleWorkFlow: vehicleWorkFlow };
            }

            // Get skill mapping from planning record if wsm_id is available, otherwise use the matching one we found
            const planningWsm = planningRecord.std_work_skill_mapping;
            const finalSkillMapping = planningWsm || matchingWsm;

            return { 
              ...report, 
              skillTimeStandard: stsData,
              skillMapping: finalSkillMapping, // Use skill mapping from planning (via wsm_id) or fallback to matching one
              vehicleWorkFlow: vehicleWorkFlow,
              // Calculate remaining time for this skill competency
              remainingTimeMinutes: Math.max(0, stsData.standard_time_minutes - ((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0)) * 60)
            };
          } catch (error) {
            console.error(`Error enriching report data for ${derivedSwCode}:`, error);
            return { ...report, skillTimeStandard: null, skillMapping: null, vehicleWorkFlow: vehicleWorkFlow };
          }
        })
      );

      reportData = enrichedReportData;
      console.log(`📊 Loaded ${reportData.length} work reports with skill-specific data for ${selectedDate}`);
    } catch (error) {
      console.error('Error loading report data:', error);
      reportData = [];
    } finally {
      isReportLoading = false;
    }
  }

  // Load manpower plan data (for planning next day)
  async function loadManpowerPlanData() {
    if (!selectedDate) return;
    
    isManpowerPlanLoading = true;
    try {
      // Get next day for planning
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      
      manpowerPlanData = await loadStageManpower(stageCode, shiftCode, nextDateStr, 'planning');
    } catch (error) {
      console.error('Error loading manpower plan data:', error);
      manpowerPlanData = [];
    } finally {
      isManpowerPlanLoading = false;
    }
  }

  // Load draft plan data (work plans + manpower plans)
  async function loadDraftPlanData() {
    if (!selectedDate) return;
    
    isDraftPlanLoading = true;
    try {
      // Get next day for planning
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      
      const [workPlans, manpowerPlans, reassignments] = await Promise.all([
        getDraftWorkPlans(stageCode, nextDateStr),
        getDraftManpowerPlans(stageCode, nextDateStr),
        getDraftStageReassignmentPlans(stageCode, nextDateStr)
      ]);
      
      draftPlanData = workPlans;
      draftManpowerPlanData = [...manpowerPlans, ...reassignments];
    } catch (error) {
      console.error('Error loading draft plan data:', error);
      draftPlanData = [];
      draftManpowerPlanData = [];
    } finally {
      isDraftPlanLoading = false;
    }
  }

  // Load manpower report data (for reporting current day)
  async function loadManpowerReportData() {
    if (!selectedDate) return;
    
    isManpowerReportLoading = true;
    try {
      manpowerReportData = await loadStageManpower(stageCode, shiftCode, selectedDate, 'reporting');
    } catch (error) {
      console.error('Error loading manpower report data:', error);
      manpowerReportData = [];
    } finally {
      isManpowerReportLoading = false;
    }
  }

  // Load draft report data (work reports + manpower reports)
  async function loadDraftReportData() {
    if (!selectedDate) return;
    
    isDraftReportLoading = true;
    try {
      const [workReports, manpowerReports] = await Promise.all([
        getDraftWorkReports(stageCode, selectedDate),
        getDraftManpowerReports(stageCode, selectedDate)
      ]);
      
      draftReportData = workReports;
      draftManpowerReportData = manpowerReports;
    } catch (error) {
      console.error('Error loading draft report data:', error);
      draftReportData = [];
      draftManpowerReportData = [];
    } finally {
      isDraftReportLoading = false;
    }
  }

  // Handle date change
  async function handleDateChange() {
    if (activeTab === 'work-orders') {
      await loadWorkOrdersData();
    } else if (activeTab === 'works') {
      await loadWorksData();
    } else if (activeTab === 'manpower-plan') {
      await loadManpowerPlanData();
    } else if (activeTab === 'draft-plan') {
      await loadDraftPlanData();
    } else if (activeTab === 'plan') {
      await loadPlannedWorksData();
    } else if (activeTab === 'manpower-report') {
      await loadManpowerReportData();
    } else if (activeTab === 'draft-report') {
      await loadDraftReportData();
    } else if (activeTab === 'report') {
      await loadReportData();
    }
  }

  // Submit planning handler
  async function handleSubmitPlanning() {
    if (!selectedDate) return;
    
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];
    
    // TODO: Add validation - check all employees with planned attendance as present have work planned
    // TODO: Check for conflicts/overlaps/breaks in shift schedule
    
    if (confirm('Are you sure you want to submit all draft plans for review? This action cannot be undone until manager reviews.')) {
      const result = await submitPlanning(stageCode, nextDateStr);
      if (result.success) {
        alert('Planning submitted successfully! Awaiting manager approval.');
        await loadDraftPlanData();
        await loadPlannedWorksData();
      } else {
        alert('Error submitting planning: ' + (result.error || 'Unknown error'));
      }
    }
  }

  // Submit reporting handler
  async function handleSubmitReporting() {
    if (!selectedDate) return;
    
    // TODO: Add validation
    
    if (confirm('Are you sure you want to submit all draft reports for review? This action cannot be undone until manager reviews.')) {
      const result = await submitReporting(stageCode, selectedDate);
      if (result.success) {
        alert('Reporting submitted successfully! Awaiting manager approval.');
        await loadDraftReportData();
        await loadReportData();
      } else {
        alert('Error submitting reporting: ' + (result.error || 'Unknown error'));
      }
    }
  }

  // Handle manpower table events
  async function handleAttendanceMarked(event: CustomEvent) {
    const { empId, stageCode, date, status, notes } = event.detail;
    
    try {
      if (activeTab === 'manpower-plan') {
        // Save to planning table
        const { savePlannedAttendance } = await import('$lib/api/production/manpowerPlanningReportingService');
        const result = await savePlannedAttendance(empId, stageCode, date, status, notes);
        if (!result.success) {
          alert('Error saving planned attendance: ' + (result.error || 'Unknown error'));
          return;
        }
        await loadManpowerPlanData();
      } else if (activeTab === 'manpower-report') {
        // For reporting, we need LTP/LTNP - this will be handled separately
        // For now, just mark attendance (LTP/LTNP will be entered separately)
        const { saveReportedManpower } = await import('$lib/api/production/manpowerPlanningReportingService');
        // Get existing LTP/LTNP if any, otherwise default to 0
        const result = await saveReportedManpower(empId, stageCode, date, status, 0, 0, notes);
        if (!result.success) {
          alert('Error saving reported attendance: ' + (result.error || 'Unknown error'));
          return;
        }
        await loadManpowerReportData();
      } else {
        // Legacy: save to hr_attendance (shouldn't happen with new tabs, but keep for safety)
        const { markAttendance } = await import('$lib/api/production');
        await markAttendance(empId, stageCode, date, status, notes);
      }
      
      console.log('Attendance marked successfully:', { empId, status });
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert('Error marking attendance: ' + ((error as Error).message || 'Unknown error'));
    }
  }

  async function handleBulkAttendanceMarked(event: CustomEvent) {
    const { employees, date, status, notes } = event.detail;
    
    try {
      // Import the markAttendance function
      const { markAttendance } = await import('$lib/api/production');
      
      console.log(`🔄 Marking bulk attendance for ${employees.length} employees:`, { status, date });
      
      // Mark attendance for each employee
      const promises = employees.map((employee: { empId: string; stageCode: string }) => 
        markAttendance(employee.empId, employee.stageCode, date, status, notes)
      );
      
      // Wait for all attendance markings to complete
      await Promise.all(promises);
      
      // Reload appropriate manpower data based on active tab
      if (activeTab === 'manpower-plan') {
        await loadManpowerPlanData();
      } else if (activeTab === 'manpower-report') {
        await loadManpowerReportData();
      }
      
      console.log(`✅ Bulk attendance marked successfully for ${employees.length} employees:`, { status });
    } catch (error) {
      console.error('Error marking bulk attendance:', error);
      // TODO: Show error message to user
    }
  }

  async function handleStageReassigned(event: CustomEvent) {
    const { empId, fromStageCode, toStageCode, date, shiftCode, fromTime, toTime, reason } = event.detail;
    
    try {
      if (activeTab === 'manpower-plan') {
        // Save to planning table
        const { savePlannedStageReassignment } = await import('$lib/api/production/manpowerPlanningReportingService');
        const result = await savePlannedStageReassignment(empId, fromStageCode, toStageCode, date, shiftCode, fromTime, toTime, reason);
        if (!result.success) {
          alert('Error saving planned reassignment: ' + (result.error || 'Unknown error'));
          return;
        }
        await loadManpowerPlanData();
      } else if (activeTab === 'manpower-report') {
        // Save to reporting table
        const { saveReportedStageReassignment } = await import('$lib/api/production/manpowerPlanningReportingService');
        const result = await saveReportedStageReassignment(empId, fromStageCode, toStageCode, date, shiftCode, fromTime, toTime, reason);
        if (!result.success) {
          alert('Error saving reported reassignment: ' + (result.error || 'Unknown error'));
          return;
        }
        await loadManpowerReportData();
      } else {
        // Legacy: save to hr_stage_reassignment (shouldn't happen with new tabs, but keep for safety)
        const { reassignEmployee } = await import('$lib/api/production');
        await reassignEmployee(empId, fromStageCode, toStageCode, date, shiftCode, fromTime, toTime, reason);
      }
      
      console.log('Employee reassigned successfully:', { empId, fromStageCode, toStageCode, fromTime, toTime });
    } catch (error) {
      console.error('Error reassigning employee:', error);
      alert('Error reassigning employee: ' + ((error as Error).message || 'Unknown error'));
    }
  }

  function handleManpowerExport() {
    console.log('Exporting manpower data');
    // TODO: Implement export functionality
  }

  async function handleMarkCompleted(workOrder: any) {
    try {
      // Check if all works for this work order in this stage are completed
      const { data: planningData, error: planningError } = await supabase
        .from('prdn_work_planning')
        .select('id, status')
        .eq('wo_details_id', workOrder.prdn_wo_details.id)
        .eq('stage_code', stageCode)
        .eq('is_deleted', false);

      if (planningError) {
        console.error('Error checking planning data:', planningError);
        alert('Error checking work completion status');
        return;
      }

      // Check if all planned works are reported/completed
      const incompleteWorks = planningData.filter(plan => plan.status !== 'submitted' && plan.status !== 'reported');
      
      if (incompleteWorks.length > 0) {
        alert(`Cannot mark as completed. ${incompleteWorks.length} work(s) are still pending:\n\nPlease ensure all planned works are reported before marking as completed.`);
        return;
      }

      // Show date picker modal
      const completionDate = prompt('Enter completion date (YYYY-MM-DD):', selectedDate);
      
      if (!completionDate) {
        return; // User cancelled
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(completionDate)) {
        alert('Invalid date format. Please use YYYY-MM-DD format.');
        return;
      }

      // Validate date is not in the future
      const completionDateObj = new Date(completionDate);
      const today = new Date();
      if (completionDateObj > today) {
        alert('Completion date cannot be in the future.');
        return;
      }

      // Update prdn_dates table with actual end date
      const { error: datesError } = await supabase
        .from('prdn_dates')
        .update({
          actual_date: completionDate,
          modified_by: (await import('$lib/utils/userUtils')).getCurrentUsername(),
          modified_dt: (await import('$lib/utils/userUtils')).getCurrentTimestamp()
          // created_by and created_dt should not be touched on update
        })
        .eq('sales_order_id', workOrder.prdn_wo_details.id)
        .eq('stage_code', stageCode)
        .eq('date_type', 'exit');

      if (datesError) {
        console.error('Error updating prdn_dates:', datesError);
        alert('Error updating completion date');
        return;
      }

      console.log(`✅ Marked work order ${workOrder.prdn_wo_details.wo_no} as completed on ${completionDate}`);
      
      // Reload work orders data to reflect the changes
      await loadWorkOrdersData();
      
      alert(`Work Order ${workOrder.prdn_wo_details.wo_no} has been marked as completed on ${completionDate}`);

    } catch (error) {
      console.error('Error marking work order as completed:', error);
      alert('Error marking work order as completed');
    }
  }

  // Handle Work Order Entry - Open Modal
  async function handleWorkOrderEntry() {
    try {
      isEntryModalLoading = true;
      
      // Get work orders waiting for entry using service
      const waitingWorkOrders = await getWaitingWorkOrdersForEntry(stageCode, selectedDate);

      if (!waitingWorkOrders || waitingWorkOrders.length === 0) {
        alert('No work orders waiting for entry');
        isEntryModalLoading = false;
        return;
      }

      // Remove duplicates by sales_order_id
      const uniqueWorkOrders = new Map();
      waitingWorkOrders.forEach((wo: any) => {
        const woId = wo.sales_order_id;
        if (!uniqueWorkOrders.has(woId)) {
          uniqueWorkOrders.set(woId, wo);
        }
      });

      waitingWorkOrdersForEntry = Array.from(uniqueWorkOrders.values());
      selectedWorkOrderForEntry = null;
      showEntryModal = true;
      isEntryModalLoading = false;
    } catch (error) {
      console.error('Error opening entry modal:', error);
      alert('Error opening entry modal');
      isEntryModalLoading = false;
    }
  }

  // Handle Work Order Entry - Process Selection
  async function handleEntryConfirm() {
    if (!selectedWorkOrderForEntry) {
      alert('Please select a work order');
      return;
    }

    try {
      isEntryModalLoading = true;
      entryProgressMessage = 'Initializing...';
      const selectedWorkOrder = selectedWorkOrderForEntry;
      const woDetailsId = selectedWorkOrder.prdn_wo_details.id;
      const woModel = selectedWorkOrder.prdn_wo_details.wo_model;

      // Use service to record entry
      entryProgressMessage = 'Processing entry...';
      const result = await recordWorkOrderEntry(
        stageCode,
        woDetailsId,
        woModel,
        selectedDate,
        (message) => { entryProgressMessage = message; }
      );

      if (!result.success) {
        entryProgressMessage = '';
        alert(result.error || 'Error recording work order entry');
        isEntryModalLoading = false;
        return;
      }

      console.log(`✅ Marked work order ${selectedWorkOrder.prdn_wo_details.wo_no} entry on ${selectedDate}`);
      
      // Reload work orders and works data to reflect the changes
      entryProgressMessage = 'Refreshing data...';
      await loadWorkOrdersData();
      await loadWorksData();
      
      entryProgressMessage = '';
      alert(`Work Order ${selectedWorkOrder.prdn_wo_details.wo_no} entered into ${stageCode} successfully. ${result.statusRecordsCount} works added.`);

      // Close modal
      showEntryModal = false;
      selectedWorkOrderForEntry = null;
      waitingWorkOrdersForEntry = [];
      isEntryModalLoading = false;
    } catch (error) {
      entryProgressMessage = '';
      console.error('Error marking work order entry:', error);
      alert('Error marking work order entry: ' + ((error as Error)?.message || 'Unknown error'));
      isEntryModalLoading = false;
    }
  }

  function handleEntryModalClose() {
    showEntryModal = false;
    selectedWorkOrderForEntry = null;
    waitingWorkOrdersForEntry = [];
    isEntryModalLoading = false;
    entryProgressMessage = '';
  }

  // Handle Work Order Exit - Open Modal
  async function handleWorkOrderExit() {
    try {
      isExitModalLoading = true;
      
      // Get available work orders for exit using service
      const availableWorkOrders = await getAvailableWorkOrdersForExit(stageCode);

      if (availableWorkOrders.length === 0) {
        alert('No work orders available for exit (all have been exited)');
        isExitModalLoading = false;
        return;
      }

      availableWorkOrdersForExit = availableWorkOrders;
      selectedWorkOrderForExit = null;
      exitDate = selectedDate;
      showExitModal = true;
      isExitModalLoading = false;
    } catch (error) {
      console.error('Error opening exit modal:', error);
      alert('Error opening exit modal');
      isExitModalLoading = false;
    }
  }

  // Handle Work Order Exit - Process Selection
  async function handleExitConfirm() {
    if (!selectedWorkOrderForExit) {
      alert('Please select a work order');
      return;
    }

    if (!exitDate) {
      alert('Please enter an exit date');
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(exitDate)) {
      alert('Invalid date format. Please use YYYY-MM-DD format.');
      return;
    }

    // Validate date is not in the future
    const exitDateObj = new Date(exitDate);
    const today = new Date();
    if (exitDateObj > today) {
      alert('Exit date cannot be in the future.');
      return;
    }

    try {
      // Use dynamic stageCode from route params
      isExitModalLoading = true;
      exitProgressMessage = 'Validating work statuses...';
      const selectedWorkOrder = selectedWorkOrderForExit;
      const woDetailsId = selectedWorkOrder.prdn_wo_details.id;

      // Validate that all works for this work order are either 'Completed' or 'Removed'
      const { data: workStatuses, error: statusError } = await supabase
        .from('prdn_work_status')
        .select('current_status')
        .eq('stage_code', stageCode)
        .eq('wo_details_id', woDetailsId);

      if (statusError) {
        exitProgressMessage = '';
        console.error('Error fetching work statuses:', statusError);
        alert('Error validating work statuses');
        isExitModalLoading = false;
        return;
      }

      if (!workStatuses || workStatuses.length === 0) {
        exitProgressMessage = '';
        alert('No works found for this work order. Cannot exit.');
        isExitModalLoading = false;
        return;
      }

      // Check for works that are not 'Completed' or 'Removed'
      const invalidStatuses = workStatuses.filter((ws: any) => 
        ws.current_status !== 'Completed' && ws.current_status !== 'Removed'
      );

      if (invalidStatuses.length > 0) {
        exitProgressMessage = '';
        const statusCounts = invalidStatuses.reduce((acc: any, ws: any) => {
          acc[ws.current_status] = (acc[ws.current_status] || 0) + 1;
          return acc;
        }, {});

        const statusMessage = Object.entries(statusCounts)
          .map(([status, count]) => `${status}: ${count}`)
          .join(', ');

        alert(`Cannot exit work order. There are works that are not completed or removed:\n\n${statusMessage}\n\nPlease ensure all works are either 'Completed' or 'Removed' before exiting.`);
        isExitModalLoading = false;
        return;
      }

      // Update prdn_dates table with actual exit date
      exitProgressMessage = 'Updating exit date...';
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();

      const { error: datesError } = await supabase
        .from('prdn_dates')
        .update({
          actual_date: exitDate,
          modified_by: currentUser,
          modified_dt: now
        })
        .eq('sales_order_id', woDetailsId)
        .eq('stage_code', stageCode)
        .eq('date_type', 'exit');

      if (datesError) {
        exitProgressMessage = '';
        console.error('Error updating prdn_dates:', datesError);
        alert('Error updating exit date');
        isExitModalLoading = false;
        return;
      }

      console.log(`✅ Marked work order ${selectedWorkOrder.prdn_wo_details.wo_no} exit on ${exitDate}`);
      
      // Reload work orders and works data to reflect the changes
      exitProgressMessage = 'Refreshing data...';
      await loadWorkOrdersData();
      await loadWorksData();
      
      exitProgressMessage = '';
      alert(`Work Order ${selectedWorkOrder.prdn_wo_details.wo_no} exited from ${stageCode} successfully.`);

      // Close modal
      showExitModal = false;
      selectedWorkOrderForExit = null;
      availableWorkOrdersForExit = [];
      exitDate = '';
      isExitModalLoading = false;
    } catch (error) {
      exitProgressMessage = '';
      console.error('Error marking work order exit:', error);
      alert('Error marking work order exit: ' + ((error as Error)?.message || 'Unknown error'));
      isExitModalLoading = false;
    }
  }

  function handleExitModalClose() {
    showExitModal = false;
    selectedWorkOrderForExit = null;
    availableWorkOrdersForExit = [];
    exitDate = '';
    isExitModalLoading = false;
    exitProgressMessage = '';
  }

  // Date comparison functions for color coding (holiday-aware)
  async function getDateDifference(plannedDate: string, actualDate: string | null): Promise<number> {
    const planned = new Date(plannedDate);
    const today = new Date(); // Use actual current date instead of selected date
    
    if (!actualDate) {
      // If no actual date, only show delay if planned date has passed (is in the past)
      if (planned.getTime() <= today.getTime()) {
        // Planned date is in the past, calculate working days delay from planned date to today
        try {
          const workingDays = await calculateWorkingDays(planned, today);
          return workingDays;
        } catch (error) {
          console.error('Error calculating working days:', error);
          // Fallback to simple day difference
          const diffTime = today.getTime() - planned.getTime();
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }
      
      // Planned date is in the future, no delay to show
      return 0;
    }
    
    // If actual date exists, calculate working days difference from planned to actual
    const actual = new Date(actualDate);
    try {
      const workingDays = await calculateWorkingDays(planned, actual);
      return workingDays;
    } catch (error) {
      console.error('Error calculating working days:', error);
      // Fallback to simple day difference
      const diffTime = actual.getTime() - planned.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  }

  function getDateColor(daysDiff: number): string {
    if (daysDiff === 0) return 'text-green-600';
    if (daysDiff <= 2) return 'text-yellow-600';
    if (daysDiff <= 5) return 'text-orange-600';
    return 'text-red-600';
  }

  function getRowBackgroundColor(daysDiff: number): string {
    if (daysDiff === 0) return 'on-time';
    if (daysDiff <= 2) return 'slight-delay';
    if (daysDiff <= 5) return 'moderate-delay';
    return 'significant-delay';
  }

  // Helper functions for work order dates (similar to entry-plan WIP tab)
  function getPlannedStartDate(workOrder: any): string {
    const firstEntry = workOrder.entryDates?.[0];
    return firstEntry ? formatDate(firstEntry.planned_date) : 'N/A';
  }

  function getPlannedEndDate(workOrder: any): string {
    const lastExit = workOrder.exitDates?.[workOrder.exitDates?.length - 1];
    return lastExit ? formatDate(lastExit.planned_date) : 'N/A';
  }

  function getActualStartDate(workOrder: any): string {
    // Check if we have actual start date from work reporting
    if (workOrder.actualStartDate) {
      return formatDate(workOrder.actualStartDate);
    }
    
    // Fallback to entry dates if no work reporting data
    const firstActualEntry = workOrder.entryDates?.find((entry: any) => entry.actual_date);
    return firstActualEntry ? formatDate(firstActualEntry.actual_date) : 'N/A';
  }

  function getActualEndDate(workOrder: any): string {
    const lastActualExit = workOrder.exitDates?.find((exit: any) => exit.actual_date);
    return lastActualExit ? formatDate(lastActualExit.actual_date) : 'N/A';
  }

  function getDocumentReleaseDate(workOrder: any): string {
    // Get document release date for current stage
    const docRelease = workOrder.documentReleaseDates?.find((doc: any) => 
      doc.stage_code === stageCode && doc.actual_date
    );
    return docRelease ? formatDate(docRelease.actual_date) : 'N/A';
  }

  function getCurrentStage(workOrder: any): string {
    // Return the current stage from workOrder (set by service)
    return workOrder.currentStage || 'N/A';
  }

  function getWorkOrderStatus(workOrder: any): { status: string, color: string } {
    const hasActualStart = getActualStartDate(workOrder) !== 'N/A';
    const hasActualEnd = getActualEndDate(workOrder) !== 'N/A';
    
    if (!hasActualStart) {
      return { status: 'Not Started', color: 'text-red-600 dark:text-red-400' };
    } else if (hasActualStart && !hasActualEnd) {
      return { status: 'In Progress', color: 'text-yellow-600 dark:text-yellow-400' };
    } else {
      return { status: 'Completed', color: 'text-green-600 dark:text-green-400' };
    }
  }

  function formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    // Use formatDateLocal which handles UTC conversion properly
    return formatDateLocal(dateString);
  }

  // Load shift break times for the selected date
  async function loadShiftBreakTimesLocal() {
    if (!selectedDate) {
      shiftBreakTimes = [];
      return;
    }

    try {
      shiftBreakTimes = await loadShiftBreakTimes(selectedDate);
    } catch (error) {
      console.error('Error loading shift break times:', error);
      shiftBreakTimes = [];
    }
  }

  // Use shared utility for break time calculation
  function calculateBreakTimeInRange(fromTime: string, toTime: string): number {
    return calculateBreakTimeInMinutes(fromTime, toTime, shiftBreakTimes);
  }

  function calculatePlannedHoursFromTimes(fromTime: string, toTime: string): string {
    if (!fromTime || !toTime) return 'N/A';
    
    try {
      const from = new Date(`2000-01-01T${fromTime}`);
      const to = new Date(`2000-01-01T${toTime}`);
      
      if (to < from) {
        to.setDate(to.getDate() + 1);
      }
      
      // Calculate total duration in milliseconds
      const diffMs = to.getTime() - from.getTime();
      
      // Get break time in minutes that overlaps with the planned time slot
      const breakMinutes = calculateBreakTimeInRange(fromTime, toTime);
      
      // Convert break time to hours and subtract from total duration
      const breakHours = breakMinutes / 60;
      const totalHours = diffMs / (1000 * 60 * 60); // Convert to hours
      const plannedHours = totalHours - breakHours; // Subtract break time
      
      return `${Math.max(0, plannedHours).toFixed(1)}h`;
    } catch (error) {
      console.error('Error calculating planned hours from times:', error);
      return 'N/A';
    }
  }

  // Use shared utility for verbose time format
  const formatTime = formatTimeVerbose;

  // Format lost time details for display
  function formatLostTimeDetails(ltDetails: any[] | null): string {
    if (!ltDetails || !Array.isArray(ltDetails) || ltDetails.length === 0) {
      return '';
    }
    
    return ltDetails.map((lt: any, index: number) => {
      const ltNumber = index + 1;
      const minutes = lt.lt_minutes || 0;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = `${hours} Hr ${mins} Min`;
      const payableStr = lt.is_lt_payable ? 'P' : 'NP';
      const reason = lt.lt_reason || lt.reason || 'N/A';
      
      return `LT${ltNumber}: ${timeStr} (${payableStr}-${reason})`;
    }).join('; ');
  }

  // Convert 24-hour format (HH:MM:SS or HH:MM) to 12-hour format with AM/PM
  function to12HourTime(time24: string): string {
    if (!time24 || !time24.includes(':')) return time24 || 'N/A';
    
    // Handle both HH:MM:SS and HH:MM formats
    const timeParts = time24.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1] || '00';
    const seconds = timeParts[2] || '00';
    
    if (isNaN(hours)) return time24;
    
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';
    
    return `${hour12.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
  }

  // Handle works table events
  async function handleWorksExport(event: CustomEvent) {
    const { data: worksData } = event.detail;
    if (!worksData || !Array.isArray(worksData) || worksData.length === 0) {
      alert('No data to export');
      return;
    }

    // Use shared utility for minutes format
    const formatTimeMinutes = formatTimeFromMinutes;

    // Helper function to format skills
    function formatSkills(work: any): string {
      if (!work.skill_mappings || work.skill_mappings.length === 0) {
        return 'No skills';
      }
      return work.skill_mappings.map((skill: any) => skill.sc_name || '').filter(Boolean).join(', ');
    }

    // Fetch work statuses from prdn_work_status table in batch
    // Use dynamic stageCode from route params
    const workCodes = worksData.map(work => {
      const derivedSwCode = work.std_work_type_details?.derived_sw_code;
      const otherWorkCode = work.sw_code?.startsWith('OW') ? work.sw_code : null;
      return { derivedSwCode, otherWorkCode, woDetailsId: work.wo_details_id };
    }).filter(w => w.derivedSwCode || w.otherWorkCode);

    // Create a map of work statuses
    const statusMap = new Map<string, string>();
    
    if (workCodes.length > 0) {
      try {
        // Fetch all statuses at once
        const woIds = [...new Set(workCodes.map(w => w.woDetailsId).filter(Boolean))];
        const derivedCodes = workCodes.map(w => w.derivedSwCode).filter(Boolean);
        const otherCodes = workCodes.map(w => w.otherWorkCode).filter(Boolean);

        let statusQuery = supabase
          .from('prdn_work_status')
          .select('derived_sw_code, other_work_code, wo_details_id, current_status')
          .eq('stage_code', stageCode)
          .in('wo_details_id', woIds);

        if (derivedCodes.length > 0 && otherCodes.length > 0) {
          statusQuery = statusQuery.or(
            `derived_sw_code.in.(${derivedCodes.join(',')}),other_work_code.in.(${otherCodes.join(',')})`
          );
        } else if (derivedCodes.length > 0) {
          statusQuery = statusQuery.in('derived_sw_code', derivedCodes);
        } else if (otherCodes.length > 0) {
          statusQuery = statusQuery.in('other_work_code', otherCodes);
        }

        const { data: statusData, error: statusError } = await statusQuery;

        if (!statusError && statusData) {
          statusData.forEach((status: any) => {
            const key = status.derived_sw_code 
              ? `${status.derived_sw_code}_${status.wo_details_id}`
              : `${status.other_work_code}_${status.wo_details_id}`;
            statusMap.set(key, status.current_status || 'Yet to be Planned');
          });
        }
      } catch (error) {
        console.error('Error fetching work statuses:', error);
      }
    }

    // Helper function to get work status
    function getWorkStatus(work: any): string {
      const derivedSwCode = work.std_work_type_details?.derived_sw_code;
      const otherWorkCode = work.sw_code?.startsWith('OW') ? work.sw_code : null;
      const workCode = derivedSwCode || otherWorkCode;
      const woDetailsId = work.wo_details_id;
      
      if (workCode && woDetailsId) {
        const key = `${workCode}_${woDetailsId}`;
        const status = statusMap.get(key);
        if (status) {
          // Map database status to display status
          if (status === 'Yet to be Planned') return 'Yet to be planned';
          if (status === 'In Progress') return 'In progress';
          return status;
        }
      }
      
      return 'Yet to be planned';
    }

    const headers = [
      'WO Details ID',
      'Work Order Number',
      'Pre-Work Order Number',
      'Vehicle Model',
      'Work Code',
      'Work Name',
      'Status',
      'Required Skills',
      'Duration',
      'Time Taken',
      'Remaining Time'
    ];

    exportToCSV(
      worksData,
      headers,
      'works',
      (work) => {
        const derivedSwCode = work.std_work_type_details?.derived_sw_code || work.sw_code;
        const workName = work.sw_name || '';
        const typeDescription = work.std_work_type_details?.type_description || '';
        const fullWorkName = typeDescription ? `${workName} - ${typeDescription}` : workName;
        
        return [
          work.wo_details_id || 'N/A',
          work.wo_no || 'N/A',
          work.pwo_no || 'N/A',
          work.mstr_wo_type?.wo_type_name || 'N/A',
          derivedSwCode || 'N/A',
          fullWorkName || 'N/A',
          getWorkStatus(work),
          formatSkills(work),
          work.std_vehicle_work_flow?.estimated_duration_minutes 
            ? formatTime(work.std_vehicle_work_flow.estimated_duration_minutes) 
            : 'N/A',
          work.time_taken 
            ? formatTimeMinutes(work.time_taken * 60) 
            : '0h 0m',
          work.remaining_time 
            ? formatTime(work.remaining_time * 60) 
            : 'N/A'
        ];
      }
    );
  }

  function handleAddWork() {
    console.log('handleAddWork called, workOrdersData:', workOrdersData);
    // Get work orders from current context (same as Work Orders tab)
    availableWorkOrdersForAdd = workOrdersData.map(wo => ({
      id: wo.prdn_wo_details?.id || 0,
      wo_no: wo.prdn_wo_details?.wo_no || null,
      pwo_no: wo.prdn_wo_details?.pwo_no || null,
      wo_model: wo.prdn_wo_details?.wo_model || ''
    })).filter(wo => wo.id > 0);
    
    console.log('availableWorkOrdersForAdd:', availableWorkOrdersForAdd);
    
    if (availableWorkOrdersForAdd.length === 0) {
      alert('No work orders available. Please ensure there are active work orders for this stage and date.');
      return;
    }
    
    console.log('Setting showAddWorkModal to true');
    showAddWorkModal = true;
  }

  function handleAddWorkClose() {
    showAddWorkModal = false;
    availableWorkOrdersForAdd = [];
  }

  async function handleWorkAdded(event: CustomEvent) {
    console.log('Work added:', event.detail);
    // Reload works data to show the new addition
    // Always refresh Works tab data regardless of current tab
    await loadWorksData();
    handleAddWorkClose();
  }

  function handleViewWork(event: CustomEvent) {
    console.log('Viewing work:', event.detail.work);
    selectedWorkForHistory = event.detail.work;
    showViewWorkHistoryModal = true;
  }

  function handleViewWorkHistoryClose() {
    showViewWorkHistoryModal = false;
    selectedWorkForHistory = null;
  }

  function handleRemoveWork(event: CustomEvent) {
    console.log('Removing work:', event.detail.work);
    selectedWorkForRemoval = event.detail.work;
    showRemoveWorkModal = true;
  }

  function handleRemoveWorkClose() {
    showRemoveWorkModal = false;
    selectedWorkForRemoval = null;
  }

  async function handleWorkRemoved(event: CustomEvent) {
    console.log('Work removed:', event.detail);
    // Reload works data to reflect the removal
    // Always refresh Works tab data regardless of current tab
    await loadWorksData();
    handleRemoveWorkClose();
  }

  // Handle multi-remove
  async function handleRemoveSelected(event: CustomEvent) {
    const { works } = event.detail;
    if (!works || works.length === 0) {
      alert('No works selected for removal');
      return;
    }

    // Show confirmation
    const workNames = works.map((w: any) => 
      w.std_work_type_details?.derived_sw_code || w.sw_code
    ).join(', ');
    
    if (!confirm(`Are you sure you want to remove ${works.length} work(s)?\n\nWork codes: ${workNames}`)) {
      return;
    }

    // Prompt for a single removal reason for all works
    const removalReason = prompt(`Please provide a reason for removing ${works.length} work(s):`);
    if (!removalReason || !removalReason.trim()) {
      alert('Removal cancelled. A reason is required to remove works.');
      return;
    }

    // Process removals sequentially
    const { getCurrentUsername } = await import('$lib/utils/userUtils');
    const { removeWorkFromProduction } = await import('$lib/api/production');
    const currentUser = getCurrentUsername();
    // Use dynamic stageCode from route params

    let successCount = 0;
    let failCount = 0;
    const failedWorks: string[] = [];

    for (const work of works) {
      const derivedSwCode = work.std_work_type_details?.derived_sw_code;
      const otherWorkCode = work.sw_code?.startsWith('OW') ? work.sw_code : null;
      const workCode = derivedSwCode || otherWorkCode || 'Unknown';
      const woDetailsId = work.wo_details_id;

      if (!woDetailsId) {
        console.error(`No wo_details_id for work ${workCode}`);
        failCount++;
        failedWorks.push(workCode);
        continue;
      }

      try {
        const result = await removeWorkFromProduction(
          derivedSwCode || null,
          stageCode,
          woDetailsId,
          removalReason.trim(),
          currentUser,
          otherWorkCode || null
        );

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          failedWorks.push(workCode);
          console.error(`Failed to remove work ${workCode}:`, result.error);
        }
      } catch (error) {
        failCount++;
        failedWorks.push(workCode);
        console.error(`Error removing work ${workCode}:`, error);
      }
    }

    // Show summary
    let message = `Removal complete:\n- Successfully removed: ${successCount} work(s)`;
    if (failCount > 0) {
      message += `\n- Failed to remove: ${failCount} work(s)\nFailed works: ${failedWorks.join(', ')}`;
    }
    alert(message);

    // Reload works data
    await loadWorksData();
    
    // Also reload planned works data if on Plan tab to reflect soft-deleted planning records
    if (activeTab === 'plan') {
      await loadPlannedWorksData();
    }
  }

  function handlePlanWork(event: CustomEvent) {
    console.log('Planning work:', event.detail.work);
    selectedWorkForPlanning = event.detail.work;
    showPlanModal = true;
    console.log('Modal state:', { showPlanModal, selectedWorkForPlanning });
  }

  function handlePlanModalClose() {
    showPlanModal = false;
    selectedWorkForPlanning = null;
  }

  async function handlePlanSave(event: CustomEvent) {
    console.log('Work plan save event:', event.detail);
    
    try {
      const result = event.detail;
      
      if (result.success) {
        console.log('Work plans saved successfully:', result.message);
        
        // Always reload works data to update status (e.g., "Planned" status, "Cannot Plan" message)
        // This ensures the Works tab is refreshed regardless of current tab
        await loadWorksData();
        
        // Reload planned works data if we're on the plan tab
        if (activeTab === 'plan') {
          await loadPlannedWorksData();
        }
        
        handlePlanModalClose();
      } else {
        console.error('Error saving work plans:', result.error);
        alert('Error saving work plans. Please try again.');
      }
    } catch (error) {
      console.error('Error handling work plan save:', error);
      alert('Error saving work plan. Please try again.');
    }
  }

  function handleReportWork(plannedWork: any) {
    console.log('Reporting work:', plannedWork);
    selectedWorkForReporting = plannedWork;
    showReportModal = true;
  }

  function handleReportModalClose() {
    showReportModal = false;
    selectedWorkForReporting = null;
  }

  // Multi-row selection functions
  function toggleRowSelection(rowId: string) {
    const work = plannedWorksData.find(w => w.id === rowId);
    if (!work) return;

    const workCode = work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code;
    
    // If selecting a row from a different work, clear previous selections
    if (selectedRows.size > 0) {
      const firstSelectedWork = plannedWorksData.find(w => selectedRows.has(w.id));
      const firstWorkCode = firstSelectedWork?.std_work_type_details?.derived_sw_code || firstSelectedWork?.std_work_type_details?.sw_code;
      
      if (workCode !== firstWorkCode) {
        // Clear all selections and start fresh with this work
        selectedRows.clear();
      }
    }

    if (selectedRows.has(rowId)) {
      selectedRows.delete(rowId);
    } else {
      selectedRows.add(rowId);
    }
    selectedRows = new Set(selectedRows); // Trigger reactivity
  }

  function selectAllRowsInGroup(group: GroupedPlannedWork) {
    group.items.forEach(item => {
      selectedRows.add(item.id);
    });
    selectedRows = new Set(selectedRows); // Trigger reactivity
  }

  function clearAllSelections() {
    selectedRows.clear();
    selectedRows = new Set(selectedRows); // Trigger reactivity
  }

  // Excel and PDF generation functions
  function generatePlanExcel() {
    try {
      // Calculate statistics
      // Count unique works (by work code) instead of total planning records
      const uniqueWorkCodes = new Set(
        plannedWorksWithStatus.map(work => 
          work.other_work_code || work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code
        ).filter(Boolean)
      );
      const totalPlannedWorks = uniqueWorkCodes.size;
      // Calculate total planned manhours, subtracting break time for each work
      const totalPlannedManhours = plannedWorksWithStatus.reduce((sum, work) => {
        let plannedHours = work.planned_hours || 0;
        if (work.from_time && work.to_time) {
          try {
            const from = new Date(`2000-01-01T${work.from_time}`);
            const to = new Date(`2000-01-01T${work.to_time}`);
            if (to < from) to.setDate(to.getDate() + 1);
            const diffMs = to.getTime() - from.getTime();
            const totalHours = diffMs / (1000 * 60 * 60);
            // Subtract break time
            const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time);
            const breakHours = breakMinutes / 60;
            plannedHours = totalHours - breakHours;
          } catch (error) {
            console.error('Error calculating planned hours for summary:', error);
          }
        }
        return sum + Math.max(0, plannedHours);
      }, 0);
      
      // Group works by work code for merging cells
      const grouped = (plannedWorksWithStatus || []).reduce((groups, work) => {
        if (!work) return groups;
        const workCode = work.other_work_code || work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code || 'unknown';
        if (!groups[workCode]) {
          groups[workCode] = [];
        }
        groups[workCode].push(work);
        return groups;
      }, {} as Record<string, any[]>);
      
      // Sort work codes: C first, then M, then P, then O (non-standard)
      function getWorkCodeSortOrder(workCode: string): number {
        if (!workCode) return 999;
        const firstChar = workCode.charAt(0).toUpperCase();
        if (firstChar === 'C') return 1;
        if (firstChar === 'M') return 2;
        if (firstChar === 'P') return 3;
        if (firstChar === 'O') return 4;
        return 999; // Other codes go last
      }
      
      // Sort grouped entries by work code
      const sortedGroupEntries = Object.entries(grouped).sort(([codeA], [codeB]) => {
        const orderA = getWorkCodeSortOrder(codeA);
        const orderB = getWorkCodeSortOrder(codeB);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // If same category, sort alphabetically
        return codeA.localeCompare(codeB);
      });
      
      // Create Excel data with merged cells support
      const excelData: any[] = [];
      const merges: XLSX.Range[] = [];
      let currentRow = 1; // Start after header row (row 0)
      
      sortedGroupEntries.forEach(([workCodeKey, works]) => {
        const worksArray = works as any[];
        if (worksArray.length === 0) return;
        
        const firstWork = worksArray[0];
        const workCode = firstWork.other_work_code || firstWork.std_work_type_details?.derived_sw_code || firstWork.std_work_type_details?.sw_code || 'N/A';
        // For non-standard works, use workAdditionData.other_work_desc; for standard works, use std_work_details.sw_name
        const workName = firstWork.other_work_code 
          ? (firstWork.workAdditionData?.other_work_desc || firstWork.other_work_code)
          : (firstWork.std_work_type_details?.std_work_details?.sw_name || 'N/A');
        const woNo = firstWork.prdn_wo_details?.wo_no || 'N/A';
        const pwoNo = firstWork.prdn_wo_details?.pwo_no || 'N/A';
        // Get skill competency from skillMapping (header row value) or fallback to sc_required
        const skillCompetency = firstWork.skillMapping?.sc_name || firstWork.std_work_skill_mapping?.sc_name || firstWork.sc_required || 'N/A';
        const rowspan = worksArray.length;
        
        // Generate rows for this group
        worksArray.forEach((work: any, index: number) => {
          const workerSC = work.hr_emp?.skill_short || 'N/A';
          const isFirstRow = index === 0;
          
          const row: any = {};
          
          // Work Order Number - merged (column A)
          if (isFirstRow) {
            row['Work Order Number'] = woNo;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 0 },
                e: { r: currentRow + rowspan - 1, c: 0 }
              });
            }
          }
          
          // Pre Work Order Number - merged (column B)
          if (isFirstRow) {
            row['Pre Work Order Number'] = pwoNo;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 1 },
                e: { r: currentRow + rowspan - 1, c: 1 }
              });
            }
          }
          
          // Work Code - merged (column C)
          if (isFirstRow) {
            row['Work Code'] = workCode;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 2 },
                e: { r: currentRow + rowspan - 1, c: 2 }
              });
            }
          }
          
          // Work Name - merged (column D)
          if (isFirstRow) {
            row['Work Name'] = workName;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 3 },
                e: { r: currentRow + rowspan - 1, c: 3 }
              });
            }
          }
          
          // Skill Competency - merged (column E)
          if (isFirstRow) {
            row['Skill Competency'] = skillCompetency;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 4 },
                e: { r: currentRow + rowspan - 1, c: 4 }
              });
            }
          }
          
          // Standard Time - merged (column F)
          if (isFirstRow) {
            const standardTime = firstWork.vehicleWorkFlow?.estimated_duration_minutes 
              ? formatTime(firstWork.vehicleWorkFlow.estimated_duration_minutes / 60) 
              : 'N/A';
            row['Standard Time'] = standardTime;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 5 },
                e: { r: currentRow + rowspan - 1, c: 5 }
              });
            }
          }
          
          // Worker - not merged (column G)
          row['Worker'] = work.hr_emp?.emp_name || 'N/A';
          
          // SC - not merged (column H)
          row['SC'] = workerSC;
          
          // Time Worked Till Date - not merged (column I)
          row['Time Worked Till Date'] = formatTime(work.time_worked_till_date || 0);
          
          // From Time - not merged (column J)
          row['From Time'] = to12HourTime(work.from_time || '');
          
          // To Time - not merged (column K)
          row['To Time'] = to12HourTime(work.to_time || '');
          
          // Planned Hours - not merged (column L)
          // Calculate planned hours from from_time and to_time, subtracting break time
          let plannedHours = work.planned_hours || 0;
          if (work.from_time && work.to_time) {
            try {
              const from = new Date(`2000-01-01T${work.from_time}`);
              const to = new Date(`2000-01-01T${work.to_time}`);
              if (to < from) to.setDate(to.getDate() + 1);
              const diffMs = to.getTime() - from.getTime();
              const totalHours = diffMs / (1000 * 60 * 60);
              // Subtract break time
              const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time);
              const breakHours = breakMinutes / 60;
              plannedHours = totalHours - breakHours;
            } catch (error) {
              console.error('Error calculating planned hours for Excel:', error);
            }
          }
          row['Planned Hours'] = formatTime(Math.max(0, plannedHours));
          
          excelData.push(row);
          currentRow++;
        });
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create summary sheet
      const summaryData = [
        [`${stageCode} - Production Plan - ${new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`],
        [],
        ['Summary'],
        ['Total Planned Works:', totalPlannedWorks],
        ['Total Planned Manhours:', totalPlannedManhours.toFixed(2)],
        []
      ];
      
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths for summary
      wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];
      
      // Add borders to summary cells
      const summaryRange = XLSX.utils.decode_range(wsSummary['!ref'] || 'A1:B1');
      for (let R = 0; R <= summaryRange.e.r; R++) {
        for (let C = 0; C <= summaryRange.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!wsSummary[cellAddress]) continue;
          (wsSummary[cellAddress] as any).s = {
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          };
        }
      }
      
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      
      // Create data sheet with headers
      const wsData = XLSX.utils.json_to_sheet(excelData);
      
      // Apply merges
      if (merges.length > 0) {
        wsData['!merges'] = merges;
      }
      
      // Set column widths
      wsData['!cols'] = [
        { wch: 18 }, // Work Order Number
        { wch: 20 }, // Pre Work Order Number
        { wch: 15 }, // Work Code
        { wch: 40 }, // Work Name
        { wch: 15 }, // Skill Competency
        { wch: 18 }, // Standard Time
        { wch: 20 }, // Worker
        { wch: 15 }, // SC
        { wch: 22 }, // Time Worked Till Date
        { wch: 18 }, // From Time
        { wch: 18 }, // To Time
        { wch: 18 }  // Planned Hours
      ];
      
      // Add borders to all cells
      const range = XLSX.utils.decode_range(wsData['!ref'] || 'A1');
      for (let R = 0; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!wsData[cellAddress]) continue;
          const cell = wsData[cellAddress] as any;
          if (!cell.s) cell.s = {};
          cell.s.border = {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          };
          // Header row styling
          if (R === 0) {
            cell.s.font = { bold: true };
            cell.s.fill = { fgColor: { rgb: 'F3F4F6' } };
          }
        }
      }
      
      XLSX.utils.book_append_sheet(wb, wsData, 'Planned Works');
      
      // Write file
      XLSX.writeFile(wb, formatStageShiftExportFilename(stageCode, shiftCode, selectedDate, 'Work_Planning'));
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Error generating Excel file. Please try again.');
    }
  }

  function generatePlanPDF() {
    try {
      // Calculate statistics
      // Count unique works (by work code) instead of total planning records
      const uniqueWorkCodes = new Set(
        plannedWorksWithStatus.map(work => 
          work.other_work_code || work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code
        ).filter(Boolean)
      );
      const totalPlannedWorks = uniqueWorkCodes.size;
      // Calculate total planned manhours, subtracting break time for each work
      const totalPlannedManhours = plannedWorksWithStatus.reduce((sum, work) => {
        let plannedHours = work.planned_hours || 0;
        if (work.from_time && work.to_time) {
          try {
            const from = new Date(`2000-01-01T${work.from_time}`);
            const to = new Date(`2000-01-01T${work.to_time}`);
            if (to < from) to.setDate(to.getDate() + 1);
            const diffMs = to.getTime() - from.getTime();
            const totalHours = diffMs / (1000 * 60 * 60);
            // Subtract break time
            const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time);
            const breakHours = breakMinutes / 60;
            plannedHours = totalHours - breakHours;
          } catch (error) {
            console.error('Error calculating planned hours for summary:', error);
          }
        }
        return sum + Math.max(0, plannedHours);
      }, 0);
      
      // Generate HTML rows for PDF (outside template literal to avoid conflicts)
      // Group works by work code
      const grouped = (plannedWorksWithStatus || []).reduce((groups, work) => {
        if (!work) return groups;
        const workCode = work.other_work_code || work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code || 'unknown';
        if (!groups[workCode]) {
          groups[workCode] = [];
        }
        groups[workCode].push(work);
        return groups;
      }, {} as Record<string, any[]>);
      
      // Sort work codes: C first, then M, then P, then O (non-standard)
      function getWorkCodeSortOrder(workCode: string): number {
        if (!workCode) return 999;
        const firstChar = workCode.charAt(0).toUpperCase();
        if (firstChar === 'C') return 1;
        if (firstChar === 'M') return 2;
        if (firstChar === 'P') return 3;
        if (firstChar === 'O') return 4;
        return 999; // Other codes go last
      }
      
      // Sort grouped entries by work code
      const sortedGroupEntries = Object.entries(grouped).sort(([codeA], [codeB]) => {
        const orderA = getWorkCodeSortOrder(codeA);
        const orderB = getWorkCodeSortOrder(codeB);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // If same category, sort alphabetically
        return codeA.localeCompare(codeB);
      });
      
      // Generate rows with merged cells
      let pdfRows = '';
      sortedGroupEntries.forEach(([workCodeKey, works]) => {
        const worksArray = works as any[];
        if (worksArray.length === 0) return;
        
        const firstWork = worksArray[0];
        const workCode = firstWork.other_work_code || firstWork.std_work_type_details?.derived_sw_code || firstWork.std_work_type_details?.sw_code || 'N/A';
        // For non-standard works, use workAdditionData.other_work_desc; for standard works, use std_work_details.sw_name
        const workName = firstWork.other_work_code 
          ? (firstWork.workAdditionData?.other_work_desc || firstWork.other_work_code)
          : (firstWork.std_work_type_details?.std_work_details?.sw_name || 'N/A');
        const woNo = firstWork.prdn_wo_details?.wo_no || 'N/A';
        const pwoNo = firstWork.prdn_wo_details?.pwo_no || 'N/A';
        // Get skill competency from skillMapping (header row value) or fallback to sc_required
        const skillCompetency = firstWork.skillMapping?.sc_name || firstWork.std_work_skill_mapping?.sc_name || firstWork.sc_required || 'N/A';
        const rowspan = worksArray.length;
        
        // Generate rows for this group
        worksArray.forEach((work: any, index: number) => {
          const workerSC = work.hr_emp?.skill_short || 'N/A';
          const isFirstRow = index === 0;
          
          pdfRows += '<tr>';
          
          // Work Order Number - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + woNo + '</td>';
          }
          
          // Pre Work Order Number - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + pwoNo + '</td>';
          }
          
          // Work Code - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + workCode + '</td>';
          }
          
          // Work Name - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + workName + '</td>';
          }
          
          // Skill Competency - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + skillCompetency + '</td>';
          }
          
          // Standard Time - merged
          if (isFirstRow) {
            const standardTime = firstWork.vehicleWorkFlow?.estimated_duration_minutes 
              ? formatTime(firstWork.vehicleWorkFlow.estimated_duration_minutes / 60) 
              : 'N/A';
            pdfRows += '<td rowspan="' + rowspan + '">' + standardTime + '</td>';
          }
          
          // Worker - not merged
          pdfRows += '<td>' + (work.hr_emp?.emp_name || 'N/A') + '</td>';
          
          // SC - not merged
          pdfRows += '<td>' + workerSC + '</td>';
          
          // Time Worked Till Date - not merged
          const timeWorkedTillDate = formatTime(work.time_worked_till_date || 0);
          pdfRows += '<td>' + timeWorkedTillDate + '</td>';
          
          // From Time - not merged
          pdfRows += '<td>' + to12HourTime(work.from_time || '') + '</td>';
          
          // To Time - not merged
          pdfRows += '<td>' + to12HourTime(work.to_time || '') + '</td>';
          
          // Planned Hours - not merged
          // Calculate planned hours from from_time and to_time, subtracting break time
          let plannedHours = work.planned_hours || 0;
          if (work.from_time && work.to_time) {
            try {
              const from = new Date('2000-01-01T' + work.from_time);
              const to = new Date('2000-01-01T' + work.to_time);
              if (to < from) to.setDate(to.getDate() + 1);
              const diffMs = to.getTime() - from.getTime();
              const totalHours = diffMs / (1000 * 60 * 60);
              // Subtract break time
              const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time);
              const breakHours = breakMinutes / 60;
              plannedHours = totalHours - breakHours;
            } catch (error) {
              console.error('Error calculating planned hours for PDF:', error);
            }
          }
          pdfRows += '<td>' + formatTime(Math.max(0, plannedHours)) + '</td>';
          
          pdfRows += '</tr>';
        });
      });
      
      // Create PDF content for planned works
      const pdfContent = `
        <html>
          <head>
            <title></title>
            <style>
              @page {
                margin: 0;
                size: A4 landscape;
              }
              @media print {
                @page {
                  margin: 0;
                  size: A4 landscape;
                }
                body {
                  margin: 0;
                  padding: 20px;
                }
              }
              body { font-family: Arial, sans-serif; margin: 20px; font-size: 10px; }
              h1 { color: #2563eb; text-align: center; font-size: 18px; }
              h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 10px; }
              th { background-color: #f3f4f6; font-weight: bold; }
              .summary { background-color: #f9fafb; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <h1>{stageCode} - Production Plan - ${new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</h1>
            <div class="summary">
              <h2>Summary</h2>
              <p><strong>Total Planned Works:</strong> ${totalPlannedWorks}</p>
              <p><strong>Total Planned Manhours:</strong> ${totalPlannedManhours.toFixed(2)}</p>
            </div>
            <h2>Planned Works Details</h2>
            <table>
              <thead>
                <tr>
                  <th>Work Order Number</th>
                  <th>Pre Work Order Number</th>
                  <th>Work Code</th>
                  <th>Work Name</th>
                  <th>Skill Competency</th>
                  <th>Standard Time</th>
                  <th>Worker</th>
                  <th>SC</th>
                  <th>Time Worked Till Date</th>
                  <th>From Time</th>
                  <th>To Time</th>
                  <th>Planned Hours</th>
                </tr>
              </thead>
              <tbody>
                ${pdfRows}
              </tbody>
            </table>
          </body>
        </html>
      `;

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        // Set document title to empty to avoid header
        printWindow.document.title = '';
        printWindow.focus();
        setTimeout(() => {
          // Check if window is still open and valid before printing
          if (printWindow && !printWindow.closed) {
            try {
              printWindow.print();
            } catch (printError) {
              console.error('Error calling print():', printError);
              // Window might have been closed, just log the error
            }
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  }

  // Skill hierarchy for deviation comparison
  function getSkillLevel(skill: string): number {
    if (!skill) return 0;
    const skillUpper = skill.toUpperCase();
    if (skillUpper === 'T') return 1;
    if (skillUpper === 'US') return 2;
    if (skillUpper === 'SS') return 3;
    if (['S', 'S1', 'TW', 'MW', 'MW1'].includes(skillUpper)) return 4;
    if (['S2', 'MW2'].includes(skillUpper)) return 5;
    if (skillUpper === 'F') return 6;
    return 0; // Unknown skill
  }

  // Compare worker skill with required skill and return deviation message
  function getSkillDeviation(workerSkill: string, requiredSkill: string): string {
    if (!workerSkill || !requiredSkill) return '';
    
    const workerLevel = getSkillLevel(workerSkill);
    const requiredLevel = getSkillLevel(requiredSkill);
    
    if (workerLevel === 0 || requiredLevel === 0) return ''; // Unknown skills
    
    if (workerLevel === requiredLevel) return ''; // Match, no deviation
    
    if (workerLevel > requiredLevel) return 'Used skill > required';
    if (workerLevel < requiredLevel) return 'Used skill < required';
    
    return '';
  }

  function generateReportExcel() {
    try {
      if (reportData.length === 0) {
        alert('No report data available to export.');
        return;
      }

      // Calculate statistics
      // Count unique works (by work code) instead of total report records
      const uniqueWorkCodes = new Set(
        reportData.map(report => {
          const workDetails = report.prdn_work_planning?.std_work_type_details;
          return workDetails?.derived_sw_code || report.prdn_work_planning?.other_work_code || workDetails?.sw_code;
        }).filter(Boolean)
      );
      const totalReportedWorks = uniqueWorkCodes.size;
      const totalTimeWorked = reportData.reduce((sum, report) => 
        sum + (report.hours_worked_till_date || 0) + (report.hours_worked_today || 0), 0);
      const totalLostTime = reportData.reduce((sum, report) => sum + (report.lt_minutes_total || 0), 0);
      // Count unique works that are completed (not skill competencies)
      const completedWorkCodes = new Set(
        reportData
          .filter(report => report.completion_status === 'C')
          .map(report => {
            const workDetails = report.prdn_work_planning?.std_work_type_details;
            return workDetails?.derived_sw_code || workDetails?.sw_code;
          })
          .filter(Boolean)
      );
      const completedWorks = completedWorkCodes.size;
      
      // Group reports by work code for merging cells
      const grouped = (reportData || []).reduce((groups, report) => {
        if (!report) return groups;
        const workDetails = report.prdn_work_planning?.std_work_type_details;
        const workCode = workDetails?.derived_sw_code || report.prdn_work_planning?.other_work_code || workDetails?.sw_code || 'unknown';
        if (!groups[workCode]) {
          groups[workCode] = [];
        }
        groups[workCode].push(report);
        return groups;
      }, {} as Record<string, any[]>);
      
      // Sort work codes: C first, then M, then P, then O (non-standard)
      function getWorkCodeSortOrder(workCode: string): number {
        if (!workCode) return 999;
        const firstChar = workCode.charAt(0).toUpperCase();
        if (firstChar === 'C') return 1;
        if (firstChar === 'M') return 2;
        if (firstChar === 'P') return 3;
        if (firstChar === 'O') return 4;
        return 999; // Other codes go last
      }
      
      // Sort grouped entries by work code
      const sortedGroupEntries = Object.entries(grouped).sort(([codeA], [codeB]) => {
        const orderA = getWorkCodeSortOrder(codeA);
        const orderB = getWorkCodeSortOrder(codeB);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // If same category, sort alphabetically
        return codeA.localeCompare(codeB);
      });
      
      // Create Excel data with merged cells support
      const excelData: any[] = [];
      const merges: XLSX.Range[] = [];
      let currentRow = 1; // Start after header row (row 0)
      
      sortedGroupEntries.forEach(([workCodeKey, reports]) => {
        const reportsArray = reports as any[];
        if (reportsArray.length === 0) return;
        
        const firstReport = reportsArray[0];
        const planning = firstReport.prdn_work_planning;
        const workDetails = planning?.std_work_type_details;
        const workCode = workDetails?.derived_sw_code || planning?.other_work_code || workDetails?.sw_code || 'N/A';
        // For non-standard works, use workAdditionData.other_work_desc; for standard works, use std_work_details.sw_name
        const workName = planning?.other_work_code 
          ? (firstReport.workAdditionData?.other_work_desc || planning?.other_work_code)
          : (workDetails?.std_work_details?.sw_name || 'N/A');
        const woNo = planning?.prdn_wo_details?.wo_no || 'N/A';
        const pwoNo = planning?.prdn_wo_details?.pwo_no || 'N/A';
        // Get skill competency from skillMapping (via wsm_id from planning)
        const skillCompetency = firstReport.skillMapping?.sc_name || planning?.std_work_skill_mapping?.sc_name || planning?.sc_required || 'N/A';
        // Get Standard Time from vehicleWorkFlow
        const standardTime = firstReport.vehicleWorkFlow?.estimated_duration_minutes 
          ? formatTime(firstReport.vehicleWorkFlow.estimated_duration_minutes / 60) 
          : 'N/A';
        const rowspan = reportsArray.length;
        
        // Generate rows for this group
        reportsArray.forEach((report: any, index: number) => {
          const worker = report.prdn_work_planning?.hr_emp;
          const isFirstRow = index === 0;
          
          // Get lost time reasons - formatted
          const lostTimeReasons = formatLostTimeDetails(report.lt_details);
          
          const row: any = {};
          
          // Work Order Number - merged
          if (isFirstRow) {
            row['Work Order Number'] = woNo;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 0 },
                e: { r: currentRow + rowspan - 1, c: 0 }
              });
            }
          }
          
          // Pre Work Order Number - merged
          if (isFirstRow) {
            row['Pre Work Order Number'] = pwoNo;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 1 },
                e: { r: currentRow + rowspan - 1, c: 1 }
              });
            }
          }
          
          // Work Code - merged
          if (isFirstRow) {
            row['Work Code'] = workCode;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 2 },
                e: { r: currentRow + rowspan - 1, c: 2 }
              });
            }
          }
          
          // Work Name - merged
          if (isFirstRow) {
            row['Work Name'] = workName;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 3 },
                e: { r: currentRow + rowspan - 1, c: 3 }
              });
            }
          }
          
          // Skills Required - merged
          if (isFirstRow) {
            row['Skills Required'] = skillCompetency;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 4 },
                e: { r: currentRow + rowspan - 1, c: 4 }
              });
            }
          }
          
          // Standard Time - merged
          if (isFirstRow) {
            row['Standard Time'] = standardTime;
            if (rowspan > 1) {
              merges.push({
                s: { r: currentRow, c: 5 },
                e: { r: currentRow + rowspan - 1, c: 5 }
              });
            }
          }
          
          // Status - not merged
          row['Status'] = report.completion_status === 'C' ? 'Completed' : report.completion_status === 'NC' ? 'Not Completed' : report.completion_status || 'N/A';
          
          // Worker - not merged
          row['Worker'] = worker?.emp_name || 'N/A';
          
          // SC - not merged (skill competency of worker)
          row['SC'] = worker?.skill_short || 'N/A';
          
          // Time Worked Till Date - not merged
          row['Time Worked Till Date'] = formatTime(report.hours_worked_till_date || 0);
          
          // From Time - not merged
          row['From Time'] = to12HourTime(report.from_time || '');
          
          // To Time - not merged
          row['To Time'] = to12HourTime(report.to_time || '');
          
          // Hours Worked - not merged
          row['Hours Worked'] = formatTime(report.hours_worked_today || 0);
          
          // Total Hours Worked - not merged
          row['Total Hours Worked'] = formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0));
          
          // Lost Time - not merged
          row['Lost Time'] = report.lt_minutes_total > 0 ? `${Math.floor(report.lt_minutes_total / 60)} Hr ${report.lt_minutes_total % 60} Min` : '0 Hr 0 Min';
          
          // Reason - not merged
          row['Reason'] = lostTimeReasons || '';
          
          // Deviations - not merged (after Reason)
          const workerSkill = worker?.skill_short || '';
          const requiredSkill = planning?.sc_required || '';
          const deviation = getSkillDeviation(workerSkill, requiredSkill);
          row['Deviations'] = deviation || '';
          
          excelData.push(row);
          currentRow++;
        });
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create summary sheet
      const summaryData = [
        [`{stageCode} - Production Report - ${new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`],
        [],
        ['Summary'],
        ['Total Reported Works:', totalReportedWorks],
        ['Total Manhours Reported:', formatTime(totalTimeWorked)],
        ['Completed Works:', completedWorks],
        ['Total Lost Manhours:', formatTime(totalLostTime / 60)],
        []
      ];
      
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths for summary
      wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];
      
      // Add borders to summary cells
      const summaryRange = XLSX.utils.decode_range(wsSummary['!ref'] || 'A1:B1');
      for (let R = 0; R <= summaryRange.e.r; R++) {
        for (let C = 0; C <= summaryRange.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!wsSummary[cellAddress]) continue;
          (wsSummary[cellAddress] as any).s = {
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          };
        }
      }
      
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      
      // Create data sheet with headers
      const wsData = XLSX.utils.json_to_sheet(excelData);
      
      // Apply merges
      if (merges.length > 0) {
        wsData['!merges'] = merges;
      }
      
      // Set column widths (order must match the order of keys in row objects)
      wsData['!cols'] = [
        { wch: 18 }, // Work Order Number (col 0)
        { wch: 20 }, // Pre Work Order Number (col 1)
        { wch: 15 }, // Work Code (col 2)
        { wch: 40 }, // Work Name (col 3)
        { wch: 15 }, // Skills Required (col 4)
        { wch: 15 }, // Standard Time (col 5)
        { wch: 15 }, // Status (col 6)
        { wch: 20 }, // Worker (col 7)
        { wch: 10 }, // SC (col 8)
        { wch: 22 }, // Time Worked Till Date (col 9)
        { wch: 12 }, // From Time (col 10)
        { wch: 12 }, // To Time (col 11)
        { wch: 18 }, // Hours Worked (col 12)
        { wch: 18 }, // Total Hours Worked (col 13)
        { wch: 18 }, // Lost Time (col 14)
        { wch: 30 }, // Reason (col 15)
        { wch: 20 }  // Deviations (col 16)
      ];
      
      // Add borders to all cells
      const range = XLSX.utils.decode_range(wsData['!ref'] || 'A1');
      for (let R = 0; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!wsData[cellAddress]) continue;
          const cell = wsData[cellAddress] as any;
          if (!cell.s) cell.s = {};
          cell.s.border = {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          };
          // Header row styling
          if (R === 0) {
            cell.s.font = { bold: true };
            cell.s.fill = { fgColor: { rgb: 'F3F4F6' } };
          }
        }
      }
      
      XLSX.utils.book_append_sheet(wb, wsData, 'Reported Works');
      
      // Write file
      XLSX.writeFile(wb, formatStageShiftExportFilename(stageCode, shiftCode, selectedDate, 'Work_Reporting'));
      
      console.log('✅ Excel report generated successfully');
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Error generating Excel file. Please try again.');
    }
  }

  function generateReportPDF() {
    try {
      // Calculate summary statistics
      // Count unique works (by work code) instead of total report records
      const uniqueWorkCodes = new Set(
        reportData.map(report => {
          const workDetails = report.prdn_work_planning?.std_work_type_details;
          return workDetails?.derived_sw_code || report.prdn_work_planning?.other_work_code || workDetails?.sw_code;
        }).filter(Boolean)
      );
      const totalReportedWorks = uniqueWorkCodes.size;
      const totalTimeWorked = reportData.reduce((sum, report) => 
        sum + (report.hours_worked_till_date || 0) + (report.hours_worked_today || 0), 0);
      const totalLostTime = reportData.reduce((sum, report) => sum + (report.lt_minutes_total || 0), 0);
      // Count unique works that are completed (not skill competencies)
      const completedWorkCodes = new Set(
        reportData
          .filter(report => report.completion_status === 'C')
          .map(report => {
            const workDetails = report.prdn_work_planning?.std_work_type_details;
            return workDetails?.derived_sw_code || report.prdn_work_planning?.other_work_code || workDetails?.sw_code;
          })
          .filter(Boolean)
      );
      const completedWorks = completedWorkCodes.size;

      // Generate HTML rows for PDF (outside template literal to avoid conflicts)
      // Group reports by work code
      const grouped = (reportData || []).reduce((groups, report) => {
        if (!report) return groups;
        const workDetails = report.prdn_work_planning?.std_work_type_details;
        const workCode = workDetails?.derived_sw_code || report.prdn_work_planning?.other_work_code || workDetails?.sw_code || 'unknown';
        if (!groups[workCode]) {
          groups[workCode] = [];
        }
        groups[workCode].push(report);
        return groups;
      }, {} as Record<string, any[]>);
      
      // Sort work codes: C first, then M, then P, then O (non-standard)
      function getWorkCodeSortOrder(workCode: string): number {
        if (!workCode) return 999;
        const firstChar = workCode.charAt(0).toUpperCase();
        if (firstChar === 'C') return 1;
        if (firstChar === 'M') return 2;
        if (firstChar === 'P') return 3;
        if (firstChar === 'O') return 4;
        return 999; // Other codes go last
      }
      
      // Sort grouped entries by work code
      const sortedGroupEntries = Object.entries(grouped).sort(([codeA], [codeB]) => {
        const orderA = getWorkCodeSortOrder(codeA);
        const orderB = getWorkCodeSortOrder(codeB);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // If same category, sort alphabetically
        return codeA.localeCompare(codeB);
      });
      
      // Generate rows with merged cells
      let pdfRows = '';
      sortedGroupEntries.forEach(([workCodeKey, reports]) => {
        const reportsArray = reports as any[];
        if (reportsArray.length === 0) return;
        
        const firstReport = reportsArray[0];
        const planning = firstReport.prdn_work_planning;
        const workDetails = planning?.std_work_type_details;
        const workCode = workDetails?.derived_sw_code || planning?.other_work_code || workDetails?.sw_code || 'N/A';
        // For non-standard works, use workAdditionData.other_work_desc; for standard works, use std_work_details.sw_name
        const workName = planning?.other_work_code 
          ? (firstReport.workAdditionData?.other_work_desc || planning?.other_work_code)
          : (workDetails?.std_work_details?.sw_name || 'N/A');
        const woNo = planning?.prdn_wo_details?.wo_no || 'N/A';
        const pwoNo = planning?.prdn_wo_details?.pwo_no || 'N/A';
        // Get skill competency from skillMapping (via wsm_id from planning)
        const skillCompetency = firstReport.skillMapping?.sc_name || planning?.std_work_skill_mapping?.sc_name || planning?.sc_required || 'N/A';
        // Get Standard Time from vehicleWorkFlow
        const standardTime = firstReport.vehicleWorkFlow?.estimated_duration_minutes 
          ? formatTime(firstReport.vehicleWorkFlow.estimated_duration_minutes / 60) 
          : 'N/A';
        const rowspan = reportsArray.length;
        
        // Generate rows for this group
        reportsArray.forEach((report: any, index: number) => {
          const worker = report.prdn_work_planning?.hr_emp;
          const isFirstRow = index === 0;
          
          // Get lost time reasons - formatted
          const lostTimeReasons = formatLostTimeDetails(report.lt_details);
          
          pdfRows += '<tr>';
          
          // Work Order Number - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + woNo + '</td>';
          }
          
          // Pre Work Order Number - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + pwoNo + '</td>';
          }
          
          // Work Code - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + workCode + '</td>';
          }
          
          // Work Name - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + workName + '</td>';
          }
          
          // Skills Required - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + skillCompetency + '</td>';
          }
          
          // Standard Time - merged
          if (isFirstRow) {
            pdfRows += '<td rowspan="' + rowspan + '">' + standardTime + '</td>';
          }
          
          // Status - not merged
          const status = report.completion_status === 'C' ? 'Completed' : report.completion_status === 'NC' ? 'Not Completed' : report.completion_status || 'N/A';
          pdfRows += '<td>' + status + '</td>';
          
          // Worker - not merged
          pdfRows += '<td>' + (worker?.emp_name || 'N/A') + '</td>';
          
          // SC - not merged (skill competency of worker)
          pdfRows += '<td>' + (worker?.skill_short || 'N/A') + '</td>';
          
          // Time Worked Till Date - not merged
          pdfRows += '<td>' + formatTime(report.hours_worked_till_date || 0) + '</td>';
          
          // From Time - not merged
          pdfRows += '<td>' + to12HourTime(report.from_time || '') + '</td>';
          
          // To Time - not merged
          pdfRows += '<td>' + to12HourTime(report.to_time || '') + '</td>';
          
          // Hours Worked - not merged
          pdfRows += '<td>' + formatTime(report.hours_worked_today || 0) + '</td>';
          
          // Total Hours Worked - not merged
          pdfRows += '<td>' + formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0)) + '</td>';
          
          // Lost Time - not merged
          const lostTime = report.lt_minutes_total > 0 
            ? Math.floor(report.lt_minutes_total / 60) + ' Hr ' + (report.lt_minutes_total % 60) + ' Min'
            : '0 Hr 0 Min';
          pdfRows += '<td>' + lostTime + '</td>';
          
          // Reason - not merged
          pdfRows += '<td>' + (lostTimeReasons || '') + '</td>';
          
          // Deviations - not merged (after Reason)
          const workerSkill = worker?.skill_short || '';
          const requiredSkill = planning?.sc_required || '';
          const deviation = getSkillDeviation(workerSkill, requiredSkill);
          pdfRows += '<td>' + (deviation || '') + '</td>';
          
          pdfRows += '</tr>';
        });
      });

      // Create PDF content for reported works
      const pdfContent = `
        <html>
          <head>
            <title></title>
            <style>
              @page {
                margin: 0;
                size: A4 landscape;
              }
              @media print {
                @page {
                  margin: 0;
                  size: A4 landscape;
                }
                body {
                  margin: 0;
                  padding: 20px;
                }
              }
              body { font-family: Arial, sans-serif; margin: 20px; font-size: 10px; }
              h1 { color: #2563eb; text-align: center; font-size: 18px; }
              h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 10px; }
              th { background-color: #f3f4f6; font-weight: bold; }
              .summary { background-color: #f9fafb; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <h1>{stageCode} - Production Report - ${new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</h1>
            <div class="summary">
              <h2>Summary</h2>
              <p><strong>Total Reported Works:</strong> ${totalReportedWorks}</p>
              <p><strong>Total Manhours Reported:</strong> ${formatTime(totalTimeWorked)}</p>
              <p><strong>Completed Works:</strong> ${completedWorks}</p>
              <p><strong>Total Lost Manhours:</strong> ${formatTime(totalLostTime / 60)}</p>
            </div>
            <h2>Reported Works Details</h2>
            <table>
              <thead>
                <tr>
                  <th>Work Order Number</th>
                  <th>Pre Work Order Number</th>
                  <th>Work Code</th>
                  <th>Work Name</th>
                  <th>Skills Required</th>
                  <th>Standard Time</th>
                  <th>Status</th>
                  <th>Worker</th>
                  <th>SC</th>
                  <th>Time Worked Till Date</th>
                  <th>From Time</th>
                  <th>To Time</th>
                  <th>Hours Worked</th>
                  <th>Total Hours Worked</th>
                  <th>Lost Time</th>
                  <th>Reason</th>
                  <th>Deviations</th>
                </tr>
              </thead>
              <tbody>
                ${pdfRows}
              </tbody>
            </table>
          </body>
        </html>
      `;

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        // Set document title to empty to avoid header
        printWindow.document.title = '';
        printWindow.focus();
        setTimeout(() => {
          // Check if window is still open and valid before printing
          if (printWindow && !printWindow.closed) {
            try {
              printWindow.print();
            } catch (printError) {
              console.error('Error calling print():', printError);
              // Window might have been closed, just log the error
            }
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  }

  function handleMultiReport() {
    if (selectedRows.size === 0) {
      alert('Please select at least one row to report');
      return;
    }

    // Check if all selected rows are from the same work (same work code)
    const selectedWorks = plannedWorksWithStatus.filter(work => selectedRows.has(work.id));
    const workCodes = [...new Set(selectedWorks.map(work => 
      work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code
    ))];
    
    if (workCodes.length > 1) {
      alert('Please select only skill competencies from the same work');
      return;
    }

    // Check if all skill competencies for this work are already reported
    const workCode = workCodes[0];
    const allWorksForThisCode = plannedWorksWithStatus.filter(work => {
      const code = work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code;
      return code === workCode;
    });

    const allReported = allWorksForThisCode.every(work => 
      work.workLifecycleStatus && work.workLifecycleStatus !== 'Planned'
    );

    if (allReported) {
      alert('All skill competencies for this work have already been reported.');
      clearAllSelections();
      return;
    }

    // Check if any selected works are already reported
    const alreadyReported = selectedWorks.filter(work => 
      work.workLifecycleStatus && work.workLifecycleStatus !== 'Planned'
    );

    if (alreadyReported.length > 0) {
      alert(`Some of the selected skill competencies have already been reported. Please select only unreported skills.`);
      return;
    }

    // Store selected works for the multi-skill modal
    selectedWorksForMultiReport = selectedWorks;
    showMultiReportModal = true;
  }

  // Check if all skill competencies for a work are reported
  function areAllSkillsReported(workCode: string): boolean {
    const allWorksForThisCode = plannedWorksWithStatus.filter(work => {
      const code = work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code;
      return code === workCode;
    });

    if (allWorksForThisCode.length === 0) return false;

    return allWorksForThisCode.every(work => 
      work.workLifecycleStatus && work.workLifecycleStatus !== 'Planned'
    );
  }

  // Check if any selected works are already reported
  function hasReportedSkillsSelected(): boolean {
    if (selectedRows.size === 0) return false;
    
    const selectedWorks = plannedWorksWithStatus.filter(work => selectedRows.has(work.id));
    return selectedWorks.some(work => 
      work.workLifecycleStatus && work.workLifecycleStatus !== 'Planned'
    );
  }

  function handleMultiReportModalClose() {
    showMultiReportModal = false;
    selectedWorksForMultiReport = [];
    clearAllSelections();
  }

  async function handleMultiDelete() {
    if (selectedRows.size === 0) {
      alert('Please select at least one skill competency to delete');
      return;
    }

    // Check if all selected rows are from the same work (same work code)
    const selectedWorks = plannedWorksWithStatus.filter(work => selectedRows.has(work.id));
    const workCodes = [...new Set(selectedWorks.map(work => {
      const code = work.std_work_type_details?.derived_sw_code || 
                   work.std_work_type_details?.sw_code ||
                   work.derived_sw_code ||
                   work.other_work_code;
      return code;
    }).filter(Boolean))];
    
    if (workCodes.length > 1) {
      alert('Please select only skill competencies from the same work');
      return;
    }

    // Get work details for confirmation message
    const workCode = workCodes[0] || 'Unknown';
    const firstWork = selectedWorks[0];
    const woNo = firstWork?.prdn_wo_details?.wo_no || 'N/A';
    const workName = firstWork?.std_work_type_details?.std_work_details?.sw_name || 
                     firstWork?.workAdditionData?.other_work_desc || 
                     'N/A';

    // Build confirmation message with details
    let confirmMessage = `Are you sure you want to delete ${selectedWorks.length} skill competency${selectedWorks.length === 1 ? '' : 'ies'}?\n\n`;
    confirmMessage += `Work Code: ${workCode}\n`;
    confirmMessage += `Work Name: ${workName}\n`;
    confirmMessage += `Work Order: ${woNo}\n\n`;
    confirmMessage += `Selected Skills:\n`;
    selectedWorks.forEach((work, index) => {
      const skill = work.skillMapping?.sc_name || work.sc_required || 'N/A';
      const worker = work.hr_emp?.emp_name || 'N/A';
      const time = `${work.from_time} - ${work.to_time}`;
      confirmMessage += `${index + 1}. ${skill} - ${worker} (${time})\n`;
    });
    confirmMessage += `\nThis will soft-delete the plans and allow the work to be planned again.`;

    const confirmed = confirm(confirmMessage);
    if (!confirmed) return;

    try {
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();

      // Get all planning IDs to delete
      const planningIds = selectedWorks.map(work => work.id).filter(Boolean);

      if (planningIds.length === 0) {
        alert('No valid planning records to delete');
        return;
      }

      // Soft delete all selected planning records
      const { error } = await supabase
        .from('prdn_work_planning')
        .update({ 
          is_deleted: true,
          modified_by: currentUser,
          modified_dt: now
        })
        .in('id', planningIds);

      if (error) {
        console.error('Error deleting work plans:', error);
        alert('Error deleting work plans. Please try again.');
        return;
      }

      console.log(`✅ Successfully deleted ${planningIds.length} planning record(s)`);
      
      // Clear selections
      clearAllSelections();
      
      // Reload planned works data
      await loadPlannedWorksData();
      
      // Show success message
      alert(`Successfully deleted ${planningIds.length} skill competency${planningIds.length === 1 ? '' : 'ies'}. The work can now be planned again.`);
    } catch (error) {
      console.error('Error deleting work plans:', error);
      alert('Error deleting work plans. Please try again.');
    }
  }

  async function handleReportSave(event: CustomEvent) {
    console.log('Work report save event:', event.detail);
    
    try {
      const result = event.detail;
      
      if (result.success) {
        console.log('Work report saved successfully:', result.message);
        
        // Reload works data to update status
        await loadWorksData();
        
        // Reload planned works data to reflect the updated status
        if (activeTab === 'plan') {
          await loadPlannedWorksData();
        }
        
        handleReportModalClose();
      } else {
        console.error('Error saving work report:', result.error);
        alert('Error saving work report. Please try again.');
      }
    } catch (error) {
      console.error('Error handling work report save:', error);
      alert('Error saving work report. Please try again.');
    }
  }

  async function handleMultiSkillReportSave(event: CustomEvent) {
    console.log('Multi-skill report save event:', event.detail);
    
    try {
      const result = event.detail;
      
      if (result.success) {
        console.log('Multi-skill report saved successfully:', result.message);
        
        // Reload works data to update status
        await loadWorksData();
        
        // Reload planned works data to reflect the updated status
        if (activeTab === 'plan') {
          await loadPlannedWorksData();
        }
        
        handleMultiReportModalClose();
      } else {
        console.error('Error saving multi-skill report:', result.error);
        alert('Error saving multi-skill report. Please try again.');
      }
    } catch (error) {
      console.error('Error handling multi-skill report save:', error);
      alert('Error saving multi-skill report. Please try again.');
    }
  }

  async function handleDeletePlan(plannedWork: any) {
    const workCode = plannedWork.std_work_type_details?.sw_code || plannedWork.derived_sw_code || 'Unknown';
    const workerName = plannedWork.hr_emp?.emp_name || 'Unknown Worker';
    
    const confirmed = confirm(
      `Are you sure you want to delete the work plan?\n\n` +
      `Work Code: ${workCode}\n` +
      `Worker: ${workerName}\n` +
      `Time: ${plannedWork.from_time} - ${plannedWork.to_time}\n\n` +
      `This will soft-delete the plan and allow the work to be planned again.`
    );
    
    if (!confirmed) return;

    try {
      const { getCurrentUsername, getCurrentTimestamp } = await import('$lib/utils/userUtils');
      const currentUser = getCurrentUsername();
      const now = getCurrentTimestamp();
      
      const { error } = await supabase
        .from('prdn_work_planning')
        .update({ 
          is_deleted: true,
          modified_by: currentUser,
          modified_dt: now
          // created_by and created_dt should not be touched on update
        })
        .eq('id', plannedWork.id);

      if (error) {
        console.error('Error deleting work plan:', error);
        alert('Error deleting work plan. Please try again.');
        return;
      }

      console.log('Work plan soft-deleted successfully');
      
      // Reload planned works data to reflect the deletion
      await loadPlannedWorksData();
      
      // Show success message
      alert(`Work plan for ${workCode} has been deleted successfully. The work can now be planned again.`);
    } catch (error) {
      console.error('Error deleting work plan:', error);
      alert('Error deleting work plan. Please try again.');
    }
  }

  // Load break times when date changes
  $: if (selectedDate) {
    loadShiftBreakTimesLocal();
  }

  onMount(async () => {
    console.log('🚀 Page mounted, selectedDate:', selectedDate);
    
    // Load menus for sidebar
    const username = localStorage.getItem('username');
    if (username) {
      try {
        menus = await fetchUserMenus(username);
      } catch (error) {
        console.error('Error loading menus:', error);
      }
    }
    
    // Load initial data for the default tab (work-orders)
    await loadWorkOrdersData();
    await loadWorksData();
    isLoading = false;
    
    console.log('📊 Initial data loaded:', {
      workOrdersData: workOrdersData.length,
      worksData: worksData.length,
      activeTab
    });
  });
</script>

<svelte:head>
  <title>{getStageShiftDisplayName(stageCode, shiftCode)}</title>
</svelte:head>

<div class="min-h-screen theme-bg-primary">
  <!-- Header with Burger, Tabs, and Favicon -->
  <div class="theme-bg-primary shadow-sm border-b theme-border">
    <div class="w-full mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between py-4">
        <!-- Burger Menu -->
        <button 
          class="p-2 rounded hover:theme-bg-tertiary focus:outline-none transition-colors duration-200" 
          on:click={handleSidebarToggle} 
          aria-label="Show sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 theme-text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Tab Navigation -->
        <nav class="flex space-x-8 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {#each tabs as tab}
            <button
              class="py-2 px-3 font-medium text-sm transition-colors duration-200 rounded-lg whitespace-nowrap flex-shrink-0 {activeTab === tab.id 
                ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
                : 'border-2 border-transparent theme-text-secondary hover:theme-text-primary hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/20'}"
              on:click={() => handleTabChange(tab.id)}
            >
              <span class="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          {/each}
        </nav>

        <!-- Date Selection -->
        <div class="flex items-center space-x-4">
          <label for="selectedDate" class="text-sm font-medium theme-text-primary">
            Select Date:
          </label>
          <input
            id="selectedDate"
            type="date"
            bind:value={selectedDate}
            on:change={handleDateChange}
            class="px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span class="text-sm theme-text-secondary">
            Current Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
          </span>
        </div>

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



  <!-- Tab Content -->
  <div class="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {#if activeTab === 'work-orders'}
       <!-- Work Orders Tab -->
       <div class="theme-bg-primary rounded-lg shadow border theme-border">
         <div class="p-6 border-b theme-border">
           <div class="flex items-center justify-between mb-4">
             <h2 class="text-xl font-semibold theme-text-primary">📦 Active Work Orders in {stageCode}</h2>
             <div class="flex gap-2">
               <Button variant="primary" size="sm" on:click={handleWorkOrderEntry}>
                 Entry
               </Button>
               <Button variant="primary" size="sm" on:click={handleWorkOrderExit}>
                 Exit
               </Button>
             </div>
           </div>
           <p class="theme-text-secondary mb-4">
             Work orders active in {stageCode} stage for {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })} - showing pending and in-progress work orders
           </p>
           
           <!-- Date Comparison Legend -->
           <div class="flex flex-wrap gap-4 text-sm mb-4">
             <div class="flex items-center gap-2">
               <div class="w-4 h-4 rounded" style="background-color: #dcfce7;"></div>
               <span class="theme-text-primary">On Time (0 days)</span>
             </div>
             <div class="flex items-center gap-2">
               <div class="w-4 h-4 rounded" style="background-color: #fef3c7;"></div>
               <span class="theme-text-primary">Slight Delay (1-2 days)</span>
             </div>
             <div class="flex items-center gap-2">
               <div class="w-4 h-4 rounded" style="background-color: #fed7aa;"></div>
               <span class="theme-text-primary">Moderate Delay (3-5 days)</span>
             </div>
             <div class="flex items-center gap-2">
               <div class="w-4 h-4 rounded" style="background-color: #fecaca;"></div>
               <span class="theme-text-primary">Significant Delay (5+ days)</span>
             </div>
           </div>
         </div>
         
         {#if isWorkOrdersLoading}
           <div class="flex items-center justify-center py-12">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
             <span class="theme-text-secondary">Loading work orders...</span>
           </div>
         {:else if workOrdersData.length === 0}
           <div class="text-center py-12">
             <div class="text-6xl mb-4">📦</div>
             <p class="theme-text-secondary text-lg">No active work orders in {stageCode}</p>
             <p class="theme-text-secondary text-sm mt-2">
               Work orders will appear here when they reach {stageCode} stage
             </p>
           </div>
         {:else}
           <div class="overflow-x-auto">
             <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
               <thead class="theme-bg-secondary">
                 <tr>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     Work Order
                   </th>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     PWO Number
                   </th>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     Model
                   </th>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     Customer
                   </th>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     Document Release
                   </th>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     Planned Start
                   </th>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     Actual Start
                   </th>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     Planned End
                   </th>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     Actual End
                   </th>
                   <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                     Status
                   </th>
                 </tr>
               </thead>
               <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
                 {#each workOrdersData as workOrder}
                  {@const plannedStart = getPlannedStartDate(workOrder)}
                  {@const actualStart = getActualStartDate(workOrder)}
                  {@const daysDiff = workOrder.workingDaysDiff || 0}
                  {@const endDaysDiff = workOrder.endWorkingDaysDiff || 0}
                  {@const rowBgClass = getRowBackgroundColor(daysDiff)}
                  {@const workStatus = getWorkOrderStatus(workOrder)}
                   <tr class="hover:theme-bg-secondary transition-colors" 
                       class:on-time={rowBgClass === 'on-time'} 
                       class:slight-delay={rowBgClass === 'slight-delay'} 
                       class:moderate-delay={rowBgClass === 'moderate-delay'} 
                       class:significant-delay={rowBgClass === 'significant-delay'}>
                     <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                       {workOrder.prdn_wo_details?.wo_no || 'N/A'}
                     </td>
                     <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                       {workOrder.prdn_wo_details?.pwo_no || 'N/A'}
                     </td>
                     <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                       {workOrder.prdn_wo_details?.wo_model || 'N/A'}
                     </td>
                     <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                       {workOrder.prdn_wo_details?.customer_name || 'N/A'}
                     </td>
                     <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                       {getDocumentReleaseDate(workOrder)}
                     </td>
                     <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                       {getPlannedStartDate(workOrder)}
                     </td>
                     <td class="px-6 py-4 whitespace-nowrap text-sm">
                       {#if getActualStartDate(workOrder) !== 'N/A'}
                        <span class="{getDateColor(daysDiff)}">
                          {getActualStartDate(workOrder)}
                        </span>
                        {#if daysDiff !== 0}
                          <div class="text-xs {getDateColor(daysDiff)}">
                            ({daysDiff > 0 ? '+' : ''}{daysDiff} working days)
                          </div>
                        {/if}
                       {:else}
                         <div>
                          <span class="text-gray-500 dark:text-gray-400">Not Started</span>
                          {#if daysDiff > 0}
                            <div class="text-xs {getDateColor(daysDiff)}">
                              (Delayed by {daysDiff} working days)
                            </div>
                          {/if}
                         </div>
                       {/if}
                     </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                      {getPlannedEndDate(workOrder)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm {rowBgClass ? 'text-gray-800' : 'theme-text-primary'}">
                      {#if getActualEndDate(workOrder) !== 'N/A'}
                        <span class="{getDateColor(endDaysDiff)}">
                          {getActualEndDate(workOrder)}
                        </span>
                        {#if endDaysDiff !== 0}
                          <div class="text-xs {getDateColor(endDaysDiff)}">
                            ({endDaysDiff > 0 ? '+' : ''}{endDaysDiff} working days)
                          </div>
                        {/if}
                      {:else}
                        <div>
                          <span class="text-gray-500 dark:text-gray-400">Not Completed</span>
                          {#if endDaysDiff > 0}
                            <div class="text-xs {getDateColor(endDaysDiff)}">
                              (Delayed by {endDaysDiff} working days)
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </td>
                     <td class="px-6 py-4 whitespace-nowrap text-sm">
                       <span class="font-medium {workStatus.color}">
                         {workStatus.status}
                       </span>
                     </td>
                   </tr>
                 {/each}
               </tbody>
             </table>
           </div>
           
           <!-- Summary -->
           <div class="px-6 py-4 theme-bg-secondary border-t theme-border">
             <div class="flex flex-wrap gap-4 text-sm">
               <div class="theme-text-secondary">
                 <span class="font-medium">Total Work Orders:</span> {workOrdersData.length}
               </div>
             </div>
           </div>
         {/if}
       </div>

         {:else if activeTab === 'works'}
       <!-- Works Tab -->
               <WorksTable 
          data={worksData} 
          isLoading={isWorksLoading} 
          on:export={handleWorksExport}
          on:refresh={loadWorksData}
          on:addWork={handleAddWork}
          on:viewWork={handleViewWork}
          on:removeWork={handleRemoveWork}
          on:removeSelected={handleRemoveSelected}
          on:planWork={handlePlanWork}
        />

    {:else if activeTab === 'manpower-plan'}
      <!-- Manpower Plan Tab -->
      <div class="theme-bg-primary rounded-lg shadow border theme-border">
        <div class="p-6 border-b theme-border">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-semibold theme-text-primary">👥📋 Manpower Planning</h2>
              <p class="text-sm theme-text-secondary mt-1">
                Plan attendance and stage reassignments for next day: {(() => {
                  const nextDate = new Date(selectedDate);
                  nextDate.setDate(nextDate.getDate() + 1);
                  return nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
                })()}
              </p>
            </div>
          </div>
        </div>
        {#if isManpowerPlanLoading}
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
            <span class="theme-text-secondary">Loading manpower data...</span>
          </div>
        {:else}
          <ManpowerTable 
            data={manpowerPlanData} 
            isLoading={isManpowerPlanLoading} 
            selectedDate={(() => {
              const nextDate = new Date(selectedDate);
              nextDate.setDate(nextDate.getDate() + 1);
              return nextDate.toISOString().split('T')[0];
            })()}
            on:refresh={loadManpowerPlanData}
            on:attendanceMarked={handleAttendanceMarked}
            on:bulkAttendanceMarked={handleBulkAttendanceMarked}
            on:stageReassigned={handleStageReassigned}
            on:export={handleManpowerExport} 
          />
        {/if}
      </div>

    {:else if activeTab === 'draft-plan'}
      <!-- Draft Plan Tab -->
      <div class="theme-bg-primary rounded-lg shadow border theme-border">
        <div class="p-6 border-b theme-border">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-semibold theme-text-primary">📝 Draft Planning</h2>
              <p class="text-sm theme-text-secondary mt-1">
                Review and submit all draft plans for next day: {(() => {
                  const nextDate = new Date(selectedDate);
                  nextDate.setDate(nextDate.getDate() + 1);
                  return nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
                })()}
              </p>
            </div>
            <Button 
              variant="primary" 
              size="sm" 
              on:click={handleSubmitPlanning}
              disabled={isDraftPlanLoading || (draftPlanData.length === 0 && draftManpowerPlanData.length === 0)}
            >
              Submit Planning
            </Button>
          </div>
        </div>
        {#if isDraftPlanLoading}
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
            <span class="theme-text-secondary">Loading draft plans...</span>
          </div>
        {:else if draftPlanData.length === 0 && draftManpowerPlanData.length === 0}
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📝</div>
            <p class="theme-text-secondary text-lg">No draft plans found</p>
            <p class="theme-text-secondary text-sm mt-2">
              Create plans in Works tab and Manpower Plan tab
            </p>
          </div>
        {:else}
          <div class="p-6">
            <p class="theme-text-secondary mb-4">
              Work Plans: {draftPlanData.length} | Manpower Plans: {draftManpowerPlanData.length}
            </p>
            <!-- TODO: Display draft plans in a table/list -->
          </div>
        {/if}
      </div>

    {:else if activeTab === 'plan'}
      <!-- Plan Tab -->
      <div class="theme-bg-primary rounded-lg shadow border theme-border">
        <div class="p-6 border-b theme-border">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-semibold theme-text-primary">📋 Work Planning</h2>
              <p class="theme-text-secondary mt-1">
                Planned works for {stageCode} stage on {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
              </p>
            </div>
            <div class="flex items-center space-x-3">
                  <Button variant="secondary" size="sm" on:click={loadPlannedWorksData} disabled={isPlannedWorksLoading}>
                    {isPlannedWorksLoading ? 'Loading...' : 'Refresh'}
                  </Button>
                  <Button variant="primary" size="sm" on:click={generatePlanExcel} disabled={plannedWorksWithStatus.length === 0}>
                    Generate Excel
                  </Button>
                  <Button variant="primary" size="sm" on:click={generatePlanPDF} disabled={plannedWorksWithStatus.length === 0}>
                    Generate PDF
                  </Button>
            </div>
          </div>
        </div>
        
        {#if isPlannedWorksLoading}
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
            <span class="theme-text-secondary">Loading planned works...</span>
          </div>
        {:else if plannedWorksData.length === 0}
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📋</div>
            <p class="theme-text-secondary text-lg">No planned works for this date</p>
            <p class="theme-text-secondary text-sm mt-2">
              Go to the Works tab to plan works for this date
            </p>
          </div>
        {:else}
          <!-- Multi-report controls -->
          {#if selectedRows.size > 0}
            {@const selectedWorks = plannedWorksWithStatus.filter(work => selectedRows.has(work.id))}
            {@const workCodes = [...new Set(selectedWorks.map(work => work.std_work_type_details?.derived_sw_code || work.std_work_type_details?.sw_code))]}
            {@const workCode = workCodes.length === 1 ? workCodes[0] : null}
            {@const allReported = workCode ? areAllSkillsReported(workCode) : false}
            {@const hasReported = hasReportedSkillsSelected()}
            <div class="px-6 py-3 border-b theme-border bg-blue-50 dark:bg-blue-900/20">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <span class="text-sm theme-text-primary">
                    {selectedRows.size} skill competency{selectedRows.size === 1 ? '' : 'ies'} selected
                  </span>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    on:click={handleMultiReport}
                    disabled={allReported || hasReported}
                  >
                    Report Selected Skills ({selectedRows.size})
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    on:click={handleMultiDelete}
                  >
                    Delete Selected Skills ({selectedRows.size})
                  </Button>
                  {#if allReported}
                    <span class="text-xs text-orange-600 dark:text-orange-400">
                      All skill competencies for this work have been reported
                    </span>
                  {:else if hasReported}
                    <span class="text-xs text-orange-600 dark:text-orange-400">
                      Some selected skills are already reported
                    </span>
                  {/if}
                </div>
                <Button variant="secondary" size="sm" on:click={clearAllSelections}>
                  Clear Selection
                </Button>
              </div>
            </div>
          {/if}
          
          <!-- Selection instructions -->
          <div class="px-6 py-2 theme-bg-secondary border-b theme-border">
            <p class="text-xs theme-text-primary">
              💡 <strong class="theme-text-primary">Multi-selection:</strong> You can select multiple skill competencies from the same work by expanding the group and checking individual skill rows. 
              Selecting skills from different works will clear previous selections.
            </p>
          </div>
          
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style="table-layout: auto; word-wrap: break-word;">
              <thead class="theme-bg-secondary">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Select
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Order</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">PWO Number</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Code</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider" style="max-width: 200px; width: 200px;">Work Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skills Required</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Standard Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Worker</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skill Competency of Worker</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">From Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">To Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Planned Hours</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Time Worked Till Date</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Remaining Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
                {#each Object.values(groupedPlannedWorks) as group}
                  {@const typedGroup = group as GroupedPlannedWork}
                  <!-- Group Header Row -->
                  <tr class="hover:theme-bg-secondary transition-colors cursor-pointer" on:click={(e) => { e.preventDefault(); toggleGroup(typedGroup.workCode); }}>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary" on:click|stopPropagation>
                      <input 
                        type="checkbox" 
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={typedGroup.items.every(item => selectedRows.has(item.id))}
                        on:change={(e) => {
                          e.stopPropagation();
                          const target = e.target as HTMLInputElement;
                          if (target?.checked) {
                            selectAllRowsInGroup(typedGroup);
                          } else {
                            typedGroup.items.forEach(item => selectedRows.delete(item.id));
                            selectedRows = new Set(selectedRows);
                          }
                        }}
                      />
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                      {typedGroup.woNo}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                      {typedGroup.pwoNo}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                      {typedGroup.workCode}
                    </td>
                    <td class="px-6 py-4 text-sm theme-text-primary" style="max-width: 200px; word-wrap: break-word;">
                      {typedGroup.workName}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                      {#if typedGroup.items && typedGroup.items.length > 0}
                        {@const firstItem = typedGroup.items[0]}
                        {@const skillMapping = firstItem?.skillMapping || firstItem?.std_work_skill_mapping}
                        {@const skillCompetency = skillMapping?.sc_name || (firstItem?.sc_required || 'N/A')}
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          {skillCompetency}
                        </span>
                          {:else}
                        <span class="text-gray-400">N/A</span>
                          {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                      {#if typedGroup.items && typedGroup.items.length > 0}
                        {@const firstItem = typedGroup.items[0]}
                        {firstItem?.vehicleWorkFlow?.estimated_duration_minutes ? formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60) : 'N/A'}
                      {:else}
                        N/A
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if typedGroup.items && typedGroup.items.length > 0}
                        {@const allReported = typedGroup.items.every(item => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned')}
                        {@const anyReported = typedGroup.items.some(item => item.workLifecycleStatus && item.workLifecycleStatus !== 'Planned')}
                        {#if allReported}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            Reported
                          </span>
                        {:else if anyReported}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                            Partially Reported
                          </span>
                        {:else}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                            Planned
                          </span>
                        {/if}
                      {:else}
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          Planned
                        </span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary" colspan="6">
                      <div class="text-xs theme-text-secondary">
                        Click to {isGroupExpanded(typedGroup.workCode) ? 'collapse' : 'expand'} skill details
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Individual Skill Rows (when expanded) -->
                  {#if isGroupExpanded(typedGroup.workCode)}
                    {#each typedGroup.items as plannedWork}
                      <tr class="hover:theme-bg-secondary transition-colors theme-bg-secondary/30">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                          <input 
                            type="checkbox" 
                            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedRows.has(plannedWork.id)}
                            on:change={(e) => {
                              e.stopPropagation();
                              toggleRowSelection(plannedWork.id);
                            }}
                          />
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                          {typedGroup.woNo}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                          {typedGroup.pwoNo}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium theme-text-primary">
                          {typedGroup.workCode}
                        </td>
                        <td class="px-6 py-4 text-sm theme-text-primary" style="max-width: 200px; word-wrap: break-word;">
                          {typedGroup.workName}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        {plannedWork.sc_required || 'N/A'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                          {plannedWork?.vehicleWorkFlow?.estimated_duration_minutes ? formatTime(plannedWork.vehicleWorkFlow.estimated_duration_minutes / 60) : 'N/A'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                          {#if plannedWork.workLifecycleStatus === 'Planned' || !plannedWork.workLifecycleStatus}
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              Planned
                            </span>
                          {:else}
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Reported
                            </span>
                          {/if}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                        <div class="font-medium">{plannedWork.hr_emp?.emp_name || 'N/A'}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                            {plannedWork.hr_emp?.skill_short || 'N/A'}
                          </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                      {plannedWork.from_time || 'N/A'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                      {plannedWork.to_time || 'N/A'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                          <div>
                            <div class="font-medium">
                              {#if plannedWork.from_time && plannedWork.to_time}
                                {@const calculatedHours = (() => {
                                  try {
                                    const from = new Date(`2000-01-01T${plannedWork.from_time}`);
                                    const to = new Date(`2000-01-01T${plannedWork.to_time}`);
                                    if (to < from) to.setDate(to.getDate() + 1);
                                    const diffMs = to.getTime() - from.getTime();
                                    const totalHours = diffMs / (1000 * 60 * 60);
                                    
                                    // Subtract break time
                                    const breakMinutes = calculateBreakTimeInRange(plannedWork.from_time, plannedWork.to_time);
                                    const breakHours = breakMinutes / 60;
                                    const plannedHours = totalHours - breakHours;
                                    
                                    return Math.max(0, plannedHours);
                                  } catch {
                                    return 0;
                                  }
                                })()}
                                {formatTime(calculatedHours)}
                              {:else if plannedWork.planned_hours}
                                {formatTime(plannedWork.planned_hours)}
                              {:else}
                                N/A
                              {/if}
                            </div>
                            {#if plannedWork.skillTimeStandard}
                              <div class="text-xs theme-text-secondary">
                                Standard: {formatTime(plannedWork.skillTimeStandard.standard_time_minutes / 60)}
                              </div>
                            {/if}
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                          <div>
                            <div class="font-medium">
                              {plannedWork.time_worked_till_date ? formatTime(plannedWork.time_worked_till_date) : '0h 0m'}
                            </div>
                            {#if plannedWork.skillTimeStandard}
                              <div class="text-xs theme-text-secondary">
                                Skill: {plannedWork.hr_emp?.skill_short || 'N/A'}
                              </div>
                            {/if}
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                          <div>
                            <div class="font-medium">
                              {plannedWork.remaining_time ? formatTime(plannedWork.remaining_time) : 'N/A'}
                            </div>
                            {#if plannedWork.skillTimeStandard}
                              <div class="text-xs theme-text-secondary">
                                Skill Remaining: {formatTime(plannedWork.remainingTimeMinutes / 60)}
                              </div>
                            {/if}
                          </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                      <div class="flex space-x-2">
                            <Button 
                              variant="primary" 
                              size="sm" 
                              disabled={plannedWork.workLifecycleStatus !== 'Planned'}
                          on:click={() => handleReportWork(plannedWork)}
                        >
                          Report
                            </Button>
                            <Button 
                              variant="danger" 
                              size="sm" 
                              disabled={plannedWork.status === 'submitted'}
                          on:click={() => handleDeletePlan(plannedWork)}
                        >
                          Delete
                            </Button>
                      </div>
                    </td>
                  </tr>
                    {/each}
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
          
          <!-- Summary -->
          <div class="px-6 py-4 theme-bg-secondary border-t theme-border">
            <div class="flex flex-wrap gap-4 text-sm">
              <div class="theme-text-secondary">
                <span class="font-medium">Total Planned Works:</span> {plannedWorksWithStatus.length}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">Total Planned Hours:</span> {plannedWorksWithStatus.reduce((sum, work) => {
                  let plannedHours = work.planned_hours || 0;
                  if (plannedHours === 0 && work.from_time && work.to_time) {
                    const from = new Date(`2000-01-01T${work.from_time}`);
                    const to = new Date(`2000-01-01T${work.to_time}`);
                    if (to < from) to.setDate(to.getDate() + 1);
                    const totalHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
                    // Subtract break time
                    const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time);
                    const breakHours = breakMinutes / 60;
                    plannedHours = totalHours - breakHours;
                  } else if (plannedHours > 0 && work.from_time && work.to_time) {
                    // Even if planned_hours exists, recalculate to subtract break time
                    const from = new Date(`2000-01-01T${work.from_time}`);
                    const to = new Date(`2000-01-01T${work.to_time}`);
                    if (to < from) to.setDate(to.getDate() + 1);
                    const totalHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
                    const breakMinutes = calculateBreakTimeInRange(work.from_time, work.to_time);
                    const breakHours = breakMinutes / 60;
                    plannedHours = totalHours - breakHours;
                  }
                  return sum + Math.max(0, plannedHours);
                }, 0).toFixed(1)}h
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">Total Time Worked:</span> {formatTime(plannedWorksWithStatus.reduce((sum, work) => sum + (work.time_worked_till_date || 0), 0))}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">Total Remaining:</span> {formatTime(plannedWorksWithStatus.reduce((sum, work) => sum + (work.remaining_time || 0), 0))}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">Planned:</span> {plannedWorksWithStatus.filter(work => work.workLifecycleStatus === 'Planned').length}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">In Progress:</span> {plannedWorksWithStatus.filter(work => work.workLifecycleStatus === 'In progress').length}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">Completed:</span> {plannedWorksWithStatus.filter(work => work.workLifecycleStatus === 'Completed').length}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">To Redo:</span> {plannedWorksData.filter(work => work.status === 'to_redo').length}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">Approved:</span> {plannedWorksData.filter(work => work.status === 'approved').length}
              </div>
            </div>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'report'}
      <!-- Report Tab -->
      <div class="theme-bg-primary rounded-lg shadow border theme-border p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-semibold theme-text-primary">📊 Work Reporting</h2>
            <p class="text-sm theme-text-secondary mt-1">
              Reported works for {stageCode} stage on {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <Button variant="secondary" size="sm" on:click={loadReportData} disabled={isReportLoading}>
              {isReportLoading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button variant="primary" size="sm" on:click={generateReportExcel} disabled={reportData.length === 0}>
              Generate Excel
            </Button>
            <Button variant="primary" size="sm" on:click={generateReportPDF} disabled={reportData.length === 0}>
              Generate PDF
            </Button>
          </div>
        </div>

        {#if isReportLoading}
          <div class="text-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p class="theme-text-secondary">Loading work reports...</p>
          </div>
        {:else if reportData.length === 0}
        <div class="text-center py-12">
          <div class="text-6xl mb-4">📊</div>
            <p class="theme-text-secondary text-lg">No work reports found for this date</p>
          <p class="theme-text-secondary text-sm mt-2">
              Work reports will appear here after work is reported from the Plan tab
          </p>
        </div>
        {:else}
          <!-- Report Data Table -->
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="theme-bg-secondary">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Order</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">PWO Number</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Code</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Work Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Skills Required</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Standard Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Worker</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Time Worked Till Date</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">From Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">To Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Hours Worked</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Total Hours Worked</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Lost Time</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Reason</th>
                  <th class="px-6 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Reported On</th>
                </tr>
              </thead>
              <tbody class="theme-bg-primary divide-y divide-gray-200 dark:divide-gray-700">
                {#each Object.values(groupedReportWorks) as group}
                  {@const typedGroup = group as GroupedReportWork}
                  <!-- Group Header Row -->
                  <tr class="hover:theme-bg-secondary transition-colors cursor-pointer" 
                      class:lost-time={typedGroup.hasLostTime}
                      on:click={(e) => { e.preventDefault(); toggleReportGroup(typedGroup.workCode); }}>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                      {typedGroup.woNo}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                      {typedGroup.pwoNo}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                      {typedGroup.workCode}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                      {typedGroup.workName}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm theme-text-primary">
                      {#if typedGroup.items && typedGroup.items.length > 0}
                        {@const firstItem = typedGroup.items[0]}
                        {@const skillMapping = firstItem?.skillMapping || firstItem?.prdn_work_planning?.std_work_skill_mapping}
                        {@const skillCompetency = skillMapping?.sc_name || (firstItem?.prdn_work_planning?.sc_required || 'N/A')}
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          {skillCompetency}
                        </span>
                      {:else}
                        <span class="text-gray-400">N/A</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}">
                      {#if typedGroup.items && typedGroup.items.length > 0}
                        {@const firstItem = typedGroup.items[0]}
                        {firstItem?.vehicleWorkFlow?.estimated_duration_minutes ? formatTime(firstItem.vehicleWorkFlow.estimated_duration_minutes / 60) : 'N/A'}
                      {:else}
                        N/A
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if typedGroup.items && typedGroup.items.length > 0}
                        {@const allCompleted = typedGroup.items.every(item => item.completion_status === 'C')}
                        {@const anyCompleted = typedGroup.items.some(item => item.completion_status === 'C')}
                        {#if allCompleted}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            Completed
                          </span>
                        {:else if anyCompleted}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                            Partially Completed
                          </span>
                        {:else}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                            Not Completed
                          </span>
                        {/if}
                          {:else}
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          Unknown
                        </span>
                          {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm {typedGroup.hasLostTime ? 'text-gray-800' : 'theme-text-primary'}" colspan="9">
                      <div class="text-xs {typedGroup.hasLostTime ? 'text-gray-600' : 'theme-text-secondary'}">
                        Click to {isReportGroupExpanded(typedGroup.workCode) ? 'collapse' : 'expand'} skill details
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Individual Skill Rows (when expanded) -->
                  {#if isReportGroupExpanded(typedGroup.workCode)}
                    {#each typedGroup.items as report}
                      <tr class="hover:theme-bg-secondary transition-colors theme-bg-secondary/30" 
                          class:lost-time={report.lt_minutes_total > 0}>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {typedGroup.woNo}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {typedGroup.pwoNo}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {typedGroup.workCode}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {typedGroup.workName}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                            {report.skillMapping?.sc_name || report.prdn_work_planning?.sc_required || 'N/A'}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {report?.vehicleWorkFlow?.estimated_duration_minutes ? formatTime(report.vehicleWorkFlow.estimated_duration_minutes / 60) : 'N/A'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                          {#if report.completion_status === 'C'}
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Completed
                            </span>
                          {:else if report.completion_status === 'NC'}
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                              Not Completed
                            </span>
                          {:else}
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              {report.completion_status || 'Unknown'}
                            </span>
                          {/if}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          <div>
                            <div class="font-medium">{report.prdn_work_planning?.hr_emp?.emp_name || 'N/A'}</div>
                            <div class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}">({report.prdn_work_planning?.hr_emp?.skill_short || 'N/A'})</div>
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {formatTime(report.hours_worked_till_date || 0)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {report.from_time || 'N/A'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {report.to_time || 'N/A'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          <div>
                            <div class="font-medium">
                              {formatTime(report.hours_worked_today || 0)}
                            </div>
                            {#if report.skillTimeStandard}
                              <div class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}">
                                Standard: {formatTime(report.skillTimeStandard.standard_time_minutes / 60)}
                              </div>
                              <div class="text-xs {report.lt_minutes_total > 0 ? 'text-gray-600' : 'theme-text-secondary'}">
                                Remaining: {formatTime(report.remainingTimeMinutes / 60)}
                              </div>
                            {/if}
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {formatTime((report.hours_worked_till_date || 0) + (report.hours_worked_today || 0))}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {#if report.lt_minutes_total > 0}
                            <div class="text-yellow-600 dark:text-yellow-400 font-medium">
                              {report.lt_minutes_total} minutes
                            </div>
                          {:else}
                            <span class="text-green-600 dark:text-green-400">No lost time</span>
                          {/if}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {#if report.lt_details && Array.isArray(report.lt_details) && report.lt_details.length > 0}
                            <div class="text-xs">
                              {formatLostTimeDetails(report.lt_details)}
                            </div>
                          {:else if report.lt_minutes_total > 0}
                            <span class="text-xs theme-text-secondary">N/A</span>
                          {:else}
                            <span class="text-xs theme-text-secondary">-</span>
                          {/if}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm {report.lt_minutes_total > 0 ? 'text-gray-800' : 'theme-text-primary'}">
                          {formatDateTimeLocal(report.created_dt)}
                        </td>
                      </tr>
                    {/each}
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Summary -->
          <div class="mt-6 px-6 py-4 theme-bg-secondary border-t theme-border">
            <div class="flex flex-wrap gap-4 text-sm">
              <div class="theme-text-secondary">
                <span class="font-medium">Total Reports:</span> {reportData.length}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">Completed:</span> {reportData.filter(r => r.completion_status === 'C').length}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">Not Completed:</span> {reportData.filter(r => r.completion_status === 'NC').length}
              </div>
              <div class="theme-text-secondary">
                <span class="font-medium">Total Lost Time:</span> {reportData.reduce((sum, r) => sum + (r.lt_minutes_total || 0), 0)} minutes
              </div>
            </div>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'manpower-report'}
      <!-- Manpower Report Tab -->
      <div class="theme-bg-primary rounded-lg shadow border theme-border">
        <div class="p-6 border-b theme-border">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-semibold theme-text-primary">👥📊 Manpower Reporting</h2>
              <p class="text-sm theme-text-secondary mt-1">
                Report attendance, stage reassignments, and lost time (LTP/LTNP) for: {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
        {#if isManpowerReportLoading}
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
            <span class="theme-text-secondary">Loading manpower data...</span>
          </div>
        {:else}
          <!-- TODO: Create ManpowerReportTable component with LTP/LTNP fields -->
          <ManpowerTable 
            data={manpowerReportData} 
            isLoading={isManpowerReportLoading} 
            selectedDate={selectedDate}
            on:refresh={loadManpowerReportData}
            on:attendanceMarked={handleAttendanceMarked}
            on:bulkAttendanceMarked={handleBulkAttendanceMarked}
            on:stageReassigned={handleStageReassigned}
            on:export={handleManpowerExport} 
          />
        {/if}
      </div>

    {:else if activeTab === 'draft-report'}
      <!-- Draft Report Tab -->
      <div class="theme-bg-primary rounded-lg shadow border theme-border">
        <div class="p-6 border-b theme-border">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-semibold theme-text-primary">📝 Draft Reporting</h2>
              <p class="text-sm theme-text-secondary mt-1">
                Review and submit all draft reports for: {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
              </p>
            </div>
            <Button 
              variant="primary" 
              size="sm" 
              on:click={handleSubmitReporting}
              disabled={isDraftReportLoading || (draftReportData.length === 0 && draftManpowerReportData.length === 0)}
            >
              Submit Report
            </Button>
          </div>
        </div>
        {#if isDraftReportLoading}
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
            <span class="theme-text-secondary">Loading draft reports...</span>
          </div>
        {:else if draftReportData.length === 0 && draftManpowerReportData.length === 0}
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📝</div>
            <p class="theme-text-secondary text-lg">No draft reports found</p>
            <p class="theme-text-secondary text-sm mt-2">
              Create reports in Plan tab and Manpower Report tab
            </p>
          </div>
        {:else}
          <div class="p-6">
            <p class="theme-text-secondary mb-4">
              Work Reports: {draftReportData.length} | Manpower Reports: {draftManpowerReportData.length}
            </p>
            <!-- TODO: Display draft reports in a table/list -->
          </div>
        {/if}
      </div>

    {/if}
  </div>

  <!-- Floating Theme Toggle -->
  <FloatingThemeToggle />

  <!-- Plan Work Modal -->
  <PlanWorkModal 
    isOpen={showPlanModal}
    work={selectedWorkForPlanning}
    selectedDate={selectedDate}
    stageCode={stageCode}
    on:close={handlePlanModalClose}
    on:save={handlePlanSave}
  />

  <!-- Report Work Modal -->
  <ReportWorkModal 
    isOpen={showReportModal}
    plannedWork={selectedWorkForReporting}
    on:close={handleReportModalClose}
    on:save={handleReportSave}
  />

  <!-- Multi-Skill Report Modal -->
  <MultiSkillReportModal 
    isOpen={showMultiReportModal}
    selectedWorks={selectedWorksForMultiReport}
    on:close={handleMultiReportModalClose}
    on:save={handleMultiSkillReportSave}
  />

  <!-- View Work History Modal -->
  <ViewWorkHistoryModal 
    isOpen={showViewWorkHistoryModal}
    work={selectedWorkForHistory}
    stageCode={stageCode}
    on:close={handleViewWorkHistoryClose}
  />

  <!-- Remove Work Modal -->
  <RemoveWorkModal 
    isOpen={showRemoveWorkModal}
    work={selectedWorkForRemoval}
    stageCode={stageCode}
    on:close={handleRemoveWorkClose}
    on:removed={handleWorkRemoved}
  />

  <!-- Add Work Modal -->
  <AddWorkModal 
    isOpen={showAddWorkModal}
    workOrders={availableWorkOrdersForAdd}
    stageCode={stageCode}
    on:close={handleAddWorkClose}
    on:added={handleWorkAdded}
  />

  <!-- Entry Modal -->
  {#if showEntryModal}
    <div 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
      tabindex="-1"
      on:click={(e) => e.target === e.currentTarget && handleEntryModalClose()} 
      on:keydown={(e) => e.key === 'Escape' && handleEntryModalClose()}
    >
      <div 
        class="theme-bg-primary rounded-lg shadow-xl border theme-border max-w-md w-full mx-4"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 id="entry-modal-title" class="text-xl font-semibold theme-text-primary">Enter Work Order into {stageCode}</h2>
            <button
              type="button"
              aria-label="Close entry modal"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              on:click={handleEntryModalClose}
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mb-4">
            <label for="workOrderSelect" class="block text-sm font-medium theme-text-primary mb-2">
              Select Work Order <span class="text-red-500">*</span>
            </label>
            <select
              id="workOrderSelect"
              disabled={isEntryModalLoading}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              on:change={(e) => {
                const selectedIndex = parseInt((e.target as HTMLSelectElement).value);
                if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < waitingWorkOrdersForEntry.length) {
                  selectedWorkOrderForEntry = waitingWorkOrdersForEntry[selectedIndex];
                } else {
                  selectedWorkOrderForEntry = null;
                }
              }}
            >
              <option value="">Choose a work order...</option>
              {#each waitingWorkOrdersForEntry as wo, index}
                <option value={index}>
                  {wo.prdn_wo_details?.wo_no || 'N/A'} - {wo.prdn_wo_details?.pwo_no || 'N/A'} - {wo.prdn_wo_details?.wo_model || 'N/A'}
                </option>
              {/each}
            </select>
          </div>

          {#if isEntryModalLoading && entryProgressMessage}
            <div class="mb-4 p-3 theme-bg-blue-50 dark:theme-bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div class="flex items-center gap-2">
                <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-sm theme-text-primary">{entryProgressMessage}</span>
              </div>
            </div>
          {/if}

          <div class="flex justify-end gap-2">
            <Button variant="secondary" size="sm" on:click={handleEntryModalClose} disabled={isEntryModalLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" on:click={handleEntryConfirm} disabled={isEntryModalLoading || !selectedWorkOrderForEntry}>
              {isEntryModalLoading ? 'Processing...' : 'Enter'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Exit Modal -->
  {#if showExitModal}
    <div 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
      tabindex="-1"
      on:click={(e) => e.target === e.currentTarget && handleExitModalClose()} 
      on:keydown={(e) => e.key === 'Escape' && handleExitModalClose()}
    >
      <div 
        class="theme-bg-primary rounded-lg shadow-xl border theme-border max-w-md w-full mx-4"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 id="exit-modal-title" class="text-xl font-semibold theme-text-primary">Exit Work Order from {stageCode}</h2>
            <button
              type="button"
              aria-label="Close exit modal"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              on:click={handleExitModalClose}
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mb-4">
            <label for="workOrderSelectExit" class="block text-sm font-medium theme-text-primary mb-2">
              Select Work Order <span class="text-red-500">*</span>
            </label>
            <select
              id="workOrderSelectExit"
              disabled={isExitModalLoading}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              on:change={(e) => {
                const selectedIndex = parseInt((e.target as HTMLSelectElement).value);
                if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < availableWorkOrdersForExit.length) {
                  selectedWorkOrderForExit = availableWorkOrdersForExit[selectedIndex];
                } else {
                  selectedWorkOrderForExit = null;
                }
              }}
            >
              <option value="">Choose a work order...</option>
              {#each availableWorkOrdersForExit as wo, index}
                <option value={index}>
                  {wo.prdn_wo_details?.wo_no || 'N/A'} - {wo.prdn_wo_details?.pwo_no || 'N/A'} - {wo.prdn_wo_details?.wo_model || 'N/A'}
                </option>
              {/each}
            </select>
          </div>

          <div class="mb-4">
            <label for="exitDateInput" class="block text-sm font-medium theme-text-primary mb-2">
              Exit Date <span class="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="exitDateInput"
              bind:value={exitDate}
              disabled={isExitModalLoading}
              class="w-full px-3 py-2 border theme-border rounded-lg theme-bg-primary theme-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>

          {#if isExitModalLoading && exitProgressMessage}
            <div class="mb-4 p-3 theme-bg-blue-50 dark:theme-bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div class="flex items-center gap-2">
                <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-sm theme-text-primary">{exitProgressMessage}</span>
              </div>
            </div>
          {/if}

          <div class="flex justify-end gap-2">
            <Button variant="secondary" size="sm" on:click={handleExitModalClose} disabled={isExitModalLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" on:click={handleExitConfirm} disabled={isExitModalLoading || !selectedWorkOrderForExit || !exitDate}>
              {isExitModalLoading ? 'Processing...' : 'Exit'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

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

<style>
  /* Row background colors for date comparison */
  :global(.on-time) {
    background-color: #dcfce7 !important; /* green-100 */
  }
  
  :global(.dark .on-time) {
    background-color: #14532d !important; /* green-900 */
  }
  
  :global(.slight-delay) {
    background-color: #fef3c7 !important; /* yellow-100 */
  }
  
  :global(.dark .slight-delay) {
    background-color: #713f12 !important; /* yellow-900 */
  }
  
  :global(.moderate-delay) {
    background-color: #fed7aa !important; /* orange-100 */
  }
  
  :global(.dark .moderate-delay) {
    background-color: #7c2d12 !important; /* orange-900 */
  }
  
  :global(.significant-delay) {
    background-color: #fecaca !important; /* red-100 */
  }
  
  :global(.dark .significant-delay) {
    background-color: #7f1d1d !important; /* red-900 */
  }
  
  /* Lost time highlighting for reports */
  :global(.lost-time) {
    background-color: #fef3c7 !important; /* yellow-100 */
  }
  
  :global(.dark .lost-time) {
    background-color: #713f12 !important; /* yellow-900 */
  }
</style>
