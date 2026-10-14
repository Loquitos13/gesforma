import type { ReactNode } from "react";
import { Botao } from "./Botao";
import { cx } from "./formatos";

/** Lista ou secção sem dados: diz porquê e o que fazer. */
export function Vazio({ titulo, descricao, acao, compacto, className }: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("text-center", compacto ? "py-6 px-4" : "py-12 px-6", className)}>
      <p className="m-0 text-sm font-semibold text-tinta">{titulo}</p>
      {descricao && <p className="m-0 mt-1 text-[13px] text-tinta-suave max-w-md mx-auto">{descricao}</p>}
      {acao && <div className="mt-4 flex justify-center gap-2 flex-wrap">{acao}</div>}
    </div>
  );
}

/** Bloco cinzento animado enquanto os dados chegam (em vez de dados de exemplo). */
export function Esqueleto({ linhas = 3, altura = "h-4", className }: { linhas?: number; altura?: string; className?: string }) {
  return (
    <div className={cx("space-y-2.5", className)} aria-hidden="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <span key={i} className={cx("block rounded bg-linha-suave animate-pulse", altura)} style={{ width: `${92 - ((i * 17) % 35)}%` }} />
      ))}
    </div>
  );
}

/** Falhou o carregamento: mensagem e "Tentar de novo". */
export function ErroCarregar({ erro, onTentar, className }: { erro: unknown; onTentar?: () => void; className?: string }) {
  const msg = erro instanceof Error ? erro.message : "Não foi possível carregar.";
  return (
    <div role="alert" className={cx("rounded-cartao border border-perigo/30 bg-perigo-suave px-4 py-3 flex items-center gap-3 flex-wrap", className)}>
      <p className="m-0 text-sm text-perigo flex-1">Não foi possível carregar. {msg !== "pedido recusado" ? msg : ""}</p>
      {onTentar && <Botao tamanho="sm" variante="secundario" onClick={onTentar}>Tentar de novo</Botao>}
    </div>
  );
}

/** Aviso dentro de um ecrã (informação, atenção, erro). */
export function Aviso({ tom = "info", titulo, children, acao, className }: {
  tom?: "info" | "aviso" | "perigo" | "sucesso";
  titulo?: ReactNode;
  children?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  const cores = {
    info: "border-ligacao/25 bg-ligacao-suave text-ligacao-forte",
    aviso: "border-aviso/30 bg-aviso-suave text-aviso",
    perigo: "border-perigo/30 bg-perigo-suave text-perigo",
    sucesso: "border-sucesso/30 bg-sucesso-suave text-sucesso",
  }[tom];
  return (
    <div role={tom === "perigo" ? "alert" : "status"} className={cx("rounded-cartao border px-4 py-3 flex items-start gap-3 flex-wrap", cores, className)}>
      <div className="flex-1 min-w-0 text-sm">
        {titulo && <p className="m-0 font-semibold">{titulo}</p>}
        {children && <div className={cx(Boolean(titulo) && "mt-0.5", "text-[13px]")}>{children}</div>}
      </div>
      {acao}
    </div>
  );
}
