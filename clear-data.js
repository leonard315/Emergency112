// Clear all system data — keeps DB structure, removes all records
import { sequelize } from "./models/db.js";

try {
  await sequelize.authenticate();
  console.log("✅ Connected");

  const q = (sql) => sequelize.query(sql);

  // Clear all alerts and comments
  await q("DELETE FROM AlertComments");
  console.log("✅ AlertComments cleared");

  await q("DELETE FROM Alerts");
  console.log("✅ Alerts cleared");

  // Clear all users
  await q("DELETE FROM Users");
  console.log("✅ All users cleared");

  // Reset auto-increment counters
  await q("ALTER TABLE AlertComments AUTO_INCREMENT = 1");
  await q("ALTER TABLE Alerts AUTO_INCREMENT = 1");
  await q("ALTER TABLE Users AUTO_INCREMENT = 1");
  console.log("✅ Auto-increment reset");

  console.log("\n✅ All data cleared. Database is clean and ready.");
  console.log("   Run 'node seed.js' to re-seed default accounts.");

} catch(e) {
  console.error("❌", e.message);
} finally {
  process.exit();
}
