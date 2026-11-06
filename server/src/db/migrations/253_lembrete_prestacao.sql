-- Modelo «Lembrete da prestação» (Gold): sai à mão, da ficha do formando, quando o pagamento é em prestações.
-- {{prestacao}} é o número da prestação («2.ª»), {{total_prestacoes}} quantas são e {{valor}} o valor dela.
INSERT INTO email_templates (tipo, area, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito)
SELECT 'lembrete_prestacao', 'gold', 'Lembrete da prestação (pagamento em prestações)', 'Pagamento da {{prestacao}} prestação · {{curso}}',
  '["Lembramos que está na altura de pagar a {{prestacao}} prestação (de {{total_prestacoes}}) da sua inscrição em {{curso}}: € {{valor}}.", "Depois de fazer a transferência, anexe o comprovativo na sua página de pagamento, no botão abaixo.", "Se já fez o pagamento, ignore este email ou anexe o comprovativo para o podermos confirmar."]'::jsonb,
  '<email>
  <p>Lembramos que está na altura de pagar a {{prestacao}} prestação (de {{total_prestacoes}}) da sua inscrição em {{curso}}: € {{valor}}.</p>
  <p>Depois de fazer a transferência, anexe o comprovativo na sua página de pagamento, no botão abaixo.</p>
  <p>Se já fez o pagamento, ignore este email ou anexe o comprovativo para o podermos confirmar.</p>
  <cta ambito="contacto" href="{{link}}">Anexar o comprovativo</cta>
</email>
', 'Anexar o comprovativo', '{{link}}', 'contacto'
ON CONFLICT (tipo, area) DO NOTHING;
