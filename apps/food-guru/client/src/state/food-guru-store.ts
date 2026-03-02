import type { FoodGuruSettings, FoodGuruState, IngredientItem, MealPlanItem } from '../types.ts';


class FoodGuruStore extends EventTarget {

	protected state: FoodGuruState = {
		mealPlans: [],
		ingredients: [],
		settings: {
			dailyCalorieGoal: 2000,
			showCompletedMeals: true,
		},
	};
	protected initialized = false;
	protected tenantID = this.resolveTenantID();

	async initialize(): Promise<void> {
		if (this.initialized)
			return;

		await this.syncState();
		this.initialized = true;
	}

	getSnapshot(): FoodGuruState {
		return {
			mealPlans: this.state.mealPlans.map((meal) => ({ ...meal })),
			ingredients: this.state.ingredients.map((ingredient) => ({ ...ingredient })),
			settings: { ...this.state.settings },
		};
	}

	async addMealPlan(input: Omit<MealPlanItem, 'id' | 'completed'>): Promise<void> {
		await this.requestJSON('/api/meals', {
			method: 'POST',
			body:   JSON.stringify(input),
		});
		await this.syncState();
	}

	async toggleMealComplete(mealId: string): Promise<void> {
		await this.requestJSON(`/api/meals/${ encodeURIComponent(mealId) }/toggle`, {
			method: 'POST',
		});
		await this.syncState();
	}

	async addIngredient(input: Omit<IngredientItem, 'id' | 'inStock'>): Promise<void> {
		await this.requestJSON('/api/ingredients', {
			method: 'POST',
			body:   JSON.stringify(input),
		});
		await this.syncState();
	}

	async toggleIngredientStock(ingredientId: string): Promise<void> {
		await this.requestJSON(`/api/ingredients/${ encodeURIComponent(ingredientId) }/toggle`, {
			method: 'POST',
		});
		await this.syncState();
	}

	async updateSettings(settings: Partial<FoodGuruSettings>): Promise<void> {
		const nextSettings = {
			...this.state.settings,
			...settings,
		};

		await this.requestJSON('/api/settings', {
			method: 'PUT',
			body:   JSON.stringify(nextSettings),
		});
		await this.syncState();
	}

	protected async syncState(): Promise<void> {
		const nextState = await this.requestJSON<FoodGuruState>('/api/state', {
			method: 'GET',
		});

		this.state = {
			mealPlans: nextState.mealPlans,
			ingredients: nextState.ingredients,
			settings: nextState.settings,
		};

		this.notifyChanged();
	}

	protected async requestJSON<T = unknown>(url: string, init: RequestInit): Promise<T> {
		const nextHeaders = new Headers(init.headers || {});
		nextHeaders.set('Content-Type', 'application/json');
		nextHeaders.set('X-Tenant-ID', this.tenantID);

		const response = await fetch(url, {
			headers: nextHeaders,
			...init,
		});

		if (!response.ok)
			throw new Error(`Request failed: ${ response.status } ${ response.statusText }`);

		if (response.status === 204)
			return undefined as T;

		return await response.json() as T;
	}

	protected resolveTenantID(): string {
		try {
			const value = window.localStorage.getItem('food-guru-tenant-id') || 'default';
			const normalized = value.trim();
			if (!normalized)
				return 'default';

			return normalized;
		}
		catch {
			return 'default';
		}
	}

	protected notifyChanged(): void {
		this.dispatchEvent(new Event('change'));
	}

}

export const foodGuruStore = new FoodGuruStore();
