import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { APP_MENU_ITEMS, menuSettingKey } from "@/lib/menu";
import { executeStatement, selectRows } from "@/lib/mysql";

type SettingRow = RowDataPacket & {
  setting_key: string;
  setting_value: string;
};

let settingsTableReady = false;

async function ensureSettingsTable() {
  if (settingsTableReady) return;

  await executeStatement(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key varchar(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
      setting_value varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  settingsTableReady = true;
}

export async function getAppSetting(key: string): Promise<string | null> {
  try {
    await ensureSettingsTable();

    const rows = await selectRows<SettingRow>(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ? LIMIT 1",
      [key]
    );

    return rows[0]?.setting_value ?? null;
  } catch (error) {
    console.error("Unable to read app setting", error);
    return null;
  }
}

export async function listAppSettingsByPrefix(prefix: string): Promise<Record<string, string>> {
  try {
    await ensureSettingsTable();

    const rows = await selectRows<SettingRow>(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE ?",
      [`${prefix}%`]
    );

    return Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  } catch (error) {
    console.error("Unable to list app settings", error);
    return {};
  }
}

export async function setAppSetting(key: string, value: string) {
  await ensureSettingsTable();

  await executeStatement(
    `
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    `,
    [key, value]
  );
}

export async function getBooleanSetting(key: string, fallbackValue: boolean) {
  const raw = await getAppSetting(key);

  if (raw === null) return fallbackValue;

  const normalized = raw.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "off";
}

export async function setBooleanSetting(key: string, value: boolean) {
  await setAppSetting(key, value ? "true" : "false");
}

function settingValueToBoolean(value: string | null | undefined, fallbackValue: boolean) {
  if (value == null) return fallbackValue;
  const normalized = value.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "off";
}

export type MenuVisibility = Record<string, boolean>;

export async function getMenuVisibility(): Promise<MenuVisibility> {
  const settings = await listAppSettingsByPrefix("menu.");

  return Object.fromEntries(
    APP_MENU_ITEMS.map((item) => [
      item.key,
      settingValueToBoolean(settings[menuSettingKey(item.key)], true),
    ])
  );
}

export async function setMenuVisibility(values: MenuVisibility) {
  for (const item of APP_MENU_ITEMS) {
    await setBooleanSetting(menuSettingKey(item.key), Boolean(values[item.key]));
  }
}
