/**
 * Provider factory — creates the correct AIProvider for a given type.
 */
import type { AIProvider, ProviderType } from './types';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { DeepSeekProvider } from './deepseek';
import { LocalAIProvider } from './local';

export function createProvider(type: ProviderType, apiKey: string | null): AIProvider {
  switch (type) {
    case 'anthropic': return new AnthropicProvider(apiKey);
    case 'gemini': return new GeminiProvider(apiKey);
    case 'deepseek': return new DeepSeekProvider(apiKey);
    case 'webllm': return new LocalAIProvider();
    default: throw new Error(`Unknown provider type: ${type}`);
  }
}
