-- Conta da equipa sem acesso ao CRM (pré-inscrições, WhatsApp, clientes, parceiros, propostas e contratos) nem aos
-- avisos das pré-inscrições: ex.: uma coordenação pedagógica que só trata das turmas e dos formandos.
ALTER TABLE users ADD COLUMN IF NOT EXISTS sem_crm boolean NOT NULL DEFAULT false;
