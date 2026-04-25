
      /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import bcrypt from "bcrypt";
import { User, sequelize } from "../models/userModel.js";
await sequelize.sync();

export const loginPage = (req, res) => res.render("login", { title: "Sign In" });
export const registerPage = (req, res) => res.render("register", { title: "Create Account" });
export const forgotPasswordPage = (req, res) => res.render("forgotpassword", { title: "Forgot Password", step: "email" });

// POST /forgot-password — Step 1: verify email, generate OTP
export const requestOtp = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      req.flash("error_msg", "Email is required.");
      return res.redirect("/forgot-password");
    }
    const user = await User.findOne({ where: { email } });
    if (!user) {
      req.flash("error_msg", "No account found with that email address.");
      return res.redirect("/forgot-password");
    }
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
    // Store in session
    req.session.resetOtp = { otp, email, expires };
    // Render OTP step — show OTP on screen (no email service)
    res.render("forgotpassword", {
      title: "Verify OTP",
      step: "otp",
      email,
      otp, // shown on screen since no email service
    });
  } catch (err) {
    req.flash("error_msg", "Something went wrong. Please try again.");
    res.redirect("/forgot-password");
  }
};

// POST /forgot-password/verify — Step 2: verify OTP
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const session = req.session.resetOtp;
    if (!session || session.email !== email) {
      req.flash("error_msg", "Session expired. Please start again.");
      return res.redirect("/forgot-password");
    }
    if (Date.now() > session.expires) {
      req.session.resetOtp = null;
      req.flash("error_msg", "OTP expired. Please request a new one.");
      return res.redirect("/forgot-password");
    }
    if (otp.trim() !== session.otp) {
      return res.render("forgotpassword", {
        title: "Verify OTP",
        step: "otp",
        email,
        otp: session.otp,
        error_msg: "Incorrect OTP. Please try again."
      });
    }
    // OTP correct — show password reset step
    req.session.resetOtp.verified = true;
    res.render("forgotpassword", {
      title: "Reset Password",
      step: "reset",
      email
    });
  } catch (err) {
    req.flash("error_msg", "Something went wrong.");
    res.redirect("/forgot-password");
  }
};

export const resetPassword = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;
  try {
    const session = req.session.resetOtp;
    if (!session || session.email !== email || !session.verified) {
      req.flash("error_msg", "Session expired. Please start again.");
      return res.redirect("/forgot-password");
    }
    if (!newPassword || !confirmPassword) {
      req.flash("error_msg", "All fields are required.");
      return res.redirect("/forgot-password");
    }
    if (newPassword.length < 6) {
      req.flash("error_msg", "Password must be at least 6 characters.");
      return res.redirect("/forgot-password");
    }
    if (newPassword !== confirmPassword) {
      req.flash("error_msg", "Passwords do not match.");
      return res.redirect("/forgot-password");
    }
    const user = await User.findOne({ where: { email } });
    if (!user) {
      req.flash("error_msg", "Account not found.");
      return res.redirect("/forgot-password");
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashed });
    req.session.resetOtp = null;
    req.flash("success_msg", "Password reset successfully! You can now sign in.");
    res.redirect("/login");
  } catch (err) {
    req.flash("error_msg", "Something went wrong. Please try again.");
    res.redirect("/forgot-password");
  }
};
export const dashboardPage = (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.render("dashboard", { title: "Dashboard" });
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      req.flash("error_msg", "No account found with that email address.");
      return res.redirect("/login");
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash("error_msg", "Incorrect password. Please try again.");
      return res.redirect("/login");
    }
    // Block suspended users
    if (user.isSuspended) {
      req.flash("error_msg", "⚠️ Your account has been suspended due to false emergency reports. Contact the administrator.");
      return res.redirect("/login");
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userName = user.name;
    // Check for ?next= parameter (from home page emergency button)
    const next = req.body.next || req.query.next;
    // Redirect based on role
    if (user.role === "admin")   return res.redirect("/admin/dashboard");
    if (user.role === "bfp")     return res.redirect("/agency/bfp");
    if (user.role === "pnp")     return res.redirect("/agency/pnp");
    if (user.role === "ems")     return res.redirect("/agency/ems");
    // For regular users
    if (next && ["fire","crime","medical","all"].includes(next)) {
      return res.redirect(`/user/dashboard?alert=${next}`);
    }
    res.redirect("/user/dashboard");
  } catch (err) {
    req.flash("error_msg", "Something went wrong. Please try again.");
    res.redirect("/login");
  }
};

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (!name || !email || !password) {
      req.flash("error_msg", "All fields are required.");
      return res.redirect("/register");
    }
    if (password.length < 6) {
      req.flash("error_msg", "Password must be at least 6 characters.");
      return res.redirect("/register");
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      req.flash("error_msg", "An account with that email already exists.");
      return res.redirect("/register");
    }
    const hashed = await bcrypt.hash(password, 10);
    // First registered user becomes admin
    const count = await User.count();
    const role = count === 0 ? "admin" : "user";
    await User.create({ name, email, password: hashed, role });
    // Always redirect to login after registration
    req.flash("success_msg", `Account created! Please sign in, ${name}.`);
    res.redirect("/login");
  } catch (err) {
    req.flash("error_msg", "Something went wrong. Please try again.");
    res.redirect("/register");
  }
};

export const logoutUser = (req, res) => {
  req.session.destroy();
  res.redirect("/login");
};
