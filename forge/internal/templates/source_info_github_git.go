package templates

type githubGitSourceInfoProvider struct{}

func (githubGitSourceInfoProvider) LoadRegistry(repoURL string) (*Registry, error) {
	branches, err := listRemoteBranches(repoURL)
	if err != nil {
		return nil, err
	}
	tags, err := listRemoteTags(repoURL)
	if err != nil {
		return nil, err
	}

	reg := &Registry{
		Name:   registryDisplayName(repoURL),
		Source: repoURL,
	}

	graphqlTemplates, graphqlErr := loadTemplateInfosFromGitHubGraphQL(repoURL, branches, reg.Name)
	if graphqlErr == nil {
		reg.Templates = append(reg.Templates, graphqlTemplates...)
	} else {
		for _, branch := range branches {
			tpl, loadErr := loadTemplateInfoFromBranch(repoURL, branch, reg.Name)
			if loadErr != nil {
				continue
			}
			reg.Templates = append(reg.Templates, tpl)
		}
	}

	applyPackageVersions(reg.Templates, tags)

	if err := ensureTemplatesDiscovered(reg.Templates, repoURL); err != nil {
		return nil, err
	}

	sortTemplateInfos(reg.Templates)
	return reg, nil
}
