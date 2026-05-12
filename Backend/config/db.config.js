import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

const ADMIN_SEED_USERS = [
  {
    userName: "bagaberde619",
    email: "ilcarpio3956qc@student.fatima.edu.ph",
    password: "warlordid619",
    phone: "09000000000",
    address: "Admin Account",
  },
];

const ensureAdminAccounts = async () => {
  for (const admin of ADMIN_SEED_USERS) {
    const passwordHash = await bcrypt.hash(admin.password, 10);

    await User.findOneAndUpdate(
      {
        $or: [{ email: admin.email }, { userName: admin.userName }],
      },
      {
        $set: {
          userName: admin.userName,
          email: admin.email,
          phone: admin.phone,
          address: admin.address,
          role: "admin",
          passwordHash,
        },
      },
      { upsert: true, new: true }
    );
  }
};

export const connectDB = async() => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        await ensureAdminAccounts();
        console.log(`MongoDB connected: ${conn.connection.host}`);
        console.log(`Database name: ${conn.connection.name}`);
    } catch (error) {
        console.log(`Error: ${error.message}`);
        process.exit(1); //1 means Exit with failure 0 means Exit with success
    }
}