import { describe, expect, it } from "vitest";
import { criarVariantes, efetivas, paraDispositivo, registarAlteracao, valoresDe } from "../../src/site/editor/dispositivos.js";

const base = {
  id: "Titulo-1",
  texto: "Olá",
  tipografia: { tamanho: 44, tamanhoTel: 30, cor: "#000" },
  aparencia: { margem: { t: 0, r: 100, b: 0, l: 100 }, margemTel: { t: null, r: 12, b: null, l: null } },
};

describe("edição do site por ecrã", () => {
  it("converte os campos antigos de telemóvel em variantes do telemóvel", () => {
    const v = criarVariantes(base, []);
    expect(v.base.texto).toBe("Olá");
    expect(v.tab).toBeUndefined();
    expect(v.tel).toEqual({ tipografia: { tamanho: 30 }, aparencia: { margem: { r: 12 } } });
  });

  it("telemóvel herda do tablet, que herda do computador", () => {
    let v = criarVariantes({ id: "x", colunas: 3, espaco: 24 }, []);
    v = registarAlteracao(v, { colunas: 2, espaco: 24 }, ["colunas"], "tab");
    expect(valoresDe(v, "tab").colunas).toBe(2);
    expect(valoresDe(v, "tel").colunas).toBe(2);
    expect(valoresDe(v, "pc").colunas).toBe(3);
    v = registarAlteracao(v, { colunas: 1, espaco: 24 }, ["colunas"], "tel");
    expect(valoresDe(v, "tel").colunas).toBe(1);
    expect(valoresDe(v, "tab").colunas).toBe(2);
  });

  it("só guarda no ecrã o que muda e volta a herdar quando o valor é igual ao herdado", () => {
    let v = criarVariantes({ id: "x", tipografia: { tamanho: 44, cor: "#000" } }, []);
    v = registarAlteracao(v, { tipografia: { tamanho: 28, cor: "#000" } }, ["tipografia"], "tel");
    expect(v.tel).toEqual({ tipografia: { tamanho: 28 } });
    v = registarAlteracao(v, { tipografia: { tamanho: 44, cor: "#000" } }, ["tipografia"], "tel");
    expect(v.tel).toBeUndefined();
  });

  it("mudar no computador não apaga o que é próprio do telemóvel", () => {
    let v = criarVariantes({ id: "x", tipografia: { tamanho: 44, cor: "#000" } }, []);
    v = registarAlteracao(v, { tipografia: { tamanho: 28, cor: "#000" } }, ["tipografia"], "tel");
    v = registarAlteracao(v, { tipografia: { tamanho: 50, cor: "#f00" } }, ["tipografia"], "pc");
    expect(valoresDe(v, "pc").tipografia).toEqual({ tamanho: 50, cor: "#f00" });
    expect(valoresDe(v, "tel").tipografia).toEqual({ tamanho: 28, cor: "#f00" });
  });

  it("as props do telemóvel acertam o CSS: margem própria exacta, herdada limitada", () => {
    const v = criarVariantes(base, []);
    const p = efetivas({ ...base, __disp: v }, "tel", []);
    expect((p.aparencia as { margemTel: unknown }).margemTel).toEqual({ t: null, r: 12, b: null, l: null });
    expect((p.tipografia as { tamanho: number; tamanhoTel: number }).tamanhoTel).toBe(30);
    const pc = efetivas({ ...base, __disp: v }, "pc", []);
    expect((pc.tipografia as { tamanho: number }).tamanho).toBe(44);
    expect((pc.aparencia as { margemTel: unknown }).margemTel).toEqual({ t: null, r: null, b: null, l: null });
  });

  it("muda a página toda de ecrã sem perder os slots", () => {
    const dados = {
      root: { props: { tamanhoBase: 16 } },
      content: [{ type: "Seccao", props: { id: "s", colunas: 2, conteudo: [{ type: "Titulo", props: { ...base } }] } }],
    };
    const slots = (t: string) => (t === "Seccao" ? ["conteudo"] : []);
    const tel = paraDispositivo(dados, "tel", slots);
    const seccao = tel.content[0]!.props as { conteudo: { props: { tipografia: { tamanho: number } } }[] };
    expect(seccao.conteudo).toHaveLength(1);
    expect(seccao.conteudo[0]!.props.tipografia.tamanho).toBe(30);
    const pc = paraDispositivo(tel, "pc", slots);
    expect((pc.content[0]!.props as typeof seccao).conteudo[0]!.props.tipografia.tamanho).toBe(44);
  });
});
