import InventoryItem from "../models/inventory.model.js";
import Product from "../models/product.model.js";

// GET /api/inventory
export const getInventory = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch inventory" });
  }
};

// PATCH /api/inventory/:id/stock
// Body: { delta: number }
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;
    if (typeof delta !== "number" || !Number.isFinite(delta)) {
      return res.status(400).json({ message: "Invalid delta" });
    }

    const item = await InventoryItem.findById(id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const next = Math.max(0, (item.currentStock || 0) + delta);
    item.currentStock = next;
    await item.save();

    res.json(item);
  } catch (err) {
    res.status(400).json({ message: "Failed to update stock" });
  }
};

// POST /api/inventory/sync-products
// Creates missing inventory records for existing products (best-effort)
export const syncInventoryWithProducts = async (req, res) => {
  try {
    const products = await Product.find().lean();
    const inventory = await InventoryItem.find({ isActive: true }).lean();

    const existingByProductId = new Set(
      inventory
        .filter((it) => it.product)
        .map((it) => String(it.product))
    );
    const existingByName = new Set(inventory.map((it) => String(it.name)));

    let createdCount = 0;
    for (const p of products) {
      const pid = String(p._id);
      const pname = String(p.name);
      const exists = existingByProductId.has(pid) || existingByName.has(pname);
      if (exists) continue;

      await InventoryItem.create({
        name: p.name,
        category: p.category,
        unit: "pieces",
        currentStock: 0,
        minStock: 10,
        product: p._id,
        isActive: true,
      });
      createdCount += 1;
    }

    const items = await InventoryItem.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ createdCount, items });
  } catch (err) {
    res.status(500).json({ message: "Failed to sync inventory" });
  }
};
