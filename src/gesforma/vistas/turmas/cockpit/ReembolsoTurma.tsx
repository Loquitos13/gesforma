// Ficheiros do pedido de reembolso da turma (Financiada): a execução física e as despesas, um de cada por turma,
// preenchidos pelo GesForma e guardados na pasta da turma na Drive. Ao abrir, a cópia da Drive actualiza-se
// se os dados mudaram; a descarga é sempre gerada com os dados do momento.
import { useEffect, useRef, useState } from "react";
import {
  apiAtualizarReembolso, apiDescarregarReembolso, apiReembolso, type EstadoReembolso, type FicheiroReembolso, type TipoReembolso,
} from "../../../../partilhado/api/reembolso";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { toastError } from "../../../../partilhado/toastBus";
import { Aviso, Botao, Cartao, ErroCarregar, Esqueleto, Estado, dataHora, num } from "../../../../partilhado/ui";

const ROTULO: Record<TipoReembolso, { titulo: string; descricao: string }> = {
  "execucao-fisica": { titulo: "Execução física", descricao: "Modelo oficial de participantes: uma linha por formando, com horas e dias de presença." },
  despesas: { titulo: "Despesas", descricao: "As despesas desta turma, com as colunas do template de despesas." },
};

const formandos = (n: number) => `${num(n)} ${n === 1 ? "formando" : "formandos"}`;

/** Nome do campo a meio da frase: as siglas (NIF, NISS) ficam em maiúsculas. */
const minuscula = (c: string) => (/^[A-Z]+$/.test(c) ? c : c.charAt(0).toLowerCase() + c.slice(1));

/** «NIF a 2 formandos, código postal a 1 formando». */
function frase(porCampo: { campo: string; formandos: number }[]) {
  return porCampo.map(c => `${minuscula(c.campo)} a ${formandos(c.formandos)}`).join(", ");
}

function lista(campos: string[]) {
  const baixo = campos.map(minuscula);
  return baixo.length > 1 ? `${baixo.slice(0, -1).join(", ")} e ${baixo[baixo.length - 1]}` : baixo.join("");
}

export function ReembolsoTurma({ turmaId }: { turmaId: number }) {
  const chave = `despesas:reembolso:${turmaId}`;
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, signal => apiReembolso(turmaId, { signal }));
  const [aAtualizar, setAAtualizar] = useState(false);
  const [aDescarregar, setADescarregar] = useState<TipoReembolso | null>(null);
  const [erroDrive, setErroDrive] = useState("");
  const tentado = useRef(false);

  async function atualizar(forcar: boolean) {
    setAAtualizar(true);
    try {
      const r = await apiAtualizarReembolso(turmaId, forcar);
      const erros = Object.values(r.erros ?? {}).filter(Boolean);
      setErroDrive(erros[0] ?? "");
      invalidar(chave);
    } catch (e) {
      if (forcar) toastError(e, "Não foi possível actualizar na Drive.");
      else setErroDrive(e instanceof Error ? e.message : "Não foi possível actualizar na Drive.");
    } finally {
      setAAtualizar(false);
    }
  }

  // Os dados mudaram desde a última cópia (presenças, formandos, despesas…): actualiza-se uma vez ao abrir.
  useEffect(() => {
    if (!dados || tentado.current || !dados.ficheiros.some(f => f.desatualizado)) return;
    tentado.current = true;
    void atualizar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados]);

  async function descarregar(tipo: TipoReembolso) {
    setADescarregar(tipo);
    try {
      await apiDescarregarReembolso(turmaId, tipo);
      invalidar(chave);
    } catch (e) {
      toastError(e, "Não foi possível descarregar.");
    } finally {
      setADescarregar(null);
    }
  }

  return (
    <Cartao
      titulo="Ficheiros do reembolso"
      subtitulo="Um ficheiro de cada por turma, preenchido com os dados do GesForma e guardado na pasta da turma na Drive."
      acoes={<Botao tamanho="sm" aCarregar={aAtualizar} onClick={() => void atualizar(true)}>Atualizar na Drive</Botao>}
    >
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      {aCarregar && !dados ? <Esqueleto linhas={3} /> : null}
      {dados && (
        <div className="flex flex-col gap-4">
          <ul className="m-0 flex list-none flex-col divide-y divide-linha p-0">
            {dados.ficheiros.map(f => (
              <LinhaFicheiro key={f.tipo} f={f} aDescarregar={aDescarregar === f.tipo} aAtualizar={aAtualizar} onDescarregar={() => void descarregar(f.tipo)} />
            ))}
          </ul>
          {erroDrive && (
            <Aviso tom="aviso" titulo="A cópia na Drive não foi actualizada">
              {erroDrive} A descarga continua a sair com os dados actuais.
            </Aviso>
          )}
          <EmFalta dados={dados.execucaoFisica} />
        </div>
      )}
    </Cartao>
  );
}

function LinhaFicheiro({ f, aDescarregar, aAtualizar, onDescarregar }: { f: FicheiroReembolso; aDescarregar: boolean; aAtualizar: boolean; onDescarregar: () => void }) {
  const r = ROTULO[f.tipo];
  const estado = !f.drive
    ? <Estado tom="neutro">{aAtualizar ? "A guardar na Drive…" : "Ainda sem cópia na Drive"}</Estado>
    : f.desatualizado
      ? <Estado tom="aviso">{aAtualizar ? "A actualizar…" : "Desactualizado na Drive"}</Estado>
      : <Estado tom="sucesso">Em dia na Drive</Estado>;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-tinta">{r.titulo} {estado}</p>
        <p className="m-0 mt-0.5 text-xs text-tinta-suave">{r.descricao}</p>
        <p className="m-0 mt-0.5 text-xs text-tinta-suave">
          {f.atualizadoEm ? `Última cópia: ${dataHora(f.atualizadoEm)}` : "Sem cópia guardada"}
          {f.drive?.pasta ? ` · ${f.drive.pasta}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {f.drive && (
          <a href={f.drive.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-ligacao hover:underline">
            {f.drive.guardadoEm === "google" ? "Abrir na Drive" : "Abrir cópia"}
          </a>
        )}
        <Botao tamanho="sm" aCarregar={aDescarregar} onClick={onDescarregar}>Descarregar Excel</Botao>
      </div>
    </li>
  );
}

function EmFalta({ dados }: { dados: EstadoReembolso["execucaoFisica"] }) {
  if (!dados.formandos) {
    return <p className="m-0 text-[13px] text-tinta-suave">A execução física fica vazia até haver formandos na turma.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {dados.porCampo.length ? (
        <Aviso tom="aviso" titulo={`Execução física: faltam ${frase(dados.porCampo)}`}>
          <details>
            <summary className="cursor-pointer">Ver por formando</summary>
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
              {dados.porFormando.map(f => <li key={f.id}><strong>{f.nome}</strong>: {f.falta.join(", ")}</li>)}
            </ul>
          </details>
        </Aviso>
      ) : (
        <p className="m-0 text-[13px] text-sucesso">Os {formandos(dados.formandos)} têm NIF, código postal, telefone, e-mail e data de inscrição.</p>
      )}
      {dados.semCodigoPostalLocal && (
        <p className="m-0 text-[13px] text-tinta-suave">O local da turma não tem código postal na morada (Edição de cursos › Locais): a coluna do local de realização fica em branco.</p>
      )}
      <p className="m-0 text-[13px] text-tinta-suave">
        O GesForma ainda não recolhe {lista(dados.naoRecolhidos)}: complete-os no ficheiro, para cada formando, antes de submeter.
      </p>
    </div>
  );
}
