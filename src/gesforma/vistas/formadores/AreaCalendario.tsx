// Área do formador: o meu calendário e a disponibilidade.
import { ApiError } from "../../../partilhado/api/cliente";
import { apiAlterarFormador, apiFichaFormador } from "../../../partilhado/api/formadores";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { DisponibilidadeEditor } from "../../../partilhado/DisponibilidadeEditor";
import { FormadorCalendario } from "../../../partilhado/FormadorCalendario";
import { persist, toastOk } from "../../../partilhado/toastBus";
import { Cartao, ErroCarregar, Esqueleto, PageHeader } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { SemFicha, useMeuFormador } from "./formadoresUi";

export default function AreaCalendario(_props: VistaProps) {
  const eu = useMeuFormador();
  const id = eu.dados?.id;
  const ficha = useRecurso(id ? `formador:${id}` : null, s => apiFichaFormador(id!, s));

  if (eu.erro instanceof ApiError && eu.erro.status === 404) return <SemFicha />;
  const erro = eu.erro ?? ficha.erro;
  if (erro && !ficha.dados) return <ErroCarregar erro={erro} onTentar={() => { eu.recarregar(); ficha.recarregar(); }} />;
  const d = ficha.dados;
  return (
    <div className="space-y-5">
      <PageHeader titulo="O meu calendário" subtitulo="A disponibilidade que registar aqui é a que o cronograma usa. A secretaria pode ajustá-la na ficha." />
      {!d ? <Esqueleto linhas={6} altura="h-12" /> : (
        <>
          <Cartao titulo="Disponibilidade">
            <DisponibilidadeEditor
              value={d.formador.disponibilidade}
              onChange={slots => void persist(apiAlterarFormador(d.formador.id, { disponibilidade: slots }).then(() => {
                toastOk("Disponibilidade gravada.");
                invalidar(`formador:${d.formador.id}`);
              }))}
              nota="Laboral 9h a 13h, pós-laboral 16h30 a 23h, sábado de manhã 9h a 13h e sábado à tarde 14h a 19h."
            />
          </Cartao>
          <FormadorCalendario
            nome={d.formador.nome}
            slots={d.formador.disponibilidade}
            eventos={d.sessoes.map(s => ({
              id: `${s.regime}:${s.turmaId}:${s.data}:${s.horaInicio}`, data: s.data, titulo: s.turma, turma: s.turma,
              inicio: s.horaInicio, fim: s.horaFim, hora: [s.horaInicio, s.horaFim].filter(Boolean).join(" a "),
            }))}
          />
        </>
      )}
    </div>
  );
}
