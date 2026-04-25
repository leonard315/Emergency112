import { sequelize } from "./models/db.js";
import bcrypt from "bcrypt";

try {
  await sequelize.authenticate();

  // Step 1: Delete ALL old clinic/security accounts
  await sequelize.query("DELETE FROM Users WHERE email IN ('clinic@school.edu.ph','security@school.edu.ph') OR role IN ('clinic','SECURITY','security')");
  console.log("✅ Old accounts deleted");

  // Step 2: Create fresh security account
  const hash = await bcrypt.hash("security123", 10);
  await sequelize.query(
    "INSERT INTO Users (name, email, password, role, isSuspended, falseReportCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 0, NOW(), NOW())",
    { replacements: ["School Security", "security@school.edu.ph", hash, "security"] }
  );
  console.log("✅ Security account created!");
  console.log("   Email   : security@school.edu.ph");
  console.log("   Password: security123");
  console.log("   Role    : security");

  // Verify
  const [rows] = await sequelize.query("SELECT id, name, email, role FROM Users WHERE email='security@school.edu.ph'");
  console.log("✅ Verified:", rows[0]);

} catch(e) {
  console.error("❌", e.message);
} finally {
  process.exit();
}
