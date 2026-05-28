import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetEventFeedSchema } from '../../agent/tool-schemas';

export const getEventFeedTool: ToolHandler = {
  name: 'get_event_feed',
  schema: GetEventFeedSchema,
  definition: {
    name: 'get_event_feed',
    description: 'Get recent events from the event feed — transaction logs, merchant confirmations, budget warnings, recurring suggestions.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recent events (default 10)' },
      },
      required: [],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const events = await deps.eventRepo.getRecent((args.limit as number) ?? 10);
    if (events.length === 0) return { events: [], message: 'No recent events.' };
    return {
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        body: e.body,
        status: e.status,
        created_at: e.createdAt,
      })),
    };
  },
};
