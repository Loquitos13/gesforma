import { useState } from "react";
import { Botao, Selecao, type OpcaoSelecao } from "../../../../partilhado/ui";
import { apiLote, type AccaoLote, type Etiqueta } from "../../../../partilhado/api/crm";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { ETAPAS, rotuloEtapa } from "./util";

/** Acções em lote sobre as pré-inscrições seleccionadas. */
export function BarraLote({ ids, comerciais, etiquetas, onLimpar }: {
  ids: number[];
  comerciais: OpcaoSelecao[];
  etiquetas: Etiqueta[];
  onLimpar: () => void;
}) {
  const [etapa, setEtapa] = useState("2º Contacto");
  const [data, setData] = useState("");
  const [comercial, setComercial] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [motivo, setMotivo] = useState("");
  const motivos = useOpcoes("lista", { lista: "motivos_desistencia" });
  const lote = useAccao(apiLote, { ok: r => `${r.updated} pré-inscrições actualizadas.`, invalidar: ["crm:"] });

  async function correr(a: Omit<AccaoLote, "ids">) {
    const r = await lote.correr({ ids, ...a });
    if (r) onLimpar();
  }

  return (
    <div role="region" aria-label="Acções em lote" className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-cartao border border-acao/40 bg-acao-suave px-3 py-2">
      <span className="num text-[13px] font-semibold">{ids.length} seleccionada{ids.length === 1 ? "" : "s"}</span>
      <Botao tamanho="sm" variante="secundario" aCarregar={lote.aCorrer} onClick={() => void correr({ acao: "contactar" })}>Marcar contactadas</Botao>
      <span className="inline-flex items-center gap-1">
        <label className="sr-only" htmlFor="lote-etapa">Etapa</label>
        <Selecao id="lote-etapa" className="h-8 w-40" value={etapa} onChange={e => setEtapa(e.target.value)}
          opcoes={ETAPAS.filter(e => e !== "Formando" && e !== "Pago").map(e => ({ valor: e, rotulo: rotuloEtapa(e) }))} />
        {etapa === "Desistiu" && (
          <>
            <label className="sr-only" htmlFor="lote-motivo">Motivo da desistência</label>
            <Selecao id="lote-motivo" className="h-8 w-40" value={motivo} onChange={e => setMotivo(e.target.value)} opcoes={motivos.selecao} vazio="Motivo…" />
          </>
        )}
        <Botao tamanho="sm" variante="secundario" disabled={etapa === "Desistiu" && !motivo}
          onClick={() => void correr({ acao: "estado", estado: etapa, ...(etapa === "Desistiu" ? { motivoDesistencia: motivo } : {}) })}>Mudar etapa</Botao>
      </span>
      <span className="inline-flex items-center gap-1">
        <label className="sr-only" htmlFor="lote-data">Próximo contacto</label>
        <input id="lote-data" type="datetime-local" value={data} onChange={e => setData(e.target.value)}
          className="h-8 rounded-controlo border border-linha-forte bg-superficie px-2 text-[13px]" />
        <Botao tamanho="sm" variante="secundario" disabled={!data}
          onClick={() => void correr({ acao: "seguimento", proximoContacto: data.replace("T", " ").slice(0, 16) })}>Agendar</Botao>
      </span>
      <Botao tamanho="sm" variante="secundario" onClick={() => void correr({ acao: "adiar", dias: 2 })}>Adiar 2 dias</Botao>
      <span className="inline-flex items-center gap-1">
        <label className="sr-only" htmlFor="lote-comercial">Comercial</label>
        <Selecao id="lote-comercial" className="h-8 w-44" value={comercial} onChange={e => setComercial(e.target.value)} opcoes={comerciais} vazio="Comercial…" />
        <Botao tamanho="sm" variante="secundario" disabled={!comercial} onClick={() => void correr({ acao: "atribuir", comercialId: comercial })}>Atribuir</Botao>
      </span>
      {etiquetas.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <label className="sr-only" htmlFor="lote-etiqueta">Etiqueta</label>
          <Selecao id="lote-etiqueta" className="h-8 w-40" value={etiqueta} onChange={e => setEtiqueta(e.target.value)}
            opcoes={[{ valor: "0", rotulo: "Sem etiqueta" }, ...etiquetas.map(e => ({ valor: String(e.id), rotulo: e.nome }))]} vazio="Etiqueta…" />
          <Botao tamanho="sm" variante="secundario" disabled={!etiqueta}
            onClick={() => void correr({ acao: "etiqueta", etiquetaId: etiqueta === "0" ? null : Number(etiqueta) })}>Marcar</Botao>
        </span>
      )}
      <Botao tamanho="sm" variante="ligacao" className="ml-auto" onClick={onLimpar}>Limpar selecção</Botao>
    </div>
  );
}
