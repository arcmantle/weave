package templates

import (
	"fmt"
	"sort"
)

func applyPackageVersions(templates []TemplateInfo, tags []string) {
	baseByName := map[string]TemplateInfo{}
	for _, tpl := range templates {
		baseByName[tpl.Name] = tpl
	}

	versionsByPackage := map[string][]string{}
	for _, tag := range tags {
		pkg, version, ok := parsePackageTagRef(tag)
		if !ok {
			continue
		}

		if _, ok := baseByName[pkg]; !ok {
			continue
		}

		seen := false
		for _, existing := range versionsByPackage[pkg] {
			if existing == version {
				seen = true
				break
			}
		}
		if !seen {
			versionsByPackage[pkg] = append(versionsByPackage[pkg], version)
		}
	}

	for i := range templates {
		versions := versionsByPackage[templates[i].Name]
		if len(versions) == 0 {
			continue
		}
		templates[i].LatestTag = versions[0]
		templates[i].Versions = append([]string{}, versions...)
	}
}

func sortTemplateInfos(templates []TemplateInfo) {
	sort.Slice(templates, func(i, j int) bool {
		return templates[i].Name < templates[j].Name
	})
}

func ensureTemplatesDiscovered(templates []TemplateInfo, source string) error {
	if len(templates) > 0 {
		return nil
	}

	return fmt.Errorf("no templates discovered from branches in %s", source)
}
