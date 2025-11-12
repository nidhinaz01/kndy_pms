import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
  return {
    title: 'Employee Management - Production Management'
  };
}; 