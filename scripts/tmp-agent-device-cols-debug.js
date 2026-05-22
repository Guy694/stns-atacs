require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const c = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const needed = [
    "serial_number",
    "bios_serial",
    "device_type",
    "manufacturer_brand",
    "manufacturer_model",
    "operating_system",
    "operating_system_version",
    "private_ip",
    "mac_address",
    "current_user",
    "cpu_model",
    "ram_mb",
    "disk_total_gb",
    "location_detail",
    "agent_version",
    "status",
    "last_seen_at",
    "last_reported_at",
    "raw_payload_json",
    "linked_asset_id",
  ];

  for (const col of needed) {
    const [rows] = await c.query("SHOW COLUMNS FROM agent_devices LIKE ?", [col]);
    console.log(col + ":" + (rows.length ? "OK" : "MISSING"));
  }

  await c.end();
})();
