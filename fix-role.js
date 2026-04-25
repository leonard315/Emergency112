import { sequelize } from "./models/db.js";

try {
  await sequelize.authenticate();
  // Step 1: Expand ENUM to include both clinic and security
  await sequelize.query("ALTER TABLE Users MODIFY COLUMN role ENUM('admin','user','bfp','pnp','ems','clinic','security','faculty') NOT NULL DEFAULT 'user'");
  await sequelize.query("ALTER TABLE Alerts MODIFY COLUMN type ENUM('fire','crime','medical','all','clinic','security','faculty') NOT NULL");
  console.log("✅ ENUM expanded");

  // Step 2: Update old clinic values to security
  await sequelize.query("UPDATE Users SET role='security', name='School Security' WHERE role='clinic'");
  await sequelize.query("UPDATE Alerts SET type='security' WHERE type='clinic'");
  console.log("✅ Values updated");

  // Step 3: Remove clinic from ENUM
  await sequelize.query("ALTER TABLE Users MODIFY COLUMN role ENUM('admin','user','bfp','pnp','ems','security','faculty') NOT NULL DEFAULT 'user'");
  await sequelize.query("ALTER TABLE Alerts MODIFY COLUMN type ENUM('fire','crime','medical','all','security','faculty') NOT NULL");
  console.log("✅ ENUM finalized — clinic removed, security active");
} catch(e) {
  console.error("❌", e.message);
} finally {
  process.exit();
}
