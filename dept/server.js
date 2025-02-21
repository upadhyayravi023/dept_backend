require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  verificationCode: { type: String, default: null },
});

const User = mongoose.model("User", userSchema);

// Ensure only one user exists
async function initializeUser() {
  let user = await User.findOne({});
  if (!user) {
    const hashedPassword = await bcrypt.hash("123", 10);
    user = new User({ email: process.env.COLLEGE_EMAIL, password: hashedPassword });
    await user.save();
    console.log("Default User Created");
  }
}
initializeUser();

// 📌 LOGIN ROUTE
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({});
  
  if (!user || email !== process.env.COLLEGE_EMAIL) {
    return res.status(400).json({ message: "Invalid Email or Password" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid Email or Password" });
  }

  const token = jwt.sign({ email: user.email }, "secret_key", { expiresIn: "1h" });
  res.json({ message: "Login Successful", token });
});

// 📌 FORGOT PASSWORD ROUTE
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({});

  if (!user || email !== process.env.COLLEGE_EMAIL) {
    return res.status(400).json({ message: "Invalid Email" });
  }

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  user.verificationCode = verificationCode;
  await user.save();
  console.log("Saved Verification Code:", verificationCode);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset Verification Code",
    text: `Your verification code is: ${verificationCode}`,
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) return res.status(500).json({ message: "Email sending failed" });
    res.json({ message: "Verification code sent to email" });
  });
});

// 📌 RESET PASSWORD ROUTE
app.post("/reset-password", async (req, res) => {
  const { code, newPassword } = req.body;

  // Check if newPassword is provided
  if (!newPassword || typeof newPassword !== "string") {
    return res.status(400).json({ message: "New password is required" });
  }

  // Find the single user in the database
  const user = await User.findOne({});

  // Validate verification code
  if (!user || String(user.verificationCode) !== String(code)) {
    return res.status(400).json({ message: "Invalid verification code" });
  }

  try {
    // Hash and update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.verificationCode = null; // Remove the code after successful reset
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: "Error resetting password", error: error.message });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
