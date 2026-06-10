# Requirements Document

## Introduction

This feature enhances the Scholarship Provider panel in the QCYDO MERN-stack application. It covers two areas:

1. **My Scholarships page fix** — the existing `GET /api/provider/scholarships` endpoint filters by `createdBy: providerId`, which returns zero results because the 12 QCYDO scholarships were seeded without that field. The page and its sidebar Quick Stats must display real data from MongoDB.

2. **Provider Settings page** — a new `/provider/settings` route with three sections (Profile Information, Account Security, About/Description), backed by four new API endpoints. The sidebar also gains a Settings nav item and a live provider name/avatar that navigate to the settings page.

The MERN stack is: MongoDB (Mongoose), Express.js with ES modules, React + TypeScript + Tailwind CSS + shadcn/ui, Node.js.

---

## Glossary

- **Provider_Panel**: The React frontend sub-application served under `/provider/*` and rendered inside `ProviderLayout`.
- **Provider**: A QCYDO staff member with `role: "provider"` and `providerDetails.isApproved: true` in the `users` collection.
- **requireProvider**: The Express middleware (`auth.middleware.js`) that validates the provider JWT and attaches `req.providerId`, `req.provider`, and `req.currentUser`.
- **Scholarship**: A document in the MongoDB `scholarships` collection, managed via the `Scholarship` Mongoose model.
- **Application**: A document in the MongoDB `applications` collection, managed via the `Application` Mongoose model.
- **User_Model**: The Mongoose `User` model in `Backend/models/user.model.js`, which stores both student and provider accounts.
- **providerDetails**: The sub-document inside `User_Model` that holds provider-specific fields (`organizationName`, `position`, `isApproved`, etc.).
- **ProviderLayout**: The React component at `FrontEnd/src/app/layouts/provider-layout.tsx` that renders the sidebar and wraps all `/provider/*` pages.
- **Provider_Settings_Page**: The new React page component to be created at `FrontEnd/src/app/pages/provider/settings.tsx` and served at `/provider/settings`.
- **Avatar**: A circular image element showing either an uploaded profile picture or a text initial fallback.
- **getStoredUser**: A frontend utility from `lib/user-storage` that returns the cached user object from `localStorage`.
- **getAuthToken**: A frontend utility from `lib/user-storage` that returns the stored JWT.
- **API_URL**: A frontend constant from `lib/api-client` holding the backend base URL.

---

## Requirements

### Requirement 1: My Scholarships — Return All Scholarships

**User Story:** As a Provider, I want the My Scholarships page to display all QCYDO scholarships, so that I can manage every scholarship regardless of who originally seeded it.

#### Acceptance Criteria

1. WHEN `GET /api/provider/scholarships` is called with a valid provider JWT, THE Provider_Panel SHALL return all documents from the `scholarships` collection sorted by `createdAt` descending, each including an `applicationsCount` field computed at the time of the request as the count of `Application` documents whose `scholarshipId` matches that scholarship's `_id`.
2. WHEN the `scholarships` collection contains zero documents, THE Provider_Panel SHALL return `{ success: true, data: [], total: 0 }`.
3. IF the request is made without a valid provider JWT or with an expired token, THEN THE Provider_Panel SHALL return HTTP 401 and SHALL NOT return any scholarship data.

---

### Requirement 2: My Scholarships — Frontend Table

**User Story:** As a Provider, I want the My Scholarships page to display a full data table, so that I can see all scholarships at a glance with their key details.

#### Acceptance Criteria

1. WHEN scholarship data is loaded successfully and the array is non-empty, THE Provider_Panel SHALL render a table with columns: Name, Amount (₱), Deadline, Type, Status, Applications, Actions; the empty-state placeholder SHALL NOT be visible.
2. WHEN the loaded scholarship array is empty, THE Provider_Panel SHALL display the empty-state placeholder message and SHALL still display the `[+ Create Scholarship]` button; the table SHALL NOT be rendered.
3. WHEN a scholarship's `status` field equals `"Active"`, THE Provider_Panel SHALL display a blue "Active" badge; WHEN it equals any other value, THE Provider_Panel SHALL display a secondary-styled "Closed" badge.
4. WHEN the Applications column is rendered, THE Provider_Panel SHALL display a clickable link with the `applicationsCount` value that navigates to `/provider/applications?scholarshipId={id}`.
5. WHEN the Actions column is rendered for a scholarship, THE Provider_Panel SHALL display a View link (navigates to `/provider/scholarships/{id}`), an Edit link (navigates to `/provider/scholarships/{id}/edit`), and a Delete button.
6. WHEN a Delete button is clicked, THE Provider_Panel SHALL prompt the user for confirmation before sending `DELETE /api/provider/scholarships/{id}`; IF the user dismisses the confirmation, THE Provider_Panel SHALL cancel the delete request and leave the scholarship in the list unchanged.
7. IF `DELETE /api/provider/scholarships/{id}` returns a non-2xx status, THEN THE Provider_Panel SHALL display an error message and SHALL NOT remove the scholarship from the table.
8. IF the `GET /api/provider/scholarships` API call fails or returns a non-2xx status, THEN THE Provider_Panel SHALL display an error message and SHALL NOT render the table.

---

### Requirement 3: Sidebar Quick Stats — Real Counts

**User Story:** As a Provider, I want the sidebar Quick Stats section to show accurate counts from the database, so that I always see up-to-date totals without navigating away.

#### Acceptance Criteria

1. WHEN `GET /api/provider/dashboard/stats` is called, THE Provider_Panel SHALL compute `totalScholarships` as the count of ALL documents in the `scholarships` collection (no `createdBy` filter).
2. WHEN `GET /api/provider/dashboard/stats` is called, THE Provider_Panel SHALL compute `pendingApplications` as the count of `Application` documents with `status: "Pending"` across all scholarships.
3. WHILE the dashboard stats are loading, THE Provider_Panel SHALL display a spinner in place of each stat value individually, without hiding the sidebar or its navigation links.
4. WHEN the stats load successfully, THE Provider_Panel SHALL display `totalScholarships` and `pendingApplications` as non-negative integers.
5. IF the stats API call fails, THEN THE Provider_Panel SHALL display `"—"` in place of each stat value; the sidebar SHALL remain visible and all navigation links SHALL remain interactive.
6. WHEN `ProviderLayout` mounts, THE Provider_Panel SHALL fetch `GET /api/provider/dashboard/stats` once per page load to ensure stat values reflect the current database state.

---

### Requirement 4: Sidebar Header — Live Provider Identity

**User Story:** As a Provider, I want my sidebar to display my real name, organization name, and profile picture from the database, so that the panel reflects my actual account information.

#### Acceptance Criteria

1. WHEN `ProviderLayout` renders, THE Provider_Panel SHALL fetch `GET /api/provider/me` with the stored JWT and display the returned `name` as the provider's display name in the sidebar header; IF the returned `name` is null or empty, THE Provider_Panel SHALL display `"Provider"` as a fallback.
2. WHEN `GET /api/provider/me` returns an `organizationName` value, THE Provider_Panel SHALL display that value below the display name in the sidebar header.
3. WHEN `GET /api/provider/me` returns a non-empty `profilePicture` URL, THE Provider_Panel SHALL render an `AvatarImage` using that URL in the sidebar header.
4. IF `profilePicture` is null or empty, THEN THE Provider_Panel SHALL render an `AvatarFallback` displaying the provider's initials, derived by taking the first letter of each whitespace-separated word in `name` (up to 2 letters, uppercased).
5. WHEN the provider's name or avatar in the sidebar header is clicked, THE Provider_Panel SHALL navigate to `/provider/settings`.
6. WHEN the sidebar header renders, THE Provider_Panel SHALL display a small "Edit Profile" link beneath the display name that navigates to `/provider/settings`.
7. IF `GET /api/provider/me` fails or returns a non-2xx status, THEN THE Provider_Panel SHALL fall back to displaying the cached user data from `getStoredUser()` and SHALL show a visible error indicator in the sidebar header.

---

### Requirement 5: Sidebar — Settings Navigation Item

**User Story:** As a Provider, I want a Settings link in the sidebar navigation, so that I can reach the settings page without clicking on the avatar.

#### Acceptance Criteria

1. WHEN `ProviderLayout` renders, THE Provider_Panel SHALL render a "Settings" nav item in the sidebar.
2. THE Provider_Panel SHALL render a divider element between the "Settings" nav item and the "Sign Out" button, with "Settings" positioned above the divider and "Sign Out" below it.
3. WHEN `ProviderLayout` renders, THE Provider_Panel SHALL render a `Settings` icon from `lucide-react` to the left of the "Settings" label.
4. WHEN the current URL path equals `/provider/settings`, THE Provider_Panel SHALL apply the active highlight style (`bg-[#1E3A5F] text-white`) to the "Settings" nav item.
5. IF the active-state detection mechanism fails, THEN THE Provider_Panel SHALL fall back to comparing the current path string directly against `/provider/settings` to determine the active state of the "Settings" nav item.

---

### Requirement 6: Provider Profile API

**User Story:** As a Provider, I want a dedicated profile endpoint, so that the settings page can fetch and update my full profile data.

#### Acceptance Criteria

1. WHEN `GET /api/provider/profile` is called with a valid provider JWT, THE Provider_Panel SHALL return a JSON object containing `name`, `email`, `organizationName`, `position`, `phone`, `officeAddress`, `description`, `website`, and `profilePicture`; fields with no stored value SHALL be represented as `null`.
2. WHEN `PUT /api/provider/profile` is called with a valid provider JWT and a JSON body, THE Provider_Panel SHALL persist only the supplied fields (`name`, `organizationName`, `position`, `phone`, `officeAddress`, `description`, `website`) to the User document; fields absent from the body SHALL remain unchanged.
3. WHEN `PUT /api/provider/profile` succeeds, THE Provider_Panel SHALL return the full updated profile in the same shape as `GET /api/provider/profile`.
4. IF `name` or `organizationName` in the `PUT` body is an empty string or a whitespace-only string, THEN THE Provider_Panel SHALL return HTTP 400 with a JSON error body indicating which field failed validation, and SHALL NOT apply any partial updates to the User document.
5. IF `website` is provided in the `PUT` body and does not begin with `http://` or `https://`, THEN THE Provider_Panel SHALL return HTTP 400 with a JSON error body indicating the website field failed validation, and SHALL NOT apply any partial updates to the User document.
6. IF the request to `GET /api/provider/profile` or `PUT /api/provider/profile` is made without a valid provider JWT or with an expired token, THEN THE Provider_Panel SHALL return HTTP 401 and SHALL NOT return or modify any profile data.

---

### Requirement 7: Provider Schema Additions

**User Story:** As a developer, I want the User model's `providerDetails` sub-document to have fields for extended provider profile data, so that the settings page can persist all required information.

#### Acceptance Criteria

1. THE User_Model's `providerDetails` sub-document SHALL include a `phone` field of type `String`, `default: null`, with a maximum length of 30 characters.
2. THE User_Model's `providerDetails` sub-document SHALL include an `officeAddress` field of type `String`, `default: null`, with a maximum length of 300 characters.
3. THE User_Model's `providerDetails` sub-document SHALL include a `description` field of type `String`, `default: null`, with a maximum length of 2000 characters.
4. THE User_Model's `providerDetails` sub-document SHALL include a `website` field of type `String`, `default: null`, with a maximum length of 2048 characters.
5. THE User_Model SHALL retain the existing root-level `profilePicture` field (type `String`, `default: null`) for storing the uploaded avatar URL.

---

### Requirement 8: Provider Avatar Upload API

**User Story:** As a Provider, I want to upload a profile picture from the settings page, so that my avatar is shown in the sidebar and on my profile.

#### Acceptance Criteria

1. WHEN `POST /api/provider/upload-avatar` is called with a valid provider JWT and a `multipart/form-data` body containing an `avatar` file field, THE Provider_Panel SHALL save the file to the `uploads/providers/` directory on disk.
2. WHEN the file is saved successfully to disk, THE Provider_Panel SHALL update the provider's `profilePicture` field in the `User_Model` to the relative URL path of the saved file (e.g., `/uploads/providers/{filename}`).
3. IF the database update fails after the file is already saved to disk, THEN THE Provider_Panel SHALL delete the saved file from disk before returning HTTP 500.
4. WHEN the upload and database update both succeed, THE Provider_Panel SHALL return `{ success: true, avatarUrl: "/uploads/providers/{filename}" }`.
5. IF the uploaded file exceeds 5 MB, THEN THE Provider_Panel SHALL return HTTP 400 with an error message; files that are exactly 5 MB SHALL be accepted.
6. IF the uploaded file's MIME type is not `image/jpeg`, `image/jpg`, or `image/png`, THEN THE Provider_Panel SHALL return HTTP 400 with an error message.
7. IF the request body does not contain an `avatar` file field, THEN THE Provider_Panel SHALL return HTTP 400 with an error message indicating the field is missing.
8. IF the request is made without a valid provider JWT or with an expired token, THEN THE Provider_Panel SHALL return HTTP 401 and SHALL NOT save any file or modify the database.

---

### Requirement 9: Provider Change Password API

**User Story:** As a Provider, I want to change my password from the settings page, so that I can keep my account secure.

#### Acceptance Criteria

1. WHEN `PUT /api/provider/change-password` is called with a valid provider JWT and a body containing `currentPassword`, `newPassword`, and `confirmNewPassword`, THE Provider_Panel SHALL verify `currentPassword` against the stored `passwordHash` using bcrypt.
2. IF `currentPassword` does not match the stored `passwordHash`, THEN THE Provider_Panel SHALL return HTTP 400 with the message `"Current password is incorrect"` and SHALL NOT update the database.
3. IF `newPassword` and `confirmNewPassword` do not match, THEN THE Provider_Panel SHALL return HTTP 400 with the message `"New passwords do not match"` and SHALL NOT update the database.
4. IF `newPassword` is fewer than 8 characters or more than 100 characters, THEN THE Provider_Panel SHALL return HTTP 400 with the message `"New password must be at least 8 characters"` and SHALL NOT update the database.
5. IF the request body is missing `currentPassword`, `newPassword`, or `confirmNewPassword`, THEN THE Provider_Panel SHALL return HTTP 400 with a descriptive error message indicating which field is missing.
6. WHEN all validations pass, THE Provider_Panel SHALL hash `newPassword` with bcrypt (cost factor 10) and save the new `passwordHash` to the User document, then return `{ success: true, message: "Password updated successfully" }`.
7. IF the request is made without a valid provider JWT or with an expired token, THEN THE Provider_Panel SHALL return HTTP 401 and SHALL NOT update any password data.

---

### Requirement 10: Provider Settings Page — Profile Section

**User Story:** As a Provider, I want a Profile Information section on the settings page, so that I can update my name, contact info, and organization details.

#### Acceptance Criteria

1. WHEN `/provider/settings` is loaded, THE Provider_Panel SHALL fetch `GET /api/provider/profile` and pre-fill all form fields with the returned data before the user can interact with them.
2. THE Provider_Panel SHALL render an `Avatar` component showing the provider's current `profilePicture` if non-null, or an initial-based fallback otherwise.
3. THE Provider_Panel SHALL render a `[Choose File]` input that accepts only files with `.jpg`, `.jpeg`, or `.png` extensions. WHEN a file is selected and the user subsequently clicks `[Save Profile]`, THE Provider_Panel SHALL send the selected file to `POST /api/provider/upload-avatar` before sending the profile form data, and SHALL update the avatar display with the returned `avatarUrl`; selecting a file without clicking `[Save Profile]` SHALL NOT trigger any network request.
4. IF `POST /api/provider/upload-avatar` returns a non-2xx response, THEN THE Provider_Panel SHALL display the error message inline and SHALL NOT send `PUT /api/provider/profile`.
5. THE Provider_Panel SHALL render a required "Organization Name" text input pre-filled from the API response, with client-side validation preventing submission when the value is empty or whitespace-only.
6. THE Provider_Panel SHALL render a required "Full Name" text input pre-filled from the API response, with client-side validation preventing submission when the value is empty or whitespace-only.
7. THE Provider_Panel SHALL render optional text inputs for "Position / Title", "Phone Number", and "Office Address", each pre-filled from the API response.
8. THE Provider_Panel SHALL render a read-only "Official Email Address" field displaying the provider's email; the field SHALL NOT be included in the `PUT /api/provider/profile` request body.
9. WHEN `[Save Profile]` is clicked and client-side validation passes, THE Provider_Panel SHALL send `PUT /api/provider/profile` with the current form values and display a success toast on HTTP 200.
10. IF the `PUT /api/provider/profile` call returns a non-2xx status, THEN THE Provider_Panel SHALL display the server error message inline beneath the form without navigating away, and SHALL preserve all current form field values.

---

### Requirement 11: Provider Settings Page — Account Security Section

**User Story:** As a Provider, I want a Change Password section on the settings page, so that I can update my login credentials.

#### Acceptance Criteria

1. THE Provider_Panel SHALL render three password inputs labeled "Current Password", "New Password", and "Confirm New Password".
2. THE Provider_Panel SHALL render an eye-toggle button beside each password input that toggles the field's `type` attribute between `"password"` and `"text"`.
3. WHEN `[Update Password]` is clicked, THE Provider_Panel SHALL send `PUT /api/provider/change-password` with `currentPassword`, `newPassword`, and `confirmNewPassword`.
4. WHEN the response HTTP status is 200 and the response body contains `success: true`, THE Provider_Panel SHALL clear all three password fields and display a success toast; clearing the fields and displaying the toast SHALL each execute independently without blocking the other.
5. IF the response body contains an error message, THEN THE Provider_Panel SHALL display that error message inline beneath the password form; the three password field values SHALL be preserved so the user can correct and resubmit.

---

### Requirement 12: Provider Settings Page — About / Description Section

**User Story:** As a Provider, I want an About section on the settings page, so that I can describe my organization and provide a website link for students to see.

#### Acceptance Criteria

1. THE Provider_Panel SHALL render a "Organization Description" textarea pre-filled from the API response's `description` field (or empty if null), with placeholder text `"Tell students about your organization and scholarship programs..."`.
2. THE Provider_Panel SHALL render an optional "Website" text input pre-filled from the API response's `website` field (or empty if null).
3. WHEN `[Save Description]` is clicked, THE Provider_Panel SHALL send `PUT /api/provider/profile` with the current `description` and `website` values as the request body.
4. WHEN the HTTP status is 200 and the response body contains `success: true`, THE Provider_Panel SHALL display a success toast.
5. IF the response body contains an error message text, THEN THE Provider_Panel SHALL display that error message inline beneath the form; the `description` and `website` field values SHALL be preserved.

---

### Requirement 13: New Route Registration

**User Story:** As a developer, I want `/provider/settings` registered in the React Router config, so that the settings page is reachable from the sidebar and direct navigation.

#### Acceptance Criteria

1. THE Provider_Panel SHALL register `{ path: "settings", Component: ProviderSettings }` as a child route under the `provider` path in `FrontEnd/src/app/routes.tsx`.
2. WHEN a user navigates directly to `/provider/settings`, THE Provider_Panel SHALL render the `Provider_Settings_Page` inside `ProviderLayout` without redirecting to any other path.
3. THE Provider_Panel SHALL export the settings page component as a named export `ProviderSettings` from `FrontEnd/src/app/pages/provider/settings.tsx`.
4. WHEN `ProviderLayout` is rendered at any `/provider/*` path, THE Provider_Panel SHALL NOT render the `Provider_Settings_Page` content unless the current path is `/provider/settings`.
