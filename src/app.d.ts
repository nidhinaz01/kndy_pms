// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

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
