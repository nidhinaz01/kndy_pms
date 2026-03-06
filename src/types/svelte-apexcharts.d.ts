declare module 'svelte-apexcharts' {
	import type { SvelteComponent } from 'svelte';
	const Chart: typeof SvelteComponent<{
		options: any;
		series: any[];
		type?: string;
		width?: string | number;
		height?: string | number;
	}>;
	export default Chart;
}
