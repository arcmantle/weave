//import '@arcmantle/elements/styles';

import { sleep } from '@arcmantle/library/async';
import { LangBlockStore } from '@arcmantle/lit-localize/implement';
import { appendToLangMap, createLangMapFromJson } from '@arcmantle/lit-localize/utilities';

import codes from './misc/language-en.json';


const langMap = createLangMapFromJson('en', {});
//const langMap = createLangMapFromJson('en', codes);
appendToLangMap(langMap, 'en', codes);


class EsTermStore extends LangBlockStore {

	public async retrieveLangBlock(block: string, lang: string) {
		await sleep(500);

		return langMap.get(lang)?.get(block);
	}

}

EsTermStore.start();
