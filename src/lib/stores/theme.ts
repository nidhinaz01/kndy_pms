import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Create the theme store
function createThemeStore() {
  // Get initial theme from localStorage or system preference
  const getInitialTheme = (): 'light' | 'dark' => {
    if (browser) {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
      // Check system preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  };

  const { subscribe, set, update } = writable<'light' | 'dark'>(getInitialTheme());

  return {
    subscribe,
    toggle: () => {
      update(currentTheme => {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // Update localStorage
        if (browser) {
          localStorage.setItem('theme', newTheme);
          
          // Update HTML data-theme attribute
          if (newTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            console.log('Toggle: Set data-theme="dark"');
          } else {
            document.documentElement.removeAttribute('data-theme');
            console.log('Toggle: Removed data-theme attribute');
          }
          console.log('Toggle: Final data-theme:', document.documentElement.getAttribute('data-theme'));
        }
        
        return newTheme;
      });
    },
    set: (theme: 'light' | 'dark') => {
      if (browser) {
        localStorage.setItem('theme', theme);
        
        // Update HTML data-theme attribute
        if (theme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      }
      set(theme);
    },
    initialize: () => {
      const theme = getInitialTheme();
      console.log('Initializing theme:', theme);
      if (browser) {
        if (theme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
          console.log('Set data-theme="dark"');
        } else {
          document.documentElement.removeAttribute('data-theme');
          console.log('Removed data-theme attribute');
        }
        console.log('Final data-theme:', document.documentElement.getAttribute('data-theme'));
      }
      set(theme);
    }
  };
}

export const theme = createThemeStore(); 