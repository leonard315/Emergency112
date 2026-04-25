/*
    Emergency112 - Admin Controller
    Full system management for administrators
*/

import { User } from "../models/userModel.js";
import { Alert } from "../models/alertModel.js";
import { Op } from "sequelize";
import bcrypt from "bcrypt";

const ALERT_CONFIG = {
  fire:    { label: "Fire Emergency",    color: "orange", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/></svg>', agency: "Bureau of Fire Protection" },
  crime:   { label: "Crime Emergency",   color: "blue",   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>', agency: "Philippine National Police" },
  medical: { label: "Medical Emergency", color: "red",    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>', agency: "Emergency Medical Services" },
  all:     { label: "All Agencies Alert", color: "white", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>', agency: "BFP + PNP + EMS" }
};

// GET /admin/dashboard
export const adminDashboard = async (req, res) => {
  const [totalUsers, totalAlerts, activeAlerts, resolvedAlerts, respondingAlerts,
         fireCount, crimeCount, medicalCount, allCount, recentAlerts, allUsers] = await Promise.all([
    User.count(),
    Alert.count(),
    Alert.count({ where: { status: "active" } }),
    Alert.count({ where: { status: "resolved" } }),
    Alert.count({ where: { status: "responding" } }),
    Alert.count({ where: { type: "fire" } }),
    Alert.count({ where: { type: "crime" } }),
    Alert.count({ where: { type: "medical" } }),
    Alert.count({ where: { type: "all" } }),
    Alert.findAll({ order: [["createdAt", "DESC"]], limit: 8 }),
    User.findAll({ order: [["createdAt", "DESC"]] })
  ]);

  // Response time analytics
  const respondedAlerts = await Alert.findAll({
    where: { respondedAt: { [Op.ne]: null }, createdAt: { [Op.ne]: null } }
  });
  const avgResponseTime = respondedAlerts.length > 0
    ? Math.round(respondedAlerts.reduce((sum, a) =>
        sum + (new Date(a.respondedAt) - new Date(a.createdAt)) / 60000, 0
      ) / respondedAlerts.length)
    : null;

  // Alerts last 7 days for chart
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentWeek = await Alert.findAll({
    where: { createdAt: { [Op.gte]: sevenDaysAgo } },
    order: [["createdAt", "ASC"]]
  });
  const dailyCounts = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dailyCounts[d.toLocaleDateString("en-US",{month:"short",day:"numeric"})] = 0;
  }
  recentWeek.forEach(a => {
    const key = new Date(a.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric"});
    if (dailyCounts[key] !== undefined) dailyCounts[key]++;
  });

  // Suspicious activity detection
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const suspiciousCount = await Alert.count({
    where: { notes: { [Op.like]: "%SUSPICIOUS%" }, createdAt: { [Op.gte]: tenMinAgo } }
  });

  res.render("admin/dashboard", {
    title: "Admin Dashboard",
    adminName: req.session.userName,
    stats: {
      totalUsers, totalAlerts, activeAlerts, resolvedAlerts,
      respondingAlerts, fireCount, crimeCount, medicalCount, allCount,
      avgResponseTime, suspiciousCount
    },
    chartLabels: JSON.stringify(Object.keys(dailyCounts)),
    chartData: JSON.stringify(Object.values(dailyCounts)),
    recentAlerts: recentAlerts.map(a => ({
      ...a.toJSON(),
      config: ALERT_CONFIG[a.type],
      timeAgo: timeAgo(a.createdAt)
    })),
    users: allUsers.map(u => u.toJSON())
  });
};

// GET /admin/users
export const manageUsers = async (req, res) => {
  const users = await User.findAll({ order: [["createdAt", "DESC"]] });
  res.render("admin/users", {
    title: "Manage Users",
    adminName: req.session.userName,
    currentUserId: req.session.userId,
    users: users.map(u => u.toJSON())
  });
};

// POST /admin/users/:id/role - change user role
export const changeUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!["admin", "user"].includes(role)) {
    req.flash("error_msg", "Invalid role.");
    return res.redirect("/admin/users");
  }
  // Prevent self-demotion
  if (parseInt(id) === req.session.userId) {
    req.flash("error_msg", "You cannot change your own role.");
    return res.redirect("/admin/users");
  }
  await User.update({ role }, { where: { id } });
  req.flash("success_msg", "User role updated successfully.");
  res.redirect("/admin/users");
};

// POST /admin/users/:id/delete
export const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.session.userId) {
    req.flash("error_msg", "You cannot delete your own account.");
    return res.redirect("/admin/users");
  }
  await User.destroy({ where: { id } });
  req.flash("success_msg", "User deleted successfully.");
  res.redirect("/admin/users");
};

// GET /admin/alerts
export const manageAlerts = async (req, res) => {
  const { type, status } = req.query;
  const where = {};
  if (type   && ALERT_CONFIG[type]) where.type = type;
  if (status && ["active","responding","resolved"].includes(status)) where.status = status;

  const alerts = await Alert.findAll({ where, order: [["createdAt", "DESC"]] });

  // Alerts with photo evidence
  const photoAlerts = await Alert.findAll({
    where: { photoPath: { [Op.ne]: null } },
    order: [["createdAt", "DESC"]]
  });

  res.render("admin/alerts", {
    title: "Manage Alerts",
    adminName: req.session.userName,
    alerts: alerts.map(a => ({ ...a.toJSON(), config: ALERT_CONFIG[a.type], timeAgo: timeAgo(a.createdAt) })),
    photoAlerts: photoAlerts.map(a => ({ ...a.toJSON(), config: ALERT_CONFIG[a.type], timeAgo: timeAgo(a.createdAt) })),
    filterType: type || "",
    filterStatus: status || "",
    config: ALERT_CONFIG
  });
};

// POST /admin/alerts/:id/status
export const adminUpdateAlertStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const alert = await Alert.findByPk(id);
  if (!alert) { req.flash("error_msg", "Alert not found."); return res.redirect("/admin/alerts"); }
  const updates = { status };
  if (status === "responding") updates.respondedAt = new Date();
  if (status === "resolved")   updates.resolvedAt  = new Date();
  await alert.update(updates);
  req.flash("success_msg", `Alert marked as "${status}".`);
  res.redirect("/admin/alerts");
};

// POST /admin/alerts/:id/delete
export const deleteAlert = async (req, res) => {
  await Alert.destroy({ where: { id: req.params.id } });
  req.flash("success_msg", "Alert deleted.");
  res.redirect("/admin/alerts");
};

// POST /admin/alerts/:id/false-report
export const markFalseReport = async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  const alert = await Alert.findByPk(id);
  if (!alert) { req.flash("error_msg", "Alert not found."); return res.redirect("/admin/alerts"); }

  await alert.update({
    isFalseReport: true,
    status: "resolved",
    falseReportNote: note || "Marked as false/scam report"
  });

  // Increment false report count on the reporter
  if (alert.reportedBy) {
    const reporter = await User.findOne({ where: { name: alert.reportedBy } });
    if (reporter) {
      const newCount = (reporter.falseReportCount || 0) + 1;
      const suspend = newCount >= 3;
      await reporter.update({ falseReportCount: newCount, isSuspended: suspend });
      if (suspend) {
        req.flash("success_msg", `⚠️ Alert marked as false report. "${reporter.name}" has been SUSPENDED after 3 false reports.`);
      } else {
        req.flash("success_msg", `⚠️ Alert marked as false report. "${reporter.name}" now has ${newCount}/3 warning(s).`);
      }
    } else {
      req.flash("success_msg", "Alert marked as false/scam report.");
    }
  } else {
    req.flash("success_msg", "Alert marked as false/scam report.");
  }
  res.redirect("/admin/alerts");
};

// POST /admin/users/:id/unsuspend
export const unsuspendUser = async (req, res) => {
  await User.update(
    { isSuspended: false, falseReportCount: 0 },
    { where: { id: req.params.id } }
  );
  req.flash("success_msg", "User unsuspended and false report count reset to 0.");
  res.redirect("/admin/users");
};

function timeAgo(date) {
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
