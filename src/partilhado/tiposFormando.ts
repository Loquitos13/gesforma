// Formas de pré-inscrição e formando usadas pelo cockpit da turma e pelos painéis de documentos.

export type Preinscricao = {
  id: number; inscrito: string; nome: string; apelido: string; email: string; telf: string;
  inicioCurso: string; concelho: string; local: string; curso: string; preco: number;
  estado: string; campanha: string; origem: string;
  horario?: string; turmaId?: number;
  pagamentoMetodo?: string;
  regime?: "gold" | "fin";
};

export type FormandoTurma = {
  id: number; nome: string; apelido: string; telf: string; email: string; inscrito: string;
  local: string; curso: string; turma: string; turmaId: number; estado: string;
  pago: boolean; valor: number; metodo: string; temAcesso?: boolean;
};

export type DocOk = { ok: boolean; data: string };

export type FormandoFin = {
  id: number; nome: string; apelido: string; turma: string; turmaId?: number; telf: string; email: string;
  curso: string; estado: string; cc: DocOk; ch: DocOk; cu: DocOk; ci: DocOk; ce: DocOk;
  morada?: DocOk; contrato?: DocOk; rgpd?: DocOk; temAcesso?: boolean;
};
