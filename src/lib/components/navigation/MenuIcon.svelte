<script lang="ts">
  import { Menu, FileText, Users, Circle, Settings, ClipboardList, BusFront, ChartNoAxesCombined, IdCardLanyard, IndianRupee, ChartGantt, Factory, Codesandbox, Atom, BarChart3, Calendar, Database, UserCheck, Cog } from 'lucide-svelte';

  export let name: string;

  const iconMap: Record<string, typeof Menu> = {
    'Dashboard': BarChart3,
    'Production': BusFront,
    'Inventory': Database,
    'Employees': Users,
    'Schedule': Calendar,
    'Analytics': ChartNoAxesCombined,
    'Settings': Settings,
    'Sales': ChartNoAxesCombined,
    'HR': IdCardLanyard,
    'Accounts': IndianRupee,
    'Planning': ChartGantt,
    'Operations': Factory,
    'System Admin': Settings,
    'R & D': Codesandbox,
    'Standards': Atom,
    'QC': UserCheck,
    'Finance': IndianRupee,
    'Management': Cog
  };

  const IconComponent = iconMap[name] || Circle;
</script>

<svelte:component this={IconComponent} class="w-4 h-4" /> 