import { useEffect, useState } from "react";
import { Botao, Campo, Chip, Entrada, Selecao, data, dataHora } from "../../../../partilhado/ui";
import {
  apiComerciais, apiCriarCampo, apiCriarEtiqueta, apiEditarLead, apiEtiquetas, apiGravarCampos, type DossieLead,
} from "../../../../partilhado/api/crm";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { useAuth } from "../../../../partilhado/AuthGate";
import { toastError } from "../../../../partilhado/toastBus";
import { ETAPAS, podeMudarEtapa, rotuloEtapa } from "./util";
import { PerfilFinEditor } from "./PerfilFinEditor";

/** Dados pessoais e do pedido, comercial, etiqueta, etapa, desistência e campos extra. */
export function FichaDados({ d, onMudou }: { d: DossieLead; onMudou: () => void }) {
  const { user } = useAuth();
  const l = d.lead;
  const [dados, setDados] = useState({ nome: "", apelido: "", email: "", telf: "", concelho: "", origem: "", curso: "", local: "", horario: "" });
  const [etapa, setEtapa] = useState(l.estado);
  const [metodo, setMetodo] = useState(l.pagamentoMetodo);
  const [motivo, setMotivo] = useState(l.motivoDesistencia);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [novoCampo, setNovoCampo] = useState("");
  const [novaEtiqueta, setNovaEtiqueta] = useState("");

  useEffect(() => {
    setDados({ nome: l.nome, apelido: l.apelido, email: l.email, telf: l.telf, concelho: l.concelho, origem: l.origem, curso: l.curso, local: l.local, horario: l.horario });
    setEtapa(l.estado);
    setMetodo(l.pagamentoMetodo);
    setMotivo(l.motivoDesistencia);
    setVals(Object.fromEntries(d.campos.map(c => [c.id, c.valor ?? ""])));
  }, [d, l]);

  const cursos = useOpcoes("cursos", { regime: l.regime });
  const locais = useOpcoes("locais", { regime: l.regime });
  const horarios = useOpcoes("horarios", { regime: l.regime });
  const origens = useOpcoes("lista", { lista: "origens" });
  const concelhos = useOpcoes("lista", { lista: "concelhos" });
  const metodos = useOpcoes("lista", { lista: "metodos_pagamento" });
  const motivos = useOpcoes("lista", { lista: "motivos_desistencia" });
  const comerciais = useRecurso(`crm:comerciais:${l.regime}`, s => apiComerciais(l.regime, s));
  const etiquetas = useRecurso("crm:etiquetas", s => apiEtiquetas(s));

  const editar = useAccao(apiEditarLead, { ok: "Gravado." });
  const campos = useAccao(apiGravarCampos, { ok: "Campos gravados." });
  const set = (k: keyof typeof dados, v: string) => setDados(x => ({ ...x, [k]: v }));

  async function gravar(patch: Parameters<typeof apiEditarLead>[1]) {
    const r = await editar.correr(l.id, patch);
    if (r) onMudou();
  }

  function mudarEtapa() {
    const erro = podeMudarEtapa(l.estado, etapa, user.role, l.regime);
    if (erro) { toastError(new Error(erro)); return; }
    if (etapa === "Formando") { toastError(new Error("Para passar a Formando use «Validação» e escolha a turma.")); return; }
    void gravar({ estado: etapa, ...(etapa === "Pago" ? { pagamentoMetodo: metodo } : {}) });
  }

  async function criarEtiqueta() {
    const nome = novaEtiqueta.trim();
    if (!nome) return;
    try {
      const r = await apiCriarEtiqueta(nome, "#d97706");
      setNovaEtiqueta("");
      invalidar("crm:etiquetas");
      await gravar({ etiquetaId: r.etiqueta.id });
    } catch (e) {
      toastError(e, "Não foi possível criar a etiqueta.");
    }
  }

  async function criarCampo() {
    const label = novoCampo.trim();
    if (!label) return;
    try {
      await apiCriarCampo(label, "texto");
      setNovoCampo("");
      onMudou();
    } catch (e) {
      toastError(e, "Não foi possível criar o campo.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Dados pessoais e do pedido" className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome">{p => <Entrada {...p} value={dados.nome} onChange={e => set("nome", e.target.value)} />}</Campo>
        <Campo rotulo="Apelido">{p => <Entrada {...p} value={dados.apelido} onChange={e => set("apelido", e.target.value)} />}</Campo>
        <Campo rotulo="Telemóvel">{p => <Entrada {...p} type="tel" value={dados.telf} onChange={e => set("telf", e.target.value)} />}</Campo>
        <Campo rotulo="Email">{p => <Entrada {...p} type="email" value={dados.email} onChange={e => set("email", e.target.value)} />}</Campo>
        <Campo rotulo="Concelho">{p => <Selecao {...p} value={dados.concelho} onChange={e => set("concelho", e.target.value)} opcoes={concelhos.selecao} vazio="—" />}</Campo>
        <Campo rotulo="Como conheceu a ENA">{p => <Selecao {...p} value={dados.origem} onChange={e => set("origem", e.target.value)} opcoes={origens.selecao} vazio="—" />}</Campo>
        <Campo rotulo="Curso" className="sm:col-span-2">{p => <Selecao {...p} value={dados.curso} onChange={e => set("curso", e.target.value)} opcoes={cursos.selecao} vazio="Sem curso" />}</Campo>
        <Campo rotulo="Local">{p => <Selecao {...p} value={dados.local} onChange={e => set("local", e.target.value)} opcoes={locais.selecao} vazio="—" />}</Campo>
        <Campo rotulo="Horário">{p => <Selecao {...p} value={dados.horario} onChange={e => set("horario", e.target.value)} opcoes={horarios.selecao} vazio="—" />}</Campo>
        <div className="sm:col-span-2">
          <Botao variante="primario" aCarregar={editar.aCorrer} onClick={() => void gravar(dados)}>Gravar dados</Botao>
        </div>
      </section>

      {d.dadosFin && (
        <section aria-label="Dados pessoais da inscrição" className="flex flex-col gap-2 rounded-cartao border border-linha p-3">
          <p className="m-0 text-[13px] font-medium">Dados pessoais (formação financiada)</p>
          {d.dadosFin.perfil && !d.validadaEm
            ? <PerfilFinEditor leadId={l.id} perfil={d.dadosFin.perfil} onMudou={onMudou} />
            : (
              <dl className="m-0 grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
                {([
                  ["Género", d.dadosFin.genero],
                  ["Data de nascimento", d.dadosFin.dataNascimento ? data(d.dadosFin.dataNascimento) : ""],
                  ["Nacionalidade", d.dadosFin.nacionalidade],
                  ["Habilitações", d.dadosFin.habilitacoes],
                ] as const).map(([rotulo, valor]) => (
                  <div key={rotulo} className="min-w-0">
                    <dt className="text-xs text-tinta-suave">{rotulo}</dt>
                    <dd className="m-0 break-words">{valor || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          <dl className="m-0 grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
            {([
              ["Morada", d.dadosFin.morada],
              ["Documento de identificação", [d.dadosFin.tipoDocumento, d.dadosFin.numeroDocumento].filter(Boolean).join(" · ")],
              ["Validade do documento", d.dadosFin.validadeDocumento ? data(d.dadosFin.validadeDocumento) : ""],
              ["NIF", d.dadosFin.nif],
              ["NISS", d.dadosFin.niss],
              ["IBAN", d.dadosFin.iban],
              ["Situação face ao emprego", d.dadosFin.situacaoEmprego],
              ["NIF da entidade empregadora", d.dadosFin.nifEntidadeEmpregadora],
              ["Termos e uso dos dados", d.dadosFin.termosAceitesEm ? `Aceites em ${dataHora(d.dadosFin.termosAceitesEm)} (versão ${d.dadosFin.termosVersao})` : "Por aceitar"],
            ] as const).map(([rotulo, valor]) => (
              <div key={rotulo} className="min-w-0">
                <dt className="text-xs text-tinta-suave">{rotulo}</dt>
                <dd className="m-0 break-words">{valor || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 text-xs text-tinta-suave">Ao validar, passam para a ficha do formando (Dados para o financiamento e Apoios), sem substituir o que a ficha já tem.</p>
        </section>
      )}

      <section aria-label="Comercial e etiqueta" className="flex flex-col gap-3">
        <Campo rotulo="Comercial">
          {p => <Selecao {...p} value={l.comercialId ?? ""} onChange={e => void gravar({ comercialId: e.target.value || null })}
            opcoes={(comerciais.dados?.comerciais ?? []).map(c => ({ valor: c.id, rotulo: c.name }))} vazio="Sem dono" />}
        </Campo>
        <div>
          <p className="m-0 mb-1 text-[13px] font-medium">Etiqueta</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip ativo={!l.etiquetaId} onClick={() => void gravar({ etiquetaId: null })}>Sem etiqueta</Chip>
            {(etiquetas.dados?.etiquetas ?? []).map(e => (
              <Chip key={e.id} ativo={l.etiquetaId === e.id} onClick={() => void gravar({ etiquetaId: e.id })}>
                <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: e.cor }} />{e.nome}
              </Chip>
            ))}
            <span className="inline-flex items-center gap-1">
              <Entrada aria-label="Nova etiqueta" placeholder="Nova etiqueta" className="h-8 w-36 text-xs" value={novaEtiqueta} onChange={e => setNovaEtiqueta(e.target.value)} />
              <Botao tamanho="sm" variante="secundario" disabled={!novaEtiqueta.trim()} onClick={() => void criarEtiqueta()}>Criar</Botao>
            </span>
          </div>
        </div>
      </section>

      <section aria-label="Etapa" className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Etapa" className="min-w-[180px] flex-1">
          {p => <Selecao {...p} value={etapa} onChange={e => setEtapa(e.target.value)}
            opcoes={ETAPAS.filter(e => e !== "Formando" && e !== "Desistiu").map(e => ({ valor: e, rotulo: rotuloEtapa(e) }))} />}
        </Campo>
        {etapa === "Pago" && (
          <Campo rotulo="Método de pagamento" className="min-w-[180px] flex-1">
            {p => <Selecao {...p} value={metodo} onChange={e => setMetodo(e.target.value)} opcoes={metodos.selecao} vazio="—" />}
          </Campo>
        )}
        <Botao variante="secundario" disabled={etapa === l.estado || (etapa === "Pago" && !metodo)} onClick={mudarEtapa}>Mudar etapa</Botao>
      </section>

      {l.estado !== "Formando" && (
        <section aria-label="Desistência" className="flex flex-wrap items-end gap-2 rounded-cartao border border-linha p-3">
          <Campo rotulo="Motivo da desistência" className="min-w-[200px] flex-1">
            {p => <Selecao {...p} value={motivo} onChange={e => setMotivo(e.target.value)} opcoes={motivos.selecao} vazio="—" />}
          </Campo>
          <Botao variante="secundario" disabled={!motivo || l.estado === "Desistiu"} onClick={() => void gravar({ estado: "Desistiu", motivoDesistencia: motivo })}>
            Marcar desistência
          </Botao>
        </section>
      )}

      <section aria-label="Campos extra" className="flex flex-col gap-2">
        <p className="m-0 text-[13px] font-medium">Campos extra</p>
        {d.campos.map(c => (
          <Campo key={c.id} rotulo={c.label}>
            {p => c.tipo === "lista" && c.opcoes.length
              ? <Selecao {...p} value={vals[c.id] ?? ""} onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value }))} opcoes={c.opcoes.map(o => ({ valor: o, rotulo: o }))} vazio="—" />
              : <Entrada {...p} type={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : "text"} value={vals[c.id] ?? ""} onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value }))} />}
          </Campo>
        ))}
        {d.campos.length > 0 && (
          <Botao variante="secundario" aCarregar={campos.aCorrer}
            onClick={() => void campos.correr(l.id, Object.entries(vals).map(([campoId, valor]) => ({ campoId: Number(campoId), valor }))).then(r => r && onMudou())}>
            Gravar campos extra
          </Botao>
        )}
        <span className="inline-flex items-center gap-1">
          <Entrada aria-label="Novo campo para todas as pré-inscrições" placeholder="Novo campo (todas as pré-inscrições)" className="h-8 text-xs" value={novoCampo} onChange={e => setNovoCampo(e.target.value)} />
          <Botao tamanho="sm" variante="secundario" disabled={!novoCampo.trim()} onClick={() => void criarCampo()}>Criar campo</Botao>
        </span>
      </section>
    </div>
  );
}
