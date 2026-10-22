// Access check for the worked example (LLD-iam §2).
import type { IamDeps } from "./revoke-role.js";

// @spec IAM-1
export function authorize(deps: Pick<IamDeps, "store" | "cache">, userId: string, action: string): boolean {
  if (!deps.store.hasUser(userId)) return false;
  let actions = deps.cache.get(userId);
  if (!actions) {
    actions = deps.store.actionsFor(deps.store.rolesOf(userId));
    deps.cache.set(userId, actions);
  }
  return actions.has(action);
}
