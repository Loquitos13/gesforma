// Separador Modelos: modelos de proposta e de contrato lado a lado, com o número de usos; abrem no editor.
import { apiModelos, type TipoModelo } from "../../../partilhado/api/crmDiretorio";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Aviso, ErroCarregar, Esqueleto, data } from "../../../partilhado/ui";
import { useGestao } from "./comum";

const NOME: Record<TipoModelo, string> = { proposta: "Modelos de proposta", contrato: "Modelos de contrato" };

export function TabModelos({ onAbrir }: { onAbrir: (tipo: TipoModelo, id: number | null) => void }) {
  const gestao = useGestao();
  return (
    <>
      {!gestao && <Aviso tom="info">Os modelos são geridos pela administração e pela secretaria. Pode consultá-los e usá-los nas propostas e contratos.</Aviso>}
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {(["proposta", "contrato"] as TipoModelo[]).map(tipo => <Cartao key={tipo} tipo={tipo} gestao={gestao} onAbrir={onAbrir} />)}
      </div>
    </>
  );
}

function Cartao({ tipo, gestao, onAbrir }: { tipo: TipoModelo; gestao: boolean; onAbrir: (tipo: TipoModelo, id: number | null) => void }) {
  const { dados, erro, aCarregar, recarregar } = useRecurso(`crm:modelos:${tipo}`, signal => apiModelos(tipo, { signal }));
  return (
    <section className="bg-white border border-linha rounded-[10px] p-4 flex flex-col gap-2.5">
      <div className="flex items-center">
        <h2 className="m-0 text-[15px] font-semibold text-tinta">{NOME[tipo]}</h2>
        {gestao && (
          <button type="button" onClick={() => onAbrir(tipo, null)} className="ml-auto border-0 bg-transparent p-0 text-ligacao font-semibold text-sm cursor-pointer hover:underline">
            Novo modelo
          </button>
        )}
      </div>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      {aCarregar && !dados ? <Esqueleto linhas={3} /> : null}
      {dados && dados.modelos.length === 0 && (
        <p className="m-0 py-2.5 border-t border-[#EEF0F3] text-[13px] text-tinta-suave">
          Ainda sem modelos. Um modelo guarda o texto que se repete; os campos automáticos preenchem o cliente, o curso e o valor.
        </p>
      )}
      {(dados?.modelos ?? []).map(m => (
        <div key={m.id} className="flex items-center gap-3 py-2.5 border-t border-[#EEF0F3]">
          <span className="flex-1 min-w-0">
            <span className="block text-sm text-tinta truncate">{m.nome}</span>
            {(m.curso || m.alteradoEm) && <span className="block text-xs text-tinta-suave truncate">{[m.curso, m.alteradoEm ? `alterado a ${data(m.alteradoEm)}` : ""].filter(Boolean).join(" · ")}</span>}
          </span>
          <span className="num text-xs text-tinta-suave whitespace-nowrap">usado {m.usos}×</span>
          <button type="button" onClick={() => onAbrir(tipo, m.id)} className="border-0 bg-transparent p-0 text-ligacao font-semibold text-[13px] cursor-pointer hover:underline">
            {gestao ? "Editar" : "Ver"}
          </button>
        </div>
      ))}
    </section>
  );
}
