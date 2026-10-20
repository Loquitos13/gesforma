// Avaliações Google: a chave da Places API e a ficha da ENA. O site mostra-as no bloco Testemunhos.
import { useEffect, useState } from "react";
import {
  apiAtualizarAvaliacoesGoogle, apiAvaliacoesGoogle, apiDesligarAvaliacoesGoogle, apiGravarAvaliacoesGoogle,
} from "../../../../partilhado/api/configuracoes";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Aviso, Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Estado } from "../../../../partilhado/ui";
import { fmtDataHoraLisboa } from "../../../../partilhado/horaLisboa";

export function SeccaoAvaliacoesGoogle() {
  const { dados: s, erro, recarregar } = useRecurso("configuracoes:google-avaliacoes", apiAvaliacoesGoogle);
  const [f, setF] = useState({ placeId: "", chave: "" });
  const [desligar, setDesligar] = useState(false);
  useEffect(() => { if (s) setF({ placeId: s.placeId, chave: "" }); }, [s]);
  const gravar = useAccao(apiGravarAvaliacoesGoogle, { ok: "Ligado. As avaliações já aparecem no bloco Testemunhos do site.", invalidar: ["configuracoes:"] });
  const atualizar = useAccao(apiAtualizarAvaliacoesGoogle, { ok: "Avaliações atualizadas.", invalidar: ["configuracoes:"] });
  const sair = useAccao(apiDesligarAvaliacoesGoogle, { ok: "Avaliações Google desligadas.", invalidar: ["configuracoes:"] });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!s) return <Cartao><Esqueleto linhas={6} /></Cartao>;
  const quando = s.atualizadoEm ? fmtDataHoraLisboa(s.atualizadoEm) : null;

  return (
    <Cartao
      titulo="Avaliações Google"
      subtitulo="As avaliações da ficha da ENA no Google aparecem no bloco Testemunhos do site (se ligar a opção no editor)."
      acoes={s.configurado ? <Botao onClick={() => setDesligar(true)}>Desligar</Botao> : undefined}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Estado tom={s.configurado ? "sucesso" : "neutro"} ponto>{s.configurado ? "Ligado" : "Por configurar"}</Estado>
          {s.configurado && (
            <span className="text-tinta-suave">
              {s.rating != null ? `${s.rating.toLocaleString("pt-PT")} ★ · ${s.total} avaliações no Google · ` : ""}
              {s.quantas} com texto guardadas{quando ? ` · atualizado a ${quando}` : ""}
            </span>
          )}
        </div>
        {s.erro && <Aviso tom="aviso" titulo="O último pedido à Google falhou">{s.erro} O site continua a mostrar as avaliações guardadas.</Aviso>}
        {!s.configurado && (
          <ol className="m-0 pl-5 text-[13px] text-tinta-suave space-y-1 list-decimal">
            <li>Google Cloud Console → projeto da ENA → ative a «Places API (New)» (precisa de faturação ativa; o uso do site cabe no crédito mensal gratuito).</li>
            <li>Credenciais → «Criar chave de API» e restrinja-a à Places API (New).</li>
            <li>O Place ID da ficha da ENA encontra-se na página «Place ID Finder» da Google (pesquise «ENA» e copie o ID que começa por ChIJ).</li>
            <li>Cole os dois abaixo e grave. A Google devolve no máximo as 5 avaliações mais relevantes; renovam-se uma vez por dia.</li>
          </ol>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo rotulo="Place ID da ficha da ENA" obrigatorio>
            {a => <Entrada {...a} value={f.placeId} autoComplete="off" placeholder="ChIJ…" onChange={e => setF({ ...f, placeId: e.target.value.trim() })} />}
          </Campo>
          <Campo rotulo="Chave da API" ajuda={s.temChave ? "Já gravada: deixe vazio para manter." : undefined}>
            {a => <Entrada {...a} type="password" autoComplete="new-password" value={f.chave} onChange={e => setF({ ...f, chave: e.target.value.trim() })} />}
          </Campo>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {s.configurado && <Botao aCarregar={atualizar.aCorrer} onClick={() => void atualizar.correr()}>Atualizar agora</Botao>}
          <Botao variante="primario" disabled={f.placeId.length < 10 || (!s.temChave && f.chave.length < 20)} aCarregar={gravar.aCorrer}
            onClick={() => void gravar.correr({ placeId: f.placeId, chave: f.chave || undefined })}>
            Gravar e testar
          </Botao>
        </div>
      </div>
      <ConfirmarPerigo aberto={desligar} onFechar={() => setDesligar(false)} titulo="Desligar as avaliações Google?" acao="Desligar"
        descricao="A chave e as avaliações guardadas são apagadas. O site deixa de mostrar avaliações do Google (os testemunhos escritos à mão ficam)."
        onConfirmar={async () => { await sair.correr(); }} />
    </Cartao>
  );
}
