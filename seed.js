/*
    Emergency112 - Admin Seed Script
    Creates the default admin account if it doesn't exist.
*/

import bcrypt from "bcrypt";
import { sequelize } from "./models/db.js";
import { User } from "./models/userModel.js";
import { Alert } from "./models/alertModel.js";

await sequelize.sync();

const accounts = [
  { email: "AdminEmergency@gmail.com", name: "Admin", password: "admin123", role: "admin" },
  { email: "bfp@emergency.gov.ph",     name: "BFP Responder",  password: "bfp12345",  role: "bfp" },
  { email: "pnp@emergency.gov.ph",     name: "PNP Responder",  password: "pnp12345",  role: "pnp" },
  { email: "ems@emergency.gov.ph",     name: "EMS Responder",  password: "ems12345",  role: "ems" },

];

for (const acc of accounts) {
  const existing = await User.findOne({ where: { email: acc.email } });
  if (existing) {
    console.log(`✅ Already exists: ${acc.email}`);
  } else {
    const hashed = await bcrypt.hash(acc.password, 10);
    await User.create({ name: acc.name, email: acc.email, password: hashed, role: acc.role });
    console.log(`✅ Created: ${acc.email} (${acc.role})`);
  }
}

process.exit();
