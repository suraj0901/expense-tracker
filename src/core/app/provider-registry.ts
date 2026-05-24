/**
 * Provider registry — open/closed dispatch for AI provider factories.
 */
import type { AIProvider, ProviderType } from '../providers/types';

type ProviderFactory = (apiKey: string | null) => AIProvider;

export class ProviderRegistry {
  private factories = new Map<ProviderType, ProviderFactory>();

  register(type: ProviderType, factory: ProviderFactory): void {
    this.factories.set(type, factory);
  }

  create(type: ProviderType, apiKey: string | null): AIProvider {
    const factory = this.factories.get(type);
    if (!factory) throw new Error(`Unknown provider type: ${type}`);
    return factory(apiKey);
  }
}
