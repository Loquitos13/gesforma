// Área do formador: a própria ficha (dados, turmas e horas, agenda e documentos).
import { ApiError } from "../../../partilhado/api/cliente";
import { ErroCarregar, Esqueleto } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { FichaFormador } from "./FichaFormador";
import { SemFicha, useMeuFormador } from "./formadoresUi";

export default function AreaPerfil({ navigate }: VistaProps) {
  const eu = useMeuFormador();
  if (eu.erro instanceof ApiError && eu.erro.status === 404) return <SemFicha />;
  if (eu.erro && !eu.dados) return <ErroCarregar erro={eu.erro} onTentar={eu.recarregar} />;
  if (!eu.dados) return <Esqueleto linhas={6} altura="h-12" />;
  return <FichaFormador id={eu.dados.id} navigate={navigate} area />;
}
