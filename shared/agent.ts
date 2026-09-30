export const agentActions = ['article_edit', 'image_prompt', 'publish_preview', 'clarify'] as const;
export type AgentPlan = { action: typeof agentActions[number]; message: string };
export const proposalDecisionMessages = {
  accepted: '这轮候选稿已接受并保存为文章版本。',
  rejected: '这轮候选稿已拒绝，没有应用到文章。',
  superseded: '这轮候选稿已由后续候选稿替代，仍未应用到文章。',
} as const;
