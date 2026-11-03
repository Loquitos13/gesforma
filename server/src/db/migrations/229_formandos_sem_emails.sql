-- Fichas criadas pela equipa (por exemplo, inscrições que vêm da plataforma antiga): sem emails de documentos nem de
-- pagamento. Os documentos carregam-se na ficha pela equipa; os emails da turma (integração, véspera, inquéritos) continuam.
ALTER TABLE formandos_gold ADD COLUMN IF NOT EXISTS sem_emails_docs_pagamento boolean NOT NULL DEFAULT false;
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS sem_emails_docs_pagamento boolean NOT NULL DEFAULT false;
