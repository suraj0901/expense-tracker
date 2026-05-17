/**
 * Cloud AI Provider — Anthropic Claude implementation.
 *
 * Direct browser → Anthropic API calls using the user's own key.
 * No proxy server needed.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  ProviderMessage,
  ProviderResponse,
  ProviderToolResultMessage,
  ProviderType,
} from './types';
import type { ToolDefinition } from '../agent/tools';
import type { ToolCall } from '../domain/types';
import { nanoid } from 'nanoid';

export class AnthropicProvider implements AIProvider {
  readonly name = 'Claude';
  readonly id = 'anthropic';
  private client: Anthropic | null = null;
  private apiKey: string | null = null;

  constructor(apiKey: string | null) {
    this.apiKey = apiKey;
    if (apiKey) {
      this.client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
      });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async chat(
    messages: ProviderMessage[],
    tools: ToolDefinition[]
  ): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error('Anthropic API key not configured');
    }

    // Separate system message from conversation
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map(this.toAnthropicMessage);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemMessage?.content ?? '',
      messages: conversationMessages,
      tools: tools.map(this.toAnthropicTool),
    });

    return this.parseResponse(response);
  }

  async chatWithToolResults(
    messages: ProviderMessage[],
    toolResults: ProviderToolResultMessage[],
    tools: ToolDefinition[],
    assistantRaw: unknown
  ): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error('Anthropic API key not configured');
    }

    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map(this.toAnthropicMessage);

    // Add the assistant response with tool use
    const rawResponse = assistantRaw as Anthropic.Messages.Message;
    conversationMessages.push({
      role: 'assistant',
      content: rawResponse.content,
    });

    // Add tool results
    conversationMessages.push({
      role: 'user',
      content: toolResults.map((tr) => ({
        type: 'tool_result' as const,
        tool_use_id: tr.toolCallId,
        content: tr.content,
      })),
    });

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemMessage?.content ?? '',
      messages: conversationMessages,
      tools: tools.map(this.toAnthropicTool),
    });

    return this.parseResponse(response);
  }

  private toAnthropicMessage(
    msg: ProviderMessage
  ): Anthropic.Messages.MessageParam {
    return {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    };
  }

  private toAnthropicTool(
    tool: ToolDefinition
  ): Anthropic.Messages.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Messages.Tool.InputSchema,
    };
  }

  private parseResponse(
    response: Anthropic.Messages.Message
  ): ProviderResponse {
    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          args: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content: textContent,
      hasToolCalls: toolCalls.length > 0,
      toolCalls,
      raw: response,
    };
  }
}

/**
 * Google Gemini implementation.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  FunctionDeclarationsTool,
  GenerateContentResult,
  Content,
  Part,
} from '@google/generative-ai';

export class GeminiProvider implements AIProvider {
  readonly name = 'Gemini';
  readonly id = 'gemini';
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey: string | null) {
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async chat(
    messages: ProviderMessage[],
    tools: ToolDefinition[]
  ): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error('Gemini API key not configured');
    }

    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const geminiTools: FunctionDeclarationsTool[] = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters as FunctionDeclarationsTool['functionDeclarations'][0]['parameters'],
        })),
      },
    ];

    const model = this.client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemMessage?.content,
      tools: geminiTools,
    });

    const contents: Content[] = conversationMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await model.generateContent({ contents });

    return this.parseGeminiResponse(response);
  }

  async chatWithToolResults(
    messages: ProviderMessage[],
    toolResults: ProviderToolResultMessage[],
    tools: ToolDefinition[],
    assistantRaw: unknown
  ): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error('Gemini API key not configured');
    }

    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const geminiTools: FunctionDeclarationsTool[] = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters as FunctionDeclarationsTool['functionDeclarations'][0]['parameters'],
        })),
      },
    ];

    const model = this.client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemMessage?.content,
      tools: geminiTools,
    });

    // Build contents with prior conversation
    const contents: Content[] = conversationMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // Add assistant's function call response
    const raw = assistantRaw as { functionCalls: { name: string; args: Record<string, unknown> }[] };
    if (raw.functionCalls) {
      const functionCallParts: Part[] = raw.functionCalls.map((fc) => ({
        functionCall: { name: fc.name, args: fc.args },
      }));
      contents.push({
        role: 'model',
        parts: functionCallParts,
      });
    }

    // Add tool results as function responses
    const functionResponseParts: Part[] = toolResults.map((tr) => ({
      functionResponse: {
        name: tr.toolCallId,
        response: JSON.parse(tr.content),
      },
    }));
    contents.push({
      role: 'user',
      parts: functionResponseParts,
    });

    const response = await model.generateContent({ contents });

    return this.parseGeminiResponse(response);
  }

  private parseGeminiResponse(response: GenerateContentResult): ProviderResponse {
    const toolCalls: ToolCall[] = [];
    let textContent = '';

    const candidate = response.response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          textContent += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: nanoid(),
            name: part.functionCall.name,
            args: (part.functionCall.args ?? {}) as Record<string, unknown>,
          });
        }
      }
    }

    return {
      content: textContent,
      hasToolCalls: toolCalls.length > 0,
      toolCalls,
      raw: {
        functionCalls: toolCalls.map((tc) => ({
          name: tc.name,
          args: tc.args,
        })),
      },
    };
  }
}

// ─── DeepSeek Provider ──────────────────────────────────────────────────

import OpenAI from 'openai';

export class DeepSeekProvider implements AIProvider {
  readonly name = 'DeepSeek';
  readonly id = 'deepseek';
  private client: OpenAI | null = null;

  constructor(apiKey: string | null) {
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com',
        dangerouslyAllowBrowser: true,
      });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async chat(
    messages: ProviderMessage[],
    tools: ToolDefinition[]
  ): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error('DeepSeek API key not configured');
    }

    const openaiMessages = messages.map(this.toOpenAIMessage);
    const openaiTools = tools.length > 0 ? tools.map(this.toOpenAITool) : undefined;

    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 1024,
      messages: openaiMessages,
      tools: openaiTools,
    });

    return this.parseResponse(response);
  }

  async chatWithToolResults(
    messages: ProviderMessage[],
    toolResults: ProviderToolResultMessage[],
    tools: ToolDefinition[],
    assistantRaw: unknown
  ): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error('DeepSeek API key not configured');
    }

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
      messages.map(this.toOpenAIMessage);

    // Add assistant message with tool calls
    const rawMsg = assistantRaw as OpenAI.Chat.ChatCompletionMessage;
    if (rawMsg.tool_calls) {
      openaiMessages.push({
        role: 'assistant',
        content: rawMsg.content,
        tool_calls: rawMsg.tool_calls,
      });
    }

    // Add tool results
    for (const tr of toolResults) {
      openaiMessages.push({
        role: 'tool',
        tool_call_id: tr.toolCallId,
        content: tr.content,
      });
    }

    const openaiTools = tools.length > 0 ? tools.map(this.toOpenAITool) : undefined;

    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 1024,
      messages: openaiMessages,
      tools: openaiTools,
    });

    return this.parseResponse(response);
  }

  private toOpenAIMessage(
    msg: ProviderMessage
  ): OpenAI.Chat.ChatCompletionMessageParam {
    if (msg.role === 'system') {
      return { role: 'system', content: msg.content };
    }
    if (msg.role === 'assistant') {
      return { role: 'assistant', content: msg.content };
    }
    return { role: 'user', content: msg.content };
  }

  private toOpenAITool(
    tool: ToolDefinition
  ): OpenAI.Chat.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as OpenAI.Chat.ChatCompletionTool['function']['parameters'],
      },
    };
  }

  private parseResponse(
    response: OpenAI.Chat.ChatCompletion
  ): ProviderResponse {
    const choice = response.choices[0];
    const toolCalls: ToolCall[] = [];
    let textContent = '';

    if (choice?.message) {
      textContent = choice.message.content ?? '';
      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
          });
        }
      }
    }

    return {
      content: textContent,
      hasToolCalls: toolCalls.length > 0,
      toolCalls,
      raw: choice?.message ?? null,
    };
  }
}

// ─── Factory ────────────────────────────────────────────────────────────

export function createProvider(
  type: ProviderType,
  apiKey: string | null
): AIProvider {
  switch (type) {
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'deepseek':
      return new DeepSeekProvider(apiKey);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
