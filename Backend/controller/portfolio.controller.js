import PortfolioItem from "../models/portfolioItem.model.js";

export const getPortfolioItems = async (req, res) => {
  try {
    const items = await PortfolioItem.find({ isVisible: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch portfolio items" });
  }
};

export const createPortfolioItem = async (req, res) => {
  try {
    const item = await PortfolioItem.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: "Failed to create portfolio item" });
  }
};
