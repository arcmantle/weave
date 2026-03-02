import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { foodGuruStore } from '../state/food-guru-store.ts';


@customElement('settings-page')
export class SettingsPage extends LitElement {

	@state() protected dailyCalorieGoal = 2000;
	@state() protected showCompletedMeals = true;

	protected onStoreChanged = (): void => {
		const snapshot = foodGuruStore.getSnapshot();
		this.dailyCalorieGoal = snapshot.settings.dailyCalorieGoal;
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

	protected handleSettingsSubmit(event: SubmitEvent): void {
		event.preventDefault();

		const form = event.currentTarget as HTMLFormElement;
		const formData = new FormData(form);
		const calorieGoal = Number(String(formData.get('dailyCalorieGoal') ?? '2000'));
		const showCompletedMeals = formData.get('showCompletedMeals') === 'on';

		if (Number.isNaN(calorieGoal) || calorieGoal <= 0)
			return;

		void foodGuruStore.updateSettings({
			dailyCalorieGoal: calorieGoal,
			showCompletedMeals,
		});
	}

	override render(): unknown {
		return html`
		<section>
			<h2>Settings</h2>
			<p>Adjust basic planning preferences for the food guru workflow.</p>
		</section>

		<section class="panel">
			<form @submit=${ this.handleSettingsSubmit }>
				<label>
					Daily Calorie Goal
					<input
						name="dailyCalorieGoal"
						type="number"
						min="1"
						.value=${ String(this.dailyCalorieGoal) }
						required
					/>
				</label>

				<label class="inline">
					<input
						name="showCompletedMeals"
						type="checkbox"
						?checked=${ this.showCompletedMeals }
					/>
					Show completed meals in planner
				</label>

				<button type="submit">Save Settings</button>
			</form>
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
		form {
			display: grid;
			gap: 12px;
			max-width: 420px;
		}
		label {
			display: grid;
			gap: 6px;
			font-size: 13px;
			color: #58708a;
		}
		.inline {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		input,
		button {
			height: 36px;
			padding: 0 10px;
			border: 1px solid #cfd8e3;
			border-radius: 8px;
			font: inherit;
		}
		.inline input {
			height: auto;
			width: auto;
			padding: 0;
		}
		button {
			border-color: #2f7ad6;
			background: #2f7ad6;
			color: #fff;
			cursor: pointer;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'settings-page': SettingsPage;
	}
}
