# Implementation Plan: Provider Panel Enhancements

## Overview

Implement the two categories of work in sequence: first the backend data-correctness fixes and new API endpoints, then the frontend layout/page changes. The backend is JavaScript (ES modules, Express + Mongoose) and the frontend is TypeScript (React + Tailwind + shadcn/ui). Property-based tests use `fast-check`.

## Tasks

- [x] 1. Add new fields to User model `providerDetails`
  - Open `Backend/models/user.model.js`
  - Add `phone`, `officeAddress`, `description`, `website` fields inside the `providerDetails` sub-document with `type: String, default: null, trim: true` and the appropriate `maxlength` constraints (30 / 300 / 2000 / 2048 respectively)
  - Retain the existing root-level `profilePicture` field unchanged
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Fix `getProviderScholarships` — remove `createdBy` filter
  - [x] 2.1 Update `getProviderScholarships` in `Backend/controller/provider.controller.js`
    - Remove the `{ createdBy: providerId }` filter from `Scholarship.find()`
    - Keep the `.sort({ createdAt: -1 })` and the `Promise.all` loop that computes `applicationsCount` per scholarship
    - Return `{ success: true, data: scholarshipsWithCount, total: scholarshipsWithCount.length }`; return `{ success: true, data: [], total: 0 }` when the collection is empty
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Write property test for `getProviderScholarships` (Property 1)
    - **Property 1: All scholarships returned without ownership filter**
    - Generate random arrays of scholarship documents with and without `createdBy` fields using `fast-check`; mock `Scholarship.find()` and `Application.countDocuments()`; assert the handler returns every document sorted by `createdAt` descending with correct `applicationsCount`
    - **Validates: Requirements 1.1**

- [x] 3. Fix `getProviderDashboardStats` — remove `createdBy` filter
  - [x] 3.1 Update `getProviderDashboardStats` in `Backend/controller/provider.controller.js`
    - Remove the `{ createdBy: providerId }` filter from `Scholarship.find()` so `totalScholarships` equals the count of ALL scholarship documents
    - Change `pendingApplications` to count `Application` documents with `status: "Pending"` across all scholarships (no ownership constraint)
    - _Requirements: 3.1, 3.2_

  - [x] 3.2 Write property test for `getProviderDashboardStats` (Property 2)
    - **Property 2: Dashboard stats count ALL scholarships and ALL pending applications**
    - Generate random sets of scholarship and application documents (varying `status` values); mock Mongoose queries; assert `totalScholarships` equals total scholarship count and `pendingApplications` equals count of `status === "Pending"` across all applications
    - **Validates: Requirements 3.1, 3.2**

- [x] 4. Implement `getProviderMe` controller + route
  - [x] 4.1 Add `getProviderMe` export to `Backend/controller/provider.controller.js`
    - Map `req.provider` fields to `{ name, email, organizationName, profilePicture }` — use `user.userName || user.fullName` for `name`, fall back to `null`
    - Return `{ success: true, data: { name, email, organizationName, profilePicture } }`
    - Register `app.get("/api/provider/me", requireProvider, getProviderMe)` in `Backend/index.js`
    - Import `getProviderMe` in the existing import block at the top of `index.js`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.2 Write property test for `getProviderMe` (Property 17)
    - **Property 17: GET /api/provider/me identity mapping**
    - Generate arbitrary provider user documents with any combination of populated / absent `userName`, `fullName`, `providerDetails.organizationName`, `profilePicture`; assert the handler always returns all four fields and that `name` falls back to `null` (not `undefined`) when both name fields are absent
    - **Validates: Requirements 4.1, 4.2**

- [x] 5. Implement `getProviderProfileHandler` and `updateProviderProfile` controllers + routes
  - [x] 5.1 Add `getProviderProfileHandler` export to `provider.controller.js`
    - Map `req.provider` to the full 9-field profile shape: `name, email, organizationName, position, phone, officeAddress, description, website, profilePicture`; fields with no stored value return `null`
    - Return `{ success: true, data: { ...profileFields } }`
    - _Requirements: 6.1_

  - [x] 5.2 Write property test for `getProviderProfileHandler` (Property 3)
    - **Property 3: GET /api/provider/profile maps all fields correctly (null for missing)**
    - Generate arbitrary provider user documents with random combinations of present / absent profile fields; assert all 9 required fields are always present in the response and missing values are `null` not `undefined`
    - **Validates: Requirements 6.1**

  - [x] 5.3 Add `updateProviderProfile` export to `provider.controller.js`
    - Accept body fields: `name`, `organizationName`, `position`, `phone`, `officeAddress`, `description`, `website`
    - Validation: trim `name` and `organizationName`; reject with HTTP 400 if either is empty/whitespace when present; reject `website` with HTTP 400 if it does not start with `http://` or `https://`
    - On validation failure do NOT apply any partial updates
    - Build a `$set` object with only the fields that were present in the request body; call `User.findByIdAndUpdate(req.providerId, { $set: updates }, { new: true })`
    - Return the full updated profile in the same shape as `getProviderProfileHandler`
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 5.4 Write property test for `updateProviderProfile` partial update (Property 4)
    - **Property 4: PUT /api/provider/profile is a partial update**
    - Generate arbitrary provider documents and arbitrary partial bodies (any non-empty subset of the allowed fields); mock `User.findByIdAndUpdate`; assert the `$set` argument contains only the keys present in the body and no others
    - **Validates: Requirements 6.2**

  - [x] 5.5 Write property test for `updateProviderProfile` round-trip (Property 5)
    - **Property 5: PUT /api/provider/profile round-trip**
    - Generate valid partial profile bodies; call the update handler with a mock DB that persists the $set; then call `getProviderProfileHandler` against the updated document; assert every field supplied in the PUT body appears with its updated value in the GET response
    - **Validates: Requirements 6.3**

  - [x] 5.6 Write property test for blank required field validation (Property 6)
    - **Property 6: Profile field validation rejects blank required fields**
    - Generate strings composed entirely of whitespace characters (or empty string) for `name` and `organizationName` using `fast-check`'s `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))`; assert the handler returns HTTP 400 and does not call `User.findByIdAndUpdate`
    - **Validates: Requirements 6.4**

  - [x] 5.7 Write property test for website URL validation (Property 7)
    - **Property 7: Website URL validation**
    - Generate arbitrary strings that do NOT start with `http://` or `https://` and assert HTTP 400; generate strings that DO start with `http://` or `https://` and assert they pass validation
    - **Validates: Requirements 6.5**

  - [x] 5.8 Register profile routes in `Backend/index.js`
    - Add `app.get("/api/provider/profile", requireProvider, getProviderProfileHandler)`
    - Add `app.put("/api/provider/profile", requireProvider, updateProviderProfile)`
    - Add `getProviderProfileHandler` and `updateProviderProfile` to the existing import from `./controller/provider.controller.js`
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. Implement `uploadProviderAvatar` controller + multer setup + route
  - [x] 6.1 Add `providerAvatarUpload` multer instance in `Backend/index.js`
    - Define a new `multer.diskStorage` instance with `destination: uploads/providers/`, `filename: {providerId}-{Date.now()}{ext}`
    - Configure `limits: { fileSize: 5 * 1024 * 1024 }` (5 MB)
    - Configure `fileFilter` to allow only `image/jpeg`, `image/jpg`, `image/png`; call `cb(new Error('Only JPG and PNG files are allowed'), false)` for other types
    - _Requirements: 8.1, 8.5, 8.6_

  - [x] 6.2 Add `uploadProviderAvatar` export to `provider.controller.js`
    - Check `req.file`; return HTTP 400 `{ success: false, message: "No avatar file provided" }` if absent
    - Set `profilePicture = /uploads/providers/${req.file.filename}`
    - Call `User.findByIdAndUpdate(req.providerId, { $set: { profilePicture } }, { new: true })`
    - If the DB call throws, call `fs.unlinkSync(req.file.path)` before returning HTTP 500
    - On success return `{ success: true, avatarUrl: profilePicture }`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.7, 8.8_

  - [-] 6.3 Register avatar upload route in `Backend/index.js`
    - Add `app.post("/api/provider/upload-avatar", requireProvider, providerAvatarUpload.single("avatar"), uploadProviderAvatar)`
    - Add multer error-handling middleware directly after this route to translate multer `LIMIT_FILE_SIZE` errors to HTTP 400 with `{ success: false, message: "File size must not exceed 5 MB" }`
    - Import `uploadProviderAvatar` in the existing controller import block
    - _Requirements: 8.5, 8.6_

  - [-] 6.4 Write property test for avatar upload path storage (Property 8)
    - **Property 8: Avatar upload stores path as /uploads/providers/{filename}**
    - Generate arbitrary valid multer `req.file` objects (varying filename and mimetype within allowed set); mock `User.findByIdAndUpdate`; assert `profilePicture` is always set to `/uploads/providers/{filename}` and the `avatarUrl` in the response equals the same path
    - **Validates: Requirements 8.2, 8.4**

  - [ ] 6.5 Write property test for avatar MIME type validation (Property 9)
    - **Property 9: Avatar upload MIME type validation**
    - Generate MIME type strings not in `{image/jpeg, image/jpg, image/png}` and assert the multer `fileFilter` calls `cb` with an error; generate strings in the allowed set and assert `cb(null, true)` is called
    - **Validates: Requirements 8.6**

- [~] 7. Checkpoint — Ensure all backend tests pass
  - Ensure all backend tests pass, ask the user if questions arise.

- [ ] 8. Implement `changeProviderPassword` controller + route
  - [~] 8.1 Add `changeProviderPassword` export to `provider.controller.js`
    - Destructure `currentPassword`, `newPassword`, `confirmNewPassword` from `req.body`; return HTTP 400 for any missing field with message `"Missing required field: <field>"`
    - Validate `newPassword` length in [8, 100]; return HTTP 400 `"New password must be at least 8 characters"` if out of range
    - Check `newPassword === confirmNewPassword`; return HTTP 400 `"New passwords do not match"` if different
    - Call `bcrypt.compare(currentPassword, req.provider.passwordHash)`; return HTTP 400 `"Current password is incorrect"` on mismatch
    - Hash with `bcrypt.hash(newPassword, 10)`; save to `user.passwordHash` via `User.findByIdAndUpdate`
    - Return `{ success: true, message: "Password updated successfully" }`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [~] 8.2 Register change-password route in `Backend/index.js`
    - Add `app.put("/api/provider/change-password", requireProvider, changeProviderPassword)`
    - Import `changeProviderPassword` in the existing controller import block
    - _Requirements: 9.7_

  - [~] 8.3 Write property test for bcrypt verification (Property 10)
    - **Property 10: Password change bcrypt verification**
    - Generate arbitrary password strings; pre-hash them with bcrypt; assert the handler accepts them when the hash matches and rejects them when the hash does not match. After a successful change, hash the returned new `passwordHash` and verify it matches `newPassword`
    - **Validates: Requirements 9.1, 9.6**

  - [~] 8.4 Write property test for new password length validation (Property 11)
    - **Property 11: Password change — new password length validation**
    - Generate strings shorter than 8 or longer than 100 characters; assert HTTP 400 is returned without updating the DB. Generate strings with length in [8, 100] and assert the length check passes
    - **Validates: Requirements 9.4**

  - [~] 8.5 Write property test for password confirmation match (Property 12)
    - **Property 12: Password change — confirmation match**
    - Generate pairs of distinct strings `(newPassword, confirmNewPassword)`; assert HTTP 400 with message `"New passwords do not match"` and no DB write. Generate identical pairs and assert the check passes
    - **Validates: Requirements 9.3**

- [ ] 9. Update `ProviderLayout` sidebar
  - [~] 9.1 Add `GET /api/provider/me` fetch and live identity state
    - Import `Settings` from `lucide-react` (add to existing import)
    - Add `providerIdentity` state and `identityError` state
    - Add a second `useEffect` (or extend the existing one) to fetch `GET /api/provider/me` on mount; on success store the response in `providerIdentity`; on failure store the error and fall back to `getStoredUser()` values
    - Update `displayName` and `orgName` computations to prefer `providerIdentity` values
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

  - [~] 9.2 Wire live avatar and clickable sidebar header
    - Add `AvatarImage` child to the existing `<Avatar>` that renders `providerIdentity.profilePicture` when non-null
    - Wrap the entire avatar + name block in `<Link to="/provider/settings">` so clicking navigates to settings
    - Add an "Edit Profile" `<Link to="/provider/settings">` rendered beneath the display name, styled as a small muted text link
    - Add a small red dot indicator (e.g., `<span className="size-2 rounded-full bg-red-500">`) visible only when `identityError` is truthy
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_

  - [~] 9.3 Add Settings nav item and divider
    - Append `{ href: "/provider/settings", label: "Settings", icon: Settings }` to the `navItems` array
    - Render the existing `nav` loop for `navItems`; the Settings item will automatically get the active highlight through the existing `isActive` logic
    - Add an `<hr className="border-gray-200 my-2">` divider between the rendered Settings nav link and the Sign Out button
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [~] 10. Add View link to `ProviderScholarships` Actions column
  - Open `FrontEnd/src/app/pages/provider/scholarships.tsx`
  - Import `Eye` from `lucide-react`
  - In the Actions column, add a `<Link to={/provider/scholarships/${s._id}}>` wrapping a `<Button variant="ghost" size="sm">` with an `<Eye>` icon, placed before the existing Edit link
  - _Requirements: 2.5_

- [ ] 11. Create `ProviderSettings` page
  - [~] 11.1 Create file and fetch profile on mount
    - Create `FrontEnd/src/app/pages/provider/settings.tsx` with a named export `ProviderSettings`
    - Add a `ProviderProfile` TypeScript interface matching the 9-field API response shape
    - `useEffect` on mount: call `GET /api/provider/profile`; store result in `profile` state; prefill all form fields; set `loadError` state on failure
    - Render an error banner above the form sections when `loadError` is set
    - _Requirements: 10.1, 6.1_

  - [~] 11.2 Implement Profile Information section
    - Render a shadcn/ui `<Card>` with title "Profile Information"
    - Render `<Avatar>` showing `profilePicture` via `<AvatarImage>` when non-null, or initials fallback via `<AvatarFallback>`
    - Render a `<input type="file" accept=".jpg,.jpeg,.png">` for avatar selection; store the selected file in `avatarFile` state; do NOT trigger any network request on selection alone
    - Render required "Organization Name" and "Full Name" text inputs with client-side `trim()` validation; prevent submission when empty/whitespace
    - Render optional "Position / Title", "Phone Number", "Office Address" text inputs
    - Render a read-only "Official Email Address" `<input disabled>` field; exclude it from the PUT body
    - On `[Save Profile]` click: if `avatarFile` is set, first call `POST /api/provider/upload-avatar`; on non-2xx show inline error and stop; then call `PUT /api/provider/profile` with the form values; show success toast on HTTP 200; show inline error on non-2xx without navigating
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

  - [~] 11.3 Write property test for settings page prefill (Property 13)
    - **Property 13: Settings page pre-fills all form fields from API response**
    - Generate arbitrary `ProviderProfile` response objects; render `ProviderSettings` with a mocked `GET /api/provider/profile` returning that object; assert every form field's `value` (or `defaultValue`) matches the corresponding API response field (or empty string for null)
    - **Validates: Requirements 10.1**

  - [~] 11.4 Write property test for required field client-side validation (Property 14)
    - **Property 14: Required field client-side validation**
    - Generate whitespace-only or empty strings for Organization Name and Full Name; simulate `[Save Profile]` click; assert no network request is made and a validation error is visible
    - **Validates: Requirements 10.5, 10.6**

  - [~] 11.5 Implement Account Security section
    - Render a shadcn/ui `<Card>` with title "Account Security"
    - Render three `<input type="password">` fields: "Current Password", "New Password", "Confirm New Password"; each has its own `showPassword` boolean state
    - Render an eye-toggle `<Button variant="ghost">` beside each input that toggles `type` between `"password"` and `"text"`
    - On `[Update Password]` click: call `PUT /api/provider/change-password` with `{ currentPassword, newPassword, confirmNewPassword }`
    - On HTTP 200 + `success: true`: clear all three fields and show success toast (each action executes independently)
    - On error: display error message inline beneath the form; preserve field values
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [~] 11.6 Implement About / Description section
    - Render a shadcn/ui `<Card>` with title "About / Description"
    - Render a `<Textarea>` for `description` pre-filled from profile, with placeholder `"Tell students about your organization and scholarship programs..."`
    - Render an optional "Website" text input pre-filled from profile
    - On `[Save Description]` click: call `PUT /api/provider/profile` with `{ description, website }` only
    - On HTTP 200 + `success: true`: show success toast
    - On error: display error inline; preserve field values
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [~] 12. Register `/provider/settings` route in `routes.tsx`
  - Open `FrontEnd/src/app/routes.tsx`
  - Add `import { ProviderSettings } from "./pages/provider/settings";`
  - Add `{ path: "settings", Component: ProviderSettings }` as a child route under the `provider` path, alongside the existing provider children
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [~] 13. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Property tests for frontend correctness properties
  - [~] 14.1 Write property test for settings route isolation (Property 15)
    - **Property 15: Settings route isolation**
    - Generate arbitrary `/provider/*` paths that are not `/provider/settings`; render `ProviderLayout` at those paths with a mocked router; assert the `<Outlet>` never renders `ProviderSettings` content
    - **Validates: Requirements 13.4**

  - [~] 14.2 Write property test for sidebar active state (Property 16)
    - **Property 16: Sidebar active state for Settings nav item**
    - Generate arbitrary URL path strings; render `ProviderLayout` with a mocked `useLocation` returning that path; assert the Settings nav item has `bg-[#1E3A5F] text-white` class if and only if the path equals `/provider/settings`
    - **Validates: Requirements 5.4**

  - [~] 14.3 Write property test for initials derivation (Property 18)
    - **Property 18: Initials derivation**
    - Generate arbitrary name strings composed of words separated by whitespace; compute expected initials (first letter of each word, up to 2, uppercased); render the `AvatarFallback` with `profilePicture` set to `null`; assert the displayed text matches the expected initials
    - **Validates: Requirements 4.4**

- [~] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The `createdBy` filter removal (Tasks 2, 3) is intentional: QCYDO scholarships were seeded without that field
- Avatar files for providers go to `uploads/providers/` (separate from student application uploads in `uploads/applications/` and the existing `uploads/avatars/`)
- The `providerAvatarUpload` multer instance in `index.js` is new and separate from the existing `uploadAvatar` instance
- The `getProviderMe` route must be registered BEFORE any parameterized routes like `/api/provider/:id` to avoid route shadowing
- PBT tests use `fast-check`; install it as a dev dependency: `npm install --save-dev fast-check` in the Backend and/or FrontEnd directory as needed before running PBT tasks
- Checkpoints ensure incremental validation before proceeding to the next phase

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["4.1", "2.2", "3.2"] },
    { "id": 2, "tasks": ["4.2", "5.1", "5.3"] },
    { "id": 3, "tasks": ["5.2", "5.4", "5.5", "5.6", "5.7", "5.8"] },
    { "id": 4, "tasks": ["6.1", "6.2"] },
    { "id": 5, "tasks": ["6.3", "6.4", "6.5"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4", "8.5"] },
    { "id": 8, "tasks": ["9.1", "9.2", "9.3", "10.1"] },
    { "id": 9, "tasks": ["11.1", "11.5", "11.6", "12.1"] },
    { "id": 10, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 11, "tasks": ["14.1", "14.2", "14.3"] }
  ]
}
```
