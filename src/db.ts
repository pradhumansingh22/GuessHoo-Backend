import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, RedisClientType } from "redis";


const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({ connectionString })

const globalForPrisma = global as unknown as { prisma?: PrismaClient };


export const prisma = globalForPrisma.prisma ?? new PrismaClient({adapter});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;


let redisClient: RedisClientType;

export const getRedisClient = async () => {
  if (!redisClient) {
    redisClient = createClient();
    redisClient.on("error", (err: any) => {
      console.error("Redis Client Error", err);
    });
    await redisClient.connect();
  }
  return redisClient;
};
