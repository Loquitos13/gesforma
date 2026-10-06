import { useEffect, useMemo, useState } from "react";
import { apiCursoFicha, type Regime } from "./api";
import type { SelectOption } from "./FormKit";
import { idCursoPorNome } from "./cursoLocais";
import { useLists } from "./ListsContext";

export type OrganizacaoPrograma = "modular" | "livre";

export type TopicoPrograma = {
  id: string;
  titulo: string;
  horas: string;
};

export function partirHoras(raw: string) {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = /^(\d+)(?:h|:)?(\d{0,2})/.exec(s);
  if (!m) return { horas: "", minutos: "" };
  const minutos = m[2] ? String(Math.min(59, Number(m[2]))).padStart(2, "0") : "";
  return { horas: m[1] ?? "", minutos };
}

export function juntarHoras(horas: string, minutos: string) {
  const h = horas.replace(/\D/g, "");
  if (!h) return "";
  const min = minutos.replace(/\D/g, "");
  if (!min || Number(min) === 0) return `${Number(h)}h`;
  return `${Number(h)}h${String(Math.min(59, Number(min))).padStart(2, "0")}`;
}

export function horasDeTexto(linha: string) {
  const m = linha.match(/(\d+)\s*h(?:\s*(\d{1,2}))?/i);
  if (!m?.[1]) return "";
  return juntarHoras(m[1], m[2] ?? "");
}

export function codigoTopico(organizacao: OrganizacaoPrograma, index: number) {
  return `${organizacao === "livre" ? "C" : "M"}${index + 1}`;
}

export function labelTopico(organizacao: OrganizacaoPrograma, index: number, topico: Pick<TopicoPrograma, "titulo" | "horas">) {
  const titulo = topico.titulo.trim() || (organizacao === "livre" ? "Capítulo" : "Módulo");
  const horas = topico.horas.trim();
  return horas ? `${codigoTopico(organizacao, index)} · ${titulo} · ${horas}` : `${codigoTopico(organizacao, index)} · ${titulo}`;
}

export function novoTopicoId() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Extrai tópicos de um programa em texto (linhas da ficha pública). */
export function topicosDeTexto(texto: string): TopicoPrograma[] {
  const linhas = texto.split(/\n/).map(s => s.trim()).filter(s => s && !s.startsWith("•") && !s.startsWith("-"));
  const out: TopicoPrograma[] = [];
  for (const linha of linhas) {
    const limpa = linha
      .replace(/^(M|C|AV|EX)\s*\d+\s*[·.\-–:]+\s*/i, "")
      .replace(/^\d+\s*[.)\-–]\s*/, "")
      .replace(/\s*[·\-–]\s*\d+\s*h(?:\s*\d{1,2})?\s*(?:min)?\s*$/i, "")
      .trim();
    const horas = horasDeTexto(linha);
    if (!limpa) continue;
    out.push({ id: novoTopicoId(), titulo: limpa, horas });
  }
  return out;
}

export function programaDePayload(payload: Record<string, unknown> | undefined, regime: Regime): {
  organizacao: OrganizacaoPrograma;
  topicos: TopicoPrograma[];
} {
  const organizacao: OrganizacaoPrograma = regime === "fin"
    ? "modular"
    : payload?.organizacaoPrograma === "livre" ? "livre" : "modular";
  const raw = payload?.topicosPrograma;
  if (Array.isArray(raw) && raw.length) {
    const topicos = raw.map((item, i) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        id: String(row.id ?? novoTopicoId()),
        titulo: String(row.titulo ?? row.nome ?? `Tópico ${i + 1}`),
        horas: String(row.horas ?? ""),
      };
    }).filter(t => t.titulo.trim());
    if (topicos.length) return { organizacao, topicos };
  }
  const texto = String(payload?.programa ?? "");
  return { organizacao, topicos: topicosDeTexto(texto) };
}

export function opcoesDoPrograma(organizacao: OrganizacaoPrograma, topicos: TopicoPrograma[]): SelectOption[] {
  return topicos
    .filter(t => t.titulo.trim())
    .map((t, i) => ({
      value: labelTopico(organizacao, i, t),
      sub: t.horas.trim() || undefined,
    }));
}

export function useProgramaDoCurso(regime: Regime, cursoNome: string | undefined) {
  const { cursosGold, cursosFin } = useLists();
  const [organizacao, setOrganizacao] = useState<OrganizacaoPrograma>(regime === "fin" ? "modular" : "modular");
  const [topicos, setTopicos] = useState<TopicoPrograma[]>([]);

  const cursoId = useMemo(
    () => idCursoPorNome(regime, cursoNome, cursosGold, cursosFin),
    [cursoNome, cursosFin, cursosGold, regime],
  );

  useEffect(() => {
    if (cursoId == null) {
      setTopicos([]);
      setOrganizacao(regime === "fin" ? "modular" : "modular");
      return;
    }
    let alive = true;
    apiCursoFicha(regime, cursoId)
      .then(r => {
        if (!alive) return;
        const parsed = programaDePayload(r.ficha?.payload, regime);
        const lista = r.ficha?.payload?.topicosPrograma;
        const estruturados = Array.isArray(lista) && lista.length > 0;
        setOrganizacao(parsed.organizacao);
        setTopicos(estruturados ? parsed.topicos : []);
      })
      .catch(() => {
        if (!alive) return;
        setTopicos([]);
      });
    return () => { alive = false; };
  }, [cursoId, regime]);

  const options = useMemo(() => opcoesDoPrograma(organizacao, topicos), [organizacao, topicos]);
  const labels = useMemo(() => options.map(o => o.value), [options]);
  const unidade = organizacao === "livre" ? { singular: "capítulo", plural: "capítulos" } : { singular: "módulo", plural: "módulos" };

  return { organizacao, topicos, options, labels, unidade };
}
