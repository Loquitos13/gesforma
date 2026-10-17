// Página do curso: «Outros cursos relevantes». Por omissão, os da mesma área temática e do mesmo regime
// (Gold e Financiada não se misturam); no editor escolhem-se à mão os relacionados de cada curso.
import { useContext, type CSSProperties } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { OfertaCtx, type Course } from "../SiteLanding";
import { Caixa, Titulo, type Base } from "./blocosCurso";
import { CartaoCurso, campoCartao, cartaoPadrao, type EstiloCartao } from "./blocosCursos";
import { Cartoes } from "./blocosTestemunhos";
import { campoCurso, campoNumero, nomesCursos, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { estiloVazio, tipoVazia, type Tipografia } from "./estilos";

type Escolha = { curso: string; relacionado: string };
type RelevantesProps = Base & {
  titulo: string; tTitulo: Tipografia; limite: number | null;
  escolhidos: Escolha[];
  disposicao: "grelha" | "carrossel"; segundos: number | null; setas: boolean;
  cartao: EstiloCartao;
};

/** Os escolhidos à mão para este curso; sem nenhum, os da mesma área temática (e, sem esses, os mais procurados do regime). */
export function cursosRelevantes(curso: Course, todos: Course[], escolhidos: Escolha[], limite: number) {
  const porId = new Map(todos.map(c => [c.id, c]));
  const manuais = escolhidos.filter(e => e.curso === curso.id).map(e => porId.get(e.relacionado)).filter((c): c is Course => Boolean(c) && c!.id !== curso.id);
  if (manuais.length) return manuais.slice(0, limite);
  const outros = todos.filter(c => c.id !== curso.id && c.regime === curso.regime).sort((a, b) => b.vendas - a.vendas);
  const area = curso.area.trim().toLowerCase();
  const daArea = outros.filter(c => c.area.trim().toLowerCase() === area);
  return (daArea.length ? daArea : outros).slice(0, limite);
}

export const CursoRelevantes: ComponentConfig<RelevantesProps> = {
  label: "Curso · Outros cursos relevantes",
  fields: {
    titulo: { type: "text", label: "Título (vazio = esconder)" },
    tTitulo: campoTipografia("Tipografia do título"),
    limite: campoNumero("Quantos cursos, no máximo", ""),
    escolhidos: {
      type: "array", label: "Escolhidos à mão (sem nenhum para um curso: os da mesma área temática)",
      arrayFields: {
        curso: campoCurso("Na página do curso"),
        relacionado: campoCurso("Mostrar este curso"),
      },
      defaultItemProps: { curso: "", relacionado: "" },
      getItemSummary: item => `${nomesCursos.get(item.curso) ?? "Escolha o curso"} → ${nomesCursos.get(item.relacionado) ?? "…"}`,
    },
    disposicao: { type: "radio", label: "Disposição", options: [{ label: "Grelha", value: "grelha" }, { label: "Carrossel", value: "carrossel" }] },
    segundos: campoNumero("Carrossel: segundos entre cursos (vazio ou 0 = só com as setas)", ""),
    setas: simNao("Carrossel: setas"),
    cartao: campoCartao("Cartões (colunas = cartões visíveis no carrossel)"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    titulo: "Outros cursos relevantes", tTitulo: tipoVazia(), limite: 6, escolhidos: [],
    disposicao: "carrossel", segundos: 0, setas: true,
    cartao: cartaoPadrao({ colunas: 3, colunasTab: 2, colunasTel: 1, mostrar: ["imagem", "formato", "area", "titulo", "preco", "botao"] }),
    aparencia: estiloVazio(),
  },
  render: p => <Relevantes {...p} />,
};

function Relevantes(p: RelevantesProps) {
  const todos = useContext(OfertaCtx)?.cursos ?? [];
  const e = { ...cartaoPadrao(), ...p.cartao };
  return (
    <Caixa p={p}>
      {curso => {
        const lista = cursosRelevantes(curso, todos, p.escolhidos ?? [], Math.max(1, p.limite ?? 6));
        if (!lista.length) return null;
        return (
          <>
            <Titulo texto={p.titulo} t={p.tTitulo} className="font-serif text-3xl" />
            <Cartoes carrossel={p.disposicao === "carrossel"} segundos={p.segundos ?? 0} setas={p.setas !== false} style={{
              gap: `${e.espaco ?? 20}px`, ["--gap" as string]: `${e.espaco ?? 20}px`,
              ["--cols" as string]: String(e.colunas || 3), ["--cols-tab" as string]: String(e.colunasTab || 2), ["--cols-tel" as string]: String(e.colunasTel || 1),
            } as CSSProperties}>
              {lista.map(c => <CartaoCurso key={c.id} curso={c} e={e} />)}
            </Cartoes>
          </>
        );
      }}
    </Caixa>
  );
}
