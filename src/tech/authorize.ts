// Access check for the worked example (LLD-tech §2).
import type { TechDeps } from "./revoke-role.js";

// @spec TECH-1
export function authorize(deps: Pick<TechDeps, "store" | "cache">, userId: string, action: string): boolean {
  if (!deps.store.hasUser(userId)) return false;
  let actions = deps.cache.get(userId);
  if (!actions) {
    actions = deps.store.actionsFor(deps.store.rolesOf(userId));
    deps.cache.set(userId, actions);
  }
  return actions.has(action);
}
