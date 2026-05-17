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
}

export interface ProviderToolResultMessage {
  role: 'tool';
  toolCallId: string;
  content: string;
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
   * Send a chat completion request.
   * @param messages - Conversation history
   * @param tools - Available tool definitions
   * @returns Provider response with optional tool calls
   */
  chat(
    messages: ProviderMessage[],
    tools: ToolDefinition[]
  ): Promise<ProviderResponse>;

  /**
   * Continue a conversation after tool execution.
   * Sends tool results back to the AI for the next response.
   */
  chatWithToolResults(
    messages: ProviderMessage[],
    toolResults: ProviderToolResultMessage[],
    tools: ToolDefinition[],
    assistantRaw: unknown
  ): Promise<ProviderResponse>;

  /** Check if the provider is configured (has API key) */
  isConfigured(): boolean;
}

// ─── Provider Settings ──────────────────────────────────────────────────

export type ProviderType = 'anthropic' | 'gemini' | 'deepseek';

export interface ProviderSettings {
  activeProvider: ProviderType;
  anthropicApiKey: string | null;
  geminiApiKey: string | null;
  deepseekApiKey: string | null;
}

const SETTINGS_KEY = 'expense-tracker-settings';

export function loadSettings(): ProviderSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
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
  };
}

export function saveSettings(settings: ProviderSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
