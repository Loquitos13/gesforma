// Criar e editar campanhas; apagar com confirmação.
import { useEffect, useState } from "react";
import { useAuth } from "../../../partilhado/AuthGate";
import { apiAlterarCampanha, apiApagarCampanha, apiCriarCampanha, type Campanha, type DadosCampanha } from "../../../partilhado/api/campanhas";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { invalidar } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { AreaTexto, Botao, Campo, ConfirmarPerigo, Entrada, Modal, Selecao, num } from "../../../partilhado/ui";
import { numeroDe } from "../crm/comum";
import { hojeLisboa } from "../../../partilhado/horaLisboa";

const hoje = () => hojeLisboa();

export function FormCampanha({ campanha, onFechar, onGravada }: { campanha: Campanha | "nova" | null; onFechar: () => void; onGravada: (id: number) => void }) {
  const { user } = useAuth();
  const canais = useOpcoes("lista", { lista: "origens" });
  const cursos = useOpcoes("cursos");
  const responsaveis = useOpcoes("comerciais");
  const [d, setD] = useState({ nome: "", data: hoje(), fim: "", encarregado: "", curso: "", canal: "", custo: "", notas: "" });
  const [erro, setErro] = useState<Record<string, string>>({});
  const editar = campanha && campanha !== "nova" ? campanha : null;
  useEffect(() => {
    if (!campanha) return;
    setErro({});
    setD(campanha === "nova"
      ? { nome: "", data: hoje(), fim: "", encarregado: user.name, curso: "", canal: "", custo: "", notas: "" }
      : { nome: campanha.nome, data: campanha.data, fim: campanha.fim, encarregado: campanha.encarregado, curso: campanha.curso, canal: campanha.canal, custo: campanha.custo ? String(campanha.custo) : "", notas: campanha.notas });
  }, [campanha, user.name]);
  const gravar = useAccao(
    (x: DadosCampanha) => (editar ? apiAlterarCampanha(editar.id, x) : apiCriarCampanha(x)),
    { ok: editar ? "Campanha guardada." : "Campanha criada.", invalidar: ["campanhas", "opcoes:campanhas"] },
  );

  async function guardar() {
    const e: Record<string, string> = {};
    if (!d.nome.trim()) e.nome = "Indique o nome.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) e.data = "Indique a data de início.";
    if (d.fim && d.fim < d.data) e.fim = "O fim tem de ser depois do início.";
    setErro(e);
    if (Object.keys(e).length) return;
    const r = await gravar.correr({ nome: d.nome.trim(), data: d.data, fim: d.fim, encarregado: d.encarregado.trim(), curso: d.curso, canal: d.canal, custo: numeroDe(d.custo), notas: d.notas.trim() });
    if (r?.campanha) {
      onGravada(r.campanha.id);
      onFechar();
    }
  }

  const com = (lista: { valor: string; rotulo: string }[], atual: string) => (atual && !lista.some(o => o.valor === atual) ? [{ valor: atual, rotulo: atual }, ...lista] : lista);
  const nomesResp = responsaveis.opcoes.map(o => ({ valor: o.rotulo, rotulo: o.rotulo }));

  return (
    <Modal
      aberto={Boolean(campanha)}
      onFechar={onFechar}
      titulo={editar ? "Editar campanha" : "Nova campanha"}
      subtitulo={editar ? `${num(editar.preinscricoes)} pré-inscrições ligadas` : "Depois de criada, escolha-a nas pré-inscrições que vierem desta campanha."}
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void guardar()}>{editar ? "Guardar alterações" : "Criar campanha"}</Botao></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome" obrigatorio erro={erro.nome} className="sm:col-span-2">
          {p => <Entrada {...p} value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} placeholder="Outubro 2026 · CCP" data-autofocus />}
        </Campo>
        <Campo rotulo="Curso em destaque" className="sm:col-span-2">
          {p => <Selecao {...p} value={d.curso} onChange={e => setD({ ...d, curso: e.target.value })} vazio="Vários cursos" opcoes={com(cursos.selecao, d.curso)} />}
        </Campo>
        <Campo rotulo="Início" obrigatorio erro={erro.data}>{p => <Entrada {...p} type="date" value={d.data} onChange={e => setD({ ...d, data: e.target.value })} />}</Campo>
        <Campo rotulo="Fim (opcional)" erro={erro.fim}>{p => <Entrada {...p} type="date" value={d.fim} onChange={e => setD({ ...d, fim: e.target.value })} />}</Campo>
        <Campo rotulo="Custo (€)">{p => <Entrada {...p} inputMode="decimal" value={d.custo} onChange={e => setD({ ...d, custo: e.target.value })} placeholder="0" />}</Campo>
        <Campo rotulo="Canal principal" ajuda="Opções de Listas de opções › Origens.">
          {p => <Selecao {...p} value={d.canal} onChange={e => setD({ ...d, canal: e.target.value })} vazio="Sem canal" opcoes={com(canais.selecao, d.canal)} />}
        </Campo>
        <Campo rotulo="Responsável" className="sm:col-span-2">
          {p => <Selecao {...p} value={d.encarregado} onChange={e => setD({ ...d, encarregado: e.target.value })} vazio="Sem responsável" opcoes={com(nomesResp, d.encarregado)} />}
        </Campo>
        <Campo rotulo="Notas internas" className="sm:col-span-2">
          {p => <AreaTexto {...p} value={d.notas} onChange={e => setD({ ...d, notas: e.target.value })} placeholder="Público, criativo, orçamento diário…" />}
        </Campo>
      </div>
    </Modal>
  );
}

export function ApagarCampanha({ campanha, onFechar, onApagada }: { campanha: Campanha | null; onFechar: () => void; onApagada: () => void }) {
  return (
    <ConfirmarPerigo
      aberto={Boolean(campanha)}
      onFechar={onFechar}
      titulo="Apagar campanha"
      descricao={campanha?.preinscricoes
        ? `As ${num(campanha.preinscricoes)} pré-inscrições ligadas ficam no CRM, só deixam de estar associadas a esta campanha.`
        : "A campanha deixa de aparecer na lista. Esta acção não se desfaz."}
      confirmarTexto={campanha?.preinscricoes ? campanha.nome : undefined}
      onConfirmar={async () => {
        if (!campanha) return;
        try {
          await apiApagarCampanha(campanha.id);
          invalidar("campanhas");
          invalidar("opcoes:campanhas");
          toastOk("Campanha apagada.");
          onApagada();
        } catch (e) {
          toastError(e, "Não foi possível apagar a campanha.");
        }
      }}
    />
  );
}
