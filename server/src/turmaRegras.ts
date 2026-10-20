import { modulosDaFicha } from "./programaCurso.js";
import { erroSobreposicao } from "./conflitos.js";
import { generateCronograma } from "./cronograma.js";
import type { Db } from "./db/pool.js";
import { nextOpsId } from "./ops.js";
import { codigoInternoTurma } from "../../src/partilhado/turmaCodigo.js";
import { atualizarRegra, existeNome, existeTurmaIgual, inserirTurmaFin, inserirTurmaGold, listarRegras } from "./repos/turmas.js";
import { hojeLisboa } from "./datas.js";

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

export async function listTurmaRegras(db: Db, regime?: "gold" | "fin") {
  return (await listarRegras(db, regime)).map(r => mapRegra(r));
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
  const conflitos: { regra: number; erro: string }[] = [];
  for (const regra of regras) {
    const inicio = regra.proximaData || hojeLisboa();
    const fin = regra.regime === "fin";
    const horasSessao = fin ? 3 : (regra.horasSessao || 3);
    const modulos = await modulosDaFicha(db, regra.regime, regra.curso);
    const horario = regra.horario || (fin ? "Pós Laboral" : "");
    const horas = regra.horas || (fin ? 25 : 90);
    const cronograma = generateCronograma({
      modulos,
      inicio,
      horario: horario || "Pós Laboral",
      horas,
      formador: regra.formador,
      curso: regra.curso,
      hoursPerSession: horasSessao,
    });
    const nome = codigoTurma(regra, inicio);
    // Uma turma automática não pode pôr o formador em duas sessões ao mesmo tempo.
    const cruzamento = await erroSobreposicao(db, regra.regime, null, cronograma);
    if (cruzamento) {
      conflitos.push({ regra: regra.id, erro: cruzamento });
      continue;
    }
    if (await existeTurmaIgual(db, regra.regime, { curso: regra.curso, local: regra.local, horario: regra.horario, dataInicio: inicio })) continue;
    // Sem nome (regra sem local ou horário) ou com o de outra turma, os formandos ligados pelo nome iam parar a ela.
    if (!nome) {
      conflitos.push({ regra: regra.id, erro: "Sem código para a turma: indique o local e o horário da regra, ou um prefixo." });
      continue;
    }
    if (await existeNome(db, regra.regime, nome, null)) {
      conflitos.push({ regra: regra.id, erro: `Já existe uma turma com o nome «${nome}».` });
      continue;
    }
    const id = await nextOpsId(db);
    if (fin) {
      await inserirTurmaFin(db, id, {
        dataInicio: inicio, nome, curso: regra.curso, ufcdCod: "", local: regra.local, horario, alunosTotal: regra.vagas || 20,
        tolerancia: 0, estado: "A montar", horas, formador: regra.formador, formadores: [], activa: true, cronograma,
        valoresHoraFormador: {}, financiador: "",
      });
    } else {
      await inserirTurmaGold(db, id, {
        dataInicio: inicio, nome, curso: regra.curso, local: regra.local, horario: regra.horario, vagas: regra.vagas || 16,
        tolerancia: 0, estado: "Ativa", formador: regra.formador, formadores: [], horas, cronograma, custoHoraSala: 0,
        valoresHoraFormador: {},
      });
    }
    criadas.push({ id, nome, regime: regra.regime });
    await atualizarRegra(db, regra.id, { proximaData: nextData(inicio) });
  }
  return { criadas, n: criadas.length, conflitos };
}
