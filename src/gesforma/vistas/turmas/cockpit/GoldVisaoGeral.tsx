// Separador "Visão geral" do cockpit Gold: números da turma, programa, formandos, formadores e custos.
import { EmptyHint, MobileCard, RowActions } from "../../../../partilhado/SecretaryUX";
import type { FormandoTurma } from "../../../../partilhado/tiposFormando";
import { hojeIso, type TurmaGold } from "../../../../partilhado/turmaModel";
import { Botao, Cartao, eur } from "../../../../partilhado/ui";
import { CustosTurmaCard } from "../../../CustosTurma";
import { BotaoListagem, I, Th, Td, formatSessaoLine } from "./base";
import { FormadoresAtribuidosCard } from "../../../CronogramaEditor";
import { diaDeCarimbo } from "../../../../partilhado/horaLisboa";

export function GoldVisaoGeral({ turma, membros, souFormador, verCustos, activa, programa, onFicha, onTransferir, onEliminar, onAdicionar, onEditarPrograma, onFormadores, onFormador, onSala, onValoresHora }: {
  turma: TurmaGold;
  membros: FormandoTurma[];
  souFormador: boolean;
  activa: boolean;
  programa: string[];
  onFicha?: (f: FormandoTurma) => void;
  onTransferir: (f: FormandoTurma) => void;
  onEliminar: (f: FormandoTurma) => void;
  onAdicionar: () => void;
  onEditarPrograma: () => void;
  onFormadores: (nomes: string[]) => void;
  onFormador: (nome: string) => void;
  onSala: (valor: number) => void;
  /** Custos e valor por hora: só a gestão (nunca o formador nem a comercial). */
  verCustos: boolean;
  onValoresHora: (valores: Record<string, number>) => void;
}) {
  const pagos = membros.filter(f => f.pago);
  const receita = pagos.reduce((s, f) => s + (Number(f.valor) || 0), 0);
  const porCobrar = membros.filter(f => !f.pago).reduce((s, f) => s + (Number(f.valor) || 0), 0);
  const numeros = souFormador
    ? [
        { l: "Formandos", v: String(turma.totalAlunos), c: "text-tinta" },
        { l: "Sessões", v: String(turma.cronograma.length), c: "text-tinta" },
      ]
    : [
        { l: "Formandos", v: String(turma.totalAlunos), c: "text-tinta" },
        { l: "Pagamentos em dia", v: `${pagos.length}/${membros.length}`, c: pagos.length === membros.length ? "text-sucesso" : "text-aviso" },
        { l: "Receita confirmada", v: eur(receita), c: "text-sucesso" },
        { l: "Por cobrar", v: eur(porCobrar), c: porCobrar > 0 ? "text-aviso" : "text-tinta-suave" },
      ];
  const futuras = turma.cronograma.filter(s => s.data >= hojeIso());
  const accoes = (f: FormandoTurma) => [
    ...(onFicha ? [{ label: "Ficha", icon: I.eye, onClick: () => onFicha(f) }] : []),
    ...(!souFormador ? [
      { label: "Transferir", icon: I.transfer, tone: "purple" as const, onClick: () => onTransferir(f) },
      { label: "Eliminar", icon: I.trash, tone: "red" as const, onClick: () => onEliminar(f) },
    ] : []),
  ];

  return (
    <>
      <div className={`grid gap-3 ${souFormador ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {numeros.map(s => (
          <Cartao key={s.l}>
            <p className="m-0 text-xs text-tinta-suave">{s.l}</p>
            <p className={`num m-0 mt-1 text-xl font-semibold ${s.c}`}>{s.v}</p>
          </Cartao>
        ))}
      </div>
      <Cartao titulo="Programa de formação" acoes={!souFormador ? <Botao variante="ligacao" tamanho="sm" onClick={onEditarPrograma}>Editar programa</Botao> : undefined}>
        <ul className="m-0 p-0 list-none space-y-2">
          {(programa.length ? programa : ["Ainda sem módulos na ficha deste curso. Edite o programa na ficha do curso."]).map((linha, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-tinta">
              <span className="w-1.5 h-1.5 rounded-full bg-acao mt-1.5 flex-shrink-0" aria-hidden="true" />{linha}
            </li>
          ))}
        </ul>
      </Cartao>
      <Cartao
        titulo="Formandos"
        semPadding
        acoes={!souFormador ? (
          <div className="flex gap-2">
            <BotaoListagem regime="gold" turmaId={turma.id} vazia={membros.length === 0} />
            <Botao variante="primario" tamanho="sm" disabled={!activa} title={activa ? undefined : "Turma inativa: não aceita novas inscrições"} onClick={onAdicionar}>Adicionar</Botao>
          </div>
        ) : undefined}
      >
        {membros.length === 0 && (
          <EmptyHint text="Ainda sem formandos nesta turma." action={activa && !souFormador ? "Adicionar o primeiro formando" : undefined} onAction={activa && !souFormador ? onAdicionar : undefined} />
        )}
        <div className="md:hidden p-3 space-y-2">
          {membros.map(f => (
            <MobileCard
              key={f.id}
              title={`${f.nome} ${f.apelido}`}
              sub={f.email}
              badge={souFormador ? undefined : <span className={`text-[11px] font-bold ${f.pago ? "text-sucesso" : "text-aviso"}`}>{f.pago ? "Pago" : "Por pagar"}</span>}
              meta={[f.telf, diaDeCarimbo(f.inscrito) || f.inscrito.slice(0, 10)].filter(Boolean)}
              onOpen={onFicha ? () => onFicha(f) : undefined}
              actions={accoes(f)}
            />
          ))}
        </div>
        {membros.length > 0 && (
          <div className="hidden md:block overflow-auto max-h-[min(70vh,640px)]">
            <table className="w-full text-sm">
              <thead><tr><Th>Nome</Th><Th>Contacto</Th><Th>Inscrito a</Th>{!souFormador && <Th className="text-center">Pago</Th>}{!souFormador && <Th>Método</Th>}<Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-linha-suave">
                {membros.map(f => (
                  <tr key={f.id} className="hover:bg-fundo">
                    <Td>
                      {onFicha
                        ? <button type="button" onClick={() => onFicha(f)} className="text-left bg-transparent border-0 p-0"><p className="m-0 text-xs font-semibold text-ligacao hover:underline">{f.nome} {f.apelido}</p></button>
                        : <p className="m-0 text-xs font-semibold text-tinta">{f.nome} {f.apelido}</p>}
                      <p className="m-0 text-xs text-tinta-suave truncate max-w-[180px]">{f.email}</p>
                    </Td>
                    <Td className="font-mono text-xs text-tinta-suave">{f.telf || "—"}</Td>
                    <Td className="font-mono text-xs text-tinta-suave whitespace-nowrap">{diaDeCarimbo(f.inscrito) || f.inscrito.slice(0, 10)}</Td>
                    {!souFormador && (
                      <Td className="text-center">
                        <span className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-white ${f.pago ? "bg-sucesso" : "bg-linha"}`} aria-label={f.pago ? "Pago" : "Por pagar"}>{f.pago ? I.check : ""}</span>
                      </Td>
                    )}
                    {!souFormador && <Td className="text-xs text-tinta-suave">{f.metodo}</Td>}
                    <Td><RowActions actions={accoes(f)} /></Td>
                  </tr>
                ))}
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
                    <span className="w-1.5 h-1.5 rounded-full bg-acao flex-shrink-0" aria-hidden="true" />{formatSessaoLine(s)}
                  </li>
                ))}
              </ul>
            )}
        </Cartao>
      </div>
      {verCustos && <CustosTurmaCard turma={turma} regime="gold" canEdit onSala={onSala} onValores={onValoresHora} />}
    </>
  );
}
