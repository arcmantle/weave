package app

import (
	"encoding/json"
	"strings"
)

func sanitizeTags(tags []string) []string {
	clean := make([]string, 0, len(tags))
	seen := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		normalized := strings.TrimSpace(tag)
		if normalized == "" {
			continue
		}

		if _, exists := seen[normalized]; exists {
			continue
		}

		clean = append(clean, normalized)
		seen[normalized] = struct{}{}
	}

	return clean
}

func tagsToStorage(tags []string) string {
	return strings.Join(sanitizeTags(tags), "\n")
}

func tagsFromStorage(tags string) []string {
	if strings.TrimSpace(tags) == "" {
		return make([]string, 0)
	}

	return sanitizeTags(strings.Split(tags, "\n"))
}

func sanitizeNutrients(nutrients []NutrientEntry) []NutrientEntry {
	clean := make([]NutrientEntry, 0, len(nutrients))
	for _, nutrient := range nutrients {
		key := strings.TrimSpace(nutrient.Key)
		value := strings.TrimSpace(nutrient.Value)
		unit := strings.TrimSpace(nutrient.Unit)
		if key == "" || value == "" {
			continue
		}

		clean = append(clean, NutrientEntry{
			Key:    key,
			Value:  value,
			Unit:   unit,
			Pinned: nutrient.Pinned,
		})
	}

	return clean
}

func nutrientsToStorage(nutrients []NutrientEntry) string {
	clean := sanitizeNutrients(nutrients)
	if len(clean) == 0 {
		return "[]"
	}

	encoded, err := json.Marshal(clean)
	if err != nil {
		return "[]"
	}

	return string(encoded)
}

func nutrientsFromStorage(raw string) []NutrientEntry {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return make([]NutrientEntry, 0)
	}

	decoded := make([]NutrientEntry, 0)
	if err := json.Unmarshal([]byte(trimmed), &decoded); err != nil {
		return make([]NutrientEntry, 0)
	}

	// Sanitize keys/values but preserve all fields including Pinned.
	clean := make([]NutrientEntry, 0, len(decoded))
	for _, n := range decoded {
		key := strings.TrimSpace(n.Key)
		if key == "" {
			continue
		}
		clean = append(clean, NutrientEntry{
			Key:    key,
			Value:  strings.TrimSpace(n.Value),
			Unit:   strings.TrimSpace(n.Unit),
			Pinned: n.Pinned,
		})
	}

	return clean
}

func sanitizeIngredientIDs(ingredientIDs []string) []string {
	clean := make([]string, 0, len(ingredientIDs))
	seen := make(map[string]struct{}, len(ingredientIDs))
	for _, ingredientID := range ingredientIDs {
		normalized := strings.TrimSpace(ingredientID)
		if normalized == "" {
			continue
		}

		if _, exists := seen[normalized]; exists {
			continue
		}

		clean = append(clean, normalized)
		seen[normalized] = struct{}{}
	}

	return clean
}
