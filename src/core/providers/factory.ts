/**
 * Provider factory — delegates to the provider registry.
 */
import type { AIProvider, ProviderType } from './types';
import { providerRegistry } from '../composition-root';

export function createProvider(type: ProviderType, apiKey: string | null): AIProvider {
  return providerRegistry.create(type, apiKey);
}
