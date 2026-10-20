/** Dados do relatório final da acção (Financiada), montados a partir dos repositórios. */
import type { Db } from "../db/pool.js";
import { lerEntidade } from "../regrasConfig.js";
import { resultadosDaTurma } from "../resultados.js";
import type { FormandoRelatorio, InqueritoRelatorio, RelatorioFinalDados } from "../relatorioFinal.js";
import {
  certificadosFin, fichaCursoFinPorNome, formandosFinParaRelatorio, notasFin, sessoesFinParaRelatorio, turmaFinParaRelatorio,
} from "../repos/pedagogiaRelatorio.js";
import { respostasDaTurma } from "../repos/inqueritos.js";
import { resumirPerguntas } from "./inqueritos.js";
import { asArr, asObj, horasDaSessao, linhasDe } from "./util.js";

function media(lista: number[]) {
  return lista.length ? Math.round((lista.reduce((s, n) => s + n, 0) / lista.length) * 100) / 100 : null;
}

export async function dadosRelatorioFinal(db: Db, turmaId: number): Promise<RelatorioFinalDados | null> {
  const row = await turmaFinParaRelatorio(db, turmaId);
  if (!row) return null;
  const sessoes = asArr(row.cronograma).map(asObj).map(s => ({
    data: String(s.data ?? ""),
    horaInicio: String(s.horaInicio ?? ""),
    horaFim: String(s.horaFim ?? ""),
    modalidade: String(s.modalidade ?? ""),
  }));
  const somaSessoes = sessoes.map(horasDaSessao).reduce((s, n) => s + n, 0);
  const duracao = somaSessoes > 0 ? somaSessoes : Number(row.horas) || 0;
  const datas = sessoes.map(s => s.data).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const [sessoesRows, formandosRows, notasRows, certRows, ficha, respostas] = await Promise.all([
    sessoesFinParaRelatorio(db, turmaId),
    formandosFinParaRelatorio(db, turmaId, row.nome),
    notasFin(db, turmaId),
    certificadosFin(db, turmaId),
    fichaCursoFinPorNome(db, row.curso),
    respostasDaTurma(db, "fin", turmaId, row.nome),
  ]);
  const notas = new Map<number, number[]>();
  for (const nota of notasRows) {
    const lista = notas.get(nota.formando_id) ?? [];
    if (Number.isFinite(Number(nota.nota))) lista.push(Number(nota.nota));
    notas.set(nota.formando_id, lista);
  }
  const certs = new Map(certRows.map(c => [c.formando_id, c]));
  // Horas e nota vêm do cálculo único do servidor (sessão n ↔ sessão lectiva n do cronograma, por id do formando).
  const resultados = await resultadosDaTurma(db, "fin", turmaId);
  const porId = new Map((resultados?.formandos ?? []).map(r => [r.id, r]));
  const formandos: FormandoRelatorio[] = formandosRows.map(f => {
    const r = porId.get(Number(f.id));
    const notaCert = certs.get(f.id)?.nota;
    const nota = r?.nota ?? media(notas.get(f.id) ?? [])
      ?? (notaCert == null || !Number.isFinite(Number(notaCert)) ? null : Number(notaCert));
    return {
      nome: `${f.nome} ${f.apelido}`.trim(),
      estado: f.estado,
      presencasHoras: r?.assiduidade.horasPresente ?? 0,
      faltasHoras: r ? r.assiduidade.horasFaltaJustificada + r.assiduidade.horasFaltaInjustificada : 0,
      nota,
      certificado: Boolean(certs.get(f.id)?.ficheiro_id),
    };
  });
  const payload = asObj(ficha?.payload);
  const topicos = asArr(payload.topicosPrograma).map(item => {
    const t = asObj(item);
    const titulo = String(t.titulo ?? t.nome ?? "").trim();
    const horas = String(t.horas ?? "").trim();
    return titulo ? (horas ? `${titulo} (${horas})` : titulo) : "";
  }).filter(Boolean);
  const porInquerito = new Map<string, { titulo: string; publico: string; perguntas: unknown[]; respostas: Record<string, unknown>[] }>();
  for (const r of respostas) {
    const chave = String(r.id);
    const actual = porInquerito.get(chave) ?? { titulo: r.titulo || "Inquérito", publico: r.publico || "formando", perguntas: asArr(r.perguntas), respostas: [] };
    actual.respostas.push(asObj(r.respostas));
    porInquerito.set(chave, actual);
  }
  const inqueritos: InqueritoRelatorio[] = [...porInquerito.values()].map(inq => {
    const perguntas = inq.perguntas.map(raw => {
      const p = asObj(raw);
      return { id: Number(p.id) || 0, tipo: String(p.tipo ?? "texto"), texto: String(p.texto ?? "Pergunta"), opcoes: asArr(p.opcoes).map(String) };
    });
    return {
      titulo: inq.titulo,
      publico: inq.publico,
      respostas: inq.respostas.length,
      perguntas: resumirPerguntas(perguntas, inq.respostas, 8).map(r => ({
        texto: r.texto || "Pergunta",
        tipo: r.tipo,
        media: r.media,
        n: r.n,
        pctSim: r.pctSim,
        contagens: r.tipo === "multipla" ? Object.fromEntries(Object.entries(r.contagens).filter(([, n]) => n > 0)) : {},
        textos: r.textos,
      })),
    };
  });
  const formadores = asArr(row.formadores).map(String).map(s => s.trim()).filter(Boolean);
  const ocorrencias = sessoesRows.map(s => String(asObj(s.sumario).observacoes ?? "").trim()).filter(Boolean);
  return {
    curso: row.curso,
    acao: row.nome,
    area: String(payload.categoria ?? "").trim(),
    local: row.local,
    duracaoHoras: Math.round(duracao * 100) / 100,
    inicio: datas[0] || row.data_inicio,
    fim: datas[datas.length - 1] || row.data_inicio,
    formador: formadores.join(", ") || row.formador,
    horario: row.horario,
    objetivos: linhasDe(payload.objetivos),
    programa: topicos.length ? topicos : linhasDe(payload.programa),
    inscritos: formandos.length,
    desistentes: formandos.filter(f => /desist/i.test(f.estado)),
    formandos,
    certificados: formandos.filter(f => f.certificado).length,
    inqueritos,
    ocorrencias,
    entidade: (await lerEntidade(db)).nome,
  };
}
