import { useEffect, useState } from "react";
import { Aviso, Botao, ErroCarregar, Esqueleto, Estado, Modal, Separadores, cx } from "../../../../partilhado/ui";
import { apiDossie, apiNota, type DossieLead, type Lead } from "../../../../partilhado/api/crm";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { useAuth } from "../../../../partilhado/AuthGate";
import { toastError, toastOk } from "../../../../partilhado/toastBus";
import { FichaActividade } from "./FichaActividade";
import { FichaContabilidade } from "./FichaContabilidade";
import { FichaDados } from "./FichaDados";
import { FichaDocumentos } from "./FichaDocumentos";
import { EmailLead } from "./EmailLead";
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

/** Datas ISO dentro de um texto («2026-11-22 2027-01-28») em dd-mm-aaaa. */
const datasPt = (t: string) => t.replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3-$2-$1");

/** Ficha da pré-inscrição: percurso, próximo passo, contactos e separadores de trabalho. */
export function FichaLead({ id, lista, onFechar, onMudar }: {
  id: number | null;
  lista: Lead[];
  onFechar: () => void;
  onMudar: (id: number) => void;
}) {
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>("actividade");
  const [email, setEmail] = useState(false);
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

  async function registarContacto(canal: "Telefone" | "WhatsApp") {
    if (!d) return;
    const texto = canal === "WhatsApp" ? "Abriu WhatsApp." : "Tentativa de chamada.";
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
    <Modal
      aberto={id != null}
      onFechar={onFechar}
      largura="lg"
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

          {/* O que a pessoa escolheu ao pré-inscrever-se (local e horário decidem a turma) e o email à vista. */}
          <dl aria-label="Dados do pedido" className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 rounded-cartao border border-linha px-4 py-3 text-[13px] sm:grid-cols-4">
            {([["Local", lead.local], ["Horário", lead.horario], ["Início", datasPt(lead.inicioCurso || "")], ["Concelho", lead.concelho]] as const).map(([r, v]) => (
              <div key={r} className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-tinta-suave">{r}</dt>
                <dd className="m-0 truncate font-semibold" title={v || undefined}>{v || "—"}</dd>
              </div>
            ))}
            <div className="col-span-2 min-w-0 sm:col-span-4">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-tinta-suave">Email</dt>
              <dd className="m-0 flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold select-all">{lead.email || "—"}</span>
                {lead.email && (
                  <Botao variante="ligacao" tamanho="sm" onClick={() => { void navigator.clipboard?.writeText(lead.email).then(() => toastOk("Email copiado.")); }}>Copiar</Botao>
                )}
              </dd>
            </div>
          </dl>

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
              <p className="m-0 mt-1 text-sm font-semibold">{!d.validadaEm && lead.estado !== "Não contactado"
                ? d.faltaValidar || (lead.estado === "Formando" || lead.estado === "Desistiu" ? passo.texto
                  : lead.regime === "fin" ? "Pronta a validar: escolha a turma no separador Validação." : "Pronta a validar no separador Validação.")
                : passo.texto}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-[13px]">
            {lead.telf
              ? <a className="inline-flex h-9 items-center rounded-controlo bg-tinta px-3 font-semibold text-white" href={`tel:${lead.telf}`} onClick={() => void registarContacto("Telefone")}>Ligar · {lead.telf}</a>
              : <span className="inline-flex h-9 items-center rounded-controlo bg-linha-suave px-3 text-tinta-fraca">Sem telemóvel</span>}
            {wa && <a className="inline-flex h-9 items-center rounded-controlo bg-sucesso px-3 font-semibold text-white" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" onClick={() => void registarContacto("WhatsApp")}>WhatsApp</a>}
            {lead.email && <button type="button" className="inline-flex h-9 items-center rounded-controlo border border-linha-forte px-3 font-semibold text-tinta hover:bg-fundo" onClick={() => setEmail(true)}>Email</button>}
            {lead.regime === "gold" && (user.role === "admin" || user.role === "secretaria") && <FichaContabilidade leadId={lead.id} />}
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
          <EmailLead d={d} aberto={email} onFechar={() => setEmail(false)} onEnviado={actualizado} />
        </div>
      )}
    </Modal>
  );
}
