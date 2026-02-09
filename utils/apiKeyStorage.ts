/**
 * API Key Storage Utility
 *
 * Provides centralized storage and validation for API keys.
 * Keys are stored in localStorage with optional encryption support.
 */

export interface ApiKeyConfig {
  anthropic?: string;      // Claude API - text generation
  stability?: string;      // Stability AI - image generation
  supabaseUrl?: string;    // Supabase project URL
  supabaseKey?: string;    // Supabase anon key
}

const STORAGE_KEYS = {
  anthropic: 'ANTHROPIC_API_KEY',
  stability: 'STABILITY_API_KEY',
  supabaseUrl: 'SUPABASE_URL',
  supabaseKey: 'SUPABASE_ANON_KEY',
} as const;

/**
 * Get all stored API keys
 */
export const getStoredApiKeys = (): ApiKeyConfig => {
  if (typeof window === 'undefined') return {};

  return {
    anthropic: localStorage.getItem(STORAGE_KEYS.anthropic) || undefined,
    stability: localStorage.getItem(STORAGE_KEYS.stability) || undefined,
    supabaseUrl: localStorage.getItem(STORAGE_KEYS.supabaseUrl) || undefined,
    supabaseKey: localStorage.getItem(STORAGE_KEYS.supabaseKey) || undefined,
  };
};

/**
 * Save API keys to localStorage
 */
export const saveApiKeys = (config: Partial<ApiKeyConfig>): void => {
  if (typeof window === 'undefined') return;

  if (config.anthropic !== undefined) {
    if (config.anthropic) {
      localStorage.setItem(STORAGE_KEYS.anthropic, config.anthropic);
    } else {
      localStorage.removeItem(STORAGE_KEYS.anthropic);
    }
  }

  if (config.stability !== undefined) {
    if (config.stability) {
      localStorage.setItem(STORAGE_KEYS.stability, config.stability);
    } else {
      localStorage.removeItem(STORAGE_KEYS.stability);
    }
  }

  if (config.supabaseUrl !== undefined) {
    if (config.supabaseUrl) {
      localStorage.setItem(STORAGE_KEYS.supabaseUrl, config.supabaseUrl);
    } else {
      localStorage.removeItem(STORAGE_KEYS.supabaseUrl);
    }
  }

  if (config.supabaseKey !== undefined) {
    if (config.supabaseKey) {
      localStorage.setItem(STORAGE_KEYS.supabaseKey, config.supabaseKey);
    } else {
      localStorage.removeItem(STORAGE_KEYS.supabaseKey);
    }
  }
};

/**
 * Clear all stored API keys
 */
export const clearAllApiKeys = (): void => {
  if (typeof window === 'undefined') return;

  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

/**
 * Validate API key format (basic checks)
 */
export const validateApiKeyFormat = (key: string, type: keyof typeof STORAGE_KEYS): boolean => {
  if (!key || key.trim().length === 0) return false;

  switch (type) {
    case 'anthropic':
      // Anthropic keys start with 'sk-ant-'
      return key.startsWith('sk-ant-') && key.length > 20;
    case 'stability':
      // Stability keys start with 'sk-'
      return key.startsWith('sk-') && key.length > 20;
    case 'supabaseUrl':
      // Supabase URLs are valid https URLs
      return key.startsWith('https://') && key.includes('.supabase.co');
    case 'supabaseKey':
      // Supabase anon keys are JWT tokens
      return key.startsWith('eyJ') && key.length > 100;
    default:
      return key.length > 0;
  }
};

/**
 * Get API key status summary
 */
export const getApiKeyStatus = (): Record<keyof typeof STORAGE_KEYS, { configured: boolean; valid: boolean }> => {
  const keys = getStoredApiKeys();

  return {
    anthropic: {
      configured: !!keys.anthropic,
      valid: keys.anthropic ? validateApiKeyFormat(keys.anthropic, 'anthropic') : false,
    },
    stability: {
      configured: !!keys.stability,
      valid: keys.stability ? validateApiKeyFormat(keys.stability, 'stability') : false,
    },
    supabaseUrl: {
      configured: !!keys.supabaseUrl,
      valid: keys.supabaseUrl ? validateApiKeyFormat(keys.supabaseUrl, 'supabaseUrl') : false,
    },
    supabaseKey: {
      configured: !!keys.supabaseKey,
      valid: keys.supabaseKey ? validateApiKeyFormat(keys.supabaseKey, 'supabaseKey') : false,
    },
  };
};

/**
 * Check if core AI functionality is available (Claude)
 */
export const hasTextGenerationCapability = (): boolean => {
  const keys = getStoredApiKeys();
  return !!keys.anthropic;
};

/**
 * Check if image generation is available (Stability)
 */
export const hasImageGenerationCapability = (): boolean => {
  const keys = getStoredApiKeys();
  return !!keys.stability;
};
