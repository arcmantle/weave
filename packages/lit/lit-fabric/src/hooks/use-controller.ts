import { invariant } from '@arcmantle/library/validation';
import type { LitElement, ReactiveController } from 'lit';

import { getCurrentRef } from '../core/component.js';


type UseController = <T extends ReactiveController = ReactiveController>(
	controller: T,
) => T;


export const useController = (<T extends ReactiveController>(
	controller: ((element: LitElement) => T) | T,
) => {
	const cls = getCurrentRef();
	invariant(cls, 'Could not get component instance.');

	const ctrl = typeof controller === 'function'
		? controller(cls)
		: controller;

	cls.addController(ctrl);

	return ctrl;
}) satisfies UseController;
