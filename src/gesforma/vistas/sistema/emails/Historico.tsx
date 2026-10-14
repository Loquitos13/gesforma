// Histórico dos envios: filtros, paginação, abrir o email enviado, reenviar falhados e cancelar em fila.
import { useState } from "react";
import { usePode } from "../../../../partilhado/AuthGate";
import {
  apiCancelarEnvio, apiEnvioEmail, apiEnviosEmail, apiRegrasEmail, apiReenviarEnvio, type EnvioEmail,
} from "../../../../partilhado/api/emails";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import {
  Botao, Cartao, ErroCarregar, Estado, Filtros, Modal, Paginacao, Tabela, Vazio, dataHora, useFiltrosUrl, type Coluna, type Tom,
} from "../../../../partilhado/ui";
import { MolduraEmail } from "./Previsualizacao";

const ESTADO: Record<EnvioEmail["estado"], { rotulo: string; tom: Tom }> = {
  sent: { rotulo: "Enviado", tom: "sucesso" },
  queued: { rotulo: "Em fila", tom: "info" },
  failed: { rotulo: "Falhou", tom: "perigo" },
  cancelled: { rotulo: "Cancelado", tom: "neutro" },
};

export function Historico() {
  const pode = usePode();
  const gerir = pode("emails.gerir");
  const [f, setF, limpar] = useFiltrosUrl({ regra: "", estado: "", q: "", de: "", ate: "", pagina: "1" });
  const pagina = Number(f.pagina) || 1;
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `emails:envios:${f.regra}:${f.estado}:${f.q}:${f.de}:${f.ate}:${pagina}`,
    signal => apiEnviosEmail({ regra: f.regra, estado: f.estado, q: f.q, de: f.de, ate: f.ate, pagina, porPagina: 25 }, signal),
  );
  const { dados: regras } = useRecurso("emails:regras", apiRegrasEmail);
  const [aberto, setAberto] = useState<EnvioEmail | null>(null);
  const { dados: envio, aCarregar: aCarregarEnvio } = useRecurso(aberto ? `emails:envio:${aberto.id}` : null, signal => apiEnvioEmail(aberto!.id, signal));
  const reenviar = useAccao(apiReenviarEnvio, { ok: "Voltou para a fila de envio.", invalidar: ["emails:"] });
  const cancelar = useAccao(apiCancelarEnvio, { ok: "Envio cancelado.", invalidar: ["emails:"] });

  const colunas: Coluna<EnvioEmail>[] = [
    {
      id: "para", titulo: "Para", principal: true,
      celula: e => (
        <span className="block min-w-0">
          <span className="block font-semibold text-tinta truncate">{e.nome || e.para}</span>
          <span className="block text-xs text-tinta-suave truncate">{e.para}</span>
        </span>
      ),
    },
    { id: "assunto", titulo: "Assunto", celula: e => <span className="block max-w-[320px] truncate" title={e.assunto}>{e.assunto}</span> },
    { id: "regra", titulo: "Regra", esconderMovel: true, celula: e => <span className="text-tinta-suave">{e.regra}{e.teste ? " · teste" : ""}</span> },
    { id: "quando", titulo: "Quando", celula: e => dataHora(e.enviado ?? e.agendado) },
    {
      id: "estado", titulo: "Estado",
      celula: e => (
        <span className="inline-flex gap-1.5 flex-wrap">
          <Estado tom={ESTADO[e.estado].tom} title={e.erro ?? undefined}>{ESTADO[e.estado].rotulo}</Estado>
          {e.aberto && <Estado tom="neutro">Aberto</Estado>}
        </span>
      ),
    },
  ];
  const ativos = [f.regra, f.estado, f.q, f.de, f.ate].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Filtros
        pesquisa={{ valor: f.q, onMudar: q => setF({ q }), placeholder: "Email, nome ou assunto" }}
        selecoes={[
          { chave: "regra", rotulo: "Regra", vazio: "Regra: todas", valor: f.regra, onMudar: regra => setF({ regra }), opcoes: (regras?.rules ?? []).map(r => ({ valor: String(r.id), rotulo: r.nome })) },
          {
            chave: "estado", rotulo: "Estado", vazio: "Estado: todos", valor: f.estado, onMudar: estado => setF({ estado }),
            opcoes: (Object.keys(ESTADO) as EnvioEmail["estado"][]).map(k => ({ valor: k, rotulo: ESTADO[k].rotulo })),
          },
        ]}
        periodo={{ de: f.de, ate: f.ate, onMudar: (de, ate) => setF({ de, ate }) }}
        ativos={ativos}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <Cartao semPadding>
        <Tabela
          rotulo="Histórico de envios"
          linhas={dados?.linhas ?? []}
          colunas={colunas}
          chave={e => e.id}
          onLinha={setAberto}
          aCarregar={aCarregar && !dados}
          acoesLinha={gerir ? e => (
            e.estado === "failed" ? <Botao tamanho="sm" variante="fantasma" aCarregar={reenviar.aCorrer} onClick={() => void reenviar.correr(e.id)}>Reenviar</Botao>
              : e.estado === "queued" ? <Botao tamanho="sm" variante="fantasma" aCarregar={cancelar.aCorrer} onClick={() => void cancelar.correr(e.id)}>Cancelar</Botao>
                : null
          ) : undefined}
          vazio={<Vazio titulo={ativos ? "Nenhum envio com estes filtros" : "Ainda não saiu nenhum email"} acao={ativos ? <Botao tamanho="sm" onClick={limpar}>Limpar filtros</Botao> : undefined} />}
        />
        {dados && <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ pagina: String(p) })} />}
      </Cartao>

      <Modal aberto={Boolean(aberto)} onFechar={() => setAberto(null)} titulo="Email enviado" largura="lg"
        rodape={<Botao onClick={() => setAberto(null)}>Fechar</Botao>}>
        {aberto?.erro && <p role="alert" className="m-0 mb-3 text-sm text-perigo">Erro: {aberto.erro}</p>}
        <MolduraEmail assunto={envio?.envio.assunto ?? aberto?.assunto} para={envio?.envio.para ?? aberto?.para} html={envio?.envio.html} aCarregar={aCarregarEnvio} />
      </Modal>
    </div>
  );
}
