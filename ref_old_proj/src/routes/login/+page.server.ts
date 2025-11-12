import { redirect } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ locals }) => {
  const session = locals.session;

  if (session?.user) {
    throw redirect(307, '/dashboard');
  }

  return {
    title: 'Login - Production Management'
  };
}; 