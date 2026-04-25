import { Alert } from "../models/alertModel.js";
import { User } from "../models/userModel.js";

const AGENCY_CONFIG = {
  bfp: {
    name: "Bureau of Fire Protection",
    short: "BFP",
    types: ["fire", "all"],
    color: "#f97316",
    colorDark: "rgba(249,115,22,.15)",
    colorBorder: "rgba(249,115,22,.3)",
    icon: "fire", bg: "from-orange-950/30", accent: "orange"
  },
  pnp: {
    name: "Philippine National Police",
    short: "PNP",
    types: ["crime", "all"],
    color: "#3b82f6",
    colorDark: "rgba(59,130,246,.15)",
    colorBorder: "rgba(59,130,246,.3)",
    icon: "shield", bg: "from-blue-950/30", accent: "blue"
  },
  ems: {
    name: "Emergency Medical Services",
    short: "EMS",
    types: ["medical", "all"],
    color: "#ef4444",
    colorDark: "rgba(239,68,68,.15)",
    colorBorder: "rgba(239,68,68,.3)",
    icon: "heart", bg: "from-red-950/30", accent: "red"
  },
};

const ALERT_CONFIG = {
  fire:    { label: "Fire Emergency",    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/></svg>' },
  crime:   { label: "Crime Emergency",   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>' },
  medical: { label: "Medical Emergency", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>' },
  all:     { label: "All Agencies Alert",icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' }
};

// GET /agency/:type — agency dashboard
export const agencyDashboard = async (req, res) => {
  const { type } = req.params;
  const agency = AGENCY_CONFIG[type];
  if (!agency) return res.redirect("/login");

  // Check role matches
  if (req.session.userRole !== type && req.session.userRole !== "admin") {
    return res.redirect("/login");
  }

  const alerts = await Alert.findAll({
    where: { type: agency.types },
    order: [["createdAt", "DESC"]],
    limit: 50
  });

  const stats = {
    total:      await Alert.count({ where: { type: agency.types } }),
    active:     await Alert.count({ where: { type: agency.types, status: "active" } }),
    responding: await Alert.count({ where: { type: agency.types, status: "responding" } }),
    resolved:   await Alert.count({ where: { type: agency.types, status: "resolved" } })
  };

  res.render("agency/dashboard", {
    title: `${agency.short} Dashboard`,
    agencyType: type,
    agency,
    agencyName: req.session.userName,
    stats,
    alerts: alerts.map(a => ({
      ...a.toJSON(),
      config: ALERT_CONFIG[a.type] || ALERT_CONFIG.all,
      timeAgo: timeAgo(a.createdAt),
      responseTime: a.respondedAt && a.createdAt
        ? Math.round((new Date(a.respondedAt) - new Date(a.createdAt)) / 60000) + " min"
        : null
    }))
  });
};

// POST /agency/:type/alerts/:id/status
export const agencyUpdateStatus = async (req, res) => {
  const { type, id } = req.params;
  const { status } = req.body;
  if (req.session.userRole !== type && req.session.userRole !== "admin") {
    return res.redirect("/login");
  }
  const alert = await Alert.findByPk(id);
  if (alert) {
    const updates = { status };
    if (status === "responding") updates.respondedAt = new Date();
    if (status === "resolved")   updates.resolvedAt  = new Date();
    await alert.update(updates);
    req.flash("success_msg", `Alert marked as "${status}".`);
  }
  res.redirect(`/agency/${type}`);
};

// GET /api/agency/:type/alerts — JSON for live polling
export const agencyApiAlerts = async (req, res) => {
  const { type } = req.params;
  const agency = AGENCY_CONFIG[type];
  if (!agency) return res.json([]);
  const alerts = await Alert.findAll({
    where: { type: agency.types },
    order: [["createdAt", "DESC"]],
    limit: 50
  });
  res.json(alerts.map(a => ({
    ...a.toJSON(),
    config: ALERT_CONFIG[a.type] || ALERT_CONFIG.all,
    timeAgo: timeAgo(a.createdAt)
  })));
};

function timeAgo(date) {
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export { AGENCY_CONFIG };
