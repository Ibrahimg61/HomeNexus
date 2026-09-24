export function getDatabasePath() {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.startsWith('file:')) {
    return databaseUrl.slice('file:'.length);
  }

  return './prisma/dev.db';
}
