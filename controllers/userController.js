/*
    Emergency112 - User Controller
    Regular user dashboard and alert actions
*/

import { User } from "../models/userModel.js";
import { Alert } from "../models/alertModel.js";

const ALERT_CONFIG = {
  fire:    { label: "Fire Emergency",    color: "orange", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/></svg>', agency: "Bureau of Fire Protection" },
  crime:   { label: "Crime Emergency",   color: "blue",   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>', agency: "Philippine National Police" },
  medical: { label: "Medical Emergency", color: "red",    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>', agency: "Emergency Medical Services" },
  all:     { label: "All Agencies Alert", color: "white", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>', agency: "BFP + PNP + EMS" }
};

export const userDashboard = async (req, res) => {
  try {
  const user = await User.findByPk(req.session.userId);
  const isAdmin = req.session.userRole === "admin";

  const myAlerts = await Alert.findAll({
    where: { reportedBy: user.name },
    order: [["createdAt", "DESC"]],
    limit: 5
  });

  const activeAlerts = await Alert.findAll({
    where: { status: ["active", "responding"] },
    order: [["createdAt", "DESC"]],
    limit: 5
  });

  const myStats = {
    total:    await Alert.count({ where: { reportedBy: user.name } }),
    active:   await Alert.count({ where: { reportedBy: user.name, status: "active" } }),
    resolved: await Alert.count({ where: { reportedBy: user.name, status: "resolved" } })
  };

  // Cooldown remaining
  let cooldownRemaining = 0;
  if (user.lastAlertAt) {
    const elapsed = Date.now() - new Date(user.lastAlertAt).getTime();
    const remaining = (5 * 60 * 1000) - elapsed;
    if (remaining > 0) cooldownRemaining = Math.ceil(remaining / 1000);
  }

  res.render("user/dashboard", {
    title: "Emergency Alert",
    userName: user.name,
    userEmail: user.email,
    isAdmin,
    isSuspended: user.isSuspended || false,
    falseReportCount: user.falseReportCount || 0,
    cooldownRemaining,
    myStats,
    myAlerts: myAlerts.map(a => ({
      ...a.toJSON(),
      config: ALERT_CONFIG[a.type] || ALERT_CONFIG.fire,
      timeAgo: timeAgo(a.createdAt)
    })),
    activeAlerts: activeAlerts.map(a => ({
      ...a.toJSON(),
      config: ALERT_CONFIG[a.type] || ALERT_CONFIG.fire,
      timeAgo: timeAgo(a.createdAt)
    }))
  });
  } catch(err) {
    console.error("userDashboard error:", err.message);
    res.redirect("/login");
  }
};

// GET /user/alerts - user's alert panel (send alerts)
export const userAlertPanel = async (req, res) => {
  const user = await User.findByPk(req.session.userId);

  const myAlerts = await Alert.findAll({
    where: { reportedBy: user.name },
    order: [["createdAt", "DESC"]],
    limit: 20
  });

  const stats = {
    total:      await Alert.count({ where: { reportedBy: user.name } }),
    active:     await Alert.count({ where: { reportedBy: user.name, status: "active" } }),
    responding: await Alert.count({ where: { reportedBy: user.name, status: "responding" } }),
    resolved:   await Alert.count({ where: { reportedBy: user.name, status: "resolved" } })
  };

  res.render("alerts", {
    title: "Emergency Alert Panel",
    user: user.name,
    alerts: myAlerts.map(a => ({
      ...a.toJSON(),
      config: ALERT_CONFIG[a.type],
      timeAgo: timeAgo(a.createdAt)
    })),
    stats,
    config: ALERT_CONFIG
  });
};

function timeAgo(date) {
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
