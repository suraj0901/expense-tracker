import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { UndoDeleteSchema } from '../../agent/tool-schemas';

export const undoDeleteTool: ToolHandler = {
  name: 'undo_delete',
  schema: UndoDeleteSchema,
  definition: {
    name: 'undo_delete',
    description: 'Restore a previously soft-deleted transaction.',
    parameters: {
      type: 'object',
      properties: { transaction_id: { type: 'string', description: 'Transaction ID to restore' } },
      required: ['transaction_id'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    return deps.transactionRepo.undoDelete(args.transaction_id as string);
  },
};
