# Implementation Plan: Profile Settings Restructure

## Overview

Refactor the SCHOLAR frontend and backend so that `profile.tsx` becomes the single editable hub for all student credential and personal data (organized into About, Education, and Achievements tabs), while `settings.tsx` is stripped down to Account & Security and Preferences only. Three new section-specific PATCH endpoints are added to `Backend/index.js` using `$set` (not `replaceOne`) so each tab saves independently. The `💚` emoji is removed from the Indigent eligibility badge.

---

## Tasks

- [x] 1. Add three section-specific PATCH endpoints to `Backend/index.js`
  - [x] 1.1 Implement `PATCH /api/users/profile/personal`
    - Add route handler after the existing `PUT /api/users/profile` registration
    - Accept `email` (required) plus any subset of `fullName`, `phone`, `location`, `dateOfBirth`, `about`, `headline`, `skills`
    - Normalize email; return 400 `"email is required."` if missing, 404 `"User not found."` if no match
    - Use `db.collection("users").updateOne({ email }, { $set: personalFields })` — never `replaceOne`
    - Return 200 `{ user: { ...updatedFields }, message: "Personal info updated." }`
    - _Requirements: 5.1, 5.5, 5.6, 5.9, 5.10_

  - [x] 1.2 Implement `PATCH /api/users/profile/academic`
    - Accept `email` (required) plus any subset of `gpa`, `educationLevel`, `yearLevel`, `fieldOfStudy`, `graduationYear`, `schoolName`, `schoolCampus`, `schoolType`, `schoolLocation`, `hasAcademicHonors`, `academic_rank`
    - Validate `gpa` when provided: numeric, 1.00 ≤ value ≤ 5.00; return 400 `"GPA must be between 1.00 and 5.00."` on failure
    - Derive `enrolledInQCSchool = (schoolLocation === "Quezon City")` server-side, ignoring any client-supplied value
    - Use `updateOne` with `$set`; return 200 `{ user: { ...updatedFields }, message: "Academic info updated." }`
    - _Requirements: 5.2, 5.4, 5.5, 5.6, 5.7_

  - [x] 1.3 Implement `PATCH /api/users/profile/achievements`
    - Accept `email` (required) plus any subset of `isAthlete`, `isArtist`, `isSKOfficial`, `isStudentLeader`, `isIndigent`, `isPWD`, `isSoloParent`, `financialNeed`, `netWorth`, `currency`, `incomeCategory`
    - Validate `financialNeed` when provided: integer 1–5; return 400 `"financialNeed must be between 1 and 5."` on failure
    - Use `updateOne` with `$set`; return 200 `{ user: { ...updatedFields }, message: "Achievements updated." }`
    - _Requirements: 5.3, 5.5, 5.6, 5.8_

- [x] 2. Checkpoint — Backend endpoints
  - Ensure all three new routes are registered in `index.js` and the existing `PUT /api/users/profile` still responds with 200. Ask the user if questions arise.

- [x] 3. Add `patchPersonalProfile`, `patchAcademicProfile`, `patchAchievementsProfile` to `api-client.ts`
  - [-] 3.1 Add `patchPersonalProfile` function
    - Define `PersonalProfilePayload` interface (`email: string` + optional personal fields matching Req 5.1)
    - Implement function calling `request<{ user: Record<string, unknown>; message: string }>("/api/users/profile/personal", { method: "PATCH", body: JSON.stringify(payload) })`
    - _Requirements: 5.1_

  - [-] 3.2 Add `patchAcademicProfile` function
    - Define `AcademicProfilePayload` interface (`email: string` + optional academic fields matching Req 5.2)
    - Implement function calling `PATCH /api/users/profile/academic`
    - _Requirements: 5.2_

  - [x] 3.3 Add `patchAchievementsProfile` function
    - Define `AchievementsProfilePayload` interface (`email: string` + optional achievements/financial fields matching Req 5.3)
    - Implement function calling `PATCH /api/users/profile/achievements`
    - _Requirements: 5.3_

- [x] 4. Refactor `profile.tsx` — state scaffolding and header
  - [x] 4.1 Add independent edit-mode state and `localUser` to the `Profile` component
    - Replace `const user = getStoredUser()` with `const [localUser, setLocalUser] = useState<StoredUser | null>(getStoredUser())`
    - Add `const [aboutEditMode, setAboutEditMode] = useState(false)`
    - Add `const [educationEditMode, setEducationEditMode] = useState(false)`
    - Add `const [achievementsEditMode, setAchievementsEditMode] = useState(false)`
    - Add `const [activeTab, setActiveTab] = useState<"about" | "education" | "achievements" | "activity">("about")`
    - Add `handleEditProfile` callback: sets `activeTab("about")` and `setAboutEditMode(true)`
    - Add `handleSaveSuccess` callback: merges `updatedFields` into `localUser` and calls `saveStoredUser(updatedFields)`
    - Update all references from `user` to `localUser` throughout the component
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.2 Update the profile header — replace navigation button with `[✏ Edit Profile]` and fix Indigent badge
    - Replace `<Button onClick={() => navigate("/dashboard/settings")}>Edit Profile</Button>` with `<Button variant="outline" onClick={handleEditProfile}><Pencil className="h-4 w-4 mr-1" /> Edit Profile</Button>`
    - In the `eligibilityBadges` array, change `user?.isIndigent ? "💚 Indigent/Low-income" : null` to `localUser?.isIndigent ? "Indigent/Low-income" : null` (no emoji)
    - Add placeholder badge `"Complete your profile to see scholarship matches"` when `eligibilityBadges` is empty (already present — verify it uses `localUser`)
    - _Requirements: 2.1, 6.1, 6.2, 6.3_

  - [ ]* 4.3 Write property test for eligibility badge list (Property 5 & 6)
    - **Property 5: Eligibility badge list contains no null/undefined entries**
    - **Validates: Requirements 6.1**
    - **Property 6: Indigent badge is emoji-free**
    - **Validates: Requirements 6.2**
    - Use fast-check; generate arbitrary `StoredUser` objects and assert `eligibilityBadges(user).every(b => typeof b === "string" && b.length > 0)` and that the Indigent badge string does not match `/\p{Emoji}/u`

- [x] 5. Implement `AboutTab` view mode and edit form in `profile.tsx`
  - [x] 5.1 Implement `AboutView` sub-component (view mode)
    - Render bio text (or `"No bio added yet."` placeholder) and skills as `<Badge variant="secondary">` chips
    - Include a small `[✏ Edit]` button in the tab header that calls `onEditToggle`
    - _Requirements: 2.2_

  - [x] 5.2 Implement `AboutEditForm` sub-component (edit mode)
    - Initialize draft state from `user` prop: `draftFullName`, `draftPhone`, `draftLocation`, `draftDob`, `draftBio`, `draftSkills`, `draftProfileImage`
    - Render fields: Full Name (required), Phone (optional), Location (required, default "Quezon City"), Date of Birth (date input), Bio (textarea), Skills (comma-separated), Profile Picture (file input, `accept="image/png,image/jpeg,image/jpg,image/webp"`, max 5 MB)
    - On file select: validate size ≤ 5 MB and MIME type; show inline error and reject file without affecting other draft fields if invalid (Req 2.8)
    - On [Save Personal Info]: validate `fullName` and `location` non-empty; call `patchPersonalProfile`; on success call `onSaveSuccess` with saved fields, deactivate edit mode, show `toast.success`
    - On 404 response: show session-expired toast and redirect to `/auth/signin` (Req 2.7)
    - On network/5xx error: show error toast, keep edit mode active, preserve draft state (Req 2.6)
    - On [Cancel]: reset all draft fields to `user` prop values and call `onEditToggle`
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 5.3 Write property test for skills round-trip (Property 2)
    - **Property 2: Skills round-trip fidelity**
    - **Validates: Requirements 2.3**
    - Use fast-check; generate arrays of non-empty trimmed strings and assert `skills.join(", ").split(",").map(s => s.trim()).filter(Boolean)` deep-equals the original array

  - [ ]* 5.4 Write property test for edit mode toggle involution (Property 3)
    - **Property 3: Edit mode toggle involution**
    - **Validates: Requirements 7.2**
    - Use fast-check; generate arbitrary boolean `editMode` and assert `toggle(toggle(editMode)) === editMode`

- [x] 6. Implement `EducationTab` view mode and edit form in `profile.tsx`
  - [x] 6.1 Implement `EducationView` sub-component (view mode)
    - Render school name + campus, school type badge, school location badge (green for QC, yellow otherwise)
    - Render education level, year level, field of study, graduation year
    - Render GPA with descriptive label (Excellent / Good / Satisfactory / Passing / Failing based on Philippine scale)
    - Render academic honors badge if `hasAcademicHonors === true`
    - Include `[✏ Edit]` button in tab header
    - _Requirements: 3.1_

  - [x] 6.2 Implement `EducationEditForm` sub-component (edit mode)
    - Initialize draft state from `user` prop for all academic fields
    - Render: GPA (number input, 1.00–5.00), Education Level (Select), Year Level (Select — dynamic options from `yearLevelOptions[educationLevel]`), Field of Study (text), Graduation Year (number), School Name (required text), Campus (optional text), School Type (Select), School Location (Select), Academic Honors checkbox, Class Rank Select (visible only when honors checkbox is checked)
    - On Education Level change: reset Year Level to empty and show only valid options for new level (Req 3.3)
    - On GPA blur: clamp to [1.00, 5.00] and display helper text `"Philippine GPA scale: 1.00 = Highest (Excellent), 3.00 = Minimum Passing, 5.00 = Failing."` (Req 3.4)
    - On [Save Academic Info]: call `patchAcademicProfile`; on 400 GPA error show inline error below GPA field; on success call `onSaveSuccess`, deactivate edit mode, show `toast.success`
    - On network/5xx error: show error toast, keep edit mode active (Req 3.7)
    - On [Cancel]: reset draft state to `user` prop values and call `onEditToggle` (Req 3.8)
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 6.3 Write property test for GPA clamping idempotence (Property 1)
    - **Property 1: GPA clamping idempotence**
    - **Validates: Requirements 3.4**
    - Use fast-check; generate arbitrary strings and assert `clamp(clamp(s)) === clamp(s)`

  - [ ]* 6.4 Write property test for year level validity (Property 9)
    - **Property 9: Year level validity relative to education level**
    - **Validates: Requirements 3.3**
    - Use fast-check; generate valid `(educationLevel, yearLevel)` pairs and assert `yearLevel ∈ yearLevelOptions[educationLevel]`

- [x] 7. Implement `AchievementsTab` view mode and edit form in `profile.tsx`
  - [x] 7.1 Implement `AchievementsView` sub-component (view mode)
    - Render only the special category badges that are `true` as `<Badge>` chips (no unchecked items shown)
    - Render income category and financial need rating
    - Render placeholder if no categories are set
    - Include `[✏ Edit]` button in tab header
    - _Requirements: 4.1_

  - [x] 7.2 Implement `AchievementsEditForm` sub-component (edit mode)
    - Initialize draft state from `user` prop for all achievements/financial fields
    - Render checkboxes in two-column grid: Athlete, Artist, SK Official / Youth Leader, Student Council / Government Leader, From Indigent / Low-income Family, Person with Disability (PWD), Solo Parent
    - Render: Financial Need (number input 1–5), Net Worth (optional, ₱ prefix text input), Currency (Select, default PHP), Income Category (Select)
    - On [Save Achievements & Financial]: call `patchAchievementsProfile`; on 400 financialNeed error show inline error below Financial Need field; on success call `onSaveSuccess`, deactivate edit mode, show `toast.success`
    - On network/5xx error: show error toast, keep edit mode active (Req 4.5)
    - On [Cancel]: reset draft state to `user` prop values and call `onEditToggle` (Req 4.6)
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 7.3 Write property test for section-specific PATCH field isolation (Property 4)
    - **Property 4: Section-specific PATCH does not mutate unrelated fields**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.10**
    - Use fast-check; generate arbitrary `StoredUser` and `PersonalProfilePayload`; mock `patchPersonalProfile` to call `saveStoredUser` with only personal fields; assert that `gpa`, `educationLevel`, `isAthlete`, and `financialNeed` in the stored user remain unchanged after the call

- [x] 8. Checkpoint — Profile page editable tabs
  - Ensure About, Education, and Achievements tabs each toggle correctly between view and edit mode, draft state resets on Cancel, and `localUser` updates optimistically on save. Ask the user if questions arise.

- [x] 9. Wire `Tabs` component to `activeTab` state and connect `[✏ Edit Profile]` header button
  - Change `<Tabs defaultValue="about">` to `<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>`
  - Pass `editMode={aboutEditMode}` / `educationEditMode` / `achievementsEditMode` and `onEditToggle` / `onSaveSuccess` props into each tab component
  - Verify that activating edit mode in one tab does not affect the edit mode state of the other two tabs
  - Verify that navigating away from a tab in edit mode and returning preserves the draft state (draft state lives inside each form component, so it is preserved as long as the component stays mounted)
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 10. Refactor `settings.tsx` — remove all profile/credential fields
  - [x] 10.1 Remove profile and academic/financial form state and JSX from `settings.tsx`
    - Delete all `useState` declarations for: `bio`, `profileImage`, `avatarUploading`, `fullName`, `phone`, `location`, `skills`, `gpa`, `educationLevel`, `yearLevel`, `fieldOfStudy`, `graduationYear`, `netWorth`, `incomeCategory`, `financialNeed`, `schoolName`, `schoolCampus`, `schoolType`, `schoolLocation`, `isAthlete`, `isArtist`, `isSKOfficial`, `isStudentLeader`, `isIndigent`, `isPWD`, `isSoloParent`, `hasAcademicHonors`, `academicRank`, `profileSaved`, `avatarFile`, `profileSaving`, `academicSaving`
    - Delete handlers: `saveBio`, `handleProfileImageChange`, `handleProfileSave`, `saveAcademicAndFinancial`, `handleGpaBlur`
    - Remove imports no longer needed: `Avatar`, `AvatarFallback`, `AvatarImage`, `Textarea`, `updateUserProfile`, `uploadUserAvatar`, `pickProfileImageUrl`, `resolvePublicAssetUrl`, `getInitials`
    - Remove the profile picture form block, the personal info form block, and the academic/financial form block from the JSX
    - _Requirements: 1.1_

  - [x] 10.2 Retain Account & Security section and Preferences section in `settings.tsx`
    - Keep all `useState` for `notificationSettings`, `privacySettings`, `language`, `theme`, dialog open states, and `passwordForm`
    - Keep handlers: `saveNotificationSettings`, `savePrivacySettings`, `savePassword`, `handlePreferenceSave`
    - Keep the Account & Security card (Email Notifications → [Configure], Privacy Settings → [Manage], Password → [Update], Two-Factor Authentication → [Configure] placeholder)
    - Keep the Preferences card (Language Select, Theme Select, Save Preferences button)
    - Ensure `handlePreferenceSave` still persists to `StoredUser` and applies theme change to `document.documentElement` immediately
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 10.3 Write property test for Settings page containing no profile fields (Property 10)
    - **Property 10: Settings page renders no profile credential fields post-restructure**
    - **Validates: Requirements 1.1**
    - Render `<Settings />` with React Testing Library; assert that no input with id matching `gpa`, `educationLevel`, `yearLevel`, `fieldOfStudy`, `graduationYear`, `schoolName`, `schoolType`, `schoolLocation`, `financialNeed`, `netWorth`, `incomeCategory`, `isAthlete`, `isArtist`, `isSKOfficial`, `isStudentLeader`, `isIndigent`, `isPWD`, or `isSoloParent` is present in the rendered output

  - [ ]* 10.4 Write property test for Cancel restoring draft state (Property 11)
    - **Property 11: Cancel restores draft state to StoredUser values**
    - **Validates: Requirements 2.4, 3.8, 4.6**
    - Use fast-check; generate arbitrary `StoredUser` objects; render each edit form, mutate draft fields, click Cancel, and assert every draft field equals the corresponding `StoredUser` value

- [x] 11. Final checkpoint — Full integration
  - Ensure all tests pass. Verify that `profile.tsx` renders editable tabs, `settings.tsx` shows only Account & Security and Preferences, the three PATCH endpoints respond correctly, and the Indigent badge has no emoji. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The three PATCH endpoints use `$set` exclusively — never `replaceOne` — to guarantee field isolation (Req 5.10)
- `localUser` state is updated optimistically on save success so the read-only view reflects changes immediately without a server re-fetch (Req 7.3)
- Draft state lives inside each edit form component; because the tab panels remain mounted while the user navigates between tabs, unsaved edits are preserved when switching tabs (Req 7.4)
- The `enrolledInQCSchool` boolean is always derived server-side from `schoolLocation === "Quezon City"` (Req 5.4)
- Property tests use fast-check; install with `npm install --save-dev fast-check` if not already present

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["4.1", "4.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "6.1", "6.2", "7.1", "7.2", "10.1", "10.2"] },
    { "id": 4, "tasks": ["5.3", "5.4", "6.3", "6.4", "7.3", "10.3", "10.4"] },
    { "id": 5, "tasks": ["9"] }
  ]
}
```
