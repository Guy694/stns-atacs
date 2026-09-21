import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

import mysql, { type ResultSetHeader, type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";

declare global {
  var __atacsMysqlPool: Pool | undefined;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createPool() {
  return mysql.createPool({
    host: getRequiredEnv("MYSQL_HOST"),
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: getRequiredEnv("MYSQL_USER"),
    password: getRequiredEnv("MYSQL_PASSWORD"),
    database: getRequiredEnv("MYSQL_DATABASE"),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
  });
}

export function getMysqlPool() {
  if (!global.__atacsMysqlPool) {
    global.__atacsMysqlPool = createPool();
  }

  return global.__atacsMysqlPool;
}

const transactionContext = new AsyncLocalStorage<PoolConnection>();

export async function withTransaction<T>(work: () => Promise<T>): Promise<T> {
  if (transactionContext.getStore()) return work();
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await transactionContext.run(connection, work);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function selectRows<T extends RowDataPacket>(sql: string, values?: unknown[]) {
  const [rows] = await (transactionContext.getStore() ?? getMysqlPool()).query<T[]>(sql, values);
  return rows;
}

export async function executeStatement(sql: string, values?: unknown[]) {
  const [result] = await (transactionContext.getStore() ?? getMysqlPool()).query<ResultSetHeader>(sql, values);
  return result;
}