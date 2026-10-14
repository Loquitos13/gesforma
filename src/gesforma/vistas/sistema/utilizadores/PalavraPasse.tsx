// Definir uma palavra-passe nova a outro utilizador e mostrar a temporária (uma só vez).
import { useEffect, useState } from "react";
import { apiNovaPalavraPasse, type Utilizador } from "../../../../partilhado/api/utilizadores";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { gerarPalavraPasse, mensagemPalavraPasse, palavraPasseValida } from "../../../../partilhado/passwordPolicy";
import { Aviso, Botao, Caixa, Campo, Entrada, Modal } from "../../../../partilhado/ui";

export function PalavraPasseTemporaria({ email, password }: { email: string; password: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-3">
      <Aviso tom="aviso" titulo="Guarde já esta palavra-passe">Não volta a ser mostrada. Envie-a por um canal seguro, separada do email.</Aviso>
      <dl className="m-0 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
        <dt className="text-tinta-suave">Utilizador</dt><dd className="m-0 font-semibold break-all">{email}</dd>
        <dt className="text-tinta-suave">Palavra-passe</dt><dd className="m-0 font-mono break-all">{password}</dd>
      </dl>
      <Botao tamanho="sm" onClick={() => { void navigator.clipboard?.writeText(password).then(() => setCopiado(true)); }}>
        {copiado ? "Copiada" : "Copiar palavra-passe"}
      </Botao>
    </div>
  );
}

export function NovaPalavraPasse({ aberto, onFechar, utilizador, onFeito }: {
  aberto: boolean; onFechar: () => void; utilizador: Utilizador; onFeito: () => void;
}) {
  const [password, setPassword] = useState("");
  const [terminar, setTerminar] = useState(true);
  const [mudar, setMudar] = useState(true);
  const [feito, setFeito] = useState(false);
  const definir = useAccao(apiNovaPalavraPasse, { ok: "Palavra-passe alterada.", invalidar: ["utilizadores:"] });
  useEffect(() => {
    if (aberto) { setPassword(gerarPalavraPasse()); setTerminar(true); setMudar(true); setFeito(false); }
  }, [aberto]);
  const erro = password && !palavraPasseValida(password) ? mensagemPalavraPasse(password) : null;

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={`Nova palavra-passe · ${utilizador.name}`}
      largura="sm"
      rodape={feito ? <Botao variante="primario" onClick={onFechar}>Concluir</Botao> : (
        <>
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" disabled={!password || Boolean(erro)} aCarregar={definir.aCorrer}
            onClick={() => void definir.correr(utilizador.id, password, { revokeSessions: terminar, mustChangePassword: mudar }).then(r => { if (r) { setFeito(true); onFeito(); } })}>
            Definir
          </Botao>
        </>
      )}
    >
      {feito ? <PalavraPasseTemporaria email={utilizador.email} password={password} /> : (
        <div className="space-y-3">
          <Campo rotulo="Palavra-passe" erro={erro}>
            {a => (
              <div className="flex gap-2">
                <Entrada {...a} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="font-mono" />
                <Botao onClick={() => setPassword(gerarPalavraPasse())}>Gerar</Botao>
              </div>
            )}
          </Campo>
          <Caixa rotulo="Terminar as sessões abertas" checked={terminar} onChange={e => setTerminar(e.target.checked)} />
          <Caixa rotulo="Pedir uma nova no próximo acesso" checked={mudar} onChange={e => setMudar(e.target.checked)} />
        </div>
      )}
    </Modal>
  );
}
