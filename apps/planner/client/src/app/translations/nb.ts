import { DefaultTranslation, registerTranslation } from '@arcmantle/library/localize';


const translation: DefaultTranslation = {
	$code: 'nb',
	$name: 'Norwegian',
	$dir:  'ltr',

	loading:  'Laster',
	close:    'Lukk',
	progress: 'Fremgang',
};

export default (() => {
	registerTranslation(translation);

	return translation;
})();
