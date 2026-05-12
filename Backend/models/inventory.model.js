import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    currentStock: { type: Number, required: true, default: 0, min: 0 },
    minStock: { type: Number, required: true, default: 0, min: 0 },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const InventoryItem = mongoose.model("InventoryItem", inventorySchema);
export default InventoryItem;
