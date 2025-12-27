import '@arcmantle/handover-core/root-styles';

import type { LitElement } from 'lit';

import { RouterCmp } from './pages/router.tsx';

RouterCmp;


declare global {
	namespace LitJSX {
		interface ExcludedComponentProps {
			'lit-element': keyof LitElement | 'template';
		}
	}
}
