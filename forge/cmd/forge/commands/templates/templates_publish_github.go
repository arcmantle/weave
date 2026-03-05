package templates

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type githubRepoCoordinates struct {
	Owner string
	Name  string
}

type githubUserResponse struct {
	Login string `json:"login"`
}

type githubRepoResponse struct {
	DefaultBranch string `json:"default_branch"`
}

type githubBranchResponse struct {
	Commit struct {
		SHA string `json:"sha"`
	} `json:"commit"`
}

type githubCreateRefRequest struct {
	Ref string `json:"ref"`
	SHA string `json:"sha"`
}

type githubCreatePullRequestRequest struct {
	Title string `json:"title"`
	Head  string `json:"head"`
	Base  string `json:"base"`
	Body  string `json:"body,omitempty"`
}

type githubCreatePullRequestResponse struct {
	Number  int    `json:"number"`
	HTMLURL string `json:"html_url"`
}

type githubErrorResponse struct {
	Message string `json:"message"`
}

func parseGitHubRepoCoordinates(raw string) (githubRepoCoordinates, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return githubRepoCoordinates{}, false
	}

	if strings.HasPrefix(trimmed, "git@github.com:") {
		repoPath := strings.TrimPrefix(trimmed, "git@github.com:")
		repoPath = strings.TrimSuffix(repoPath, ".git")
		parts := strings.Split(strings.Trim(repoPath, "/"), "/")
		if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
			return githubRepoCoordinates{}, false
		}
		return githubRepoCoordinates{Owner: parts[0], Name: parts[1]}, true
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return githubRepoCoordinates{}, false
	}

	host := strings.ToLower(parsed.Host)
	if host != "github.com" {
		return githubRepoCoordinates{}, false
	}

	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return githubRepoCoordinates{}, false
	}

	name := strings.TrimSuffix(parts[1], ".git")
	if name == "" {
		return githubRepoCoordinates{}, false
	}

	return githubRepoCoordinates{Owner: parts[0], Name: name}, true
}

func githubGetAuthenticatedLogin(token string) (string, error) {
	payload, _, err := githubRequest(token, http.MethodGet, "/user", nil, http.StatusOK)
	if err != nil {
		return "", err
	}

	var response githubUserResponse
	if err := json.Unmarshal(payload, &response); err != nil {
		return "", fmt.Errorf("decoding github user response: %w", err)
	}

	login := strings.TrimSpace(response.Login)
	if login == "" {
		return "", fmt.Errorf("github user login is empty")
	}

	return login, nil
}

func githubEnsureScopeBranch(token string, repo githubRepoCoordinates, scopeBranch string) error {
	exists, err := githubBranchExists(token, repo, scopeBranch)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	defaultBranch, defaultSHA, err := githubDefaultBranchHead(token, repo)
	if err != nil {
		return err
	}
	if strings.TrimSpace(defaultBranch) == "" || strings.TrimSpace(defaultSHA) == "" {
		return fmt.Errorf("unable to resolve default branch head for %s/%s", repo.Owner, repo.Name)
	}

	requestBody := githubCreateRefRequest{
		Ref: "refs/heads/" + scopeBranch,
		SHA: defaultSHA,
	}

	_, status, err := githubRequest(token, http.MethodPost, "/repos/"+repo.Owner+"/"+repo.Name+"/git/refs", requestBody, http.StatusCreated, http.StatusUnprocessableEntity)
	if err != nil {
		return err
	}
	if status == http.StatusUnprocessableEntity {
		return nil
	}

	return nil
}

func githubBranchExists(token string, repo githubRepoCoordinates, branch string) (bool, error) {
	_, status, err := githubRequest(token, http.MethodGet, "/repos/"+repo.Owner+"/"+repo.Name+"/branches/"+url.PathEscape(branch), nil, http.StatusOK, http.StatusNotFound)
	if err != nil {
		return false, err
	}

	return status == http.StatusOK, nil
}

func githubDefaultBranchHead(token string, repo githubRepoCoordinates) (string, string, error) {
	repoPayload, _, err := githubRequest(token, http.MethodGet, "/repos/"+repo.Owner+"/"+repo.Name, nil, http.StatusOK)
	if err != nil {
		return "", "", err
	}

	var repoResponse githubRepoResponse
	if err := json.Unmarshal(repoPayload, &repoResponse); err != nil {
		return "", "", fmt.Errorf("decoding github repo response: %w", err)
	}

	defaultBranch := strings.TrimSpace(repoResponse.DefaultBranch)
	if defaultBranch == "" {
		return "", "", fmt.Errorf("github repository %s/%s has empty default branch", repo.Owner, repo.Name)
	}

	branchPayload, _, err := githubRequest(token, http.MethodGet, "/repos/"+repo.Owner+"/"+repo.Name+"/branches/"+url.PathEscape(defaultBranch), nil, http.StatusOK)
	if err != nil {
		return "", "", err
	}

	var branchResponse githubBranchResponse
	if err := json.Unmarshal(branchPayload, &branchResponse); err != nil {
		return "", "", fmt.Errorf("decoding github branch response: %w", err)
	}

	return defaultBranch, strings.TrimSpace(branchResponse.Commit.SHA), nil
}

func githubCreatePullRequest(token string, repo githubRepoCoordinates, title string, head string, base string, body string) (int, string, error) {
	requestBody := githubCreatePullRequestRequest{
		Title: title,
		Head:  head,
		Base:  base,
		Body:  body,
	}

	payload, _, err := githubRequest(token, http.MethodPost, "/repos/"+repo.Owner+"/"+repo.Name+"/pulls", requestBody, http.StatusCreated)
	if err != nil {
		return 0, "", err
	}

	var response githubCreatePullRequestResponse
	if err := json.Unmarshal(payload, &response); err != nil {
		return 0, "", fmt.Errorf("decoding github create pull request response: %w", err)
	}

	if response.Number <= 0 {
		return 0, "", fmt.Errorf("github did not return a pull request number")
	}

	return response.Number, strings.TrimSpace(response.HTMLURL), nil
}

func githubRequest(token string, method string, endpoint string, body any, expectedStatuses ...int) ([]byte, int, error) {
	requestURL := "https://api.github.com" + endpoint

	var payload io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, 0, fmt.Errorf("encoding github request body: %w", err)
		}
		payload = bytes.NewReader(encoded)
	}

	request, err := http.NewRequest(method, requestURL, payload)
	if err != nil {
		return nil, 0, fmt.Errorf("creating github request: %w", err)
	}

	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	client := &http.Client{Timeout: 20 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, 0, fmt.Errorf("calling github api %s %s: %w", method, endpoint, err)
	}
	defer response.Body.Close()

	responseBody, readErr := io.ReadAll(response.Body)
	if readErr != nil {
		return nil, response.StatusCode, fmt.Errorf("reading github api response %s %s: %w", method, endpoint, readErr)
	}

	for _, status := range expectedStatuses {
		if response.StatusCode == status {
			return responseBody, response.StatusCode, nil
		}
	}

	message := strings.TrimSpace(string(responseBody))
	var githubError githubErrorResponse
	if err := json.Unmarshal(responseBody, &githubError); err == nil && strings.TrimSpace(githubError.Message) != "" {
		message = strings.TrimSpace(githubError.Message)
	}
	if message == "" {
		message = "unexpected github api response"
	}

	return nil, response.StatusCode, fmt.Errorf("github api %s %s failed (%s): %s", method, endpoint, strconv.Itoa(response.StatusCode), message)
}

func sanitizeGitRefSegment(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return "publish"
	}

	builder := &strings.Builder{}
	lastDash := false
	for _, r := range trimmed {
		isAlpha := r >= 'a' && r <= 'z'
		isDigit := r >= '0' && r <= '9'
		if isAlpha || isDigit {
			builder.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteRune('-')
			lastDash = true
		}
	}

	sanitized := strings.Trim(builder.String(), "-")
	if sanitized == "" {
		return "publish"
	}

	return sanitized
}

func githubPublishHeadBranch(actorLogin string, templateName string) string {
	return fmt.Sprintf(
		"publish/%s/%s-%d",
		sanitizeGitRefSegment(actorLogin),
		sanitizeGitRefSegment(templateName),
		time.Now().Unix(),
	)
}
