package templates

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

const githubGraphQLEndpoint = "https://api.github.com/graphql"
const githubGraphQLChunkSize = 20

type githubBranchQueryAliases struct {
	branch      string
	metaAlias   string
	readmeAlias []string
	scriptAlias map[string]string
}

type githubGraphQLResponse struct {
	Data struct {
		Repository map[string]json.RawMessage `json:"repository"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func loadTemplateInfosFromGitHubGraphQL(repoURL string, branches []string, registryName string) ([]TemplateInfo, error) {
	if len(branches) == 0 {
		return nil, nil
	}

	token, err := resolveGitHubToken()
	if err != nil {
		return nil, err
	}

	owner, repo, err := parseGitHubOwnerRepo(repoURL)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	infos := make([]TemplateInfo, 0, len(branches))

	for start := 0; start < len(branches); start += githubGraphQLChunkSize {
		end := start + githubGraphQLChunkSize
		if end > len(branches) {
			end = len(branches)
		}

		chunk := branches[start:end]
		chunkInfos, chunkErr := fetchGitHubTemplateInfosChunk(client, token, owner, repo, repoURL, chunk, registryName)
		if chunkErr != nil {
			return nil, chunkErr
		}

		infos = append(infos, chunkInfos...)
	}

	return infos, nil
}

func fetchGitHubTemplateInfosChunk(client *http.Client, token string, owner string, repo string, repoURL string, branches []string, registryName string) ([]TemplateInfo, error) {
	query, aliases := buildGitHubTemplateInfoQuery(branches)

	body, err := json.Marshal(map[string]any{
		"query": query,
		"variables": map[string]any{
			"owner": owner,
			"name":  repo,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("encoding github graphql request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, githubGraphQLEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("creating github graphql request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "forge-template-loader")

	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling github graphql: %w", err)
	}
	defer res.Body.Close()

	resBody, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("reading github graphql response: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("github graphql status %d: %s", res.StatusCode, strings.TrimSpace(string(resBody)))
	}

	var parsed githubGraphQLResponse
	if err := json.Unmarshal(resBody, &parsed); err != nil {
		return nil, fmt.Errorf("parsing github graphql response: %w", err)
	}

	if len(parsed.Errors) > 0 {
		return nil, fmt.Errorf("github graphql error: %s", parsed.Errors[0].Message)
	}

	if parsed.Data.Repository == nil {
		return nil, fmt.Errorf("github graphql repository data missing")
	}

	infos := make([]TemplateInfo, 0, len(aliases))
	for _, alias := range aliases {
		var meta TemplateMeta
		if metaText, ok := githubGraphQLBlobText(parsed.Data.Repository, alias.metaAlias); ok {
			if err := yaml.Unmarshal([]byte(metaText), &meta); err != nil {
				return nil, fmt.Errorf("parsing template metadata in branch %s: %w", alias.branch, err)
			}
		}

		description := strings.TrimSpace(meta.Description)
		if description == "" {
			for _, readmeAlias := range alias.readmeAlias {
				text, ok := githubGraphQLBlobText(parsed.Data.Repository, readmeAlias)
				if !ok {
					continue
				}

				summary := extractReadmeSummary([]byte(text))
				if summary != "" {
					description = summary
					break
				}
			}
		}
		if description == "" {
			description = fmt.Sprintf("Template from branch %s", alias.branch)
		}

		var langs []string
		for _, lang := range []string{"go", "ts", "cs"} {
			if githubGraphQLObjectExists(parsed.Data.Repository, alias.scriptAlias[lang]) {
				langs = append(langs, lang)
			}
		}

		infos = append(infos, TemplateInfo{
			Name:        alias.branch,
			Description: description,
			Languages:   langs,
			Variables:   meta.Variables,
			Source:      registryName,
			Registry:    repoURL,
			SourceType:  "github-git",
		})
	}

	return infos, nil
}

func buildGitHubTemplateInfoQuery(branches []string) (string, []githubBranchQueryAliases) {
	aliases := make([]githubBranchQueryAliases, 0, len(branches))
	builder := &strings.Builder{}
	builder.WriteString("query($owner:String!, $name:String!) { repository(owner:$owner, name:$name) {")

	for i, branch := range branches {
		metaAlias := fmt.Sprintf("b%d_meta", i)
		readme1 := fmt.Sprintf("b%d_readme1", i)
		readme2 := fmt.Sprintf("b%d_readme2", i)
		readme3 := fmt.Sprintf("b%d_readme3", i)
		goAlias := fmt.Sprintf("b%d_go", i)
		tsAlias := fmt.Sprintf("b%d_ts", i)
		csAlias := fmt.Sprintf("b%d_cs", i)

		aliases = append(aliases, githubBranchQueryAliases{
			branch:      branch,
			metaAlias:   metaAlias,
			readmeAlias: []string{readme1, readme2, readme3},
			scriptAlias: map[string]string{"go": goAlias, "ts": tsAlias, "cs": csAlias},
		})

		metaExpr := branch + ":template.yaml"
		readmeExpr1 := branch + ":README.md"
		readmeExpr2 := branch + ":Readme.md"
		readmeExpr3 := branch + ":readme.md"
		goExpr := fmt.Sprintf("%s:%s.go", branch, branch)
		tsExpr := fmt.Sprintf("%s:%s.ts", branch, branch)
		csExpr := fmt.Sprintf("%s:%s.cs", branch, branch)

		builder.WriteString(fmt.Sprintf(" %s: object(expression: %q) { ... on Blob { text } }", metaAlias, metaExpr))
		builder.WriteString(fmt.Sprintf(" %s: object(expression: %q) { ... on Blob { text } }", readme1, readmeExpr1))
		builder.WriteString(fmt.Sprintf(" %s: object(expression: %q) { ... on Blob { text } }", readme2, readmeExpr2))
		builder.WriteString(fmt.Sprintf(" %s: object(expression: %q) { ... on Blob { text } }", readme3, readmeExpr3))
		builder.WriteString(fmt.Sprintf(" %s: object(expression: %q) { ... on Blob { oid } }", goAlias, goExpr))
		builder.WriteString(fmt.Sprintf(" %s: object(expression: %q) { ... on Blob { oid } }", tsAlias, tsExpr))
		builder.WriteString(fmt.Sprintf(" %s: object(expression: %q) { ... on Blob { oid } }", csAlias, csExpr))
	}

	builder.WriteString(" } }")
	return builder.String(), aliases
}

func githubGraphQLBlobText(objects map[string]json.RawMessage, alias string) (string, bool) {
	raw, ok := objects[alias]
	if !ok || len(raw) == 0 || string(raw) == "null" {
		return "", false
	}

	var blob struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &blob); err != nil {
		return "", false
	}

	return blob.Text, true
}

func githubGraphQLObjectExists(objects map[string]json.RawMessage, alias string) bool {
	raw, ok := objects[alias]
	return ok && len(raw) > 0 && string(raw) != "null"
}

func parseGitHubOwnerRepo(repoURL string) (string, string, error) {
	u, err := url.Parse(repoURL)
	if err != nil {
		return "", "", fmt.Errorf("parsing github repo url %s: %w", repoURL, err)
	}

	parts := strings.Split(strings.Trim(strings.TrimSpace(u.Path), "/"), "/")
	if len(parts) < 2 {
		return "", "", fmt.Errorf("invalid github repo path in %s", repoURL)
	}

	owner := strings.TrimSpace(parts[0])
	repo := strings.TrimSpace(strings.TrimSuffix(parts[1], ".git"))
	if owner == "" || repo == "" {
		return "", "", fmt.Errorf("invalid github owner/repo in %s", repoURL)
	}

	return owner, repo, nil
}
