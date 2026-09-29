UPDATE email_templates
   SET assunto = replace(replace(replace(assunto, ' – ', ': '), ' — ', ': '), '–', ':')
 WHERE assunto LIKE '%–%' OR assunto LIKE '%—%';
