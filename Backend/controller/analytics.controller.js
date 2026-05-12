import ReportMetric from "../models/reportMetric.model.js";

export const getMetrics = async (req, res) => {
  try {
    const metrics = await ReportMetric.find().sort({ createdAt: -1 }).lean();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch metrics" });
  }
};

export const createMetric = async (req, res) => {
  try {
    const metric = await ReportMetric.create(req.body);
    res.status(201).json(metric);
  } catch (err) {
    res.status(400).json({ message: "Failed to create metric" });
  }
};
