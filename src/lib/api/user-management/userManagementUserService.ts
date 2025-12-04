import { supabase } from '$lib/supabaseClient';
import type { AppUser, CreateUserData, UpdateUserData, SupabaseAuthUser } from './userManagementTypes';

export async function fetchUsers(): Promise<AppUser[]> {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('is_deleted', false)
      .order('created_dt', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

export async function fetchUserById(userId: string): Promise<AppUser | null> {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('app_user_uuid', userId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

export async function fetchSupabaseAuthUsers(): Promise<SupabaseAuthUser[]> {
  try {
    console.log('Fetching Supabase Auth users...');
    
    const { data, error } = await supabase.rpc('get_auth_users_with_linked_status');

    if (error) {
      console.error('Error fetching Supabase Auth users:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('Supabase Auth users fetched:', data);
    return data || [];
  } catch (error) {
    console.error('Error in fetchSupabaseAuthUsers:', error);
    throw error;
  }
}

export async function createUser(userData: CreateUserData, createdBy: string): Promise<AppUser> {
  try {
    const now = new Date().toISOString();
    
    const { data: existingUser, error: usernameCheckError } = await supabase
      .from('app_users')
      .select('username')
      .eq('username', userData.username)
      .eq('is_deleted', false)
      .maybeSingle();

    if (existingUser && !usernameCheckError) {
      throw new Error('Username already exists');
    }

    const { data: existingLink, error: linkCheckError } = await supabase
      .from('app_users')
      .select('username')
      .eq('auth_user_id', userData.auth_user_id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (existingLink && !linkCheckError) {
      throw new Error('This Supabase Auth user is already linked to another application user');
    }

    if (!userData.email) {
      throw new Error('Email is required. Please select a Supabase Auth user from the dropdown.');
    }

    const email = userData.email;

    const { data: existingEmail, error: emailCheckError } = await supabase
      .from('app_users')
      .select('email, username')
      .eq('email', email)
      .eq('is_deleted', false)
      .maybeSingle();

    if (existingEmail && !emailCheckError) {
      throw new Error(`Email already exists in application users (username: ${existingEmail.username})`);
    }

    const { data, error } = await supabase
      .from('app_users')
      .insert({
        username: userData.username,
        email: email,
        password_hash: 'managed_by_supabase_auth',
        role: userData.role,
        desig: userData.desig,
        emp_id: userData.emp_id,
        is_active: userData.is_active ?? true,
        auth_user_id: userData.auth_user_id,
        must_change_password: true,
        password_setup_completed: false,
        email_verified: false,
        created_dt: now,
        created_by: createdBy,
        modified_dt: now,
        modified_by: createdBy
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting into app_users:', error);
      
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          throw new Error('Email already exists in application users. Please check if this user was already created.');
        } else if (error.message.includes('username')) {
          throw new Error('Username already exists. Please choose a different username.');
        } else if (error.message.includes('auth_user_id')) {
          throw new Error('This Supabase Auth user is already linked to another application user.');
        } else {
          throw new Error('A user with these details already exists. Please check the existing users.');
        }
      }
      
      throw error;
    }

    console.log('✅ User created and linked successfully:', {
      username: userData.username,
      email: email,
      auth_user_id: userData.auth_user_id
    });

    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function updateUser(userId: string, userData: UpdateUserData, modifiedBy: string): Promise<AppUser> {
  try {
    const now = new Date().toISOString();
    
    if (userData.username) {
      const { data: existingUser } = await supabase
        .from('app_users')
        .select('username')
        .eq('username', userData.username)
        .neq('app_user_uuid', userId)
        .eq('is_deleted', false)
        .single();

      if (existingUser) {
        throw new Error('Username already exists');
      }
    }

    const updateData: any = {
      modified_dt: now,
      modified_by: modifiedBy
    };

    if (userData.username !== undefined) updateData.username = userData.username;
    if (userData.password !== undefined) updateData.password_hash = userData.password;
    if (userData.role !== undefined) updateData.role = userData.role;
    if (userData.desig !== undefined) updateData.desig = userData.desig;
    if (userData.emp_id !== undefined) updateData.emp_id = userData.emp_id;
    if (userData.is_active !== undefined) updateData.is_active = userData.is_active;

    const { data, error } = await supabase
      .from('app_users')
      .update(updateData)
      .eq('app_user_uuid', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

export async function deleteUser(userId: string, modifiedBy: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('app_users')
      .update({
        is_deleted: true,
        modified_dt: now,
        modified_by: modifiedBy
      })
      .eq('app_user_uuid', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

export async function toggleUserStatus(userId: string, modifiedBy: string): Promise<AppUser> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('app_users')
      .update({
        is_active: supabase.raw('NOT is_active'),
        modified_dt: now,
        modified_by: modifiedBy
      })
      .eq('app_user_uuid', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error toggling user status:', error);
    throw error;
  }
}

