import "dotenv/config";
import fs from "node:fs";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, multipleStatements: true });
try {
  const sql = fs.readFileSync(new URL("../database/expand_asset_schedule_classes.sql", import.meta.url), "utf8");
  const allowed = [...sql.matchAll(/CHECK \(asset_class IN \(([^)]+)\)\)/g)][0][1].split(",").map(value => value.trim().slice(1, -1));
  for (const table of ["asset_subtypes", "asset_extensions"]) {
    const [invalid] = await connection.query(`SELECT COUNT(*) AS n FROM ${table} WHERE asset_class NOT IN (?)`, [allowed]);
    if (invalid[0].n) throw new Error(`${table} has unsupported classes; review these before migration.`);
  }
  if (!process.argv.includes("--apply")) {
    console.log("Preflight passed. Run with --apply to expand constraints and seed schedule subtypes.");
  } else {
    await connection.query(sql);
    const [rows] = await connection.query("SELECT COUNT(DISTINCT asset_class) AS classes FROM asset_subtypes WHERE asset_class NOT IN ('Building', 'Utility')");
    console.log(`Migration complete: ${rows[0].classes} non-IT schedule classes have subtypes. Existing assets were not reclassified.`);
  }
} finally { await connection.end(); }
