import { defineConfig } from 'vitepress';

export default defineConfig({
	title:       'Changelog',
	description: 'A powerful .NET library for tracking and '
	+ 'managing document changes with diff engine, time-travel, and pluggable storage',

	base: '/changelog-net/',

	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'Storage Providers', link: '/storage/' },
		],

		sidebar: {
			'/guide/': [
				{
					text:  'Introduction',
					items: [
						{ text: 'Getting Started', link: '/guide/getting-started' },
						{ text: 'Installation', link: '/guide/installation' },
						{ text: 'Quick Reference', link: '/guide/quick-reference' },
					],
				},
				{
					text:  'Core Concepts',
					items: [
						{ text: 'Document State', link: '/guide/document-state' },
						{ text: 'Diff Engine', link: '/guide/diff-engine' },
						{ text: 'Change Groups', link: '/guide/change-groups' },
						{ text: 'Change History', link: '/guide/change-history' },
						{ text: 'Retention Policies', link: '/guide/retention-policies' },
					],
				},
				{
					text:  'Usage Patterns',
					items: [
						{ text: 'Side-car Pattern', link: '/guide/patterns/sidecar' },
						{ text: 'Primary Storage', link: '/guide/patterns/primary-storage' },
						{ text: 'Transactions', link: '/guide/patterns/transactions' },
					],
				},
				{
					text:  'Advanced',
					items: [
						{ text: 'Performance', link: '/guide/performance' },
						{ text: 'Decorators', link: '/guide/decorators' },
						{ text: 'Observability', link: '/guide/observability' },
						{ text: 'Custom Storage', link: '/guide/custom-storage' },
					],
				},
			],
			'/storage/': [
				{
					text:  'Storage Providers',
					items: [
						{ text: 'Overview', link: '/storage/' },
						{ text: 'MemoryStorage', link: '/storage/memory' },
						{ text: 'SQLite', link: '/storage/sqlite' },
						{ text: 'PostgreSQL', link: '/storage/postgresql' },
						{ text: 'MongoDB', link: '/storage/mongodb' },
					],
				},
				{
					text:  'Decorators',
					items: [
						{ text: 'CachedStorage', link: '/storage/decorators/cached' },
						{ text: 'CompressedStorage', link: '/storage/decorators/compressed' },
					],
				},
			],
		},

		socialLinks: [ { icon: 'github', link: 'https://github.com/arcmantle/weave' } ],

		search: {
			provider: 'local',
		},

		footer: {
			message:   'Released under the Apache-2.0 License.',
			copyright: 'Copyright © 2025 Kristoffer Roen-Lie',
		},
	},
});
