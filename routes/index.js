import express from "express";
import { homePage } from "../controllers/homeController.js";
import { loginPage, registerPage, forgotPasswordPage, requestOtp, verifyOtp, resetPassword, loginUser, registerUser, logoutUser } from "../controllers/authController.js";
import { alertPanel, sendAlert, updateAlertStatus, assignAlert, addComment, alertHistory, alertDetail, exportAlerts, apiAlerts, apiMyAlerts, mapPage, profilePage, updateProfile, upload } from "../controllers/alertController.js";
import { adminDashboard, manageUsers, changeUserRole, deleteUser, manageAlerts, adminUpdateAlertStatus, deleteAlert, markFalseReport, unsuspendUser } from "../controllers/adminController.js";
import { userDashboard, userAlertPanel } from "../controllers/userController.js";
import { requireLogin, requireAdmin, requireUser } from "../middleware/auth.js";
import { agencyDashboard, agencyUpdateStatus, agencyApiAlerts } from "../controllers/agencyController.js";

// Redirect regular users away from the admin alert panel
const redirectUserFromAlerts = (req, res, next) => {
  if (req.session.userRole === "user") return res.redirect("/user/dashboard");
  next();
};

const router = express.Router();

router.get("/", homePage);

// PWA icons
router.get("/icons/icon-192.png", (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="38" fill="#dc2626"/><path d="M96 40 L152 140 H40 Z" fill="white"/><rect x="90" y="80" width="12" height="36" rx="6" fill="#dc2626"/><circle cx="96" cy="124" r="7" fill="#dc2626"/></svg>`);
});
router.get("/icons/icon-512.png", (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#dc2626"/><path d="M256 100 L420 380 H92 Z" fill="white"/><rect x="240" y="210" width="32" height="96" rx="16" fill="#dc2626"/><circle cx="256" cy="326" r="20" fill="#dc2626"/></svg>`);
});

// Auth
router.get("/login",           loginPage);
router.post("/login",          loginUser);
router.get("/register",        registerPage);
router.post("/register",       registerUser);
router.get("/forgot-password",         forgotPasswordPage);
router.post("/forgot-password",        requestOtp);
router.post("/forgot-password/verify", verifyOtp);
router.post("/forgot-password/reset",  resetPassword);
router.get("/logout",          logoutUser);

// Profile
router.get("/profile",         requireLogin, profilePage);
router.post("/profile/update", requireLogin, updateProfile);

// Admin
router.get("/admin/dashboard",          requireAdmin, adminDashboard);
router.get("/admin/users",              requireAdmin, manageUsers);
router.post("/admin/users/:id/role",    requireAdmin, changeUserRole);
router.post("/admin/users/:id/delete",  requireAdmin, deleteUser);
router.get("/admin/alerts",             requireAdmin, manageAlerts);
router.post("/admin/alerts/:id/status",       requireAdmin, adminUpdateAlertStatus);
router.post("/admin/alerts/:id/delete",       requireAdmin, deleteAlert);
router.post("/admin/alerts/:id/false-report", requireAdmin, markFalseReport);
router.post("/admin/users/:id/unsuspend",     requireAdmin, unsuspendUser);

// User
router.get("/user/dashboard", requireUser, userDashboard);
router.get("/user/alerts",    requireUser, userAlertPanel);

// Agency dashboards
router.get("/agency/:type",                requireLogin, agencyDashboard);
router.post("/agency/:type/alerts/:id/status", requireLogin, agencyUpdateStatus);
router.get("/api/agency/:type/alerts",     agencyApiAlerts);

// Shared alerts — admin/agency only
router.get("/alerts",                requireLogin, redirectUserFromAlerts, alertPanel);
router.post("/alerts/send",          requireLogin, upload.single("photo"), sendAlert);
router.get("/alerts/export",         requireLogin, exportAlerts);
router.get("/alerts/history",        requireLogin, alertHistory);
router.get("/alerts/:id",            requireLogin, alertDetail);
router.post("/alerts/:id/status",    requireLogin, updateAlertStatus);
router.post("/alerts/:id/assign",    requireLogin, assignAlert);
router.post("/alerts/:id/comment",   requireLogin, addComment);
router.get("/map",                   requireLogin, mapPage);
router.get("/api/alerts",            apiAlerts);
router.get("/api/my-alerts",         requireLogin, apiMyAlerts);

export default router;
