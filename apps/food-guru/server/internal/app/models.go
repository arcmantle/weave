package app

import "errors"

var ErrNotFound = errors.New("not found")
var ErrInvalid = errors.New("invalid input")

const DefaultTenantID = "default"
const DefaultUserID = "default"

type MealPlanItem struct {
	ID        string `json:"id"`
	Day       string `json:"day"`
	Name      string `json:"name"`
	Calories  int    `json:"calories"`
	Completed bool   `json:"completed"`
}

type IngredientItem struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Quantity        string   `json:"quantity"`
	InStock         bool     `json:"inStock"`
	CategoryID      string   `json:"categoryId"`
	Notes           string   `json:"notes"`
	Tags            []string `json:"tags"`
	ImageURL        string   `json:"imageUrl"`
	Nutrients       []NutrientEntry `json:"nutrients"`
	IngredientOrder int      `json:"ingredientOrder"`
}

type NutrientEntry struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Unit   string `json:"unit"`
	Pinned bool   `json:"pinned"`
}

type DishItem struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Notes         string   `json:"notes"`
	IngredientIDs []string `json:"ingredientIds"`
	DishOrder     int      `json:"dishOrder"`
}

type IngredientUsage struct {
	MealPlans []MealPlanItem `json:"mealPlans"`
	Dishes    []DishItem     `json:"dishes"`
}

type IngredientCategory struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	CategoryOrder int    `json:"categoryOrder"`
	IsSystem      bool   `json:"isSystem"`
}

type Settings struct {
	DailyCalorieGoal   int  `json:"dailyCalorieGoal"`
	ShowCompletedMeals bool `json:"showCompletedMeals"`
}

type FoodGuruState struct {
	MealPlans             []MealPlanItem       `json:"mealPlans"`
	Ingredients           []IngredientItem     `json:"ingredients"`
	IngredientCategories  []IngredientCategory `json:"ingredientCategories"`
	UnassignedCategoryID  string               `json:"unassignedCategoryId"`
	Settings              Settings             `json:"settings"`
}

type AddMealInput struct {
	Day      string
	Name     string
	Calories int
}

type AddIngredientInput struct {
	Name       string
	Quantity   string
	CategoryID string
	Notes      string
	Tags       []string
}

type UpdateIngredientInput struct {
	Name       string
	Quantity   string
	CategoryID string
	Notes      string
	Tags       []string
	ImageURL   string
	Nutrients  []NutrientEntry
}

type UpsertDishInput struct {
	Name          string
	Notes         string
	IngredientIDs []string
}

type AddIngredientCategoryInput struct {
	Name string
}

type UpdateIngredientCategoryInput struct {
	Name string
}
