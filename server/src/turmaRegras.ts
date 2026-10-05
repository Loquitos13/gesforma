import { generateCronograma } from "./cronograma.js";
import type { Db } from "./db/pool.js";
import { nextOpsId } from "./ops.js";
import { codigoInternoTurma } from "../../src/turmaCodigo.js";

export type TurmaRegra = {
  id: number;
  regime: "gold" | "fin";
  curso: string;
  local: string;
  horario: string;
  vagas: number;
  horas: number;
  horasSessao: number;
  formador: string;
  proximaData: string;
  nomePrefixo: string;
  activa: boolean;
};

function mapRegra(r: Record<string, unknown>): TurmaRegra {
  return {
    id: Number(r.id),
    regime: String(r.regime) === "fin" ? "fin" : "gold",
    curso: String(r.curso ?? ""),
    local: String(r.local ?? ""),
    horario: String(r.horario ?? ""),
    vagas: Number(r.vagas ?? 16),
    horas: Number(r.horas ?? 25),
    horasSessao: Number(r.horas_sessao ?? 3),
    formador: String(r.formador ?? ""),
    proximaData: String(r.proxima_data ?? ""),
    nomePrefixo: String(r.nome_prefixo ?? ""),
    activa: r.activa !== false,
  };
}

export async function listTurmaRegras(db: Db, regime?: string) {
  const q = regime
    ? await db.query("SELECT * FROM turma_regras WHERE regime = $1 ORDER BY id", [regime])
    : await db.query("SELECT * FROM turma_regras ORDER BY regime, id");
  return q.rows.map(r => mapRegra(r as Record<string, unknown>));
}

function codigoTurma(regra: TurmaRegra, data: string) {
  const prefix = regra.nomePrefixo.trim();
  if (prefix) return prefix;
  return codigoInternoTurma(regra.curso, regra.local, regra.horario, data);
}

function nextData(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + 28);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export async function aplicarTurmaRegras(db: Db, regime?: "gold" | "fin") {
  const regras = (await listTurmaRegras(db, regime)).filter(r => r.activa);
  const criadas: { id: number; nome: string; regime: string }[] = [];
  for (const regra of regras) {
    const inicio = regra.proximaData || new Date().toISOString().slice(0, 10);
    const horasSessao = regra.regime === "fin" ? 3 : (regra.horasSessao || 3);
    const cronograma = generateCronograma({
      inicio,
      horario: regra.horario || "Pós Laboral",
      horas: regra.horas || (regra.regime === "fin" ? 25 : 90),
      formador: regra.formador,
      curso: regra.curso,
      hoursPerSession: horasSessao,
    });
    const nome = codigoTurma(regra, inicio);
    if (regra.regime === "fin") {
      const exists = await db.query(
        "SELECT id FROM turmas_fin WHERE curso = $1 AND local = $2 AND horario = $3 AND data_inicio = $4 LIMIT 1",
        [regra.curso, regra.local, regra.horario, inicio],
      );
      if (exists.rows[0]) continue;
      const id = await nextOpsId(db);
      await db.query(
        `INSERT INTO turmas_fin (id, data_inicio, nome, curso, ufcd_cod, local, horario, alunos, alunos_total, estado, horas, formador, activa, cronograma)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,'A montar',$9,$10,true,$11::jsonb)`,
        [id, inicio, nome, regra.curso, "", regra.local, regra.horario || "Pós Laboral", regra.vagas || 20, regra.horas || 25, regra.formador, cronograma],
      );
      criadas.push({ id, nome, regime: "fin" });
    } else {
      const exists = await db.query(
        "SELECT id FROM turmas_gold WHERE curso = $1 AND local = $2 AND horario = $3 AND data_inicio = $4 LIMIT 1",
        [regra.curso, regra.local, regra.horario, inicio],
      );
      if (exists.rows[0]) continue;
      const id = await nextOpsId(db);
      await db.query(
        `INSERT INTO turmas_gold (id, data_inicio, nome, curso, local, horario, total_alunos, vagas, estado, formador, horas, cronograma)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,'Ativa',$8,$9,$10::jsonb)`,
        [id, inicio, nome, regra.curso, regra.local, regra.horario, regra.vagas || 16, regra.formador, regra.horas || 90, cronograma],
      );
      criadas.push({ id, nome, regime: "gold" });
    }
    await db.query("UPDATE turma_regras SET proxima_data = $2 WHERE id = $1", [regra.id, nextData(inicio)]);
  }
  return { criadas, n: criadas.length };
}
