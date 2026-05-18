/**
 * DeepSeek provider — OpenAI-compatible API.
 */
import OpenAI from 'openai';
import type { AIProvider, ProviderMessage, ProviderResponse } from './types';
import type { ToolDefinition } from '../agent/tools';
import type { ToolCall } from '../domain/types';

export class DeepSeekProvider implements AIProvider {
  readonly name = 'DeepSeek';
  readonly id = 'deepseek';
  private client: OpenAI | null = null;

  constructor(apiKey: string | null) {
    if (apiKey) {
      this.client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com', dangerouslyAllowBrowser: true });
    }
  }

  isConfigured(): boolean { return this.client !== null; }

  async chat(messages: ProviderMessage[], tools: ToolDefinition[]): Promise<ProviderResponse> {
    if (!this.client) throw new Error('DeepSeek API key not configured');

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => {
      if (m.role === 'tool' && m.toolCallId) {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        };
      }
      return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
    });

    const openaiTools = tools.length > 0 ? tools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })) : undefined;

    // First call: require tool use so the model always acts on user input.
    // Subsequent loop calls: let the model decide when to stop.
    const hasToolHistory = messages.some((m) => m.role === 'tool');
    const toolChoice = hasToolHistory ? 'auto' : 'required';

    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat', max_tokens: 4096, messages: openaiMessages,
      tools: openaiTools, tool_choice: toolChoice, temperature: 0.1,
    });
    return this.parseResponse(response);
  }

  private parseResponse(response: OpenAI.Chat.ChatCompletion): ProviderResponse {
    const choice = response.choices[0];
    const toolCalls: ToolCall[] = [];
    let textContent = '';
    if (choice?.message) {
      textContent = choice.message.content ?? '';
      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          toolCalls.push({ id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments) as Record<string, unknown> });
        }
      }
    }
    return { content: textContent, hasToolCalls: toolCalls.length > 0, toolCalls, raw: choice?.message ?? null };
  }
}
