# ⚡ Screening Appointment Feature - Quick Reference

## 🎯 What's New?

Admins can now schedule final screening appointments for eligible scholarship applicants.

**Complete Workflow:**
```
Student Applies → System Checks Eligibility → ✨ Admin Schedules Screening ✨ → Student Attends Interview
```

---

## 🔑 Key Features

| Feature | Description | Who Uses |
|---------|-------------|----------|
| Schedule Appointments | Set date, time, venue for screening | Admin |
| View Appointments | Students see their screening details | Student |
| Validation | Ensures dates/times are future and valid | System |
| Audit Trail | Tracks who scheduled and when | Admin |
| Eligibility Check | Only eligible students can be scheduled | System |

---

## 🚀 Quick Start - How to Use

### For Admins:

1. **Login as Admin**
   ```
   Email: admin@qcsp.gov.ph
   Password: admin123
   ```

2. **View Applications**
   - Go to "Applications" dashboard
   - Filter for eligible applications (✅ mark)

3. **Schedule Screening**
   - Click "Schedule Screening" button
   - Enter appointment details:
     - Date: `2026-05-20`
     - Time: `14:30`
     - Venue: `QCSP Conference Room`
     - Notes: Optional instructions

4. **Confirm**
   - System saves appointment
   - Student receives notification

### For Students:

1. **Login as Student**
   - Use email and password

2. **View Appointments**
   - Go to "My Screening Appointments"
   - See all scheduled appointments
   - View venue, date, time, and notes

3. **Prepare for Screening**
   - Check required documents from notes
   - Confirm date and venue
   - Set reminder if needed

---

## 📡 API Quick Reference

### Admin: Schedule Appointment
```bash
PATCH /api/admin/applications/{ID}/schedule-screening

{
  "scheduledDate": "2026-05-20",
  "scheduledTime": "14:30",
  "venue": "Conference Room",
  "notes": "Bring ID and documents"
}
```

### Student: View Appointments
```bash
GET /api/users/{email}/screening-appointments
```

### Admin: View Details
```bash
GET /api/admin/applications/{ID}/screening
```

---

## ✅ Testing Locally

**Run Complete Test:**
```bash
cd Backend
$env:MONGODB_DB='thesis_software_test'
node ./tests/screeningFeatureTest.js
```

**Expected Output:**
```
✅ Student Registration
✅ Get Eligible Scholarships
✅ Submit Application
✅ Admin Login
✅ Admin Finds Application
✅ Student is Eligible
✅ Schedule Screening
✅ Student Views Appointments
✅ Admin Views Details
```

---

## 📋 Database Fields Added

New field in **Applications Collection**:
```javascript
screeningSchedule: {
  scheduledDate: "2026-05-20T14:30:00.000Z",
  scheduledTime: "14:30",
  venue: "Conference Room",
  scheduledBy: ObjectId,
  scheduledAt: "2026-05-12T10:00:00.000Z",
  notes: "Bring ID",
  isScheduled: true
}
```

---

## 🎨 UI Components Needed (Frontend)

### Admin Interface
- **Application Card**: Show "Schedule Screening" button
- **Modal/Form**: Date/time picker, text inputs
- **Success Message**: Confirmation after scheduling
- **View Appointment**: Display scheduled details

### Student Interface
- **Appointment Card**: Show date, time, venue, notes
- **Reminder**: "Screening on [date]"
- **Directions**: Link to venue location
- **Status**: Show if appointment is confirmed

---

## ⚙️ Configuration

### Date Format: `YYYY-MM-DD`
```
✅ 2026-05-20
❌ 05/20/2026
❌ May 20, 2026
```

### Time Format: `HH:MM` (24-hour)
```
✅ 14:30 (2:30 PM)
✅ 09:00 (9:00 AM)
❌ 2:30 PM
❌ 14:30:00
```

### Future Date Required
```
✅ Today + 7 days
✅ Today + 365 days
❌ Today (must be future)
❌ Yesterday
```

---

## 🔍 Troubleshooting

### "Invalid date format"
- Use: `YYYY-MM-DD` (e.g., `2026-05-20`)

### "Invalid time format"
- Use: `HH:MM` 24-hour (e.g., `14:30`)

### "Screening date must be in the future"
- Schedule for a date after today

### "Application not found"
- Verify the application ID exists
- Check if application was deleted

---

## 📊 Status Flow

```
Application Submitted
    ↓
Pending
    ↓
System Qualified (Eligible ✅)
    ↓
✨ Screening Scheduled
    ↓
Under Review (After screening)
    ↓
Approved OR Rejected
```

---

## 🎁 What's Included

### New Files Created
- `Backend/tests/screeningFeatureTest.js` - Complete test suite
- `SCREENING_APPOINTMENT_FEATURE.md` - Full documentation

### Modified Files
- `Backend/models/application.model.js` - Added screeningSchedule field
- `Backend/index.js` - Added 3 new API endpoints

### New API Endpoints
1. `PATCH /api/admin/applications/:id/schedule-screening` - Schedule
2. `GET /api/users/:email/screening-appointments` - Student views
3. `GET /api/admin/applications/:id/screening` - Admin views details

---

## 🚀 Next Steps

1. ✅ Backend APIs implemented
2. ⏳ Frontend UI components needed
3. ⏳ Email notifications (recommended)
4. ⏳ SMS reminders (recommended)
5. ⏳ Calendar integration (optional)

---

## 📞 Questions?

- **Test file**: `Backend/tests/screeningFeatureTest.js`
- **Full docs**: `SCREENING_APPOINTMENT_FEATURE.md`
- **API examples**: See endpoints section above
