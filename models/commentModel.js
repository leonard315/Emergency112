import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";
import { Alert } from "./alertModel.js";

export const AlertComment = sequelize.define("AlertComment", {
  alertId:   { type: DataTypes.INTEGER, allowNull: false },
  author:    { type: DataTypes.STRING,  allowNull: false },
  message:   { type: DataTypes.TEXT,    allowNull: false }
});

Alert.hasMany(AlertComment, { foreignKey: "alertId", onDelete: "CASCADE" });
AlertComment.belongsTo(Alert, { foreignKey: "alertId" });

export { sequelize };
