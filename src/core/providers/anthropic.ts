/**
 * Anthropic Claude provider — direct browser → API calls.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, ProviderMessage, ProviderResponse } from './types';
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
    const conv: Anthropic.Messages.MessageParam[] = [];

    for (const m of messages.filter((m) => m.role !== 'system')) {
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const content: Anthropic.Messages.ContentBlockParam[] = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls) {
          content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args as Record<string, unknown> });
        }
        conv.push({ role: 'assistant', content });
      } else if (m.role === 'tool' && m.toolCallId) {
        conv.push({
          role: 'user' as const,
          content: [{ type: 'tool_result' as const, tool_use_id: m.toolCallId, content: m.content }],
        });
      } else {
        conv.push({
          role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: m.content,
        });
      }
    }

    // Force tool use on the first assistant turn only so the model
    // cannot bail before calling store_expense/store_income. After the
    // first tool call, relax to auto so the model can stop when done.
    const assistantToolTurns = messages.filter(
      (m) => m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0
    ).length;
    const toolChoice: Anthropic.Messages.ToolChoice = assistantToolTurns < 1
      ? { type: 'any' }
      : { type: 'auto' };

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 4096, temperature: 0.1,
      system: systemMsg?.content ?? '', messages: conv,
      tools: tools.map((t) => ({
        name: t.name, description: t.description,
        input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
      })),
      tool_choice: toolChoice,
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
