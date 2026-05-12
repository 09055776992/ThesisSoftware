import mongoose, { Schema } from "mongoose";

const applicationSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentEmail: {
      type: String,
      required: true,
      trim: true,
    },
    scholarshipId: {
      type: Schema.Types.ObjectId,
      ref: "Scholarship",
      required: true,
    },
    scholarshipName: {
      type: String,
      required: true,
      trim: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Pending", "System Qualified", "Under Review", "Approved", "Rejected"],
      default: "Pending",
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    // Pre-screening information
    eligibilityCheck: {
      passed: {
        type: Boolean,
        default: false,
      },
      checkedAt: {
        type: Date,
        default: null,
      },
      unmetCriteria: [{
        type: String,
      }],
      metCriteria: [{
        type: String,
      }],
    },
    // Screening appointment scheduling
    screeningSchedule: {
      scheduledDate: {
        type: Date,
        default: null,
      },
      scheduledTime: {
        type: String, // Format: "HH:MM" (24-hour)
        default: null,
      },
      venue: {
        type: String,
        default: null,
        trim: true,
      },
      scheduledBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      scheduledAt: {
        type: Date,
        default: null,
      },
      notes: {
        type: String,
        trim: true,
      },
      isScheduled: {
        type: Boolean,
        default: false,
      },
    },
    // Staff final screening
    finalReview: {
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      notes: {
        type: String,
        trim: true,
      },
    },
    documents: [
      {
        name: String,
        url: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Application = mongoose.model("Application", applicationSchema);
export default Application;
