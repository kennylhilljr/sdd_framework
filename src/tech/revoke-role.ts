// Role revocation for the worked example (LLD-tech §3).
// In-memory stores keep the sample small; a real service would use PostgreSQL and a cache (ADR 0001, ADR 0002).

export type Clock = () => Date;

export class NotFoundError extends Error {
  readonly code = "not_found";
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export interface AuditRecord {
  actor: string;
  userId: string;
  role: string;
  action: "revoke";
  at: Date;
}

/** Users, their roles, and the actions each role grants. */
export class RoleStore {
  private readonly users = new Map<string, Set<string>>();
  constructor(private readonly roleActions: Record<string, string[]>) {}

  addUser(userId: string, roles: string[] = []): void {
    this.users.set(userId, new Set(roles));
  }
  hasUser(userId: string): boolean {
    return this.users.has(userId);
  }
  rolesOf(userId: string): string[] {
    return [...(this.users.get(userId) ?? [])];
  }
  removeRole(userId: string, role: string): void {
    this.users.get(userId)?.delete(role);
  }
  actionsFor(roles: string[]): Set<string> {
    return new Set(roles.flatMap((r) => this.roleActions[r] ?? []));
  }
}

/** A short-lived copy of each user's grants (LLD-tech §2). */
export class GrantCache {
  private readonly entries = new Map<string, { actions: Set<string>; expiresAt: number }>();
  constructor(
    private readonly clock: Clock,
    readonly ttlSeconds = 30,
  ) {}

  get(userId: string): Set<string> | undefined {
    const e = this.entries.get(userId);
    if (!e) return undefined;
    if (e.expiresAt <= this.clock().getTime()) {
      this.entries.delete(userId);
      return undefined;
    }
    return e.actions;
  }
  set(userId: string, actions: Set<string>): void {
    this.entries.set(userId, { actions, expiresAt: this.clock().getTime() + this.ttlSeconds * 1000 });
  }
  invalidate(userId: string): void {
    this.entries.delete(userId);
  }
}

/** Append-only audit log (INV-2). */
export class AuditLog {
  private readonly records: AuditRecord[] = [];
  append(record: AuditRecord): void {
    this.records.push(Object.freeze({ ...record }));
  }
  all(): readonly AuditRecord[] {
    return [...this.records];
  }
}

export interface TechDeps {
  store: RoleStore;
  cache: GrantCache;
  audit: AuditLog;
  clock: Clock;
}

// @spec TECH-2, TECH-3, TECH-4
export function revokeRole(deps: TechDeps, userId: string, role: string, actor: string): void {
  if (!deps.store.hasUser(userId)) throw new NotFoundError(`user ${userId} does not exist`);
  // The role change and its audit record commit together (one transaction in the real service).
  deps.store.removeRole(userId, role);
  deps.audit.append({ actor, userId, role, action: "revoke", at: deps.clock() });
  // Invalidate after the commit so a concurrent check cannot re-cache the old grants (LLD-tech §9).
  deps.cache.invalidate(userId);
}
