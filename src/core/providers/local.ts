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

// Timeouts to prevent browser hangs on limited hardware
const INIT_TIMEOUT_MS = 120_000; // 2 min for model download + compile
const INFERENCE_TIMEOUT_MS = 30_000; // 30s per inference call

// ─── Tool prompt ────────────────────────────────────────────────────────

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
  const openTag = '<tool_call>';
  const closeTag = '</tool_call>';

  let searchFrom = 0;
  const blocks: string[] = [];

  while (true) {
    const startIdx = content.indexOf(openTag, searchFrom);
    if (startIdx === -1) break;

    const jsonStart = startIdx + openTag.length;
    const endIdx = content.indexOf(closeTag, jsonStart);
    const jsonText = endIdx !== -1
      ? content.slice(jsonStart, endIdx).trim()
      : content.slice(jsonStart).trim();

    blocks.push(jsonText);
    searchFrom = endIdx !== -1 ? endIdx + closeTag.length : content.length;
  }

  if (blocks.length === 0) {
    return { message: content.trim(), toolCalls: [], hasToolCalls: false };
  }

  for (const block of blocks) {
    try {
      // Extract JSON by counting braces — handles nested objects/arrays
      const jsonStr = extractBalancedJson(block);
      if (!jsonStr) continue;
      const parsed = JSON.parse(jsonStr);
      if (parsed.name && parsed.arguments) {
        toolCalls.push({ name: parsed.name, args: parsed.arguments });
      }
    } catch {
      // Skip malformed JSON
    }
  }

  // Strip all <tool_call>...</tool_call> blocks from text
  const cleanText = content.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();

  return {
    message: cleanText,
    toolCalls,
    hasToolCalls: toolCalls.length > 0,
  };
}

/** Extract balanced JSON from text by counting braces. Handles nested objects and arrays. */
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
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

/** Truncate messages to stay within the context window, keeping the system
 *  message intact and removing oldest non-system messages first.
 *  Ensures the last message is not from `assistant` — WebLLM requires
 *  the final message to be `user` or `tool`. */
function truncateMessages(
  messages: ChatCompletionMessageParam[],
  maxChars: number,
): ChatCompletionMessageParam[] {
  let total = 0;
  for (const m of messages) {
    total += (m.content as string)?.length ?? 0;
  }
  if (total <= maxChars) return messages;

  const systemMsgs = messages.filter(m => m.role === 'system');
  const otherMsgs = messages.filter(m => m.role !== 'system');
  let systemLen = 0;
  for (const m of systemMsgs) systemLen += (m.content as string)?.length ?? 0;

  const budget = maxChars - systemLen;
  const result: ChatCompletionMessageParam[] = [];
  let used = 0;
  for (let i = otherMsgs.length - 1; i >= 0; i--) {
    const len = (otherMsgs[i].content as string)?.length ?? 0;
    if (used + len > budget) break;
    result.unshift(otherMsgs[i]);
    used += len;
  }

  // WebLLM requires last message to be user/tool — drop trailing assistant
  while (result.length > 0 && result[result.length - 1].role === 'assistant') {
    result.pop();
  }

  return [...systemMsgs, ...result];
}

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
      this.engine = await Promise.race([
        CreateMLCEngine(
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
          { context_window_size: 4096 },
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Model download timed out — try again on a faster connection')), INIT_TIMEOUT_MS)
        ),
      ]);
      this.state = { status: 'ready', progress: 1, text: 'Model ready' };
      this.emit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load model';
      this.state = {
        status: 'error',
        progress: 0,
        text: msg,
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

    // Truncate to keep under context window — system prompt + tool
    // description + a few recent exchanges. Small models choke on long context.
    const truncated = truncateMessages(processedMessages, 4096);

    try {
      const response = await Promise.race([
        this.engine.chat.completions.create({
          messages: truncated,
          max_tokens: 512,
          temperature: 0.1,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Local model took too long to respond — try a shorter message')), INFERENCE_TIMEOUT_MS)
        ),
      ]);

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
    } catch (err) {
      // If inference times out or OOMs, the engine may be left in a
      // broken state. Reset it so the next attempt starts fresh.
      if (err instanceof Error && (err.message.includes('too long') || err.message.includes('timed out'))) {
        this.engine = null;
        this.initPromise = null;
        this.state = { status: 'error', progress: 0, text: err.message };
        this.emit();
      }
      throw err;
    }
  }
}
