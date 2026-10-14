// Regras dos emails automáticos (como no canvas): à esquerda as regras agrupadas pela fase do
// percurso, com envios e interruptor; à direita a regra escolhida, as acções e o email tal como sai.
import { useMemo, useState } from "react";
import { usePode } from "../../../../partilhado/AuthGate";
import {
  apiAlterarRegra, apiApagarRegra, apiEnviosEmail, apiModelosEmail, apiPrevisualizarEmail, apiRegrasEmail, apiTestarRegra,
  type OpcoesEmail, type RegraEmail,
} from "../../../../partilhado/api/emails";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import {
  Botao, Cartao, ConfirmarPerigo, ErroCarregar, Esqueleto, Interruptor, Vazio, cx, dataHora, num,
} from "../../../../partilhado/ui";
import { FormRegra } from "./FormRegra";
import { MolduraEmail } from "./Previsualizacao";

const FASES: { id: string; titulo: string; teste: (evento: string) => boolean }[] = [
  { id: "pre", titulo: "Pré-inscrição", teste: e => (e.startsWith("preinscricao.") && e !== "preinscricao.unpaid_3d") || e.startsWith("lead.") },
  { id: "pag", titulo: "Pagamento", teste: e => e.startsWith("payment.") || e === "preinscricao.unpaid_3d" || e === "sale.followup" },
  { id: "form", titulo: "Formação", teste: e => e.startsWith("turma.") || e.startsWith("formando.") },
  { id: "int", titulo: "Avisos internos", teste: e => e.startsWith("sessao.") },
];

const INVALIDAR = ["emails:"];

export function Regras({ opcoes, onEditarModelo }: { opcoes?: OpcoesEmail; onEditarModelo?: () => void }) {
  const pode = usePode();
  const gerir = pode("emails.gerir");
  const { dados, erro, aCarregar, recarregar } = useRecurso("emails:regras", apiRegrasEmail);
  const { dados: envios } = useRecurso("emails:envios:resumo", signal => apiEnviosEmail({ porPagina: 1 }, signal));
  const { dados: modelos } = useRecurso("emails:modelos", apiModelosEmail);
  const [selId, setSelId] = useState<number | null>(null);
  const [form, setForm] = useState<RegraEmail | "nova" | null>(null);
  const [apagar, setApagar] = useState<RegraEmail | null>(null);
  const alterar = useAccao(apiAlterarRegra, { invalidar: INVALIDAR });
  const testar = useAccao(apiTestarRegra, { ok: r => (r.logged ? `Teste registado (SMTP desligado): ${r.to}` : `Teste enviado para ${r.to}.`), invalidar: INVALIDAR });
  const remover = useAccao(apiApagarRegra, { ok: "Regra apagada.", invalidar: INVALIDAR });

  const regras = useMemo(() => dados?.rules ?? [], [dados]);
  const grupos = useMemo(() => {
    const outras = regras.filter(r => !FASES.some(f => f.teste(r.evento)));
    return [...FASES.map(f => ({ id: f.id, titulo: f.titulo, lista: regras.filter(r => f.teste(r.evento)) })), { id: "outras", titulo: "Outras", lista: outras }]
      .filter(g => g.lista.length);
  }, [regras]);
  const sel = regras.find(r => r.id === selId) ?? grupos[0]?.lista[0] ?? null;
  const modelo = sel ? (modelos?.templates ?? []).find(m => m.tipo === sel.template) : undefined;
  const pedido = modelo ? { tipo: modelo.tipo, assunto: modelo.assunto, body_xml: modelo.body_xml, cta: modelo.cta, curso: sel?.curso ?? null } : null;
  const { dados: prev, aCarregar: aPrever } = useRecurso(
    pedido ? `emails:prev:regra:${sel?.id}:${modelo?.updated_at}` : null,
    signal => apiPrevisualizarEmail(pedido!, signal),
  );

  const s = envios?.stats;
  const taxa = s && s.sent ? Math.round((s.abertos / s.sent) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="num m-0 flex-1 text-sm text-tinta-suave">
          {s
            ? <>Últimos 30 dias: <strong className="text-tinta">{num(s.sent)}</strong> enviados{taxa != null ? ` · ${num(taxa)} % abertos` : ""} · {num(s.queued)} na fila · <span className={s.failed ? "text-perigo font-semibold" : undefined}>{num(s.failed)} {s.failed === 1 ? "falhou" : "falharam"}</span></>
            : "Cada regra liga um momento do percurso a um modelo de email."}
        </p>
        {gerir && <Botao variante="primario" onClick={() => setForm("nova")} disabled={!opcoes}>+ Nova regra</Botao>}
      </div>

      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}

      {aCarregar && !dados ? <Cartao><Esqueleto linhas={6} /></Cartao> : regras.length === 0 ? (
        <Cartao><Vazio titulo="Ainda não há regras" descricao="Sem regras activas, nenhum email automático sai." acao={gerir ? <Botao variante="primario" onClick={() => setForm("nova")}>Criar a primeira</Botao> : undefined} /></Cartao>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 items-start">
          <section className="bg-superficie border border-linha rounded-cartao overflow-hidden" aria-label="Regras">
            {grupos.map(g => (
              <div key={g.id}>
                <p className="m-0 px-4 pt-2.5 pb-1.5 text-[11px] font-bold tracking-[0.06em] uppercase text-tinta-fraca bg-[#F9FAFB] border-b border-linha">
                  {g.titulo} <span className="font-semibold normal-case tracking-normal">· {num(g.lista.filter(r => r.ativo).length)} de {num(g.lista.length)} activas</span>
                </p>
                {g.lista.map(r => {
                  const ativa = sel?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={ativa}
                      onClick={() => setSelId(r.id)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelId(r.id); } }}
                      className={cx("num grid grid-cols-[minmax(0,1fr)_120px_44px] gap-3 items-center px-4 py-3 border-b border-linha-suave cursor-pointer outline-none focus-visible:bg-fundo",
                        ativa ? "bg-acao-suave/60" : "hover:bg-fundo")}
                    >
                      <div className="min-w-0">
                        <p className="m-0 text-[13px] font-semibold text-tinta truncate">{r.nome}</p>
                        <p className="m-0 mt-0.5 text-xs text-tinta-suave truncate">Quando: {r.gatilho} · {r.atraso.toLowerCase()}{r.curso ? ` · só ${r.curso}` : ""}</p>
                      </div>
                      <div className="text-xs text-tinta-suave text-right">
                        <span className="block font-semibold text-tinta">{num(r.envios)} enviados</span>
                        {r.falhados ? <span className="text-perigo">{num(r.falhados)} falhados</span> : r.ultimoEnvio ? dataHora(r.ultimoEnvio) : "nunca enviado"}
                      </div>
                      <span onClick={e => e.stopPropagation()}>
                        <Interruptor rotulo={`${r.ativo ? "Desligar" : "Ligar"} a regra ${r.nome}`} ligado={r.ativo} desativado={!gerir || alterar.aCorrer}
                          onMudar={v => void alterar.correr(r.id, { ativo: v })} />
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          {sel && (
            <section className="bg-superficie border border-linha rounded-cartao flex flex-col" aria-label={`Regra ${sel.nome}`}>
              <div className="px-4 py-3.5 border-b border-linha flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h2 className="m-0 text-[15px] font-semibold text-tinta">{sel.nome}</h2>
                  <p className="m-0 mt-0.5 text-xs text-tinta-suave">Modelo: {sel.templateNome ?? sel.template} · {sel.gatilho} · {sel.atraso.toLowerCase()}</p>
                  <p className="num m-0 mt-1 text-xs text-tinta-suave">
                    {num(sel.envios)} enviados · {sel.envios ? `${num(sel.taxaAbertura)} % abertos` : "sem envios"}
                    {sel.emFila ? ` · ${num(sel.emFila)} em fila` : ""} · último: {sel.ultimoEnvio ? dataHora(sel.ultimoEnvio) : "nunca"}
                  </p>
                </div>
              </div>
              {gerir && (
                <div className="px-4 py-3 border-b border-linha flex gap-2 flex-wrap">
                  <Botao tamanho="sm" onClick={() => setForm(sel)}>Editar regra</Botao>
                  {onEditarModelo && <Botao tamanho="sm" onClick={onEditarModelo}>Editar modelo</Botao>}
                  <Botao tamanho="sm" aCarregar={testar.aCorrer} onClick={() => void testar.correr(sel.id)}>Enviar teste</Botao>
                  <Botao tamanho="sm" variante="fantasma" className="ml-auto text-perigo" onClick={() => setApagar(sel)}>Apagar</Botao>
                </div>
              )}
              <div className="p-4">
                {modelo
                  ? <MolduraEmail assunto={prev?.assunto ?? modelo.assunto} de={prev?.de} para={prev?.para} html={prev?.html} aCarregar={aPrever} />
                  : <p className="m-0 text-sm text-tinta-suave">{modelos ? "O modelo desta regra não foi encontrado." : "A carregar o modelo…"}</p>}
              </div>
            </section>
          )}
        </div>
      )}

      {form && opcoes && <FormRegra regra={form === "nova" ? null : form} opcoes={opcoes} onFechar={() => setForm(null)} />}
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo="Apagar esta regra?"
        descricao={`«${apagar?.nome ?? ""}» deixa de enviar emails. O histórico dos envios desta regra também é apagado. Para parar só por agora, desligue-a.`}
        onConfirmar={async () => { if (apagar) await remover.correr(apagar.id); }}
      />
    </div>
  );
}
