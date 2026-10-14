// O email tal como sai: o servidor desenha o HTML com dados reais e aqui mostra-se numa moldura isolada.
import { Esqueleto, cx } from "../../../../partilhado/ui";

export function MolduraEmail({ assunto, de, para, html, aCarregar, className }: {
  assunto?: string; de?: string; para?: string; html?: string; aCarregar?: boolean; className?: string;
}) {
  return (
    <div className={cx("rounded-cartao border border-linha bg-fundo overflow-hidden", className)}>
      <div className="px-4 py-3 bg-superficie border-b border-linha space-y-0.5">
        <p className="m-0 text-sm font-semibold text-tinta truncate" title={assunto}>{assunto || "Assunto do email"}</p>
        {de && <p className="m-0 text-xs text-tinta-suave truncate">De {de}</p>}
        {para && <p className="m-0 text-xs text-tinta-suave truncate">Para {para}</p>}
      </div>
      {aCarregar && !html ? (
        <div className="p-4"><Esqueleto linhas={8} /></div>
      ) : (
        <iframe
          title="Pré-visualização do email"
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={html ?? ""}
          className="block w-full h-[460px] bg-white border-0"
        />
      )}
    </div>
  );
}
