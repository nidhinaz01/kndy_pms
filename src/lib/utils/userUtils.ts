/**
 * Utility functions for user management
 * 
 * Rules:
 * - No hardcoded values
 * - Username must be found, throw error if not found
 * - Use username from app_users table, not email
 */

/**
 * Gets the current username from localStorage
 * Throws an error if username is not found (no fallbacks allowed)
 * 
 * @returns {string} The username
 * @throws {Error} If username is not found in localStorage
 */
export function getCurrentUsername(): string {
  if (typeof window === 'undefined') {
    throw new Error('Cannot get username: window is undefined (server-side)');
  }

  const username = localStorage.getItem('username');
  
  if (!username || username.trim() === '') {
    throw new Error('Username not found. User must be logged in to perform this operation.');
  }

  return username.trim();
}

/**
 * Gets the current username from localStorage (async version for consistency)
 * Throws an error if username is not found (no fallbacks allowed)
 * 
 * @returns {Promise<string>} The username
 * @throws {Error} If username is not found in localStorage
 */
export async function getCurrentUsernameAsync(): Promise<string> {
  return getCurrentUsername();
}

/**
 * Gets the current timestamp in ISO format
 * 
 * @returns {string} ISO timestamp string
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

