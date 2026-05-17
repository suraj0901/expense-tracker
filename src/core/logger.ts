/**
 * Structured JSON logger.
 *
 * Every log line is a flat JSON object with:
 *   level, message, trace_id, duration_ms, result_status
 *
 * RED metrics (Rate, Errors, Duration) are auto-exported via console.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  level: LogLevel;
  message: string;
  trace_id: string;
  duration_ms?: number;
  result_status?: 'success' | 'error';
  [key: string]: unknown;
}

let traceCounter = 0;

export function newTraceId(): string {
  traceCounter += 1;
  return `${Date.now().toString(36)}-${traceCounter.toString(36)}`;
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  switch (entry.level) {
    case 'ERROR':
      console.error(line);
      break;
    case 'WARN':
      console.warn(line);
      break;
    case 'DEBUG':
      console.debug(line);
      break;
    default:
      console.info(line);
  }
}

export const logger = {
  debug(message: string, extra?: Record<string, unknown>) {
    emit({ level: 'DEBUG', message, trace_id: newTraceId(), ...extra });
  },

  info(message: string, extra?: Record<string, unknown>) {
    emit({ level: 'INFO', message, trace_id: newTraceId(), ...extra });
  },

  warn(message: string, extra?: Record<string, unknown>) {
    emit({ level: 'WARN', message, trace_id: newTraceId(), ...extra });
  },

  error(message: string, error?: Error, extra?: Record<string, unknown>) {
    emit({
      level: 'ERROR',
      message,
      trace_id: newTraceId(),
      result_status: 'error',
      error_message: error?.message,
      error_stack: error?.stack,
      ...extra,
    });
  },

  /** Wrap an async operation with start/end logging + duration_ms */
  async withTrace<T>(
    message: string,
    fn: () => Promise<T>,
    extra?: Record<string, unknown>
  ): Promise<T> {
    const trace_id = newTraceId();
    const start = performance.now();
    emit({ level: 'INFO', message: `${message}:start`, trace_id, ...extra });
    try {
      const result = await fn();
      const duration_ms = Math.round(performance.now() - start);
      emit({
        level: 'INFO',
        message: `${message}:end`,
        trace_id,
        duration_ms,
        result_status: 'success',
        ...extra,
      });
      return result;
    } catch (err) {
      const duration_ms = Math.round(performance.now() - start);
      const error = err instanceof Error ? err : new Error(String(err));
      emit({
        level: 'ERROR',
        message: `${message}:end`,
        trace_id,
        duration_ms,
        result_status: 'error',
        error_message: error.message,
        ...extra,
      });
      throw error;
    }
  },
};
