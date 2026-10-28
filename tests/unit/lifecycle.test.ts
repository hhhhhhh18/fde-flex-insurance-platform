import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, LifecycleError, TRANSITIONS } from "@/lib/lifecycle/state-machine";

describe("lifecycle state machines", () => {
  it("allows valid policy transitions", () => {
    expect(() => assertTransition("policy", "PENDING_PAYMENT", "ACTIVE")).not.toThrow();
    expect(() => assertTransition("policy", "ACTIVE", "CANCELLED")).not.toThrow();
    expect(() => assertTransition("policy", "ACTIVE", "EXPIRED")).not.toThrow();
  });

  it("rejects reactivating a cancelled policy", () => {
    expect(canTransition("policy", "CANCELLED", "ACTIVE")).toBe(false);
    expect(() => assertTransition("policy", "CANCELLED", "ACTIVE")).toThrow(LifecycleError);
  });

  it("rejects cancelling an expired policy", () => {
    expect(() => assertTransition("policy", "EXPIRED", "CANCELLED")).toThrow(/EXPIRED -> CANCELLED/);
  });

  it("prevents skipped quote states", () => {
    expect(canTransition("quote", "DRAFT", "EVALUATED")).toBe(true);
    expect(canTransition("quote", "DRAFT", "ACCEPTED")).toBe(false);
    expect(canTransition("quote", "EVALUATED", "ACCEPTED")).toBe(true);
    expect(canTransition("quote", "EXPIRED", "ACCEPTED")).toBe(false);
  });

  it("gates endorsement application behind approval", () => {
    expect(canTransition("endorsement", "PENDING", "APPROVED")).toBe(true);
    expect(canTransition("endorsement", "PENDING", "APPLIED")).toBe(false);
    expect(canTransition("endorsement", "APPROVED", "APPLIED")).toBe(true);
    expect(canTransition("endorsement", "REJECTED", "APPLIED")).toBe(false);
  });

  it("prevents deciding a renewal twice", () => {
    expect(canTransition("renewal", "OFFERED", "ACCEPTED")).toBe(true);
    expect(canTransition("renewal", "ACCEPTED", "DECLINED")).toBe(false);
    expect(canTransition("renewal", "DECLINED", "ACCEPTED")).toBe(false);
  });

  it("prevents reconsidering a closed underwriting decision", () => {
    expect(canTransition("underwriting", "PENDING", "APPROVED")).toBe(true);
    expect(canTransition("underwriting", "APPROVED", "DECLINED")).toBe(false);
    expect(canTransition("underwriting", "DECLINED", "APPROVED")).toBe(false);
  });

  it("declares a terminal state for every machine", () => {
    for (const [machine, states] of Object.entries(TRANSITIONS)) {
      const terminals = Object.values(states).filter((next) => next.length === 0);
      expect(terminals.length, `${machine} needs at least one terminal state`).toBeGreaterThan(0);
    }
  });

  it("reports both states in the error message", () => {
    try {
      assertTransition("renewal", "EXPIRED", "ACCEPTED");
      throw new Error("expected a transition failure");
    } catch (error) {
      expect(error).toBeInstanceOf(LifecycleError);
      expect((error as Error).message).toContain("EXPIRED");
      expect((error as Error).message).toContain("ACCEPTED");
    }
  });
});
