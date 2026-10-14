// Contratos de formação na ficha do formando: criar a partir de um modelo e enviar para assinatura.
import { useState } from "react";
import { ROTULO_ESTADO, TOM_ESTADO, apiContratosFormando, apiNovoContratoFormando } from "../../../partilhado/api/assinaturas";
import { apiModelos } from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Botao, Campo, Cartao, ErroCarregar, Esqueleto, Estado, Modal, Selecao, Vazio, data } from "../../../partilhado/ui";
import { INVALIDAR_ASSINATURAS, PainelAssinatura } from "./PainelAssinatura";

export function ContratosFormando({ regime, formandoId, podeEditar }: { regime: "gold" | "fin"; formandoId: number; podeEditar: boolean }) {
  const chave = `assinaturas:formando:${regime}:${formandoId}`;
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, signal => apiContratosFormando(regime, formandoId, { signal }));
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);

  return (
    <Cartao
      titulo="Contratos de formação"
      subtitulo="O nome, o email e o NIF do signatário vêm desta ficha. O PDF assinado fica na pasta do formando na Drive."
      acoes={podeEditar ? <Botao tamanho="sm" variante="primario" onClick={() => setNovo(true)}>Novo contrato</Botao> : undefined}
    >
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : aCarregar && !dados ? <Esqueleto linhas={3} /> : !dados?.contratos.length ? (
        <Vazio compacto titulo="Ainda sem contratos." descricao={podeEditar ? "Crie o contrato a partir de um modelo e envie-o para assinatura." : undefined} />
      ) : (
        <ul className="m-0 p-0 list-none divide-y divide-linha">
          {dados.contratos.map(k => (
            <li key={k.id} className="py-3 first:pt-0 last:pb-0 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium text-tinta">{k.modelo || "Contrato"} · {k.curso || "—"}</p>
                  <p className="m-0 text-xs text-tinta-suave">Criado a {data(k.criadoEm)}{k.assinadoEm ? ` · assinado a ${data(k.assinadoEm)}` : ""}</p>
                </div>
                {k.assinaturaEstado ? <Estado tom={TOM_ESTADO[k.assinaturaEstado]} ponto>{ROTULO_ESTADO[k.assinaturaEstado]}</Estado> : <Estado>{k.estado}</Estado>}
                <a href={`/gesforma/${regime === "fin" ? "financiada" : "gold"}/contratos?editar=contrato:${k.id}`} className="text-[13px] font-semibold text-ligacao no-underline hover:underline">
                  {k.estado === "Rascunho" ? "Rever no editor" : "Ver contrato"}
                </a>
                <Botao tamanho="sm" variante="fantasma" aria-expanded={aberto === k.id} onClick={() => setAberto(aberto === k.id ? null : k.id)}>
                  {aberto === k.id ? "Fechar" : "Assinatura"}
                </Botao>
              </div>
              {aberto === k.id && <PainelAssinatura contratoId={k.id} estadoContrato={k.estado} temTexto podeEnviar={podeEditar} />}
            </li>
          ))}
        </ul>
      )}
      <NovoContrato regime={regime} formandoId={formandoId} aberto={novo} onFechar={() => setNovo(false)} onCriado={id => { setNovo(false); setAberto(id); }} />
    </Cartao>
  );
}

function NovoContrato({ regime, formandoId, aberto, onFechar, onCriado }: {
  regime: "gold" | "fin"; formandoId: number; aberto: boolean; onFechar: () => void; onCriado: (id: number) => void;
}) {
  const modelos = useRecurso(aberto ? "crm:modelos:contrato" : null, signal => apiModelos("contrato", { signal }));
  const [modelo, setModelo] = useState("");
  const criar = useAccao(apiNovoContratoFormando, { ok: "Contrato criado. Reveja-o e envie para assinatura.", invalidar: INVALIDAR_ASSINATURAS });
  const lista = modelos.dados?.modelos ?? [];
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Novo contrato de formação"
      rodape={(
        <>
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" disabled={!modelo} aCarregar={criar.aCorrer} onClick={async () => {
            const r = await criar.correr(regime, formandoId, Number(modelo));
            if (r) onCriado(r.contratoId);
          }}>Criar contrato</Botao>
        </>
      )}
    >
      {modelos.erro ? <ErroCarregar erro={modelos.erro} onTentar={modelos.recarregar} /> : (
        <div className="space-y-3 text-sm">
          <Campo rotulo="Modelo de contrato" obrigatorio ajuda={lista.length ? "Os campos automáticos ({{nome}}, {{nif}}, {{curso}}, {{turma}}…) são preenchidos com os dados da ficha ao enviar." : undefined}>
            {p => <Selecao {...p} value={modelo} onChange={e => setModelo(e.target.value)} vazio={lista.length ? "Escolha um modelo" : "Sem modelos"} opcoes={lista.map(m => ({ valor: String(m.id), rotulo: m.nome }))} />}
          </Campo>
          {!lista.length && !modelos.aCarregar && (
            <p className="m-0 text-tinta-suave">Ainda não há modelos de contrato. Crie um em CRM › Contratos › Modelos.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
