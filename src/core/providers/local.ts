/**
 * LocalAIProvider — WebLLM-backed provider running models in the browser.
 *
 * Uses @mlc-ai/web-llm with SmolLM2-360M. Model downloads on first use
 * with progress reporting. Tool calling via prompt-engineered XML tags
 * since small models don't support native function calling in WebLLM.
 *
 * This provider is optional — users must explicitly enable it in settings.
 */
import {
  CreateMLCEngine,
  type MLCEngine,
  type InitProgressReport,
  type ChatCompletionMessageParam,
} from '@mlc-ai/web-llm';
import type { AIProvider, ProviderMessage, ProviderResponse } from './types';
import type { ToolDefinition } from '../agent/tools';

// ─── Model ──────────────────────────────────────────────────────────────

const MODEL_ID = 'SmolLM2-360M-Instruct-q4f16_1-MLC';

// ─── Tool prompt ────────────────────────────────────────────────────────

const TOOL_CALL_OPEN = '<tool_call>';

function buildToolPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';
  const toolDescs = tools.map((t) => {
    const params = Object.entries((t.parameters.properties as Record<string, unknown>) ?? {})
      .map(([k, v]) => `  - ${k}: ${(v as { description?: string }).description ?? ''}`)
      .join('\n');
    const required = (t.parameters.required as string[]) ?? [];
    return `${t.name} — ${t.description}
Parameters:${params ? '\n' + params : ' none'}
Required: ${required.join(', ') || 'none'}`;
  }).join('\n\n');

  return `\n\nYou have access to these tools. To use a tool, output EXACTLY:
<tool_call>
{"name": "tool_name", "arguments": {...}}
</tool_call>

RULES:
- When the user lists multiple expenses (e.g. "auto 25, chai 15, lunch 120"), output ALL tool calls in ONE response — one <tool_call> block per item, right after each other.
- After receiving a tool result, if ANY items from the user's request are still unprocessed, output the next <tool_call> immediately. Do NOT write text until ALL items are done.
- Never output text and <tool_call> in the same response — use ONLY tool calls or ONLY text.

Available tools:
${toolDescs}`;
}

// ─── Response parsing ───────────────────────────────────────────────────

interface ParsedResponse {
  message: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  hasToolCalls: boolean;
}

function parseResponse(content: string): ParsedResponse {
  const toolCalls: ParsedResponse['toolCalls'] = [];
  let hasToolCalls = false;

  // Check for tool_call tags
  const tagStart = content.indexOf(TOOL_CALL_OPEN);
  if (tagStart === -1) {
    return { message: content.trim(), toolCalls: [], hasToolCalls: false };
  }

  // Extract all tool_call blocks
  const regex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name && parsed.arguments) {
        toolCalls.push({ name: parsed.name, args: parsed.arguments });
        hasToolCalls = true;
      }
    } catch {
      // Skip malformed JSON
    }
  }

  // Return remaining text after stripping tool_call blocks
  const cleanText = content.replace(regex, '').trim();

  return {
    message: cleanText,
    toolCalls,
    hasToolCalls: hasToolCalls && toolCalls.length > 0,
  };
}

// ─── Download State ─────────────────────────────────────────────────────

export type DownloadStatus = 'idle' | 'downloading' | 'ready' | 'error';

export interface DownloadState {
  status: DownloadStatus;
  progress: number; // 0–1
  text: string;
}

type DownloadListener = (state: DownloadState) => void;

// ─── Provider ───────────────────────────────────────────────────────────

export class LocalAIProvider implements AIProvider {
  readonly name = 'SmolLM2 360M (Local)';
  readonly id = 'webllm';

  private engine: MLCEngine | null = null;
  private state: DownloadState = { status: 'idle', progress: 0, text: '' };
  private listeners = new Set<DownloadListener>();
  private initPromise: Promise<void> | null = null;

  // ─── Download Progress ──────────────────────────────────────────────

  getDownloadState(): DownloadState {
    return { ...this.state };
  }

  onDownload(fn: DownloadListener): () => void {
    this.listeners.add(fn);
    fn(this.getDownloadState());
    return () => { this.listeners.delete(fn); };
  }

  private emit(): void {
    const s = this.getDownloadState();
    for (const fn of this.listeners) fn(s);
  }

  // ─── Engine Init ────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.engine) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.state = { status: 'downloading', progress: 0, text: 'Starting download...' };
    this.emit();

    try {
      this.engine = await CreateMLCEngine(
        MODEL_ID,
        {
          initProgressCallback: (report: InitProgressReport) => {
            this.state = {
              status: 'downloading',
              progress: report.progress,
              text: report.text,
            };
            this.emit();
          },
        },
        // SmolLM2-360M has a smaller default context window. Bump it to
        // fit the system prompt + tool descriptions + 20 messages of history.
        { context_window_size: 8192 },
      );
      this.state = { status: 'ready', progress: 1, text: 'Model ready' };
      this.emit();
    } catch (err) {
      this.state = {
        status: 'error',
        progress: 0,
        text: err instanceof Error ? err.message : 'Failed to load model',
      };
      this.emit();
      this.initPromise = null;
      throw err;
    }
  }

  // ─── AIProvider Interface ───────────────────────────────────────────

  isConfigured(): boolean {
    return this.engine !== null;
  }

  async chat(
    messages: ProviderMessage[],
    tools: ToolDefinition[],
  ): Promise<ProviderResponse> {
    if (!this.engine) {
      await this.initialize();
      if (!this.engine) {
        throw new Error('Local model not loaded');
      }
    }

    // Inject tool prompt into the system message — only on the first
    // system message. Strip any prior tool prompt to prevent
    // compounding across loop iterations.
    const toolPrompt = buildToolPrompt(tools);
    const TOOL_PROMPT_MARKER = '\n\nYou have access to these tools.';
    const processedMessages: ChatCompletionMessageParam[] = messages.map((m) => {
      if (m.role === 'system') {
        // Strip any previously injected tool prompt, then add fresh one
        const baseContent = m.content.includes(TOOL_PROMPT_MARKER)
          ? m.content.substring(0, m.content.indexOf(TOOL_PROMPT_MARKER))
          : m.content;
        return { role: 'system', content: baseContent + toolPrompt };
      }
      if (m.role === 'user') {
        return { role: 'user', content: m.content };
      }
      if (m.role === 'assistant') {
        // Reconstruct XML from structured toolCalls so the model sees its
        // own tool calls in the conversation history.
        const xmlBlocks = (m.toolCalls ?? []).map(
          (tc) => `<tool_call>\n${JSON.stringify({ name: tc.name, arguments: tc.args })}\n</tool_call>`
        ).join('\n');
        const fullContent = xmlBlocks ? (m.content ? m.content + '\n' + xmlBlocks : xmlBlocks) : m.content;
        return { role: 'assistant', content: fullContent };
      }
      // Tool result — format as user message since XML-based models
      // don't understand the 'tool' role. The model needs to see results
      // in the conversation to continue tool calling.
      return { role: 'user', content: `Tool result for ${m.toolCallId}: ${m.content}` };
    });

    const response = await this.engine.chat.completions.create({
      messages: processedMessages,
      max_tokens: 1024,
      temperature: 0.1
    });

    const content = response.choices[0].message.content ?? '';
    const parsed = parseResponse(content);

    return {
      content: parsed.message,
      hasToolCalls: parsed.hasToolCalls,
      toolCalls: parsed.toolCalls.map((tc, i) => ({
        id: `local-${i}`,
        name: tc.name,
        args: tc.args,
      })),
      raw: response,
    };
  }
}
