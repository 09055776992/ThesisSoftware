import test from "node:test";
import assert from "node:assert/strict";
import {
  galeShapleyManyToOne,
  isStableManyToOne,
} from "../utils/galeShapleyManyToOne.js";

test("Gale-Shapley (1-to-1): produces a stable matching", () => {
  const proposers = [
    { id: "p1", preferences: [["r1"], ["r2"]] },
    { id: "p2", preferences: [["r1"], ["r2"]] },
  ];

  const receivers = [
    { id: "r1", capacity: 1, preferences: [["p2"], ["p1"]] },
    { id: "r2", capacity: 1, preferences: [["p1"], ["p2"]] },
  ];

  const { matches, receiverHolds } = galeShapleyManyToOne({
    proposers,
    receivers,
    tieBreak: "id",
  });

  assert.equal(matches.p1, "r2");
  assert.equal(matches.p2, "r1");
  assert.equal(isStableManyToOne({ proposers, receivers, matches, receiverHolds }), true);
});

test("Gale-Shapley (many-to-one): respects capacities", () => {
  const proposers = [
    { id: "s1", preferences: [["c1"], ["c2"]] },
    { id: "s2", preferences: [["c1"]] },
    { id: "s3", preferences: [["c1"], ["c2"]] },
  ];

  const receivers = [
    { id: "c1", capacity: 2, preferences: [["s2"], ["s1"], ["s3"]] },
    { id: "c2", capacity: 1, preferences: [["s1"], ["s3"], ["s2"]] },
  ];

  const { matches, receiverHolds } = galeShapleyManyToOne({
    proposers,
    receivers,
    tieBreak: "id",
  });

  assert.equal(matches.s1, "c1");
  assert.equal(matches.s2, "c1");
  assert.equal(matches.s3, "c2");
  assert.equal(isStableManyToOne({ proposers, receivers, matches, receiverHolds }), true);
});

test("Gale-Shapley: rejects unacceptable pairs (incomplete receiver ranking)", () => {
  const proposers = [
    { id: "s1", preferences: [["c2"], ["c1"]] },
    { id: "s2", preferences: [["c1"]] },
    { id: "s3", preferences: [["c1"], ["c2"]] },
  ];

  // c2 does NOT rank s3 => (s3,c2) is unacceptable to the receiver.
  const receivers = [
    { id: "c1", capacity: 1, preferences: [["s1"], ["s2"], ["s3"]] },
    { id: "c2", capacity: 1, preferences: [["s1"], ["s2"]] },
  ];

  const { matches, receiverHolds } = galeShapleyManyToOne({
    proposers,
    receivers,
    tieBreak: "id",
  });

  // s3 must not be matched to c2.
  assert.notEqual(matches.s3, "c2");
  assert.equal(isStableManyToOne({ proposers, receivers, matches, receiverHolds }), true);
});

test("Gale-Shapley: tie-groups are handled deterministically by ID", () => {
  const proposers = [
    { id: "s1", preferences: [["c1"]] },
    { id: "s2", preferences: [["c1"]] },
    { id: "s3", preferences: [["c1"]] },
  ];

  // c1 prefers s1 and s3 equally (tie), then s2.
  // With tie-break-by-id, ordering within {s1,s3} becomes s1 first then s3.
  const receivers = [
    { id: "c1", capacity: 2, preferences: [[ "s3", "s1" ], ["s2"]] },
  ];

  const { matches, receiverHolds } = galeShapleyManyToOne({
    proposers,
    receivers,
    tieBreak: "id",
  });

  // c1 can hold 2; deterministic outcome should always keep s1 and s3 (since s2 is last).
  const held = receiverHolds.c1.slice().sort();
  assert.deepEqual(held, ["s1", "s3"].sort());
  assert.equal(isStableManyToOne({ proposers, receivers, matches, receiverHolds }), true);
});

