import mongoose from "mongoose";
import Scholarship from "./models/scholarship.model.js";
import dotenv from "dotenv";

dotenv.config();

const testDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    
    const scholarships = await Scholarship.find();
    console.log(`Found ${scholarships.length} scholarships:`);
    console.log(JSON.stringify(scholarships, null, 2));
    
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
  }
};

testDB();
