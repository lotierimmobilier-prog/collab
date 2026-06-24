// Type declarations for Google Identity Services & GAPI loaded from CDN at runtime

declare const gapi: {
  load(lib: string, callback: () => void): void;
  client: {
    load(url: string): Promise<void>;
  };
};



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
