import { describe, it, expect } from "vitest";
import { AuditLog, GrantCache, NotFoundError, RoleStore, revokeRole, type TechDeps } from "../../src/tech/revoke-role.js";
import { authorize } from "../../src/tech/authorize.js";

function setup(): TechDeps & { advance: (seconds: number) => void } {
  let now = Date.parse("2026-03-01T09:00:00Z");
  const clock = () => new Date(now);
  const store = new RoleStore({ "invoice-reader": ["invoices:read"], "access-admin": ["roles:revoke"] });
  store.addUser("u-1", ["invoice-reader"]);
  return {
    store,
    cache: new GrantCache(clock, 30),
    audit: new AuditLog(),
    clock,
    advance: (seconds) => {
      now += seconds * 1000;
    },
  };
}

describe("TECH: access checks and revocation", () => {
  // @spec TECH-1
  it("TECH-1: allows an action only when a current role grants it", () => {
    const deps = setup();
    expect(authorize(deps, "u-1", "invoices:read")).toBe(true);
    expect(authorize(deps, "u-1", "roles:revoke")).toBe(false);
    expect(authorize(deps, "nobody", "invoices:read")).toBe(false);
  });

  // @spec TECH-2
  it("TECH-2: invalidates cached grants on revocation, well inside 60 seconds", () => {
    const deps = setup();
    expect(authorize(deps, "u-1", "invoices:read")).toBe(true); // warms the cache
    revokeRole(deps, "u-1", "invoice-reader", "admin-7");
    deps.advance(1);
    expect(authorize(deps, "u-1", "invoices:read")).toBe(false);
  });

  // @spec TECH-3
  it("TECH-3: rejects a revocation for a user that does not exist with a not-found error", () => {
    const deps = setup();
    expect(() => revokeRole(deps, "ghost", "invoice-reader", "admin-7")).toThrow(NotFoundError);
    expect(deps.audit.all()).toHaveLength(0);
  });

  // @spec TECH-4
  it("TECH-4: records the actor, user, role and time of every revocation", () => {
    const deps = setup();
    revokeRole(deps, "u-1", "invoice-reader", "admin-7");
    expect(deps.audit.all()).toEqual([
      { actor: "admin-7", userId: "u-1", role: "invoice-reader", action: "revoke", at: new Date("2026-03-01T09:00:00Z") },
    ]);
  });
});
