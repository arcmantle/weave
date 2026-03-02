export interface MealPlanItem {
	id: string;
	day: string;
	name: string;
	calories: number;
	completed: boolean;
}

export interface IngredientItem {
	id: string;
	name: string;
	quantity: string;
	inStock: boolean;
}

export interface FoodGuruSettings {
	dailyCalorieGoal: number;
	showCompletedMeals: boolean;
}

export interface FoodGuruState {
	mealPlans: MealPlanItem[];
	ingredients: IngredientItem[];
	settings: FoodGuruSettings;
}

export interface UpdateStatus {
	enabled: boolean;
	currentVersion: string;
	latestVersion?: string;
	available: boolean;
	canApply: boolean;
	notes?: string;
	message?: string;
}
