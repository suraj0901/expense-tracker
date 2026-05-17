/**
 * Anthropic Claude provider — direct browser → API calls.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, ProviderMessage, ProviderResponse, ProviderToolResultMessage } from './types';
import type { ToolDefinition } from '../agent/tools';
import type { ToolCall } from '../domain/types';

export class AnthropicProvider implements AIProvider {
  readonly name = 'Claude';
  readonly id = 'anthropic';
  private client: Anthropic | null = null;

  constructor(apiKey: string | null) {
    if (apiKey) {
      this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    }
  }

  isConfigured(): boolean { return this.client !== null; }

  async chat(messages: ProviderMessage[], tools: ToolDefinition[]): Promise<ProviderResponse> {
    if (!this.client) throw new Error('Anthropic API key not configured');
    const systemMsg = messages.find((m) => m.role === 'system');
    const conv = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }));
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1024,
      system: systemMsg?.content ?? '', messages: conv,
      tools: tools.map((t) => ({
        name: t.name, description: t.description,
        input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
      })),
    });
    return this.parseResponse(response);
  }

  async chatWithToolResults(
    messages: ProviderMessage[], toolResults: ProviderToolResultMessage[],
    tools: ToolDefinition[], assistantRaw: unknown,
  ): Promise<ProviderResponse> {
    if (!this.client) throw new Error('Anthropic API key not configured');
    const systemMsg = messages.find((m) => m.role === 'system');
    const conv: Anthropic.Messages.MessageParam[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }));
    const raw = assistantRaw as Anthropic.Messages.Message;
    conv.push({ role: 'assistant', content: raw.content });
    conv.push({ role: 'user', content: toolResults.map((tr) => ({
      type: 'tool_result' as const, tool_use_id: tr.toolCallId, content: tr.content,
    }))});
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1024,
      system: systemMsg?.content ?? '', messages: conv,
      tools: tools.map((t) => ({
        name: t.name, description: t.description,
        input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
      })),
    });
    return this.parseResponse(response);
  }

  private parseResponse(response: Anthropic.Messages.Message): ProviderResponse {
    const toolCalls: ToolCall[] = [];
    let textContent = '';
    for (const block of response.content) {
      if (block.type === 'text') textContent += block.text;
      else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, args: block.input as Record<string, unknown> });
      }
    }
    return { content: textContent, hasToolCalls: toolCalls.length > 0, toolCalls, raw: response };
  }
}
