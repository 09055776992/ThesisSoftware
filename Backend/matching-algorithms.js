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
    // No field requirement on the scholarship — neutral score, not a bonus
    return 0.0;
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
  // gpaFit stored on profile is used as a fallback when no per-scholarship requirement exists
  const gpaFit = Number.isFinite(gpa) ? clamp(gpa / scale, 0, 1) : 0.5;

  return {
    gpa,
    gpaScale: scale,
    gpaFit,
    financialNeedFit: parseFinancialNeed(profile.financialNeed),
    fieldOfStudy: normalizeText(profile.fieldOfStudy),
    location: normalizeText(profile.location),
    educationLevel: normalizeText(profile.educationLevel),
  };
}

export function rankScholarships(scholarships, profile = {}, studentId = "current-student") {
  const studentProfile = buildStudentProfile(profile);

  // Max deadline window used to normalize urgency to [0,1]
  const MAX_DEADLINE_DAYS = 365;

  const scholarshipInputs = scholarships.map((scholarship) => {
    // --- Education level fit ---
    // Hard signal: does the scholarship's required education level match the student's?
    // 1.0 = exact match, 0.0 = mismatch. This is the most important discriminator.
    const scholarshipEduLevels = (
      scholarship.eligibilityCriteria?.educationLevel ??
      (scholarship.educationLevel ? [scholarship.educationLevel] : [])
    ).map(l => normalizeText(l));

    const studentEduLevel = normalizeText(studentProfile.educationLevel);

    // Canonical level groups for fuzzy matching
    const eduGroups = {
      shs:        ["senior high school", "shs", "senior high", "grade 11", "grade 12"],
      college:    ["college", "undergraduate", "college / undergraduate", "bachelor"],
      postgrad:   ["postgraduate", "postgraduate (masters / doctorate)", "graduate", "masters", "doctorate"],
      vocational: ["vocational", "vocational / tesda", "tesda"],
      jhs:        ["junior high school", "jhs", "junior high"],
    };

    function getEduGroup(level) {
      for (const [group, variants] of Object.entries(eduGroups)) {
        if (variants.some(v => level === v || level.includes(v) || v.includes(level))) return group;
      }
      return null;
    }

    const studentGroup = getEduGroup(studentEduLevel);
    let educationFit = 0.5; // default neutral when no requirement specified
    if (scholarshipEduLevels.length > 0) {
      const scholarshipGroups = scholarshipEduLevels.map(getEduGroup).filter(Boolean);
      if (scholarshipGroups.length === 0) {
        educationFit = 0.5; // Can't determine — neutral
      } else if (studentGroup && scholarshipGroups.includes(studentGroup)) {
        educationFit = 1.0; // Exact group match
      } else {
        educationFit = 0.0; // Mismatch — this scholarship is not for this student's level
      }
    }

    // --- GPA fit ---
    // Philippine GWA scale: lower is better (1.0 = best, 5.0 = fail).
    // SHS uses percentage scale (0–100, higher is better).
    // If student meets the requirement: full credit (1.0).
    // If student misses it: partial credit proportional to closeness.
    // If no GPA requirement: neutral (0.5).
    const minGpa = scholarship.minimumGPA ?? scholarship.minimumGpa ??
                   scholarship.eligibilityCriteria?.minGPA ?? scholarship.eligibilityCriteria?.minGwa;
    let gpaFit;
    if (minGpa == null || !Number.isFinite(Number(minGpa))) {
      gpaFit = 0.5; // No GPA requirement — neutral
    } else {
      const req = Number(minGpa);
      const studentGpa = studentProfile.gpa;
      if (!Number.isFinite(studentGpa)) {
        gpaFit = 0.5; // Unknown GPA — neutral
      } else if (req > 50) {
        // Percentage scale (SHS): higher is better, student must be >= req
        gpaFit = studentGpa >= req ? 1.0 : clamp(studentGpa / req, 0, 1);
      } else {
        // GWA scale: lower is better, student must be <= req
        gpaFit = studentGpa <= req ? 1.0 : clamp(req / studentGpa, 0, 1);
      }
    }

    // --- Field fit ---
    // Scholarships with no field restriction get a neutral score (0.5).
    // Scholarships whose field matches the student's get a high score.
    // Scholarships whose field doesn't match get a low score.
    const scholarshipField = normalizeText(scholarship.fieldOfStudy);
    let fieldFit;
    if (!scholarshipField) {
      fieldFit = 0.5; // Open to all fields — neutral
    } else {
      const studentFieldTokens = tokenize(studentProfile.fieldOfStudy);
      const scholarshipFieldTokens = new Set(tokenize(scholarshipField));
      if (studentFieldTokens.length === 0) {
        fieldFit = 0.5; // Student has no field set — neutral
      } else {
        const matchCount = studentFieldTokens.filter(t => scholarshipFieldTokens.has(t)).length;
        if (matchCount > 0) {
          fieldFit = clamp(matchCount / studentFieldTokens.length, 0.3, 1);
        } else if (scholarshipField.includes(normalizeText(studentProfile.fieldOfStudy)) ||
                   normalizeText(studentProfile.fieldOfStudy).includes(scholarshipField)) {
          fieldFit = 0.75;
        } else {
          fieldFit = 0.1; // Field mismatch — low but not zero
        }
      }
    }

    // --- Financial need fit ---
    // Use the student's raw financial need score directly.
    const financialNeedFit = studentProfile.financialNeedFit;

    // --- Location fit ---
    const locationFit = textMatchScore(scholarship.location, studentProfile.location);

    // --- Deadline urgency ---
    const deadlineDate = new Date(scholarship.deadline);
    const diffMs = Number.isNaN(deadlineDate.getTime()) ? Number.POSITIVE_INFINITY : deadlineDate.getTime() - Date.now();
    const deadlineDays = Number.isFinite(diffMs)
      ? Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      : MAX_DEADLINE_DAYS;
    // 1 day → urgency 1.0 (most urgent); MAX_DEADLINE_DAYS+ → urgency 0.0
    const deadlineUrgency = clamp(1 - (deadlineDays - 1) / (MAX_DEADLINE_DAYS - 1), 0, 1);

    return {
      ...scholarship,
      amountValue: parseAmount(scholarship.amount),
      educationFit,
      gpaFit,
      financialNeedFit,
      fieldFit: clamp(fieldFit, 0, 1),
      locationFit: clamp(locationFit, 0, 1),
      deadlineUrgency,
    };
  });

  const topsisResult = topsisRank(scholarshipInputs, [
    { key: "educationFit",     weight: 0.30, type: "benefit" }, // Most important: right level
    { key: "gpaFit",           weight: 0.20, type: "benefit" }, // Meets GPA requirement
    { key: "financialNeedFit", weight: 0.20, type: "benefit" }, // Financial need alignment
    { key: "fieldFit",         weight: 0.15, type: "benefit" }, // Field of study match
    { key: "locationFit",      weight: 0.10, type: "benefit" }, // Location match
    { key: "deadlineUrgency",  weight: 0.05, type: "benefit" }, // Deadline urgency (tiebreaker)
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
