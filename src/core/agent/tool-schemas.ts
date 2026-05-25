/**
 * Tool Zod schemas — validation for all 10 AI tools.
 */
import { z } from 'zod';

export const StoreExpenseSchema = z.object({
  amount: z.number().positive(),
  category: z.string(),
  merchant: z.string().optional().nullable(),
  date: z.string().optional(),
  note: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export const StoreIncomeSchema = z.object({
  amount: z.number().positive(),
  source: z.string(),
  date: z.string().optional(),
  note: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export const GetExpensesSchema = z.object({
  category: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  merchant: z.string().optional(),
  limit: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export const GetMonthlySummarySchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number(),
});

export const GetCategoryBreakdownSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
});

export const GetRecentTransactionsSchema = z.object({
  count: z.number().optional().default(10),
});

export const UpdateExpenseSchema = z.object({
  transaction_id: z.string(),
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  merchant: z.string().optional(),
  note: z.string().optional(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export const DeleteExpenseSchema = z.object({
  transaction_id: z.string(),
});

export const UndoDeleteSchema = z.object({
  transaction_id: z.string(),
});

export const SetGoalSchema = z.object({
  name: z.string(),
  target_amount: z.number().positive(),
  category: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
});

export const GetGoalsSchema = z.object({});

export const DeleteGoalSchema = z.object({
  goal_id: z.string(),
});

export const GetBudgetStatusSchema = z.object({});

export const CreateCategorySchema = z.object({
  name: z.string().min(1),
  icon: z.string().optional(),
});

export const ListCategoriesSchema = z.object({});

export const TOOL_SCHEMAS: Record<string, z.ZodSchema> = {
  store_expense: StoreExpenseSchema,
  store_income: StoreIncomeSchema,
  get_expenses: GetExpensesSchema,
  get_monthly_summary: GetMonthlySummarySchema,
  get_category_breakdown: GetCategoryBreakdownSchema,
  get_recent_transactions: GetRecentTransactionsSchema,
  update_expense: UpdateExpenseSchema,
  delete_expense: DeleteExpenseSchema,
  get_budget_status: GetBudgetStatusSchema,
  undo_delete: UndoDeleteSchema,
  set_goal: SetGoalSchema,
  get_goals: GetGoalsSchema,
  delete_goal: DeleteGoalSchema,
  create_category: CreateCategorySchema,
  list_categories: ListCategoriesSchema,
};
