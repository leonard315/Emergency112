import { Alert, sequelize } from "../models/alertModel.js";
import { AlertComment } from "../models/commentModel.js";
import { User } from "../models/userModel.js";
import { Op } from "sequelize";
import multer from "multer";
import path from "path";
import fs from "fs";
await sequelize.sync();

export const ALERT_CONFIG = {
  fire:    { label: "Fire Emergency",    color: "orange", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/></svg>', agency: "Bureau of Fire Protection" },
  crime:   { label: "Crime Emergency",   color: "blue",   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>', agency: "Philippine National Police" },
  medical: { label: "Medical Emergency", color: "red",    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>', agency: "Emergency Medical Services" },
  all:     { label: "All Agencies Alert",color: "white",  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>', agency: "BFP + PNP + EMS" }
};

export const SEVERITY_CONFIG = {
  low:      { label: "Low",      color: "#4ade80", bg: "rgba(34,197,94,.15)"  },
  medium:   { label: "Medium",   color: "#fbbf24", bg: "rgba(234,179,8,.15)"  },
  high:     { label: "High",     color: "#f97316", bg: "rgba(249,115,22,.15)" },
  critical: { label: "Critical", color: "#f87171", bg: "rgba(239,68,68,.15)"  }
};

// Multer setup for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
export const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /alerts
export const alertPanel = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const user = await User.findByPk(req.session.userId);
  const recentAlerts = await Alert.findAll({ order: [["createdAt","DESC"]], limit: 20 });
  const stats = {
    total:      await Alert.count(),
    active:     await Alert.count({ where: { status: "active" } }),
    responding: await Alert.count({ where: { status: "responding" } }),
    resolved:   await Alert.count({ where: { status: "resolved" } })
  };
  const dashboardLink = user?.role === "admin" ? "/admin/dashboard" : user?.role === "bfp" ? "/agency/bfp" : user?.role === "pnp" ? "/agency/pnp" : user?.role === "ems" ? "/agency/ems" : "/user/dashboard";
  res.render("alerts", {
    title: "Emergency Alert Panel",
    user: user?.name || "User",
    isAdmin: user?.role === "admin",
    dashboardLink,
    alerts: recentAlerts.map(a => formatAlert(a)),
    stats
  });
};

// POST /alerts/send
export const sendAlert = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const { type, location, latitude, longitude, notes, severity } = req.body;
  const role = req.session.userRole;
  const errUrl = role === "user" ? "/user/dashboard" : "/alerts";

  if (!ALERT_CONFIG[type]) {
    req.flash("error_msg", "Invalid alert type.");
    return res.redirect(errUrl);
  }
  const user = await User.findByPk(req.session.userId);

  // 1. Block suspended users
  if (user?.isSuspended) {
    req.flash("error_msg", "Your account is suspended due to false reports. Contact the administrator.");
    return res.redirect(errUrl);
  }

  // 2. Cooldown: 5 minutes between alerts
  const COOLDOWN_MS = 5 * 60 * 1000;
  if (user?.lastAlertAt) {
    const elapsed = Date.now() - new Date(user.lastAlertAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      req.flash("error_msg", `Please wait ${mins}m ${secs}s before sending another alert.`);
      return res.redirect(errUrl);
    }
  }

  // 3. Require photo for Critical severity
  if (severity === "critical" && !req.file) {
    req.flash("error_msg", "Photo evidence is required for Critical severity alerts.");
    return res.redirect(errUrl);
  }

  // 4. Rate limit: flag suspicious if 3+ alerts in 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentCount = await Alert.count({
    where: { reportedBy: user?.name, createdAt: { [Op.gte]: tenMinAgo } }
  });
  const isSuspicious = recentCount >= 2;

  const config = ALERT_CONFIG[type];
  const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
  await Alert.create({
    type, label: config.label,
    severity: severity || "medium",
    location: location || "Location not specified",
    latitude:  latitude  ? parseFloat(latitude)  : null,
    longitude: longitude ? parseFloat(longitude) : null,
    status: "active",
    reportedBy: user?.name || "Anonymous",
    notes: isSuspicious ? `${notes || ""} [⚠️ SUSPICIOUS: ${recentCount + 1} alerts in 10 min]`.trim() : (notes || null),
    photoPath
  });

  // Update lastAlertAt for cooldown
  if (user) await user.update({ lastAlertAt: new Date() });

  const backUrl = role === "user" ? "/user/dashboard" : "/alerts";

  if (isSuspicious) {
    req.flash("success_msg", `Alert sent. Note: Multiple alerts detected — admin has been notified.`);
  } else {
    req.flash("success_msg", `${config.label} alert sent to ${config.agency}!`);
  }
  res.redirect(backUrl);
};

// POST /alerts/:id/status
export const updateAlertStatus = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const { id } = req.params;
  const { status } = req.body;
  const alert = await Alert.findByPk(id);
  if (!alert) { req.flash("error_msg","Alert not found."); return res.redirect("/alerts"); }
  const updates = { status };
  if (status === "responding") updates.respondedAt = new Date();
  if (status === "resolved")   updates.resolvedAt  = new Date();
  await alert.update(updates);
  req.flash("success_msg", `Alert status updated to "${status}".`);
  res.redirect("/alerts");
};

// POST /alerts/:id/assign
export const assignAlert = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const { assignedTo } = req.body;
  const alert = await Alert.findByPk(req.params.id);
  if (alert) await alert.update({ assignedTo });
  req.flash("success_msg", `Alert assigned to ${assignedTo}.`);
  res.redirect("/alerts");
};

// POST /alerts/:id/comment
export const addComment = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const { message } = req.body;
  if (message?.trim()) {
    await AlertComment.create({
      alertId: req.params.id,
      author: req.session.userName || "User",
      message: message.trim()
    });
  }
  res.redirect("/alerts");
};

// GET /alerts/history
export const alertHistory = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const { type, status, severity, search } = req.query;
  const role = req.session.userRole;
  const user = await User.findByPk(req.session.userId);

  // Agency type mappings — each agency only sees their relevant alerts
  const AGENCY_TYPES = {
    bfp: ["fire", "all"],
    pnp: ["crime", "all"],
    ems: ["medical", "all"]
  };

  const where = {};

  // Regular users only see their own reports
  if (role === "user") {
    where.reportedBy = user.name;
  }

  // Agency roles only see their assigned alert types
  if (AGENCY_TYPES[role]) {
    const agencyTypes = AGENCY_TYPES[role];
    const { Op } = await import("sequelize");
    if (type && agencyTypes.includes(type)) {
      where.type = type;
    } else if (!type) {
      where.type = { [Op.in]: agencyTypes };
    } else {
      // Type filter outside agency scope — return no results
      where.type = "none";
    }
  } else if (type && ALERT_CONFIG[type]) {
    where.type = type;
  }

  if (status   && ["active","responding","resolved"].includes(status)) where.status = status;
  if (severity && SEVERITY_CONFIG[severity]) where.severity = severity;
  if (search) {
    const { Op: OpSearch } = await import("sequelize");
    const searchWhere = [
      { location:   { [OpSearch.like]: `%${search}%` } },
      { reportedBy: { [OpSearch.like]: `%${search}%` } },
      { notes:      { [OpSearch.like]: `%${search}%` } }
    ];
    if (where[OpSearch.or]) {
      where[OpSearch.and] = [{ [OpSearch.or]: searchWhere }];
    } else {
      where[OpSearch.or] = searchWhere;
    }
  }

  const alerts = await Alert.findAll({ where, order: [["createdAt","DESC"]] });

  // Notify user if any of their reports were recently resolved
  let resolvedNotice = null;
  if (role === "user") {
    const recentlyResolved = alerts.filter(a =>
      a.status === "resolved" && a.resolvedAt &&
      (Date.now() - new Date(a.resolvedAt).getTime()) < 24 * 60 * 60 * 1000
    );
    if (recentlyResolved.length > 0) {
      resolvedNotice = `✅ ${recentlyResolved.length} of your report(s) have been resolved by the responding agency.`;
    }
  }

  const dashboardLink = role === "admin" ? "/admin/dashboard"
    : role === "bfp" ? "/agency/bfp"
    : role === "pnp" ? "/agency/pnp"
    : role === "ems" ? "/agency/ems"
    : "/user/dashboard";

  // Page title per role
  const titles = { user: "My Reports", bfp: "BFP Alert History", pnp: "PNP Alert History", ems: "EMS Alert History" };

  res.render("alert-history", {
    title: titles[role] || "Alert History",
    dashboardLink,
    isUser: role === "user",
    resolvedNotice,
    alerts: alerts.map(a => formatAlert(a)),
    filterType: type || "", filterStatus: status || "",
    filterSeverity: severity || "", filterSearch: search || ""
  });
};

// GET /alerts/:id - alert detail page
export const alertDetail = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const alert = await Alert.findByPk(req.params.id);
  if (!alert) { req.flash("error_msg","Alert not found."); return res.redirect("/alerts"); }
  const comments = await AlertComment.findAll({ where: { alertId: req.params.id }, order: [["createdAt","ASC"]] });
  const role = req.session.userRole;
  const dashboardLink = role === "admin" ? "/admin/dashboard"
    : role === "bfp" ? "/agency/bfp" : role === "pnp" ? "/agency/pnp"
    : role === "ems" ? "/agency/ems" : "/user/dashboard";
  res.render("alert-detail", {
    title: "Alert Detail",
    dashboardLink,
    isAdmin: role === "admin",
    alert: formatAlert(alert),
    comments: comments.map(c => ({ ...c.toJSON(), timeAgo: timeAgo(c.createdAt) }))
  });
};

// GET /alerts/export - export CSV
export const exportAlerts = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const alerts = await Alert.findAll({ order: [["createdAt","DESC"]] });
  const rows = [
    ["ID","Type","Label","Severity","Location","Reporter","Status","Notes","Created","Responded","Resolved"],
    ...alerts.map(a => [
      a.id, a.type, a.label, a.severity||"", `"${(a.location||"").replace(/"/g,'""')}"`,
      a.reportedBy||"", a.status, `"${(a.notes||"").replace(/"/g,'""')}"`,
      a.createdAt?.toISOString()||"",
      a.respondedAt?.toISOString()||"",
      a.resolvedAt?.toISOString()||""
    ])
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition",`attachment; filename="alerts-${Date.now()}.csv"`);
  res.send(csv);
};

// GET /map
export const mapPage = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const user = await User.findByPk(req.session.userId);
  const dashboardLink = user?.role === "admin" ? "/admin/dashboard" : user?.role === "bfp" ? "/agency/bfp" : user?.role === "pnp" ? "/agency/pnp" : user?.role === "ems" ? "/agency/ems" : "/user/dashboard";
  res.render("map", { title: "Live Map", dashboardLink, isUser: user?.role === "user" });
};

// GET /api/alerts
export const apiAlerts = async (req, res) => {
  const alerts = await Alert.findAll({ order: [["createdAt","DESC"]], limit: 100 });
  res.json(alerts.map(a => ({ ...a.toJSON(), config: ALERT_CONFIG[a.type] })));
};

// GET /api/my-alerts — returns current user's alerts with status (for polling)
export const apiMyAlerts = async (req, res) => {
  if (!req.session.userId) return res.json([]);
  const user = await User.findByPk(req.session.userId);
  if (!user) return res.json([]);
  const alerts = await Alert.findAll({
    where: { reportedBy: user.name },
    order: [["createdAt","DESC"]],
    limit: 20
  });
  res.json(alerts.map(a => ({
    id: a.id,
    type: a.type,
    label: a.label,
    status: a.status,
    location: a.location,
    respondedAt: a.respondedAt,
    resolvedAt: a.resolvedAt
  })));
};

// GET /profile
export const profilePage = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const user = await User.findByPk(req.session.userId);
  const myAlerts = await Alert.findAll({ where: { reportedBy: user.name }, order: [["createdAt","DESC"]] });
  const dashboardLink = user.role === "admin" ? "/admin/dashboard"
    : user.role === "bfp" ? "/agency/bfp"
    : user.role === "pnp" ? "/agency/pnp"
    : user.role === "ems" ? "/agency/ems"
    : "/user/dashboard";
  res.render("profile", {
    title: "My Profile",
    user: user.toJSON(),
    dashboardLink,
    isUser: user.role === "user",
    totalAlerts: myAlerts.length,
    resolvedAlerts: myAlerts.filter(a => a.status === "resolved").length,
    activeAlerts: myAlerts.filter(a => a.status === "active").length
  });
};

// POST /profile/update
export const updateProfile = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const { name, email } = req.body;
  await User.update({ name, email }, { where: { id: req.session.userId } });
  req.session.userName = name;
  req.flash("success_msg", "Profile updated successfully.");
  res.redirect("/profile");
};

// Helpers
export function formatAlert(a) {
  const json = a.toJSON ? a.toJSON() : a;
  return {
    ...json,
    config: ALERT_CONFIG[json.type] || ALERT_CONFIG.fire,
    severityConfig: SEVERITY_CONFIG[json.severity] || SEVERITY_CONFIG.medium,
    timeAgo: timeAgo(json.createdAt),
    responseTime: json.respondedAt && json.createdAt
      ? Math.round((new Date(json.respondedAt) - new Date(json.createdAt)) / 60000) + " min"
      : null
  };
}

function timeAgo(date) {
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
