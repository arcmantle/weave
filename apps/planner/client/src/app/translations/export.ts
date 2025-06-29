import { LanguageExport } from '@arcmantle/library/localize';


export const translationFiles: LanguageExport = {
	en: () => import('./en.js'),
	nb: () => import('./nb.js'),
};
