import Cart from "../models/cart.model.js";

export const getCart = async (req, res) => {
  try {
    const { userId, sessionId } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (sessionId) query.sessionId = sessionId;

    const cart = await Cart.findOne(query).lean();
    res.json(cart || { items: [], status: "active" });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch cart" });
  }
};

export const upsertCart = async (req, res) => {
  try {
    const { userId, sessionId, items, status } = req.body;

    const query = {};
    if (userId) query.userId = userId;
    if (sessionId) query.sessionId = sessionId;

    const update = { items, status };

    const cart = await Cart.findOneAndUpdate(query, update, {
      new: true,
      upsert: true,
    });

    res.json(cart);
  } catch (err) {
    res.status(400).json({ message: "Failed to update cart" });
  }
};

export const clearCart = async (req, res) => {
  try {
    const { userId, sessionId } = req.body;
    const query = {};
    if (userId) query.userId = userId;
    if (sessionId) query.sessionId = sessionId;

    await Cart.findOneAndUpdate(query, { items: [], status: "active" });
    res.json({ message: "Cart cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear cart" });
  }
};
