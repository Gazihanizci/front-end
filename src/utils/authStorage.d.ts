export type Profile = {
  kullaniciId: number;
  email: string;
};

export function onAuthTokenChanged(listener: (token: string | null) => void): () => void;

export function setTokens(tokens: {
  accessToken: string | null;
  refreshToken: string | null;
}): Promise<void>;

export function getAccessToken(): Promise<string | null>;
export function getRefreshToken(): Promise<string | null>;
export function clearTokens(): Promise<void>;

export function saveProfile(profile: Profile): Promise<void>;
export function getProfile(): Promise<Profile | null>;
export function clearProfile(): Promise<void>;

// Backward-compatible helpers
export function saveToken(token: string): Promise<void>;
export function getToken(): Promise<string | null>;
export function clearToken(): Promise<void>;
