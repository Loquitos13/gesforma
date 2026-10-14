// Regras dos emails automáticos, agrupadas pela fase do percurso, com números dos últimos envios.
import { useState } from "react";
import { usePode } from "../../../../partilhado/AuthGate";
import {
  apiAlterarRegra, apiApagarRegra, apiEnviosEmail, apiRegrasEmail, apiTestarRegra, type OpcoesEmail, type RegraEmail,
} from "../../../../partilhado/api/emails";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import {
  Botao, Cartao, ConfirmarPerigo, ErroCarregar, Esqueleto, Estado, Interruptor, Kpi, KpiFaixa, Vazio, dataHora, num,
} from "../../../../partilhado/ui";
import { FormRegra } from "./FormRegra";

const FASES: { id: string; titulo: string; teste: (evento: string) => boolean }[] = [
  { id: "pre", titulo: "Pré-inscrição", teste: e => (e.startsWith("preinscricao.") && e !== "preinscricao.unpaid_3d") || e.startsWith("lead.") },
  { id: "pag", titulo: "Pagamento", teste: e => e.startsWith("payment.") || e === "preinscricao.unpaid_3d" || e === "sale.followup" },
  { id: "form", titulo: "Formação", teste: e => e.startsWith("turma.") || e.startsWith("formando.") },
  { id: "int", titulo: "Avisos internos", teste: e => e.startsWith("sessao.") },
];

const INVALIDAR = ["emails:"];

export function Regras({ opcoes }: { opcoes?: OpcoesEmail }) {
  const pode = usePode();
  const gerir = pode("emails.gerir");
  const { dados, erro, aCarregar, recarregar } = useRecurso("emails:regras", apiRegrasEmail);
  const { dados: envios } = useRecurso("emails:envios:resumo", signal => apiEnviosEmail({ porPagina: 1 }, signal));
  const [form, setForm] = useState<RegraEmail | "nova" | null>(null);
  const [apagar, setApagar] = useState<RegraEmail | null>(null);
  const alterar = useAccao(apiAlterarRegra, { invalidar: INVALIDAR });
  const testar = useAccao(apiTestarRegra, { ok: r => (r.logged ? `Teste registado (SMTP desligado): ${r.to}` : `Teste enviado para ${r.to}.`), invalidar: INVALIDAR });
  const remover = useAccao(apiApagarRegra, { ok: "Regra apagada.", invalidar: INVALIDAR });

  const regras = dados?.rules ?? [];
  const s = envios?.stats;
  const taxa = s && s.sent ? Math.round((s.abertos / s.sent) * 100) : null;
  const outras = regras.filter(r => !FASES.some(f => f.teste(r.evento)));

  function linha(r: RegraEmail) {
    return (
      <li key={r.id} className="py-3 flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-tinta">{r.nome}</p>
          <p className="m-0 mt-0.5 text-[13px] text-tinta-suave">
            {r.gatilho} · {r.atraso.toLowerCase()} · modelo «{r.templateNome ?? r.template}»{r.curso ? ` · só ${r.curso}` : ""}
          </p>
          <p className="num m-0 mt-1 text-xs text-tinta-suave">
            {num(r.envios)} enviados · {r.envios ? `${num(r.taxaAbertura)} % abertos` : "sem envios"}
            {r.emFila ? ` · ${num(r.emFila)} em fila` : ""}
            {r.falhados ? <span className="text-perigo"> · {num(r.falhados)} falhados</span> : null}
            {" · último: "}{r.ultimoEnvio ? dataHora(r.ultimoEnvio) : "nunca"}
          </p>
        </div>
        {gerir && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Botao tamanho="sm" variante="fantasma" onClick={() => setForm(r)}>Editar</Botao>
            <Botao tamanho="sm" variante="fantasma" aCarregar={testar.aCorrer} onClick={() => void testar.correr(r.id)}>Testar</Botao>
            <Botao tamanho="sm" variante="fantasma" className="text-perigo" onClick={() => setApagar(r)}>Apagar</Botao>
          </div>
        )}
        <Interruptor rotulo={`${r.ativo ? "Desligar" : "Ligar"} a regra ${r.nome}`} ligado={r.ativo} desativado={!gerir || alterar.aCorrer}
          onMudar={v => void alterar.correr(r.id, { ativo: v })} />
      </li>
    );
  }

  return (
    <div className="space-y-5">
      <KpiFaixa rotulo="Envios nos últimos 30 dias" className="xl:grid-cols-4">
        <Kpi rotulo="Enviados (30 dias)" valor={s?.sent} delta="sem os testes" />
        <Kpi rotulo="Abertos" valor={taxa == null ? (s ? "—" : undefined) : `${num(taxa)} %`} delta={s ? `${num(s.abertos)} emails abertos` : undefined} />
        <Kpi rotulo="Em fila" valor={s?.queued} delta="agendados ou a sair" />
        <Kpi rotulo="Falhados" valor={s?.failed} delta={s?.failed ? { texto: "ver no histórico", tom: "perigo" } : "nenhum"} />
      </KpiFaixa>

      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}

      <div className="flex items-center gap-3 flex-wrap">
        <p className="m-0 text-sm text-tinta-suave flex-1">Cada regra liga um momento do percurso a um modelo de email. «Testar» envia o modelo para o seu email.</p>
        {gerir && <Botao variante="primario" onClick={() => setForm("nova")} disabled={!opcoes}>Nova regra</Botao>}
      </div>

      {aCarregar && !dados ? <Cartao><Esqueleto linhas={6} /></Cartao> : regras.length === 0 ? (
        <Cartao><Vazio titulo="Ainda não há regras" descricao="Sem regras activas, nenhum email automático sai." acao={gerir ? <Botao variante="primario" onClick={() => setForm("nova")}>Criar a primeira</Botao> : undefined} /></Cartao>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[...FASES.map(f => ({ ...f, lista: regras.filter(r => f.teste(r.evento)) })), { id: "outras", titulo: "Outras", lista: outras }]
            .filter(g => g.lista.length)
            .map(g => (
              <Cartao key={g.id} titulo={g.titulo} acoes={<Estado tom="neutro">{num(g.lista.filter(r => r.ativo).length)} de {num(g.lista.length)} activas</Estado>}>
                <ul className="m-0 p-0 list-none divide-y divide-linha-suave">
                  {g.lista.map(linha)}
                </ul>
              </Cartao>
            ))}
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
