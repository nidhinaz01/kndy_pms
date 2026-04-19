import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
  return {
    title: 'PMS - Order of Stages'
  };
}; 