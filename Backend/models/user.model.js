import mongoose from "mongoose";

const providerDetailsSchema = new mongoose.Schema(
  {
    organizationName: { type: String, default: "" },
    position: { type: String, default: "" },
    phone: { type: String, default: "" },
    officeAddress: { type: String, default: "" },
    description: { type: String, default: "" },
    website: { type: String, default: "" },
    isApproved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    deactivatedAt: { type: Date, default: null },
    requestedAt: { type: Date, default: null },
    // Credential documents uploaded during registration
    credentials: {
      type: [
        {
          fileName: { type: String },
          storedName: { type: String },
          filePath: { type: String },
          fileSize: { type: Number },
          mimeType: { type: String },
          uploadedAt: { type: Date },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: "" },
    userName: { type: String, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "student", "provider", "admin", "mentor"],
      default: "customer",
    },
    userType: { type: String, default: undefined },
    profileImage: { type: String, default: "" },
    profilePicture: { type: String, default: "" },
    profileCompletionStatus: { type: mongoose.Schema.Types.Mixed, default: "incomplete" },
    providerDetails: { type: providerDetailsSchema, default: () => ({}) },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "users",
    strict: false,
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;