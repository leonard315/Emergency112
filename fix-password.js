import bcrypt from "bcrypt";
import { sequelize } from "./models/db.js";

try {
  await sequelize.authenticate();

  const hashed = await bcrypt.hash("security123", 10);
  await sequelize.query(`UPDATE Users SET password='${hashed}', role='security', name='School Security' WHERE id=7`);
  // Use raw query to bypass Sequelize unique validation for email
  await sequelize.query(`UPDATE Users SET email='security@school.edu.ph' WHERE id=7`, { raw: true });
  console.log("✅ Security account fully updated!");
  console.log("   Email   : security@school.edu.ph");
  console.log("   Password: security123");
  console.log("   Role    : security");

  // Verify
  const [[user]] = await sequelize.query("SELECT id, name, email, role FROM Users WHERE id=7");
  console.log("✅ Verified:", user);
} catch(e) {
  console.error("❌", e.message);
} finally {
  process.exit();
}
