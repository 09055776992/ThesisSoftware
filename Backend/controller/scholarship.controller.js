import { rankTopsis } from "../utils/topsis.js";
import {
  galeShapleyManyToOne,
  isStableManyToOne,
} from "../utils/galeShapleyManyToOne.js";

// POST /api/scholarships/topsis/rank
export const topsisRank = (req, res) => {
  try {
    const { alternatives, matrix, weights, impacts } = req.body ?? {};

    const result = rankTopsis({ alternatives, matrix, weights, impacts });
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err?.message ?? "Failed to rank TOPSIS" });
  }
};

// POST /api/scholarships/gale-shapley/assign
export const galeShapleyAssign = (req, res) => {
  try {
    const { tieBreak = "id", proposers, receivers } = req.body ?? {};
    const { matches, receiverHolds } = galeShapleyManyToOne({
      proposers,
      receivers,
      tieBreak,
    });

    // Stability check helps verify the deterministic tie-break correctness.
    const stable = isStableManyToOne({
      proposers,
      receivers,
      matches,
      receiverHolds,
      tieBreak,
    });

    res.json({ matches, receiverHolds, stable });
  } catch (err) {
    res.status(400).json({
      message: err?.message ?? "Failed to compute Gale-Shapley assignment",
    });
  }
};

