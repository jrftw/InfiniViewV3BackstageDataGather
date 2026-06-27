/**
 * Filename: gathererMongoClient.ts
 * Purpose: MongoDB connection lifecycle for Backstage Gatherer dual-write output.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-27
 * Dependencies: mongodb, config, logger
 * Platform Compatibility: Node.js 18+
 */

import dns from "dns";
import { Db, MongoClient } from "mongodb";
import { GathererConfig, gathererIsMongoConfigured } from "../config";
import { logDebug, logError, logInfo } from "../logging/logger";

const GATHERER_MONGO_CLIENT_SOURCE = "gathererMongoClient";

// MARK: DNS Configuration

function gathererMongoClientConfigureDnsForSrvUri(mongodbUri: string): void {
  if (!mongodbUri.startsWith("mongodb+srv://")) {
    return;
  }

  const configuredServers = process.env.GATHERER_MONGODB_DNS_SERVERS?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  const dnsServers =
    configuredServers && configuredServers.length > 0
      ? configuredServers
      : ["8.8.8.8", "8.8.4.4", "1.1.1.1"];

  dns.setServers(dnsServers);
  logDebug(
    `Using DNS servers for MongoDB SRV lookup: ${dnsServers.join(", ")}`,
    GATHERER_MONGO_CLIENT_SOURCE
  );
}

// MARK: Connection State

let gathererMongoClientInstance: MongoClient | null = null;
let gathererMongoDbInstance: Db | null = null;
let gathererMongoConnectedDbName: string | null = null;

// MARK: Connection API

export async function gathererConnectMongo(config: GathererConfig): Promise<Db> {
  if (!gathererIsMongoConfigured(config)) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (gathererMongoDbInstance && gathererMongoConnectedDbName === config.mongodbDbName) {
    return gathererMongoDbInstance;
  }

  if (gathererMongoClientInstance) {
    await gathererMongoClientInstance.close();
    gathererMongoClientInstance = null;
    gathererMongoDbInstance = null;
    gathererMongoConnectedDbName = null;
  }

  gathererMongoClientConfigureDnsForSrvUri(config.mongodbUri);
  gathererMongoClientInstance = new MongoClient(config.mongodbUri);
  await gathererMongoClientInstance.connect();
  gathererMongoDbInstance = gathererMongoClientInstance.db(config.mongodbDbName);
  gathererMongoConnectedDbName = config.mongodbDbName;

  logInfo(
    `Connected to MongoDB database ${config.mongodbDbName}`,
    GATHERER_MONGO_CLIENT_SOURCE
  );

  return gathererMongoDbInstance;
}

export function gathererGetMongoDb(): Db {
  if (!gathererMongoDbInstance) {
    throw new Error("MongoDB is not connected yet");
  }
  return gathererMongoDbInstance;
}

export async function gathererPingMongo(config: GathererConfig): Promise<boolean> {
  try {
    const db = await gathererConnectMongo(config);
    await db.command({ ping: 1 });
    logDebug("MongoDB ping succeeded", GATHERER_MONGO_CLIENT_SOURCE);
    return true;
  } catch (error) {
    logError("MongoDB ping failed", GATHERER_MONGO_CLIENT_SOURCE, {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function gathererDisconnectMongo(): Promise<void> {
  if (gathererMongoClientInstance) {
    await gathererMongoClientInstance.close();
    gathererMongoClientInstance = null;
    gathererMongoDbInstance = null;
    gathererMongoConnectedDbName = null;
    logInfo("MongoDB connection closed", GATHERER_MONGO_CLIENT_SOURCE);
  }
}

// Suggestions For Features and Additions Later:
// - Connection pool tuning via GATHERER_MONGODB_MAX_POOL_SIZE env var
// - Retry wrapper for transient MongoDB write errors during bulk upsert
