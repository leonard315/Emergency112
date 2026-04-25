import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Alert = sequelize.define("Alert", {
  type:       { type: DataTypes.ENUM("fire","crime","medical","all"), allowNull: false },
  label:      { type: DataTypes.STRING, allowNull: false },
  severity:   { type: DataTypes.ENUM("low","medium","high","critical"), defaultValue: "medium" },
  location:   { type: DataTypes.STRING, allowNull: true },
  latitude:   { type: DataTypes.FLOAT,  allowNull: true },
  longitude:  { type: DataTypes.FLOAT,  allowNull: true },
  status:     { type: DataTypes.ENUM("active","responding","resolved"), defaultValue: "active" },
  reportedBy: { type: DataTypes.STRING, allowNull: true },
  assignedTo: { type: DataTypes.STRING, allowNull: true },
  notes:      { type: DataTypes.TEXT,   allowNull: true },
  photoPath:  { type: DataTypes.STRING, allowNull: true },
  respondedAt:{ type: DataTypes.DATE,   allowNull: true },
  resolvedAt: { type: DataTypes.DATE,   allowNull: true },
  isFalseReport: { type: DataTypes.BOOLEAN, defaultValue: false },
  falseReportNote: { type: DataTypes.STRING, allowNull: true }
});

export { sequelize };
