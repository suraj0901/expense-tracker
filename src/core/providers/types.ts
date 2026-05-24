/**
 * AI Provider interface — abstraction over different AI backends.
 *
 * MVP: CloudAIProvider (Claude + Gemini)
 * Phase 2: LocalAIProvider (WebLLM + Gemma)
 */

import type { ToolDefinition } from '../agent/tools';
import type { ToolCall } from '../domain/types';

// ─── Provider Message Types ─────────────────────────────────────────────

export type ProviderMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ProviderMessage {
  role: ProviderMessageRole;
  content: string;
  toolCallId?: string; // for tool result messages
  toolCalls?: Array<{   // for assistant messages with tool calls
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
}

// ─── Provider Response ──────────────────────────────────────────────────

export interface ProviderResponse {
  /** The text content of the response */
  content: string;
  /** Whether the response includes tool calls that need execution */
  hasToolCalls: boolean;
  /** The tool calls to execute */
  toolCalls: ToolCall[];
  /** Raw provider-specific response for message history */
  raw: unknown;
}

// ─── AIProvider Interface ───────────────────────────────────────────────

export interface AIProvider {
  /** Provider display name */
  readonly name: string;
  /** Provider identifier */
  readonly id: string;

  /**
   * Send a chat completion request with conversation history and tools.
   * Handles all message types: system, user, assistant (with optional tool_calls), and tool results.
   */
  chat(
    messages: ProviderMessage[],
    tools: ToolDefinition[]
  ): Promise<ProviderResponse>;

  /** Check if the provider is configured (has API key) */
  isConfigured(): boolean;
}

// ─── Provider Settings ──────────────────────────────────────────────────

export type ProviderType = 'anthropic' | 'gemini' | 'deepseek' | 'webllm';

export interface ProviderSettings {
  activeProvider: ProviderType;
  anthropicApiKey: string | null;
  geminiApiKey: string | null;
  deepseekApiKey: string | null;
  webllmEnabled: boolean;
}

import { kvGet, kvSet } from '../platform/kv-store';

const SETTINGS_KEY = 'expense-tracker-settings';

export function loadSettings(): ProviderSettings {
  try {
    const stored = kvGet(SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored) as ProviderSettings;
    }
  } catch {
    // ignore parse errors
  }
  return {
    activeProvider: 'anthropic',
    anthropicApiKey: null,
    geminiApiKey: null,
    deepseekApiKey: null,
    webllmEnabled: false,
  };
}

export function saveSettings(settings: ProviderSettings): void {
  kvSet(SETTINGS_KEY, JSON.stringify(settings));
}
