package templates

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

const githubDeviceCodeEndpoint = "https://github.com/login/device/code"
const githubDeviceTokenEndpoint = "https://github.com/login/oauth/access_token"
const githubDeviceGrantType = "urn:ietf:params:oauth:grant-type:device_code"

var defaultGitHubOAuthClientID = "Ov23li6AmpcHbq2oYds6"

func DefaultGitHubOAuthClientID() string {
	return strings.TrimSpace(defaultGitHubOAuthClientID)
}

type githubDeviceCodeResponse struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}

type githubDeviceTokenResponse struct {
	AccessToken      string `json:"access_token"`
	TokenType        string `json:"token_type"`
	Scope            string `json:"scope"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

func LoginGitHubWithDeviceFlow(clientID string, scopes []string, openBrowser bool) (string, error) {
	trimmedClientID := strings.TrimSpace(clientID)
	if trimmedClientID == "" {
		return "", fmt.Errorf("empty github oauth client id")
	}

	requestData := url.Values{}
	requestData.Set("client_id", trimmedClientID)
	scope := strings.Join(scopes, " ")
	if strings.TrimSpace(scope) != "" {
		requestData.Set("scope", scope)
	}

	devicePayload, err := githubOAuthFormPOST(githubDeviceCodeEndpoint, requestData)
	if err != nil {
		return "", err
	}

	var deviceCode githubDeviceCodeResponse
	if err := json.Unmarshal(devicePayload, &deviceCode); err != nil {
		return "", fmt.Errorf("decoding github device code response: %w", err)
	}

	if strings.TrimSpace(deviceCode.DeviceCode) == "" || strings.TrimSpace(deviceCode.UserCode) == "" {
		return "", fmt.Errorf("github device flow response missing required fields")
	}

	verificationURL := strings.TrimSpace(deviceCode.VerificationURIComplete)
	if verificationURL == "" {
		verificationURL = strings.TrimSpace(deviceCode.VerificationURI)
	}

	fmt.Fprintf(os.Stderr, "forge: GitHub browser authentication started.\n")
	if verificationURL != "" {
		fmt.Fprintf(os.Stderr, "forge: verification URL: %s\n", verificationURL)
	}
	fmt.Fprintf(os.Stderr, "forge: user code: %s\n", strings.TrimSpace(deviceCode.UserCode))

	if openBrowser && verificationURL != "" {
		if err := openBrowserURL(verificationURL); err != nil {
			fmt.Fprintf(os.Stderr, "forge: unable to open browser automatically (%v).\n", err)
		}
	}

	pollInterval := deviceCode.Interval
	if pollInterval <= 0 {
		pollInterval = 5
	}
	deadline := time.Now().Add(time.Duration(maxInt(deviceCode.ExpiresIn, 900)) * time.Second)

	for time.Now().Before(deadline) {
		time.Sleep(time.Duration(pollInterval) * time.Second)

		tokenData := url.Values{}
		tokenData.Set("client_id", trimmedClientID)
		tokenData.Set("device_code", strings.TrimSpace(deviceCode.DeviceCode))
		tokenData.Set("grant_type", githubDeviceGrantType)

		tokenPayload, err := githubOAuthFormPOST(githubDeviceTokenEndpoint, tokenData)
		if err != nil {
			return "", err
		}

		var tokenResponse githubDeviceTokenResponse
		if err := json.Unmarshal(tokenPayload, &tokenResponse); err != nil {
			return "", fmt.Errorf("decoding github device token response: %w", err)
		}

		if token := strings.TrimSpace(tokenResponse.AccessToken); token != "" {
			if err := SaveGitHubToken(token); err != nil {
				return "", err
			}
			fmt.Fprintln(os.Stderr, "forge: GitHub token saved.")
			return token, nil
		}

		switch strings.TrimSpace(tokenResponse.Error) {
		case "authorization_pending":
			continue
		case "slow_down":
			pollInterval += 5
			continue
		case "access_denied":
			return "", fmt.Errorf("github authorization denied by user")
		case "expired_token":
			return "", fmt.Errorf("github device code expired before authorization completed")
		case "":
			return "", fmt.Errorf("github authorization did not return an access token")
		default:
			description := strings.TrimSpace(tokenResponse.ErrorDescription)
			if description == "" {
				description = "unknown error"
			}
			return "", fmt.Errorf("github authorization failed: %s (%s)", tokenResponse.Error, description)
		}
	}

	return "", fmt.Errorf("github authorization timed out")
}

func githubOAuthFormPOST(endpoint string, formData url.Values) ([]byte, error) {
	request, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, fmt.Errorf("creating github oauth request: %w", err)
	}

	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 20 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("calling github oauth endpoint %s: %w", endpoint, err)
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("reading github oauth response %s: %w", endpoint, err)
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message := strings.TrimSpace(string(payload))
		if message == "" {
			message = "unexpected response"
		}
		return nil, fmt.Errorf("github oauth endpoint %s failed (%d): %s", endpoint, response.StatusCode, message)
	}

	return payload, nil
}

func openBrowserURL(rawURL string) error {
	trimmedURL := strings.TrimSpace(rawURL)
	if trimmedURL == "" {
		return fmt.Errorf("empty browser URL")
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", trimmedURL)
	case "darwin":
		cmd = exec.Command("open", trimmedURL)
	case "linux":
		cmd = exec.Command("xdg-open", trimmedURL)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	return nil
}

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
}
