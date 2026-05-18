/**
 * Tool executor — the bridge between AI tool calls and the database.
 *
 * A pure dispatch function — no logic of its own.
 * rupeesToPaise on write, paiseToRupees on read.
 * The conversion happens exactly twice — here. Never elsewhere.
 */

import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import { rupeesToPaise, paiseToRupees } from '../domain/money';
import type { Paise } from '../domain/money';
import type { ToolCall, ToolResult } from '../domain/types';
import { TOOL_SCHEMAS } from './tool-schemas';
import * as db from '../db/client';

/**
 * Execute a single tool call and return the result.
 * Validates arguments with Zod before execution.
 */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  try {
    // Validate arguments against Zod schema
    const schema = TOOL_SCHEMAS[call.name];
    if (schema) {
      const parseResult = schema.safeParse(call.args);
      if (!parseResult.success) {
        return {
          toolCallId: call.id,
          result: null,
          error: `Invalid arguments: ${parseResult.error.message}`,
        };
      }
    }

    const result = await executeToolInternal(call);
    return {
      toolCallId: call.id,
      result,
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      result: null,
      error: error instanceof Error ? error.message : `Unknown error executing ${call.name}`,
    };
  }
}

async function executeToolInternal(call: ToolCall): Promise<unknown> {
  const args = call.args;
  const today = format(new Date(), 'yyyy-MM-dd');

  switch (call.name) {
    case 'store_expense': {
      return db.insertTransaction({
        id: nanoid(),
        amount: rupeesToPaise(args.amount as number),
        type: 'expense',
        category: args.category as string,
        merchant: (args.merchant as string) ?? null,
        note: (args.note as string) ?? null,
        date: (args.date as string) ?? today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
      });
    }

    case 'store_income': {
      return db.insertTransaction({
        id: nanoid(),
        amount: rupeesToPaise(args.amount as number),
        type: 'income',
        category: (args.source as string) ?? 'Income',
        merchant: null,
        note: (args.note as string) ?? null,
        date: (args.date as string) ?? today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
      });
    }

    case 'get_expenses': {
      const results = await db.queryTransactions({
        category: args.category as string | undefined,
        start_date: args.start_date as string | undefined,
        end_date: args.end_date as string | undefined,
        merchant: args.merchant as string | undefined,
        limit: args.limit as number | undefined,
      });

      // Convert amounts from paise to rupees for AI consumption
      return results.map((t) => ({
        id: t.id,
        amount: paiseToRupees(t.amount as Paise),
        type: t.type,
        category: t.category,
        merchant: t.merchant,
        note: t.note,
        date: t.date,
      }));
    }

    case 'get_monthly_summary': {
      const summary = await db.getMonthlySummary(
        args.month as number,
        args.year as number
      );

      return {
        ...summary,
        totalIncome: paiseToRupees(summary.totalIncome as Paise),
        totalExpense: paiseToRupees(summary.totalExpense as Paise),
        savings: paiseToRupees(summary.savings as Paise),
        categoryBreakdown: summary.categoryBreakdown.map((c) => ({
          ...c,
          total: paiseToRupees(c.total as Paise),
        })),
      };
    }

    case 'get_category_breakdown': {
      const breakdown = await db.getCategoryBreakdown(
        args.start_date as string,
        args.end_date as string
      );

      return breakdown.map((c) => ({
        ...c,
        total: paiseToRupees(c.total as Paise),
      }));
    }

    case 'get_recent_transactions': {
      const recent = await db.getRecent((args.count as number) ?? 10);
      return recent.map((t) => ({
        id: t.id,
        amount: paiseToRupees(t.amount as Paise),
        type: t.type,
        category: t.category,
        merchant: t.merchant,
        note: t.note,
        date: t.date,
      }));
    }

    case 'update_expense': {
      return db.updateTransaction(args.transaction_id as string, {
        amount: args.amount
          ? rupeesToPaise(args.amount as number)
          : undefined,
        category: args.category as string | undefined,
        merchant: args.merchant as string | undefined,
        note: args.note as string | undefined,
        updatedAt: Date.now(),
      });
    }

    case 'delete_expense': {
      return db.softDelete(args.transaction_id as string);
    }

    case 'get_budget_status': {
      return db.getBudgetStatus();
    }

    case 'undo_delete': {
      return db.undoDelete(args.transaction_id as string);
    }

    case 'set_goal': {
      const goal = await db.setGoal({
        id: nanoid(),
        name: args.name as string,
        targetAmount: rupeesToPaise(args.target_amount as number),
        category: (args.category as string) ?? null,
        deadline: (args.deadline as string) ?? null,
      });
      return {
        ...goal,
        targetAmount: paiseToRupees(goal.targetAmount),
        currentAmount: paiseToRupees(goal.currentAmount),
      };
    }

    case 'get_goals': {
      const goals = await db.getGoals();
      return goals.map((g) => ({
        ...g,
        targetAmount: paiseToRupees(g.targetAmount),
        currentAmount: paiseToRupees(g.currentAmount),
      }));
    }

    case 'delete_goal': {
      return db.deleteGoal(args.goal_id as string);
    }

    case 'list_categories': {
      const cats = await db.getCategories();
      return cats.map((c) => ({ name: c.name, icon: c.icon }));
    }

    case 'create_category': {
      return db.insertCategory(args.name as string, (args.icon as string) ?? '📦');
    }

    default:
      return { error: `Unknown tool: ${call.name}` };
  }
}
