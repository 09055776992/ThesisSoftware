import Application from "../models/application.model.js";
import Scholarship from "../models/scholarship.model.js";

// GET /api/admin/applications - Get all applications
export const getAllApplications = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    const applications = await Application.find(filter)
      .populate("scholarshipId", "name amount")
      .sort({ submittedAt: -1 });

    // Get counts for stat cards
    const counts = await Application.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      pending: counts.find((c) => c._id === "Pending")?.count || 0,
      underReview: counts.find((c) => c._id === "Under Review")?.count || 0,
      approved: counts.find((c) => c._id === "Approved")?.count || 0,
      rejected: counts.find((c) => c._id === "Rejected")?.count || 0,
    };

    res.json({ data: applications, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/admin/applications/:id/approve - Approve application
export const approveApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findByIdAndUpdate(
      id,
      { $set: { status: "Approved" } },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json({ data: application, message: "Application approved successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/admin/applications/:id/reject - Reject application
export const rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findByIdAndUpdate(
      id,
      { $set: { status: "Rejected" } },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json({ data: application, message: "Application rejected successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/admin/applications/:id/review - Set application to under review
export const reviewApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findByIdAndUpdate(
      id,
      { $set: { status: "Under Review" } },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json({ data: application, message: "Application moved to under review" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/applications - Submit new application (student)
export const submitApplication = async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      studentEmail,
      scholarshipId,
      scholarshipName,
      matchScore,
    } = req.body;

    const application = new Application({
      studentId,
      studentName,
      studentEmail,
      scholarshipId,
      scholarshipName,
      matchScore: matchScore || 0,
      status: "Pending",
    });

    const saved = await application.save();

    // Increment applications count on scholarship
    await Scholarship.findByIdAndUpdate(scholarshipId, {
      $inc: { applicationsCount: 1 },
    });

    res.status(201).json({ data: saved });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/applications/student/:studentId - Get applications by student
export const getApplicationsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const applications = await Application.find({ studentId })
      .populate("scholarshipId", "name amount")
      .sort({ submittedAt: -1 });

    res.json({ data: applications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
