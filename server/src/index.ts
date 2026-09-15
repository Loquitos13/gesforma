import "./env.js";
import { assertSecureConfig, config } from "./config.js";
import { createDb } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import { buildApp } from "./app.js";

assertSecureConfig();

const db = await createDb();
await migrate(db);
await seed(db);

const app = await buildApp(db);
const shutdown = async (signal: string) => {
  app.log.info({ signal }, "a encerrar");
  await app.close();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });

await app.listen({ port: config.port, host: config.host });
app.log.info({ port: config.port, driver: db.driver, origin: config.appOrigin }, "GesForma API pronta");
