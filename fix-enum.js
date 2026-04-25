import { sequelize } from "./models/db.js";

await sequelize.query(
  "ALTER TABLE Users MODIFY COLUMN role ENUM('admin','user','bfp','pnp','ems') DEFAULT 'user';"
);
console.log("✅ Role ENUM updated successfully.");
await sequelize.close();
