import Scholarship from "../models/scholarship.model.js";
import Application from "../models/application.model.js";

// GET /api/admin/scholarships - Get all scholarships (admin)
export const getAllScholarshipsAdmin = async (req, res) => {
  try {
    const scholarships = await Scholarship.find().sort({ createdAt: -1 });
    const scholarshipsWithCount = await Promise.all(
      scholarships.map(async (s) => {
        const count = await Application.countDocuments({ 
          scholarshipId: s._id 
        });
        return { ...s.toObject(), applicationsCount: count };
      })
    );
    res.json({ data: scholarshipsWithCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/admin/scholarships - Create new scholarship
export const createScholarship = async (req, res) => {
  try {
    const {
      name,
      provider,
      organization,
      amount,
      deadline,
      status,
      type,
      fieldOfStudy,
      location,
      description,
      eligibilityCriteria,
    } = req.body;

    const scholarship = new Scholarship({
      name,
      provider,
      organization,
      amount: Number(amount),
      deadline: new Date(deadline),
      status: status || "Active",
      type,
      fieldOfStudy,
      location,
      description,
      eligibilityCriteria,
      applicationsCount: 0,
    });

    const saved = await scholarship.save();
    res.status(201).json({ data: saved });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PUT /api/admin/scholarships/:id - Update scholarship
export const updateScholarship = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.amount) {
      updates.amount = Number(updates.amount);
    }
    if (updates.deadline) {
      updates.deadline = new Date(updates.deadline);
    }

    const scholarship = await Scholarship.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!scholarship) {
      return res.status(404).json({ message: "Scholarship not found" });
    }

    res.json({ data: scholarship });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE /api/admin/scholarships/:id - Delete scholarship
export const deleteScholarship = async (req, res) => {
  try {
    const { id } = req.params;
    const scholarship = await Scholarship.findByIdAndDelete(id);

    if (!scholarship) {
      return res.status(404).json({ message: "Scholarship not found" });
    }

    res.json({ message: "Scholarship deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/scholarships - Get all scholarships (public)
export const getAllScholarships = async (req, res) => {
  try {
    const { 
      status, 
      type, 
      fieldOfStudy, 
      location, 
      minGPA, 
      amountMin, 
      amountMax 
    } = req.query;
    
    console.log('Active filters received:', {
      status, type, fieldOfStudy, location, minGPA, amountMin, amountMax
    });
    
    const filter = {};

    // Status filter (usually "Active" for public view)
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Type filter - null/empty means "open to all types"
    if (type && type !== 'all') {
      filter.$or = [
        { type: { $regex: type, $options: 'i' } },
        { type: null },
        { type: '' },
        { type: 'All Types' },
        { type: { $exists: false } }
      ];
    }

    // Field of Study filter - null/empty means "open to all fields"
    if (fieldOfStudy && fieldOfStudy !== 'all') {
      const normalizedField = fieldOfStudy.toLowerCase().replace(/-/g, ' ');
      console.log(`Filtering for field of study: "${normalizedField}"`);
      
      filter.$or = filter.$or || [];
      filter.$or.push(
        { fieldOfStudy: { $regex: normalizedField, $options: 'i' } },
        { fieldOfStudy: null },
        { fieldOfStudy: '' },
        { fieldOfStudy: 'All Fields' },
        { fieldOfStudy: { $exists: false } }
      );
    }

    // Location filter - null/empty means "open to all locations"
    if (location && location !== 'all') {
      filter.$or = filter.$or || [];
      filter.$or.push(
        { location: { $regex: location, $options: 'i' } },
        { location: null },
        { location: '' },
        { location: 'All Locations' },
        { location: { $exists: false } }
      );
    }

    // GPA filter - only filter if scholarship has a minimumGPA requirement
    if (minGPA && minGPA !== 'all') {
      const gpaThreshold = Number(minGPA);
      if (!isNaN(gpaThreshold)) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { minimumGpa: { $lte: gpaThreshold } },
            { minimumGPA: { $lte: gpaThreshold } },
            { minimumGpa: { $exists: false } },
            { minimumGPA: { $exists: false } },
            { minimumGpa: null },
            { minimumGPA: null }
          ]
        });
      }
    }

    // Amount range filter
    if (amountMin || amountMax) {
      const min = Number(amountMin) || 0;
      const max = Number(amountMax) || 100000;
      filter.$and = filter.$and || [];
      filter.$and.push({
        amount: { $gte: min, $lte: max }
      });
    }

    console.log('Final MongoDB filter:', JSON.stringify(filter, null, 2));

    const scholarships = await Scholarship.find(filter).sort({ createdAt: -1 });
    
    // Log fieldOfStudy values for debugging
    scholarships.forEach(s => {
      console.log(`Scholarship "${s.name}": fieldOfStudy = "${s.fieldOfStudy}", type = "${s.type}", location = "${s.location}"`);
    });
    
    res.json({ data: scholarships });
  } catch (error) {
    console.error('Error in getAllScholarships:', error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/scholarships/:id - Get scholarship by ID
export const getScholarshipById = async (req, res) => {
  try {
    const { id } = req.params;
    const scholarship = await Scholarship.findById(id);

    if (!scholarship) {
      return res.status(404).json({ message: "Scholarship not found" });
    }

    res.json({ data: scholarship });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
