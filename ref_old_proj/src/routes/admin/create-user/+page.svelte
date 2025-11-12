<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { sanitizeString, isValidTrimmedString } from '$lib/utils/inputSanitization';

  let username = '', email = '', password = '', role = 'ProductionEngineer', desig = '', emp_id = '';
  let errorMsg = '', successMsg = '';

  const roles = [
    'Admin', 'SalesExecutive', 'SalesManager',
    'PlanningEngineer', 'PlanningManager',
    'RDEngineer', 'RDManager',
    'ProductionEngineer', 'PlantManager', 'ProductionManager',
    'QCEngineer', 'QCManager',
    'OperationsManager', 'GeneralManager',
    'ManagingDirector', 'FinanceExecutive', 'FinanceManager',
    'HRExecutive', 'HRManager'
  ];

  async function createUser() {
    errorMsg = '';
    successMsg = '';

    // Sanitize and validate required fields
    const sanitizedUsername = sanitizeString(username);
    const sanitizedEmail = sanitizeString(email);
    const sanitizedPassword = sanitizeString(password);
    const sanitizedDesig = sanitizeString(desig);
    const sanitizedEmpId = sanitizeString(emp_id);

    if (!isValidTrimmedString(sanitizedUsername) || 
        !isValidTrimmedString(sanitizedEmail) || 
        !isValidTrimmedString(sanitizedPassword) || 
        !isValidTrimmedString(sanitizedDesig)) {
      errorMsg = 'Please fill all required fields.';
      return;
    }

    // Get the current admin user for audit
    const { data: sessionData } = await supabase.auth.getSession();
    const loggedInEmail = sessionData?.session?.user?.email;

    const { data: adminUser, error: adminLookupError } = await supabase
      .from('app_users')
      .select('username')
      .eq('email', loggedInEmail)
      .single();

    const created_by = adminUser?.username;

    if (!created_by) {
      errorMsg = 'Cannot determine current user.';
      return;
    }

    // Step 1: Create the user in auth.users
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signupError) {
      errorMsg = 'Supabase Auth error: ' + signupError.message;
      return;
    }

    // Step 2: Insert into app_users
    const { error: insertError } = await supabase.from('app_users').insert([{
      username: sanitizedUsername,
      email: sanitizedEmail,
      password_hash: 'managed_by_supabase', // optional placeholder
      role,
      desig: sanitizedDesig,
      emp_id: sanitizedEmpId,
      created_by,
      modified_by: created_by
    }]);

    if (insertError) {
      errorMsg = 'Database insert error: ' + insertError.message;
    } else {
      successMsg = '✅ User created successfully!';
      username = email = password = desig = emp_id = '';
    }
  }
</script>

<div class="max-w-xl mx-auto mt-10 p-6 bg-white shadow rounded">
  <h2 class="text-2xl font-semibold mb-4">Create New User</h2>

  {#if errorMsg}<p class="text-red-500 mb-2">{errorMsg}</p>{/if}
  {#if successMsg}<p class="text-green-600 mb-2">{successMsg}</p>{/if}

  <input class="border p-2 w-full mb-2" bind:value={username} placeholder="Username" />
  <input class="border p-2 w-full mb-2" bind:value={email} type="email" placeholder="Email" />
  <input class="border p-2 w-full mb-2" bind:value={password} type="password" placeholder="Password" />
  <input class="border p-2 w-full mb-2" bind:value={desig} placeholder="Designation" />
  <input class="border p-2 w-full mb-2" bind:value={emp_id} placeholder="Employee ID (optional)" />

  <select bind:value={role} class="border p-2 w-full mb-4">
    {#each roles as r}
      <option value={r}>{r}</option>
    {/each}
  </select>

  <button class="bg-blue-600 text-white px-4 py-2 rounded" on:click={createUser}>
    Create User
  </button>
</div>
