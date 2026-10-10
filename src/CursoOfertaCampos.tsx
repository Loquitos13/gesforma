import { SearchSelect } from "./FormKit";
import type { OfertaTurma, CursoOfertaSel } from "./oferta";
import { OFERTA_VAZIA, ofertaFiltrada, uniqueVals } from "./oferta";

const labelPublic = "block text-[13px] text-slate-700 mb-1";
const labelCrm = "text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5";

export function CursoOfertaCampos({
  turmas,
  cursos,
  value,
  onChange,
  variant = "public",
  cursoLocked = false,
  preco,
}: {
  turmas: OfertaTurma[];
  cursos: { nome: string; preco?: number }[];
  value: CursoOfertaSel;
  onChange: (v: CursoOfertaSel) => void;
  variant?: "public" | "crm";
  cursoLocked?: boolean;
  preco?: number;
}) {
  const locais = uniqueVals(ofertaFiltrada(turmas, { curso: value.curso }), "local");
  const horarios = uniqueVals(ofertaFiltrada(turmas, { curso: value.curso, local: value.local }), "horario");
  const datas = ofertaFiltrada(turmas, { curso: value.curso, local: value.local, horario: value.horario });
  const precoOferta = value.local && value.horario
    ? datas.find(t => t.preco != null)?.preco ?? null
    : null;
  const Label = "label";
  const labelCls = variant === "crm" ? labelCrm : labelPublic;

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
        <SearchSelect
          value={value.curso}
          disabled={cursoLocked}
          onChange={setCurso}
          options={cursos.map(c => ({ value: c.nome }))}
          allowEmpty
          placeholder="Seleccione o curso"
        />
      </Label>
      <Label className={labelCls}>
        Local
        <SearchSelect
          value={value.local}
          disabled={!value.curso}
          onChange={setLocal}
          options={locais.map(value => ({ value }))}
          allowEmpty
          placeholder={value.curso ? "Seleccione o local" : "Escolha primeiro o curso"}
        />
      </Label>
      <Label className={labelCls}>
        Horário
        <SearchSelect
          value={value.horario}
          disabled={!value.local}
          onChange={setHorario}
          options={horarios.map(value => ({ value }))}
          allowEmpty
          placeholder={value.local ? "Seleccione o horário" : "Escolha primeiro o local"}
        />
      </Label>
      <Label className={labelCls}>
        Data de início
        <SearchSelect
          value={value.dataInicio}
          disabled={!value.horario}
          onChange={setData}
          allowEmpty
          placeholder={value.horario ? "Seleccione a data" : "Escolha primeiro o horário"}
          options={datas.map(t => ({
            value: t.dataInicio,
            sub: `${t.nome}${t.vagasLivres ? ` · ${t.vagasLivres} vagas restantes` : " · sem vagas restantes"}`,
          }))}
        />
      </Label>
      {value.curso && !locais.length && (
        <p className={variant === "crm" ? "text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" : "sm:col-span-2 text-sm text-amber-800"}>
          Ainda não há turma com data para este curso. A inscrição fica registada na mesma e a secretaria confirma a turma.
        </p>
      )}
      {(precoOferta ?? (typeof preco === "number" && preco > 0 ? preco : null)) != null && (
        <p className={variant === "crm" ? "text-sm font-semibold text-amber-700" : "sm:col-span-2 text-sm font-semibold text-slate-800"}>
          Preço desta inscrição: € {(precoOferta ?? preco ?? 0).toLocaleString("pt-PT")}
          {precoOferta != null && value.local && value.horario && (
            <span className="font-normal text-slate-500"> · vale para {value.local} e {value.horario}</span>
          )}
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
