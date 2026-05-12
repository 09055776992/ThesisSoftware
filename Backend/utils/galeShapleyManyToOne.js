/**
 * Gale-Shapley many-to-one stable matching (students -> scholarships).
 *
 * Supports:
 * - capacities on receivers
 * - incomplete preference lists (unacceptable pairs)
 * - ties, represented as preference groups, resolved deterministically by ID
 *
 * Input format (for preferences):
 * - proposer.preferences: array of tie-groups from best to worst:
 *   e.g. [ ["sch1","sch2"], ["sch3"] ]
 * - receiver.preferences: array of tie-groups from best to worst:
 *   e.g. [ ["student3"], ["student1","student7"] ]
 *
 * Tie-breaking:
 * - This implementation converts each tie-group into a strict order by sorting
 *   IDs lexicographically (deterministic).
 */

function normalizePreferenceGroups({ groups, tieBreak }) {
  if (!groups) return [];
  if (!Array.isArray(groups)) {
    throw new Error("preferences must be an array of tie-groups (array of arrays)");
  }

  const sortedGroups = groups.map((group) => {
    if (!Array.isArray(group)) {
      throw new Error("each preference tie-group must be an array of receiver/proposer IDs");
    }
    if (tieBreak === "none") return [...group];
    // Deterministic tie-break by ID string.
    return [...group].sort((a, b) => String(a).localeCompare(String(b)));
  });

  return sortedGroups.flatMap((g) => g);
}

export function galeShapleyManyToOne({
  proposers,
  receivers,
  tieBreak = "id",
}) {
  if (!Array.isArray(proposers) || proposers.length === 0) {
    throw new Error("proposers must be a non-empty array");
  }
  if (!Array.isArray(receivers) || receivers.length === 0) {
    throw new Error("receivers must be a non-empty array");
  }

  const proposerIds = proposers.map((p) => p.id);
  const receiverIds = receivers.map((r) => r.id);

  const proposerStrictPrefs = new Map();
  const proposerPrefRank = new Map(); // proposerPrefRank.get(pId).get(rId) => rankIndex (lower is better)
  for (const p of proposers) {
    const strict = normalizePreferenceGroups({
      groups: p.preferences,
      tieBreak,
    });
    proposerStrictPrefs.set(p.id, strict);
    const rank = new Map();
    strict.forEach((rid, idx) => rank.set(rid, idx));
    proposerPrefRank.set(p.id, rank);
  }

  const receiverCapacity = new Map();
  const receiverStrictPrefs = new Map();
  const receiverPrefRank = new Map(); // receiverPrefRank.get(rId).get(pId) => rankIndex
  for (const r of receivers) {
    const cap = r.capacity ?? 1;
    const capacity = Number(cap);
    receiverCapacity.set(r.id, Number.isFinite(capacity) ? capacity : 1);

    const strict = normalizePreferenceGroups({
      groups: r.preferences,
      tieBreak,
    });
    receiverStrictPrefs.set(r.id, strict);

    const rank = new Map();
    strict.forEach((pid, idx) => rank.set(pid, idx));
    receiverPrefRank.set(r.id, rank);
  }

  const matches = new Map(); // proposerId -> receiverId|null
  for (const pid of proposerIds) matches.set(pid, null);

  const held = new Map(); // receiverId -> array of currently held proposerIds
  for (const rid of receiverIds) held.set(rid, []);

  const nextIndex = new Map();
  for (const pid of proposerIds) nextIndex.set(pid, 0);

  // Queue of proposers that still may make proposals.
  const queue = [...proposerIds];
  while (queue.length > 0) {
    const pId = queue.shift();
    if (matches.get(pId) !== null) continue; // already matched; can ignore

    const strictPrefs = proposerStrictPrefs.get(pId) ?? [];
    const idx = nextIndex.get(pId) ?? 0;
    if (idx >= strictPrefs.length) continue; // exhausted

    const rId = strictPrefs[idx];
    nextIndex.set(pId, idx + 1);

    // If receiver doesn't rank this proposer, pair is unacceptable => reject immediately.
    const rRank = receiverPrefRank.get(rId);
    if (!rRank || !rRank.has(pId)) {
      queue.push(pId);
      continue;
    }

    const capacity = receiverCapacity.get(rId) ?? 1;
    // Capacity 0 means receiver holds nothing; reject.
    if (capacity <= 0) {
      queue.push(pId);
      continue;
    }

    const currentHeld = held.get(rId);
    currentHeld.push(pId);

    // If over capacity, reject the worst-ranked held proposer.
    if (currentHeld.length > capacity) {
      let worst = currentHeld[0];
      for (let i = 1; i < currentHeld.length; i++) {
        const cand = currentHeld[i];
        const candRank = rRank.get(cand);
        const worstRank = rRank.get(worst);
        if (candRank > worstRank) worst = cand; // higher index is worse
      }

      // Remove worst from held.
      held.set(
        rId,
        currentHeld.filter((pid) => pid !== worst)
      );
      matches.set(worst, null); // rejected proposer becomes free
      // Re-queue rejected proposer if it still has preferences left.
      if ((nextIndex.get(worst) ?? 0) < (proposerStrictPrefs.get(worst) ?? []).length) {
        queue.push(worst);
      }
    }

    // Tentatively hold pId (if still present after possible rejection).
    const newHeld = held.get(rId);
    if (newHeld.includes(pId)) {
      matches.set(pId, rId);
    }
  }

  const receiverHolds = {};
  for (const rid of receiverIds) {
    receiverHolds[rid] = held.get(rid) ?? [];
  }

  return { matches: Object.fromEntries([...matches.entries()].map(([k, v]) => [k, v])), receiverHolds };
}

export function isStableManyToOne({
  proposers,
  receivers,
  matches,
  receiverHolds,
  tieBreak = "id",
}) {
  const proposerStrictPrefs = new Map();
  const proposerPrefRank = new Map();
  for (const p of proposers) {
    const strict = normalizePreferenceGroups({
      groups: p.preferences,
      tieBreak,
    });
    proposerStrictPrefs.set(p.id, strict);
    const rank = new Map();
    strict.forEach((rid, idx) => rank.set(rid, idx));
    proposerPrefRank.set(p.id, rank);
  }

  const receiverCapacity = new Map();
  const receiverPrefRank = new Map();
  for (const r of receivers) {
    receiverCapacity.set(r.id, Number(r.capacity ?? 1));

    const strict = normalizePreferenceGroups({
      groups: r.preferences,
      tieBreak,
    });
    const rank = new Map();
    strict.forEach((pid, idx) => rank.set(pid, idx));
    receiverPrefRank.set(r.id, rank);
  }

  // Helper: return rankIndex or null if unacceptable.
  const prefRank = (rankMap, a, b) => {
    const m = rankMap.get(a);
    if (!m) return null;
    return m.has(b) ? m.get(b) : null;
  };

  for (const p of proposers) {
    const pId = p.id;
    const pRankMap = proposerPrefRank.get(pId) ?? new Map();
    const currentR = matches[pId] ?? null;

    for (const rId of proposerStrictPrefs.get(pId) ?? []) {
      // If p is already matched to rId, then p does not strictly prefer rId over current match.
      if (currentR === rId) continue;

      const pRankOfR = pRankMap.get(rId);
      if (pRankOfR === undefined) continue;

      const pRankOfCurrent = currentR ? pRankMap.get(currentR) : null;
      const prefersR =
        currentR === null || pRankOfCurrent === undefined || pRankOfR < pRankOfCurrent;
      if (!prefersR) continue;

      // Pair only considered blocking if receiver also finds proposer acceptable.
      const rRankMap = receiverPrefRank.get(rId);
      if (!rRankMap || !rRankMap.has(pId)) continue;

      const cap = receiverCapacity.get(rId) ?? 1;
      const held = (receiverHolds?.[rId] ?? []).slice();

      if (held.length < cap) {
        return false; // r has free capacity and would prefer p
      }

      // r is full: check if r prefers p to its worst held proposer.
      let worstHeld = held[0];
      for (let i = 1; i < held.length; i++) {
        const cand = held[i];
        const candRank = rRankMap.get(cand);
        const worstRank = rRankMap.get(worstHeld);
        if (candRank > worstRank) worstHeld = cand;
      }

      const worstRank = rRankMap.get(worstHeld);
      const pRank = rRankMap.get(pId);
      if (pRank < worstRank) {
        return false;
      }
    }
  }

  return true;
}

