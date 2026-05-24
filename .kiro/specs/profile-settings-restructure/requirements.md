# Requirements Document

## Introduction

The SCHOLAR system currently places all student credential fields — GPA, Education Level, Year Level, School Name, School Type, School Location, Academic Honors, Special Categories (Athlete, Artist, SK Official, etc.), Field of Study, Graduation Year, Financial Need, Net Worth, Currency, and Income Category — inside the Settings page. The My Profile page is read-only.

This feature restructures the two pages so that the My Profile page becomes the single place where students view and edit all credential and profile information, organized into three editable tab sections (About, Education, Achievements). The Settings page is stripped down to only Account & Security and Preferences. Three new section-specific PATCH endpoints are introduced on the backend so each tab saves independently without touching unrelated fields. The `💚` emoji is also removed from the Indigent eligibility badge to keep the UI professional.

---

## Glossary

- **Profile_Page**: The `profile.tsx` React component rendered at `/dashboard/profile`, which displays and (after this restructure) allows editing of all student credential and personal information.
- **Settings_Page**: The `settings.tsx` React component rendered at `/dashboard/settings`, which after this restructure contains only Account & Security and Preferences sections.
- **About_Tab**: The first tab on the Profile_Page, containing personal information fields: Full Name, Phone, Location, Date of Birth, Bio, Skills, and Profile Picture.
- **Education_Tab**: The second tab on the Profile_Page, containing academic credential fields: GPA, Education Level, Year Level, Field of Study, Graduation Year, School Name, Campus, School Type, School Location, Academic Honors, and Class Rank.
- **Achievements_Tab**: The third tab on the Profile_Page, containing Special Categories checkboxes and financial information fields: Financial Need, Net Worth, Currency, and Income Category.
- **Edit_Mode**: A per-tab boolean state that, when true, replaces the read-only view with an editable form for that tab.
- **Draft_State**: The local form state within an edit form component, initialized from the current user data and discarded on Cancel.
- **Personal_PATCH_Endpoint**: `PATCH /api/users/profile/personal` — saves only personal info fields.
- **Academic_PATCH_Endpoint**: `PATCH /api/users/profile/academic` — saves only academic credential fields.
- **Achievements_PATCH_Endpoint**: `PATCH /api/users/profile/achievements` — saves only special categories and financial fields.
- **Eligibility_Badge**: A `<Badge>` chip rendered in the Profile_Page header and sidebar that summarizes a student's scholarship-relevant attributes.
- **StoredUser**: The user object persisted in `localStorage` via `user-storage.ts`.
- **GPA_Clamp**: The function that constrains a GPA numeric input to the range [1.00, 5.00] on the Philippine scale.
- **enrolledInQCSchool**: A boolean field derived server-side as `schoolLocation === "Quezon City"`, used for Quezon City–specific scholarship eligibility.

---

## Requirements

### Requirement 1: Settings Page Restructure

**User Story:** As a student, I want the Settings page to contain only account security and preferences controls, so that I am not confused about where to manage my profile versus my account.

#### Acceptance Criteria

1. THE Settings_Page SHALL NOT render any form fields for GPA, educationLevel, yearLevel, fieldOfStudy, graduationYear, schoolName, schoolCampus, schoolType, schoolLocation, financialNeed, netWorth, incomeCategory, isAthlete, isArtist, isSKOfficial, isStudentLeader, isIndigent, isPWD, or isSoloParent.
2. THE Settings_Page SHALL render an Account & Security section containing controls for Email Notifications, Privacy Settings, Password, and Two-Factor Authentication.
3. THE Settings_Page SHALL render a Preferences section containing controls for Language and Theme selection.
4. WHEN a student saves a preference change in the Settings_Page, THE Settings_Page SHALL persist the updated language and theme values to StoredUser and apply the theme change immediately to the document root.

---

### Requirement 2: My Profile Page — Editable About Tab

**User Story:** As a student, I want to edit my personal information directly on the My Profile page, so that I can update my name, contact details, bio, and skills without navigating to Settings.

#### Acceptance Criteria

1. THE Profile_Page SHALL display an [✏ Edit Profile] button in the profile header that, when clicked, activates Edit_Mode for the About_Tab and switches the active tab to About.
2. WHEN Edit_Mode is inactive for the About_Tab, THE Profile_Page SHALL render a read-only view of the student's bio and skills.
3. WHEN Edit_Mode is active for the About_Tab, THE Profile_Page SHALL render an editable form containing fields for Full Name (required), Phone Number (optional), Location (required), Date of Birth (optional), Bio (optional), Skills (optional, comma-separated), and Profile Picture (optional, JPG/PNG/WebP, max 5 MB).
4. WHEN a student clicks [Cancel] in the About_Tab edit form, THE About_Tab SHALL reset all Draft_State fields to the values from the current StoredUser and deactivate Edit_Mode.
5. WHEN a student submits the About_Tab edit form with a non-empty Full Name and non-empty Location, THE About_Tab SHALL call the Personal_PATCH_Endpoint, update StoredUser with the saved fields, deactivate Edit_Mode, and display a success toast.
6. IF the Personal_PATCH_Endpoint returns a network error or 5xx response, THEN THE About_Tab SHALL display an error toast, keep Edit_Mode active, and preserve all Draft_State values.
7. IF the Personal_PATCH_Endpoint returns a 404 response, THEN THE About_Tab SHALL display a session-expired error toast and redirect the student to the sign-in page.
8. WHEN a student selects a profile picture file that exceeds 5 MB or has an unsupported MIME type, THE About_Tab SHALL reject the file and display an inline error message without affecting other Draft_State fields.
9. IF the avatar upload call fails after a valid file is selected, THEN THE About_Tab SHALL revert the profile image preview to the previous value and display an error toast without affecting other Draft_State fields.

---

### Requirement 3: My Profile Page — Editable Education Tab

**User Story:** As a student, I want to edit my academic credentials directly on the My Profile page, so that my GPA, school information, and education level are always accurate for scholarship matching.

#### Acceptance Criteria

1. WHEN Edit_Mode is inactive for the Education_Tab, THE Profile_Page SHALL render a read-only summary of the student's school name, campus, school type, school location, education level, year level, field of study, graduation year, GPA with descriptive label, and academic honors badge (if applicable).
2. WHEN Edit_Mode is active for the Education_Tab, THE Profile_Page SHALL render an editable form containing fields for GPA (numeric, Philippine scale 1.00–5.00), Education Level (Select), Year Level (Select, options dependent on Education Level), Field of Study (text), Graduation Year (numeric), School / Institution Name (required text), Campus / Branch (optional text), School Type (Select), School Location (Select), Graduated with Academic Honors (checkbox), and Class Rank (Select, visible only when the honors checkbox is checked).
3. WHEN a student changes the Education Level selection, THE Education_Tab SHALL reset the Year Level selection to empty and display only the valid Year Level options for the newly selected Education Level.
4. WHEN a student enters a GPA value and moves focus away from the GPA field, THE Education_Tab SHALL clamp the value to the nearest bound within [1.00, 5.00] and display the helper text "Philippine GPA scale: 1.00 = Highest (Excellent), 3.00 = Minimum Passing, 5.00 = Failing."
5. WHEN a student submits the Education_Tab edit form, THE Education_Tab SHALL call the Academic_PATCH_Endpoint, update StoredUser with the saved academic fields, deactivate Edit_Mode, and display a success toast.
6. IF the Academic_PATCH_Endpoint returns a 400 response for an out-of-range GPA, THEN THE Education_Tab SHALL display an inline error message below the GPA field and keep Edit_Mode active.
7. IF the Academic_PATCH_Endpoint returns a network error or 5xx response, THEN THE Education_Tab SHALL display an error toast, keep Edit_Mode active, and preserve all Draft_State values.
8. WHEN a student clicks [Cancel] in the Education_Tab edit form, THE Education_Tab SHALL reset all Draft_State fields to the values from the current StoredUser and deactivate Edit_Mode.

---

### Requirement 4: My Profile Page — Editable Achievements Tab

**User Story:** As a student, I want to edit my special categories and financial information directly on the My Profile page, so that scholarship providers can accurately assess my eligibility for need-based and category-specific scholarships.

#### Acceptance Criteria

1. WHEN Edit_Mode is inactive for the Achievements_Tab, THE Profile_Page SHALL render only the special category badges that are set to true for the student, and display the student's income category and financial need rating.
2. WHEN Edit_Mode is active for the Achievements_Tab, THE Profile_Page SHALL render checkboxes for Athlete, Artist, SK Official / Youth Leader, Student Council / Government Leader, From Indigent / Low-income Family, Person with Disability (PWD), and Solo Parent, plus fields for Financial Need (integer 1–5), Net Worth (optional, ₱ prefix), Currency (Select, default PHP), and Income Category (Select).
3. WHEN a student submits the Achievements_Tab edit form, THE Achievements_Tab SHALL call the Achievements_PATCH_Endpoint, update StoredUser with the saved achievements and financial fields, deactivate Edit_Mode, and display a success toast.
4. IF the Achievements_PATCH_Endpoint returns a 400 response for a Financial Need value outside [1, 5], THEN THE Achievements_Tab SHALL display an inline error message below the Financial Need field and keep Edit_Mode active.
5. IF the Achievements_PATCH_Endpoint returns a network error or 5xx response, THEN THE Achievements_Tab SHALL display an error toast, keep Edit_Mode active, and preserve all Draft_State values.
6. WHEN a student clicks [Cancel] in the Achievements_Tab edit form, THE Achievements_Tab SHALL reset all Draft_State fields to the values from the current StoredUser and deactivate Edit_Mode.

---

### Requirement 5: Section-Specific Backend PATCH Endpoints

**User Story:** As a system, I want three dedicated PATCH endpoints for personal, academic, and achievements data, so that saving one section does not overwrite unrelated fields in the database.

#### Acceptance Criteria

1. THE Personal_PATCH_Endpoint SHALL accept a request body containing email (required) and any subset of fullName, phone, location, dateOfBirth, about, headline, and skills, and update only those fields in the MongoDB users collection for the matching email.
2. THE Academic_PATCH_Endpoint SHALL accept a request body containing email (required) and any subset of gpa, educationLevel, yearLevel, fieldOfStudy, graduationYear, schoolName, schoolCampus, schoolType, schoolLocation, enrolledInQCSchool, hasAcademicHonors, and academic_rank, and update only those fields in the MongoDB users collection.
3. THE Achievements_PATCH_Endpoint SHALL accept a request body containing email (required) and any subset of isAthlete, isArtist, isSKOfficial, isStudentLeader, isIndigent, isPWD, isSoloParent, financialNeed, netWorth, currency, and incomeCategory, and update only those fields in the MongoDB users collection.
4. WHEN the Academic_PATCH_Endpoint receives a request, THE Academic_PATCH_Endpoint SHALL derive enrolledInQCSchool as true if and only if schoolLocation equals "Quezon City", regardless of the value provided in the request body.
5. IF the Personal_PATCH_Endpoint, Academic_PATCH_Endpoint, or Achievements_PATCH_Endpoint receives a request with a missing or empty email field, THEN THE endpoint SHALL return HTTP 400 with the error message "email is required."
6. IF the Personal_PATCH_Endpoint, Academic_PATCH_Endpoint, or Achievements_PATCH_Endpoint cannot find a user matching the provided email, THEN THE endpoint SHALL return HTTP 404 with the error message "User not found."
7. IF the Academic_PATCH_Endpoint receives a gpa value that is not a numeric string in the range [1.00, 5.00], THEN THE Academic_PATCH_Endpoint SHALL return HTTP 400 with the error message "GPA must be between 1.00 and 5.00."
8. IF the Achievements_PATCH_Endpoint receives a financialNeed value that is not an integer in the range [1, 5], THEN THE Achievements_PATCH_Endpoint SHALL return HTTP 400 with the error message "financialNeed must be between 1 and 5."
9. THE legacy PUT /api/users/profile endpoint SHALL continue to accept all profile fields and return HTTP 200 to maintain backward compatibility with existing clients.
10. AFTER a successful call to the Personal_PATCH_Endpoint, THE MongoDB users collection SHALL retain the pre-existing values of all academic and achievements fields for that user unchanged.

---

### Requirement 6: Eligibility Badge Display

**User Story:** As a student, I want my eligibility badges to display accurately and professionally, so that scholarship providers see a clean summary of my qualifications.

#### Acceptance Criteria

1. THE Profile_Page SHALL render Eligibility_Badges only for attributes that are set to a truthy value in the student's StoredUser, and the resulting badge array SHALL contain only non-empty strings.
2. WHEN a student has isIndigent set to true, THE Profile_Page SHALL render the Indigent badge with the label "Indigent/Low-income" and SHALL NOT include any Unicode emoji character in that badge string.
3. WHEN a student has no eligibility attributes set, THE Profile_Page SHALL render a single placeholder badge with the text "Complete your profile to see scholarship matches".

---

### Requirement 7: Edit Mode State Management

**User Story:** As a student, I want each profile tab to manage its own edit mode independently, so that editing one section does not disrupt the view state of other sections.

#### Acceptance Criteria

1. THE Profile_Page SHALL maintain independent Edit_Mode boolean state for the About_Tab, Education_Tab, and Achievements_Tab such that activating Edit_Mode in one tab does not affect the Edit_Mode state of any other tab.
2. WHEN Edit_Mode is toggled for any tab, THE Profile_Page SHALL reflect the new state immediately without requiring a page reload.
3. WHEN a save operation completes successfully in any tab, THE Profile_Page SHALL update the localUser state optimistically with the saved fields so that the read-only view reflects the changes immediately without a server re-fetch.
4. WHEN Edit_Mode is active for a tab and the student navigates to a different tab, THE Profile_Page SHALL preserve the Draft_State of the original tab so that returning to it restores the unsaved edits.
