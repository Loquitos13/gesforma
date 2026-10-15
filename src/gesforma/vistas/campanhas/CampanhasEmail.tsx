// Campanhas por email aos pré-inscritos parados: quem recebe (critérios e escolha), envio e histórico dos envios.
import { useEffect, useState } from "react";
import {
  apiCandidatosEmail, apiDestinosEnvio, apiEnviarCampanhaEmail, apiEnviosEmail, type Campanha, type CandidatoEmail, type CriteriosEmail,
} from "../../../partilhado/api/campanhas";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Aviso, Botao, Caixa, Campo, Cartao, Entrada, ErroCarregar, Esqueleto, Modal, Selecao, Tabela, Vazio, data, dataHora, num, type Coluna,
} from "../../../partilhado/ui";

const INICIAL: CriteriosEmail = { dias: 30, contactos: 2, curso: "", soDocsEmFalta: false };

export function CampanhasEmail({ campanhas, gerir }: { campanhas: Campanha[]; gerir: boolean }) {
  const { dados, erro, aCarregar, recarregar } = useRecurso("campanhas:email:envios", signal => apiEnviosEmail({ signal }));
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);
  const envios = dados?.envios ?? [];
  return (
    <Cartao
      titulo="Campanhas por email"
      subtitulo="Pré-inscritos há mais de um mês, já contactados (os lembretes automáticos contam), com documentos em falta ou que não passaram a formando. O email leva os cronogramas das próximas turmas e a ligação pessoal."
      acoes={gerir ? <Botao variante="primario" onClick={() => setNovo(true)}>Nova campanha por email</Botao> : undefined}
    >
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : aCarregar && !dados ? <Esqueleto linhas={3} /> : envios.length === 0 ? (
        <Vazio titulo="Ainda sem campanhas por email." descricao="Escolha os pré-inscritos parados e envie-lhes os cronogramas das próximas turmas." />
      ) : (
        <ul className="m-0 list-none p-0 text-[13px]">
          {envios.map(e => (
            <li key={e.id} className="border-t border-linha-suave py-2.5 first:border-t-0">
              <button type="button" className="flex w-full items-center gap-3 border-0 bg-transparent p-0 text-left cursor-pointer" onClick={() => setAberto(a => (a === e.id ? null : e.id))} aria-expanded={aberto === e.id}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-tinta">{dataHora(e.criadoEm)}{e.campanha ? ` · ${e.campanha}` : ""}</span>
                  <span className="block text-xs text-tinta-suave">
                    {[`há mais de ${num(e.criterios.dias ?? 30)} dias`, `${num(e.criterios.contactos ?? 2)}+ contactos`, e.criterios.curso, e.criterios.soDocsEmFalta ? "só com documentos em falta" : "", e.autor].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="num whitespace-nowrap font-semibold">{num(e.enviados)} / {num(e.total)} na fila</span>
              </button>
              {aberto === e.id && <Destinos id={e.id} />}
            </li>
          ))}
        </ul>
      )}
      {novo && <NovaCampanhaEmail campanhas={campanhas} onFechar={() => setNovo(false)} onEnviada={() => { setNovo(false); invalidar("campanhas:email"); }} />}
    </Cartao>
  );
}

function Destinos({ id }: { id: number }) {
  const { dados, erro, recarregar } = useRecurso(`campanhas:email:destinos:${id}`, signal => apiDestinosEnvio(id, { signal }));
  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <Esqueleto linhas={2} className="mt-2" />;
  return (
    <ul className="m-0 mt-2 list-none rounded-controlo bg-fundo p-2 text-xs">
      {dados.destinos.map(d => (
        <li key={d.preinscricaoId} className="flex gap-2 py-0.5">
          <span className="min-w-0 flex-1 truncate">{d.nome} · {d.curso}</span>
          <span className={d.enviado ? "text-sucesso" : "text-perigo"}>{d.enviado ? d.estado : d.erro || "não enviado"}</span>
        </li>
      ))}
    </ul>
  );
}

function NovaCampanhaEmail({ campanhas, onFechar, onEnviada }: { campanhas: Campanha[]; onFechar: () => void; onEnviada: () => void }) {
  const [k, setK] = useState<CriteriosEmail>(INICIAL);
  const [pesquisa, setPesquisa] = useState<CriteriosEmail>(INICIAL);
  const [sel, setSel] = useState<Set<string | number>>(new Set());
  const [campanhaId, setCampanhaId] = useState("");
  const cursos = useOpcoes("cursos");
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `campanhas:email:candidatos:${pesquisa.dias}:${pesquisa.contactos}:${pesquisa.curso}:${pesquisa.soDocsEmFalta}`,
    signal => apiCandidatosEmail(pesquisa, { signal }),
  );
  const lista = dados?.candidatos ?? [];
  // Por omissão vão todos os que aparecem (até 150 por envio).
  useEffect(() => { setSel(new Set(lista.slice(0, 150).map(c => c.id))); }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const enviar = useAccao(apiEnviarCampanhaEmail, {
    ok: r => r.postos === r.total ? `${num(r.postos)} email${r.postos === 1 ? "" : "s"} na fila de envio.` : `${num(r.postos)} de ${num(r.total)} emails na fila. Veja os que falharam no envio.`,
  });

  const colunas: Coluna<CandidatoEmail>[] = [
    {
      id: "nome", titulo: "Pré-inscrito", principal: true,
      celula: c => (
        <span className="block min-w-0">
          <span className="block font-semibold text-tinta truncate">{c.nome}</span>
          <span className="block text-xs text-tinta-suave truncate">{c.curso} · desde {data(c.inscritoEm)}</span>
        </span>
      ),
    },
    { id: "contactos", titulo: "Contactos", alinhar: "dir", celula: c => num(c.contactos) },
    { id: "motivo", titulo: "Motivo", celula: c => <span className="text-xs">{c.motivo}{c.ultimoEnvio ? <span className="block text-tinta-suave">última campanha {data(c.ultimoEnvio)}</span> : null}</span> },
  ];
  const n = sel.size;

  return (
    <Modal aberto onFechar={onFechar} largura="xl" titulo="Nova campanha por email" rodape={
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-[13px] text-tinta-suave">{num(n)} escolhido{n === 1 ? "" : "s"}{n > 150 ? " · no máximo 150 por envio" : ""}</span>
        <Botao onClick={onFechar}>Cancelar</Botao>
        <Botao variante="primario" disabled={n === 0 || n > 150} aCarregar={enviar.aCorrer}
          onClick={() => void enviar.correr({ criterios: pesquisa, ids: [...sel].map(Number), campanhaId: campanhaId ? Number(campanhaId) : null }).then(r => { if (r) onEnviada(); })}>
          Enviar a {num(n)}
        </Botao>
      </div>
    }>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-4 items-end">
          <Campo rotulo="Pré-inscritos há mais de (dias)">
            {p => <Entrada {...p} type="number" min={0} max={3650} value={k.dias} onChange={e => setK({ ...k, dias: Number(e.target.value) || 0 })} />}
          </Campo>
          <Campo rotulo="Com pelo menos (contactos)">
            {p => <Entrada {...p} type="number" min={0} max={50} value={k.contactos} onChange={e => setK({ ...k, contactos: Number(e.target.value) || 0 })} />}
          </Campo>
          <Campo rotulo="Curso">
            {p => <Selecao {...p} value={k.curso} onChange={e => setK({ ...k, curso: e.target.value })} opcoes={cursos.selecao} vazio="Todos os cursos" />}
          </Campo>
          <Botao onClick={() => setPesquisa(k)}>Procurar</Botao>
        </div>
        <Caixa rotulo="Só quem tem documentos em falta" checked={k.soDocsEmFalta} onChange={e => { const x = { ...k, soDocsEmFalta: e.target.checked }; setK(x); setPesquisa(x); }} />
        <Campo rotulo="Associar a uma campanha (opcional)" ajuda="Só para o histórico: não muda a origem das pré-inscrições nem os números da campanha.">
          {p => <Selecao {...p} value={campanhaId} onChange={e => setCampanhaId(e.target.value)} opcoes={campanhas.map(c => ({ valor: String(c.id), rotulo: c.nome }))} vazio="Sem campanha" />}
        </Campo>
        <Aviso tom="info">O texto é o modelo «Campanha · pré-inscritos» (Sistema › Emails automáticos › Modelos). Cada envio fica como contacto na ficha da pré-inscrição.</Aviso>
        {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : (
          <Tabela
            rotulo="Pré-inscritos a receber a campanha"
            linhas={lista}
            colunas={colunas}
            chave={c => c.id}
            selecao={{ selecionados: sel, onMudar: setSel }}
            aCarregar={aCarregar && !dados}
            alturaMax="45vh"
            vazio={<Vazio titulo="Ninguém cumpre estes critérios." descricao="Experimente menos dias ou menos contactos." />}
          />
        )}
      </div>
    </Modal>
  );
}
