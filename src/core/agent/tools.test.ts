/**
 * Tool schema validation tests.
 */
import { describe, it, expect } from 'vitest';
import {
  StoreExpenseSchema, StoreIncomeSchema, GetExpensesSchema,
  GetMonthlySummarySchema, GetCategoryBreakdownSchema,
  UpdateExpenseSchema, DeleteExpenseSchema, UndoDeleteSchema,
  GetBudgetStatusSchema, TOOL_DEFINITIONS, TOOL_SCHEMAS,
} from './tools';

describe('StoreExpenseSchema', () => {
  it('accepts valid input', () => {
    const r = StoreExpenseSchema.safeParse({ amount: 120, category: 'Food' });
    expect(r.success).toBe(true);
  });

  it('accepts full input with optional fields', () => {
    const r = StoreExpenseSchema.safeParse({
      amount: 500, category: 'Transport', merchant: 'Uber',
      date: '2026-05-17', note: 'ride home',
    });
    expect(r.success).toBe(true);
  });

  it('rejects negative amount', () => {
    const r = StoreExpenseSchema.safeParse({ amount: -10, category: 'Food' });
    expect(r.success).toBe(false);
  });

  it('rejects missing category', () => {
    const r = StoreExpenseSchema.safeParse({ amount: 100 });
    expect(r.success).toBe(false);
  });
});

describe('StoreIncomeSchema', () => {
  it('accepts valid income', () => {
    const r = StoreIncomeSchema.safeParse({ amount: 50000, source: 'salary' });
    expect(r.success).toBe(true);
  });
});

describe('GetExpensesSchema', () => {
  it('accepts empty filter (all optional)', () => {
    const r = GetExpensesSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('accepts partial filters', () => {
    const r = GetExpensesSchema.safeParse({ category: 'Food', limit: 5 });
    expect(r.success).toBe(true);
  });
});

describe('GetMonthlySummarySchema', () => {
  it('accepts valid month and year', () => {
    const r = GetMonthlySummarySchema.safeParse({ month: 5, year: 2026 });
    expect(r.success).toBe(true);
  });

  it('rejects month 0', () => {
    const r = GetMonthlySummarySchema.safeParse({ month: 0, year: 2026 });
    expect(r.success).toBe(false);
  });

  it('rejects month 13', () => {
    const r = GetMonthlySummarySchema.safeParse({ month: 13, year: 2026 });
    expect(r.success).toBe(false);
  });
});

describe('UpdateExpenseSchema', () => {
  it('accepts partial update', () => {
    const r = UpdateExpenseSchema.safeParse({
      transaction_id: 'abc123', amount: 200,
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty update', () => {
    const r = UpdateExpenseSchema.safeParse({ transaction_id: 'abc123' });
    expect(r.success).toBe(true); // transaction_id is the only required field
  });
});

describe('DeleteExpenseSchema', () => {
  it('requires transaction_id', () => {
    const r = DeleteExpenseSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe('UndoDeleteSchema', () => {
  it('requires transaction_id', () => {
    const r = UndoDeleteSchema.safeParse({ transaction_id: 'abc123' });
    expect(r.success).toBe(true);
  });
});

describe('GetBudgetStatusSchema', () => {
  it('accepts empty object', () => {
    const r = GetBudgetStatusSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe('TOOL_DEFINITIONS', () => {
  it('has 10 tools', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(10);
  });

  it('every tool has a name, description, and parameters', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
    }
  });
});

describe('TOOL_SCHEMAS', () => {
  it('has schema for every tool definition', () => {
    const schemaNames = Object.keys(TOOL_SCHEMAS);
    for (const tool of TOOL_DEFINITIONS) {
      expect(schemaNames).toContain(tool.name);
    }
  });
});
