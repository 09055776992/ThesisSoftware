import mongoose from "mongoose";

const scholarshipSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, default: "", trim: true },
    organization: { type: String, default: "", trim: true },
    providerName: { type: String, default: "", trim: true },
    amount: { type: Number, default: 0 },
    deadline: { type: Date, default: null },
    openingDate: { type: Date, default: null },
    status: { type: String, default: "Active" },
    type: { type: String, default: "" },
    fieldOfStudy: { type: String, default: "" },
    location: { type: String, default: "" },
    description: { type: String, default: "" },
    minimumGPA: { type: Number, default: undefined },
    minimumGpa: { type: Number, default: undefined },
    requiredEducationLevel: { type: [String], default: [] },
    specificCriteria: { type: [String], default: [] },
    requiredDocuments: { type: [String], default: [] },
    generalDocuments: { type: [String], default: [] },
    eligibilityCriteria: { type: mongoose.Schema.Types.Mixed, default: {} },
    applicationsCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    renewalPeriodOpen: { type: Boolean, default: false },
    renewalPeriodNumber: { type: Number, default: 0 },
    renewalPeriodOpenedAt: { type: Date, default: null },
    renewalPeriodClosedAt: { type: Date, default: null },
    // Bulk-notification bookkeeping: one "new scholarship" blast per document
    notifiedAt: { type: Date, default: null },
    notifiedCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "scholarships",
    strict: false,
  }
);

scholarshipSchema.index({ name: 1, provider: 1 });

const Scholarship = mongoose.models.Scholarship || mongoose.model("Scholarship", scholarshipSchema);

export default Scholarship;