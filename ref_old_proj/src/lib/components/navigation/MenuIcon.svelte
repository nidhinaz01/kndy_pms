<!-- src/lib/components/MenuIcon.svelte -->
<script lang="ts">
  import { Menu, FileText, Users, Circle, Settings, ClipboardList, BusFront, ChartNoAxesCombined, IdCardLanyard, IndianRupee, ChartGantt, Factory, Codesandbox, Atom } from 'lucide-svelte';

  export let name: string;

  const iconMap: Record<string, typeof Menu> = {
    'Production': BusFront,
    'Sales': ChartNoAxesCombined,
    'HR': IdCardLanyard,
    'Accounts': IndianRupee,
    'Planning': ChartGantt,
    'Operations': Factory,
    'System Admin': Settings,
    'R & D': Codesandbox,
	'Standards': Atom
  };

  const IconComponent = iconMap[name] || Circle;
</script>

<svelte:component this={IconComponent} class="w-4 h-4" />
