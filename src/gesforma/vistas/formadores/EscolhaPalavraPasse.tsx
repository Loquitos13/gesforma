// Palavra-passe do acesso do formador: gerada (temporária, troca obrigatória no primeiro acesso) ou escolhida pela
// equipa (fica, salvo se pedir a troca). Em qualquer caso o formador pode mudá-la depois em «Alterar palavra-passe».
import { useState } from "react";
import { errosPalavraPasse, gerarPalavraPasse } from "../../../partilhado/passwordPolicy";
import { Botao, Caixa, Entrada } from "../../../partilhado/ui";

export type EscolhaAcesso = { modo: "gerar" | "definir"; password: string; temporaria: boolean };

export const ESCOLHA_INICIAL: EscolhaAcesso = { modo: "gerar", password: "", temporaria: false };

/** O que se envia ao servidor: vazio = gerar uma temporária. */
export function corpoAcesso(e: EscolhaAcesso) {
  return e.modo === "definir" ? { password: e.password, temporaria: e.temporaria } : {};
}

/** Mensagem de erro da palavra-passe escolhida (ou ""). */
export function erroEscolha(e: EscolhaAcesso) {
  if (e.modo !== "definir") return "";
  if (!e.password) return "Escreva a palavra-passe do formador, ou escolha gerar uma temporária.";
  const erros = errosPalavraPasse(e.password);
  return erros.length ? `A palavra-passe tem de incluir ${erros.join(", ")}.` : "";
}

export function EscolhaPalavraPasse({ valor, onMudar, nome }: { valor: EscolhaAcesso; onMudar: (e: EscolhaAcesso) => void; nome: string }) {
  const [ver, setVer] = useState(false);
  const mudar = (p: Partial<EscolhaAcesso>) => onMudar({ ...valor, ...p });
  const faltas = valor.modo === "definir" && valor.password ? errosPalavraPasse(valor.password) : [];
  const opcao = (modo: EscolhaAcesso["modo"], rotulo: string, ajuda: string) => (
    <label className="flex cursor-pointer items-start gap-2">
      <input type="radio" name={nome} className="mt-1" checked={valor.modo === modo} onChange={() => mudar({ modo })} />
      <span><span className="font-medium text-tinta">{rotulo}</span><span className="block text-xs text-tinta-suave">{ajuda}</span></span>
    </label>
  );
  return (
    <fieldset className="space-y-2 text-[13px]">
      <legend className="sr-only">Palavra-passe do acesso</legend>
      {opcao("gerar", "Gerar palavra-passe temporária", "Mostra-se uma vez; o formador tem de a mudar no primeiro acesso.")}
      {opcao("definir", "Definir a palavra-passe", "Pode ficar assim; o formador pode mudá-la quando quiser.")}
      {valor.modo === "definir" && (
        <div className="space-y-2 pl-6">
          <div className="flex flex-wrap items-center gap-2">
            <Entrada aria-label="Palavra-passe do formador" type={ver ? "text" : "password"} autoComplete="new-password" className="min-w-[14rem] flex-1"
              value={valor.password} onChange={e => mudar({ password: e.target.value })} />
            <Botao variante="fantasma" tamanho="sm" onClick={() => setVer(v => !v)}>{ver ? "Esconder" : "Mostrar"}</Botao>
            <Botao variante="secundario" tamanho="sm" onClick={() => { mudar({ password: gerarPalavraPasse() }); setVer(true); }}>Sugerir</Botao>
          </div>
          <p className={`m-0 text-xs ${faltas.length ? "text-aviso" : "text-tinta-suave"}`}>
            {faltas.length ? `Falta: ${faltas.join(", ")}.` : "Pelo menos 10 caracteres, com maiúscula, minúscula, algarismo e símbolo."}
          </p>
          <Caixa rotulo="Pedir ao formador para a mudar no primeiro acesso" checked={valor.temporaria} onChange={() => mudar({ temporaria: !valor.temporaria })} />
        </div>
      )}
    </fieldset>
  );
}
