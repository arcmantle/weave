export interface MealPlanItem {
	id:        string;
	day:       string;
	name:      string;
	calories:  number;
	completed: boolean;
}

export interface IngredientItem {
	id:              string;
	name:            string;
	inStock:         boolean;
	categoryId:      string;
	notes:           string;
	tags:            string[];
	imageUrl:        string;
	nutrients:       NutrientEntry[];
	quantity:        string;
	ingredientOrder: number;
}

export interface NutrientEntry {
	key:     string;
	value:   string;
	unit:    string;
	pinned?: boolean;
}

export interface DishItem {
	id:            string;
	name:          string;
	notes:         string;
	ingredientIds: string[];
	dishOrder:     number;
}

export interface IngredientUsage {
	mealPlans: MealPlanItem[];
	dishes:    DishItem[];
}

export interface IngredientCategory {
	id:            string;
	name:          string;
	categoryOrder: number;
	isSystem:      boolean;
}

export interface FoodGuruSettings {
	dailyCalorieGoal:   number;
	showCompletedMeals: boolean;
}

export interface FoodGuruState {
	mealPlans:            MealPlanItem[];
	ingredients:          IngredientItem[];
	ingredientCategories: IngredientCategory[];
	unassignedCategoryId: string;
	settings:             FoodGuruSettings;
}

export interface UpdateStatus {
	enabled:        boolean;
	currentVersion: string;
	latestVersion?: string;
	available:      boolean;
	canApply:       boolean;
	notes?:         string;
	message?:       string;
}
