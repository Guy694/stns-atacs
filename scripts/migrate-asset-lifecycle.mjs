import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import mysql from "mysql2/promise";

// Usage:
//   node scripts/migrate-asset-lifecycle.mjs            read-only preflight (default)
//   node scripts/migrate-asset-lifecycle.mjs --apply    apply database/add_asset_lifecycle.sql, then verify
// Reads MYSQL_* from the environment or .env. Take a backup (mysqldump) before --apply.
const apply = process.argv.includes("--apply");
const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, multipleStatements: true,
});

// Fingerprint of data the migration must not change: asset IDs, placement, status, class and key relations.
async function snapshot() {
  const [[counts]] = await connection.query(`SELECT
      (SELECT COUNT(*) FROM information_assets) AS assets,
      (SELECT COUNT(*) FROM information_asset_surveys) AS surveys,
      (SELECT COUNT(*) FROM asset_status_history) AS status_history`).catch(async () => {
        const [[fallback]] = await connection.query("SELECT (SELECT COUNT(*) FROM information_assets) AS assets, (SELECT COUNT(*) FROM information_asset_surveys) AS surveys, NULL AS status_history");
        return [[fallback]];
      });
  const [rows] = await connection.query(
    "SELECT id, survey_id, COALESCE(work_group_id, 0) AS wg, COALESCE(asset_registration_no, '') AS reg, COALESCE(current_status, '') AS st, COALESCE(asset_class, '') AS cls, asset_category AS cat, COALESCE(purchase_price, '') AS price FROM information_assets ORDER BY id"
  );
  const hash = crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  let linked = null;
  try { [[{ n: linked }]] = await connection.query("SELECT COUNT(*) AS n FROM agent_devices WHERE linked_asset_id IS NOT NULL"); } catch { /* agent tables optional */ }
  return { ...counts, linkedAgentDevices: linked, fingerprint: hash };
}

async function schemaState() {
  const [tables] = await connection.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('asset_transfers','asset_disposal_requests','asset_repairs','asset_repair_logs')");
  const [columns] = await connection.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'useful_life_years'");
  return { tables: tables.map(t => t.TABLE_NAME).sort(), usefulLifeColumn: columns.length === 1 };
}

try {
  const [[version]] = await connection.query("SELECT VERSION() AS v, DATABASE() AS db");
  const [idColumn] = await connection.query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'id'");
  if (!idColumn.length) throw new Error("information_assets not found: run database/information_assets.sql first");
  if (!/^int(?:\(\d+\))?$/.test(idColumn[0].COLUMN_TYPE)) throw new Error(`information_assets.id is ${idColumn[0].COLUMN_TYPE}; the new foreign keys expect signed INT`);
  for (const column of ["purchase_price", "purchase_order_no"]) {
    const [found] = await connection.query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = ?", [column]);
    if (!found.length) throw new Error(`Missing information_assets.${column}: run database/migrate_purchase_fields.sql first`);
  }
  const before = await snapshot();
  console.log(`Server ${version.v}, database ${version.db}`);
  console.log("Before:", before, await schemaState());
  if (!apply) {
    console.log("Preflight passed. No changes made. Back up the database, then run with --apply.");
  } else {
    await connection.query(fs.readFileSync(new URL("../database/add_asset_lifecycle.sql", import.meta.url), "utf8"));
    const after = await snapshot();
    const state = await schemaState();
    console.log("After:", after, state);
    if (state.tables.length !== 4 || !state.usefulLifeColumn) throw new Error("Lifecycle tables/column missing after migration");
    for (const key of ["assets", "surveys", "status_history", "linkedAgentDevices", "fingerprint"]) {
      if (String(before[key]) !== String(after[key])) throw new Error(`Existing data changed unexpectedly: ${key}`);
    }
    console.log("Migration verified: asset IDs, placement, status, class, prices and Agent links are unchanged.");
  }
} finally {
  await connection.end();
}
