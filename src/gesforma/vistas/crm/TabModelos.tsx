// Separador Modelos: modelos de proposta e de contrato, com o número de usos e o editor.
import { useEffect, useRef, useState } from "react";
import {
  apiAlterarModelo, apiApagarModelo, apiCriarModelo, apiModelos, type Modelo, type TipoModelo,
} from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  Aviso, Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Modal, PainelLateral, Selecao, Vazio, data, eur, num,
} from "../../../partilhado/ui";
import { numeroDe, useGestao } from "./comum";
import { EditorDocumento } from "./EditorDocumento";

type Aberto = { tipo: TipoModelo; modelo: Modelo | null };
const NOME: Record<TipoModelo, string> = { proposta: "Modelos de proposta", contrato: "Modelos de contrato" };

export function TabModelos({ novo }: { novo: number }) {
  const gestao = useGestao();
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [escolherTipo, setEscolherTipo] = useState(false);
  const inicial = useRef(novo);
  useEffect(() => { if (novo !== inicial.current) setEscolherTipo(true); }, [novo]);

  return (
    <div className="space-y-4">
      {!gestao && <Aviso tom="info">Os modelos são geridos pela administração e pela secretaria. Pode consultá-los e usá-los nas propostas e contratos.</Aviso>}
      <div className="grid gap-5 lg:grid-cols-2">
        {(["proposta", "contrato"] as TipoModelo[]).map(tipo => (
          <ListaModelos key={tipo} tipo={tipo} gestao={gestao} onAbrir={m => setAberto({ tipo, modelo: m })} onNovo={() => setAberto({ tipo, modelo: null })} />
        ))}
      </div>
      <EditorModelo aberto={aberto} gestao={gestao} onFechar={() => setAberto(null)} />
      <EscolherTipo aberto={escolherTipo && gestao} onFechar={() => setEscolherTipo(false)} onEscolher={tipo => { setEscolherTipo(false); setAberto({ tipo, modelo: null }); }} />
    </div>
  );
}

function ListaModelos({ tipo, gestao, onAbrir, onNovo }: { tipo: TipoModelo; gestao: boolean; onAbrir: (m: Modelo) => void; onNovo: () => void }) {
  const { dados, erro, aCarregar, recarregar } = useRecurso(`crm:modelos:${tipo}`, signal => apiModelos(tipo, { signal }));
  return (
    <Cartao titulo={NOME[tipo]} acoes={gestao ? <Botao tamanho="sm" onClick={onNovo}>Novo</Botao> : undefined} semPadding>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} className="m-4" /> : null}
      {aCarregar && !dados ? <div className="p-5"><Esqueleto linhas={3} /></div> : null}
      {dados && dados.modelos.length === 0 && (
        <Vazio compacto titulo="Ainda sem modelos." descricao="Um modelo guarda o texto que se repete; os campos automáticos preenchem o cliente, o curso e o valor." />
      )}
      <ul className="m-0 p-0 list-none divide-y divide-linha-suave">
        {(dados?.modelos ?? []).map(m => (
          <li key={m.id}>
            <button type="button" onClick={() => onAbrir(m)} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-fundo">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-tinta truncate">{m.nome}</span>
                <span className="block text-xs text-tinta-suave">{[m.curso, m.valor ? eur(m.valor) : "", m.alteradoEm ? `alterado a ${data(m.alteradoEm)}` : ""].filter(Boolean).join(" · ") || "Sem curso"}</span>
              </span>
              <span className="num text-xs text-tinta-suave whitespace-nowrap">{num(m.usos)} {m.usos === 1 ? "uso" : "usos"}</span>
            </button>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

function EditorModelo({ aberto, gestao, onFechar }: { aberto: Aberto | null; gestao: boolean; onFechar: () => void }) {
  const [d, setD] = useState({ nome: "", curso: "", valor: "", corpo: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [apagar, setApagar] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    const m = aberto.modelo;
    setD({ nome: m?.nome ?? "", curso: m?.curso ?? "", valor: m?.valor ? String(m.valor) : "", corpo: m?.corpo ?? "" });
    setErro(null);
  }, [aberto]);
  const gravar = useAccao(
    async (x: { nome: string; curso: string; valor: number; corpo: string }) =>
      aberto?.modelo ? apiAlterarModelo(aberto.tipo, aberto.modelo.id, x) : apiCriarModelo(aberto!.tipo, x),
    { ok: "Modelo guardado.", invalidar: ["crm:modelos"] },
  );
  if (!aberto) return null;
  const { tipo, modelo } = aberto;

  async function guardar() {
    if (!d.nome.trim()) return setErro("Indique o nome do modelo.");
    if (await gravar.correr({ nome: d.nome.trim(), curso: d.curso.trim(), valor: numeroDe(d.valor), corpo: d.corpo })) onFechar();
  }

  return (
    <PainelLateral
      aberto
      onFechar={onFechar}
      titulo={modelo ? modelo.nome : tipo === "proposta" ? "Novo modelo de proposta" : "Novo modelo de contrato"}
      subtitulo={modelo ? `${num(modelo.usos)} documentos criados com este modelo` : undefined}
      largura={760}
      rodape={gestao ? (
        <>
          {modelo && <Botao variante="fantasma" className="mr-auto text-perigo" onClick={() => setApagar(true)}>Apagar</Botao>}
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void guardar()}>Guardar modelo</Botao>
        </>
      ) : <Botao onClick={onFechar}>Fechar</Botao>}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Nome" obrigatorio erro={erro} className="sm:col-span-3">
            {p => <Entrada {...p} disabled={!gestao} value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} placeholder="Proposta empresas · intra" />}
          </Campo>
          <Campo rotulo="Curso (opcional)" className="sm:col-span-2">{p => <Entrada {...p} disabled={!gestao} value={d.curso} onChange={e => setD({ ...d, curso: e.target.value })} />}</Campo>
          <Campo rotulo="Valor (€)">{p => <Entrada {...p} disabled={!gestao} inputMode="decimal" value={d.valor} onChange={e => setD({ ...d, valor: e.target.value })} />}</Campo>
        </div>
        <EditorDocumento
          titulo={d.nome || (tipo === "proposta" ? "Proposta" : "Contrato")}
          valor={d.corpo}
          onMudar={corpo => setD({ ...d, corpo })}
          soLeitura={!gestao}
          valores={{ cliente: "Cliente exemplo", email: "", curso: d.curso, valor: numeroDe(d.valor) }}
        />
      </div>
      {modelo && (
        <ConfirmarPerigo
          aberto={apagar}
          onFechar={() => setApagar(false)}
          titulo="Apagar modelo"
          descricao={modelo.usos
            ? `Este modelo foi usado em ${num(modelo.usos)} documentos. Esses documentos guardam o seu texto; só perdem a ligação ao modelo.`
            : "O modelo deixa de aparecer na lista. Esta acção não se desfaz."}
          onConfirmar={async () => {
            try {
              await apiApagarModelo(tipo, modelo.id);
              invalidar("crm:modelos");
              toastOk("Modelo apagado.");
              onFechar();
            } catch (e) {
              toastError(e, "Não foi possível apagar o modelo.");
            }
          }}
        />
      )}
    </PainelLateral>
  );
}

function EscolherTipo({ aberto, onFechar, onEscolher }: { aberto: boolean; onFechar: () => void; onEscolher: (t: TipoModelo) => void }) {
  const [tipo, setTipo] = useState<TipoModelo>("proposta");
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Novo modelo" largura="sm"
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" onClick={() => onEscolher(tipo)}>Continuar</Botao></>}>
      <Campo rotulo="Tipo de modelo">
        {p => <Selecao {...p} value={tipo} onChange={e => setTipo(e.target.value as TipoModelo)} opcoes={[{ valor: "proposta", rotulo: "Proposta" }, { valor: "contrato", rotulo: "Contrato" }]} />}
      </Campo>
    </Modal>
  );
}
