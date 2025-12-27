import { effect } from '@preact/signals-core';
import type { ReactiveElement } from 'lit';


type ReactiveElementCtor = abstract new (
// eslint-disable-next-line @typescript-eslint/no-explicit-any
	...args: any[]
) => ReactiveElement;


/**
 * Adds the ability for a LitElement or other ReactiveElement class to
 * watch for access to Preact signals during the update lifecycle and
 * trigger a new update when signals values change.
 */
export function SignalWatcher<T extends ReactiveElementCtor>(base: T): T {
	abstract class SignalWatcher extends base {

		private __dispose?: () => void;

		override performUpdate() {
			// ReactiveElement.performUpdate() also does this check, so we want to
			// also bail early so we don't erroneously appear to not depend on any signals.
			if (this.isUpdatePending === false)
				return;

			this.__dispose?.();

			let updateFromLit = true;

			const thisRef = new WeakRef(this);
			const superPerformUpdate = super.performUpdate;

			this.__dispose = effect(() => {
				const instance = thisRef.deref();
				if (!instance) {
					return console.warn(
						'SignalWatcher: instance was garbage collected before effect could run.',
					);
				}

				if (updateFromLit) {
					updateFromLit = false;
					superPerformUpdate.call(instance);
				}
				else {
					instance.requestUpdate();
				}
			});
		}

		override connectedCallback(): void {
			super.connectedCallback();

			// In order to listen for signals again after re-connection, we must
			// re-render to capture all the current signal accesses.
			this.requestUpdate();
		}

		override disconnectedCallback(): void {
			super.disconnectedCallback();

			this.__dispose?.();
		}

	}

	return SignalWatcher;
}
