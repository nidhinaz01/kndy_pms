<script lang="ts">
  import { supabase } from '$lib/supabaseClient';

  let result = '';
  let running = false;

  async function registerAdmin() {
    running = true;

    const { data, error } = await supabase.auth.signUp({
      email: 'nidhinkaipl@gmail.com',
      password: 'sysadmin' // same password you want to use for login
    });

    if (error) {
      result = '❌ ' + error.message;
    } else {
      result = '✅ Admin user registered in auth.users';
    }

    running = false;
  }
</script>

<div class="p-8 max-w-md mx-auto text-center">
  <h2 class="text-xl font-semibold mb-4">Initialize Admin</h2>

  <button
    class="bg-green-600 text-white px-4 py-2 rounded"
    on:click={registerAdmin}
    disabled={running}
  >
    Register Admin in Auth
  </button>

  <p class="mt-4 text-lg">{result}</p>
</div>
