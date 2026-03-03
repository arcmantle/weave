package app

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

type SQLiteRepository struct {
	db *sql.DB
}

func NewSQLiteRepository(db *sql.DB) *SQLiteRepository {
	return &SQLiteRepository{db: db}
}

func (repository *SQLiteRepository) Init(ctx context.Context) error {
	if err := repository.migrateSettingsTable(ctx); err != nil {
		return err
	}

	statements := []string{
		`CREATE TABLE IF NOT EXISTS tenants (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`INSERT INTO tenants(id, name)
			SELECT 'default', 'Default Tenant'
			WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 'default');`,
		`CREATE TABLE IF NOT EXISTS meal_plans (
			id TEXT PRIMARY KEY,
			day TEXT NOT NULL,
			name TEXT NOT NULL,
			calories INTEGER NOT NULL,
			completed INTEGER NOT NULL DEFAULT 0
		);`,
		`ALTER TABLE meal_plans ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';`,
		`CREATE INDEX IF NOT EXISTS idx_meal_plans_tenant_id ON meal_plans(tenant_id);`,
		`CREATE TABLE IF NOT EXISTS ingredients (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			quantity TEXT NOT NULL,
			in_stock INTEGER NOT NULL DEFAULT 1
		);`,
		`ALTER TABLE ingredients ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';`,
		`ALTER TABLE ingredients ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default';`,
		`ALTER TABLE ingredients ADD COLUMN category_id TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE ingredients ADD COLUMN notes TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE ingredients ADD COLUMN tags TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE ingredients ADD COLUMN image_url TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE ingredients ADD COLUMN nutrients_json TEXT NOT NULL DEFAULT '[]';`,
		`ALTER TABLE ingredients ADD COLUMN ingredient_order INTEGER NOT NULL DEFAULT 0;`,
		`CREATE INDEX IF NOT EXISTS idx_ingredients_tenant_user ON ingredients(tenant_id, user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(tenant_id, user_id, category_id, ingredient_order);`,
		`CREATE TABLE IF NOT EXISTS dishes (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			notes TEXT NOT NULL DEFAULT '',
			dish_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_dishes_tenant_user ON dishes(tenant_id, user_id, dish_order);`,
		`CREATE TABLE IF NOT EXISTS dish_ingredients (
			tenant_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			dish_id TEXT NOT NULL,
			ingredient_id TEXT NOT NULL,
			position INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY(tenant_id, user_id, dish_id, ingredient_id)
		);`,
		`CREATE INDEX IF NOT EXISTS idx_dish_ingredients_ingredient ON dish_ingredients(tenant_id, user_id, ingredient_id, dish_id);`,
		`CREATE TABLE IF NOT EXISTS meal_plan_ingredients (
			tenant_id TEXT NOT NULL,
			meal_id TEXT NOT NULL,
			ingredient_id TEXT NOT NULL,
			position INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY(tenant_id, meal_id, ingredient_id)
		);`,
		`CREATE INDEX IF NOT EXISTS idx_meal_plan_ingredients_ingredient ON meal_plan_ingredients(tenant_id, ingredient_id, meal_id);`,
		`CREATE TABLE IF NOT EXISTS ingredient_categories (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			category_order INTEGER NOT NULL,
			is_system INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_ingredient_categories_tenant_user ON ingredient_categories(tenant_id, user_id);`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_categories_system ON ingredient_categories(tenant_id, user_id, is_system) WHERE is_system = 1;`,
		`CREATE TABLE IF NOT EXISTS settings (
			tenant_id TEXT PRIMARY KEY,
			daily_calorie_goal INTEGER NOT NULL,
			show_completed_meals INTEGER NOT NULL,
			FOREIGN KEY(tenant_id) REFERENCES tenants(id)
		);`,
		`INSERT OR IGNORE INTO settings(tenant_id, daily_calorie_goal, show_completed_meals)
			VALUES('default', 2000, 1);`,
	}

	for _, statement := range statements {
		_, err := repository.db.ExecContext(ctx, statement)
		if err != nil {
			if strings.Contains(statement, "ALTER TABLE") && strings.Contains(err.Error(), "duplicate column name") {
				continue
			}

			return err
		}
	}

	if err := repository.backfillIngredientCategories(ctx); err != nil {
		return err
	}

	return nil
}

func (repository *SQLiteRepository) migrateSettingsTable(ctx context.Context) error {
	rows, err := repository.db.QueryContext(ctx, `PRAGMA table_info(settings);`)
	if err != nil {
		return err
	}
	defer rows.Close()

	hasRows := false
	hasTenantID := false

	for rows.Next() {
		hasRows = true
		var cid int
		var name string
		var dataType string
		var notNull int
		var defaultValue sql.NullString
		var pk int

		if err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &pk); err != nil {
			return err
		}

		if name == "tenant_id" {
			hasTenantID = true
		}
	}

	if !hasRows || hasTenantID {
		return nil
	}

	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(ctx, `ALTER TABLE settings RENAME TO settings_legacy;`); err != nil {
		return err
	}

	if _, err = tx.ExecContext(ctx, `
		CREATE TABLE settings (
			tenant_id TEXT PRIMARY KEY,
			daily_calorie_goal INTEGER NOT NULL,
			show_completed_meals INTEGER NOT NULL
		);
	`); err != nil {
		return err
	}

	if _, err = tx.ExecContext(ctx, `
		INSERT INTO settings(tenant_id, daily_calorie_goal, show_completed_meals)
			SELECT 'default', daily_calorie_goal, show_completed_meals
			FROM settings_legacy
			LIMIT 1;
	`); err != nil {
		return err
	}

	if _, err = tx.ExecContext(ctx, `DROP TABLE settings_legacy;`); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (repository *SQLiteRepository) backfillIngredientCategories(ctx context.Context) error {
	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	rows, err := tx.QueryContext(ctx,
		`SELECT DISTINCT tenant_id, user_id
			FROM ingredients;`,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	scopes := make([][2]string, 0)
	for rows.Next() {
		var tenantID string
		var userID string
		if err := rows.Scan(&tenantID, &userID); err != nil {
			return err
		}

		scopes = append(scopes, [2]string{normalizeTenantID(tenantID), normalizeUserID(userID)})
	}

	scopes = append(scopes, [2]string{DefaultTenantID, DefaultUserID})

	for _, scope := range scopes {
		tenantID := scope[0]
		userID := scope[1]
		unassignedCategoryID, ensureErr := repository.ensureSystemCategoryTx(ctx, tx, tenantID, userID)
		if ensureErr != nil {
			return ensureErr
		}

		if _, ensureOrderErr := tx.ExecContext(ctx,
			`UPDATE ingredients
				SET category_id = ?
				WHERE tenant_id = ?
					AND user_id = ?
					AND (category_id = '' OR category_id IS NULL);`,
			unassignedCategoryID,
			tenantID,
			userID,
		); ensureOrderErr != nil {
			return ensureOrderErr
		}

		if reindexErr := repository.reindexCategoryIngredientsTx(ctx, tx, tenantID, userID, unassignedCategoryID); reindexErr != nil {
			return reindexErr
		}

		if categoryReindexErr := repository.reindexCategoriesTx(ctx, tx, tenantID, userID); categoryReindexErr != nil {
			return categoryReindexErr
		}
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (repository *SQLiteRepository) GetState(ctx context.Context, tenantID string, userID string) (FoodGuruState, error) {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)

	unassignedCategoryID, err := repository.ensureSystemCategory(ctx, tenantID, userID)
	if err != nil {
		return FoodGuruState{}, err
	}

	mealRows, err := repository.db.QueryContext(ctx,
		`SELECT id, day, name, calories, completed
			FROM meal_plans
			WHERE tenant_id = ?
			ORDER BY rowid;`,
		tenantID,
	)
	if err != nil {
		return FoodGuruState{}, err
	}
	defer mealRows.Close()

	meals := make([]MealPlanItem, 0)
	for mealRows.Next() {
		var meal MealPlanItem
		var completed int
		if err := mealRows.Scan(&meal.ID, &meal.Day, &meal.Name, &meal.Calories, &completed); err != nil {
			return FoodGuruState{}, err
		}
		meal.Completed = completed == 1
		meals = append(meals, meal)
	}

	categoryRows, err := repository.db.QueryContext(ctx,
		`SELECT id, name, category_order, is_system
			FROM ingredient_categories
			WHERE tenant_id = ? AND user_id = ?
			ORDER BY category_order, created_at;`,
		tenantID,
		userID,
	)
	if err != nil {
		return FoodGuruState{}, err
	}
	defer categoryRows.Close()

	categories := make([]IngredientCategory, 0)
	for categoryRows.Next() {
		var category IngredientCategory
		var isSystem int
		if err := categoryRows.Scan(&category.ID, &category.Name, &category.CategoryOrder, &isSystem); err != nil {
			return FoodGuruState{}, err
		}
		category.IsSystem = isSystem == 1
		categories = append(categories, category)
	}

	ingredientRows, err := repository.db.QueryContext(ctx,
		`SELECT i.id, i.name, i.quantity, i.in_stock, i.category_id, i.notes, i.tags, i.image_url, i.nutrients_json, i.ingredient_order
			FROM ingredients i
			LEFT JOIN ingredient_categories c
				ON c.id = i.category_id
				AND c.tenant_id = i.tenant_id
				AND c.user_id = i.user_id
			WHERE i.tenant_id = ? AND i.user_id = ?
			ORDER BY COALESCE(c.category_order, 99999), i.ingredient_order, i.rowid;`,
		tenantID,
		userID,
	)
	if err != nil {
		return FoodGuruState{}, err
	}
	defer ingredientRows.Close()

	ingredients := make([]IngredientItem, 0)
	for ingredientRows.Next() {
		var ingredient IngredientItem
		var inStock int
		var tags string
		var nutrientsJSON string
		if err := ingredientRows.Scan(
			&ingredient.ID,
			&ingredient.Name,
			&ingredient.Quantity,
			&inStock,
			&ingredient.CategoryID,
			&ingredient.Notes,
			&tags,
			&ingredient.ImageURL,
			&nutrientsJSON,
			&ingredient.IngredientOrder,
		); err != nil {
			return FoodGuruState{}, err
		}
		ingredient.InStock = inStock == 1
		ingredient.Tags = tagsFromStorage(tags)
		ingredient.Nutrients = nutrientsFromStorage(nutrientsJSON)
		if ingredient.CategoryID == "" {
			ingredient.CategoryID = unassignedCategoryID
		}
		ingredients = append(ingredients, ingredient)
	}

	settings := Settings{}
	var showCompletedMeals int
	err = repository.db.QueryRowContext(
		ctx,
		`SELECT daily_calorie_goal, show_completed_meals FROM settings WHERE tenant_id = ?;`,
		tenantID,
	).Scan(&settings.DailyCalorieGoal, &showCompletedMeals)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			if _, upsertErr := repository.db.ExecContext(
				ctx,
				`INSERT OR IGNORE INTO settings(tenant_id, daily_calorie_goal, show_completed_meals)
					VALUES(?, 2000, 1);`,
				tenantID,
			); upsertErr != nil {
				return FoodGuruState{}, upsertErr
			}

			settings = Settings{
				DailyCalorieGoal:   2000,
				ShowCompletedMeals: true,
			}

			return FoodGuruState{
				MealPlans:            meals,
				Ingredients:          ingredients,
				IngredientCategories: categories,
				UnassignedCategoryID: unassignedCategoryID,
				Settings:             settings,
			}, nil
		}

		return FoodGuruState{}, err
	}
	settings.ShowCompletedMeals = showCompletedMeals == 1

	return FoodGuruState{
		MealPlans:            meals,
		Ingredients:          ingredients,
		IngredientCategories: categories,
		UnassignedCategoryID: unassignedCategoryID,
		Settings:             settings,
	}, nil
}

func (repository *SQLiteRepository) AddMeal(ctx context.Context, tenantID string, input AddMealInput) (MealPlanItem, error) {
	tenantID = normalizeTenantID(tenantID)

	item := MealPlanItem{
		ID:        newID("m"),
		Day:       strings.TrimSpace(input.Day),
		Name:      strings.TrimSpace(input.Name),
		Calories:  input.Calories,
		Completed: false,
	}

	_, err := repository.db.ExecContext(
		ctx,
		`INSERT INTO meal_plans(id, tenant_id, day, name, calories, completed)
			VALUES(?, ?, ?, ?, ?, 0);`,
		item.ID,
		tenantID,
		item.Day,
		item.Name,
		item.Calories,
	)
	if err != nil {
		return MealPlanItem{}, err
	}

	return item, nil
}

func (repository *SQLiteRepository) ToggleMealComplete(ctx context.Context, tenantID string, mealID string) (MealPlanItem, error) {
	tenantID = normalizeTenantID(tenantID)

	row := repository.db.QueryRowContext(
		ctx,
		`SELECT day, name, calories, completed
			FROM meal_plans
			WHERE id = ? AND tenant_id = ?;`,
		mealID,
		tenantID,
	)

	item := MealPlanItem{ID: mealID}
	var completed int
	if err := row.Scan(&item.Day, &item.Name, &item.Calories, &completed); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return MealPlanItem{}, ErrNotFound
		}

		return MealPlanItem{}, err
	}

	nextCompleted := 1
	if completed == 1 {
		nextCompleted = 0
	}

	if _, err := repository.db.ExecContext(
		ctx,
		`UPDATE meal_plans
			SET completed = ?
			WHERE id = ? AND tenant_id = ?;`,
		nextCompleted,
		mealID,
		tenantID,
	); err != nil {
		return MealPlanItem{}, err
	}

	item.Completed = nextCompleted == 1

	return item, nil
}

func (repository *SQLiteRepository) AddIngredient(ctx context.Context, tenantID string, userID string, input AddIngredientInput) (IngredientItem, error) {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)

	unassignedCategoryID, err := repository.ensureSystemCategory(ctx, tenantID, userID)
	if err != nil {
		return IngredientItem{}, err
	}

	categoryID := strings.TrimSpace(input.CategoryID)
	if categoryID == "" {
		categoryID = unassignedCategoryID
	}

	exists, err := repository.categoryExists(ctx, tenantID, userID, categoryID)
	if err != nil {
		return IngredientItem{}, err
	}
	if !exists {
		categoryID = unassignedCategoryID
	}

	nextOrder, err := repository.nextIngredientOrder(ctx, tenantID, userID, categoryID)
	if err != nil {
		return IngredientItem{}, err
	}

	tags := sanitizeTags(input.Tags)
	item := IngredientItem{
		ID:              newID("i"),
		Name:            strings.TrimSpace(input.Name),
		Quantity:        strings.TrimSpace(input.Quantity),
		InStock:         true,
		CategoryID:      categoryID,
		Notes:           strings.TrimSpace(input.Notes),
		Tags:            tags,
		ImageURL:        "",
		Nutrients:       make([]NutrientEntry, 0),
		IngredientOrder: nextOrder,
	}

	_, err = repository.db.ExecContext(
		ctx,
		`INSERT INTO ingredients(id, tenant_id, user_id, name, quantity, in_stock, category_id, notes, tags, image_url, nutrients_json, ingredient_order)
			VALUES(?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?);`,
		item.ID,
		tenantID,
		userID,
		item.Name,
		item.Quantity,
		item.CategoryID,
		item.Notes,
		tagsToStorage(item.Tags),
		item.ImageURL,
		nutrientsToStorage(item.Nutrients),
		item.IngredientOrder,
	)
	if err != nil {
		return IngredientItem{}, err
	}

	return item, nil
}

func (repository *SQLiteRepository) ToggleIngredientStock(ctx context.Context, tenantID string, userID string, ingredientID string) (IngredientItem, error) {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)

	row := repository.db.QueryRowContext(
		ctx,
		`SELECT name, quantity, in_stock, category_id, notes, tags, image_url, nutrients_json, ingredient_order
			FROM ingredients
			WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		ingredientID,
		tenantID,
		userID,
	)

	item := IngredientItem{ID: ingredientID}
	var inStock int
	var tags string
	var nutrientsJSON string
	if err := row.Scan(&item.Name, &item.Quantity, &inStock, &item.CategoryID, &item.Notes, &tags, &item.ImageURL, &nutrientsJSON, &item.IngredientOrder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return IngredientItem{}, ErrNotFound
		}

		return IngredientItem{}, err
	}

	nextInStock := 1
	if inStock == 1 {
		nextInStock = 0
	}

	if _, err := repository.db.ExecContext(
		ctx,
		`UPDATE ingredients
			SET in_stock = ?
			WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		nextInStock,
		ingredientID,
		tenantID,
		userID,
	); err != nil {
		return IngredientItem{}, err
	}

	item.Tags = tagsFromStorage(tags)
	item.Nutrients = nutrientsFromStorage(nutrientsJSON)
	item.InStock = nextInStock == 1

	return item, nil
}

func (repository *SQLiteRepository) UpdateIngredient(ctx context.Context, tenantID string, userID string, ingredientID string, input UpdateIngredientInput) (IngredientItem, error) {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)

	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return IngredientItem{}, err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	unassignedCategoryID, err := repository.ensureSystemCategoryTx(ctx, tx, tenantID, userID)
	if err != nil {
		return IngredientItem{}, err
	}

	row := tx.QueryRowContext(
		ctx,
		`SELECT name, quantity, in_stock, category_id, notes, tags, image_url, nutrients_json, ingredient_order
			FROM ingredients
			WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		ingredientID,
		tenantID,
		userID,
	)

	item := IngredientItem{ID: ingredientID}
	var inStock int
	var tags string
	var nutrientsJSON string
	if err = row.Scan(&item.Name, &item.Quantity, &inStock, &item.CategoryID, &item.Notes, &tags, &item.ImageURL, &nutrientsJSON, &item.IngredientOrder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return IngredientItem{}, ErrNotFound
		}
		return IngredientItem{}, err
	}

	nextCategoryID := strings.TrimSpace(input.CategoryID)
	if nextCategoryID == "" {
		nextCategoryID = item.CategoryID
	}
	if nextCategoryID == "" {
		nextCategoryID = unassignedCategoryID
	}

	categoryExists, err := repository.categoryExistsTx(ctx, tx, tenantID, userID, nextCategoryID)
	if err != nil {
		return IngredientItem{}, err
	}
	if !categoryExists {
		nextCategoryID = unassignedCategoryID
	}

	nextQuantity := strings.TrimSpace(input.Quantity)
	if nextQuantity == "" {
		nextQuantity = item.Quantity
	}

	nextName := strings.TrimSpace(input.Name)
	if nextName == "" {
		nextName = item.Name
	}

	nextNotes := strings.TrimSpace(input.Notes)
	nextTags := sanitizeTags(input.Tags)
	nextImageURL := strings.TrimSpace(input.ImageURL)
	nextNutrients := sanitizeNutrients(input.Nutrients)
	nextOrder := item.IngredientOrder
	if item.CategoryID != nextCategoryID {
		nextOrder, err = repository.nextIngredientOrderTx(ctx, tx, tenantID, userID, nextCategoryID)
		if err != nil {
			return IngredientItem{}, err
		}
	}

	if _, err = tx.ExecContext(
		ctx,
		`UPDATE ingredients
			SET name = ?, quantity = ?, category_id = ?, notes = ?, tags = ?, image_url = ?, nutrients_json = ?, ingredient_order = ?
			WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		nextName,
		nextQuantity,
		nextCategoryID,
		nextNotes,
		tagsToStorage(nextTags),
		nextImageURL,
		nutrientsToStorage(nextNutrients),
		nextOrder,
		ingredientID,
		tenantID,
		userID,
	); err != nil {
		return IngredientItem{}, err
	}

	if item.CategoryID != "" && item.CategoryID != nextCategoryID {
		if err = repository.reindexCategoryIngredientsTx(ctx, tx, tenantID, userID, item.CategoryID); err != nil {
			return IngredientItem{}, err
		}
	}
	if err = repository.reindexCategoryIngredientsTx(ctx, tx, tenantID, userID, nextCategoryID); err != nil {
		return IngredientItem{}, err
	}

	if err = tx.Commit(); err != nil {
		return IngredientItem{}, err
	}

	item.Quantity = nextQuantity
	item.Name = nextName
	item.CategoryID = nextCategoryID
	item.Notes = nextNotes
	item.Tags = nextTags
	item.ImageURL = nextImageURL
	item.Nutrients = nextNutrients
	item.InStock = inStock == 1
	item.IngredientOrder = nextOrder

	return item, nil
}

func (repository *SQLiteRepository) GetIngredientUsage(ctx context.Context, tenantID string, userID string, ingredientID string) (IngredientUsage, error) {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)

	var exists int
	if err := repository.db.QueryRowContext(
		ctx,
		`SELECT 1 FROM ingredients WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		ingredientID,
		tenantID,
		userID,
	).Scan(&exists); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return IngredientUsage{}, ErrNotFound
		}

		return IngredientUsage{}, err
	}

	mealRows, err := repository.db.QueryContext(
		ctx,
		`SELECT m.id, m.day, m.name, m.calories, m.completed
			FROM meal_plan_ingredients mi
			JOIN meal_plans m ON m.id = mi.meal_id AND m.tenant_id = mi.tenant_id
			WHERE mi.tenant_id = ? AND mi.ingredient_id = ?
			ORDER BY m.rowid;`,
		tenantID,
		ingredientID,
	)
	if err != nil {
		return IngredientUsage{}, err
	}
	defer mealRows.Close()

	mealPlans := make([]MealPlanItem, 0)
	for mealRows.Next() {
		var meal MealPlanItem
		var completed int
		if scanErr := mealRows.Scan(&meal.ID, &meal.Day, &meal.Name, &meal.Calories, &completed); scanErr != nil {
			return IngredientUsage{}, scanErr
		}

		meal.Completed = completed == 1
		mealPlans = append(mealPlans, meal)
	}

	dishRows, err := repository.db.QueryContext(
		ctx,
		`SELECT d.id, d.name, d.notes, d.dish_order
			FROM dish_ingredients di
			JOIN dishes d
				ON d.id = di.dish_id
				AND d.tenant_id = di.tenant_id
				AND d.user_id = di.user_id
			WHERE di.tenant_id = ? AND di.user_id = ? AND di.ingredient_id = ?
			ORDER BY d.dish_order, d.created_at;`,
		tenantID,
		userID,
		ingredientID,
	)
	if err != nil {
		return IngredientUsage{}, err
	}
	defer dishRows.Close()

	dishes := make([]DishItem, 0)
	for dishRows.Next() {
		dish := DishItem{IngredientIDs: make([]string, 0)}
		if scanErr := dishRows.Scan(&dish.ID, &dish.Name, &dish.Notes, &dish.DishOrder); scanErr != nil {
			return IngredientUsage{}, scanErr
		}

		dishes = append(dishes, dish)
	}

	return IngredientUsage{
		MealPlans: mealPlans,
		Dishes:    dishes,
	}, nil
}

func (repository *SQLiteRepository) UpsertDish(ctx context.Context, tenantID string, userID string, dishID string, input UpsertDishInput) (DishItem, error) {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return DishItem{}, ErrInvalid
	}

	ingredientIDs := sanitizeIngredientIDs(input.IngredientIDs)
	for _, ingredientID := range ingredientIDs {
		var exists int
		if err := repository.db.QueryRowContext(
			ctx,
			`SELECT 1 FROM ingredients WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
			ingredientID,
			tenantID,
			userID,
		).Scan(&exists); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return DishItem{}, ErrInvalid
			}

			return DishItem{}, err
		}
	}

	normalizedDishID := strings.TrimSpace(dishID)
	if normalizedDishID == "" {
		normalizedDishID = newID("d")
	}

	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return DishItem{}, err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	dish := DishItem{
		ID:            normalizedDishID,
		Name:          name,
		Notes:         strings.TrimSpace(input.Notes),
		IngredientIDs: ingredientIDs,
		DishOrder:     0,
	}

	var existingOrder int
	scanErr := tx.QueryRowContext(
		ctx,
		`SELECT dish_order FROM dishes WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		normalizedDishID,
		tenantID,
		userID,
	).Scan(&existingOrder)
	if scanErr != nil {
		if errors.Is(scanErr, sql.ErrNoRows) {
			nextOrderErr := tx.QueryRowContext(
				ctx,
				`SELECT COALESCE(MAX(dish_order) + 1, 0) FROM dishes WHERE tenant_id = ? AND user_id = ?;`,
				tenantID,
				userID,
			).Scan(&dish.DishOrder)
			if nextOrderErr != nil {
				return DishItem{}, nextOrderErr
			}

			if _, execErr := tx.ExecContext(
				ctx,
				`INSERT INTO dishes(id, tenant_id, user_id, name, notes, dish_order) VALUES(?, ?, ?, ?, ?, ?);`,
				dish.ID,
				tenantID,
				userID,
				dish.Name,
				dish.Notes,
				dish.DishOrder,
			); execErr != nil {
				return DishItem{}, execErr
			}
		} else {
			return DishItem{}, scanErr
		}
	} else {
		dish.DishOrder = existingOrder
		if _, execErr := tx.ExecContext(
			ctx,
			`UPDATE dishes SET name = ?, notes = ? WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
			dish.Name,
			dish.Notes,
			dish.ID,
			tenantID,
			userID,
		); execErr != nil {
			return DishItem{}, execErr
		}
	}

	if _, err = tx.ExecContext(
		ctx,
		`DELETE FROM dish_ingredients WHERE tenant_id = ? AND user_id = ? AND dish_id = ?;`,
		tenantID,
		userID,
		dish.ID,
	); err != nil {
		return DishItem{}, err
	}

	for position, ingredientID := range ingredientIDs {
		if _, execErr := tx.ExecContext(
			ctx,
			`INSERT INTO dish_ingredients(tenant_id, user_id, dish_id, ingredient_id, position) VALUES(?, ?, ?, ?, ?);`,
			tenantID,
			userID,
			dish.ID,
			ingredientID,
			position,
		); execErr != nil {
			return DishItem{}, execErr
		}
	}

	if err = tx.Commit(); err != nil {
		return DishItem{}, err
	}

	return dish, nil
}

func (repository *SQLiteRepository) ListDishes(ctx context.Context, tenantID string, userID string) ([]DishItem, error) {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)

	dishRows, err := repository.db.QueryContext(
		ctx,
		`SELECT id, name, notes, dish_order
			FROM dishes
			WHERE tenant_id = ? AND user_id = ?
			ORDER BY dish_order, created_at;`,
		tenantID,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer dishRows.Close()

	dishes := make([]DishItem, 0)
	for dishRows.Next() {
		dish := DishItem{}
		if scanErr := dishRows.Scan(&dish.ID, &dish.Name, &dish.Notes, &dish.DishOrder); scanErr != nil {
			return nil, scanErr
		}

		ingredientRows, ingredientErr := repository.db.QueryContext(
			ctx,
			`SELECT ingredient_id
				FROM dish_ingredients
				WHERE tenant_id = ? AND user_id = ? AND dish_id = ?
				ORDER BY position, ingredient_id;`,
			tenantID,
			userID,
			dish.ID,
		)
		if ingredientErr != nil {
			return nil, ingredientErr
		}

		dish.IngredientIDs = make([]string, 0)
		for ingredientRows.Next() {
			var ingredientID string
			if scanErr := ingredientRows.Scan(&ingredientID); scanErr != nil {
				ingredientRows.Close()
				return nil, scanErr
			}

			dish.IngredientIDs = append(dish.IngredientIDs, ingredientID)
		}
		ingredientRows.Close()

		dishes = append(dishes, dish)
	}

	return dishes, nil
}

func (repository *SQLiteRepository) ReorderIngredients(ctx context.Context, tenantID string, userID string, categoryID string, ingredientIDs []string) error {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)
	categoryID = strings.TrimSpace(categoryID)
	if categoryID == "" {
		return ErrInvalid
	}

	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	exists, err := repository.categoryExistsTx(ctx, tx, tenantID, userID, categoryID)
	if err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}

	seen := make(map[string]struct{}, len(ingredientIDs))
	ordered := make([]string, 0, len(ingredientIDs))
	sourceCategories := make(map[string]struct{})

	for _, ingredientID := range ingredientIDs {
		ingredientID = strings.TrimSpace(ingredientID)
		if ingredientID == "" {
			continue
		}
		if _, duplicate := seen[ingredientID]; duplicate {
			continue
		}

		var sourceCategoryID string
		rowErr := tx.QueryRowContext(
			ctx,
			`SELECT category_id
				FROM ingredients
				WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
			ingredientID,
			tenantID,
			userID,
		).Scan(&sourceCategoryID)
		if rowErr != nil {
			if errors.Is(rowErr, sql.ErrNoRows) {
				continue
			}
			return rowErr
		}

		ordered = append(ordered, ingredientID)
		seen[ingredientID] = struct{}{}
		if sourceCategoryID != "" && sourceCategoryID != categoryID {
			sourceCategories[sourceCategoryID] = struct{}{}
		}
	}

	rows, queryErr := tx.QueryContext(
		ctx,
		`SELECT id
			FROM ingredients
			WHERE tenant_id = ? AND user_id = ? AND category_id = ?
			ORDER BY ingredient_order, rowid;`,
		tenantID,
		userID,
		categoryID,
	)
	if queryErr != nil {
		return queryErr
	}
	defer rows.Close()

	for rows.Next() {
		var ingredientID string
		if scanErr := rows.Scan(&ingredientID); scanErr != nil {
			return scanErr
		}

		if _, alreadyIncluded := seen[ingredientID]; alreadyIncluded {
			continue
		}
		ordered = append(ordered, ingredientID)
	}

	for index, ingredientID := range ordered {
		if _, execErr := tx.ExecContext(
			ctx,
			`UPDATE ingredients
				SET category_id = ?, ingredient_order = ?
				WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
			categoryID,
			index,
			ingredientID,
			tenantID,
			userID,
		); execErr != nil {
			return execErr
		}
	}

	for sourceCategoryID := range sourceCategories {
		if reindexErr := repository.reindexCategoryIngredientsTx(ctx, tx, tenantID, userID, sourceCategoryID); reindexErr != nil {
			return reindexErr
		}
	}
	if err = repository.reindexCategoryIngredientsTx(ctx, tx, tenantID, userID, categoryID); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (repository *SQLiteRepository) AddIngredientCategory(ctx context.Context, tenantID string, userID string, input AddIngredientCategoryInput) (IngredientCategory, error) {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return IngredientCategory{}, ErrInvalid
	}

	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return IngredientCategory{}, err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = repository.ensureSystemCategoryTx(ctx, tx, tenantID, userID); err != nil {
		return IngredientCategory{}, err
	}

	nextOrder, err := repository.nextCategoryOrderTx(ctx, tx, tenantID, userID)
	if err != nil {
		return IngredientCategory{}, err
	}

	category := IngredientCategory{
		ID:            newID("c"),
		Name:          name,
		CategoryOrder: nextOrder,
		IsSystem:      false,
	}

	if _, err = tx.ExecContext(
		ctx,
		`INSERT INTO ingredient_categories(id, tenant_id, user_id, name, category_order, is_system)
			VALUES(?, ?, ?, ?, ?, 0);`,
		category.ID,
		tenantID,
		userID,
		category.Name,
		category.CategoryOrder,
	); err != nil {
		return IngredientCategory{}, err
	}

	if err = repository.reindexCategoriesTx(ctx, tx, tenantID, userID); err != nil {
		return IngredientCategory{}, err
	}

	if err = tx.Commit(); err != nil {
		return IngredientCategory{}, err
	}

	return category, nil
}

func (repository *SQLiteRepository) UpdateIngredientCategory(ctx context.Context, tenantID string, userID string, categoryID string, input UpdateIngredientCategoryInput) (IngredientCategory, error) {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)
	categoryID = strings.TrimSpace(categoryID)
	name := strings.TrimSpace(input.Name)
	if categoryID == "" || name == "" {
		return IngredientCategory{}, ErrInvalid
	}

	category := IngredientCategory{}
	var isSystem int
	err := repository.db.QueryRowContext(
		ctx,
		`SELECT id, name, category_order, is_system
			FROM ingredient_categories
			WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		categoryID,
		tenantID,
		userID,
	).Scan(&category.ID, &category.Name, &category.CategoryOrder, &isSystem)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return IngredientCategory{}, ErrNotFound
		}
		return IngredientCategory{}, err
	}
	if isSystem == 1 {
		return IngredientCategory{}, ErrInvalid
	}

	if _, err = repository.db.ExecContext(
		ctx,
		`UPDATE ingredient_categories
			SET name = ?
			WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		name,
		categoryID,
		tenantID,
		userID,
	); err != nil {
		return IngredientCategory{}, err
	}

	category.Name = name
	category.IsSystem = false

	return category, nil
}

func (repository *SQLiteRepository) DeleteIngredientCategory(ctx context.Context, tenantID string, userID string, categoryID string) error {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)
	categoryID = strings.TrimSpace(categoryID)
	if categoryID == "" {
		return ErrInvalid
	}

	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	unassignedCategoryID, err := repository.ensureSystemCategoryTx(ctx, tx, tenantID, userID)
	if err != nil {
		return err
	}

	var isSystem int
	err = tx.QueryRowContext(
		ctx,
		`SELECT is_system
			FROM ingredient_categories
			WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		categoryID,
		tenantID,
		userID,
	).Scan(&isSystem)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if isSystem == 1 {
		return ErrInvalid
	}

	nextStart, err := repository.nextIngredientOrderTx(ctx, tx, tenantID, userID, unassignedCategoryID)
	if err != nil {
		return err
	}

	rows, err := tx.QueryContext(
		ctx,
		`SELECT id
			FROM ingredients
			WHERE tenant_id = ? AND user_id = ? AND category_id = ?
			ORDER BY ingredient_order, rowid;`,
		tenantID,
		userID,
		categoryID,
	)
	if err != nil {
		return err
	}

	ingredientIDs := make([]string, 0)
	for rows.Next() {
		var ingredientID string
		if scanErr := rows.Scan(&ingredientID); scanErr != nil {
			rows.Close()
			return scanErr
		}
		ingredientIDs = append(ingredientIDs, ingredientID)
	}
	rows.Close()

	for index, ingredientID := range ingredientIDs {
		if _, execErr := tx.ExecContext(
			ctx,
			`UPDATE ingredients
				SET category_id = ?, ingredient_order = ?
				WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
			unassignedCategoryID,
			nextStart+index,
			ingredientID,
			tenantID,
			userID,
		); execErr != nil {
			return execErr
		}
	}

	if _, err = tx.ExecContext(
		ctx,
		`DELETE FROM ingredient_categories
			WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
		categoryID,
		tenantID,
		userID,
	); err != nil {
		return err
	}

	if err = repository.reindexCategoryIngredientsTx(ctx, tx, tenantID, userID, unassignedCategoryID); err != nil {
		return err
	}
	if err = repository.reindexCategoriesTx(ctx, tx, tenantID, userID); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (repository *SQLiteRepository) ReorderIngredientCategories(ctx context.Context, tenantID string, userID string, categoryIDs []string) error {
	tenantID = normalizeTenantID(tenantID)
	userID = normalizeUserID(userID)

	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	unassignedCategoryID, err := repository.ensureSystemCategoryTx(ctx, tx, tenantID, userID)
	if err != nil {
		return err
	}

	allRows, err := tx.QueryContext(
		ctx,
		`SELECT id, is_system
			FROM ingredient_categories
			WHERE tenant_id = ? AND user_id = ?;`,
		tenantID,
		userID,
	)
	if err != nil {
		return err
	}
	defer allRows.Close()

	nonSystemSet := make(map[string]struct{})
	for allRows.Next() {
		var categoryID string
		var isSystem int
		if scanErr := allRows.Scan(&categoryID, &isSystem); scanErr != nil {
			return scanErr
		}
		if isSystem == 1 {
			continue
		}
		nonSystemSet[categoryID] = struct{}{}
	}

	nextOrder := make([]string, 0, len(nonSystemSet)+1)
	seen := make(map[string]struct{}, len(categoryIDs))
	for _, categoryID := range categoryIDs {
		categoryID = strings.TrimSpace(categoryID)
		if categoryID == "" {
			continue
		}
		if _, duplicate := seen[categoryID]; duplicate {
			continue
		}
		if _, exists := nonSystemSet[categoryID]; !exists {
			continue
		}

		nextOrder = append(nextOrder, categoryID)
		seen[categoryID] = struct{}{}
	}

	for categoryID := range nonSystemSet {
		if _, exists := seen[categoryID]; exists {
			continue
		}
		nextOrder = append(nextOrder, categoryID)
	}

	nextOrder = append(nextOrder, unassignedCategoryID)

	for index, categoryID := range nextOrder {
		if _, err = tx.ExecContext(
			ctx,
			`UPDATE ingredient_categories
				SET category_order = ?
				WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
			index,
			categoryID,
			tenantID,
			userID,
		); err != nil {
			return err
		}
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (repository *SQLiteRepository) UpdateSettings(ctx context.Context, tenantID string, settings Settings) (Settings, error) {
	tenantID = normalizeTenantID(tenantID)

	showCompletedMeals := 0
	if settings.ShowCompletedMeals {
		showCompletedMeals = 1
	}

	_, err := repository.db.ExecContext(
		ctx,
		`INSERT INTO settings(tenant_id, daily_calorie_goal, show_completed_meals)
			VALUES(?, ?, ?)
			ON CONFLICT(tenant_id) DO UPDATE
			SET daily_calorie_goal = excluded.daily_calorie_goal,
				show_completed_meals = excluded.show_completed_meals;`,
		tenantID,
		settings.DailyCalorieGoal,
		showCompletedMeals,
	)
	if err != nil {
		return Settings{}, err
	}

	return settings, nil
}

func (repository *SQLiteRepository) ensureSystemCategory(ctx context.Context, tenantID string, userID string) (string, error) {
	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	categoryID, err := repository.ensureSystemCategoryTx(ctx, tx, tenantID, userID)
	if err != nil {
		return "", err
	}

	if err = repository.reindexCategoriesTx(ctx, tx, tenantID, userID); err != nil {
		return "", err
	}

	if err = tx.Commit(); err != nil {
		return "", err
	}

	return categoryID, nil
}

func (repository *SQLiteRepository) ensureSystemCategoryTx(ctx context.Context, tx *sql.Tx, tenantID string, userID string) (string, error) {
	var categoryID string
	err := tx.QueryRowContext(
		ctx,
		`SELECT id
			FROM ingredient_categories
			WHERE tenant_id = ? AND user_id = ? AND is_system = 1
			LIMIT 1;`,
		tenantID,
		userID,
	).Scan(&categoryID)
	if err == nil {
		return categoryID, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	nextOrder, err := repository.nextCategoryOrderTx(ctx, tx, tenantID, userID)
	if err != nil {
		return "", err
	}

	categoryID = newID("c")
	if _, err = tx.ExecContext(
		ctx,
		`INSERT INTO ingredient_categories(id, tenant_id, user_id, name, category_order, is_system)
			VALUES(?, ?, ?, 'Unassigned', ?, 1);`,
		categoryID,
		tenantID,
		userID,
		nextOrder,
	); err != nil {
		return "", err
	}

	return categoryID, nil
}

func (repository *SQLiteRepository) categoryExists(ctx context.Context, tenantID string, userID string, categoryID string) (bool, error) {
	var exists int
	err := repository.db.QueryRowContext(
		ctx,
		`SELECT 1
			FROM ingredient_categories
			WHERE id = ? AND tenant_id = ? AND user_id = ?
			LIMIT 1;`,
		categoryID,
		tenantID,
		userID,
	).Scan(&exists)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

func (repository *SQLiteRepository) categoryExistsTx(ctx context.Context, tx *sql.Tx, tenantID string, userID string, categoryID string) (bool, error) {
	var exists int
	err := tx.QueryRowContext(
		ctx,
		`SELECT 1
			FROM ingredient_categories
			WHERE id = ? AND tenant_id = ? AND user_id = ?
			LIMIT 1;`,
		categoryID,
		tenantID,
		userID,
	).Scan(&exists)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

func (repository *SQLiteRepository) nextIngredientOrder(ctx context.Context, tenantID string, userID string, categoryID string) (int, error) {
	var next sql.NullInt64
	err := repository.db.QueryRowContext(
		ctx,
		`SELECT COALESCE(MAX(ingredient_order), -1) + 1
			FROM ingredients
			WHERE tenant_id = ? AND user_id = ? AND category_id = ?;`,
		tenantID,
		userID,
		categoryID,
	).Scan(&next)
	if err != nil {
		return 0, err
	}
	if !next.Valid {
		return 0, nil
	}

	return int(next.Int64), nil
}

func (repository *SQLiteRepository) nextIngredientOrderTx(ctx context.Context, tx *sql.Tx, tenantID string, userID string, categoryID string) (int, error) {
	var next sql.NullInt64
	err := tx.QueryRowContext(
		ctx,
		`SELECT COALESCE(MAX(ingredient_order), -1) + 1
			FROM ingredients
			WHERE tenant_id = ? AND user_id = ? AND category_id = ?;`,
		tenantID,
		userID,
		categoryID,
	).Scan(&next)
	if err != nil {
		return 0, err
	}
	if !next.Valid {
		return 0, nil
	}

	return int(next.Int64), nil
}

func (repository *SQLiteRepository) nextCategoryOrderTx(ctx context.Context, tx *sql.Tx, tenantID string, userID string) (int, error) {
	var next sql.NullInt64
	err := tx.QueryRowContext(
		ctx,
		`SELECT COALESCE(MAX(category_order), -1) + 1
			FROM ingredient_categories
			WHERE tenant_id = ? AND user_id = ? AND is_system = 0;`,
		tenantID,
		userID,
	).Scan(&next)
	if err != nil {
		return 0, err
	}
	if !next.Valid {
		return 0, nil
	}

	return int(next.Int64), nil
}

func (repository *SQLiteRepository) reindexCategoryIngredientsTx(ctx context.Context, tx *sql.Tx, tenantID string, userID string, categoryID string) error {
	rows, err := tx.QueryContext(
		ctx,
		`SELECT id
			FROM ingredients
			WHERE tenant_id = ? AND user_id = ? AND category_id = ?
			ORDER BY ingredient_order, rowid;`,
		tenantID,
		userID,
		categoryID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	ingredientIDs := make([]string, 0)
	for rows.Next() {
		var ingredientID string
		if scanErr := rows.Scan(&ingredientID); scanErr != nil {
			return scanErr
		}
		ingredientIDs = append(ingredientIDs, ingredientID)
	}

	for index, ingredientID := range ingredientIDs {
		if _, execErr := tx.ExecContext(
			ctx,
			`UPDATE ingredients
				SET ingredient_order = ?
				WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
			index,
			ingredientID,
			tenantID,
			userID,
		); execErr != nil {
			return execErr
		}
	}

	return nil
}

func (repository *SQLiteRepository) reindexCategoriesTx(ctx context.Context, tx *sql.Tx, tenantID string, userID string) error {
	rows, err := tx.QueryContext(
		ctx,
		`SELECT id, is_system
			FROM ingredient_categories
			WHERE tenant_id = ? AND user_id = ?
			ORDER BY is_system, category_order, created_at;`,
		tenantID,
		userID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	nonSystemIDs := make([]string, 0)
	systemIDs := make([]string, 0)
	for rows.Next() {
		var categoryID string
		var isSystem int
		if scanErr := rows.Scan(&categoryID, &isSystem); scanErr != nil {
			return scanErr
		}
		if isSystem == 1 {
			systemIDs = append(systemIDs, categoryID)
			continue
		}
		nonSystemIDs = append(nonSystemIDs, categoryID)
	}

	index := 0
	for _, categoryID := range nonSystemIDs {
		if _, execErr := tx.ExecContext(
			ctx,
			`UPDATE ingredient_categories
				SET category_order = ?
				WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
			index,
			categoryID,
			tenantID,
			userID,
		); execErr != nil {
			return execErr
		}
		index++
	}

	for _, categoryID := range systemIDs {
		if _, execErr := tx.ExecContext(
			ctx,
			`UPDATE ingredient_categories
				SET category_order = ?
				WHERE id = ? AND tenant_id = ? AND user_id = ?;`,
			index,
			categoryID,
			tenantID,
			userID,
		); execErr != nil {
			return execErr
		}
		index++
	}

	return nil
}

func normalizeTenantID(tenantID string) string {
	normalized := strings.TrimSpace(tenantID)
	if normalized == "" {
		return DefaultTenantID
	}

	return normalized
}

func newID(prefix string) string {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		panic(fmt.Errorf("failed generating random id: %w", err))
	}

	return prefix + "-" + hex.EncodeToString(bytes)
}
