import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

function poolConfig(env) {
  let config;
  const mysql = { createPool(options) { config = options; return {}; } };
  const globalState = {};
  const { getMysqlPool } = loadTs("lib/mysql.ts", { "mysql2/promise": mysql }, {
    global: globalState,
    process: { env },
  });
  getMysqlPool();
  return config;
}

test("database pool accepts DB_* variables from the existing server compose", () => {
  const config = poolConfig({ DB_HOST: "db", DB_PORT: "3307", DB_USER: "atacs", DB_PASSWORD: "secret", DB_NAME: "stn_atacs" });
  assert.equal(config.host, "db");
  assert.equal(config.port, 3307);
  assert.equal(config.user, "atacs");
  assert.equal(config.password, "secret");
  assert.equal(config.database, "stn_atacs");
});

test("MYSQL_* keeps priority when both variable sets are present", () => {
  const config = poolConfig({
    MYSQL_HOST: "mysql-db", MYSQL_PORT: "3306", MYSQL_USER: "mysql-user", MYSQL_PASSWORD: "mysql-pass", MYSQL_DATABASE: "mysql-name",
    DB_HOST: "other-db", DB_PORT: "3307", DB_USER: "other-user", DB_PASSWORD: "other-pass", DB_NAME: "other-name",
  });
  assert.equal(config.host, "mysql-db");
  assert.equal(config.port, 3306);
  assert.equal(config.user, "mysql-user");
  assert.equal(config.password, "mysql-pass");
  assert.equal(config.database, "mysql-name");
});
