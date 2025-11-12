import { supabase } from '$lib/supabaseClient';

/**
 * Validates password strength
 * @param password - The password to validate
 * @returns Error message if invalid, null if valid
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}

/**
 * Checks if password was used recently (last 12 passwords)
 * Note: This requires database triggers to populate password_history table
 * @param userId - The user's UUID
 * @param passwordHash - The hashed password to check
 * @returns true if password was used recently, false otherwise
 */
export async function checkPasswordHistory(
  userId: string,
  passwordHash: string
): Promise<boolean> {
  try {
    // Check last 12 passwords
    const { data, error } = await supabase
      .from('password_history')
      .select('password_hash')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Error checking password history:', error);
      return false; // Don't block password change if history check fails
    }

    // Check if any of the recent passwords match
    return (data || []).some(record => record.password_hash === passwordHash);
  } catch (error) {
    console.error('Error in checkPasswordHistory:', error);
    return false;
  }
}

/**
 * Stores password in history after successful password change
 * Note: This should be called after Supabase Auth updates the password
 * The actual password hash should be retrieved from a database trigger
 * @param userId - The user's UUID
 * @param passwordHash - The hashed password to store
 */
export async function storePasswordInHistory(
  userId: string,
  passwordHash: string
): Promise<void> {
  try {
    // Check if this password hash already exists for this user
    const { data: existing } = await supabase
      .from('password_history')
      .select('id')
      .eq('user_id', userId)
      .eq('password_hash', passwordHash)
      .single();

    if (existing) {
      // Update the timestamp instead of creating duplicate
      await supabase
        .from('password_history')
        .update({ created_at: new Date().toISOString() })
        .eq('id', existing.id);
      return;
    }

    // Insert new password hash
    const { error } = await supabase
      .from('password_history')
      .insert({
        user_id: userId,
        password_hash: passwordHash,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing password in history:', error);
      // Don't throw - password change should still succeed
    }

    // Keep only last 12 passwords per user
    const { data: allPasswords } = await supabase
      .from('password_history')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (allPasswords && allPasswords.length > 12) {
      const passwordsToDelete = allPasswords.slice(12);
      const idsToDelete = passwordsToDelete.map(p => p.id);

      await supabase
        .from('password_history')
        .delete()
        .in('id', idsToDelete);
    }
  } catch (error) {
    console.error('Error in storePasswordInHistory:', error);
    // Don't throw - password change should still succeed
  }
}

/**
 * Generates a secure random password
 * @param length - Password length (default: 14)
 * @returns Generated password
 */
export function generateSecurePassword(length: number = 14): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  
  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

