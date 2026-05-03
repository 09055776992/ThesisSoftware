function topsisRank(alternatives, criteria) {
  if (!alternatives.length) {
    return [];
  }

  const denominatorByCriterion = criteria.reduce((acc, criterion) => {
    const squaredSum = alternatives.reduce((sum, option) => {
      const value = Number(option[criterion.key] ?? 0);
      return sum + value * value;
    }, 0);
    acc[criterion.key] = Math.sqrt(squaredSum) || 1;
    return acc;
  }, {});

  const weightedMatrix = alternatives.map((option) => {
    const weightedValues = criteria.reduce((acc, criterion) => {
      const normalized = Number(option[criterion.key] ?? 0) / denominatorByCriterion[criterion.key];
      acc[criterion.key] = normalized * criterion.weight;
      return acc;
    }, {});
    return { option, weightedValues };
  });

  const idealBest = criteria.reduce((acc, criterion) => {
    const values = weightedMatrix.map((row) => row.weightedValues[criterion.key]);
    acc[criterion.key] = criterion.type === "benefit" ? Math.max(...values) : Math.min(...values);
    return acc;
  }, {});

  const idealWorst = criteria.reduce((acc, criterion) => {
    const values = weightedMatrix.map((row) => row.weightedValues[criterion.key]);
    acc[criterion.key] = criterion.type === "benefit" ? Math.min(...values) : Math.max(...values);
    return acc;
  }, {});

  return weightedMatrix
    .map(({ option, weightedValues }) => {
      const dPlus = Math.sqrt(
        criteria.reduce((sum, criterion) => {
          const diff = weightedValues[criterion.key] - idealBest[criterion.key];
          return sum + diff * diff;
        }, 0),
      );

      const dMinus = Math.sqrt(
        criteria.reduce((sum, criterion) => {
          const diff = weightedValues[criterion.key] - idealWorst[criterion.key];
          return sum + diff * diff;
        }, 0),
      );

      const closeness = dMinus / (dPlus + dMinus || 1);
      return { option, closeness };
    })
    .sort((a, b) => b.closeness - a.closeness);
}

function galeShapley(proposerPreferences, receiverPreferences) {
  const freeProposers = Object.keys(proposerPreferences);
  const nextIndex = {};
  const currentMatchByReceiver = {};

  for (const proposer of freeProposers) {
    nextIndex[proposer] = 0;
  }

  const receiverRank = {};
  for (const [receiver, prefs] of Object.entries(receiverPreferences)) {
    receiverRank[receiver] = {};
    prefs.forEach((proposer, idx) => {
      receiverRank[receiver][proposer] = idx;
    });
  }

  while (freeProposers.length > 0) {
    const proposer = freeProposers.shift();
    if (!proposer) break;

    const prefs = proposerPreferences[proposer] ?? [];
    if (nextIndex[proposer] >= prefs.length) {
      continue;
    }

    const receiver = prefs[nextIndex[proposer]];
    nextIndex[proposer] += 1;

    if (!receiver) {
      continue;
    }

    const current = currentMatchByReceiver[receiver];
    if (!current) {
      currentMatchByReceiver[receiver] = proposer;
      continue;
    }

    const rank = receiverRank[receiver] ?? {};
    const prefersNew = (rank[proposer] ?? Number.MAX_SAFE_INTEGER) < (rank[current] ?? Number.MAX_SAFE_INTEGER);

    if (prefersNew) {
      currentMatchByReceiver[receiver] = proposer;
      freeProposers.push(current);
    } else {
      freeProposers.push(proposer);
    }
  }

  return Object.entries(currentMatchByReceiver).map(([receiver, proposer]) => ({
    receiver,
    proposer,
  }));
}

function parseAmount(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  return Number(value.replace(/[$,]/g, "")) || 0;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((segment) => segment.length > 2);
}

function textMatchScore(source, target) {
  const targetTokens = tokenize(target);
  if (targetTokens.length === 0) {
    return 0.5;
  }

  const sourceText = normalizeText(source);
  const sourceTokens = new Set(tokenize(sourceText));
  const matches = targetTokens.filter((token) => sourceTokens.has(token)).length;

  if (matches > 0) {
    return clamp(matches / targetTokens.length, 0.2, 1);
  }

  if (sourceText.includes(normalizeText(target))) {
    return 0.75;
  }

  return 0.25;
}

function parseGpaScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : 4;
}

function parseFinancialNeed(value) {
  if (Array.isArray(value) && value.length > 0) {
    return clamp(Number(value[0]) / 5, 0, 1);
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return clamp(numeric / 5, 0, 1);
  }

  return 0.5;
}

function getScholarshipId(scholarship) {
  return String(scholarship?._id ?? scholarship?.id ?? "");
}

function buildStudentProfile(profile = {}) {
  const gpa = Number(profile.gpa);
  const scale = parseGpaScale(profile.gpaScale);
  const gpaFit = Number.isFinite(gpa) ? clamp(gpa / scale, 0, 1) : 0.5;

  return {
    gpaFit,
    financialNeedFit: parseFinancialNeed(profile.financialNeed),
    fieldOfStudy: normalizeText(profile.fieldOfStudy),
    location: normalizeText(profile.location),
    educationLevel: normalizeText(profile.educationLevel),
  };
}

export function rankScholarships(scholarships, profile = {}, studentId = "current-student") {
  const studentProfile = buildStudentProfile(profile);

  const scholarshipInputs = scholarships.map((scholarship) => {
    const scholarshipText = [
      scholarship.name,
      scholarship.provider,
      scholarship.type,
      scholarship.eligibility,
      scholarship.description,
      scholarship.location,
    ].join(" ");

    const needBasedScore = normalizeText(scholarship.type).includes("need") ? 1 : 0.7;
    const fieldScore = Math.max(
      textMatchScore(scholarshipText, studentProfile.fieldOfStudy),
      textMatchScore(scholarship.eligibility, studentProfile.educationLevel),
    );
    const locationScore = textMatchScore(scholarship.location, studentProfile.location);
    const deadlineDate = new Date(scholarshicap.deadline);
    const diffMs = Number.isNaN(deadlineDate.getTime()) ? Number.POSITIVE_INFINITY : deadlineDate.getTime() - Date.now();
    const deadlineUrgencyDays = Number.isFinite(diffMs)
      ? Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      : 3650;

    return {
      ...scholarship,
      amountValue: parseAmount(scholarship.amount),
      gpaFit: studentProfile.gpaFit,
      financialNeedFit: clamp(studentProfile.financialNeedFit * needBasedScore, 0, 1),
      fieldFit: clamp(fieldScore, 0, 1),
      locationFit: clamp(locationScore, 0, 1),
      deadlineUrgencyDays,
    };
  });

  const topsisResult = topsisRank(scholarshipInputs, [
    { key: "gpaFit", weight: 0.25, type: "benefit" },
    { key: "financialNeedFit", weight: 0.25, type: "benefit" },
    { key: "fieldFit", weight: 0.25, type: "benefit" },
    { key: "locationFit", weight: 0.1, type: "benefit" },
    { key: "deadlineUrgencyDays", weight: 0.15, type: "cost" },
  ]);

  const proposerPreferences = {
    [studentId]: topsisResult.map((row) => getScholarshipId(row.option)),
  };

  const receiverPreferences = Object.fromEntries(
    scholarshipInputs.map((scholarship) => [getScholarshipId(scholarship), [studentId]]),
  );

  const stableMatches = galeShapley(proposerPreferences, receiverPreferences);
  const matchedScholarshipIds = new Set(stableMatches.map((pair) => String(pair.receiver)));

  return topsisResult.map((row) => ({
    ...row.option,
    matchScore: Math.round(row.closeness * 100),
    isStableMatch: matchedScholarshipIds.has(getScholarshipId(row.option)),
  }));
}
