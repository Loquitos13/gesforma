// Assinatura e selo (só administração): o certificado com que o GesForma sela os contratos assinados.
import { useState } from "react";
import { apiApagarSelo, apiCarregarSelo, apiGerarSelo, apiSelo } from "../../../../partilhado/api/assinaturas";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Aviso, Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Estado, data } from "../../../../partilhado/ui";

const INVALIDAR = ["configuracoes:selo"];

export function SeccaoSeloAssinatura() {
  const { dados, erro, recarregar } = useRecurso("configuracoes:selo", signal => apiSelo({ signal }));
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [apagar, setApagar] = useState(false);
  const [gerar, setGerar] = useState(false);
  const carregar = useAccao(apiCarregarSelo, { ok: "Certificado guardado.", invalidar: INVALIDAR });
  const gerarSelo = useAccao(apiGerarSelo, { ok: "Certificado gerado.", invalidar: INVALIDAR });
  const remover = useAccao(apiApagarSelo, { ok: "Certificado removido.", invalidar: INVALIDAR });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <Cartao><Esqueleto linhas={6} /></Cartao>;
  const s = dados.selo;

  return (
    <div className="space-y-4">
      <Cartao
        titulo="Assinatura e selo"
        subtitulo="Os contratos assinados no GesForma levam o selo da entidade: uma assinatura digital do PDF que prova que não foi alterado depois de assinado."
      >
        {!s ? (
          <Aviso tom="aviso" titulo="Sem certificado">
            Os contratos continuam a poder ser assinados (código por email e registo de provas), mas sem o selo da entidade no PDF.
          </Aviso>
        ) : (
          <dl className="m-0 grid gap-2 sm:grid-cols-2 text-sm">
            <div><dt className="text-tinta-suave">Titular</dt><dd className="m-0 text-tinta font-medium">{s.titular}</dd></div>
            <div><dt className="text-tinta-suave">Emitido por</dt><dd className="m-0 text-tinta">{s.emissor}{s.autoAssinado ? " (auto-assinado)" : ""}</dd></div>
            <div><dt className="text-tinta-suave">Validade</dt><dd className="m-0 text-tinta">{data(s.validoDe)} a {data(s.validoAte)} {s.expirado && <Estado tom="perigo">Expirado</Estado>}</dd></div>
            <div><dt className="text-tinta-suave">Actualizado</dt><dd className="m-0 text-tinta">{data(s.actualizadoEm)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-tinta-suave">Impressão digital (SHA-256)</dt><dd className="m-0"><code className="text-xs break-all">{s.fingerprint}</code></dd></div>
          </dl>
        )}
        {s?.autoAssinado && (
          <Aviso tom="info" className="mt-3" titulo="Certificado próprio">
            Garante a integridade e fica registado em cada contrato, mas não está na lista de confiança da Adobe: o leitor de PDF pode
            mostrar a assinatura como «não verificada». Para isso, compre um certificado de selo qualificado (por exemplo à Multicert ou à DigitalSign) e carregue-o aqui.
          </Aviso>
        )}
        {s && (
          <div className="mt-3">
            <Botao tamanho="sm" variante="fantasma" className="text-perigo" onClick={() => setApagar(true)}>Remover certificado</Botao>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Carregar certificado" subtitulo="Ficheiro .p12 ou .pfx com a chave privada. Fica cifrado na base de dados.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Ficheiro">
            {p => <input {...p} type="file" accept=".p12,.pfx,application/x-pkcs12" className="text-sm" onChange={e => setFicheiro(e.target.files?.[0] ?? null)} />}
          </Campo>
          <Campo rotulo="Palavra-passe do ficheiro">
            {p => <Entrada {...p} type="password" autoComplete="off" value={senha} onChange={e => setSenha(e.target.value)} />}
          </Campo>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Botao variante="primario" disabled={!ficheiro} aCarregar={carregar.aCorrer} onClick={async () => {
            if (!ficheiro) return;
            if (await carregar.correr(ficheiro, senha)) { setFicheiro(null); setSenha(""); }
          }}>Guardar certificado</Botao>
          <Botao aCarregar={gerarSelo.aCorrer} onClick={() => (s ? setGerar(true) : void gerarSelo.correr())}>Gerar certificado próprio</Botao>
        </div>
      </Cartao>

      <Aviso tom="info" titulo="Valor legal">
        A assinatura no GesForma (desenho ou nome escrito, com código por email e registo de provas) é uma assinatura eletrónica simples.
        Só a assinatura com o Cartão de Cidadão ou a Chave Móvel Digital (opção que o signatário também tem) é qualificada e equivale
        à assinatura manuscrita. Confirme com o jurista e com o financiador que tipo de assinatura exigem.
      </Aviso>

      <ConfirmarPerigo aberto={apagar} onFechar={() => setApagar(false)} titulo="Remover o certificado do selo?" acao="Remover"
        descricao="Os contratos já assinados mantêm o selo. Os próximos são assinados sem selo até carregar outro certificado."
        onConfirmar={async () => { await remover.correr(); }} />
      <ConfirmarPerigo aberto={gerar} onFechar={() => setGerar(false)} titulo="Substituir pelo certificado próprio?" acao="Gerar e substituir"
        descricao="O certificado actual é substituído. Os contratos já assinados mantêm o selo com que foram assinados."
        onConfirmar={async () => { await gerarSelo.correr(); }} />
    </div>
  );
}
