# 🎯 Screening Appointment Feature

## Overview

The Screening Appointment system enables admins to schedule final screening/interview dates and times for students whose applications are eligible. This adds a crucial workflow step between automatic eligibility verification and final scholarship decision.

---

## 📊 Feature Workflow

```
Student Application Submitted
         ↓
System Eligibility Check (Automatic)
         ↓
Is Eligible? → NO → Mark as "Not Eligible"
         ↓ YES
Admin Reviews Application
         ↓
Is Application Valid? → NO → Reject
         ↓ YES
✨ NEW: Admin Sets Screening Appointment ✨
         ↓
Student Receives Screening Details
         ↓
Student Attends Screening Interview
         ↓
Admin Finalizes Decision (Approve/Reject)
```

---

## 🔌 API Endpoints

### 1. Schedule Screening Appointment
**Endpoint**: `PATCH /api/admin/applications/:id/schedule-screening`  
**Role**: Admin  
**Purpose**: Schedule a screening date/time for an eligible application

**Request Body**:
```json
{
  "scheduledDate": "2026-05-20",
  "scheduledTime": "14:30",
  "venue": "QCSP Conference Room, Baguio City",
  "notes": "Bring all required documents and valid ID"
}
```

**Response** (Status 200):
```json
{
  "data": {
    "_id": "ObjectId",
    "studentName": "John Doe",
    "studentEmail": "john@example.com",
    "scholarshipName": "QCSP Academic Excellence",
    "status": "System Qualified",
    "screeningSchedule": {
      "scheduledDate": "2026-05-20T14:30:00.000Z",
      "scheduledTime": "14:30",
      "venue": "QCSP Conference Room, Baguio City",
      "scheduledBy": "ObjectId",
      "scheduledAt": "2026-05-12T10:00:00.000Z",
      "notes": "Bring all required documents and valid ID",
      "isScheduled": true
    }
  },
  "message": "Screening appointment scheduled successfully.",
  "screening": { ... }
}
```

**Error Responses**:
- `400`: Missing/invalid fields or past date/time
- `404`: Application not found
- `500`: Server error

---

### 2. Get Student's Screening Appointments
**Endpoint**: `GET /api/users/:email/screening-appointments`  
**Role**: Student  
**Purpose**: View all scheduled screening appointments

**Response** (Status 200):
```json
{
  "data": [
    {
      "applicationId": "ObjectId",
      "scholarshipName": "QCSP Academic Excellence",
      "status": "System Qualified",
      "submittedAt": "2026-05-10T08:30:00.000Z",
      "screening": {
        "scheduledDate": "2026-05-20T14:30:00.000Z",
        "scheduledTime": "14:30",
        "venue": "QCSP Conference Room, Baguio City",
        "notes": "Bring all required documents and valid ID",
        "scheduledAt": "2026-05-12T10:00:00.000Z"
      }
    }
  ],
  "count": 1,
  "message": "Screening appointments retrieved successfully."
}
```

---

### 3. Get Screening Details (Admin)
**Endpoint**: `GET /api/admin/applications/:id/screening`  
**Role**: Admin  
**Purpose**: View detailed screening information for an application

**Response** (Status 200):
```json
{
  "data": {
    "applicationId": "ObjectId",
    "studentName": "John Doe",
    "studentEmail": "john@example.com",
    "scholarshipName": "QCSP Academic Excellence",
    "status": "System Qualified",
    "screeningSchedule": {
      "scheduledDate": "2026-05-20T14:30:00.000Z",
      "scheduledTime": "14:30",
      "venue": "QCSP Conference Room, Baguio City",
      "notes": "Bring all required documents and valid ID",
      "isScheduled": true
    }
  }
}
```

---

## 🗄️ Database Schema Changes

### Application Collection
Added `screeningSchedule` object to applications:

```javascript
{
  _id: ObjectId,
  studentEmail: "john@example.com",
  scholarshipName: "QCSP Academic Excellence",
  status: "System Qualified",
  
  // NEW FIELD:
  screeningSchedule: {
    scheduledDate: Date,        // Appointment date and time
    scheduledTime: String,      // HH:MM format (24-hour)
    venue: String,              // Physical location or online link
    scheduledBy: ObjectId,      // Admin who scheduled
    scheduledAt: Date,          // When appointment was scheduled
    notes: String,              // Special instructions
    isScheduled: Boolean        // true when appointment is set
  },

  eligibilityCheck: { ... },
  finalReview: { ... }
}
```

---

## 📋 Usage Examples

### Example 1: Admin Schedules Screening for Eligible Student

```bash
# 1. Admin gets applications
curl -X GET "http://localhost:5000/api/admin/applications" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 2. Admin finds eligible student application
# Response shows: eligibilityCheck.passed = true

# 3. Admin schedules screening appointment
curl -X PATCH "http://localhost:5000/api/admin/applications/{APP_ID}/schedule-screening" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduledDate": "2026-05-20",
    "scheduledTime": "14:30",
    "venue": "QCSP Conference Room, Baguio City",
    "notes": "Bring all required documents and valid ID"
  }'
```

### Example 2: Student Views Screening Appointment

```bash
# Student checks their screening appointments
curl -X GET "http://localhost:5000/api/users/john@example.com/screening-appointments" \
  -H "Authorization: Bearer STUDENT_TOKEN"

# Response includes:
# - Scholarship name
# - Scheduled date and time
# - Venue information
# - Special notes/instructions
```

---

## ✅ Validation Rules

### Date & Time Validation
- ✅ Date must be in format `YYYY-MM-DD`
- ✅ Time must be in format `HH:MM` (24-hour)
- ✅ Must be scheduled for future date/time
- ✅ Cannot schedule in the past

### Required Fields
- ✅ `scheduledDate` - Required
- ✅ `scheduledTime` - Required
- ✅ `venue` - Required
- ⚪ `notes` - Optional

### Business Rules
- ✅ Only eligible applications can have screening scheduled
- ✅ Admin must be authenticated
- ✅ Student must be registered to view appointments
- ✅ Multiple screening appointments per student supported (different scholarships)

---

## 🧪 Testing the Feature

### Run the Complete Test Suite
```bash
cd Backend
$env:MONGODB_DB='thesis_software_test'
node ./tests/screeningFeatureTest.js
```

### Expected Test Results
```
✅ 1.1 Student Registration
✅ 1.2 Get Eligible Scholarships
✅ 1.3 Student Submits Application
✅ 2.1 Admin Login
✅ 2.2 Admin Views Applications
✅ 2.3 Admin Finds Student Application
✅ 3.1 Student is Eligible
✅ 4.2 Schedule Screening Appointment
✅ 4.3 Verify Screening Details
✅ 5.1 Student Retrieves Screening Appointments
✅ 5.2 Verify Appointment Details
✅ 5.3 Confirm Scholarship Name
✅ 5.4 Display Appointment Notes
✅ 6.1 Admin Retrieves Screening Details
✅ 6.2 Verify Complete Screening Info
```

---

## 📈 Integration Points

### With Existing Features
1. **Eligibility Matching**: Uses existing `eligibilityCheck` to verify applicant
2. **Application Status**: Updates application status to track progress
3. **User Management**: Links to student emails and admin IDs
4. **Scholarships**: References scholarship names and IDs

### Frontend Integration (Recommended)

**Admin Dashboard - Screening Tab**
- List eligible applications
- One-click scheduling form
- Calendar/date picker for appointment dates
- Send email notification to students

**Student Dashboard - My Appointments**
- Display all screening appointments
- Show venue and time details
- Allow appointment reminders
- Show confirmation status

---

## 🚨 Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid date format` | Date not in YYYY-MM-DD | Use format: 2026-05-20 |
| `Invalid time format` | Time not in HH:MM | Use format: 14:30 (24-hour) |
| `Screening date must be future` | Date is in past | Schedule for future date |
| `Application not found` | Wrong application ID | Verify application exists |
| `Scholarship not found` | Scholarship deleted | Check scholarship status |

---

## 🔒 Security & Permissions

### Role-Based Access
- **Admin**: Can schedule/view screening appointments
- **Student**: Can only view their own appointments
- **Others**: No access (403 Forbidden)

### Data Protection
- Application emails normalized (case-insensitive)
- Date/time validation prevents injection
- Admin ID tracked for audit trail
- Scheduled by timestamp recorded

---

## 📞 Support for Next Steps

### Recommended Enhancements
1. **Email Notifications**: Send appointment details to student email
2. **SMS Reminders**: Notify students 24 hours before appointment
3. **Calendar Integration**: Export to Google Calendar/Outlook
4. **Result Recording**: Track whether student attended and outcome
5. **Rescheduling**: Allow students to request appointment changes
6. **Admin Cancellation**: Add ability to cancel appointments
7. **Bulk Scheduling**: Schedule multiple appointments at once

---

## 📝 Summary

The Screening Appointment feature provides:
- ✅ Structured appointment scheduling
- ✅ Clear date/time validation
- ✅ Student access to appointment details
- ✅ Admin audit trail
- ✅ Integration with existing eligibility system
- ✅ Foundation for notifications and reminders

This completes the application workflow from submission → eligibility check → screening appointment → final decision.
