import mongoose, { Schema } from "mongoose";

const scholarshipSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    organization: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    openingDate: {
      type: Date,
      default: null,
    },
    deadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Closed"],
      default: "Active",
    },
    type: {
      type: String,
      enum: ["Merit-Based", "Need-Based", "Athletic", "Minority", "Other"],
      required: true,
    },
    fieldOfStudy: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    // Minimum GPA/GWA requirement (supports both scales)
    minimumGPA: {
      type: Number,
      min: 0,
      max: 5.0,
    },
    // Education level required for this scholarship
    requiredEducationLevel: [{
      type: String,
      enum: ["Junior High School", "Senior High School", "College / Undergraduate", "Vocational / TESDA", "Postgraduate (Masters / Doctorate)"],
    }],
    // Specific eligibility criteria descriptions
    specificCriteria: [{
      type: String,
      trim: true,
    }],
    // Documents required specifically for this scholarship
    requiredDocuments: [{
      type: String,
      trim: true,
    }],
    // Documents required by ALL applicants (general requirements)
    generalDocuments: [{
      type: String,
      trim: true,
    }],
    eligibilityCriteria: {
      minGPA: {
        type: Number,
        min: 0,
        max: 4.0,
      },
      minGWA: {
        type: Number,
        min: 1.0,
        max: 5.0,
      },
      educationLevel: [{
        type: String,
        enum: ["Junior High School", "Senior High School", "College / Undergraduate", "Vocational / TESDA", "Postgraduate (Masters / Doctorate)"],
      }],
      yearLevel: {
        type: String,
        trim: true,
      },
      fieldOfStudy: [{
        type: String,
        trim: true,
      }],
      qcResident: {
        type: Boolean,
        default: false,
      },
      location: {
        type: String,
        trim: true,
      },
      incomeCategory: {
        type: String,
        enum: ["Low", "Lower-Middle", "Middle", "Upper-Middle", "High"],
      },
      maxIncome: {
        type: Number,
      },
      financialNeedScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      ageRange: {
        type: String,
        trim: true,
      },
      requiresAcademicHonors: Boolean,
      requiresSpecializedTrack: Boolean,
      isAthlete: Boolean,
      isArtist: Boolean,
      isSKOfficial: Boolean,
      isStudentLeader: Boolean,
      isIndigent: Boolean,
      isPWD: Boolean,
      isSoloParent: Boolean,
      isGovernmentEmployee: Boolean,
      isCHEDPriorityCourse: Boolean,
      isFirstYear: Boolean,
      holisticEvaluation: Boolean,
    },
    applicationsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Scholarship = mongoose.model("Scholarship", scholarshipSchema);
export default Scholarship;
