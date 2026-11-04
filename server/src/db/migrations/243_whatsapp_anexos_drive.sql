-- Ficheiro recebido no WhatsApp e guardado na ficha: o conteúdo sai da base de dados (fica só na Drive, na pasta da
-- pessoa) e o anexo aponta para o ficheiro da Drive. Não ocupa espaço a dobrar.
ALTER TABLE whatsapp_anexos ADD COLUMN IF NOT EXISTS drive_file_id text;
ALTER TABLE whatsapp_anexos ALTER COLUMN conteudo DROP NOT NULL;
