import { supabase } from '$lib/supabaseClient';

export async function checkUsernameExists(username: string, excludeUserId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('app_users')
      .select('username')
      .eq('username', username)
      .eq('is_deleted', false);

    if (excludeUserId) {
      query = query.neq('app_user_uuid', excludeUserId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking username:', error);
    throw error;
  }
}

export async function checkEmailExists(email: string, excludeUserId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('app_users')
      .select('email')
      .eq('email', email)
      .eq('is_deleted', false);

    if (excludeUserId) {
      query = query.neq('app_user_uuid', excludeUserId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking email:', error);
    throw error;
  }
}

export async function getAvailableRoles(): Promise<string[]> {
  return [
    'Admin', 'SalesExecutive', 'SalesManager', 'PlanningEngineer', 'PlanningManager',
    'RDEngineer', 'RDManager', 'ProductionEngineer', 'PlantManager', 'ProductionManager',
    'QCEngineer', 'QCManager', 'OperationsManager', 'GeneralManager', 'ManagingDirector',
    'FinanceExecutive', 'FinanceManager', 'HRExecutive', 'HRManager'
  ];
}

