import { describe, expect, it } from "vitest";
import { createSingleFlight, createWriteQueue } from "../src/storage/storageGuards";

describe("storage guards", () => {
  it("runs concurrent initialization requests through one in-flight task", async () => {
    let runs = 0;
    const initialize = createSingleFlight(async () => {
      runs += 1;
      return "ready";
    });

    const result = await Promise.all([initialize(), initialize(), initialize()]);

    expect(result).toEqual(["ready", "ready", "ready"]);
    expect(runs).toBe(1);
  });

  it("serializes writes in call order", async () => {
    const order: string[] = [];
    const enqueue = createWriteQueue();

    await Promise.all([
      enqueue(async () => {
        order.push("first");
      }),
      enqueue(async () => {
        order.push("second");
      }),
      enqueue(async () => {
        order.push("third");
      })
    ]);

    expect(order).toEqual(["first", "second", "third"]);
  });
});
