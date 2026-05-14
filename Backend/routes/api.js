import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  seedLegacyProducts,
} from "../controller/product.controller.js";
import {
  createOrder,
  getOrderById,
  getOrdersByUser,
  getAllOrders,
  updateOrderStatus,
} from "../controller/order.controller.js";
import { getCart, upsertCart, clearCart } from "../controller/cart.controller.js";
import {
  createCustomOrder,
  getCustomOrders,
  getCustomOrderById,
} from "../controller/customOrder.controller.js";
import {
  subscribeNewsletter,
  unsubscribeNewsletter,
} from "../controller/newsletter.controller.js";
import {
  getTestimonials,
  createTestimonial,
} from "../controller/testimonial.controller.js";
import {
  getPortfolioItems,
  createPortfolioItem,
} from "../controller/portfolio.controller.js";
import { getMetrics, createMetric } from "../controller/analytics.controller.js";
import {
  login as authLogin,
  register as authRegister,
  verifyOtp,
  forgotPassword,
  resetPassword,
} from "../controller/auth.controller.js";
import { getMe, updateMe, getUsers, updateUser, completeProfile } from "../controller/user.controller.js";
import { getInventory, updateStock, syncInventoryWithProducts } from "../controller/inventory.controller.js";
import { topsisRank, galeShapleyAssign } from "../controller/scholarship.controller.js";
import {
  getAllScholarshipsAdmin,
  createScholarship,
  updateScholarship,
  deleteScholarship,
  getAllScholarships,
  getScholarshipById,
} from "../controller/scholarship-crud.controller.js";
import {
  getAllApplications,
  approveApplication,
  rejectApplication,
  reviewApplication,
  submitApplication,
  getApplicationsByStudent,
} from "../controller/application.controller.js";
import { getAllUsers, getUserStats, getUserById, updateUserAdmin } from "../controller/admin.controller.js";
import { requireAdmin, optionalAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Product routes
router.get("/products", getProducts);
router.get("/products/:id", getProductById);
router.post("/products", createProduct);
router.post("/products/seed-legacy", seedLegacyProducts);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Order routes
router.post("/orders", createOrder);
router.get("/orders/:id", getOrderById);
router.get("/orders/user/:userId", getOrdersByUser);
router.get("/orders", getAllOrders);
router.patch("/orders/:id/status", updateOrderStatus);

// Cart routes
router.get("/cart", getCart);
router.post("/cart", upsertCart);
router.post("/cart/clear", clearCart);

// Custom order / design request routes
router.post("/custom-orders", createCustomOrder);
router.get("/custom-orders", getCustomOrders);
router.get("/custom-orders/:id", getCustomOrderById);

// Newsletter routes
router.post("/newsletter/subscribe", subscribeNewsletter);
router.post("/newsletter/unsubscribe", unsubscribeNewsletter);

// Testimonial routes
router.get("/testimonials", getTestimonials);
router.post("/testimonials", createTestimonial);

// Portfolio routes
router.get("/portfolio", getPortfolioItems);
router.post("/portfolio", createPortfolioItem);

// Analytics routes
router.get("/metrics", getMetrics);
router.post("/metrics", createMetric);

// Auth routes
router.post("/auth/login", authLogin);
router.post("/auth/register", authRegister);
router.post("/auth/verify-otp", verifyOtp);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword);

// User/profile routes
router.get("/users/me", getMe);
router.put("/users/me", updateMe);
router.post("/users/profile", completeProfile);
router.get("/users", getUsers); // admin
router.patch("/users/:id", updateUser); // admin

// Inventory routes
router.get("/inventory", getInventory);
router.post("/inventory/sync-products", syncInventoryWithProducts);
router.patch("/inventory/:id/stock", updateStock);

// Scholarship recommendation algorithms (no ML training; deterministic)
router.post("/scholarships/topsis/rank", topsisRank);
router.post("/scholarships/gale-shapley/assign", galeShapleyAssign);

// Public scholarship routes
router.get("/scholarships", getAllScholarships);
router.get("/scholarships/:id", getScholarshipById);

// Scholarship application routes
router.post("/applications", submitApplication);
router.get("/applications/student/:studentId", getApplicationsByStudent);

// Admin scholarship routes
router.get("/admin/scholarships", optionalAdmin, getAllScholarshipsAdmin);
router.post("/admin/scholarships", optionalAdmin, createScholarship);
router.put("/admin/scholarships/:id", optionalAdmin, updateScholarship);
router.delete("/admin/scholarships/:id", optionalAdmin, deleteScholarship);

// Admin application routes
router.get("/admin/applications", optionalAdmin, getAllApplications);
router.patch("/admin/applications/:id/approve", optionalAdmin, approveApplication);
router.patch("/admin/applications/:id/reject", optionalAdmin, rejectApplication);
router.patch("/admin/applications/:id/review", optionalAdmin, reviewApplication);

// Admin routes (all require admin authentication)
// Using optionalAdmin for now - if no auth provided, the controllers will handle permission checks
router.get("/admin/users", optionalAdmin, getAllUsers);
router.get("/admin/users/stats", optionalAdmin, getUserStats);
router.get("/admin/users/:id", optionalAdmin, getUserById);
router.patch("/admin/users/:id", optionalAdmin, updateUserAdmin);

export default router;
