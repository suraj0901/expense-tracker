/**
 * Gemini provider — Google Generative AI SDK.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Content, Part, FunctionDeclarationSchema } from '@google/generative-ai';
import type { AIProvider, ProviderMessage, ProviderResponse } from './types';
import type { ToolDefinition } from '../agent/tools';
import type { ToolCall } from '../domain/types';
import { nanoid } from 'nanoid';

export class GeminiProvider implements AIProvider {
  readonly name = 'Gemini';
  readonly id = 'gemini';
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey: string | null) {
    if (apiKey) this.client = new GoogleGenerativeAI(apiKey);
  }
  isConfigured(): boolean { return this.client !== null; }

  async chat(messages: ProviderMessage[], tools: ToolDefinition[]): Promise<ProviderResponse> {
    if (!this.client) throw new Error('Gemini API key not configured');

    const sysMsg = messages.find((m) => m.role === 'system');
    const contents: Content[] = [];

    for (const m of messages.filter((m) => m.role !== 'system')) {
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const parts: Part[] = m.toolCalls.map((tc) => ({
          functionCall: { name: tc.name, args: tc.args },
        }));
        contents.push({ role: 'model', parts });
      } else if (m.role === 'tool' && m.toolCallId) {
        // Find the tool name — use content directly as parsed JSON
        let response: object;
        try { response = JSON.parse(m.content); } catch { response = { text: m.content }; }
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name: '', response } }],
        });
      } else {
        contents.push({
          role: m.role === 'assistant' ? 'model' as const : 'user' as const,
          parts: [{ text: m.content }],
        });
      }
    }

    const model = this.client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: sysMsg?.content,
      tools: tools.length > 0 ? [{
        functionDeclarations: tools.map((t) => ({
          name: t.name, description: t.description,
          parameters: t.parameters as unknown as FunctionDeclarationSchema,
        })),
      }] : undefined,
    });

    const resp = await model.generateContent({ contents });
    return this.parseResponse(resp);
  }

  private parseResponse(response: { response: { candidates?: Array<{ content?: { parts?: Part[] } }> } }): ProviderResponse {
    const toolCalls: ToolCall[] = []; let textContent = '';
    const candidate = response.response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) textContent += part.text;
        if (part.functionCall) {
          toolCalls.push({
            id: nanoid(), name: part.functionCall.name,
            args: (part.functionCall.args ?? {}) as Record<string, unknown>,
          });
        }
      }
    }
    return {
      content: textContent, hasToolCalls: toolCalls.length > 0, toolCalls,
      raw: { functionCalls: toolCalls.map((tc) => ({ name: tc.name, args: tc.args })) },
    };
  }
}
