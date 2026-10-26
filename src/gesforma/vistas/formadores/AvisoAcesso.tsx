import { useState } from "react";
import type { AcessoCriado } from "../../../partilhado/api/formadores";
import { Aviso, Botao } from "../../../partilhado/ui";

/** Mostra uma única vez a palavra-passe temporária da conta criada para o formador. */
export function AvisoAcesso({ acesso, onFechar }: { acesso: AcessoCriado; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  if (!acesso) return null;
  const password = acesso.password;
  return (
    <Aviso
      tom="sucesso"
      titulo={acesso.criado ? "Conta de formador criada" : acesso.password ? "Nova palavra-passe temporária" : "Ficha ligada a uma conta que já existia"}
      acao={<Botao variante="fantasma" tamanho="sm" onClick={onFechar}>Fechar</Botao>}
    >
      <p className="m-0">Utilizador: <strong>{acesso.email}</strong></p>
      {password && (
        <p className="m-0 mt-1">
          Palavra-passe temporária: <code className="num font-semibold">{password}</code>{" "}
          <Botao
            variante="ligacao"
            tamanho="sm"
            onClick={() => { void navigator.clipboard?.writeText(password).then(() => setCopiado(true)); }}
          >
            {copiado ? "Copiada" : "Copiar"}
          </Botao>
          <span className="block text-xs mt-1">Guarde-a agora: não volta a ser mostrada. No primeiro acesso, o formador tem de a mudar.</span>
        </p>
      )}
    </Aviso>
  );
}
