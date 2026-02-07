import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	integrations: [
		mermaid(),
		starlight({
			title: 'Budgetzilla',
			description: 'Local-first budgeting that just works.',
			logo: {
				src: './src/assets/logo.png',
				replacesTitle: false,
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/your-username/budget' },
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
						{ label: 'Installation', slug: 'getting-started/installation' },
					],
				},
				{
					label: 'Features',
					items: [
						{ label: 'Transactions', slug: 'features/transactions' },
						{ label: 'Categories', slug: 'features/categories' },
						{ label: 'Budgets', slug: 'features/budgets' },
						{ label: 'Dashboard', slug: 'features/dashboard' },
						{ label: 'Import & Export', slug: 'features/import-export' },
						{ label: 'Google Drive Sync', slug: 'features/google-drive-sync' },
					],
				},
				{
					label: 'Development',
					items: [
						{ label: 'Architecture', slug: 'development/architecture' },
						{ label: 'Building Desktop App', slug: 'development/desktop-build' },
						{ label: 'Contributing', slug: 'development/contributing' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
			customCss: ['./src/styles/custom.css'],
		}),
	],
});
