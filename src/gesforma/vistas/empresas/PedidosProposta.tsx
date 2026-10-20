// Gestão › Empresas / Business › Pedidos de proposta: o que chega pelos formulários do site, com estado para não se perder.
import { useState } from "react";
import { apiEstadoPedido, apiPedidosProposta, type EstadoPedido } from "../../../partilhado/api/site";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Botao, Cartao, ErroCarregar, Esqueleto, Estado, Separadores } from "../../../partilhado/ui";
import { fmtDataHoraLisboa } from "../../../partilhado/horaLisboa";

const ROTULO: Record<EstadoPedido, string> = { novo: "Novo", contactado: "Contactado", proposta: "Proposta enviada", arquivado: "Arquivado" };
const TOM: Record<EstadoPedido, "aviso" | "info" | "sucesso" | "neutro"> = { novo: "aviso", contactado: "info", proposta: "sucesso", arquivado: "neutro" };
const SEGUINTE: Partial<Record<EstadoPedido, EstadoPedido>> = { novo: "contactado", contactado: "proposta" };

export function PedidosProposta() {
  const [filtro, setFiltro] = useState<EstadoPedido | "">("novo");
  const { dados, erro, recarregar } = useRecurso(`pedidos-proposta:${filtro}`, s => apiPedidosProposta(filtro || undefined, s));
  const mudar = useAccao((p: { id: number; estado: EstadoPedido }) => apiEstadoPedido(p.id, p.estado), { ok: "Pedido atualizado.", invalidar: ["pedidos-proposta:"] });
  return (
    <div className="flex flex-col gap-3">
      <Separadores<EstadoPedido | ""> rotulo="Estado dos pedidos" estilo="pilula" ativo={filtro} onMudar={setFiltro}
        itens={[{ id: "novo", rotulo: "Novos" }, { id: "contactado", rotulo: "Contactados" }, { id: "proposta", rotulo: "Proposta enviada" }, { id: "arquivado", rotulo: "Arquivados" }, { id: "", rotulo: "Todos" }]} />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : !dados ? <Esqueleto linhas={4} /> : dados.pedidos.length === 0 ? (
        <Cartao><p className="m-0 text-sm text-tinta-suave">Sem pedidos {filtro ? `«${ROTULO[filtro].toLowerCase()}»` : ""}.</p></Cartao>
      ) : dados.pedidos.map(p => (
        <Cartao key={p.id}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Estado tom={TOM[p.estado]} ponto>{ROTULO[p.estado]}</Estado>
              <strong>{p.empresa || p.nome}</strong>
              {p.empresa && <span>· {p.nome}</span>}
              <span className="ml-auto text-tinta-suave">{fmtDataHoraLisboa(p.criadoEm)}</span>
            </div>
            <p className="m-0 flex flex-wrap gap-x-4 text-sm">
              <a className="underline" href={`mailto:${p.email}`}>{p.email}</a>
              {p.telefone && <a className="underline" href={`tel:${p.telefone.replace(/[^\d+]/g, "")}`}>{p.telefone}</a>}
              {p.servico && <span className="text-tinta-suave">Serviço: {p.servico}</span>}
            </p>
            {p.mensagem && <p className="m-0 whitespace-pre-line text-sm">{p.mensagem}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {p.estado !== "arquivado" && <Botao variante="fantasma" aCarregar={mudar.aCorrer} onClick={() => void mudar.correr({ id: p.id, estado: "arquivado" })}>Arquivar</Botao>}
              {p.estado === "arquivado" && <Botao aCarregar={mudar.aCorrer} onClick={() => void mudar.correr({ id: p.id, estado: "novo" })}>Reabrir</Botao>}
              {SEGUINTE[p.estado] && (
                <Botao variante="primario" aCarregar={mudar.aCorrer} onClick={() => void mudar.correr({ id: p.id, estado: SEGUINTE[p.estado]! })}>
                  Marcar como {ROTULO[SEGUINTE[p.estado]!].toLowerCase()}
                </Botao>
              )}
            </div>
          </div>
        </Cartao>
      ))}
    </div>
  );
}
