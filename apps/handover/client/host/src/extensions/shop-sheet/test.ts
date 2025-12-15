export class TestCustomElement<TVal, TType extends 'static' | 'dynamic'> extends HTMLElement {

	variant: TType;
	value:   TVal;

}
