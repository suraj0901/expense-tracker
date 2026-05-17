/**
 * Logger tests — structured JSON logging.
 */
import { describe, it, expect, vi } from 'vitest';
import { logger, newTraceId } from './logger';

describe('newTraceId', () => {
  it('returns unique IDs', () => {
    const a = newTraceId();
    const b = newTraceId();
    expect(a).not.toBe(b);
  });
});

describe('logger', () => {
  it('info logs a JSON line', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('test message');
    expect(spy).toHaveBeenCalledOnce();
    const line = JSON.parse(spy.mock.calls[0][0]);
    expect(line.level).toBe('INFO');
    expect(line.message).toBe('test message');
    expect(line.trace_id).toBeTruthy();
    spy.mockRestore();
  });

  it('error logs with result_status=error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('something failed', new Error('boom'));
    expect(spy).toHaveBeenCalledOnce();
    const line = JSON.parse(spy.mock.calls[0][0]);
    expect(line.level).toBe('ERROR');
    expect(line.result_status).toBe('error');
    expect(line.error_message).toBe('boom');
    spy.mockRestore();
  });

  it('withTrace logs start and end with duration', async () => {
    const calls: string[] = [];
    vi.spyOn(console, 'info').mockImplementation((m: string) => calls.push(m));
    const result = await logger.withTrace('testOp', async () => 42);
    expect(result).toBe(42);
    expect(calls).toHaveLength(2);
    const start = JSON.parse(calls[0]);
    const end = JSON.parse(calls[1]);
    expect(start.message).toBe('testOp:start');
    expect(end.message).toBe('testOp:end');
    expect(end.result_status).toBe('success');
    expect(typeof end.duration_ms).toBe('number');
    vi.restoreAllMocks();
  });

  it('withTrace logs error on failure', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      logger.withTrace('fails', async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');
    const line = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(line.result_status).toBe('error');
    vi.restoreAllMocks();
  });
});
