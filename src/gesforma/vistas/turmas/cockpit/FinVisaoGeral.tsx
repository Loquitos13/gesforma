// Separador "Visão geral" do cockpit Financiada: números, programa da UFCD, formandos com documentos e formadores.
import { DOCS_FORMANDO_FIN, docsFinOkCount } from "../../../../partilhado/dossierDocs";
import { EmptyHint, MobileCard, RowActions } from "../../../../partilhado/SecretaryUX";
import type { FormandoFin } from "../../../../partilhado/tiposFormando";
import { hojeIso, type TurmaFin } from "../../../../partilhado/turmaModel";
import { Botao, Cartao } from "../../../../partilhado/ui";
import { I, Th, Td, estadoBadge, formatSessaoLine } from "./base";
import { FormadoresAtribuidosCard } from "../../../CronogramaEditor";

export function FinVisaoGeral({ turma, membros, prontos, souFormador, activa, programa, onFicha, onTransferir, onEliminar, onAdicionar, onEditarPrograma, onFormadores, onFormador }: {
  turma: TurmaFin;
  membros: FormandoFin[];
  prontos: number;
  souFormador: boolean;
  activa: boolean;
  programa: string[];
  onFicha?: (f: FormandoFin) => void;
  onTransferir: (f: FormandoFin) => void;
  onEliminar: (f: FormandoFin) => void;
  onAdicionar: () => void;
  onEditarPrograma: () => void;
  onFormadores: (nomes: string[]) => void;
  onFormador: (nome: string) => void;
}) {
  const total = DOCS_FORMANDO_FIN.length;
  const numeros = [
    { l: "Código interno", v: turma.nome, c: "text-tinta" },
    { l: "UFCD", v: turma.ufcdCod || "—", c: "text-ligacao" },
    { l: "Formandos", v: `${turma.alunos}/${turma.alunosTotal}`, c: "text-tinta" },
    { l: "Documentos prontos", v: `${prontos}/${membros.length}`, c: prontos === membros.length ? "text-sucesso" : "text-aviso" },
  ];
  const futuras = turma.cronograma.filter(s => s.data >= hojeIso());
  const accoes = (f: FormandoFin) => [
    ...(onFicha ? [{ label: "Ficha", icon: I.eye, onClick: () => onFicha(f) }] : []),
    ...(!souFormador ? [
      { label: "Transferir", icon: I.transfer, tone: "purple" as const, onClick: () => onTransferir(f) },
      { label: "Eliminar", icon: I.trash, tone: "red" as const, onClick: () => onEliminar(f) },
    ] : []),
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {numeros.map(s => (
          <Cartao key={s.l}>
            <p className="m-0 text-xs text-tinta-suave">{s.l}</p>
            <p className={`num m-0 mt-1 text-lg font-semibold truncate ${s.c}`}>{s.v}</p>
          </Cartao>
        ))}
      </div>
      <Cartao titulo="Programa da UFCD" acoes={!souFormador ? <Botao variante="ligacao" tamanho="sm" onClick={onEditarPrograma}>Editar programa</Botao> : undefined}>
        <ul className="m-0 p-0 list-none space-y-2">
          {(programa.length ? programa : [`UFCD ${turma.ufcdCod} · ${turma.curso} (${turma.horas} h)`]).map((linha, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-tinta">
              <span className="w-1.5 h-1.5 rounded-full bg-ligacao mt-1.5 flex-shrink-0" aria-hidden="true" />{linha}
            </li>
          ))}
        </ul>
      </Cartao>
      <Cartao
        titulo="Formandos"
        semPadding
        acoes={!souFormador ? (
          <Botao variante="primario" tamanho="sm" disabled={!activa} title={activa ? undefined : "Turma inativa: não aceita novas inscrições"} onClick={onAdicionar}>Adicionar</Botao>
        ) : undefined}
      >
        {membros.length === 0 && (
          <EmptyHint accent="fin" text="Ainda sem formandos nesta turma." action={activa && !souFormador ? "Adicionar o primeiro formando" : undefined} onAction={activa && !souFormador ? onAdicionar : undefined} />
        )}
        <div className="md:hidden p-3 space-y-2">
          {membros.map(f => {
            const ok = docsFinOkCount(f);
            return (
              <MobileCard key={f.id} title={`${f.nome} ${f.apelido}`} sub={f.email}
                badge={souFormador ? undefined : <span className={`text-[11px] font-bold ${ok === total ? "text-sucesso" : "text-perigo"}`}>{ok}/{total} docs</span>}
                meta={[f.telf, f.estado].filter(Boolean)} onOpen={onFicha ? () => onFicha(f) : undefined} actions={accoes(f)} />
            );
          })}
        </div>
        {membros.length > 0 && (
          <div className="hidden md:block overflow-auto max-h-[min(70vh,640px)]">
            <table className="w-full text-sm">
              <thead><tr><Th>Nome</Th><Th>Contacto</Th><Th>Estado</Th>{!souFormador && <Th>Documentos</Th>}<Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-linha-suave">
                {membros.map(f => {
                  const ok = docsFinOkCount(f);
                  const completos = ok === total;
                  return (
                    <tr key={f.id} className="hover:bg-fundo">
                      <Td>
                        {onFicha
                          ? <button type="button" onClick={() => onFicha(f)} className="text-left bg-transparent border-0 p-0"><p className="m-0 text-xs font-semibold text-ligacao hover:underline">{f.nome} {f.apelido}</p></button>
                          : <p className="m-0 text-xs font-semibold text-tinta">{f.nome} {f.apelido}</p>}
                        <p className="m-0 text-xs text-tinta-suave truncate max-w-[180px]">{f.email}</p>
                      </Td>
                      <Td className="font-mono text-xs text-tinta-suave">{f.telf || "—"}</Td>
                      <Td>{estadoBadge(f.estado)}</Td>
                      {!souFormador && (
                        <Td>
                          <span title="Cartão · habilitações · CV · morada · IBAN · emprego · contrato · RGPD"
                            className={`inline-flex px-2.5 py-1 rounded-controlo text-xs font-semibold ${completos ? "bg-sucesso-suave text-sucesso" : "bg-perigo-suave text-perigo"}`}>
                            {completos ? "Completos" : `${ok}/${total} · ${total - ok} em falta`}
                          </span>
                        </Td>
                      )}
                      <Td><RowActions actions={accoes(f)} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormadoresAtribuidosCard sessoes={turma.cronograma} fallback={turma.formador} extra={turma.formadores}
          onChangeExtra={souFormador ? undefined : onFormadores} onOpen={onFormador} />
        <Cartao titulo="Próximas sessões">
          {futuras.length === 0
            ? <p className="m-0 text-xs text-tinta-suave">Sem sessões futuras. Edite o cronograma da turma.</p>
            : (
              <ul className="m-0 p-0 list-none space-y-2">
                {futuras.slice(0, 3).map((s, i) => (
                  <li key={s.id ?? i} className="flex items-center gap-2 text-xs text-tinta">
                    <span className="w-1.5 h-1.5 rounded-full bg-ligacao flex-shrink-0" aria-hidden="true" />{formatSessaoLine(s)}
                  </li>
                ))}
              </ul>
            )}
        </Cartao>
      </div>
    </>
  );
}
