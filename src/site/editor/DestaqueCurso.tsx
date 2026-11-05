/** Frase em destaque do curso (ficha › Conteúdo do site), por cima do enquadramento. */
export function DestaqueCurso({ texto }: { texto?: string }) {
  if (!texto?.trim()) return null;
  return (
    <p role="note" className="mb-4 flex w-fit items-start gap-2 border-l-4 border-[var(--c-destaque)] bg-[var(--c-acento)]/20 px-4 py-3 text-base font-bold leading-snug">
      <span aria-hidden="true">⚠</span><span>{texto}</span>
    </p>
  );
}
