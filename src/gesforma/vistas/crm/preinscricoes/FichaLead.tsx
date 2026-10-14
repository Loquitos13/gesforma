import { useEffect, useState } from "react";
import { Aviso, Botao, ErroCarregar, Esqueleto, Estado, PainelLateral, Separadores, cx } from "../../../../partilhado/ui";
import { apiDossie, apiNota, type DossieLead, type Lead } from "../../../../partilhado/api/crm";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { useAuth } from "../../../../partilhado/AuthGate";
import { toastError } from "../../../../partilhado/toastBus";
import { FichaActividade } from "./FichaActividade";
import { FichaDados } from "./FichaDados";
import { FichaDocumentos } from "./FichaDocumentos";
import { FichaSecretaria } from "./FichaSecretaria";
import { nomeCompleto, proximoPasso, rotuloEtapa, telWhatsapp, tomEtapa } from "./util";

type Aba = "actividade" | "documentos" | "dados" | "secretaria";

/** Passos do percurso, para a linha de progresso no topo da ficha. */
function percurso(d: DossieLead) {
  const l = d.lead;
  const contacto = l.estado !== "Não contactado";
  const docs = d.documentos.length > 0 && d.docsEmFalta.length === 0;
  const passos = [
    { rotulo: "Contacto", feito: contacto },
    { rotulo: "Documentos", feito: docs || Boolean(d.validadaEm) },
    ...(d.estadoPagamento !== "isento" ? [{ rotulo: "Pagamento", feito: d.estadoPagamento === "pago" }] : []),
    { rotulo: "Validação", feito: Boolean(d.validadaEm) },
    { rotulo: "Formando", feito: l.estado === "Formando" },
  ];
  return passos;
}

/** Ficha da pré-inscrição: percurso, próximo passo, contactos e separadores de trabalho. */
export function FichaLead({ id, lista, onFechar, onMudar }: {
  id: number | null;
  lista: Lead[];
  onFechar: () => void;
  onMudar: (id: number) => void;
}) {
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>("actividade");
  const { dados: d, erro, recarregar } = useRecurso(id ? `crm:lead:${id}` : null, signal => apiDossie(id!, signal));
  useEffect(() => { setAba("actividade"); }, [id]);

  const idx = id ? lista.findIndex(l => l.id === id) : -1;
  useEffect(() => {
    if (!id) return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = (e.target as HTMLElement | null)?.tagName;
      if (alvo === "INPUT" || alvo === "TEXTAREA" || alvo === "SELECT") return;
      if (e.key === "ArrowLeft" && idx > 0) onMudar(lista[idx - 1]!.id);
      if (e.key === "ArrowRight" && idx >= 0 && idx < lista.length - 1) onMudar(lista[idx + 1]!.id);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [id, idx, lista, onMudar]);

  /** Depois de qualquer escrita: a ficha e a lista voltam a ler do servidor. */
  function actualizado() {
    invalidar("crm:");
  }

  async function registarContacto(canal: "Telefone" | "WhatsApp" | "Email") {
    if (!d) return;
    const texto = canal === "WhatsApp" ? "Abriu WhatsApp." : canal === "Email" ? "Escreveu por email." : "Tentativa de chamada.";
    try {
      await apiNota(d.lead.id, texto, canal, canal === "Telefone" ? "" : "Atendeu");
      actualizado();
    } catch (e) {
      toastError(e, "Não foi possível registar o contacto.");
    }
  }

  const lead = d?.lead ?? lista.find(l => l.id === id) ?? null;
  const titulo = lead ? nomeCompleto(lead) || `Pré-inscrição #${lead.id}` : "Pré-inscrição";
  const wa = lead ? telWhatsapp(lead.telf) : "";
  const passo = lead ? proximoPasso({ ...lead, validada: Boolean(d?.validadaEm), pagamentoPedido: d?.estadoPagamento === "pedido", percursoConcluido: d?.percursoConcluido }) : null;

  return (
    <PainelLateral
      aberto={id != null}
      onFechar={onFechar}
      largura={600}
      titulo={titulo}
      subtitulo={lead ? `${lead.curso || "Sem curso"} · ${lead.regime === "fin" ? "Financiada" : "Gold"} · #${lead.id}` : undefined}
      rodape={<>
        <Botao variante="secundario" tamanho="sm" disabled={idx <= 0} onClick={() => onMudar(lista[idx - 1]!.id)}>‹ Anterior</Botao>
        <Botao variante="secundario" tamanho="sm" disabled={idx < 0 || idx >= lista.length - 1} onClick={() => onMudar(lista[idx + 1]!.id)}>Seguinte ›</Botao>
      </>}
    >
      {erro && !d ? <ErroCarregar erro={erro} onTentar={recarregar} /> : !d || !lead ? <Esqueleto linhas={8} /> : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Estado tom={tomEtapa(lead.estado)} ponto>{rotuloEtapa(lead.estado)}</Estado>
            {lead.secretariaEm && <Estado tom="info">Na secretaria</Estado>}
            {lead.comercialNome && <Estado tom="neutro">{lead.comercialNome}</Estado>}
            {lead.etiquetaNome && <span className="text-xs font-semibold" style={{ color: lead.etiquetaCor || undefined }}>● {lead.etiquetaNome}</span>}
          </div>

          <ol aria-label="Percurso" className="m-0 flex list-none gap-1 p-0">
            {percurso(d).map(p => (
              <li key={p.rotulo} className="flex-1 min-w-0">
                <span className={cx("block h-1.5 rounded-full", p.feito ? "bg-sucesso" : "bg-linha")} />
                <span className={cx("mt-1 block truncate text-[11px]", p.feito ? "font-semibold text-tinta" : "text-tinta-suave")}>{p.rotulo}</span>
              </li>
            ))}
          </ol>

          {passo && (
            <div className="rounded-cartao border border-linha bg-fundo px-4 py-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-tinta-suave">Próximo passo</p>
              <p className="m-0 mt-1 text-sm font-semibold">{d.faltaValidar && !d.validadaEm && lead.estado !== "Não contactado" ? d.faltaValidar : passo.texto}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-[13px]">
            {lead.telf
              ? <a className="inline-flex h-9 items-center rounded-controlo bg-tinta px-3 font-semibold text-white" href={`tel:${lead.telf}`} onClick={() => void registarContacto("Telefone")}>Ligar · {lead.telf}</a>
              : <span className="inline-flex h-9 items-center rounded-controlo bg-linha-suave px-3 text-tinta-fraca">Sem telemóvel</span>}
            {wa && <a className="inline-flex h-9 items-center rounded-controlo bg-sucesso px-3 font-semibold text-white" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" onClick={() => void registarContacto("WhatsApp")}>WhatsApp</a>}
            {lead.email && <a className="inline-flex h-9 items-center rounded-controlo border border-linha-forte px-3 font-semibold text-tinta" href={`mailto:${lead.email}`} onClick={() => void registarContacto("Email")}>Email</a>}
          </div>

          {d.outrosPedidos.length > 0 && (
            <Aviso tom="aviso" titulo={`${d.outrosPedidos.length} outro${d.outrosPedidos.length === 1 ? "" : "s"} pedido${d.outrosPedidos.length === 1 ? "" : "s"} deste contacto`}>
              <ul className="m-0 list-none p-0">
                {d.outrosPedidos.slice(0, 4).map(o => (
                  <li key={o.id}><button type="button" className="text-left text-ligacao hover:underline" onClick={() => onMudar(o.id)}>#{o.id} · {o.curso || "sem curso"} · {rotuloEtapa(o.estado)}</button></li>
                ))}
              </ul>
            </Aviso>
          )}

          <Separadores<Aba>
            rotulo="Ficha da pré-inscrição"
            ativo={aba}
            onMudar={setAba}
            itens={[
              { id: "actividade", rotulo: "Actividade", contagem: d.eventos.length || undefined },
              { id: "documentos", rotulo: "Documentos", contagem: d.documentos.length || undefined },
              { id: "dados", rotulo: "Dados" },
              { id: "secretaria", rotulo: "Validação" },
            ]}
          />
          {aba === "actividade" && <FichaActividade d={d} onMudou={actualizado} />}
          {aba === "documentos" && <FichaDocumentos d={d} role={user.role} onMudou={actualizado} />}
          {aba === "dados" && <FichaDados d={d} onMudou={actualizado} />}
          {aba === "secretaria" && <FichaSecretaria d={d} role={user.role} onMudou={actualizado} />}
        </div>
      )}
    </PainelLateral>
  );
}
