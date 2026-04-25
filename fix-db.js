// Quick DB fix — adds missing columns without dropping data
import { sequelize } from "./models/db.js";
import { User } from "./models/userModel.js";
import { Alert } from "./models/alertModel.js";
import { AlertComment } from "./models/commentModel.js";

try {
  await sequelize.authenticate();
  console.log("✅ Connected");

  // Add missing columns manually (safe — won't fail if already exist)
  const q = (sql) => sequelize.query(sql).catch(() => {});
  await q(`ALTER TABLE Users ADD COLUMN isSuspended TINYINT(1) NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE Users ADD COLUMN falseReportCount INT NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE Users ADD COLUMN lastAlertAt DATETIME NULL`);
  await q(`ALTER TABLE Alerts ADD COLUMN isFalseReport TINYINT(1) NOT NULL DEFAULT 0`);
  await q(`ALTER TABLE Alerts ADD COLUMN falseReportNote VARCHAR(255) NULL`);
  // Fix any existing uppercase role values before altering ENUM
  await q(`UPDATE Users SET role = 'security' WHERE role = 'SECURITY'`);
  await q(`UPDATE Users SET role = 'faculty' WHERE role = 'FACULTY'`);
  await q(`UPDATE Alerts SET type = 'security' WHERE type = 'SECURITY'`);
  await q(`UPDATE Alerts SET type = 'faculty' WHERE type = 'FACULTY'`);
  console.log("✅ Fixed uppercase values");

  await q(`ALTER TABLE Users MODIFY COLUMN role ENUM('admin','user','bfp','pnp','ems','security','faculty') NOT NULL DEFAULT 'user'`);
  await q(`ALTER TABLE Alerts ADD COLUMN severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium'`);
  await q(`ALTER TABLE Alerts ADD COLUMN assignedTo VARCHAR(255) NULL`);
  await q(`ALTER TABLE Alerts ADD COLUMN photoPath VARCHAR(255) NULL`);
  await q(`ALTER TABLE Alerts MODIFY COLUMN type ENUM('fire','crime','medical','all','security','faculty') NOT NULL`);
  console.log("✅ Columns added");

  // Sync new AlertComments table
  await sequelize.sync({ alter: true });
  console.log("✅ All tables synced");
} catch (err) {
  console.error("❌", err.message);
} finally {
  process.exit();
}
