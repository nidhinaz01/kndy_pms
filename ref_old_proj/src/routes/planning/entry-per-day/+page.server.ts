import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
  return {
    title: 'Daily Production Entry - Production Management'
  };
}; 