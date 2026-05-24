# Bugfix Requirements Document

## Introduction

The scholarship eligibility check incorrectly rejects users as "not a Quezon City resident" when their profile `location` field is blank, even when their enrolled school campus is explicitly set to a Quezon City location (e.g., Our Lady of Fatima University – Quezon City Campus). The `location` field is optional in the basic profile and is not clearly labeled as being used for residency eligibility, so many users leave it empty. The residency check in `eligibility-matching.js` only reads from `student.location`, `student.address`, and similar basic profile fields — it never considers `student.schoolLocation` or `student.schoolCampus`, which are already populated and already used in the school enrollment check. This causes a false negative that blocks otherwise eligible applicants from proceeding.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a student's `location` field is blank AND their `schoolLocation` is set to `"quezon-city"` THEN the system rejects the student as "not a Quezon City resident" and returns `isEligible: false` with the message "Must be a Quezon City resident"

1.2 WHEN a student's `location` field is blank AND their `schoolCampus` contains a Quezon City campus name (e.g., "Quezon City Campus") THEN the system rejects the student as "not a Quezon City resident" and returns `isEligible: false`

1.3 WHEN a student has never filled in the optional `location` field in their basic profile THEN the system treats the absence of that field as proof of non-residency, causing a false rejection

### Expected Behavior (Correct)

2.1 WHEN a student's `location` field is blank AND their `schoolLocation` is set to `"quezon-city"` THEN the system SHALL treat the student as a QC resident and allow the eligibility check to continue

2.2 WHEN a student's `location` field is blank AND their `schoolCampus` contains a Quezon City campus identifier THEN the system SHALL treat the student as a QC resident and allow the eligibility check to continue

2.3 WHEN a student's `location` field is blank AND neither `schoolLocation` nor `schoolCampus` indicates Quezon City THEN the system SHALL still reject the student as "not a Quezon City resident"

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a student's `location` field explicitly contains a non-QC value (e.g., "Manila, Philippines") AND their `schoolLocation` is also outside QC THEN the system SHALL CONTINUE TO reject the student as "not a Quezon City resident"

3.2 WHEN a student's `location` field contains a valid Quezon City value (e.g., "Quezon City, Philippines") THEN the system SHALL CONTINUE TO pass the residency check as before

3.3 WHEN a student has `is_qc_resident`, `isQCResident`, or `qcResident` set to `true` THEN the system SHALL CONTINUE TO pass the residency check as before

3.4 WHEN a student passes the residency check, all subsequent eligibility criteria checks (education level, GPA, field of study, income, special categories) SHALL CONTINUE TO behave exactly as before
