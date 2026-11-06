import mongoose from "mongoose";

const renewalDocumentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scholarshipRenewalSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, default: "" },
    studentEmail: { type: String, required: true, lowercase: true, trim: true },
    originalApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
    scholarshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scholarship",
      required: true,
    },
    scholarshipName: { type: String, default: "" },
    renewalPeriodNumber: { type: Number, required: true },
    submissionNumber: { type: Number, default: 1 },
    isCurrent: { type: Boolean, default: true },
    registrationCard: { type: renewalDocumentSchema, required: true },
    previousSemesterGrades: { type: renewalDocumentSchema, required: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    reviewNote: { type: String, default: "" },
    reviewedBy: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "scholarshipRenewals",
  }
);

scholarshipRenewalSchema.index(
  { originalApplicationId: 1, renewalPeriodNumber: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);

const ScholarshipRenewal =
  mongoose.models.ScholarshipRenewal ||
  mongoose.model("ScholarshipRenewal", scholarshipRenewalSchema);

export default ScholarshipRenewal;
