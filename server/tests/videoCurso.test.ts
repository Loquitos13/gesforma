import { describe, expect, it } from "vitest";
import { videoDoCurso } from "../../src/partilhado/siteServicos.js";

const src = (v: string) => videoDoCurso(v)?.src ?? null;

describe("vídeo de apresentação do curso", () => {
  it("Vimeo: só o ID, endereços com e sem https, canais e vídeos não listados (com a chave)", () => {
    expect(src("123456789")).toBe("https://player.vimeo.com/video/123456789?dnt=1");
    expect(src("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789?dnt=1");
    expect(src("vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789?dnt=1");
    expect(src("https://vimeo.com/123456789/abcdef1234")).toBe("https://player.vimeo.com/video/123456789?dnt=1&h=abcdef1234");
    expect(src("https://player.vimeo.com/video/123456789?h=abcdef1234&badge=0")).toBe("https://player.vimeo.com/video/123456789?dnt=1&h=abcdef1234");
    expect(src("https://vimeo.com/channels/staffpicks/123456789")).toBe("https://player.vimeo.com/video/123456789?dnt=1");
  });
  it("YouTube continua igual", () => {
    expect(src("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(src("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(src("texto qualquer")).toBeNull();
  });
});

import { nomeIdentificado } from "../src/ficheirosValidacao.js";

describe("nome dos documentos", () => {
  it("documento e pessoa, com a extensão do ficheiro enviado", () => {
    expect(nomeIdentificado("UC 01799_Cronograma.PDF", "Cartão de Cidadão", "Ana  Silva")).toBe("Cartão de Cidadão - Ana Silva.pdf");
    expect(nomeIdentificado("foto.jpg", "IBAN / comprovativo de NIB", "Rui Costa")).toBe("IBAN comprovativo de NIB - Rui Costa.jpg");
    expect(nomeIdentificado("x.pdf", "", "Ana")).toBe("x.pdf");
  });
});
