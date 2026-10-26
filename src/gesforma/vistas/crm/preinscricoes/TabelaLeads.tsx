import type { ReactNode } from "react";
import { MenuLinha, Tabela, eur, type Coluna, type Tom } from "../../../../partilhado/ui";
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

const COR_TOM: Record<Tom, string> = { neutro: "text-tinta-suave", info: "text-ligacao", sucesso: "text-sucesso", aviso: "text-aviso", perigo: "text-perigo", acao: "text-acao-texto" } as Record<Tom, string>;
const BARRA_TOM: Record<Tom, string> = { neutro: "bg-linha-forte", info: "bg-ligacao", sucesso: "bg-sucesso", aviso: "bg-acao", perigo: "bg-perigo", acao: "bg-acao" } as Record<Tom, string>;

/** Lista de pré-inscrições: pessoa, curso, etapa, documentos, próximo passo, seguimento e comercial. */
export function TabelaLeads(p: Props) {
  const colunas: Coluna<Lead>[] = [
    {
      id: "nome", titulo: "Pessoa", ordenavel: true, principal: true,
      celula: l => (
        <div className="min-w-0">
          <button type="button" onClick={e => { e.stopPropagation(); p.onAbrir(l); }} className="text-left font-semibold text-tinta hover:underline">
            {nomeCompleto(l) || `Pré-inscrição #${l.id}`}
          </button>
          {l.telf && (
            <a href={`tel:${l.telf.replace(/\s+/g, "")}`} onClick={e => { e.stopPropagation(); p.onContacto(l, "Telefone"); }}
              className="block text-xs font-semibold text-tinta num hover:underline" title="Ligar (fica registado como contacto)">{l.telf}</a>
          )}
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
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] ${COR_TOM[tomEtapa(l.estado)]}`}><span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-current" />{rotuloEtapa(l.estado)}</span>
          {l.secretariaEm && l.estado === "Pré-inscrição" && <span className="text-[11px] font-semibold text-ligacao">Na secretaria</span>}
        </div>
      ),
    },
    {
      id: "docs", titulo: "Documentos", esconderMovel: true,
      celula: l => {
        const d = textoDocs(l);
        const env = l.docsEnviados ?? 0;
        const pct = env ? Math.round(((l.docsValidados ?? 0) / env) * 100) : 0;
        return (
          <div>
            <p className="num m-0 mb-1.5 whitespace-nowrap text-xs text-tinta-suave">{d.texto}</p>
            <div className="relative h-[5px] w-[90px] rounded-full bg-linha-suave" aria-hidden="true">
              <span className={`absolute inset-y-0 left-0 rounded-full ${BARRA_TOM[d.tom]}`} style={{ width: `${env ? Math.max(pct, 6) : 0}%` }} />
            </div>
          </div>
        );
      },
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
        ? <span title={l.comercialNome} className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-linha-suave text-[11px] font-semibold text-tinta">{iniciais(l.comercialNome)}</span>
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
          <MenuLinha
            rotulo={`Acções de ${nomeCompleto(l) || "pré-inscrição"}`}
            acoes={[
              ...(l.telf ? [{ rotulo: "Ligar", onClick: () => { p.onContacto(l, "Telefone"); window.location.href = `tel:${l.telf}`; } }] : []),
              ...(wa ? [{ rotulo: "WhatsApp", onClick: () => { p.onContacto(l, "WhatsApp"); window.open(`https://wa.me/${wa}`, "_blank", "noopener"); } }] : []),
              { rotulo: "Editar", onClick: () => p.onEditar(l) },
              ...(p.onApagar ? [{ rotulo: "Eliminar", perigo: true, onClick: () => p.onApagar!(l) }] : []),
            ]}
          />
        );
      }}
    />
  );
}
