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

  try {
    const [s] = await c.query(
      "SELECT id FROM information_asset_surveys WHERE facility_id=? LIMIT 1",
      [44]
    );

    let surveyId = s[0]?.id;
    if (!surveyId) {
      const [ins] = await c.query(
        "INSERT INTO information_asset_surveys (facility_id,survey_date) VALUES (?,CURDATE())",
        [44]
      );
      surveyId = ins.insertId;
    }

    const reg = "AGT-044-TEST-" + Date.now();
    await c.query(
      "INSERT INTO information_assets (survey_id,row_no,asset_registration_no,asset_name,usage_description,owner_name,asset_category,device_type,operating_system,operating_system_version,private_ip,public_ip,location_detail,current_status,updated_by,manufacturer_brand,manufacturer_model,manufacturer_specification,serial_number,purchase_price,purchase_date,purchase_order_no,maintenance_start_date,maintenance_end_date,installed_at,last_updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        surveyId,
        null,
        reg,
        "debug-host · Model",
        "Auto collected by ATACS Agent",
        "debug",
        "Hardware",
        "PC",
        "Windows",
        "11",
        "192.168.1.10",
        null,
        "debug-host",
        "Active",
        "agent:debug-host",
        "Test",
        "Model",
        "CPU|RAM",
        "SN-001",
        null,
        null,
        null,
        null,
        null,
        null,
        new Date().toISOString().slice(0, 10),
      ]
    );

    console.log("insert-ok");
  } catch (e) {
    console.error("sql-error:", e.message);
  } finally {
    await c.end();
  }
})();
