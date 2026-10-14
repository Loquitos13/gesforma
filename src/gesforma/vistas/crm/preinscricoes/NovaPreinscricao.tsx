import { useEffect, useMemo, useState } from "react";
import { Aviso, AreaTexto, Botao, Campo, Entrada, Modal, Selecao, type OpcaoSelecao } from "../../../../partilhado/ui";
import { apiCriarLead, apiDuplicados, apiEditarLead, type Lead, type RegimeCrm } from "../../../../partilhado/api/crm";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";

type Form = {
  nome: string; apelido: string; email: string; telf: string; concelho: string; origem: string; meioContacto: string;
  curso: string; local: string; horario: string; turmaId: string; inicioCurso: string; campanhaId: string; comercialId: string; nota: string;
};

function formDe(l: Lead | null): Form {
  return {
    nome: l?.nome ?? "", apelido: l?.apelido ?? "", email: l?.email ?? "", telf: l?.telf ?? "", concelho: l?.concelho ?? "",
    origem: l?.origem ?? "", meioContacto: l?.meioContacto ?? "Telefone", curso: l?.curso ?? "", local: l?.local ?? "",
    horario: l?.horario ?? "", turmaId: l?.turmaId ? String(l.turmaId) : "", inicioCurso: l?.inicioCurso && l.inicioCurso !== "-" ? l.inicioCurso : "",
    campanhaId: "", comercialId: l?.comercialId ?? "", nota: "",
  };
}

/**
 * Pré-inscrição registada pela equipa (telefone, balcão, email) ou edição de uma existente.
 * Basta o nome e um contacto; o preço vem sempre da oferta do curso (calculado no servidor).
 */
export function NovaPreinscricao({ aberto, regime, lead, comerciais, onFechar, onCriada, onAbrirDuplicado }: {
  aberto: boolean;
  regime: RegimeCrm;
  lead: Lead | null;
  comerciais: OpcaoSelecao[];
  onFechar: () => void;
  onCriada: (id: number) => void;
  onAbrirDuplicado: (id: number) => void;
}) {
  const [f, setF] = useState<Form>(() => formDe(lead));
  const [dups, setDups] = useState<{ id: number; nome: string; apelido: string; estado: string; curso: string }[]>([]);
  const cursos = useOpcoes("cursos", { regime });
  const locais = useOpcoes("locais", { regime });
  const horarios = useOpcoes("horarios", { regime });
  const turmas = useOpcoes("turmas", { regime });
  const origens = useOpcoes("lista", { lista: "origens" });
  const meios = useOpcoes("lista", { lista: "meios_contacto" });
  const concelhos = useOpcoes("lista", { lista: "concelhos" });
  const campanhas = useOpcoes("campanhas");

  useEffect(() => { if (aberto) { setF(formDe(lead)); setDups([]); } }, [aberto, lead]);

  // Avisa de pedidos já existentes com o mesmo email ou telemóvel.
  useEffect(() => {
    if (!aberto || lead) return;
    const email = f.email.trim();
    const telf = f.telf.trim();
    if (email.length < 5 && telf.length < 6) { setDups([]); return; }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      apiDuplicados(email, telf, 0, ctrl.signal).then(r => setDups(r.duplicados)).catch(() => undefined);
    }, 350);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [aberto, lead, f.email, f.telf]);

  const turmasDoCurso = useMemo(
    () => turmas.opcoes.filter(t => !f.curso || String(t.extra?.curso ?? "").trim().toLowerCase() === f.curso.trim().toLowerCase())
      .map(t => ({ valor: String(t.id), rotulo: t.rotulo })),
    [turmas.opcoes, f.curso],
  );

  const criar = useAccao(apiCriarLead, { ok: "Pré-inscrição criada.", invalidar: ["crm:"] });
  const editar = useAccao(apiEditarLead, { ok: "Dados gravados.", invalidar: ["crm:"] });
  const set = (patch: Partial<Form>) => setF(v => ({ ...v, ...patch }));
  const valido = f.nome.trim() && (f.telf.trim() || f.email.trim());

  async function gravar() {
    if (!valido) return;
    const dados = {
      nome: f.nome.trim(), apelido: f.apelido.trim(), email: f.email.trim(), telf: f.telf.trim(), concelho: f.concelho,
      origem: f.origem, meioContacto: f.meioContacto, curso: f.curso, local: f.local, horario: f.horario,
      inicioCurso: f.inicioCurso || "-", turmaId: f.turmaId ? Number(f.turmaId) : undefined,
      campanhaId: f.campanhaId ? Number(f.campanhaId) : undefined, comercialId: f.comercialId || null,
    };
    if (lead) {
      const r = await editar.correr(lead.id, dados);
      if (r) onFechar();
      return;
    }
    const r = await criar.correr({ ...dados, regime, nota: f.nota.trim() || undefined });
    if (r) onCriada(r.preinscricao.id);
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      largura="lg"
      titulo={lead ? `Editar ${lead.nome}` : "Nova pré-inscrição"}
      rodape={<>
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao aCarregar={criar.aCorrer || editar.aCorrer} disabled={!valido} onClick={() => void gravar()}>{lead ? "Gravar" : "Criar pré-inscrição"}</Botao>
      </>}
    >
      <div className="flex flex-col gap-3">
        {!lead && (
          <p className="m-0 text-[13px] text-tinta-suave">
            Para quem ligou, escreveu ou passou no balcão. Os pedidos do site entram sozinhos. NIF e morada fiscal ficam para a etapa «Pré-inscrição».
          </p>
        )}
        {dups.length > 0 && (
          <Aviso tom="aviso" titulo={`Já existe ${dups.length === 1 ? "um pedido" : `${dups.length} pedidos`} com este contacto`}>
            <ul className="m-0 mt-1 list-none p-0">
              {dups.slice(0, 4).map(d => (
                <li key={d.id}>
                  <button type="button" className="text-left font-semibold text-ligacao hover:underline" onClick={() => onAbrirDuplicado(d.id)}>
                    #{d.id} · {d.nome} {d.apelido} · {d.curso || "sem curso"} · {d.estado}
                  </button>
                </li>
              ))}
            </ul>
          </Aviso>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome" obrigatorio>{p => <Entrada {...p} value={f.nome} onChange={e => set({ nome: e.target.value })} data-autofocus autoComplete="off" />}</Campo>
          <Campo rotulo="Apelido">{p => <Entrada {...p} value={f.apelido} onChange={e => set({ apelido: e.target.value })} autoComplete="off" />}</Campo>
          <Campo rotulo="Telemóvel" ajuda="Ou o email.">{p => <Entrada {...p} type="tel" value={f.telf} onChange={e => set({ telf: e.target.value })} />}</Campo>
          <Campo rotulo="Email" ajuda="Ou o telemóvel.">{p => <Entrada {...p} type="email" value={f.email} onChange={e => set({ email: e.target.value })} />}</Campo>
          <Campo rotulo="Concelho">{p => <Selecao {...p} value={f.concelho} onChange={e => set({ concelho: e.target.value })} opcoes={concelhos.selecao} vazio="—" />}</Campo>
          <Campo rotulo="Como conheceu a ENA">{p => <Selecao {...p} value={f.origem} onChange={e => set({ origem: e.target.value })} opcoes={origens.selecao} vazio="—" />}</Campo>
          <Campo rotulo="Meio de contacto">{p => <Selecao {...p} value={f.meioContacto} onChange={e => set({ meioContacto: e.target.value })} opcoes={meios.selecao} vazio="—" />}</Campo>
          <Campo rotulo="Comercial">{p => <Selecao {...p} value={f.comercialId} onChange={e => set({ comercialId: e.target.value })} opcoes={comerciais} vazio="Sem dono" />}</Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Curso" className="sm:col-span-2">
            {p => <Selecao {...p} value={f.curso} onChange={e => set({ curso: e.target.value, turmaId: "" })} opcoes={cursos.selecao} vazio="Sem curso" />}
          </Campo>
          <Campo rotulo="Local">{p => <Selecao {...p} value={f.local} onChange={e => set({ local: e.target.value })} opcoes={locais.selecao} vazio="—" />}</Campo>
          <Campo rotulo="Horário">{p => <Selecao {...p} value={f.horario} onChange={e => set({ horario: e.target.value })} opcoes={horarios.selecao} vazio="—" />}</Campo>
          <Campo rotulo="Turma" ajuda={regime === "fin" ? "Na Financiada a secretaria coloca a pessoa ao validar." : "Opcional."}>
            {p => <Selecao {...p} value={f.turmaId} onChange={e => {
              const t = turmas.opcoes.find(o => String(o.id) === e.target.value);
              set({ turmaId: e.target.value, inicioCurso: String(t?.extra?.inicio ?? f.inicioCurso) });
            }} opcoes={turmasDoCurso} vazio="Por definir" />}
          </Campo>
          <Campo rotulo="Início pretendido">{p => <Entrada {...p} type="date" value={/^\d{4}-\d{2}-\d{2}/.test(f.inicioCurso) ? f.inicioCurso.slice(0, 10) : ""} onChange={e => set({ inicioCurso: e.target.value })} />}</Campo>
          {!lead && (
            <Campo rotulo="Campanha">{p => <Selecao {...p} value={f.campanhaId} onChange={e => set({ campanhaId: e.target.value })} opcoes={campanhas.opcoes.map(c => ({ valor: String(c.id ?? c.valor), rotulo: c.rotulo }))} vazio="Sem campanha" />}</Campo>
          )}
        </div>
        {!lead && (
          <Campo rotulo="Nota comercial">
            {p => <AreaTexto {...p} rows={3} value={f.nota} onChange={e => set({ nota: e.target.value })} placeholder="O que pediu, horário, objecção, quem atendeu…" />}
          </Campo>
        )}
        {regime === "gold" && <p className="m-0 text-xs text-tinta-suave">O valor vem da oferta do curso (local e horário) e é calculado ao gravar.</p>}
      </div>
    </Modal>
  );
}
