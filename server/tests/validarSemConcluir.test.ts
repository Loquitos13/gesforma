import { describe, expect, it } from "vitest";
import { faltaValidarPreinscricao } from "../src/docsCurso.js";

const pedidos = [
  { id: "cc", label: "Cartão de Cidadão", required: true },
  { id: "cv", label: "Curriculum vitae", required: true },
];
const base = { validada: false, turma: null, pedidos, pagamento: "isento" as const, turmaPelaSecretaria: true };

describe("validar a pré-inscrição sem o «Concluir» da ligação pessoal", () => {
  it("com todos os documentos obrigatórios validados, a secretaria valida mesmo sem a pessoa ter concluído", () => {
    const ficheiros = [{ tipo: "cc", estado: "validado" }, { tipo: "cv", estado: "validado" }];
    expect(faltaValidarPreinscricao({ ...base, concluido: false, ficheiros })).toBe("");
  });
  it("com documentos por validar e sem concluir, continua a pedir que a pessoa conclua", () => {
    const ficheiros = [{ tipo: "cc", estado: "validado" }, { tipo: "cv", estado: "pendente" }];
    expect(faltaValidarPreinscricao({ ...base, concluido: false, ficheiros })).toMatch(/não concluiu/);
    expect(faltaValidarPreinscricao({ ...base, concluido: true, ficheiros })).toBe("Falta validar: Curriculum vitae.");
  });
});
