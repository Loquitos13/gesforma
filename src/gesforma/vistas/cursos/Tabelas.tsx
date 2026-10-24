// Datas, locais, programas (Financiada), horários e áreas temáticas: um ecrã com separadores; cada separador é uma rota do menu.
import { useMemo, useState } from "react";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { Botao, Modal, PageHeader, Separadores, data, eur } from "../../../partilhado/ui";
import { logoPrograma } from "../../../partilhado/api/logosDocumentos";
import { LogoDocumento } from "../../LogoDocumento";
import type { Vista } from "../../rotasGesforma";
import type { VistaProps } from "../../shell/tipos";
import { CatalogoTabela, type ConfigCatalogo } from "./CatalogoTabela";
import { CAMPOS_CANDIDATURA_FIN, CANDIDATURA_FIN_OMISSAO } from "../../../partilhado/candidaturaFin";

type Tabela = "datas" | "locais" | "programas" | "horarios" | "areas";

const VISTAS: Record<"gold" | "fin", Partial<Record<Tabela, Vista>>> = {
  gold: { datas: "gold-datas", locais: "gold-locais", horarios: "gold-horarios", areas: "gold-areas-tematicas" },
  fin: { datas: "fin-datas", locais: "fin-locais", programas: "fin-programas", areas: "fin-areas-tematicas" },
};

function tabelaDaVista(view: Vista): Tabela {
  if (view.endsWith("locais")) return "locais";
  if (view.endsWith("programas")) return "programas";
  if (view.endsWith("horarios")) return "horarios";
  if (view.endsWith("areas-tematicas")) return "areas";
  return "datas";
}

const txt = (v: unknown) => String(v ?? "");

export default function Tabelas({ view, navigate }: VistaProps) {
  const regime = view.startsWith("fin-") ? "fin" : "gold";
  const tabela = tabelaDaVista(view);
  const cursos = useOpcoes("cursos", { regime });
  const locais = useOpcoes("locais", { regime });
  const horarios = useOpcoes("horarios", { regime: "gold" });
  const [logo, setLogo] = useState<{ id: number; nome: string } | null>(null);

  const config = useMemo((): ConfigCatalogo => {
    if (tabela === "locais") {
      return {
        kind: "locais", regime, singular: "local", plural: "locais", campoEstado: "status",
        rotulo: i => txt(i.nome), pesquisa: i => `${txt(i.nome)} ${txt(i.morada)}`,
        campos: [
          { chave: "nome", rotulo: "Nome", obrigatorio: true, placeholder: "Ex.: V.N. Gaia" },
          { chave: "morada", rotulo: "Morada ou plataforma", placeholder: "Rua… ou Sala Virtual" },
          { chave: "salas", rotulo: "Salas", tipo: "numero", metade: true },
          // Contactos para dúvidas: aparecem no cartão do local na página de cada curso (cada curso pode ter os seus).
          { chave: "telemovel", rotulo: "Telemóvel", placeholder: "912 345 678", metade: true },
          { chave: "telefone", rotulo: "Telefone", placeholder: "223 781 100", metade: true },
          { chave: "email", rotulo: "Email", placeholder: "gaia@ena.pt", metade: true },
          { chave: "whatsapp", rotulo: "WhatsApp", placeholder: "912 345 678", metade: true },
        ],
        colunas: [
          { id: "nome", titulo: "Local", principal: true, celula: i => <span className="font-semibold">{txt(i.nome)}</span> },
          { id: "morada", titulo: "Morada / plataforma", esconderMovel: true, celula: i => <span className="text-tinta-suave">{txt(i.morada) || "—"}</span> },
          {
            id: "contactos", titulo: "Contactos", esconderMovel: true,
            celula: i => <span className="text-tinta-suave">{[txt(i.telemovel), txt(i.telefone), txt(i.email), txt(i.whatsapp) && `WhatsApp ${txt(i.whatsapp)}`].filter(Boolean).join(" · ") || "—"}</span>,
          },
          { id: "salas", titulo: "Salas", alinhar: "dir", celula: i => Number(i.salas ?? 0) || "—" },
        ],
        validar: (v, itens, id) => repetido(itens, id, "nome", v.nome, "Já existe um local com esse nome."),
        nota: regime === "gold"
          ? <p className="m-0 text-[13px] text-tinta-suave">Na pré-inscrição, o local só aparece se houver uma turma Gold libertada desse curso nesse polo.</p>
          : undefined,
      };
    }
    if (tabela === "programas") {
      return {
        kind: "programas", regime: "fin", singular: "programa", plural: "programas", campoEstado: "status",
        rotulo: i => txt(i.nome), pesquisa: i => CAMPOS_CANDIDATURA_FIN.map(c => txt(i[c.chave])).join(" ") + ` ${txt(i.nome)}`,
        campos: [
          { chave: "nome", rotulo: "Nome", obrigatorio: true, placeholder: "Ex.: PESSOAS 2030", ajuda: "Para escolher o programa na turma." },
          ...CAMPOS_CANDIDATURA_FIN.map(c => ({ chave: c.chave, rotulo: c.rotulo, placeholder: CANDIDATURA_FIN_OMISSAO[c.chave] })),
        ],
        colunas: [
          { id: "nome", titulo: "Programa", principal: true, celula: i => <span className="font-semibold">{txt(i.nome)}</span> },
          { id: "prioridade", titulo: "Prioridade", esconderMovel: true, celula: i => <span className="text-tinta-suave">{txt(i.prioridade) || "—"}</span> },
          { id: "tipologia", titulo: "Tipologia", esconderMovel: true, celula: i => <span className="text-tinta-suave">{txt(i.tipologia) || "—"}</span> },
        ],
        validar: (v, itens, id) => repetido(itens, id, "nome", v.nome, "Já existe um programa com esse nome."),
        acoesExtra: i => (
          <Botao tamanho="sm" variante="fantasma" onClick={e => { e.stopPropagation(); setLogo({ id: i.id, nome: txt(i.nome) }); }}>Logótipo</Botao>
        ),
        nota: <p className="m-0 text-[13px] text-tinta-suave">Programa, prioridade e tipologias saem na ficha de inscrição e na folha de presenças / sumário das turmas desse programa; o logótipo do programa vai no rodapé de todos os documentos dessas turmas, com o da DGERT e o da União Europeia. Cada turma escolhe o seu programa.</p>,
      };
    }
    if (tabela === "horarios") {
      return {
        kind: "horarios", regime: "gold", singular: "horário", plural: "horários", campoEstado: "status",
        rotulo: i => txt(i.nome), pesquisa: i => `${txt(i.nome)} ${txt(i.descricao)}`,
        campos: [
          { chave: "nome", rotulo: "Nome", obrigatorio: true, placeholder: "Ex.: Pós-laboral" },
          { chave: "descricao", rotulo: "Descrição", placeholder: "Ex.: Dias úteis ao fim do dia" },
          { chave: "horaInicio", rotulo: "Hora de início", metade: true, placeholder: "19:00" },
          { chave: "horaFim", rotulo: "Hora de fim", metade: true, placeholder: "23:00" },
        ],
        colunas: [
          { id: "nome", titulo: "Horário", principal: true, celula: i => <span className="font-semibold">{txt(i.nome)}</span> },
          { id: "descricao", titulo: "Descrição", esconderMovel: true, celula: i => <span className="text-tinta-suave">{txt(i.descricao) || "—"}</span> },
          { id: "horas", titulo: "Horas típicas", celula: i => (i.horaInicio || i.horaFim ? `${txt(i.horaInicio)}–${txt(i.horaFim)}` : "—") },
        ],
        validar: (v, itens, id) => repetido(itens, id, "nome", v.nome, "Já existe um horário com esse nome."),
        nota: <p className="m-0 text-[13px] text-tinta-suave">A pré-inscrição só mostra os horários que estão numa turma Gold activa daquele curso e local.</p>,
      };
    }
    if (tabela === "areas") {
      return {
        kind: "areas", regime, singular: "área", plural: "áreas temáticas", campoEstado: "estado",
        rotulo: i => txt(i.nome), pesquisa: i => txt(i.nome),
        campos: [{ chave: "nome", rotulo: "Nome", obrigatorio: true }],
        colunas: [{ id: "nome", titulo: "Área temática", principal: true, celula: i => <span className="font-semibold">{txt(i.nome)}</span> }],
        validar: (v, itens, id) => repetido(itens, id, "nome", v.nome, "Já existe uma área com esse nome."),
        nota: <p className="m-0 text-[13px] text-tinta-suave">{regime === "gold" ? "Agrupam os cursos Gold no site e no backoffice." : "Agrupam as UFCD no backoffice e nos relatórios ao financiador."}</p>,
      };
    }
    return {
      kind: "datas", regime, singular: "data", plural: "datas", campoEstado: "status",
      rotulo: i => `${txt(i.curso)} · ${data(txt(i.inicio))}`,
      pesquisa: i => `${txt(i.curso)} ${txt(i.local)} ${txt(i.horario)}`,
      filtros: [
        { chave: "curso", rotulo: "Curso", vazio: "Todos os cursos", opcoes: cursos.selecao },
        { chave: "local", rotulo: "Local", vazio: "Todos os locais", opcoes: locais.selecao },
      ],
      campos: [
        { chave: "curso", rotulo: regime === "gold" ? "Curso" : "Curso / UFCD", tipo: "opcoes", opcoes: cursos.selecao, obrigatorio: true },
        { chave: "inicio", rotulo: "Início", tipo: "data", obrigatorio: true, metade: true },
        { chave: "fim", rotulo: "Fim", tipo: "data", metade: true },
        { chave: "horario", rotulo: "Horário", tipo: "opcoes", opcoes: horarios.selecao, metade: true },
        { chave: "local", rotulo: "Local", tipo: "opcoes", opcoes: locais.selecao, metade: true },
        ...(regime === "gold" ? [{ chave: "preco", rotulo: "Preço (€)", tipo: "numero" as const, metade: true }] : []),
        { chave: "link", rotulo: "Ligação de inscrição", ajuda: "Opcional. Endereço público desta edição." },
      ],
      colunas: [
        { id: "inicio", titulo: "Início", celula: i => data(txt(i.inicio)) },
        { id: "fim", titulo: "Fim", esconderMovel: true, celula: i => data(txt(i.fim)) },
        { id: "curso", titulo: "Curso", principal: true, celula: i => <span className="font-semibold">{txt(i.curso)}</span> },
        { id: "local", titulo: "Local · horário", celula: i => [txt(i.local), txt(i.horario)].filter(Boolean).join(" · ") || "—" },
        ...(regime === "gold" ? [{ id: "preco", titulo: "Preço", alinhar: "dir" as const, celula: (i: Record<string, unknown>) => eur(Number(i.preco ?? 0)) }] : []),
      ],
      validar: v => (v.fim && txt(v.fim) < txt(v.inicio) ? "O fim não pode ser antes do início." : null),
      nota: <p className="m-0 text-[13px] text-tinta-suave">
        {regime === "gold"
          ? "Calendário comercial de referência. A pré-inscrição só mostra turmas libertadas (curso, local, horário e data)."
          : "Calendário das UFCD: início, fim, horário e local. Sem preço: a edição é financiada."}
      </p>,
    };
  }, [tabela, regime, cursos.selecao, locais.selecao, horarios.selecao]);

  const separadores = (Object.keys(VISTAS[regime]) as Tabela[]).map(id => ({
    id, rotulo: { datas: "Datas", locais: "Locais", programas: "Programas", horarios: "Horários", areas: "Áreas temáticas" }[id],
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: regime === "gold" ? "Gold" : "Financiada" }, { rotulo: "Edição de cursos" }, { rotulo: separadores.find(s => s.id === tabela)?.rotulo ?? "" }]}
        titulo={regime === "fin" ? "Datas, locais, programas e áreas" : "Datas, locais e áreas"}
        subtitulo="Tabelas de apoio dos cursos e das turmas. O uso de cada registo é contado nos dados reais."
      />
      <Separadores
        rotulo="Tabelas de apoio"
        itens={separadores}
        ativo={tabela}
        onMudar={id => { const v = VISTAS[regime][id]; if (v) navigate(v); }}
      />
      <CatalogoTabela key={`${regime}-${tabela}`} config={config} />
      <Modal aberto={Boolean(logo)} onFechar={() => setLogo(null)} titulo={`Logótipo · ${logo?.nome ?? ""}`}
        subtitulo="Vai no rodapé de todos os documentos das turmas deste programa, entre o da DGERT e o da União Europeia. PNG ou JPG até 1 MB.">
        {logo && <LogoDocumento destino={logoPrograma(logo.id)} podeEditar nome="o logótipo deste programa"
          semLogo="Sem logótipo: os documentos das turmas deste programa saem só com o da DGERT e o da União Europeia." />}
      </Modal>
    </div>
  );
}

function repetido(itens: Record<string, unknown>[], id: number | null, campo: string, valor: unknown, msg: string) {
  const alvo = txt(valor).trim().toLowerCase();
  return itens.some(i => i.id !== id && txt(i[campo]).trim().toLowerCase() === alvo) ? msg : null;
}
