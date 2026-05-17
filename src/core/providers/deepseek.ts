/**
 * DeepSeek provider — OpenAI-compatible API.
 */
import OpenAI from 'openai';
import type { AIProvider, ProviderMessage, ProviderResponse, ProviderToolResultMessage } from './types';
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
    const openaiMessages = messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }));
    const openaiTools = tools.length > 0 ? tools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })) : undefined;
    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat', max_tokens: 1024, messages: openaiMessages,
      tools: openaiTools, tool_choice: 'required', temperature: 0.1,
    });
    return this.parseResponse(response);
  }

  async chatWithToolResults(
    messages: ProviderMessage[], toolResults: ProviderToolResultMessage[],
    tools: ToolDefinition[], assistantRaw: unknown,
  ): Promise<ProviderResponse> {
    if (!this.client) throw new Error('DeepSeek API key not configured');
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant', content: m.content,
    }));
    const rawMsg = assistantRaw as OpenAI.Chat.ChatCompletionMessage;
    if (rawMsg.tool_calls) {
      openaiMessages.push({ role: 'assistant', content: rawMsg.content, tool_calls: rawMsg.tool_calls });
    }
    for (const tr of toolResults) {
      openaiMessages.push({ role: 'tool', tool_call_id: tr.toolCallId, content: tr.content });
    }
    const openaiTools = tools.length > 0 ? tools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })) : undefined;
    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat', max_tokens: 4096, messages: openaiMessages,
      tools: openaiTools, tool_choice: 'auto', temperature: 0.1,
    });
    return this.parseResponse(response);
  }

  private parseResponse(response: OpenAI.Chat.ChatCompletion): ProviderResponse {
    const choice = response.choices[0];
    const toolCalls: ToolCall[] = []; let textContent = '';
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
