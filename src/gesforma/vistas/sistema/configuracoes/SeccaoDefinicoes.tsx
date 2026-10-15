// Formulário genérico de uma definição (`app_settings`): campos de texto, percentagens e sim/não.
import { useEffect, useState, type ReactNode } from "react";
import { apiGravarDefinicao } from "../../../../partilhado/api/configuracoes";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { AreaTexto, Aviso, Botao, Cartao, Campo, Entrada, Interruptor, Selecao, cx } from "../../../../partilhado/ui";

export type CampoDefinicao = {
  chave: string;
  rotulo: string;
  tipo?: "texto" | "email" | "pct" | "bool" | "numero" | "escolha" | "linhas";
  ajuda?: string;
  placeholder?: string;
  largo?: boolean;
  opcoes?: { valor: string; rotulo: string }[];
};

export function SeccaoDefinicoes({ id, titulo, descricao, campos, valores, soAdmin, podeEditar, extra }: {
  id: string;
  titulo: string;
  descricao?: ReactNode;
  campos: CampoDefinicao[];
  valores: Record<string, string> | undefined;
  soAdmin?: boolean;
  podeEditar: boolean;
  extra?: ReactNode;
}) {
  const inicial = () => Object.fromEntries(campos.map(c => [c.chave, valores?.[c.chave] ?? ""]));
  const [f, setF] = useState<Record<string, string>>(inicial);
  useEffect(() => { setF(inicial()); }, [valores]); // eslint-disable-line react-hooks/exhaustive-deps
  const gravar = useAccao(apiGravarDefinicao, { ok: `${titulo}: alterações gravadas.`, invalidar: ["configuracoes:"] });
  const alterado = campos.some(c => (f[c.chave] ?? "") !== (valores?.[c.chave] ?? ""));

  async function guardar() {
    // Mantém as outras chaves já gravadas nesta definição (o servidor substitui o conjunto).
    await gravar.correr(id, { ...(valores ?? {}), ...f });
  }

  return (
    <Cartao
      titulo={titulo}
      subtitulo={descricao}
      acoes={podeEditar ? (
        <>
          <Botao tamanho="sm" disabled={!alterado} onClick={() => setF(inicial())}>Descartar</Botao>
          <Botao tamanho="sm" variante="primario" disabled={!alterado} aCarregar={gravar.aCorrer} onClick={() => void guardar()}>Gravar</Botao>
        </>
      ) : undefined}
    >
      {!podeEditar && (
        <Aviso tom="info" className="mb-4">{soAdmin ? "Só a administração altera esta secção." : "Não tem permissão para alterar esta secção."}</Aviso>
      )}
      <fieldset disabled={!podeEditar} className="m-0 p-0 border-0 grid grid-cols-1 md:grid-cols-2 gap-4">
        {campos.map(c => c.tipo === "bool" ? (
          <div key={c.chave} className={cx("flex items-start gap-3 rounded-controlo border border-linha p-3", "md:col-span-2")}>
            <Interruptor rotulo={c.rotulo} ligado={f[c.chave] === "1"} desativado={!podeEditar} onMudar={v => setF({ ...f, [c.chave]: v ? "1" : "0" })} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-tinta">{c.rotulo}</span>
              {c.ajuda && <span className="block text-xs text-tinta-suave">{c.ajuda}</span>}
            </span>
          </div>
        ) : (
          <Campo key={c.chave} rotulo={c.rotulo} ajuda={c.ajuda} className={c.largo ? "md:col-span-2" : undefined}>
            {a => c.tipo === "escolha" ? (
              <Selecao {...a} opcoes={c.opcoes ?? []} value={f[c.chave] ?? ""} onChange={e => setF({ ...f, [c.chave]: e.target.value })} />
            ) : c.tipo === "linhas" ? (
              <AreaTexto {...a} rows={4} maxLength={400} placeholder={c.placeholder} value={f[c.chave] ?? ""} onChange={e => setF({ ...f, [c.chave]: e.target.value })} />
            ) : (
              <div className="relative">
                <Entrada
                  {...a}
                  type={c.tipo === "email" ? "email" : "text"}
                  inputMode={c.tipo === "pct" || c.tipo === "numero" ? "decimal" : undefined}
                  placeholder={c.placeholder}
                  value={f[c.chave] ?? ""}
                  maxLength={c.tipo === "pct" ? 5 : 200}
                  className={c.tipo === "pct" ? "pr-8" : undefined}
                  onChange={e => setF({ ...f, [c.chave]: c.tipo === "pct" || c.tipo === "numero" ? e.target.value.replace(/[^\d.,]/g, "") : e.target.value })}
                />
                {c.tipo === "pct" && <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-tinta-suave">%</span>}
              </div>
            )}
          </Campo>
        ))}
      </fieldset>
      {extra && <div className="mt-4">{extra}</div>}
    </Cartao>
  );
}
