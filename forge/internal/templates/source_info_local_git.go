package templates

import (
	"path/filepath"
)

type localGitSourceInfoProvider struct{}

func (localGitSourceInfoProvider) LoadRegistry(repoDir string) (*Registry, error) {
	branches, err := listLocalBranches(repoDir)
	if err != nil {
		return nil, err
	}
	tags, err := listLocalTags(repoDir)
	if err != nil {
		return nil, err
	}

	reg := &Registry{
		Name:   filepath.Base(repoDir),
		Source: repoDir,
	}

	localTemplates, err := loadTemplateInfosFromLocalBranchesBatch(repoDir, branches, reg.Name)
	if err != nil {
		for _, branch := range branches {
			tpl, loadErr := loadTemplateInfoFromLocalBranch(repoDir, branch, reg.Name)
			if loadErr != nil {
				continue
			}
			reg.Templates = append(reg.Templates, tpl)
		}
	} else {
		reg.Templates = append(reg.Templates, localTemplates...)
	}

	applyPackageVersions(reg.Templates, tags)

	if err := ensureTemplatesDiscovered(reg.Templates, "local git repo "+repoDir); err != nil {
		return nil, err
	}

	sortTemplateInfos(reg.Templates)
	return reg, nil
}
