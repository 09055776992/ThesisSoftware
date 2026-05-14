import mongoose from "mongoose";
import Scholarship from "../models/scholarship.model.js";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb+srv://ilcarpio3956qc_db_user:warlordid619%25@thesissoftware.qqlqauz.mongodb.net/?appName=ThesisSoftware";

const scholarships = [
  {
    name: "QCYDO Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 10000,
    deadline: new Date("2027-06-30"),
    status: "Active",
    type: "Merit-Based",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "The QCYDO Scholarship Program aims to support talented and deserving youth of Quezon City in pursuing their higher education goals.",
    eligibilityCriteria: {
      minGPA: 2.5,
      incomeRange: "Below ₱300,000 annual household income",
      yearLevel: "College level",
    },
    applicationsCount: 0,
  },
  {
    name: "QC Academic Excellence Grant",
    provider: "Quezon City Government",
    organization: "QC Government",
    amount: 15000,
    deadline: new Date("2027-07-15"),
    status: "Active",
    type: "Merit-Based",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "A grant program for academically excellent students residing in Quezon City to support their educational expenses.",
    eligibilityCriteria: {
      minGPA: 1.75,
      incomeRange: "Below ₱500,000 annual household income",
      yearLevel: "College level",
    },
    applicationsCount: 0,
  },
  {
    name: "QC Barangay Scholarship",
    provider: "Quezon City Barangay Office",
    organization: "Barangay Office",
    amount: 5000,
    deadline: new Date("2027-08-31"),
    status: "Active",
    type: "Need-Based",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship program funded by local barangays in Quezon City to support residents in their educational pursuits.",
    eligibilityCriteria: {
      minGPA: 2.0,
      incomeRange: "Below ₱200,000 annual household income",
      yearLevel: "College level",
    },
    applicationsCount: 0,
  },
  {
    name: "QC PWD Scholarship",
    provider: "Quezon City Persons with Disability Affairs Office",
    organization: "PDAO",
    amount: 12000,
    deadline: new Date("2027-09-30"),
    status: "Active",
    type: "Need-Based",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship program for persons with disabilities residing in Quezon City to support their access to higher education.",
    eligibilityCriteria: {
      minGPA: 2.0,
      incomeRange: "Below ₱300,000 annual household income",
      yearLevel: "College level",
    },
    applicationsCount: 0,
  },
  {
    name: "QC Solo Parent Scholarship",
    provider: "Quezon City Social Services Development Department",
    organization: "SSDD",
    amount: 8000,
    deadline: new Date("2027-10-31"),
    status: "Active",
    type: "Need-Based",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Financial assistance program for solo parents residing in Quezon City who wish to pursue higher education.",
    eligibilityCriteria: {
      minGPA: 2.0,
      incomeRange: "Below ₱250,000 annual household income",
      yearLevel: "College level",
    },
    applicationsCount: 0,
  },
  {
    name: "QC Indigenous Peoples Grant",
    provider: "Quezon City Indigenous Peoples Office",
    organization: "IP Office",
    amount: 10000,
    deadline: new Date("2027-11-30"),
    status: "Active",
    type: "Need-Based",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Grant program for indigenous peoples residing in Quezon City to support their educational advancement.",
    eligibilityCriteria: {
      minGPA: 2.0,
      incomeRange: "Below ₱300,000 annual household income",
      yearLevel: "College level",
    },
    applicationsCount: 0,
  },
];

async function seedScholarships() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    let upserts = 0;
    for (const scholarship of scholarships) {
      const result = await Scholarship.updateOne(
        { name: scholarship.name },
        { $set: scholarship },
        { upsert: true }
      );
      if (result.upsertedCount || result.modifiedCount) upserts += 1;
    }

    console.log(`Seeded or updated ${upserts} scholarships`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding scholarships:", error);
    process.exit(1);
  }
}

seedScholarships();
