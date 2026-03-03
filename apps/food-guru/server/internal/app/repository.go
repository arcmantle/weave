package app

import "context"

type Repository interface {
	Init(ctx context.Context) error
	GetState(ctx context.Context, tenantID string, userID string) (FoodGuruState, error)
	AddMeal(ctx context.Context, tenantID string, input AddMealInput) (MealPlanItem, error)
	ToggleMealComplete(ctx context.Context, tenantID string, mealID string) (MealPlanItem, error)
	AddIngredient(ctx context.Context, tenantID string, userID string, input AddIngredientInput) (IngredientItem, error)
	ToggleIngredientStock(ctx context.Context, tenantID string, userID string, ingredientID string) (IngredientItem, error)
	UpdateIngredient(ctx context.Context, tenantID string, userID string, ingredientID string, input UpdateIngredientInput) (IngredientItem, error)
	GetIngredientUsage(ctx context.Context, tenantID string, userID string, ingredientID string) (IngredientUsage, error)
	ReorderIngredients(ctx context.Context, tenantID string, userID string, categoryID string, ingredientIDs []string) error
	UpsertDish(ctx context.Context, tenantID string, userID string, dishID string, input UpsertDishInput) (DishItem, error)
	ListDishes(ctx context.Context, tenantID string, userID string) ([]DishItem, error)
	AddIngredientCategory(ctx context.Context, tenantID string, userID string, input AddIngredientCategoryInput) (IngredientCategory, error)
	UpdateIngredientCategory(ctx context.Context, tenantID string, userID string, categoryID string, input UpdateIngredientCategoryInput) (IngredientCategory, error)
	DeleteIngredientCategory(ctx context.Context, tenantID string, userID string, categoryID string) error
	ReorderIngredientCategories(ctx context.Context, tenantID string, userID string, categoryIDs []string) error
	UpdateSettings(ctx context.Context, tenantID string, settings Settings) (Settings, error)
}
