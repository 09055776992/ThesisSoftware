import Product from "../models/product.model.js";
import InventoryItem from "../models/inventory.model.js";

const legacySeedProducts = [
  {
    name: "Custom Crochet Plushie",
    category: "crochet",
    price: "200",
    baseCost: "0",
    description:
      "Handmade crochet plushies in various designs and colors - Perfect for gifts and home decor",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Crochet Flower",
    category: "bouquets",
    price: "150",
    baseCost: "0",
    description:
      "Beautiful handmade crochet flowers that last forever - perfect for gifts and decorations",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Fuzzy Wire Flower Bouquet",
    category: "bouquets",
    price: "120",
    baseCost: "0",
    description: "Colorful fuzzy wire flowers in vibrant arrangements",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Money Bouquet",
    category: "bouquets",
    price: "400",
    baseCost: "0",
    description:
      "Creative cash arrangement perfect for special occasions - Choose your bill count",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Custom Aesthetic Planner",
    category: "planners",
    price: "250",
    baseCost: "0",
    description:
      "A5 size hardbound or soft cover with high-quality paper - Custom cover design or logo available",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Custom Printed Lanyard",
    category: "lanyards",
    price: "25",
    baseCost: "0",
    description:
      "Durable polyester or satin finish - Custom text or logo print along the strap",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Premium Business Cards",
    category: "business-cards",
    price: "3",
    baseCost: "0",
    description:
      "Premium matte or glossy card stock with logo, company name, and contact details customization",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Custom T-Shirt",
    category: "shirts",
    price: "250",
    baseCost: "0",
    description:
      "High-quality custom printed t-shirts with various brand options - Full color print with your design",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Custom Stickers",
    category: "stickers",
    price: "25",
    baseCost: "0",
    description:
      "Custom photo stickers per A4 sheet - Glossy vinyl or matte paper options with custom shapes or name labels",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Promotional Flyers",
    category: "flyers",
    price: "15",
    baseCost: "0",
    description:
      "High-quality paper with optional gloss finish - Custom design or business layout option available",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Tarpaulin Banner",
    category: "tarpaulins",
    price: "280",
    baseCost: "0",
    description:
      "Waterproof tarpaulin with FREE layout included - Company logo or event print available",
    variant: "default",
    isActive: "true",
  },
  {
    name: "Custom Mug",
    category: "mugs",
    price: "100",
    baseCost: "0",
    description:
      "High-quality ceramic mug with customizable print area - Add your photo, logo, or text",
    variant: "default",
    isActive: "true",
  },
];

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch products" });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch product" });
  }
};

export const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);

    let inventoryItem = null;
    try {
      inventoryItem = await InventoryItem.create({
        name: product.name,
        category: product.category,
        unit: "pieces",
        currentStock: 0,
        minStock: 10,
        product: product._id,
        isActive: true,
      });
    } catch (err) {
      // If inventory creation fails, still return product (best-effort)
      inventoryItem = null;
    }

    res.status(201).json({ product, inventoryItem });
  } catch (err) {
    res.status(400).json({ message: "Failed to create product" });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Failed to update product" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Best-effort: deactivate related inventory item
    try {
      await InventoryItem.updateMany(
        { $or: [{ product: product._id }, { name: product.name }] },
        { $set: { isActive: false } }
      );
    } catch (err) {
      // ignore inventory cleanup errors
    }
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete product" });
  }
};

// POST /api/products/seed-legacy
// Idempotent: creates legacy products if missing (by unique name) and ensures inventory exists
export const seedLegacyProducts = async (req, res) => {
  try {
    let createdProducts = 0;
    let createdInventory = 0;

    for (const p of legacySeedProducts) {
      const product = await Product.findOneAndUpdate(
        { name: p.name },
        { $setOnInsert: p },
        { new: true, upsert: true }
      ).lean();

      // If it was inserted, mongoose doesn't expose that via lean; approximate by re-checking
      const existingInventory = await InventoryItem.findOne({
        $or: [{ product: product._id }, { name: product.name }],
        isActive: true,
      }).lean();

      if (!existingInventory) {
        await InventoryItem.create({
          name: product.name,
          category: product.category,
          unit: "pieces",
          currentStock: 0,
          minStock: 10,
          product: product._id,
          isActive: true,
        });
        createdInventory += 1;
      }
    }

    // count legacy products present
    const totalLegacy = await Product.countDocuments({
      name: { $in: legacySeedProducts.map((p) => p.name) },
    });

    res.json({ ok: true, totalLegacy, createdProducts, createdInventory });
  } catch (err) {
    res.status(500).json({ message: "Failed to seed legacy products" });
  }
};
