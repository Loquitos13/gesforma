// Dados fictícios para pré-visualizar o painel do formando no editor do site (nunca saem do browser).
import type { AreaFormandoDados } from "../../partilhado/api";

export const AREA_EXEMPLO: AreaFormandoDados = {
  pessoa: {
    nome: "Formando", apelido: "Exemplo", email: "formando@exemplo.pt", telf: "", novidades: true,
    canais: { email: true, sms: false, whatsapp: false, plataforma: true },
  },
  cursos: [
    { id: "ex-1", regime: "gold", titulo: "Formação de Formadores - CCP", turma: "Turma de exemplo", estado: "A decorrer", progresso: 45, sessoes: 20, feitas: 9, ultimo: "10/10", modulos: ["Módulo 1", "Módulo 2"] },
    { id: "ex-2", regime: "fin", titulo: "Primeiros Socorros", turma: "Turma de exemplo", estado: "A decorrer", progresso: 80, sessoes: 10, feitas: 8, ultimo: "12/10", modulos: ["Módulo 1"] },
  ],
  agenda: [
    { id: "ag-1", cursoId: "ex-1", data: "2026-10-20", dia: "20", mes: "Out", ano: "2026", titulo: "Sessão 10", curso: "Formação de Formadores - CCP", horas: "19:00–22:00", futura: true },
    { id: "ag-2", cursoId: "ex-2", data: "2026-10-22", dia: "22", mes: "Out", ano: "2026", titulo: "Sessão 9", curso: "Primeiros Socorros", horas: "09:00–13:00", futura: true },
  ],
  certificados: [{ id: "ce-1", curso: "Curso concluído de exemplo", data: "Setembro 2026", nota: "18", url: "", nome: "" }],
  pagamentos: [{ id: "pg-1", curso: "Formação de Formadores - CCP", data: "01/09/2026", valor: "125 €", estado: "Pago", metodo: "Transferência bancária" }],
  notificacoes: [{ id: "no-1", titulo: "Nova sessão marcada", texto: "A sessão 10 fica no dia 20 de outubro.", quando: "há 2 dias", porLer: true }],
  resumo: { cursos: 2, progresso: 62, certificados: 1 },
  financiada: true,
  documentosFin: [],
};
