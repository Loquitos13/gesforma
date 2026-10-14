// Nova proposta para um cliente: modelo, curso, valor, comercial e texto.
import { useEffect, useState } from "react";
import { apiModelos } from "../../../partilhado/api/crmDiretorio";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Botao, Campo, Entrada, Modal, Selecao } from "../../../partilhado/ui";
import { numeroDe, useEu } from "./comum";
import { EditorDocumento } from "./EditorDocumento";

export type DadosProposta = { curso: string; valor: number; corpo: string; templateId: number | null; comercialId: string; notas: string };

export function FormProposta({ aberto, onFechar, onGravar, aCarregar, cliente }: {
  aberto: boolean;
  onFechar: () => void;
  onGravar: (d: DadosProposta) => void;
  aCarregar?: boolean;
  cliente: { nome: string; email: string };
}) {
  const eu = useEu();
  const cursos = useOpcoes("cursos", { regime: "gold" });
  const comerciais = useOpcoes("comerciais");
  const modelos = useRecurso(aberto ? "crm:modelos:proposta" : null, signal => apiModelos("proposta", { signal }));
  const [d, setD] = useState({ templateId: "", curso: "", valor: "", corpo: "", comercialId: eu.id, notas: "" });
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setD({ templateId: "", curso: "", valor: "", corpo: "", comercialId: eu.id, notas: "" });
      setErro(null);
    }
  }, [aberto, eu.id]);

  function escolherModelo(id: string) {
    const m = modelos.dados?.modelos.find(x => String(x.id) === id);
    setD(x => ({
      ...x,
      templateId: id,
      curso: x.curso || m?.curso || "",
      valor: x.valor || (m?.valor ? String(m.valor) : ""),
      corpo: x.corpo || m?.corpo || "",
    }));
  }

  function gravar() {
    if (!d.curso.trim() && !d.corpo.trim()) return setErro("Indique o curso ou escreva o texto da proposta.");
    onGravar({
      curso: d.curso.trim(), valor: numeroDe(d.valor), corpo: d.corpo, templateId: d.templateId ? Number(d.templateId) : null,
      comercialId: d.comercialId || eu.id, notas: d.notas.trim(),
    });
  }

  const listaComerciais = comerciais.selecao.some(o => o.valor === eu.id) ? comerciais.selecao : [{ valor: eu.id, rotulo: eu.name }, ...comerciais.selecao];

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={`Nova proposta · ${cliente.nome}`}
      largura="lg"
      rodape={(
        <>
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={aCarregar} onClick={gravar}>Guardar proposta</Botao>
        </>
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Modelo" ajuda="Preenche o curso, o valor e o texto.">
          {p => (
            <Selecao {...p} value={d.templateId} onChange={e => escolherModelo(e.target.value)} vazio="Sem modelo"
              opcoes={(modelos.dados?.modelos ?? []).map(m => ({ valor: String(m.id), rotulo: m.nome }))} />
          )}
        </Campo>
        <Campo rotulo="Comercial">
          {p => <Selecao {...p} value={d.comercialId} onChange={e => setD({ ...d, comercialId: e.target.value })} opcoes={listaComerciais} />}
        </Campo>
        <Campo rotulo="Curso" erro={erro}>
          {p => (
            <>
              <Entrada {...p} list="propostas-cursos" value={d.curso} onChange={e => setD({ ...d, curso: e.target.value })} placeholder="Escolha ou escreva" />
              <datalist id="propostas-cursos">{cursos.opcoes.map(o => <option key={o.valor} value={o.valor} />)}</datalist>
            </>
          )}
        </Campo>
        <Campo rotulo="Valor (€)">
          {p => <Entrada {...p} inputMode="decimal" value={d.valor} onChange={e => setD({ ...d, valor: e.target.value })} placeholder="0" />}
        </Campo>
        <Campo rotulo="Notas internas" className="sm:col-span-2">
          {p => <Entrada {...p} value={d.notas} onChange={e => setD({ ...d, notas: e.target.value })} placeholder="Número de pessoas, horário pretendido…" />}
        </Campo>
        <div className="sm:col-span-2">
          <EditorDocumento
            titulo={`Proposta · ${d.curso || "formação"}`}
            valor={d.corpo}
            onMudar={corpo => setD({ ...d, corpo })}
            valores={{ cliente: cliente.nome, email: cliente.email, curso: d.curso, valor: numeroDe(d.valor) }}
          />
        </div>
      </div>
    </Modal>
  );
}
