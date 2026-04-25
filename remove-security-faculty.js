import { sequelize } from "./models/db.js";

try {
  await sequelize.authenticate();
  console.log("✅ Connected");

  const q = (sql) => sequelize.query(sql).catch(e => console.log("  skip:", e.message));

  // Delete security and faculty accounts
  await q(`DELETE FROM Users WHERE role IN ('security','faculty')`);
  console.log("✅ Deleted security & faculty accounts");

  // Delete alerts of those types
  await q(`DELETE FROM Alerts WHERE type IN ('security','faculty')`);
  console.log("✅ Deleted security & faculty alerts");

  // Update ENUMs
  await q(`ALTER TABLE Users MODIFY COLUMN role ENUM('admin','user','bfp','pnp','ems') NOT NULL DEFAULT 'user'`);
  console.log("✅ Users role ENUM updated");

  await q(`ALTER TABLE Alerts MODIFY COLUMN type ENUM('fire','crime','medical','all') NOT NULL`);
  console.log("✅ Alerts type ENUM updated");

} catch(e) {
  console.error("❌", e.message);
} finally {
  process.exit();
}
