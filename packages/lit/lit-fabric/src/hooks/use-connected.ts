import { invariant } from '@arcmantle/library/validation';

import { getCurrentRef } from '../core/component.js';


type UseConnected = (
	func: () => void,
) => void;


export const useConnected = ((func: () => void) => {
	const cls = getCurrentRef();
	invariant(cls, 'Could not get component instance.');

	cls.__connectedHooks.push(func);
}) satisfies UseConnected;
