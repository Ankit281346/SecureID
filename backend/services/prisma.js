const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

let dbUrl = process.env.DATABASE_URL;

// On Vercel / Serverless environments, copy SQLite DB to writable /tmp directory
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const tmpDbPath = path.join('/tmp', 'dev.db');
  const bundledDbPath = path.join(process.cwd(), 'prisma', 'dev.db');

  if (!fs.existsSync(tmpDbPath)) {
    if (fs.existsSync(bundledDbPath)) {
      try {
        fs.copyFileSync(bundledDbPath, tmpDbPath);
      } catch (err) {
        console.error('Failed to copy bundled db to /tmp:', err);
      }
    }
  }
  dbUrl = `file:${tmpDbPath}`;
}

const prisma = new PrismaClient(
  dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined
);

module.exports = prisma;
