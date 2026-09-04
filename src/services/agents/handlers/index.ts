// ============================================================
// HOMEINO — AGENT HANDLER REGISTRY
//
// Built-in agents resolve to a dedicated handler. Agents created in the admin
// panel without a handler run through the declarative handler (LLM + granted
// tools), so new agents need zero code.
// ============================================================
import type { AgentHandler } from "./types";
import { runCustomerIntelligence } from "./customerIntelligence";
import { runRecommendationAgent } from "./recommendation";
import { runShoppingAssistant } from "./shoppingAssistant";
import { runInventoryAgent } from "./inventory";
import { runDesignerAgent } from "./designer";
import { runBrowserAgent } from "./browser";
import { runDeclarativeAgent } from "./declarative";

export const AGENT_HANDLERS: Record<string, AgentHandler> = {
  customerIntelligence: runCustomerIntelligence,
  recommendation: runRecommendationAgent,
  shoppingAssistant: runShoppingAssistant,
  inventory: runInventoryAgent,
  designer: runDesignerAgent,
  browser: runBrowserAgent,
  declarative: runDeclarativeAgent,
};

export const HANDLER_KEYS = Object.keys(AGENT_HANDLERS);

export function resolveHandler(handlerKey?: string | null): AgentHandler {
  if (handlerKey && AGENT_HANDLERS[handlerKey]) return AGENT_HANDLERS[handlerKey];
  return runDeclarativeAgent;
}

export type { AgentHandler, HandlerContext, HandlerResult, ToolCallResult } from "./types";
export { runCustomerIntelligence, runRecommendationAgent, runShoppingAssistant, runInventoryAgent, runDesignerAgent, runBrowserAgent, runDeclarativeAgent };
