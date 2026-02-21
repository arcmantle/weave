export interface LoginRequest {
	username: string;
}

export interface LoginResponse {
	token: string;
	username: string;
	expiresAt: Date;
}

export interface UserInfo {
	username: string;
}

export interface LoginResult {
	success: boolean;
	error?: string;
}
