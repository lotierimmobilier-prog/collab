// Type declarations for Google Identity Services loaded from CDN at runtime

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenResponse {
        access_token: string;
        expires_in: string;
        token_type: string;
        scope: string;
        error?: string;
      }

      interface TokenClientConfig {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }

      interface TokenClient {
        requestAccessToken(options?: { prompt?: string }): void;
      }

      function initTokenClient(config: TokenClientConfig): TokenClient;
    }
  }
}
