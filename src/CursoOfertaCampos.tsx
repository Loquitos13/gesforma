import type { OfertaTurma, CursoOfertaSel } from "./oferta";
import { OFERTA_VAZIA, fmtDataPt, ofertaFiltrada, uniqueVals } from "./oferta";

const fieldPublic = "w-full bg-transparent border-0 border-b border-slate-300 px-0 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1b2330] rounded-none";
const labelPublic = "block text-[13px] text-slate-700 mb-1";
const fieldCrm = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400";
const labelCrm = "text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5";

export function CursoOfertaCampos({
  turmas,
  cursos,
  value,
  onChange,
  variant = "public",
  cursoLocked = false,
}: {
  turmas: OfertaTurma[];
  cursos: { nome: string; preco?: number }[];
  value: CursoOfertaSel;
  onChange: (v: CursoOfertaSel) => void;
  variant?: "public" | "crm";
  cursoLocked?: boolean;
}) {
  const locais = uniqueVals(ofertaFiltrada(turmas, { curso: value.curso }), "local");
  const horarios = uniqueVals(ofertaFiltrada(turmas, { curso: value.curso, local: value.local }), "horario");
  const datas = ofertaFiltrada(turmas, { curso: value.curso, local: value.local, horario: value.horario });
  const precoOferta = value.local && value.horario
    ? datas.find(t => t.preco != null)?.preco ?? null
    : null;
  const field = variant === "crm" ? fieldCrm : fieldPublic;
  const Label = "label";
  const labelCls = variant === "crm" ? labelCrm : labelPublic;
  const empty = variant === "crm" ? "text-slate-400" : "text-slate-400";

  function setCurso(curso: string) {
    onChange({ ...OFERTA_VAZIA, curso });
  }
  function setLocal(local: string) {
    onChange({ ...OFERTA_VAZIA, curso: value.curso, local });
  }
  function setHorario(horario: string) {
    onChange({ ...value, horario, dataInicio: "", turmaId: 0 });
  }
  function setData(iso: string) {
    const hit = datas.find(t => t.dataInicio === iso);
    onChange({ ...value, dataInicio: iso, turmaId: hit?.turmaId ?? 0 });
  }

  return (
    <div className={variant === "crm" ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-8"}>
      {variant === "public" && (
        <p className="sm:col-span-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">
          Dados do curso
        </p>
      )}
      {variant === "crm" && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dados do curso</p>
      )}
      <Label className={labelCls}>
        {variant === "crm" ? "Curso a que se quer inscrever" : <>Curso a que se quer inscrever</>}
        <select
          className={`${field} ${value.curso ? "text-slate-800" : empty}`}
          value={value.curso}
          disabled={cursoLocked}
          onChange={e => setCurso(e.target.value)}
        >
          <option value="">Seleccione o curso</option>
          {cursos.map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
        </select>
      </Label>
      <Label className={labelCls}>
        Local
        <select
          className={`${field} ${value.local ? "text-slate-800" : empty}`}
          value={value.local}
          disabled={!value.curso}
          onChange={e => setLocal(e.target.value)}
        >
          <option value="">{value.curso ? "Seleccione o local" : "Escolha primeiro o curso"}</option>
          {locais.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </Label>
      <Label className={labelCls}>
        Horário
        <select
          className={`${field} ${value.horario ? "text-slate-800" : empty}`}
          value={value.horario}
          disabled={!value.local}
          onChange={e => setHorario(e.target.value)}
        >
          <option value="">{value.local ? "Seleccione o horário" : "Escolha primeiro o local"}</option>
          {horarios.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </Label>
      <Label className={labelCls}>
        Data de início
        <select
          className={`${field} ${value.dataInicio ? "text-slate-800" : empty}`}
          value={value.dataInicio}
          disabled={!value.horario}
          onChange={e => setData(e.target.value)}
        >
          <option value="">{value.horario ? "Seleccione a data" : "Escolha primeiro o horário"}</option>
          {datas.map(t => (
            <option key={t.turmaId} value={t.dataInicio}>
              {fmtDataPt(t.dataInicio)} · {t.nome}{t.vagasLivres ? ` · ${t.vagasLivres} vagas restantes` : " · sem vagas restantes"}
            </option>
          ))}
        </select>
      </Label>
      {value.curso && !locais.length && (
        <p className={variant === "crm" ? "text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" : "sm:col-span-2 text-sm text-amber-800"}>
          Ainda não há turma liberada para este curso (local + horário + data de início). A secretaria tem de activar uma turma Gold.
        </p>
      )}
      {precoOferta != null && (
        <p className={variant === "crm" ? "text-sm font-semibold text-amber-700" : "sm:col-span-2 text-sm font-semibold text-slate-800"}>
          Preço desta inscrição: € {precoOferta.toLocaleString("pt-PT")}
          <span className="font-normal text-slate-500"> · vale para {value.local} e {value.horario}</span>
        </p>
      )}
      {value.local && !horarios.length && (
        <p className={variant === "crm" ? "text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" : "sm:col-span-2 text-sm text-amber-800"}>
          Neste local ainda não há horário liberado para {value.curso}.
        </p>
      )}
    </div>
  );
}
