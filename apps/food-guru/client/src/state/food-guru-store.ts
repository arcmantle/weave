import type { DishItem, FoodGuruSettings, FoodGuruState, IngredientItem, IngredientUsage, MealPlanItem, NutrientEntry } from '../types.ts';


class FoodGuruStore extends EventTarget {

	protected state: FoodGuruState = {
		mealPlans:            [],
		ingredients:          [],
		ingredientCategories: [],
		unassignedCategoryId: '',
		settings:             {
			dailyCalorieGoal:   2000,
			showCompletedMeals: true,
		},
	};

	protected initialized = false;
	protected tenantID: string = this.resolveTenantID();
	protected userID: string = this.resolveUserID();

	async initialize(): Promise<void> {
		if (this.initialized)
			return;

		await this.syncState();
		this.initialized = true;
	}

	getSnapshot(): FoodGuruState {
		const normalizedState = this.normalizeState(this.state);

		return {
			mealPlans:            normalizedState.mealPlans.map((meal) => ({ ...meal })),
			ingredients:          normalizedState.ingredients.map((ingredient) => ({
				...ingredient,
				tags:      [ ...ingredient.tags ],
				nutrients: ingredient.nutrients.map((nutrient) => ({ ...nutrient })),
			})),
			ingredientCategories: normalizedState.ingredientCategories.map((category) => ({ ...category })),
			unassignedCategoryId: normalizedState.unassignedCategoryId,
			settings:             { ...normalizedState.settings },
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

	async addIngredient(input: {
		name:        string;
		categoryId?: string;
		notes?:      string;
		tags?:       string[];
	}): Promise<void> {
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

	async updateIngredient(ingredientId: string, input: {
		name?:       string;
		categoryId?: string;
		notes?:      string;
		tags?:       string[];
		imageUrl?:   string;
		nutrients?:  NutrientEntry[];
	}): Promise<void> {
		await this.requestJSON(`/api/ingredients/${ encodeURIComponent(ingredientId) }`, {
			method: 'PUT',
			body:   JSON.stringify(input),
		});
		await this.syncState();
	}

	async getIngredientUsage(ingredientId: string): Promise<IngredientUsage> {
		return await this.requestJSON<IngredientUsage>(`/api/ingredients/${ encodeURIComponent(ingredientId) }/usage`, {
			method: 'GET',
		});
	}

	async listDishes(): Promise<DishItem[]> {
		return await this.requestJSON<DishItem[]>('/api/dishes', {
			method: 'GET',
		});
	}

	async upsertDish(input: {
		id?:           string;
		name:          string;
		notes?:        string;
		ingredientIds: string[];
	}): Promise<DishItem> {
		const id = input.id?.trim() || '';
		const method = id ? 'PUT' : 'POST';
		const url = id ? `/api/dishes/${ encodeURIComponent(id) }` : '/api/dishes';

		return await this.requestJSON<DishItem>(url, {
			method,
			body: JSON.stringify({
				name:          input.name,
				notes:         input.notes ?? '',
				ingredientIds: input.ingredientIds,
			}),
		});
	}

	async reorderIngredients(categoryId: string, ingredientIds: string[]): Promise<void> {
		await this.requestJSON('/api/ingredients/reorder', {
			method: 'POST',
			body:   JSON.stringify({ categoryId, ingredientIds }),
		});
		await this.syncState();
	}

	async addIngredientCategory(name: string): Promise<void> {
		await this.requestJSON('/api/ingredient-categories', {
			method: 'POST',
			body:   JSON.stringify({ name }),
		});
		await this.syncState();
	}

	async updateIngredientCategory(categoryId: string, name: string): Promise<void> {
		await this.requestJSON(`/api/ingredient-categories/${ encodeURIComponent(categoryId) }`, {
			method: 'PUT',
			body:   JSON.stringify({ name }),
		});
		await this.syncState();
	}

	async deleteIngredientCategory(categoryId: string): Promise<void> {
		await this.requestJSON(`/api/ingredient-categories/${ encodeURIComponent(categoryId) }`, {
			method: 'DELETE',
		});
		await this.syncState();
	}

	async reorderIngredientCategories(categoryIds: string[]): Promise<void> {
		await this.requestJSON('/api/ingredient-categories/reorder', {
			method: 'POST',
			body:   JSON.stringify({ categoryIds }),
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

		this.state = this.normalizeState(nextState);

		this.notifyChanged();
	}

	protected normalizeState(nextState: FoodGuruState): FoodGuruState {
		const ingredients = Array.isArray(nextState.ingredients)
			? nextState.ingredients.map((ingredient) => this.normalizeIngredient(ingredient))
			: [];

		const ingredientCategories = Array.isArray(nextState.ingredientCategories)
			? nextState.ingredientCategories.map((category) => ({
				id:            String(category?.id ?? ''),
				name:          String(category?.name ?? ''),
				categoryOrder: Number(category?.categoryOrder ?? 0),
				isSystem:      Boolean(category?.isSystem),
			}))
			: [];

		const unassignedCategoryId = String(nextState.unassignedCategoryId ?? '');
		if (!unassignedCategoryId && ingredientCategories.length === 0) {
			ingredientCategories.push({
				id:            'uncategorized',
				name:          'Unassigned',
				categoryOrder: 0,
				isSystem:      true,
			});
		}

		const fallbackCategoryId = unassignedCategoryId || ingredientCategories.at(0)?.id || 'uncategorized';
		const normalizedIngredients = ingredients.map((ingredient) => ({
			...ingredient,
			categoryId: ingredient.categoryId || fallbackCategoryId,
		}));

		return {
			mealPlans: Array.isArray(nextState.mealPlans) ? nextState.mealPlans.map((meal) => ({ ...meal })) : [],
			ingredients: normalizedIngredients,
			ingredientCategories: ingredientCategories,
			unassignedCategoryId: fallbackCategoryId,
			settings: {
				dailyCalorieGoal:   Number(nextState.settings?.dailyCalorieGoal ?? 2000),
				showCompletedMeals: Boolean(nextState.settings?.showCompletedMeals ?? true),
			},
		};
	}

	protected normalizeIngredient(ingredient: IngredientItem): IngredientItem {
		const nutrients = Array.isArray(ingredient.nutrients)
			? ingredient.nutrients.map((nutrient) => ({
				key:    String(nutrient?.key ?? ''),
				value:  String(nutrient?.value ?? ''),
				unit:   String(nutrient?.unit ?? ''),
				pinned: Boolean(nutrient?.pinned),
			}))
			: [];

		return {
			id:              String(ingredient.id ?? ''),
			name:            String(ingredient.name ?? ''),
			inStock:         Boolean(ingredient.inStock),
			categoryId:      String(ingredient.categoryId ?? ''),
			notes:           String(ingredient.notes ?? ''),
			tags:            Array.isArray(ingredient.tags) ? ingredient.tags.map((tag) => String(tag)) : [],
			imageUrl:        String(ingredient.imageUrl ?? ''),
			nutrients:       nutrients,
			ingredientOrder: Number(ingredient.ingredientOrder ?? 0),
		};
	}

	protected async requestJSON<T = unknown>(url: string, init: RequestInit): Promise<T> {
		const nextHeaders = new Headers(init.headers || {});
		nextHeaders.set('Content-Type', 'application/json');
		nextHeaders.set('X-Tenant-ID', this.tenantID);
		nextHeaders.set('X-User-ID', this.userID);

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

	protected resolveUserID(): string {
		try {
			const value = window.localStorage.getItem('food-guru-user-id') || 'default';
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

export const foodGuruStore: FoodGuruStore = new FoodGuruStore();
