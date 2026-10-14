// Ficha do formador em página inteira (/gesforma/formadores/:id).
import { Botao, Vazio } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { FichaFormador } from "./FichaFormador";

export default function FormadorFicha({ params, navigate }: VistaProps) {
  const id = params.formadorId;
  if (!id) {
    return (
      <Vazio
        titulo="Formador não indicado"
        descricao="Abra a ficha a partir da lista de formadores."
        acao={<Botao onClick={() => navigate("gold-formadores")}>Ver formadores</Botao>}
      />
    );
  }
  return <FichaFormador id={id} navigate={navigate} />;
}
