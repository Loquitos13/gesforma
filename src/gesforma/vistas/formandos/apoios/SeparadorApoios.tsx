import { useState } from "react";
import { apiAlterarApoio, apiApoiosFormando, type Apoio, type ApoiosFormando } from "../../../../partilhado/api/apoios";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import {
  Aviso, Botao, Cartao, ErroCarregar, Esqueleto, Estado, Selecao, Tabela, Vazio, data, eur, num, type Coluna,
} from "../../../../partilhado/ui";
import { ESTADO_APOIO, MODO_APOIO, nomeMes } from "./comum";
import { AjustarApoio, EditarIban, INVALIDAR_APOIOS, MarcarPago } from "./dialogos";

/** Apoios do formando (Financiada): IBAN, simulação do mês a partir das presenças e histórico. */
export function SeparadorApoios({ formandoId, podeEditar }: { formandoId: number; podeEditar: boolean }) {
  const [mes, setMes] = useState<string | undefined>(undefined);
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `apoios:formando:${formandoId}:${mes ?? ""}`,
    s => apiApoiosFormando(formandoId, mes, s),
  );
  const [iban, setIban] = useState(false);

  if (erro != null && !dados) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <div aria-busy={aCarregar}><Esqueleto linhas={6} altura="h-6" /></div>;

  const exigeIban = dados.regras.some(r => r.ativo && r.requerIban);
  return (
    <div className="flex flex-col gap-4">
      {!dados.iban.tem && exigeIban && (
        <Aviso tom="perigo" titulo="Sem IBAN não há apoios" acao={podeEditar ? <Botao tamanho="sm" onClick={() => setIban(true)}>Indicar IBAN</Botao> : undefined}>
          Os apoios que exigem IBAN ficam bloqueados até o IBAN do formando estar registado.
        </Aviso>
      )}
      <Cartao
        titulo="Conta para os apoios"
        acoes={podeEditar && <Botao tamanho="sm" onClick={() => setIban(true)}>{dados.iban.tem ? "Alterar IBAN" : "Indicar IBAN"}</Botao>}
      >
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div><p className="m-0 text-xs text-tinta-suave">IBAN</p><p className="m-0 num font-medium text-tinta">{dados.iban.tem ? dados.iban.mascarado : "—"}</p></div>
          <div><p className="m-0 text-xs text-tinta-suave">Titular</p><p className="m-0 font-medium text-tinta">{dados.iban.titular || "—"}</p></div>
          <div><p className="m-0 text-xs text-tinta-suave">Pago até hoje</p><p className="m-0 num font-medium text-tinta">{eur(dados.totais.pago, true)}</p></div>
          <div><p className="m-0 text-xs text-tinta-suave">Por pagar</p><p className="m-0 num font-medium text-tinta">{eur(dados.totais.porPagar, true)}</p></div>
        </div>
      </Cartao>

      <Simulacao dados={dados} mes={mes ?? dados.mes ?? ""} onMes={setMes} />
      <Historico registos={dados.registos} podeEditar={podeEditar} />
      <EditarIban aberto={iban} onFechar={() => setIban(false)} formandoId={formandoId} titularAtual={dados.iban.titular} />
    </div>
  );
}

function Simulacao({ dados, mes, onMes }: { dados: ApoiosFormando; mes: string; onMes: (m: string) => void }) {
  if (!dados.turma) return <Cartao titulo="Cálculo do mês"><Vazio compacto titulo="Sem turma." descricao="Os apoios calculam-se a partir das presenças na turma." /></Cartao>;
  if (!dados.regras.some(r => r.ativo)) {
    return (
      <Cartao titulo="Cálculo do mês">
        <Vazio compacto titulo="Sem regras de apoios para esta turma." descricao={`Defina-as em Configurações › Apoios${dados.turma.financiador ? ` (financiador ${dados.turma.financiador})` : ""}.`} />
      </Cartao>
    );
  }
  const s = dados.simulacao;
  const opcoes = (dados.meses.length ? dados.meses : [mes]).map(m => ({ valor: m, rotulo: nomeMes(m) }));
  return (
    <Cartao
      titulo="Cálculo do mês"
      subtitulo="Simulação a partir das folhas de presença. Só fica registado quando a turma é processada."
      acoes={<Selecao aria-label="Mês" value={mes} onChange={e => onMes(e.target.value)} opcoes={opcoes} className="h-8 text-[13px]" />}
    >
      {!s ? <Vazio compacto titulo="Sem dados para este mês." /> : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-tinta-suave num">
            {num(s.horasPresente)} h presentes de {num(s.horasPrevistas)} h com folha · {num(s.diasComPresenca)} dia(s) com presença
            {s.assiduidade != null && ` · assiduidade ${num(s.assiduidade)} %`}
          </p>
          <ul className="m-0 p-0 list-none divide-y divide-linha-suave border border-linha rounded-controlo">
            {s.linhas.map(l => (
              <li key={l.tipo} className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-sm">
                <div className="flex-1 min-w-[180px]">
                  <p className="m-0 font-medium text-tinta">{l.rotulo}</p>
                  <p className="m-0 text-xs text-tinta-suave">
                    {MODO_APOIO[l.modo].rotulo} · {l.modo === "hora" ? `${num(l.horas)} h` : `${num(l.dias)} dia(s)`}
                    {l.aplicadoTeto && ` · teto mensal aplicado (bruto ${eur(l.valorBruto, true)})`}
                    {l.exclusao && ` · ${l.exclusao}`}
                  </p>
                </div>
                {l.bloqueadoIban && <Estado tom="perigo">Falta IBAN</Estado>}
                <span className="num font-semibold text-tinta w-24 text-right">{eur(l.valor, true)}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-sm text-right">Total a receber: <strong className="num text-tinta">{eur(s.total, true)}</strong></p>
        </div>
      )}
    </Cartao>
  );
}

function Historico({ registos, podeEditar }: { registos: Apoio[]; podeEditar: boolean }) {
  const [ajustar, setAjustar] = useState<Apoio | null>(null);
  const [pagar, setPagar] = useState<Apoio | null>(null);
  const alterar = useAccao(
    (id: number, corpo: Parameters<typeof apiAlterarApoio>[1]) => apiAlterarApoio(id, corpo),
    { invalidar: INVALIDAR_APOIOS, ok: "Apoio actualizado." },
  );

  const colunas: Coluna<Apoio>[] = [
    { id: "periodo", titulo: "Mês", principal: true, celula: a => nomeMes(a.periodo) },
    { id: "tipo", titulo: "Apoio", celula: a => a.rotulo },
    { id: "base", titulo: "Base", esconderMovel: true, celula: a => <span className="num">{num(a.dias)} d · {num(a.horas)} h</span> },
    {
      id: "valor", titulo: "Valor", alinhar: "dir",
      celula: a => <span className="num" title={a.ajuste ? `Calculado ${eur(a.valorCalculado, true)} · ajuste ${eur(a.ajuste, true)}: ${a.motivoAjuste}` : undefined}>{eur(a.valor, true)}{a.ajuste ? " *" : ""}</span>,
    },
    { id: "estado", titulo: "Estado", celula: a => <Estado tom={ESTADO_APOIO[a.estado].tom}>{ESTADO_APOIO[a.estado].rotulo}</Estado> },
    { id: "pago", titulo: "Pagamento", esconderMovel: true, celula: a => (a.pagoEm ? `${data(a.pagoEm)}${a.referencia ? ` · ${a.referencia}` : ""}` : "—") },
  ];

  return (
    <Cartao titulo="Histórico de apoios" semPadding>
      <Tabela
        rotulo="Apoios do formando"
        linhas={registos}
        colunas={colunas}
        chave={a => a.id}
        vazio={<Vazio compacto titulo="Ainda sem apoios processados." descricao="Os apoios ficam registados quando a turma processa o mês." />}
        acoesLinha={podeEditar ? a => (
          <div className="flex gap-1.5 justify-end flex-wrap">
            {a.estado === "calculado" && <Botao tamanho="sm" variante="primario" aCarregar={alterar.aCorrer} onClick={() => void alterar.correr(a.id, { estado: "aprovado" })}>Aprovar</Botao>}
            {a.estado === "aprovado" && <Botao tamanho="sm" variante="primario" onClick={() => setPagar(a)}>Marcar pago</Botao>}
            {(a.estado === "calculado" || a.estado === "aprovado") && <Botao tamanho="sm" onClick={() => setAjustar(a)}>Ajustar</Botao>}
            {(a.estado === "calculado" || a.estado === "aprovado") && <Botao tamanho="sm" variante="fantasma" onClick={() => void alterar.correr(a.id, { estado: "anulado" })}>Anular</Botao>}
            {a.estado === "anulado" && <Botao tamanho="sm" variante="fantasma" onClick={() => void alterar.correr(a.id, { estado: "calculado" })}>Reabrir</Botao>}
          </div>
        ) : undefined}
      />
      <p className="m-0 px-5 py-3 border-t border-linha text-xs text-tinta-suave">* valor com ajuste manual (passe o rato para ver o motivo).</p>
      <AjustarApoio apoio={ajustar} onFechar={() => setAjustar(null)} />
      <MarcarPago
        aberto={Boolean(pagar)}
        onFechar={() => setPagar(null)}
        titulo={pagar ? `${pagar.rotulo} · ${nomeMes(pagar.periodo)}` : "Marcar como pago"}
        descricao={pagar ? `Valor: ${eur(pagar.valor, true)}` : undefined}
        onConfirmar={(pagoEm, referencia) => alterar.correr(pagar!.id, { estado: "pago", pagoEm, referencia })}
      />
    </Cartao>
  );
}

/** Resumo para a coluna lateral da ficha. */
export function CartaoApoios({ formandoId, onAbrir }: { formandoId: number; onAbrir: () => void }) {
  const { dados } = useRecurso(`apoios:formando:${formandoId}:`, s => apiApoiosFormando(formandoId, undefined, s));
  if (!dados) return null;
  return (
    <Cartao titulo="Apoios" acoes={<Botao variante="ligacao" tamanho="sm" onClick={onAbrir}>Ver apoios</Botao>}>
      <ul className="m-0 p-0 list-none flex flex-col gap-1.5 text-[13px]">
        <li className="flex justify-between gap-2"><span className="text-tinta-suave">IBAN</span>{dados.iban.tem ? <span className="num">{dados.iban.mascarado}</span> : <Estado tom="perigo">Em falta</Estado>}</li>
        <li className="flex justify-between gap-2"><span className="text-tinta-suave">Pago</span><span className="num">{eur(dados.totais.pago, true)}</span></li>
        <li className="flex justify-between gap-2"><span className="text-tinta-suave">Por pagar</span><span className="num">{eur(dados.totais.porPagar, true)}</span></li>
        {dados.simulacao && (
          <li className="flex justify-between gap-2"><span className="text-tinta-suave">{nomeMes(dados.simulacao.periodo)}</span><span className="num">{eur(dados.simulacao.total, true)}</span></li>
        )}
      </ul>
    </Cartao>
  );
}
