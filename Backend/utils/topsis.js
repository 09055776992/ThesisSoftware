/**
 * Generic TOPSIS ranking implementation (no training).
 *
 * Given alternatives evaluated on multiple criteria, returns the closeness
 * coefficient and a descending ranking.
 *
 * Reference formula (standard TOPSIS):
 * - Normalize: r_ij = x_ij / sqrt(sum_i x_ij^2)
 * - Weighted: v_ij = w_j * r_ij
 * - Ideal best/worst per criterion depends on impacts (benefit/cost)
 * - Distances: S_i+ and S_i-
 * - Closeness: C_i = S_i- / (S_i+ + S_i-)
 */

export function rankTopsis({
  alternatives,
  matrix,
  weights,
  impacts,
}) {
  if (!Array.isArray(alternatives) || alternatives.length === 0) {
    throw new Error("alternatives must be a non-empty array");
  }
  if (!Array.isArray(matrix) || matrix.length !== alternatives.length) {
    throw new Error("matrix must be an n x m array matching alternatives length");
  }
  const n = alternatives.length;
  const m = weights?.length ?? 0;
  if (m === 0 || !Array.isArray(impacts) || impacts.length !== m) {
    throw new Error("weights and impacts must be arrays of the same length");
  }
  if (matrix.some((row) => !Array.isArray(row) || row.length !== m)) {
    throw new Error("matrix must have consistent column lengths matching weights/impacts");
  }

  // Normalize weights so their sum is 1 (if sum is 0, fallback to equal weights).
  const sumW = weights.reduce((a, b) => a + (Number.isFinite(+b) ? +b : 0), 0);
  const normalizedWeights =
    sumW === 0 ? weights.map(() => 1 / m) : weights.map((w) => +w / sumW);

  // Precompute denominators for normalization.
  const denom = Array.from({ length: m }, (_, j) => {
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = +matrix[i][j];
      sumSq += x * x;
    }
    return Math.sqrt(sumSq);
  });

  // v_ij
  const v = Array.from({ length: n }, () => Array.from({ length: m }, () => 0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const d = denom[j];
      const x = +matrix[i][j];
      const r = d === 0 ? 0 : x / d;
      v[i][j] = normalizedWeights[j] * r;
    }
  }

  // Ideal best (A+) and worst (A-).
  const idealBest = Array.from({ length: m }, (_, j) => {
    const col = v.map((row) => row[j]);
    const max = Math.max(...col);
    const min = Math.min(...col);
    const impact = impacts[j];
    return impact === "cost" ? min : max; // default to benefit
  });

  const idealWorst = Array.from({ length: m }, (_, j) => {
    const col = v.map((row) => row[j]);
    const max = Math.max(...col);
    const min = Math.min(...col);
    const impact = impacts[j];
    return impact === "cost" ? max : min; // default to benefit
  });

  // Distances to ideals.
  const scores = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sumPlus = 0;
    let sumMinus = 0;
    for (let j = 0; j < m; j++) {
      const diffPlus = v[i][j] - idealBest[j];
      const diffMinus = v[i][j] - idealWorst[j];
      sumPlus += diffPlus * diffPlus;
      sumMinus += diffMinus * diffMinus;
    }
    const Splus = Math.sqrt(sumPlus);
    const Sworst = Math.sqrt(sumMinus);
    const denomDist = Splus + Sworst;
    scores[i] = denomDist === 0 ? 0 : Sworst / denomDist;
  }

  const ranked = alternatives
    .map((alt, i) => ({
      id: typeof alt === "object" ? alt.id : alt,
      score: scores[i],
    }))
    .sort((a, b) => b.score - a.score);

  const scoreById = Object.fromEntries(
    ranked.map((r) => [r.id, r.score])
  );

  return { scores: scoreById, ranked };
}

