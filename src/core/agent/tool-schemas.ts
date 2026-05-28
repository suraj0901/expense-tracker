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

export const UpdateCategorySchema = z.object({
  name: z.string().min(1),
  new_name: z.string().optional(),
  icon: z.string().optional(),
});

export const DeleteCategorySchema = z.object({
  name: z.string().min(1),
});

export const SetBudgetSchema = z.object({
  category_name: z.string().min(1),
  amount: z.number().positive(),
});

export const GetBudgetsSchema = z.object({});

export const DeleteBudgetSchema = z.object({
  category_name: z.string().min(1),
});

export const GetSpendingTrendSchema = z.object({});

export const GetMerchantMappingsSchema = z.object({});

export const UpdateMerchantMappingSchema = z.object({
  canonical_name: z.string().min(1),
  category: z.string().optional(),
  confirm_strategy: z.enum(['auto', 'ask_always', 'dismissed']).optional(),
});

export const DeleteMerchantMappingSchema = z.object({
  canonical_name: z.string().min(1),
});

export const GetAutoLogRulesSchema = z.object({});

export const EnableAutoLogRuleSchema = z.object({
  rule_id: z.string().min(1),
});

export const DisableAutoLogRuleSchema = z.object({
  rule_id: z.string().min(1),
});

export const DeleteAutoLogRuleSchema = z.object({
  rule_id: z.string().min(1),
});

export const GetEventFeedSchema = z.object({
  limit: z.number().optional(),
});

export const GetInsightsSchema = z.object({
  month: z.number().min(1).max(12).optional(),
  year: z.number().optional(),
});

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
  update_category: UpdateCategorySchema,
  delete_category: DeleteCategorySchema,
  set_budget: SetBudgetSchema,
  get_budgets: GetBudgetsSchema,
  delete_budget: DeleteBudgetSchema,
  get_spending_trend: GetSpendingTrendSchema,
  get_merchant_mappings: GetMerchantMappingsSchema,
  update_merchant_mapping: UpdateMerchantMappingSchema,
  delete_merchant_mapping: DeleteMerchantMappingSchema,
  get_auto_log_rules: GetAutoLogRulesSchema,
  enable_auto_log_rule: EnableAutoLogRuleSchema,
  disable_auto_log_rule: DisableAutoLogRuleSchema,
  delete_auto_log_rule: DeleteAutoLogRuleSchema,
  get_event_feed: GetEventFeedSchema,
  get_insights: GetInsightsSchema,
};
