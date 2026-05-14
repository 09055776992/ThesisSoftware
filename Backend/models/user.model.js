import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    // Profile Completion - Step 1
    profilePicture: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      default: null,
    },
    dateOfBirth: {
      type: String,
      default: null,
    },

    // Profile Completion - Step 2 (Academic & School Information)
    gpa: {
      type: String,
      default: null,
    },
    educationLevel: {
      type: String,
      default: null,
      enum: [
        "junior-high",
        "senior-high",
        "college",
        "vocational",
        "postgraduate",
        null,
      ],
    },
    yearLevel: {
      type: String,
      default: null,
    },
    schoolName: {
      type: String,
      default: null,
    },
    schoolCampus: {
      type: String,
      default: null,
    },
    schoolType: {
      type: String,
      default: null,
      enum: [
        "public-university",
        "private-university",
        "public-senior-high",
        "private-senior-high",
        "public-junior-high",
        "private-junior-high",
        "tesda",
        "vocational",
        "graduate-school",
        null,
      ],
    },
    schoolLocation: {
      type: String,
      default: null,
      enum: ["quezon-city", "outside-qc", "outside-mm", null],
    },
    fieldOfStudy: {
      type: String,
      default: null,
    },
    graduationYear: {
      type: String,
      default: null,
    },

    // Profile Completion - Step 3 (Special Categories)
    specialCategories: {
      type: {
        isAthlete: { type: Boolean, default: false },
        isArtist: { type: Boolean, default: false },
        isSKOfficial: { type: Boolean, default: false },
        isStudentCouncilLeader: { type: Boolean, default: false },
        isFromIndigenousFamily: { type: Boolean, default: false },
        isPersonWithDisability: { type: Boolean, default: false },
        isSoloParent: { type: Boolean, default: false },
      },
      default: {},
    },

    // Profile Completion - Step 3 (Financial Information)
    financialNeed: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    netWorth: {
      type: String,
      default: null,
    },
    currency: {
      type: String,
      default: "PHP",
    },
    incomeCategory: {
      type: String,
      default: null,
      enum: [
        "under-25000",
        "25000-50000",
        "50000-100000",
        "100000+",
        null,
      ],
    },

    // Profile completion status
    profileCompletionStatus: {
      step1Completed: { type: Boolean, default: false },
      step2Completed: { type: Boolean, default: false },
      step3Completed: { type: Boolean, default: false },
      fullProfileCompleted: { type: Boolean, default: false },
      completedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;