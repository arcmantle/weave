import type { Theme } from 'vitepress';
import { useData } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { createMermaidRenderer } from 'vitepress-mermaid-renderer';
import { h, nextTick, watch } from 'vue';


export default {
	extends: DefaultTheme,
	Layout:  () => {
		const { isDark } = useData();

		const initMermaid = () => {
			createMermaidRenderer({
				theme:          isDark.value ? 'dark' : 'base',
				themeVariables: isDark.value ? {} : {
					primaryColor:       '#bbdefb',
					primaryTextColor:   '#000',
					primaryBorderColor: '#1976d2',
					lineColor:          '#1976d2',
					secondaryColor:     '#c8e6c9',
					tertiaryColor:      '#fff9c4',
				},
			});
		};

		nextTick(() => initMermaid());
		watch(() => isDark.value, () => initMermaid());

		return h(DefaultTheme.Layout);
	},
} satisfies Theme;
