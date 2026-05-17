/**
 * Gemini provider — Google Generative AI SDK.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FunctionDeclarationsTool, GenerateContentResult, Content, Part } from '@google/generative-ai';
import type { AIProvider, ProviderMessage, ProviderResponse, ProviderToolResultMessage } from './types';
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
    const conv = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }));
    const model = this.getModel(sysMsg?.content, tools);
    const resp = await model.generateContent({ contents: conv });
    return this.parseResponse(resp);
  }

  async chatWithToolResults(
    messages: ProviderMessage[], toolResults: ProviderToolResultMessage[],
    tools: ToolDefinition[], assistantRaw: unknown,
  ): Promise<ProviderResponse> {
    if (!this.client) throw new Error('Gemini API key not configured');
    const sysMsg = messages.find((m) => m.role === 'system');
    const contents: Content[] = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }],
    }));
    const raw = assistantRaw as { functionCalls: { name: string; args: Record<string, unknown> }[] };
    if (raw.functionCalls) {
      contents.push({ role: 'model', parts: raw.functionCalls.map((fc) => ({
        functionCall: { name: fc.name, args: fc.args },
      })) });
    }
    contents.push({ role: 'user', parts: toolResults.map((tr) => ({
      functionResponse: { name: tr.toolCallId, response: JSON.parse(tr.content) },
    })) });
    const model = this.getModel(sysMsg?.content, tools);
    const resp = await model.generateContent({ contents });
    return this.parseResponse(resp);
  }

  private getModel(sysInstruction: string | undefined, tools: ToolDefinition[]) {
    return this.client!.getGenerativeModel({
      model: 'gemini-2.0-flash', systemInstruction: sysInstruction,
      tools: [{ functionDeclarations: tools.map((t) => ({
        name: t.name, description: t.description,
        parameters: t.parameters as FunctionDeclarationsTool['functionDeclarations'][0]['parameters'],
      })) }],
    });
  }

  private parseResponse(response: GenerateContentResult): ProviderResponse {
    const toolCalls: ToolCall[] = []; let textContent = '';
    const candidate = response.response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) textContent += part.text;
        if (part.functionCall) {
          toolCalls.push({ id: nanoid(), name: part.functionCall.name,
            args: (part.functionCall.args ?? {}) as Record<string, unknown> });
        }
      }
    }
    return {
      content: textContent, hasToolCalls: toolCalls.length > 0, toolCalls,
      raw: { functionCalls: toolCalls.map((tc) => ({ name: tc.name, args: tc.args })) },
    };
  }
}
