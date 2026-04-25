// Reset system data — clears all alerts, comments, and non-admin users
// Keeps: admin account, agency accounts (bfp, pnp, ems)
// Removes: all alerts, all comments, all regular user accounts

import { sequelize } from "./models/db.js";
import { User } from "./models/userModel.js";
import { Alert } from "./models/alertModel.js";
import { AlertComment } from "./models/commentModel.js";

try {
  await sequelize.authenticate();
  console.log("✅ Connected to database");

  // 1. Delete all alert comments
  const deletedComments = await AlertComment.destroy({ where: {} });
  console.log(`✅ Deleted ${deletedComments} alert comment(s)`);

  // 2. Delete all alerts
  const deletedAlerts = await Alert.destroy({ where: {} });
  console.log(`✅ Deleted ${deletedAlerts} alert(s)`);

  // 3. Delete regular user accounts (keep admin, bfp, pnp, ems)
  const { Op } = await import("sequelize");
  const deletedUsers = await User.destroy({
    where: {
      role: { [Op.notIn]: ["admin", "bfp", "pnp", "ems"] }
    }
  });
  console.log(`✅ Deleted ${deletedUsers} regular user account(s)`);

  // 4. Reset false report counts on remaining users
  await User.update(
    { falseReportCount: 0, isSuspended: false, lastAlertAt: null },
    { where: {} }
  );
  console.log("✅ Reset false report counts on all accounts");

  // Show remaining accounts
  const remaining = await User.findAll({ attributes: ["id", "name", "email", "role"] });
  console.log("\n📋 Remaining accounts:");
  remaining.forEach(u => console.log(`   [${u.role}] ${u.name} — ${u.email}`));

  console.log("\n✅ System data reset complete!");

} catch (err) {
  console.error("❌ Error:", err.message);
} finally {
  process.exit();
}
