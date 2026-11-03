/**
 * Pedido de contacto do site (assistente «Falar com um operador», ou pedido de um curso fora da oferta): a pessoa recebe
 * só a confirmação de que o pedido chegou (modelo editável «pedido_contacto»), nunca a ligação para os documentos.
 * O assunto e o resto do texto livre ficam só na ficha: o email não leva nada escrito por quem preenche o formulário
 * (senão o formulário servia para mandar mensagens em nome da ENA para qualquer endereço).
 */
import type { Db } from "./db/pool.js";
import { enviarModelo } from "./emailModelo.js";

export const AVISO_CONTACTO = "Recebemos o seu pedido de contacto. A ENA vai contactá-lo em breve.";

/** `curso`: o nome do curso na oferta (vazio fora da oferta), nunca o texto do pedido. */
export async function enviarPedidoContactoRecebido(db: Db, p: { email: string; nome: string; curso: string }) {
  await enviarModelo(db, {
    tipo: "pedido_contacto", para: p.email, nome: p.nome,
    vars: { sobre_curso: p.curso ? ` sobre ${p.curso}` : "" },
    reserva: {
      assunto: "Recebemos o seu pedido de contacto",
      linhas: [
        "Recebemos o seu pedido de contacto{{sobre_curso}}.",
        "A equipa da ENA vai contactá-lo em breve, por telefone ou WhatsApp.",
      ],
    },
  });
}
