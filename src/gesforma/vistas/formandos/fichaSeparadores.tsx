import { useState } from "react";
import {
  apiLembreteDocsFin, apiMarcarDocFormando, apiNotaFormando, apiValidarDocFormando, type DocFicha, type FichaFormando,
} from "../../../partilhado/api/formandos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { toastOk } from "../../../partilhado/toastBus";
import {
  AreaTexto, Aviso, Botao, BotaoLigacao, Campo, Cartao, Estado, Kpi, KpiFaixa, Vazio, data, dataHora, num,
} from "../../../partilhado/ui";
import { RecusarDoc } from "./fichaDialogos";
import { ESTADO_DOC } from "./partes";

const INVALIDAR = ["formandos:"];

export function SeparadorDocumentos({ ficha, podeEditar }: { ficha: FichaFormando; podeEditar: boolean }) {
  const [recusar, setRecusar] = useState<{ id: string; label: string } | null>(null);
  const validar = useAccao((docId: string) => apiValidarDocFormando(ficha.regime, ficha.id, docId), { invalidar: INVALIDAR, ok: "Documento validado." });
  const marcar = useAccao((docId: string, ok: boolean) => apiMarcarDocFormando(ficha.regime, ficha.id, docId, ok), {
    invalidar: INVALIDAR, ok: "Documento actualizado.",
  });
  const lembrete = useAccao(() => apiLembreteDocsFin(ficha.id), { ok: "Lembrete enviado ao formando." });
  const fin = ficha.regime === "fin";
  const pasta = ["GesForma", fin ? "Financiada" : "Gold", "Turmas", ficha.turma?.nome, "Formandos", `${ficha.nome} ${ficha.apelido}`.trim()].filter(Boolean).join(" › ");

  function acoes(d: DocFicha) {
    if (!podeEditar) return null;
    const manual = !d.fileName;
    return (
      <div className="flex gap-1.5 flex-wrap justify-end">
        {d.estado === "pendente" && <Botao tamanho="sm" variante="primario" aCarregar={validar.aCorrer} onClick={() => validar.correr(d.id)}>Validar</Botao>}
        {(d.estado === "pendente" || (d.estado === "validado" && !manual)) && (
          <Botao tamanho="sm" variante="fantasma" onClick={() => setRecusar({ id: d.id, label: d.label })}>Recusar</Botao>
        )}
        {d.estado === "em_falta" && <Botao tamanho="sm" aCarregar={marcar.aCorrer} onClick={() => marcar.correr(d.id, true)} title="Entregue em papel ou por outra via">Marcar entregue</Botao>}
        {d.estado === "validado" && manual && <Botao tamanho="sm" variante="fantasma" aCarregar={marcar.aCorrer} onClick={() => marcar.correr(d.id, false)}>Retirar</Botao>}
      </div>
    );
  }

  return (
    <Cartao
      semPadding
      titulo="Documentos"
      subtitulo={`${num(ficha.docsResumo.validados)} de ${num(ficha.docsResumo.total)} obrigatórios validados${ficha.docsResumo.recusados ? ` · ${ficha.docsResumo.recusados} recusado(s)` : ""}`}
      acoes={fin && (
        <>
          {ficha.ligacaoDocumentos && (
            <Botao tamanho="sm" onClick={() => { void navigator.clipboard?.writeText(ficha.ligacaoDocumentos ?? ""); toastOk("Ligação copiada."); }}>
              Copiar ligação de documentos
            </Botao>
          )}
          {podeEditar && <Botao tamanho="sm" aCarregar={lembrete.aCorrer} onClick={() => lembrete.correr()}>Enviar lembrete</Botao>}
        </>
      )}
    >
      {ficha.documentos.length === 0 ? (
        <Vazio compacto titulo="Sem documentos definidos para esta ficha." />
      ) : (
        <ul className="m-0 p-0 list-none divide-y divide-linha-suave">
          {ficha.documentos.map(d => {
            const e = ESTADO_DOC[d.estado] ?? ESTADO_DOC.em_falta!;
            const detalhe = d.estado === "recusado"
              ? d.observacao
              : d.estado === "validado"
                ? [d.validadoPor && `por ${d.validadoPor}`, d.validadoEm && data(d.validadoEm), !d.fileName && "sem ficheiro no GesForma"].filter(Boolean).join(" · ")
                : d.fileName || (d.required ? "Obrigatório" : "Opcional");
            return (
              <li key={d.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <p className="m-0 text-sm font-medium text-tinta">{d.label}{!d.required && <span className="text-tinta-suave font-normal"> · opcional</span>}</p>
                  {detalhe && <p className="m-0 text-xs text-tinta-suave">{detalhe}</p>}
                </div>
                <Estado tom={e.tom}>{e.rotulo}</Estado>
                {d.driveUrl && <BotaoLigacao href={d.driveUrl} target="_blank" rel="noopener noreferrer" tamanho="sm" variante="ligacao">Abrir</BotaoLigacao>}
                {acoes(d)}
              </li>
            );
          })}
        </ul>
      )}
      <p className="m-0 px-5 py-3 border-t border-linha text-xs text-tinta-suave">Os documentos validados ficam no Drive: {pasta}.</p>
      <RecusarDoc alvo={recusar} onFechar={() => setRecusar(null)} ficha={ficha} />
    </Cartao>
  );
}

export function SeparadorAvaliacao({ ficha }: { ficha: FichaFormando }) {
  const r = ficha.resultado;
  if (!ficha.turma) return <Cartao><Vazio compacto titulo="Sem turma." descricao="A assiduidade e a avaliação aparecem quando o formando estiver numa turma." /></Cartao>;
  if (!r) return <Cartao><Vazio compacto titulo="Ainda sem registos." descricao="Aparecem quando houver sessões com presenças ou notas lançadas na turma." /></Cartao>;
  const a = r.assiduidade;
  const abaixo = a.pct != null && a.pct < a.minimo;
  return (
    <div className="flex flex-col gap-4">
      <KpiFaixa rotulo="Assiduidade e avaliação" className="xl:grid-cols-4 md:grid-cols-4">
        <Kpi rotulo="Assiduidade" valor={a.pct == null ? "—" : `${num(a.pct)} %`} delta={{ texto: `mínimo ${num(a.minimo)} %`, tom: abaixo ? "perigo" : "neutro" }} />
        <Kpi rotulo="Horas presentes" valor={`${num(a.horasPresente)} h`} delta={`de ${num(a.horasPrevistas)} h previstas`} />
        <Kpi rotulo="Nota final" valor={r.nota == null ? "—" : num(r.nota)} delta={r.aprovado == null ? "avaliação incompleta" : r.aprovado ? { texto: "Aprovado", tom: "sucesso" } : { texto: "Não aprovado", tom: "perigo" }} />
        <Kpi rotulo="Certificado" valor={r.elegivel ? "Elegível" : "Ainda não"} delta={r.elegivel ? { texto: "cumpre as regras", tom: "sucesso" } : { texto: `${r.motivos.length} motivo(s)`, tom: "aviso" }} />
      </KpiFaixa>
      {r.motivos.length > 0 && (
        <Aviso tom="aviso" titulo="Porque ainda não é elegível para certificado">
          <ul className="m-0 pl-4">{r.motivos.map(m => <li key={m}>{m}</li>)}</ul>
        </Aviso>
      )}
      <p className="m-0 text-xs text-tinta-suave">
        As presenças e as notas lançam-se na turma. A assiduidade conta em horas, a partir das folhas de presença de cada sessão.
      </p>
    </div>
  );
}

export function SeparadorContratos({ ficha }: { ficha: FichaFormando }) {
  const c = ficha.certificado;
  return (
    <div className="flex flex-col gap-4">
      <Cartao titulo="Contratos">
        <Aviso tom="info" titulo="Assinatura no GesForma ainda não disponível">
          O envio do contrato para assinatura (código por email e selo da ENA) ainda não existe. Por agora, o contrato de formação
          assinado entra como documento «Contrato de formação» no separador Documentos.
        </Aviso>
      </Cartao>
      <Cartao titulo="Certificados">
        {c?.emitido ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="m-0 text-sm font-medium text-tinta">{ficha.curso}</p>
              <p className="m-0 text-xs text-tinta-suave">Emitido{c.emitidoEm ? ` a ${data(c.emitidoEm)}` : ""}{c.nota != null ? ` · nota ${num(c.nota)}` : ""}</p>
            </div>
            <Estado tom="sucesso">Emitido</Estado>
            {c.url && <BotaoLigacao href={c.url} target="_blank" rel="noopener noreferrer" tamanho="sm">Abrir PDF</BotaoLigacao>}
          </div>
        ) : (
          <Vazio compacto titulo="Ainda sem certificado." descricao={ficha.turma ? "O certificado emite-se na turma, depois do fecho e com o formando elegível." : "O certificado emite-se na turma."} />
        )}
      </Cartao>
    </div>
  );
}

export function SeparadorHistorico({ ficha, podeEditar }: { ficha: FichaFormando; podeEditar: boolean }) {
  const [texto, setTexto] = useState("");
  const nota = useAccao((t: string) => apiNotaFormando(ficha.regime, ficha.id, t), { invalidar: INVALIDAR, ok: "Nota guardada." });
  return (
    <div className="grid gap-4 xl:grid-cols-2 items-start">
      <Cartao titulo="Notas">
        {podeEditar && (
          <div className="flex flex-col gap-2 mb-4">
            <Campo rotulo="Nova nota">{p => <AreaTexto {...p} value={texto} onChange={e => setTexto(e.target.value)} maxLength={4000} placeholder="Ex.: ligou a pedir a fatura em nome da empresa." />}</Campo>
            <div><Botao tamanho="sm" variante="primario" disabled={!texto.trim()} aCarregar={nota.aCorrer} onClick={async () => { if (await nota.correr(texto.trim())) setTexto(""); }}>Guardar nota</Botao></div>
          </div>
        )}
        {ficha.notas.length === 0 ? <Vazio compacto titulo="Sem notas." /> : (
          <ul className="m-0 p-0 list-none flex flex-col gap-3">
            {ficha.notas.map(n => (
              <li key={n.id} className="text-sm">
                <p className="m-0 text-tinta whitespace-pre-wrap">{n.texto}</p>
                <p className="m-0 mt-0.5 text-xs text-tinta-suave">{n.autor || "Sistema"} · {dataHora(n.data)}</p>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <Cartao titulo="Histórico">
        {ficha.historico.length === 0 ? <Vazio compacto titulo="Sem registos." /> : (
          <ol className="m-0 p-0 list-none flex flex-col gap-2.5">
            {ficha.historico.map(h => (
              <li key={h.id} className="text-sm flex gap-3">
                <span className="num text-xs text-tinta-suave w-[120px] shrink-0">{dataHora(h.data)}</span>
                <span className="text-tinta">{h.acao}{h.autor && <span className="text-tinta-suave"> · {h.autor}</span>}</span>
              </li>
            ))}
          </ol>
        )}
      </Cartao>
    </div>
  );
}
