import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { foodGuruStore } from '../state/food-guru-store.ts';


@customElement('stats-page')
export class StatsPage extends LitElement {

	@state() protected totalMeals = 0;
	@state() protected completedMeals = 0;
	@state() protected plannedCalories = 0;
	@state() protected calorieGoal = 0;

	protected onStoreChanged = (): void => {
		const snapshot = foodGuruStore.getSnapshot();
		this.totalMeals = snapshot.mealPlans.length;
		this.completedMeals = snapshot.mealPlans.filter((meal) => meal.completed).length;
		this.plannedCalories = snapshot.mealPlans.reduce((acc, meal) => acc + meal.calories, 0);
		this.calorieGoal = snapshot.settings.dailyCalorieGoal;
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

	protected getCompletionRate(): number {
		if (this.totalMeals === 0)
			return 0;

		return Math.round((this.completedMeals / this.totalMeals) * 100);
	}

	override render(): unknown {
		const completionRate = this.getCompletionRate();

		return html`
		<section>
			<h2>Meal Stats</h2>
			<p>Track progress and compare planned calories with your configured goal.</p>
		</section>

		<section class="stats-grid">
			<article class="card">
				<h3>Total Meals</h3>
				<strong>${ this.totalMeals }</strong>
			</article>

			<article class="card">
				<h3>Completion</h3>
				<strong>${ completionRate }%</strong>
			</article>

			<article class="card">
				<h3>Planned Calories</h3>
				<strong>${ this.plannedCalories }</strong>
			</article>

			<article class="card">
				<h3>Daily Goal</h3>
				<strong>${ this.calorieGoal }</strong>
			</article>
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
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 10px;
		}
		.card {
			display: grid;
			gap: 4px;
			padding: 14px;
			border: 1px solid #dde3ea;
			border-radius: 10px;
			background: #fff;
			& h3 {
				margin: 0;
				font-size: 13px;
				font-weight: 600;
				color: #58708a;
			}
			& strong {
				font-size: 24px;
			}
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'stats-page': StatsPage;
	}
}
