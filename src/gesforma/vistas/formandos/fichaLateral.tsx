import { useRef, useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import {
  apiAcessoFormando, apiAnexarOutroDocFormando, apiPedirPagamentoFormando, type FichaFormando,
} from "../../../partilhado/api/formandos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { apiEntregarDoc, apiLembretePrestacao, apiValidarDoc } from "../../../partilhado/api/crm";
import { Aviso, Botao, Caixa, Cartao, Detalhes, Estado, data, dataHora, eur } from "../../../partilhado/ui";
import { RegistarPagamento } from "./fichaDialogos";
import { ReciboPagamento } from "../sistema/pagamentos/ReciboPagamento";
import { PAGAMENTO } from "./partes";

const INVALIDAR = ["formandos:"];

export function CartaoDados({ ficha, podeEditar, onEditar }: { ficha: FichaFormando; podeEditar: boolean; onEditar: () => void }) {
  return (
    <Cartao titulo="Dados pessoais" acoes={podeEditar && <Botao variante="ligacao" tamanho="sm" onClick={onEditar}>Editar</Botao>}>
      <Detalhes
        colunas={1}
        itens={[
          { rotulo: "Email", valor: ficha.email || "—" },
          { rotulo: "Telemóvel", valor: ficha.telf || "—" },
          { rotulo: "Curso", valor: ficha.curso || "—" },
          ...(ficha.local ? [{ rotulo: "Local", valor: ficha.local }] : []),
          ...(ficha.origem ? [{ rotulo: "Origem", valor: `Pré-inscrição #${ficha.origem.preinscricaoId}${ficha.origem.comoConheceu ? ` · conheceu a ENA por ${ficha.origem.comoConheceu}` : ""}` }] : []),
        ]}
      />
    </Cartao>
  );
}

export function CartaoAcesso({ ficha, podeEditar }: { ficha: FichaFormando; podeEditar: boolean }) {
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [senha, setSenha] = useState<string | null>(null);
  const acesso = useAccao(
    (repor: boolean) => apiAcessoFormando(ficha.regime, ficha.id, { repor, enviarEmail }),
    {
      invalidar: INVALIDAR,
      ok: r => r.acesso.emailEnviado
        ? `Acesso enviado para ${r.acesso.email}.`
        : r.acesso.password ? "Palavra-passe temporária gerada." : `Conta ligada a ${r.acesso.email}.`,
    },
  );
  async function gerar(repor: boolean) {
    setSenha(null);
    const r = await acesso.correr(repor);
    if (r?.acesso.password && !r.acesso.emailEnviado) setSenha(r.acesso.password);
  }
  const a = ficha.acesso;
  return (
    <Cartao
      titulo="Área do formando"
      acoes={a.tem ? <Estado tom={a.ativa ? "sucesso" : "neutro"} ponto>{a.ativa ? "Acesso ativo" : "Conta desativada"}</Estado> : <Estado tom="aviso" ponto>Sem acesso</Estado>}
    >
      <p className="m-0 text-[13px] text-tinta-suave">
        Utilizador: <strong className="text-tinta">{ficha.email || "sem email"}</strong>.
        {a.tem && <> {a.criadaEm ? `Criado a ${data(a.criadaEm)}` : ""}{a.ultimoAcesso ? ` · último acesso ${dataHora(a.ultimoAcesso)}` : " · ainda não entrou"}{a.mudarPalavraPasse ? " · palavra-passe temporária por trocar" : ""}.</>}
      </p>
      <p className="m-0 mt-2 text-xs text-tinta-suave">A palavra-passe é temporária e trocada no primeiro acesso. O GesForma só a mostra quando é gerada.</p>
      {senha && (
        <Aviso tom="aviso" className="mt-3" titulo="Palavra-passe temporária">
          <span className="font-mono text-sm select-all">{senha}</span> · comunique-a ao formando; não volta a ser mostrada.
        </Aviso>
      )}
      {podeEditar && (
        <div className="mt-3 flex flex-col gap-2">
          <Caixa rotulo="Enviar o utilizador e a palavra-passe por email" checked={enviarEmail} onChange={e => setEnviarEmail(e.target.checked)} />
          <div className="flex gap-2 flex-wrap">
            {!a.tem && <Botao variante="primario" tamanho="sm" aCarregar={acesso.aCorrer} disabled={!ficha.email} onClick={() => gerar(false)}>Criar acesso</Botao>}
            {a.tem && <Botao tamanho="sm" aCarregar={acesso.aCorrer} onClick={() => gerar(true)}>Gerar nova palavra-passe</Botao>}
          </div>
          {!ficha.email && <p className="m-0 text-xs text-perigo">Sem email não é possível criar o acesso.</p>}
        </div>
      )}
    </Cartao>
  );
}

export function CartaoPagamento({ ficha, podeEditar }: { ficha: FichaFormando; podeEditar: boolean }) {
  const pode = usePode();
  const [registar, setRegistar] = useState(false);
  const pedir = useAccao(() => apiPedirPagamentoFormando(ficha.id), { invalidar: INVALIDAR, ok: r => `Pagamento de ${eur(r.valor, true)} pedido por email.` });
  const p = ficha.pagamento;
  if (!p) return null;
  // Em prestações com alguma por pagar: «1 de 2 pagas» (o pagamento ligado fica «Pago» com a 1.ª).
  const comps = p.comprovativos ?? [];
  const pagas = comps.filter(c => c.estado === "validado").length;
  const s = comps.length > 1 && pagas < comps.length
    ? { rotulo: `${pagas} de ${comps.length} prestações pagas`, tom: "aviso" as const }
    : PAGAMENTO[p.situacao];
  const porPagar = p.situacao === "por_pagar";
  const pagoMov = p.movimentos.find(m => /^pago$/i.test(m.estado));
  return (
    <Cartao titulo="Pagamento" acoes={<Estado tom={s.tom} ponto>{s.rotulo}</Estado>}>
      <p className="num m-0 text-2xl font-semibold text-tinta">{eur(p.valor, true)}</p>
      <ComprovativosPagamento ficha={ficha} podeEditar={podeEditar} />
      <p className="m-0 mt-1 text-[13px] text-tinta-suave">
        {p.situacao === "oferta" ? "Inscrição oferecida pela ENA." : p.pago ? `Pago${p.metodo && p.metodo !== "-" ? ` · ${p.metodo}` : ""}.` : p.pedidoEm ? `Pedido por email a ${data(p.pedidoEm)}.` : "Ainda não foi pedido."}
      </p>
      {p.movimentos.length > 0 && (
        <ul className="m-0 mt-3 p-0 list-none divide-y divide-linha-suave text-[13px]">
          {p.movimentos.map(m => (
            <li key={m.id} className="py-2 flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate">{m.metodo || "—"} · {m.pagoEm ? data(m.pagoEm) : m.data}</span>
              <span className="num">{eur(m.valor, true)}</span>
              <Estado tom={/pago/i.test(m.estado) ? "sucesso" : /recus|cancel/i.test(m.estado) ? "perigo" : "aviso"}>{m.estado}</Estado>
            </li>
          ))}
        </ul>
      )}
      {podeEditar && porPagar && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            {!ficha.semEmails && (
              <Botao tamanho="sm" variante="primario" aCarregar={pedir.aCorrer} disabled={!p.temIban || !ficha.email} onClick={() => pedir.correr()}>
                {p.pedidoEm ? "Pedir de novo" : "Pedir pagamento"}
              </Botao>
            )}
            {pode("pagamentos.registarFicha") && <Botao tamanho="sm" onClick={() => setRegistar(true)}>Registar pagamento</Botao>}
          </div>
          <p className="m-0 text-xs text-tinta-suave">
            {ficha.semEmails
              ? "Ficha sem emails de pagamento (inscrição tratada pela equipa): registe o pagamento quando o receber."
              : p.temIban ? "Envia um email com o valor e o IBAN da ENA; a pessoa responde com o comprovativo." : "Falta o IBAN da entidade em Configurações › Entidade."}
          </p>
        </div>
      )}
      {pagoMov && pode("pagamentos.ver") && (
        <div className="mt-3"><ReciboPagamento pagamentoId={pagoMov.id} email={ficha.email} podeEmitir={pode("pagamentos.ver")} /></div>
      )}
      <RegistarPagamento aberto={registar} onFechar={() => setRegistar(false)} ficha={ficha} />
    </Cartao>
  );
}

export function CartaoElegibilidade({ ficha }: { ficha: FichaFormando }) {
  const obrig = ficha.documentos.filter(d => d.required);
  const falta = obrig.filter(d => d.estado !== "validado");
  return (
    <Cartao titulo="Elegibilidade" acoes={falta.length ? <Estado tom="aviso" ponto>Por completar</Estado> : <Estado tom="sucesso" ponto>Elegível</Estado>}>
      <ul className="m-0 p-0 list-none flex flex-col gap-1.5 text-[13px]">
        {obrig.map(d => (
          <li key={d.id} className="flex items-center gap-2">
            <span aria-hidden="true" className={d.estado === "validado" ? "text-sucesso" : d.estado === "recusado" ? "text-perigo" : "text-tinta-fraca"}>
              {d.estado === "validado" ? "✓" : d.estado === "recusado" ? "✕" : "○"}
            </span>
            <span className={d.estado === "validado" ? "text-tinta" : "text-tinta-suave"}>{d.label}</span>
          </li>
        ))}
      </ul>
      {falta.length > 0 && (
        <p className="m-0 mt-3 text-xs text-tinta-suave">
          Ainda não elegível: falta{falta.length > 1 ? "m" : ""} {falta.map(d => d.label).join(", ")}.
        </p>
      )}
    </Cartao>
  );
}

export function CartaoTurma({ ficha, onAbrir }: { ficha: FichaFormando; onAbrir: (turmaId: number) => void }) {
  const t = ficha.turma;
  return (
    <Cartao titulo="Turma" acoes={t && <Botao variante="ligacao" tamanho="sm" onClick={() => onAbrir(t.id)}>Abrir turma</Botao>}>
      {t ? (
        <Detalhes
          colunas={1}
          itens={[
            { rotulo: "Turma", valor: <>{t.nome}{t.fechada && <Estado tom="neutro" className="ml-2">Fechada</Estado>}</> },
            ...(t.ufcd ? [{ rotulo: "UFCD", valor: t.ufcd }] : []),
            { rotulo: "Início", valor: t.inicio ? data(t.inicio) : "—" },
            { rotulo: "Local e horário", valor: [t.local, t.horario].filter(Boolean).join(" · ") || "—" },
            { rotulo: "Estado", valor: t.estado || "—" },
          ]}
        />
      ) : (
        <p className="m-0 text-[13px] text-tinta-suave">{ficha.regime === "gold" ? "Sem turma: formando avulso (e-learning ou venda individual)." : "Ainda não colocado numa turma."}</p>
      )}
    </Cartao>
  );
}

const ESTADO_COMPROVATIVO = {
  validado: { rotulo: "Pago", tom: "sucesso" as const },
  pendente: { rotulo: "Por validar", tom: "aviso" as const },
  recusado: { rotulo: "Recusado", tom: "perigo" as const },
  em_falta: { rotulo: "Por pagar", tom: "neutro" as const },
};

/**
 * Comprovativos de pagamento (o do 1.º pagamento e os das prestações seguintes), com abrir, validar e anexar, e o
 * lembrete à pessoa da prestação seguinte (email com a ligação no passo do pagamento).
 */
function ComprovativosPagamento({ ficha, podeEditar }: { ficha: FichaFormando; podeEditar: boolean }) {
  const pode = usePode();
  const p = ficha.pagamento;
  const leadId = p?.preinscricaoId ?? null;
  const lista = p?.comprovativos ?? [];
  const escolha = useRef<HTMLInputElement>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const anexar = useAccao((tipo: string, f: File) => apiEntregarDoc(leadId!, tipo, f), { invalidar: INVALIDAR, ok: "Comprovativo anexado. Fica por validar." });
  const validar = useAccao((docId: number) => apiValidarDoc(leadId!, docId), { invalidar: [...INVALIDAR, "pagamentos:"], ok: "Comprovativo validado." });
  const lembrete = useAccao(() => apiLembretePrestacao(leadId!), { invalidar: INVALIDAR, ok: "Lembrete enviado por email, com a ligação no passo do pagamento." });
  // Comprovativos anexados na própria ficha (ex.: acesso direto, sem pré-inscrição): «outros documentos» com este nome.
  const daFicha = ficha.documentos.filter(d => d.id.startsWith("outro-") && /^comprovativo de pagamento/i.test(d.label));
  const anexarFicha = useAccao((f: File) => apiAnexarOutroDocFormando(ficha.regime, ficha.id, f, `Comprovativo de pagamento${lista.length + daFicha.length ? ` ${lista.length + daFicha.length + 1}` : ""}`),
    { invalidar: INVALIDAR, ok: "Comprovativo anexado (fica na pasta do formando na Drive)." });
  const escolhaFicha = useRef<HTMLInputElement>(null);
  const proxima = lista.find(c => c.estado === "em_falta" || c.estado === "recusado");
  const varias = (lista[0]?.total ?? 0) > 1;
  const blocoFicha = (
    <>
      {daFicha.length > 0 && (
        <ul className="m-0 mt-1 p-0 list-none divide-y divide-linha-suave text-[13px]">
          {daFicha.map(d => (
            <li key={d.id} className="py-2 flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate">{d.label}</span>
              {d.driveUrl && <a className="text-[13px] font-semibold text-ligacao" href={d.driveUrl} target="_blank" rel="noreferrer">Abrir</a>}
            </li>
          ))}
        </ul>
      )}
      {podeEditar && (
        <>
          <input ref={escolhaFicha} type="file" accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.jfif,.png,.webp" className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void anexarFicha.correr(f); }} />
          <Botao className="mt-1" tamanho="sm" variante="fantasma" aCarregar={anexarFicha.aCorrer} onClick={() => escolhaFicha.current?.click()}>
            Anexar comprovativo de pagamento
          </Botao>
        </>
      )}
    </>
  );
  if (!leadId || !lista.length) {
    if (!daFicha.length && !podeEditar) return null;
    return (
      <div className="mt-3">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-tinta-suave">Comprovativos de pagamento</p>
        {blocoFicha}
      </div>
    );
  }
  return (
    <div className="mt-3">
      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-tinta-suave">{varias ? `Comprovativos · pagamento em ${lista[0]!.total} prestações` : "Comprovativo"}</p>
      <input ref={escolha} type="file" accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.jfif,.png,.webp" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f && alvo) void anexar.correr(alvo, f); }} />
      <ul className="m-0 mt-1 p-0 list-none divide-y divide-linha-suave text-[13px]">
        {lista.map(c => {
          const e = ESTADO_COMPROVATIVO[c.estado];
          return (
            <li key={c.tipo} className="py-2 flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-0 truncate">Comprovativo do {c.n}.º pagamento · <span className="num font-semibold">{eur(c.valor, true)}</span></span>
              <Estado tom={e.tom}>{e.rotulo}</Estado>
              {c.url && <a className="text-[13px] font-semibold text-ligacao" href={c.url} target="_blank" rel="noreferrer">Abrir</a>}
              {podeEditar && c.estado === "pendente" && c.docId != null && pode("pagamentos.validarComprovativo") && (
                <Botao tamanho="sm" variante="primario" aCarregar={validar.aCorrer} onClick={() => void validar.correr(c.docId!)}>Validar</Botao>
              )}
              {podeEditar && (c.estado === "em_falta" || c.estado === "recusado") && (
                <Botao tamanho="sm" variante="secundario" aCarregar={anexar.aCorrer && alvo === c.tipo} onClick={() => { setAlvo(c.tipo); escolha.current?.click(); }}>Anexar</Botao>
              )}
            </li>
          );
        })}
      </ul>
      {daFicha.length > 0 && blocoFicha}
      {podeEditar && varias && proxima && (
        <Botao className="mt-1" tamanho="sm" variante="secundario" aCarregar={lembrete.aCorrer} disabled={!ficha.email} onClick={() => void lembrete.correr()}>
          Enviar lembrete do {proxima.n}.º pagamento ({eur(proxima.valor, true)})
        </Botao>
      )}
    </div>
  );
}
