import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://srnyapjpjqumqhjmluab.supabase.co',  // 🔁 Replace this
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybnlhcGpwanF1bXFoam1sdWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NDQ4NTMsImV4cCI6MjA2NTMyMDg1M30.QlwS7KGcLXGLcLrn7CF-38MTsIcDwkZ6OzGrnZoqNmE'                  // 🔁 Replace this
);
