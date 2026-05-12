# SCHOLAR System: Two-Algorithm Analysis

## Overview

This document explains the two core algorithms currently used in the SCHOLAR matching flow:

1. TOPSIS for ranking scholarship options
2. Gale-Shapley (many-to-one) for final stable assignment

An eligibility filter is still part of the pipeline, but this analysis focuses only on the two matching algorithms above.

---

## Algorithm 1: TOPSIS Ranking

### Purpose

Ranks scholarships from best to worst fit for each student using multiple weighted criteria.

### Location

- `Backend/utils/topsis.js`
- `Backend/controller/scholarship.controller.js` (API handler)
- `Backend/routes/api.js` (`POST /api/scholarships/topsis/rank`)

### Algorithm Type

Weighted multi-criteria decision making (MCDM).

### How It Works

Given alternatives and criteria values:

1. Normalize each criterion column so values are comparable.
2. Normalize weights so they sum to 1.
3. Build weighted normalized matrix.
4. Compute ideal best and ideal worst values per criterion.
	- Benefit criterion: higher is better.
	- Cost criterion: lower is better.
5. Compute each alternative's distance to ideal best and ideal worst.
6. Compute closeness coefficient:

$$
C_i = \frac{S_i^-}{S_i^+ + S_i^-}
$$

Higher $C_i$ means better rank.

### Input and Output

- Input:
	- `alternatives`
	- `matrix` (n x m)
	- `weights`
	- `impacts` (`benefit` or `cost`)
- Output:
	- `scores` (by alternative id)
	- `ranked` list in descending score

### Time and Space Complexity

- Time: $O(nm)$
- Space: $O(nm)$

Where:
- $n$ = number of alternatives
- $m$ = number of criteria

### Practical Notes

- If all weights sum to 0, the implementation falls back to equal weights.
- If a criterion column has zero variance, its normalized values become 0 for all alternatives.

---

## Algorithm 2: Gale-Shapley Stable Matching (Many-to-One)

### Purpose

Produces final scholarship assignments that are stable and respect scholarship capacities.

### Location

- `Backend/utils/galeShapleyManyToOne.js`
- `Backend/controller/scholarship.controller.js` (API handler)
- `Backend/routes/api.js` (`POST /api/scholarships/gale-shapley/assign`)

### Algorithm Type

Deferred Acceptance Stable Matching (many-to-one).

### How It Works

1. Students propose in preference order.
2. Scholarships tentatively hold best applicants up to capacity.
3. If over capacity, scholarship rejects its current worst held applicant.
4. Rejected student proposes to next preference.
5. Process repeats until no student can propose further.

### Implementation Features

- Many-to-one capacity support
- Incomplete preference lists (unacceptable pairs are rejected)
- Tie groups supported, then deterministically broken by ID
- Optional stability verification via `isStableManyToOne`

### Input and Output

- Input:
	- `proposers` (students with grouped preferences)
	- `receivers` (scholarships with grouped preferences and capacities)
	- optional `tieBreak`
- Output:
	- `matches` (student -> scholarship or `null`)
	- `receiverHolds` (scholarship -> held student ids)
	- `stable` (from controller stability check)

### Time and Space Complexity

- Time: approximately $O(P \times R)$ in common bounded settings
- Space: $O(P + R + E)$

Where:
- $P$ = number of proposers (students)
- $R$ = number of receivers (scholarships)
- $E$ = total acceptable preference edges

---

## How the Two Algorithms Work Together

1. TOPSIS ranks scholarship options (best-fit ordering).
2. That ranking is used to form preference lists.
3. Gale-Shapley consumes those preferences and produces final stable assignments.

In short:
- TOPSIS answers: "Which options look best?"
- Gale-Shapley answers: "Who gets what, fairly and stably?"

---

## Layman's Explanation

### The Big Picture

Imagine two robots helping assign scholarships.

- Robot A (TOPSIS) makes a smart ranked list.
- Robot B (Gale-Shapley) does fair final matching with limited slots.

### Robot A: TOPSIS (The Score-and-Rank Robot)

What it does:

- Looks at many factors at once (grades, need, fit, etc.)
- Gives each scholarship a score
- Sorts scholarships from best to worst for each student

Simple analogy:

- Like comparing phones with weighted features (battery, camera, price), then ranking them.

### Robot B: Gale-Shapley (The Fair Matchmaker Robot)

What it does:

- Uses ranked preferences from students and scholarships
- Assigns students to scholarships with slot limits
- Keeps reshuffling until no better mutual swap exists

Simple analogy:

- Like school seat allocation where students apply by preference and schools keep best candidates until seats are full.

### Why Use Both

- TOPSIS alone gives ranking, but not final fair allocation.
- Gale-Shapley alone allocates fairly, but still needs good preference lists.

Using both gives:

- Better quality preferences
- Fair and stable final assignments
- Transparent, explainable decisions

---

## Quick Comparison

| Aspect | TOPSIS | Gale-Shapley |
|--------|--------|--------------|
| Main job | Rank options | Final assignment |
| Input scope | One student's alternatives | All students and scholarships |
| Output | Score and ranking | Stable matching |
| Guarantee | Consistent weighted ranking | No blocking pairs (stability) |
| Capacity handling | Not applicable | Built in |

---

## Conclusion

The SCHOLAR matching flow is built around two complementary algorithms:

1. TOPSIS for data-driven ranking
2. Gale-Shapley for fair, stable assignment

Together, they deliver a matching process that is practical, explainable, and scalable.

---

*Document Version: 2.0*
*Updated: May 12, 2026*
