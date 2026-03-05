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

	for _, branch := range branches {
		tpls, loadErr := loadTemplateInfosFromGitHubBranch(repoURL, branch, reg.Name)
		if loadErr != nil {
			continue
		}
		reg.Templates = append(reg.Templates, tpls...)
	}

	applyPackageVersions(reg.Templates, tags)

	if err := ensureTemplatesDiscovered(reg.Templates, repoURL); err != nil {
		return nil, err
	}

	sortTemplateInfos(reg.Templates)
	return reg, nil
}
