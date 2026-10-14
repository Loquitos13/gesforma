// Com TEST_DATABASE_URL, apaga no fim as bases criadas por tests/ambiente.ts.
import postgres from "postgres";

export async function teardown() {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) return;
  const sql = postgres(base, { max: 1, onnotice: () => undefined });
  try {
    const bases = await sql<{ datname: string }[]>`SELECT datname FROM pg_database WHERE datname LIKE 'gesforma_t_%'`;
    for (const { datname } of bases) {
      await sql.unsafe(`DROP DATABASE IF EXISTS ${datname} WITH (FORCE)`).catch(() => undefined);
    }
  } finally {
    await sql.end();
  }
}
