// Segurança (só administração): variáveis de ambiente em falta e recifrar os dados com a chave actual.
import { useState } from "react";
import { apiAvisosSistema, apiRecifrar } from "../../../../partilhado/api/sistema";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Aviso, Botao, Cartao, ConfirmarPerigo, ErroCarregar, Esqueleto, num } from "../../../../partilhado/ui";

export function SeccaoSeguranca() {
  const { dados, erro, recarregar } = useRecurso("configuracoes:avisos", apiAvisosSistema);
  const [confirmar, setConfirmar] = useState(false);
  const recifrar = useAccao(apiRecifrar, {
    ok: r => (r.ilegiveis ? `${num(r.total)} valores recifrados; ${num(r.ilegiveis)} não se conseguiram ler.` : `${num(r.total)} valores recifrados com a chave actual.`),
    invalidar: ["configuracoes:avisos"],
  });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <Cartao><Esqueleto linhas={5} /></Cartao>;
  return (
    <div className="space-y-4">
      <Cartao titulo="Configuração do servidor" subtitulo="Variáveis de ambiente da Vercel. Nada disto bloqueia a plataforma: são avisos.">
        {dados.avisos.length === 0 ? (
          <Aviso tom="sucesso" titulo="Tudo definido">Os segredos e endereços do servidor estão configurados.</Aviso>
        ) : (
          <ul className="m-0 p-0 list-none space-y-2">
            {dados.avisos.map(a => (
              <li key={a.variavel}>
                <Aviso tom={a.nivel === "alto" ? "perigo" : "aviso"} titulo={a.variavel}>{a.mensagem}</Aviso>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <Cartao
        titulo="Cifra dos dados pessoais"
        subtitulo="Os dados pessoais e os segredos das integrações estão cifrados. Depois de mudar a chave, recifre para deixar de usar a antiga."
        acoes={<Botao variante="primario" aCarregar={recifrar.aCorrer} onClick={() => setConfirmar(true)}>Recifrar dados</Botao>}
      >
        <p className="m-0 text-sm text-tinta-suave">
          {dados.chavesAntigas > 0
            ? `O servidor conhece ${num(dados.chavesAntigas)} chave(s) antiga(s) e lê os dados com qualquer uma. Recifrar passa tudo para a chave actual.`
            : "Só há uma chave em uso."}
        </p>
      </Cartao>
      <ConfirmarPerigo
        aberto={confirmar}
        onFechar={() => setConfirmar(false)}
        titulo="Recifrar todos os dados?"
        acao="Recifrar"
        descricao="Corre numa só transacção e pode demorar alguns segundos. Os valores que nenhuma chave consegue ler ficam como estão."
        onConfirmar={async () => { await recifrar.correr(); }}
      />
    </div>
  );
}
