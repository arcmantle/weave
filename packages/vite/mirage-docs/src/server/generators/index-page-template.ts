import type { SiteConfig } from '../../shared/config.types.js';
import { fileExt } from '../build/helpers/is-dev-mode.js';


export const indexPageTemplate = (props: {
	moduleId:     string;
	siteConfigId: string;
	styleLinks:   SiteConfig['pages']['styles'];
	scriptLinks:  SiteConfig['pages']['scripts'];
}): string => {
	interface HeadTemplate { template: string; order: number; }

	const styleTemplate = (src: string) => `<link rel="stylesheet" href="${ src }">`;
	const scriptTemplate = (src: string) => `<script type="module" src="${ src }"></script>`;
	const setOrder = (order?: number | 'post' | 'pre') =>
		order === 'post' ? 1000
			: order === 'pre' ? 0
				: order ?? 500;

	const styleLinks: HeadTemplate[] = (props.styleLinks ?? [])
		.map(({ src, order }) => ({ template: styleTemplate(src), order: setOrder(order) }));

	const scriptLinks: HeadTemplate[] = (props.scriptLinks ?? [])
		.map(({ src, order }) => ({ template: scriptTemplate(src), order: setOrder(order) }));

	const links = [
		...styleLinks,
		...scriptLinks,
		{
			template: '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto+Mono">',
			order:    300,
		},
		{
			template: `<script type="module">
			import index from "@arcmantle/mirage-docs/assets/index.css?url";
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = index;
			document.head.prepend(link);
			</script>`,
			order: 400,
		},
		{
			template: `<script type="module" src="${ props.siteConfigId }"></script>`,
			order:    600,
		},
		{
			template: `<script type="module" src="${ props.moduleId }"></script>`,
			order:    700,
		},
	].sort((a, b) => a.order - b.order).map(link => link.template).join('\n	');

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	${ links }
</head>
<body>
	<midoc-page></midoc-page>
	<div class="footer"></div>
	<script type="module">
		import { ensureColorScheme } from '@arcmantle/mirage-docs/app/utilities/color-subscription.${ fileExt() }';
		ensureColorScheme();

		import { PageElement } from '@arcmantle/mirage-docs/app/components/page/page-element.${ fileExt() }';
		PageElement.register();
	</script>
</body>
</html>
`;
};
