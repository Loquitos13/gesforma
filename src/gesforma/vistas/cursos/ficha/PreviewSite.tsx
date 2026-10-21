import { useMemo, useState } from "react";
import { Cartao, Estado, Interruptor, Selecao, data as fmtData, eur } from "../../../../partilhado/ui";
import { textoPrograma } from "../../../cursoPrograma";
import type { FichaCurso } from "./useFichaCurso";
import { hojeLisboa } from "../../../../partilhado/horaLisboa";
import { rotuloCodigoCurso } from "../../../../partilhado/codigoCurso";
import { textosCurso } from "../../../../partilhado/textosCurso";

const marcadores = (txt: string) => txt.split("\n").map(l => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean).slice(0, 5);

/** Pré-visualização da página pública do curso, com o mesmo texto que o site vai mostrar. */
export function PreviewSite({ f }: { f: FichaCurso }) {
  const { data, regime, turmas } = f;
  const abertas = turmas.filter(t => !t.fechada);
  const locais = useMemo(() => [...new Set(abertas.map(t => t.local).filter(Boolean))], [abertas]);
  const [local, setLocal] = useState("");
  const [horario, setHorario] = useState("");
  const horarios = [...new Set(abertas.filter(t => !local || t.local === local).map(t => t.horario).filter(Boolean))];
  const datas = abertas.filter(t => (!local || t.local === local) && (!horario || t.horario === horario));
  const programa = textoPrograma(data.organizacaoPrograma, data.topicosPrograma) || data.programa;
  const destaque = textosCurso(data);

  return (
    <div className="overflow-hidden rounded-cartao border border-linha bg-superficie shadow-sm">
      <div className="flex items-center gap-2 border-b border-linha bg-fundo px-3 py-2">
        <span className="flex-1 truncate font-mono text-[11px] text-tinta-suave">/formacao/{data.slug || "…"}</span>
        <Estado tom={data.visivelSite ? "sucesso" : "neutro"}>{data.visivelSite ? "Publicada" : "Rascunho"}</Estado>
      </div>
      <div className="max-h-[720px] overflow-y-auto">
        <div className="border-b border-linha bg-fundo p-3">
          <p className="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-wide text-tinta-suave">No catálogo</p>
          <div className="flex gap-3 rounded-controlo border border-linha bg-superficie p-2.5">
            {(data.miniatura?.url || data.capa?.url) && <img src={data.miniatura?.url || data.capa?.url} alt="" className="h-14 w-14 shrink-0 rounded-controlo object-cover" />}
            <div className="min-w-0">
              <p className="m-0 text-[13px] font-bold leading-snug text-tinta">{data.titulo || "Título do curso"}</p>
              <p className="m-0 mt-0.5 text-xs leading-snug text-tinta-suave">{destaque.resumo || "O texto de destaque aparece aqui."}</p>
            </div>
          </div>
        </div>
        <div className="relative h-36 bg-nav">
          {data.banner?.url && <img src={data.banner.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wide text-white/80">
              {[data.regime, regime === "fin" && data.ufcdCod ? `${rotuloCodigoCurso(data.ufcdCod)}` : ""].filter(Boolean).join(" · ") || "modalidade"}
            </p>
            <h3 className="m-0 text-base font-bold leading-snug text-white">{data.titulo || "Título do curso"}</h3>
          </div>
        </div>
        <div className="space-y-4 p-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Estado tom="acao">{regime === "fin" ? "Financiado" : data.preco ? eur(Number(data.preco)) : "Preço por definir"}</Estado>
            <Estado>{data.horas ? `${data.horas} horas` : "Horas por definir"}</Estado>
            {data.categoria && <Estado>{data.categoria}</Estado>}
          </div>
          <Seccao titulo="Síntese"><p className="m-0 whitespace-pre-line text-tinta-suave">{data.sintese || "O texto completo aparece aqui."}</p></Seccao>
          <Seccao titulo="Objetivos">
            <ul className="m-0 space-y-1 pl-4 text-tinta-suave">
              {(marcadores(data.objetivos).length ? marcadores(data.objetivos) : ["Os objetivos aparecem aqui, um por linha."]).map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </Seccao>
          <Seccao titulo="Programa"><p className="m-0 whitespace-pre-line rounded-controlo bg-fundo p-3 text-tinta-suave">{programa || "O percurso (módulos ou capítulos) aparece aqui."}</p></Seccao>
          <Seccao titulo="Funcionamento"><p className="m-0 whitespace-pre-line text-tinta-suave">{data.funcionamento || "Sessões, plataforma e certificação."}</p></Seccao>
          <Seccao titulo="Turmas disponíveis">
            {abertas.length === 0 ? <p className="m-0 text-xs text-tinta-suave">Ainda não há turma aberta deste curso.</p> : (
              <div className="space-y-2">
                <Selecao aria-label="Local" opcoes={locais.map(v => ({ valor: v, rotulo: v }))} vazio="Todos os locais" value={local} onChange={e => { setLocal(e.target.value); setHorario(""); }} />
                <Selecao aria-label="Horário" disabled={!local} opcoes={horarios.map(v => ({ valor: v, rotulo: v }))} vazio={local ? "Escolha o horário" : "Escolha primeiro o local"} value={horario} onChange={e => setHorario(e.target.value)} />
                <ul className="m-0 list-none space-y-1.5 p-0">
                  {datas.map(t => (
                    <li key={t.id} className="num rounded-controlo border border-linha px-2.5 py-1.5 text-xs">
                      <strong>{t.local}</strong> · {t.horario} · {fmtData(t.inicio)} · {Math.max(0, t.vagas - t.inscritos)} vagas
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Seccao>
          <span className="block w-full rounded-controlo bg-acao py-2.5 text-center text-sm font-semibold text-tinta">{regime === "fin" ? "Candidatar-me" : "Quero inscrever-me"}</span>
        </div>
      </div>
    </div>
  );
}

function Seccao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-wide text-ligacao">{titulo}</p>
      {children}
    </section>
  );
}

export function TabPublicacao({ f }: { f: FichaCurso }) {
  const { data, patch, turmas, pronto } = f;
  const hoje = hojeLisboa();
  const proxima = [...turmas].filter(t => !t.fechada && t.inicio >= hoje).sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
  return (
    <div className="space-y-4">
      <Cartao titulo="Estado no site">
        <div className="flex items-start justify-between gap-4 rounded-controlo border border-linha p-4">
          <div>
            <p className="m-0 text-sm font-semibold">Visível no catálogo</p>
            <p className="m-0 mt-0.5 text-xs text-tinta-suave">Activo: a página entra no catálogo do site. Inactivo: o curso deixa de aparecer, mas os registos mantêm-se.</p>
          </div>
          <Interruptor rotulo="Visível no catálogo" ligado={data.visivelSite} onMudar={v => patch({ visivelSite: v, estado: v ? "Ativo" : "Inactivo" })} />
        </div>
        <p className="num m-0 mt-3 text-[13px] text-tinta-suave">
          Próxima data pública: {proxima ? `${fmtData(proxima.inicio)} · ${proxima.local} · ${proxima.horario}` : "sem turma aberta"}. Muda ao criar ou abrir turmas.
        </p>
      </Cartao>
      <Cartao titulo="Checklist da página pública" subtitulo={pronto.pct < 100 ? `Faltam ${pronto.itens.length - pronto.feitos} itens. Pode gravar na mesma: o site mostra o que já existe.` : "A página está completa."}>
        <ul className="m-0 list-none space-y-2 p-0">
          {pronto.itens.map(c => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <span className={c.ok ? "text-tinta" : "text-tinta-suave"}>{c.rotulo}</span>
              <Estado tom={c.ok ? "sucesso" : "aviso"}>{c.ok ? "Pronto" : "Falta"}</Estado>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}
