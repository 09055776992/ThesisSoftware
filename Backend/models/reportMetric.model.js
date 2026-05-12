import mongoose from "mongoose";

const reportMetricSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: Number,
      required: true,
    },
    period: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Object,
    },
  },
  { timestamps: true }
);

const ReportMetric = mongoose.model("ReportMetric", reportMetricSchema);
export default ReportMetric;
