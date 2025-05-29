import express from "express";
import Clinic from "../../models/Clinic.js";

const router = express.Router();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")       // Replace spaces with -
    .replace(/[^\w\-]+/g, "")   // Remove all non-word chars
    .replace(/\-\-+/g, "-");    // Replace multiple - with single -
}

// Signup route (no hashed password)
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "Name, email, and password required" });

    const existing = await Clinic.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const domain = `${slugify(name)}.token.leada360.com`;

    const domainExists = await Clinic.findOne({ domain });
    if (domainExists)
      return res.status(400).json({ message: "Clinic domain already exists, try a different name" });

    // Save password as plain text (not recommended for production)
    const newClinic = new Clinic({
      name,
      email,
      password, // plain password here
      domain,
      plan: "free",
      isActive: true,
    });

    await newClinic.save();

    res.status(201).json({
      message: "Clinic created successfully",
      clinic: {
        name: newClinic.name,
        email: newClinic.email,
        domain: newClinic.domain,
        plan: newClinic.plan,
        isActive: newClinic.isActive,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Login route (check plain password)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const clinic = await Clinic.findOne({ email });

    // Check if clinic exists and password matches
    if (!clinic || clinic.password !== password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      name: clinic.name,
      email: clinic.email,
      domain: clinic.domain,
      plan: clinic.plan,
      isActive: clinic.isActive,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
