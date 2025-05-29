import mongoose from "mongoose";

const ClinicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },  // stored as plain text here
  domain: { type: String, required: true, unique: true },
  plan: { type: String, default: "free" },
  isActive: { type: Boolean, default: true },
});

export default mongoose.model("Clinic", ClinicSchema);
