import { useState } from "react";
import { codigoTopico, type OrganizacaoPrograma, type TopicoPrograma } from "./cursoPrograma";
import type { CursoAccent } from "./CursoFichaView";

export type PecaMoodleTipo = "texto" | "recurso" | "atividade";

export type PecaMoodle = {
  id: string;
  tipo: PecaMoodleTipo;
  titulo: string;
  detalhe: string;
};

export type ConteudoMoodle = {
  moduloId: string;
  introducao: string;
  pecas: PecaMoodle[];
};

const TIPOS: { id: PecaMoodleTipo; nome: string; detalhe: string }[] = [
  { id: "texto", nome: "Texto", detalhe: "O que o formando lê neste ponto" },
  { id: "recurso", nome: "Recurso", detalhe: "Endereço do ficheiro, vídeo ou página" },
  { id: "atividade", nome: "Atividade", detalhe: "O que o formando tem de fazer" },
];

function idPeca() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function parseConteudosMoodle(raw: unknown): ConteudoMoodle[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as { moduloId?: unknown; introducao?: unknown; pecas?: unknown };
    const moduloId = String(row.moduloId ?? "").slice(0, 80);
    if (!moduloId) return [];
    const pecas = Array.isArray(row.pecas) ? row.pecas.flatMap(peca => {
      if (!peca || typeof peca !== "object") return [];
      const p = peca as { id?: unknown; tipo?: unknown; titulo?: unknown; detalhe?: unknown };
      const tipo: PecaMoodleTipo = p.tipo === "recurso" || p.tipo === "atividade" ? p.tipo : "texto";
      return [{
        id: String(p.id ?? idPeca()).slice(0, 40),
        tipo,
        titulo: String(p.titulo ?? "").slice(0, 200),
        detalhe: String(p.detalhe ?? "").slice(0, 4000),
      }];
    }).slice(0, 40) : [];
    return [{ moduloId, introducao: String(row.introducao ?? "").slice(0, 4000), pecas }];
  }).slice(0, 80);
}

export function ConteudosMoodle({
  accent, organizacao, modulos, conteudos, inputCls, onChange, onIrPrograma,
}: {
  accent: CursoAccent;
  organizacao: OrganizacaoPrograma;
  modulos: TopicoPrograma[];
  conteudos: ConteudoMoodle[];
  inputCls: string;
  onChange: (conteudos: ConteudoMoodle[]) => void;
  onIrPrograma: () => void;
}) {
  const [activo, setActivo] = useState(0);
  const indice = Math.min(activo, Math.max(0, modulos.length - 1));
  const modulo = modulos[indice];
  const tom = accent === "fin" ? "text-blue-700" : "text-amber-700";
  const fundo = accent === "fin" ? "bg-blue-50" : "bg-amber-50";

  function doModulo(id: string): ConteudoMoodle {
    return conteudos.find(item => item.moduloId === id) ?? { moduloId: id, introducao: "", pecas: [] };
  }

  function gravar(id: string, seguinte: ConteudoMoodle) {
    const outros = conteudos.filter(item => item.moduloId !== id);
    const vazio = !seguinte.introducao.trim() && seguinte.pecas.length === 0;
    onChange(vazio ? outros : [...outros, seguinte]);
  }

  if (!modulo) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-semibold text-slate-700">Este curso ainda não tem módulos.</p>
        <p className="mt-1 text-xs text-slate-500">Os conteúdos Moodle acompanham cada módulo do programa.</p>
        <button type="button" onClick={onIrPrograma} className="mt-4 text-sm font-semibold text-[#1C3350] underline">Definir o programa</button>
      </div>
    );
  }

  const conteudo = doModulo(modulo.id);
  const codigo = codigoTopico(organizacao, indice);

  function mudarIntroducao(introducao: string) {
    gravar(modulo.id, { ...conteudo, introducao });
  }

  function mudarPeca(id: string, patch: Partial<PecaMoodle>) {
    gravar(modulo.id, {
      ...conteudo,
      pecas: conteudo.pecas.map(peca => peca.id === id ? { ...peca, ...patch } : peca),
    });
  }

  function acrescentar(tipo: PecaMoodleTipo) {
    if (conteudo.pecas.length >= 40) return;
    gravar(modulo.id, { ...conteudo, pecas: [...conteudo.pecas, { id: idPeca(), tipo, titulo: "", detalhe: "" }] });
  }

  function remover(id: string) {
    gravar(modulo.id, { ...conteudo, pecas: conteudo.pecas.filter(peca => peca.id !== id) });
  }

  function mover(id: string, direcao: -1 | 1) {
    const pecas = [...conteudo.pecas];
    const i = pecas.findIndex(peca => peca.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= pecas.length) return;
    const [peca] = pecas.splice(i, 1);
    pecas.splice(j, 0, peca);
    gravar(modulo.id, { ...conteudo, pecas });
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ol className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {modulos.map((item, i) => {
          const cheio = Boolean(doModulo(item.id).introducao.trim() || doModulo(item.id).pecas.length);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActivo(i)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left ${i === indice ? fundo : "hover:bg-slate-50"}`}
              >
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-[11px] font-bold ${tom}`}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{codigoTopico(organizacao, i)}{item.horas ? ` · ${item.horas}` : ""}</span>
                  <span className="block truncate text-sm font-semibold text-slate-800">{item.titulo.trim() || "Módulo sem título"}</span>
                </span>
                {cheio && <span className="ml-auto mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Com conteúdo" />}
              </button>
            </li>
          );
        })}
      </ol>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-wide ${tom}`}>{codigo}{modulo.horas ? ` · ${modulo.horas}` : ""}</p>
          <h2 className="mt-1 text-lg font-bold text-slate-800">{modulo.titulo.trim() || "Módulo sem título"}</h2>
          <p className="mt-1 text-xs text-slate-500">O título e as horas vêm do programa. Este texto fica na ficha do curso e não é enviado para o Moodle.</p>
        </div>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Introdução</span>
          <textarea className={`${inputCls} mt-1.5 min-h-24`} value={conteudo.introducao} onChange={e => mudarIntroducao(e.target.value)} placeholder="O texto que abre o módulo." />
        </label>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conteúdos</p>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map(tipo => (
                <button key={tipo.id} type="button" onClick={() => acrescentar(tipo.id)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">+ {tipo.nome}</button>
              ))}
            </div>
          </div>
          {conteudo.pecas.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">Este módulo ainda não tem textos, recursos nem atividades.</p>
          )}
          {conteudo.pecas.map((peca, i) => {
            const meta = TIPOS.find(tipo => tipo.id === peca.tipo) ?? TIPOS[0];
            return (
              <article key={peca.id} className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1">
                    {TIPOS.map(tipo => (
                      <button key={tipo.id} type="button" onClick={() => mudarPeca(peca.id, { tipo: tipo.id })} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${peca.tipo === tipo.id ? "bg-[#1C3350] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{tipo.nome}</button>
                    ))}
                  </div>
                  <div className="ml-auto flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => mover(peca.id, -1)} className="px-2 py-1 text-xs font-semibold text-slate-500 disabled:opacity-30">↑</button>
                    <button type="button" disabled={i === conteudo.pecas.length - 1} onClick={() => mover(peca.id, 1)} className="px-2 py-1 text-xs font-semibold text-slate-500 disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => remover(peca.id)} className="px-2 py-1 text-xs font-semibold text-slate-400 hover:text-red-600">Remover</button>
                  </div>
                </div>
                <input className={inputCls} value={peca.titulo} onChange={e => mudarPeca(peca.id, { titulo: e.target.value })} placeholder={`Título do ${meta.nome.toLowerCase()}`} />
                {peca.tipo === "recurso" ? (
                  <input className={inputCls} value={peca.detalhe} onChange={e => mudarPeca(peca.id, { detalhe: e.target.value })} placeholder={meta.detalhe} />
                ) : (
                  <textarea className={`${inputCls} min-h-20`} value={peca.detalhe} onChange={e => mudarPeca(peca.id, { detalhe: e.target.value })} placeholder={meta.detalhe} />
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
