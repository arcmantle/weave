import { type CSSResultGroup, LitElement, type PropertyDeclaration, type PropertyValues } from 'lit';


declare class IFabricComponent extends LitElement {

	static readonly tagName: string;
	__connectedHooks:        (() => any)[];
	__disconnectedHooks:     (() => any)[];
	__willUpdateHooks:       ((changedProps: PropertyValues) => any)[];
	__updateHooks:           ((changedProps: PropertyValues) => any)[];
	__updatedHooks:          ((changedProps: PropertyValues) => any)[];

}


interface FabricConstructor {
	prototype: IFabricComponent;
	new(): IFabricComponent & { constructor: typeof IFabricComponent; };
}


export type FabricComponent = InstanceType<FabricConstructor>;


export const getCurrentRef = (): typeof component.ref => component.ref;


export const component = <_T extends Record<string, PropertyDeclaration>>(
	tagName: string,
	//construct: (ctor: typeof LitElement) => T,
	create: (element: LitElement) => { render: () => unknown; styles: CSSResultGroup; },
	options?: {
		base?:   typeof LitElement;
		mixins?: ((...args: any[]) => any)[];
	},
): {
	register(): void;
	tagName: string;
} => {
	let base = (options?.base ?? LitElement) as unknown as FabricConstructor;
	if (options?.mixins) {
		for (const mixin of options.mixins)
			base = mixin(base);
	}

	return class extends base {

		static readonly tagName = tagName;
		static register()  {
			if (!globalThis.customElements.get(tagName))
				globalThis.customElements.define(tagName, this);
		}

		override __connectedHooks:    (() => any)[] = [];
		override __disconnectedHooks: (() => any)[] = [];
		override __willUpdateHooks:   ((changedProps: PropertyValues) => any)[] = [];
		override __updateHooks:       ((changedProps: PropertyValues) => any)[] = [];
		override __updatedHooks:      ((changedProps: PropertyValues) => any)[] = [];

		constructor() {
			super();

			component.ref = this;
			const { render, styles } = create(this);
			component.ref = undefined;

			this.render = render;
			if (!this.constructor.elementStyles.length)
				this.constructor.elementStyles = this.constructor.finalizeStyles(styles);
		}


		override connectedCallback(): void {
			super.connectedCallback();
			for (const hook of this.__connectedHooks)
				hook();
		}

		override disconnectedCallback(): void {
			super.disconnectedCallback();
			for (const hook of this.__disconnectedHooks)
				hook();
		}

		override willUpdate(changedProps: PropertyValues): void {
			super.willUpdate(changedProps);
			for (const hook of this.__willUpdateHooks)
				hook(changedProps);
		}

		override update(changedProps: PropertyValues): void {
			super.update(changedProps);
			for (const hook of this.__updateHooks)
				hook(changedProps);
		}

		override updated(changedProps: PropertyValues): void {
			super.updated(changedProps);
			for (const hook of this.__updatedHooks)
				hook(changedProps);
		}

	} as unknown as {
		register(): void;
		tagName: string;
	};
};

component.ctorRef = undefined as FabricConstructor | undefined;
component.ref = undefined as InstanceType<FabricConstructor> | undefined;
component.sideEffects = new WeakMap<typeof LitElement, (() => any)[]>();
