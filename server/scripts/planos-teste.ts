/**
 * Planos de sessão de TESTE na ficha de um curso Gold: completa a ficha até N planos (por omissão 10) com planos
 * marcados «[Teste]», sem mexer nos que já existem, e leva-os às turmas abertas do curso (como gravar a ficha).
 *
 * Corre dentro do contentor da API:
 *   docker compose exec api npx tsx scripts/planos-teste.ts ["Nome do curso"] [N]
 * Sem curso, usa «Formação de Formadores - CCP». Para tirar: ficha do curso › Planos de sessão › Remover.
 */
import "../src/env.js";
import { createDb } from "../src/db/pool.js";
import { importarParaTurmasDoCurso } from "../src/planosCurso.js";
import { cursoPorNome } from "../src/repos/leadDocs.js";
import { gravarFicha, lerFicha } from "../src/repos/cursos.js";

const db = await createDb();
const [cursoArg, totalArg] = process.argv.slice(2);
const nome = cursoArg || "Formação de Formadores - CCP";
const total = Math.min(60, Math.max(1, Number(totalArg) || 10));

const curso = await cursoPorNome(db, "gold", nome);
if (!curso) throw new Error(`Curso Gold «${nome}» não encontrado.`);
const payload = { ...((await lerFicha(db, "gold", curso.id))?.payload as Record<string, unknown> | undefined ?? {}) };
const existentes = Array.isArray(payload.planosSessao) ? payload.planosSessao as { ordem?: number }[] : [];
const ocupadas = new Set(existentes.map(p => Number(p.ordem)));

const momento = (conteudo: string, atividades: string, metodos: string, tempo: string) =>
  ({ conteudo, atividades, metodos, avaliacao: "Observação direta", recursos: "Computador e projetor", materiais: "Manual do formando", tempo });
const novos = [];
for (let n = 1; n <= total; n++) {
  if (ocupadas.has(n)) continue;
  novos.push({
    ordem: n,
    modulo: "",
    objetivosGerais: `[Teste] Sessão ${n}: compreender os conteúdos previstos para esta sessão do curso.`,
    objetivosEspecificos: `[Teste] No final da sessão ${n}, o formando deverá identificar e aplicar os conceitos trabalhados.`,
    momentos: {
      introducao: momento(`Apresentação dos objetivos da sessão ${n}`, "Diálogo com o grupo", "Expositivo", "15 min"),
      desenvolvimento: momento(`Conteúdos da sessão ${n}`, "Exercícios práticos em pequenos grupos", "Ativo / demonstrativo", "3 h"),
      conclusao: momento(`Síntese da sessão ${n}`, "Resumo e esclarecimento de dúvidas", "Interrogativo", "15 min"),
    },
    sumario: { conteudos: `[Teste] Sumário padrão da sessão ${n}.`, atividades: "Exercícios práticos e síntese final." },
  });
}
// Cópia de segurança dos planos que já existem (para repor à mão, se for preciso), antes de gravar.
console.log(`Cópia dos ${existentes.length} planos existentes:`);
console.log(JSON.stringify(existentes));
// Os existentes ficam exatamente como estão (mesma ordem e conteúdo); os novos só ocupam números livres.
const planosSessao = [...existentes, ...novos];
await gravarFicha(db, "gold", curso.id, { ...payload, planosSessao }, null);
const gravados = ((await lerFicha(db, "gold", curso.id))?.payload as { planosSessao?: unknown[] } | undefined)?.planosSessao ?? [];
const intactos = existentes.every((p, i) => JSON.stringify(gravados[i]) === JSON.stringify(p));
if (!intactos || gravados.length !== existentes.length + novos.length) {
  // Nunca deve acontecer: repõe a ficha como estava e pára.
  await gravarFicha(db, "gold", curso.id, payload, null);
  throw new Error("Os planos existentes não ficaram iguais: a ficha foi reposta como estava e nada mudou.");
}
const levados = await importarParaTurmasDoCurso(db, "gold", curso.id);
console.log(`${nome}: ${existentes.length} planos já existiam, ${novos.length} de teste acrescentados (ordens ${novos.map(p => p.ordem).join(", ") || "nenhuma"}).`);
console.log(`Planos e sumários levados às turmas abertas do curso: ${levados}.`);
await db.close();
process.exit(0);
