import { defineConfig, type Plugin } from 'vite';

const patchOrillusionImportMetaUrl = (): Plugin => ({
	name: 'patch-orillusion-import-meta-url',
	transform(code, id) {
		if (!id.includes('@orillusion/core/dist/orillusion.es'))
			return null;

		const patchedCode = code
			.replaceAll('new URL("./", import.meta.url)', 'import.meta.url')
			.replaceAll('new URL("./",import.meta.url)', 'import.meta.url');

		if (patchedCode === code)
			return null;

		return {
			code: patchedCode,
			map:  null,
		};
	},
});

export default defineConfig({
	build: {
		chunkSizeWarningLimit: 20000,
		target:                'esnext',
	},
	plugins: [ patchOrillusionImportMetaUrl() ],
}) as ReturnType<typeof defineConfig>;
