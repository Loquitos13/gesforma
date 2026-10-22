// Conteúdos de cada módulo: PDF, vídeo ou ligação. O ficheiro vai para a Drive da entidade.
import { useMemo, useState } from "react";
import { apiUploadDrive } from "../../../partilhado/api";
import { apiCatalogo, apiCriarItem, apiEditarItem, type ItemCatalogo } from "../../../partilhado/api/catalogos";
import { useDrive } from "../../../partilhado/DriveContext";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Aviso, Botao, Campo, Entrada, Estado, PageHeader, Modal, Selecao, type OpcaoSelecao } from "../../../partilhado/ui";
import { ConteudoAbrirModal, type ConteudoPreview } from "../../ActionSurfaces";
import type { VistaProps } from "../../shell/tipos";
import { CatalogoTabela, chaveCatalogo, type ConfigCatalogo } from "./CatalogoTabela";

const txt = (v: unknown) => String(v ?? "");

function tamanhoLegivel(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function Conteudos({ view }: VistaProps) {
  const regime = view.startsWith("fin-") ? "fin" : "gold";
  const cursos = useOpcoes("cursos", { regime });
  const modulos = useRecurso(chaveCatalogo("modulos", regime), signal => apiCatalogo("modulos", regime, signal));
  const [abrir, setAbrir] = useState<ConteudoPreview | null>(null);

  const rotuloModulo = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of modulos.dados?.itens ?? []) m.set(`${txt(x.curso)}|${txt(x.codigo)}`, `${txt(x.codigo)} · ${txt(x.nome)}`);
    return (curso: string, codigo: string) => m.get(`${curso}|${codigo}`) ?? codigo;
  }, [modulos.dados]);

  const tiposFiltro: OpcaoSelecao[] = useOpcoes("lista", { lista: "tipos_conteudo" }).selecao;

  const config = useMemo((): ConfigCatalogo => ({
    kind: "conteudos", regime, singular: "conteúdo", plural: "conteúdos", campoEstado: "estado",
    capacidade: regime === "gold" ? "cursos.editar" : "cursosFin.editar",
    rotulo: i => txt(i.titulo),
    pesquisa: i => `${txt(i.titulo)} ${txt(i.curso)} ${txt(i.modulo)}`,
    filtros: [
      { chave: "curso", rotulo: "Curso", vazio: "Todos os cursos", opcoes: cursos.selecao },
      { chave: "tipo", rotulo: "Tipo", vazio: "Todos os tipos", opcoes: tiposFiltro },
    ],
    novo: f => ({ curso: f.curso ?? "" }),
    campos: [],
    colunas: [
      { id: "titulo", titulo: "Título", principal: true, celula: i => <span className="font-semibold">{txt(i.titulo)}</span> },
      { id: "tipo", titulo: "Tipo", celula: i => <Estado tom="info">{txt(i.tipo) || "—"}</Estado> },
      { id: "curso", titulo: "Curso", esconderMovel: true, celula: i => <span className="text-tinta-suave">{txt(i.curso)}</span> },
      { id: "modulo", titulo: "Módulo", celula: i => rotuloModulo(txt(i.curso), txt(i.modulo)) },
      { id: "tamanho", titulo: "Tamanho", alinhar: "dir", esconderMovel: true, celula: i => txt(i.tamanho) || "—" },
    ],
    acoesExtra: i => (
      <Botao tamanho="sm" variante="fantasma" onClick={e => { e.stopPropagation(); setAbrir(i as unknown as ConteudoPreview); }}>Abrir</Botao>
    ),
    editor: p => <EditorConteudo regime={regime} {...p} cursos={cursos.selecao} modulos={modulos.dados?.itens ?? []} />,
  }), [regime, cursos.selecao, tiposFiltro, modulos.dados, rotuloModulo]);

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: regime === "gold" ? "Gold" : "Financiada" }, { rotulo: "Edição de cursos" }, { rotulo: "Conteúdos" }]}
        titulo="Conteúdos"
        subtitulo="Materiais de cada módulo. Sem módulo o ficheiro não entra no dossiê pedagógico."
      />
      <Aviso tom="info" titulo="Integração com o Moodle em pausa">
        Os conteúdos ficam guardados no GesForma e na Drive. A publicação automática no Moodle está suspensa até nova decisão.
      </Aviso>
      <CatalogoTabela config={config} />
      <ConteudoAbrirModal open={Boolean(abrir)} onClose={() => setAbrir(null)} item={abrir} accent={regime} />
    </div>
  );
}

function EditorConteudo({ regime, item, inicial, onFechar, cursos, modulos }: {
  regime: "gold" | "fin";
  item: ItemCatalogo | null;
  inicial: Record<string, unknown>;
  itens: ItemCatalogo[];
  onFechar: () => void;
  cursos: OpcaoSelecao[];
  modulos: ItemCatalogo[];
}) {
  const { status: drive } = useDrive();
  const tipos = useOpcoes("lista", { lista: "tipos_conteudo" });
  const [curso, setCurso] = useState(txt(inicial.curso));
  const [modulo, setModulo] = useState(txt(inicial.modulo));
  const [titulo, setTitulo] = useState(txt(inicial.titulo));
  const [tipo, setTipo] = useState(txt(inicial.tipo) || "PDF");
  const [url, setUrl] = useState(txt(inicial.origem || (tipo === "Link" ? inicial.driveUrl : "")));
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ehLink = /link|liga/i.test(tipo);
  const modulosDoCurso = modulos.filter(m => txt(m.curso) === curso).map(m => ({ valor: txt(m.codigo), rotulo: `${txt(m.codigo)} · ${txt(m.nome)} (${Number(m.horas ?? 0)} h)` }));

  const gravar = useAccao(async () => {
    let meta = { driveFileId: txt(inicial.driveFileId), driveUrl: txt(inicial.driveUrl), tamanho: txt(inicial.tamanho) };
    if (!ehLink && ficheiro) {
      const enviado = await apiUploadDrive(ficheiro, { kind: "conteudo", regime, turma: curso, label: titulo.trim() });
      meta = { driveFileId: enviado.id, driveUrl: enviado.openUrl ?? "", tamanho: tamanhoLegivel(enviado.sizeBytes) };
    }
    const payload = {
      titulo: titulo.trim(), tipo, curso, modulo,
      estado: txt(inicial.estado) || "Ativo",
      tamanho: ehLink ? "-" : meta.tamanho || "-",
      origem: ehLink ? url.trim() : "",
      driveFileId: ehLink ? "" : meta.driveFileId,
      driveUrl: ehLink ? url.trim() : meta.driveUrl,
    };
    return item ? apiEditarItem("conteudos", item.id, payload) : apiCriarItem("conteudos", regime, payload);
  }, { ok: item ? "Conteúdo gravado." : "Conteúdo criado.", invalidar: [chaveCatalogo("conteudos", regime), chaveCatalogo("modulos", regime)] });

  async function submeter() {
    if (!curso || !modulo || !titulo.trim()) { setErro("Escolha o curso e o módulo e escreva o título."); return; }
    if (ehLink && !/^https?:\/\//i.test(url.trim())) { setErro("A ligação tem de começar por http:// ou https://."); return; }
    if (!ehLink && !ficheiro && !inicial.driveFileId) { setErro("Escolha o ficheiro a enviar."); return; }
    if (await gravar.correr()) onFechar();
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={item ? txt(item.titulo) : "Novo conteúdo"}
      subtitulo="O material fica no módulo, e o módulo no curso."
      rodape={(
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void submeter()}>{item ? "Guardar" : "Criar"}</Botao>
        </div>
      )}
    >
      <div className="space-y-3">
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        <Campo rotulo={regime === "gold" ? "Curso" : "Curso / UFCD"} obrigatorio>
          {p => <Selecao {...p} opcoes={cursos} vazio="Escolher o curso…" value={curso} onChange={e => { setCurso(e.target.value); setModulo(""); setErro(null); }} />}
        </Campo>
        <Campo rotulo="Módulo" obrigatorio ajuda={curso && !modulosDoCurso.length ? "Este curso ainda não tem módulos. Crie-os primeiro em Módulos." : undefined}>
          {p => <Selecao {...p} disabled={!curso} opcoes={modulosDoCurso} vazio={curso ? "Escolher o módulo…" : "Escolha primeiro o curso"} value={modulo} onChange={e => setModulo(e.target.value)} />}
        </Campo>
        <Campo rotulo="Título" obrigatorio>
          {p => <Entrada {...p} value={titulo} placeholder="Ex.: Manual do módulo 1" onChange={e => setTitulo(e.target.value)} />}
        </Campo>
        <Campo rotulo="Tipo">
          {p => <Selecao {...p} opcoes={tipos.selecao.length ? tipos.selecao : [{ valor: tipo, rotulo: tipo }]} value={tipo} onChange={e => setTipo(e.target.value)} />}
        </Campo>
        {ehLink ? (
          <Campo rotulo="Endereço (URL)" obrigatorio>
            {p => <Entrada {...p} type="url" value={url} placeholder="https://…" onChange={e => setUrl(e.target.value)} />}
          </Campo>
        ) : (
          <Campo
            rotulo="Ficheiro"
            ajuda={drive.connected ? `Vai para a Drive da entidade${drive.folderName ? ` (${drive.folderName})` : ""}.` : "A Drive não está ligada: o ficheiro fica no servidor até ligar a conta Google em Configurações."}
          >
            {p => (
              <div className="space-y-1">
                <input {...p} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.webm" onChange={e => setFicheiro(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                {!ficheiro && Boolean(inicial.driveFileId) && <p className="m-0 text-xs text-tinta-suave">Já existe um ficheiro. Escolha outro só para o substituir.</p>}
              </div>
            )}
          </Campo>
        )}
      </div>
    </Modal>
  );
}
