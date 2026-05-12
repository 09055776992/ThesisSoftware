import test from "node:test";
import assert from "node:assert/strict";
import { rankTopsis } from "../utils/topsis.js";

test("TOPSIS: benefit criterion ranks higher values higher", () => {
  const { scores, ranked } = rankTopsis({
    alternatives: ["A1", "A2"],
    matrix: [
      [1],
      [2],
    ],
    weights: [1],
    impacts: ["benefit"],
  });

  assert.ok(scores.A2 > scores.A1, "A2 should have higher score than A1");
  assert.equal(ranked[0].id, "A2");
  assert.equal(ranked[1].id, "A1");
});

test("TOPSIS: cost criterion prefers lower values", () => {
  const { scores, ranked } = rankTopsis({
    alternatives: ["A1", "A2"],
    matrix: [
      [1],
      [2],
    ],
    weights: [1],
    impacts: ["cost"],
  });

  assert.ok(scores.A1 > scores.A2, "A1 should have higher score than A2");
  assert.equal(ranked[0].id, "A1");
  assert.equal(ranked[1].id, "A2");
});

test("TOPSIS: weight scaling does not change ranking", () => {
  const r1 = rankTopsis({
    alternatives: ["A1", "A2"],
    matrix: [
      [1],
      [2],
    ],
    weights: [1],
    impacts: ["benefit"],
  });
  const r2 = rankTopsis({
    alternatives: ["A1", "A2"],
    matrix: [
      [1],
      [2],
    ],
    weights: [5],
    impacts: ["benefit"],
  });

  assert.equal(r2.ranked[0].id, r1.ranked[0].id);
});

