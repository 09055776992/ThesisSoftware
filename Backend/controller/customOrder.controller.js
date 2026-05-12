import CustomOrder from "../models/customOrder.model.js";

export const createCustomOrder = async (req, res) => {
  try {
    const order = await CustomOrder.create(req.body);
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: "Failed to create custom order" });
  }
};

export const getCustomOrders = async (req, res) => {
  try {
    const orders = await CustomOrder.find().sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch custom orders" });
  }
};

export const getCustomOrderById = async (req, res) => {
  try {
    const order = await CustomOrder.findById(req.params.id).lean();
    if (!order) {
      return res.status(404).json({ message: "Custom order not found" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch custom order" });
  }
};
