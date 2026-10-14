import type { ReactNode } from "react";
import { Botao, Estado, Tabela, eur, type Coluna } from "../../../../partilhado/ui";
import type { Lead } from "../../../../partilhado/api/crm";
import { iniciais, nomeCompleto, proximoPasso, quando, rotuloEtapa, seguimento, telWhatsapp, textoDocs, tomEtapa } from "./util";

type Props = {
  linhas: Lead[];
  aCarregar: boolean;
  hoje: string;
  ordem: string;
  onOrdenar: (ordem: string) => void;
  selecionados: Set<number>;
  onSelecionar: (s: Set<number>) => void;
  ativo: number | null;
  onAbrir: (l: Lead) => void;
  onContacto: (l: Lead, canal: "Telefone" | "WhatsApp") => void;
  onEditar: (l: Lead) => void;
  onApagar?: (l: Lead) => void;
  vazio: ReactNode;
};

/** Lista de pré-inscrições: pessoa, curso, etapa, documentos, próximo passo, seguimento e comercial. */
export function TabelaLeads(p: Props) {
  const colunas: Coluna<Lead>[] = [
    {
      id: "nome", titulo: "Pessoa", ordenavel: true, principal: true,
      celula: l => (
        <div className="min-w-0">
          <button type="button" onClick={e => { e.stopPropagation(); p.onAbrir(l); }} className="text-left font-semibold text-ligacao hover:underline">
            {nomeCompleto(l) || `Pré-inscrição #${l.id}`}
          </button>
          <p className="m-0 text-xs text-tinta-suave truncate max-w-[260px]">
            {l.entrada === "manual" ? "Manual" : "Site"} · {quando(l.inscrito)}{l.origem ? ` · conheceu por ${l.origem}` : ""}
          </p>
          {l.etiquetaNome && (
            <span className="inline-flex mt-1 items-center gap-1 text-[11px] font-semibold" style={{ color: l.etiquetaCor || undefined }}>
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: l.etiquetaCor || "#64748b" }} />{l.etiquetaNome}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "curso", titulo: "Curso", ordenavel: true,
      celula: l => (
        <div className="min-w-0 max-w-[240px]">
          <p className="m-0 truncate" title={l.curso}>{l.curso || "—"}</p>
          <p className="m-0 text-xs text-tinta-suave truncate">
            {[l.local, l.horario].filter(Boolean).join(" · ") || "Turma por definir"}{l.preco ? ` · ${eur(l.preco)}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "estado", titulo: "Etapa", ordenavel: true,
      celula: l => (
        <div className="flex flex-col items-start gap-1">
          <Estado tom={tomEtapa(l.estado)} ponto>{rotuloEtapa(l.estado)}</Estado>
          {l.secretariaEm && l.estado === "Pré-inscrição" && <span className="text-[11px] font-semibold text-ligacao">Na secretaria</span>}
        </div>
      ),
    },
    {
      id: "docs", titulo: "Documentos", esconderMovel: true,
      celula: l => { const d = textoDocs(l); return <Estado tom={d.tom}>{d.texto}</Estado>; },
    },
    {
      id: "passo", titulo: "Próximo passo",
      celula: l => {
        const s = seguimento(l, p.hoje);
        const passo = proximoPasso(l);
        return (
          <div className="min-w-0 max-w-[220px]">
            <p className="m-0 text-[13px]">{passo.texto}</p>
            {s.texto && <p className={`m-0 text-xs ${s.atrasado ? "font-semibold text-perigo" : "text-tinta-suave"}`}>{s.texto}</p>}
          </div>
        );
      },
    },
    {
      id: "comercial", titulo: "Comercial", ordenavel: true, esconderMovel: true,
      celula: l => l.comercialNome
        ? <span title={l.comercialNome} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ligacao-suave text-[11px] font-semibold text-ligacao">{iniciais(l.comercialNome)}</span>
        : <span className="text-xs text-tinta-fraca">Sem dono</span>,
    },
  ];

  return (
    <Tabela
      rotulo="Pré-inscrições"
      linhas={p.linhas}
      colunas={colunas}
      chave={l => l.id}
      ordem={p.ordem}
      onOrdenar={p.onOrdenar}
      selecao={{ selecionados: p.selecionados as Set<string | number>, onMudar: s => p.onSelecionar(new Set([...s].map(Number))) }}
      onLinha={p.onAbrir}
      linhaAtiva={p.ativo}
      aCarregar={p.aCarregar}
      vazio={p.vazio}
      alturaMax="min(70vh, 760px)"
      acoesLinha={l => {
        const wa = telWhatsapp(l.telf);
        return (
          <div className="flex items-center justify-end gap-1">
            {l.telf && (
              <a href={`tel:${l.telf}`} onClick={e => { e.stopPropagation(); p.onContacto(l, "Telefone"); }}
                className="inline-flex h-8 items-center rounded-controlo px-2 text-[13px] text-tinta-suave hover:bg-linha-suave hover:text-tinta">Ligar</a>
            )}
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" onClick={e => { e.stopPropagation(); p.onContacto(l, "WhatsApp"); }}
                className="inline-flex h-8 items-center rounded-controlo px-2 text-[13px] text-tinta-suave hover:bg-linha-suave hover:text-tinta">WhatsApp</a>
            )}
            <Botao variante="fantasma" tamanho="sm" onClick={e => { e.stopPropagation(); p.onEditar(l); }}>Editar</Botao>
            {p.onApagar && (
              <Botao variante="fantasma" tamanho="sm" className="text-perigo" onClick={e => { e.stopPropagation(); p.onApagar!(l); }}>Eliminar</Botao>
            )}
          </div>
        );
      }}
    />
  );
}
