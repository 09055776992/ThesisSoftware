import Testimonial from "../models/testimonial.model.js";

export const getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isVisible: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json(testimonials);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch testimonials" });
  }
};

export const createTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.create(req.body);
    res.status(201).json(testimonial);
  } catch (err) {
    res.status(400).json({ message: "Failed to create testimonial" });
  }
};
