import "dotenv/config";
import mysql from "mysql2/promise";

// Read-only preflight/post-migration verification against the configured database.
const connection = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
try {
  const [columns] = await connection.query("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('information_assets', 'asset_subtypes', 'asset_extensions')");
  const column = (table, name) => columns.find(c => c.TABLE_NAME === table && c.COLUMN_NAME === name);
  if (!column("information_assets", "asset_class")) throw new Error("Missing asset_class: apply database/add_asset_class.sql first");
  if (!/^int(?:\(\d+\))?$/.test(column("information_assets", "id")?.COLUMN_TYPE ?? "")) throw new Error("information_assets.id must be signed INT; adapt foreign-key types to the real schema before migration");
  const [indexes] = await connection.query("SELECT INDEX_NAME, COUNT(*) AS column_count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND NON_UNIQUE = 0 GROUP BY INDEX_NAME HAVING COUNT(*) = 1 AND MAX(COLUMN_NAME) = 'id'");
  if (!indexes.length) throw new Error("information_assets.id requires a single-column unique/primary index");
  if (process.argv.includes("--before")) { console.log("Prerequisites passed. No database changes made."); }
  else {
    for (const [table, names] of [["asset_subtypes", ["id", "asset_class", "name", "is_active"]], ["asset_extensions", ["asset_id", "asset_class", "subtype_id", "schema_version", "details"]]]) {
      for (const name of names) if (!column(table, name)) throw new Error(`Missing ${table}.${name}: apply database/add_asset_extensions.sql`);
    }
    const [keys] = await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_extensions'");
    for (const name of ["fk_extension_asset", "fk_extension_subtype"]) if (!keys.some(k => k.CONSTRAINT_NAME === name)) throw new Error(`Missing foreign key ${name}`);
    const [invalid] = await connection.query("SELECT COUNT(*) AS n FROM asset_extensions WHERE schema_version <> 1 OR JSON_TYPE(details) <> 'OBJECT'");
    if (invalid[0].n) throw new Error("Unsupported extension schema version or malformed detail objects");
    console.log("Asset extension schema passed. No database changes made.");
  }
} finally { await connection.end(); }
