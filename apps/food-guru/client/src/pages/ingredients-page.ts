import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';

import { foodGuruStore } from '../state/food-guru-store.ts';
import type { IngredientItem } from '../types.ts';


@customElement('ingredients-page')
export class IngredientsPage extends LitElement {

	@state() protected ingredients: IngredientItem[] = [];

	protected onStoreChanged = (): void => {
		const snapshot = foodGuruStore.getSnapshot();
		this.ingredients = snapshot.ingredients;
	};

	override connectedCallback(): void {
		super.connectedCallback();
		foodGuruStore.addEventListener('change', this.onStoreChanged);
		this.onStoreChanged();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		foodGuruStore.removeEventListener('change', this.onStoreChanged);
	}

	protected handleIngredientSubmit(event: SubmitEvent): void {
		event.preventDefault();

		const form = event.currentTarget as HTMLFormElement;
		const formData = new FormData(form);
		const ingredientName = String(formData.get('ingredientName') ?? '').trim();
		const quantity = String(formData.get('quantity') ?? '').trim();

		if (!ingredientName || !quantity)
			return;

		void foodGuruStore.addIngredient({
			name: ingredientName,
			quantity,
		});

		form.reset();
	}

	protected handleStockToggle(event: Event): void {
		const button = event.currentTarget as HTMLButtonElement;
		const ingredientId = button.dataset.ingredientId;

		if (!ingredientId)
			return;

		void foodGuruStore.toggleIngredientStock(ingredientId);
	}

	override render(): unknown {
		return html`
		<section>
			<h2>Ingredients</h2>
			<p>Manage pantry items and mark whether ingredients are currently in stock.</p>
		</section>

		<section class="panel">
			<h3>Add Ingredient</h3>
			<form @submit=${ this.handleIngredientSubmit }>
				<label>
					Name
					<input name="ingredientName" placeholder="Brown Rice" required />
				</label>

				<label>
					Quantity
					<input name="quantity" placeholder="1 bag" required />
				</label>

				<button type="submit">Add Item</button>
			</form>
		</section>

		<section class="panel">
			<h3>Ingredient List</h3>
			${ when(this.ingredients.length > 0, () => html`
			<ul>
				${ repeat(this.ingredients, (ingredient) => ingredient.id, (ingredient) => html`
				<li>
					<div>
						<strong>${ ingredient.name }</strong>
						<span>${ ingredient.quantity }</span>
					</div>
					<button
						data-ingredient-id=${ ingredient.id }
						@click=${ this.handleStockToggle }
					>
						${ ingredient.inStock ? 'In Stock' : 'Out of Stock' }
					</button>
				</li>
				`) }
			</ul>
			`, () => html`
			<p class="empty">No ingredients added yet.</p>
			`) }
		</section>
		`;
	}

	static override styles = css`
		:host {
			display: grid;
			gap: 12px;
		}
		h2 {
			margin: 0 0 6px;
		}
		p {
			margin: 0;
			color: #5b7087;
		}
		.panel {
			display: grid;
			gap: 10px;
			padding: 12px;
			border: 1px solid #dde3ea;
			border-radius: 10px;
			background: #fff;
		}
		h3 {
			margin: 0;
		}
		form {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
			gap: 10px;
			align-items: end;
		}
		label {
			display: grid;
			gap: 6px;
			font-size: 13px;
			color: #58708a;
		}
		input,
		button {
			height: 36px;
			padding: 0 10px;
			border: 1px solid #cfd8e3;
			border-radius: 8px;
			font: inherit;
		}
		button {
			border-color: #2f7ad6;
			background: #2f7ad6;
			color: #fff;
			cursor: pointer;
		}
		ul {
			display: grid;
			gap: 8px;
			margin: 0;
			padding: 0;
			list-style: none;
		}
		li {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			padding: 10px;
			border: 1px solid #e4eaf1;
			border-radius: 8px;
			& div {
				display: grid;
				gap: 2px;
				& span {
					font-size: 13px;
					color: #58708a;
				}
			}
			& button {
				min-width: 120px;
				height: 32px;
				font-size: 12px;
			}
		}
		.empty {
			font-size: 13px;
			color: #58708a;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'ingredients-page': IngredientsPage;
	}
}
