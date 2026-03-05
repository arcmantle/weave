import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';

import { foodGuruStore } from '../state/food-guru-store.ts';
import type { MealPlanItem } from '../types.ts';


@customElement('planner-page')
export class PlannerPage extends LitElement {

	@state() protected meals: MealPlanItem[] = [];
	@state() protected showCompletedMeals = true;

	protected readonly dayOptions = [
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday',
	] as const;

	protected onStoreChanged = (): void => {
		const snapshot = foodGuruStore.getSnapshot();
		this.meals = snapshot.mealPlans;
		this.showCompletedMeals = snapshot.settings.showCompletedMeals;
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

	protected handleMealSubmit(event: SubmitEvent): void {
		event.preventDefault();

		const form = event.currentTarget as HTMLFormElement;
		const formData = new FormData(form);
		const day = String(formData.get('day') ?? 'Monday');
		const mealName = String(formData.get('mealName') ?? '').trim();
		const caloriesText = String(formData.get('calories') ?? '0');
		const calories = Number(caloriesText);

		if (!mealName || Number.isNaN(calories) || calories <= 0)
			return;

		void foodGuruStore.addMealPlan({
			day,
			name: mealName,
			calories,
		});

		form.reset();
	}

	protected handleMealToggle(event: Event): void {
		const button = event.currentTarget as HTMLButtonElement;
		const mealId = button.dataset['mealId'];

		if (!mealId)
			return;

		void foodGuruStore.toggleMealComplete(mealId);
	}

	protected getVisibleMeals(): MealPlanItem[] {
		if (this.showCompletedMeals)
			return this.meals;

		return this.meals.filter((meal) => !meal.completed);
	}

	override render(): unknown {
		const meals = this.getVisibleMeals();

		return html`
		<section>
			<h2>Meal Planning</h2>
			<p>Plan daily meals and mark them as completed while you prepare.</p>
		</section>

		<section class="panel">
			<h3>Add Planned Meal</h3>
			<form @submit=${ this.handleMealSubmit }>
				<label>
					Day
					<select name="day">
						${ repeat(this.dayOptions, (day) => day, (day) => html`
						<option value=${ day }>${ day }</option>
						`) }
					</select>
				</label>

				<label>
					Meal
					<input name="mealName" placeholder="Chicken Stir Fry" required />
				</label>

				<label>
					Calories
					<input name="calories" type="number" min="1" required />
				</label>

				<button type="submit">Add Meal</button>
			</form>
		</section>

		<section class="panel">
			<h3>Planned Meals</h3>
			${ when(meals.length > 0, () => html`
			<ul>
				${ repeat(meals, (meal) => meal.id, (meal) => html`
				<li>
					<div>
						<strong>${ meal.day }</strong>
						<span>${ meal.name } • ${ meal.calories } kcal</span>
					</div>
					<button
						data-meal-id=${ meal.id }
						@click=${ this.handleMealToggle }
					>
						${ meal.completed ? 'Mark Pending' : 'Mark Completed' }
					</button>
				</li>
				`) }
			</ul>
			`, () => html`
			<p class="empty">No meals available for the current filter.</p>
			`) }
		</section>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: grid;
			grid-template-columns: 1fr;
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
		select,
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
				min-width: 130px;
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
		'planner-page': PlannerPage;
	}
}
