import { useState, useRef, useEffect, useCallback } from "react";
import { DtpPanel } from "./DtpView";
import {
  FormandosGoldView, DatasGoldView, LocaisView, AreasTematicasView,
  ModulosView, ConteudosView, FinInscricoesView, BlogTematicasView, ConfiguracoesView,
} from "./CatalogViews";
import {
  FileUploadModal, PresencasSessaoModal, FormadorProfileSlideOver, PlanoSessaoModal, SumarioSessaoModal,
  InqueritosView, defaultPlanos, emptyPlano, defaultSumarios, defaultSumariosFin, emptySumario, sumarioPreenchido,
  seedListaFromDetalhe, seedPipItems, seedSimItems,
  getParametrosAvaliacao,
  type PlanoSessaoData, type SessaoMeta, type SumarioSessaoData, type ResolveDocTarget, type PipItem, type SimItem,
} from "./TurmaExtras";
import { ResolverDocumentoModal } from "./DocResolver";
import { CursoFichaView } from "./CursoFichaView";
import {
  AppModal, SearchSelect, MultiSearchSelect, ViewFilters, matchesFilter, uniqueOpts,
  blogTematicasOpts, cursosFinOpts, cursosGoldOpts,
  horariosOpts, locaisOpts, modulosOptsForCurso,
} from "./FormKit";
import { CronogramaEditor, FormadoresAtribuidosCard, TurmaActivaToggle, TurmaInactivaBanner, TurmaInscricaoHint } from "./TurmaCronograma";
import { FormadoresView } from "./FormadoresView";
import { FORMADORES_SEED } from "./formadorModel";
import { useFormadorOptions } from "./FormadoresContext";
import { useTurmas } from "./TurmasContext";
import { cronogramaToSessoes, formatSessaoLabel, isTurmaActiva, sessaoFormadores, sessaoModulos, turmaGoldOpts, type SessaoCronograma, type TurmaFin, type TurmaGold } from "./turmaModel";
import { ListsProvider, nextListId, useLists, type FormandoFin, type FormandoTurma, type Preinscricao } from "./ListsContext";

// ─── Icons ────────────────────────────────────────────────────────────────────

const I = {
  edit: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>,
  trash: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>,
  eye: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>,
  download: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>,
  users: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>,
  doc: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>,
  euro: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-14a1 1 0 10-2 0v.09A5.002 5.002 0 006.1 8H5a1 1 0 100 2h1.1c.29.89.77 1.68 1.4 2.31V13a1 1 0 102 0v-.69A4.98 4.98 0 0011 12h1a1 1 0 100-2h-1a2.996 2.996 0 00-1-.17V7.83c.36.11.69.27 1 .47V9a1 1 0 102 0v-.1A4.998 4.998 0 0011.9 6H13a1 1 0 100-2h-2z" clipRule="evenodd"/></svg>,
  copy: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>,
  link: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>,
  search: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>,
  chevDown: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>,
  chevRight: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
  xSm: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
  home: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>,
  clipboard: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>,
  book: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>,
  calendar: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>,
  location: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>,
  tag: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>,
  puzzle: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z"/></svg>,
  file: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg>,
  school: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/></svg>,
  megaphone: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z"/></svg>,
  person: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>,
  blog: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/></svg>,
  mail: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>,
  creditcard: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg>,
  settings: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>,
  power: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v6a1 1 0 102 0V3a1 1 0 00-1-1zM5.05 5.05a7 7 0 000 9.9C6.41 16.32 8.2 17 10 17s3.59-.68 4.95-2.05a7 7 0 000-9.9 1 1 0 00-1.414 1.414 5 5 0 010 7.07A4.98 4.98 0 0110 15a4.98 4.98 0 01-3.536-1.465 5 5 0 010-7.07A1 1 0 005.05 5.05z" clipRule="evenodd"/></svg>,
  bell: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>,
  trendUp: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/></svg>,
  check: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>,
  phone: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>,
  whatsapp: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.529 5.855L0 24l6.335-1.502A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.51-5.168-1.399l-.371-.22-3.766.893.936-3.652-.242-.381A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>,
  note: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"/><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"/></svg>,
  convert: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd"/></svg>,
  list: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>,
  kanban: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M2 4a1 1 0 011-1h3a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h3a1 1 0 011 1v7a1 1 0 01-1 1H9a1 1 0 01-1-1V4zm7-1a1 1 0 00-1 1v4a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2z"/></svg>,
  warn: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>,
  info: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>,
  cmdK: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>,
  plus: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>,
  receipt: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1 1 0 100 2 1 1 0 000-2zm2.25 1a1 1 0 011-1h2.5a1 1 0 110 2h-2.5a1 1 0 01-1-1zm-2.25 3a1 1 0 100 2 1 1 0 000-2zm2.25 1a1 1 0 011-1h2.5a1 1 0 110 2h-2.5a1 1 0 01-1-1zm-2.25 3a1 1 0 100 2 1 1 0 000-2zm2.25 1a1 1 0 011-1h2.5a1 1 0 110 2h-2.5a1 1 0 01-1-1z" clipRule="evenodd"/></svg>,
  attend: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>,
  folder: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>,
  transfer: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 5a1 1 0 011 1v8a1 1 0 11-2 0V8.414L5.707 9.707a1 1 0 11-1.414-1.414l3-3A1 1 0 018 5zm4 10a1 1 0 01-1-1V6a1 1 0 112 0v5.586l1.293-1.293a1 1 0 111.414 1.414l-3 3A1 1 0 0112 15z"/></svg>,
};

// ─── Types ───────────────────────────────────────────────────────────────────

type View =
  | "painel" | "gold-preinscricoes" | "gold-formandos-turmas" | "gold-formandos-gold"
  | "gold-campanhas" | "gold-cursos" | "gold-datas" | "gold-locais" | "gold-areas-tematicas"
  | "gold-modulos" | "gold-conteudos" | "gold-turmas" | "gold-formadores" | "gold-cockpit-turma" | "gold-curso-ficha" | "gold-dtp" | "gold-inqueritos"
  | "fin-inscricoes" | "fin-formandos" | "fin-cursos" | "fin-curso-ficha" | "fin-turmas" | "fin-formadores" | "fin-presencas" | "fin-dtp" | "fin-cockpit-turma" | "fin-inqueritos"
  | "formadores" | "blog-posts" | "blog-tematicas"
  | "emails" | "pagamentos" | "configuracoes";

type CockpitTab = "overview" | "cronograma" | "sessoes" | "documentos" | "dtp" | "certificados";
type NavTarget = { view: View; turmaId?: number; tab?: CockpitTab; cursoId?: number | "new"; cursoNome?: string };

function nowStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function splitNome(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { nome: parts[0] ?? "", apelido: parts.slice(1).join(" ") };
}
function emptyFinDocs() {
  return {
    cc: { ok: false, data: "" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" },
    ci: { ok: false, data: "" }, ce: { ok: false, data: "" },
  };
}

// ─── Sample Data ─────────────────────────────────────────────────────────────

const cursosGoldData = [
  { id: 100, nome: "Formação de Formadores - CCP", categoria: "CCP e Gestão da Formação", tipo: "Gold", preco: 125, regime: "b-learning", horas: 90, estado: "Ativo" },
  { id: 108, nome: "A Arte de Comunicar e Falar em Público: B-learning", categoria: "Desenvolvimento Pessoal", tipo: "Gold", preco: 80, regime: "b-learning", horas: 16, estado: "Inactivo" },
  { id: 107, nome: "A Arte de Comunicar e Falar em Público: E-learning", categoria: "Desenvolvimento Pessoal", tipo: "Pré-inscrição", preco: 35, regime: "e-learning", horas: 8, estado: "Inactivo" },
  { id: 131, nome: "CCP - Formação de Formadores para Empresas", categoria: "CCP e Gestão da Formação", tipo: "Pré-inscrição", preco: 120, regime: "b-learning", horas: 90, estado: "Inactivo" },
  { id: 130, nome: "Curso de Auxiliar de Medicina Dentária", categoria: "Saúde e bem estar", tipo: "Pré-inscrição", preco: 300, regime: "e-learning", horas: 99, estado: "Ativo" },
  { id: 134, nome: "Curso de Auxiliar de Medicina Veterinária", categoria: "Saúde e bem estar", tipo: "Pré-inscrição", preco: 400, regime: "e-learning", horas: 120, estado: "Ativo" },
  { id: 136, nome: "Curso de Cura Prânica", categoria: "Desenvolvimento Pessoal", tipo: "Pré-inscrição", preco: 200, regime: "b-learning", horas: 20, estado: "Ativo" },
  { id: 138, nome: "Excel do Básico ao Avançado", categoria: "CCP e Gestão da Formação", tipo: "Gold", preco: 45, regime: "e-learning", horas: 12, estado: "Ativo" },
];

const turmasGoldData = [
  { id: 947, dataInicio: "2026-09-03", nome: "2176/2026", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 16, vagas: 16, estado: "Ativa" },
  { id: 946, dataInicio: "2026-07-06", nome: "IRN LSB 01/09", curso: "Formação de Formadores - CCP", local: "Lisboa", horario: "Laboral Manhã", totalAlunos: 12, vagas: 16, estado: "Ativa" },
  { id: 945, dataInicio: "2026-09-15", nome: "BRG-PL-15/09", curso: "Formação de Formadores - CCP", local: "Braga", horario: "Pós Laboral", totalAlunos: 2, vagas: 16, estado: "Ativa" },
  { id: 944, dataInicio: "2026-09-21", nome: "BRG-SM-21/09", curso: "Formação de Formadores - CCP", local: "Braga", horario: "Sábado manhã", totalAlunos: 6, vagas: 16, estado: "Ativa" },
  { id: 943, dataInicio: "2026-09-07", nome: "VNG-SM-07/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Sábado manhã", totalAlunos: 10, vagas: 16, estado: "Ativa" },
  { id: 940, dataInicio: "2026-09-03", nome: "2175/2026", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 14, vagas: 16, estado: "Ativa" },
  { id: 939, dataInicio: "2026-09-04", nome: "VNG-PL-04/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Pós Laboral", totalAlunos: 9, vagas: 16, estado: "Ativa" },
  { id: 938, dataInicio: "2026-09-02", nome: "PEN-SM-02/09", curso: "Formação de Formadores - CCP", local: "Penafiel", horario: "Sábado manhã", totalAlunos: 13, vagas: 16, estado: "Ativa" },
  { id: 937, dataInicio: "2026-08-28", nome: "VNG-SM-28/08", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Sábado manhã", totalAlunos: 12, vagas: 16, estado: "Inativa" },
  { id: 936, dataInicio: "2026-09-03", nome: "VNG-LM-03/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 12, vagas: 16, estado: "Inativa" },
];

const preinscricoesData = [
  { id: 17550, inscrito: "2026-09-04 11:24", nome: "Inês", apelido: "Caetano", email: "caetanoines9@gmail.com", telf: "932810856", inicioCurso: "2026-09-07", concelho: "Trofa", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", preco: 125, estado: "Não contactado", campanha: "Setembro 2026", origem: "Website" },
  { id: 17539, inscrito: "2026-09-04 11:07", nome: "Aline Cristina", apelido: "Pereira", email: "alinecristina@ua.pt", telf: "934283406", inicioCurso: "2026-09-03", concelho: "Guimarães", local: "Braga", curso: "Formação de Formadores - CCP", preco: 120, estado: "1º Contacto", campanha: "Setembro 2026", origem: "Facebook" },
  { id: 17536, inscrito: "2026-09-04 09:52", nome: "Priscila", apelido: "Damasceno", email: "prisciladamasceno82@gmail.com", telf: "931810126", inicioCurso: "-", concelho: "Leiria", local: "Sala Virtual", curso: "Auxiliar de Medicina Dentária", preco: 300, estado: "1º Contacto", campanha: "Setembro 2026", origem: "Google" },
  { id: 17534, inscrito: "2026-09-03 22:20", nome: "Glynnis", apelido: "Ferreira", email: "glynnisferreira@gmail.com", telf: "939080789", inicioCurso: "-", concelho: "V.N.Gaia", local: "E-learning", curso: "E-Formador novas tecnologias", preco: 80, estado: "1º Contacto", campanha: "CCP 2020", origem: "Website" },
  { id: 17533, inscrito: "2026-09-03 21:24", nome: "Carolina", apelido: "Esteves", email: "carolinaesteves@gmail.com", telf: "960303492", inicioCurso: "2026-09-07", concelho: "Braga", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", preco: 125, estado: "1º Contacto", campanha: "Setembro 2026", origem: "Instagram" },
  { id: 17532, inscrito: "2026-09-03 17:28", nome: "Susana", apelido: "Santos", email: "info@drasusanasantos.co", telf: "919890846", inicioCurso: "2026-09-07", concelho: "Lisboa", local: "Lisboa - Pós Laboral", curso: "Formação de Formadores - CCP", preco: 145, estado: "Não contactado", campanha: "Setembro 2026", origem: "Referência" },
  { id: 17531, inscrito: "2026-09-03 16:32", nome: "Cheila", apelido: "Parisot", email: "cheilaparisot@gmail.com", telf: "917754385", inicioCurso: "2026-07-06", concelho: "Sintra", local: "Lisboa - Laboral Manhã", curso: "Formação de Formadores - CCP", preco: 145, estado: "2º Contacto", campanha: "Setembro 2026", origem: "Facebook" },
  { id: 17530, inscrito: "2026-09-03 16:21", nome: "Tiago", apelido: "Bento", email: "tiagojsbento@gmail.com", telf: "919700594", inicioCurso: "2026-09-07", concelho: "V.N.Gaia", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", preco: 125, estado: "Pago", campanha: "Setembro 2026", origem: "Website" },
  { id: 17529, inscrito: "2026-09-03 16:03", nome: "Taís", apelido: "Araújo", email: "taisaraujoady@gmail.com", telf: "926305132", inicioCurso: "2026-09-03", concelho: "Braga", local: "Braga", curso: "Formação de Formadores - CCP", preco: 120, estado: "Formando", campanha: "CCP 2020", origem: "Google" },
  { id: 17528, inscrito: "2026-09-03 13:08", nome: "Luísa", apelido: "Monteiro", email: "luisa.fmonteiro19@gmail.com", telf: "910323422", inicioCurso: "2026-09-03", concelho: "Maia", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", preco: 125, estado: "Formando", campanha: "Setembro 2026", origem: "Website" },
];

const formandosTurmasData = [
  { id: 17550, nome: "Tiago", apelido: "Bento", telf: "919700594", email: "tiagojsbento@gmail.com", inscrito: "2026-09-03 16:21", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-SM-07/09", turmaId: 943, estado: "Formando", pago: true, valor: 125, metodo: "MB Way" },
  { id: 17539, nome: "Luciana", apelido: "D'Avila", telf: "910641014", email: "davila.lucianam@gmail.com", inscrito: "2026-09-02 16:29", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-SM-07/09", turmaId: 943, estado: "Formando", pago: true, valor: 125, metodo: "Cartão" },
  { id: 17536, nome: "Ciara", apelido: "Gonçalves", telf: "912247513", email: "g.clarasofia03@gmail.com", inscrito: "2026-09-02 11:45", local: "Penafiel", curso: "Formação de Formadores - CCP", turma: "PEN-SM-02/09", turmaId: 938, estado: "Formando", pago: false, valor: 125, metodo: "-" },
  { id: 17534, nome: "Liliana", apelido: "Real", telf: "9111", email: "liascr777@gmail.com", inscrito: "2026-09-02 09:32", local: "Penafiel", curso: "Formação de Formadores - CCP", turma: "PEN-SM-02/09", turmaId: 938, estado: "Formando", pago: true, valor: 125, metodo: "Multibanco" },
  { id: 17526, nome: "Angélica", apelido: "Ribeiro", telf: "935043095", email: "alribeiro53@gmail.com", inscrito: "2026-09-01 15:06", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-SM-07/09", turmaId: 943, estado: "Formando", pago: true, valor: 125, metodo: "MB Way" },
  { id: 17522, nome: "Maria", apelido: "Mota", telf: "925997151", email: "mccmota.28@gmail.com", inscrito: "2026-09-01 09:36", local: "Braga", curso: "Formação de Formadores - CCP", turma: "BRG-PL-15/09", turmaId: 945, estado: "Formando", pago: false, valor: 120, metodo: "-" },
  { id: 17517, nome: "Elisabete", apelido: "Soares", telf: "914298952", email: "elisabete.soares@netcabo.pt", inscrito: "2026-08-31 21:45", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-SM-07/09", turmaId: 943, estado: "Formando", pago: true, valor: 125, metodo: "Cartão" },
  { id: 17516, nome: "Andreia", apelido: "Arantes", telf: "962016923", email: "andreia_filipa@hotmail.com", inscrito: "2026-08-31 20:22", local: "Braga", curso: "Formação de Formadores - CCP", turma: "BRG-SM-21/09", turmaId: 944, estado: "Formando", pago: true, valor: 120, metodo: "MB Way" },
  { id: 17514, nome: "Hugo", apelido: "Baldaia", telf: "932832245", email: "hugo.baldaia2@gmail.com", inscrito: "2026-08-31 14:32", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-PL-04/09", turmaId: 939, estado: "Formando", pago: true, valor: 125, metodo: "MB Way" },
  { id: 17510, nome: "Marta", apelido: "Maia", telf: "914304801", email: "marta_maia84@hotmail.com", inscrito: "2026-08-30 12:33", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-PL-04/09", turmaId: 939, estado: "Formando", pago: true, valor: 125, metodo: "Multibanco" },
];

const finFormandosData = [
  { id: 27, nome: "Diogo Alexandre", apelido: "Soares Oliveira", turma: "SM-T01", telf: "914388980", email: "diogo_nik@hotmail.com", curso: "Publicidade nas Redes Sociais", estado: "Elegível", cc: { ok: true, data: "2021-01-10" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: true, data: "2021-01-12" }, ce: { ok: false, data: "" } },
  { id: 42, nome: "Laércio Daniel", apelido: "Ferreira da Costa", turma: "SM-T01", telf: "933168749", email: "71aercio7@gmail.com", curso: "Publicidade nas Redes Sociais", estado: "Elegível", cc: { ok: true, data: "2021-01-12" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } },
  { id: 71, nome: "Vanesa Magali", apelido: "Correa Bender", turma: "SM-T01", telf: "963130925", email: "valescabender@gmail.com", curso: "Publicidade nas Redes Sociais", estado: "Elegível", cc: { ok: true, data: "2021-01-20" }, ch: { ok: true, data: "2021-01-21" }, cu: { ok: true, data: "2021-01-22" }, ci: { ok: true, data: "2021-01-20" }, ce: { ok: true, data: "2021-01-23" } },
  { id: 81, nome: "Tânia", apelido: "Veloso", turma: "SM-T01", telf: "914011998", email: "taniapatriciaveloso@gmail.com", curso: "Publicidade nas Redes Sociais", estado: "Elegível", cc: { ok: true, data: "2021-01-24" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } },
  { id: 97, nome: "Mariana", apelido: "Sousa Pereira", turma: "UFCD 3564 · T1", telf: "932874093", email: "mariana98pereira@gmail.com", curso: "Primeiros Socorros", estado: "Elegível", cc: { ok: false, data: "" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } },
];

const finCursosData = [
  { id: 6, ufcdCod: "10785", ufcd: "Publicidade nas Redes Socias", nomeComercial: "Publicidade nas Redes Sociais: Master em Tráfego", regime: "e-learning", horas: 25, estado: "Inactivo" },
  { id: 43, ufcdCod: "3564", ufcd: "Primeiros Socorros", nomeComercial: "Primeiros Socorros", regime: "e-learning", horas: 25, estado: "Ativo" },
  { id: 65, ufcdCod: "9188", ufcd: "Fundamentos de cibersegurança", nomeComercial: "Fundamentos de cibersegurança", regime: "b-learning", horas: 25, estado: "Inactivo" },
  { id: 68, ufcdCod: "10394", ufcd: "Métodos e técnicas pedagógicas", nomeComercial: "Métodos e Técnicas Pedagógicas Ativos", regime: "b-learning", horas: 25, estado: "Ativo" },
];

const finTurmasData = [
  { id: 222, dataInicio: "2026-09-18", nome: "UFCD 9109 - Cuidados Básicos", curso: "Masterclass em Estética Facial", ufcdCod: "9109", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 1, alunosTotal: 20, estado: "A montar", horas: 25, formador: "Cátia" },
  { id: 220, dataInicio: "2026-07-31", nome: "UC02282 - Criar campanhas", curso: "Publicidade nas Redes Sociais", ufcdCod: "10785", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 17, alunosTotal: 20, estado: "A montar", horas: 25, formador: "Isac" },
  { id: 219, dataInicio: "2026-08-31", nome: "UCUC00033 - Comunicar", curso: "Comunicar e interagir em contexto profissional", ufcdCod: "3564", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 17, alunosTotal: 20, estado: "A decorrer", horas: 25, formador: "António" },
  { id: 218, dataInicio: "2026-08-27", nome: "UFCD 3564 - Primeiros So.", curso: "Primeiros Socorros", ufcdCod: "3564", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 4, alunosTotal: 20, estado: "A montar", horas: 25, formador: "Vânia Fernandes" },
  { id: 217, dataInicio: "2026-08-27", nome: "UFCD 9119 - Massagem", curso: "Técnicas de massagem", ufcdCod: "9119", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 17, alunosTotal: 20, estado: "A decorrer", horas: 25, formador: "Rosana" },
];

const blogPostsData = [
  { id: 25, titulo: "Dicas para aprender online com sucesso", slug: "dicas-aprender-online", data: "2025-12-15", status: "Ativo" },
  { id: 26, titulo: "O que é a Formação Financiada?", slug: "formacao-financiada", data: "2025-12-16", status: "Ativo" },
  { id: 27, titulo: "CCP: Formação de Formadores explicada", slug: "ccp-formacao-formadores", data: "2025-12-16", status: "Ativo" },
];

const campanhasData = [
  { id: 4, nome: "Setembro 2026", data: "2026-09-01", encarregado: "Aguilar", preinscricoes: 421, pagos: 38, receita: 4750, custo: 380 },
  { id: 3, nome: "CCP 2020", data: "2022-05-30", encarregado: "Aguilar", preinscricoes: 890, pagos: 212, receita: 25440, custo: 890 },
  { id: 1, nome: "Outubro - Março - CCP", data: "2021-03-09", encarregado: "Escola", preinscricoes: 1240, pagos: 480, receita: 57600, custo: 1800 },
];

const emailRegras = [
  { id: 1, nome: "Boas-vindas ao registo", gatilho: "Nova pré-inscrição recebida", template: "welcome", ativo: true, envios: 16537, taxaAbertura: 94.2 },
  { id: 2, nome: "Confirmação de pagamento", gatilho: "Pagamento confirmado", template: "payment", ativo: true, envios: 6379, taxaAbertura: 98.1 },
  { id: 3, nome: "Lembrete 24h antes do curso", gatilho: "24 horas antes do início", template: "reminder_24h", ativo: true, envios: 4892, taxaAbertura: 91.7 },
  { id: 5, nome: "Certificado de conclusão", gatilho: "Formando marcado como concluído", template: "certificate", ativo: true, envios: 3821, taxaAbertura: 99.2 },
  { id: 6, nome: "Reengajamento 30 dias", gatilho: "30 dias sem compra", template: "reengagement", ativo: false, envios: 8941, taxaAbertura: 76.3 },
];

const emailTemplates = [
  { id: 1, nome: "Boas-vindas", assunto: "Bem-vindo(a) à ENA, {{nome}}", editado: "2026-08-15", tipo: "welcome" },
  { id: 2, nome: "Confirmação de Pagamento", assunto: "Pagamento confirmado – {{curso}}", editado: "2026-07-22", tipo: "payment" },
  { id: 3, nome: "Lembrete 24h", assunto: "Amanhã começa {{curso}}", editado: "2026-08-20", tipo: "reminder_24h" },
  { id: 5, nome: "Certificado de Conclusão", assunto: "O seu certificado está disponível", editado: "2026-08-01", tipo: "certificate" },
  { id: 6, nome: "Reengajamento", assunto: "Ainda está a tempo de começar {{curso}}", editado: "2026-07-10", tipo: "reengagement" },
];

const emailGatilhosOpts = [
  { value: "Nova pré-inscrição recebida", sub: "Lead acaba de se inscrever no site" },
  { value: "Pré-inscrição sem pagamento há 3 dias", sub: "Lembrete de cobrança" },
  { value: "Pagamento confirmado", sub: "Lead passa a formando" },
  { value: "24 horas antes do início", sub: "Turma a começar" },
  { value: "Formando marcado como concluído", sub: "Emite certificado" },
  { value: "30 dias sem compra", sub: "Reengajamento" },
  { value: "Sumário da sessão assinado", sub: "Aviso interno" },
];

const emailAtrasosOpts = [
  { value: "Imediatamente" },
  { value: "1 hora depois" },
  { value: "24 horas depois" },
  { value: "3 dias depois" },
];

const EMAIL_BODIES: Record<string, { assunto: string; linhas: string[]; cta: string }> = {
  welcome: {
    assunto: "Bem-vindo(a) à ENA, {{nome}}",
    linhas: [
      "Confirmámos o seu interesse em {{curso}}.",
      "A turma {{turma}} é a unidade de gestão: datas, sessões e documentos ficam todos aí.",
      "Se ainda não escolheu horário, responda a este email ou complete a inscrição no site.",
    ],
    cta: "Ver a minha inscrição",
  },
  payment: {
    assunto: "Pagamento confirmado – {{curso}}",
    linhas: [
      "{{nome}}, o pagamento de {{curso}} chegou.",
      "Já está inscrita na turma {{turma}}. O cronograma e o acesso à plataforma seguem nas próximas horas.",
    ],
    cta: "Abrir a turma",
  },
  reminder_24h: {
    assunto: "Amanhã começa {{curso}}",
    linhas: [
      "{{nome}}, a primeira sessão de {{curso}} é amanhã, turma {{turma}}.",
      "Traga o CC e, se for CCP, o portefólio em construção. O link da sala está no botão abaixo.",
    ],
    cta: "Abrir o cronograma",
  },
  certificate: {
    assunto: "O seu certificado está disponível",
    linhas: [
      "Parabéns, {{nome}}. Concluiu {{curso}} na turma {{turma}}.",
      "O certificado está no cockpit da turma, em Certificados. Guarde o PDF - a ENA arquiva o DTP durante 10 anos.",
    ],
    cta: "Descarregar certificado",
  },
  reengagement: {
    assunto: "Ainda está a tempo de começar {{curso}}",
    linhas: [
      "{{nome}}, a pré-inscrição em {{curso}} ficou a meio.",
      "Há vagas na turma {{turma}}. Se quiser retomar, o pagamento reabre a inscrição sem perder os dados.",
    ],
    cta: "Retomar inscrição",
  },
};

function fillEmailVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

const EMAIL_TIPO_ALIAS: Record<string, string> = { payment_confirm: "payment" };

const GATILHO_TEMPLATE: Record<string, string> = {
  "Nova pré-inscrição recebida": "Boas-vindas",
  "Pré-inscrição sem pagamento há 3 dias": "Reengajamento",
  "Pagamento confirmado": "Confirmação de Pagamento",
  "24 horas antes do início": "Lembrete 24h",
  "Formando marcado como concluído": "Certificado de Conclusão",
  "30 dias sem compra": "Reengajamento",
};

function destFromGatilho(gatilho: string) {
  if (gatilho.includes("Sumário") || gatilho.toLowerCase().includes("interno")) {
    return { nome: "Isac Silva", papel: "Formador", email: "isac.silva@ena.pt" };
  }
  if (gatilho.includes("pré-inscrição") || gatilho.includes("compra")) {
    return { nome: "Inês Caetano", papel: "Lead", email: "ines.caetano@gmail.com" };
  }
  return { nome: "Inês Caetano", papel: "Formanda", email: "ines.caetano@gmail.com" };
}

function EmailPreviewPane({
  tipo, curso, gatilho = "", atraso = "",
}: {
  tipo: string;
  curso: string;
  gatilho?: string;
  atraso?: string;
}) {
  const resolved = EMAIL_TIPO_ALIAS[tipo] ?? tipo;
  const body = EMAIL_BODIES[resolved];
  const dest = destFromGatilho(gatilho);
  const cursoLabel = curso || "Formação de Formadores - CCP";
  const vars = { nome: dest.nome, curso: cursoLabel, turma: "VNG-SM-07/09" };
  const assunto = body ? fillEmailVars(body.assunto, vars) : "Assunto do email";

  return (
    <div className="rounded-xl border border-slate-200 bg-[#F1F5F9] overflow-hidden">
      <div className="px-3 py-2 bg-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
        <span>Caixa de entrada · Gmail</span>
        <span>Pré-visualização</span>
      </div>
      {(gatilho || atraso) && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-900">
          <span className="font-semibold">Regra: </span>
          {gatilho || "sem gatilho"}
          {atraso ? ` · ${atraso}` : ""}
          {curso ? ` · ${curso}` : ""}
        </div>
      )}
      {!tipo || !body ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Ainda sem email para mostrar</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Escolha o gatilho e o template à esquerda. O assunto e o corpo actualizam aqui com dados de exemplo.</p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5 flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">ENA</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-slate-800 truncate">ENA Formação</p>
                <p className="text-[10px] text-slate-400 flex-shrink-0">hoje, 09:14</p>
              </div>
              <p className="text-xs font-semibold text-slate-700 truncate">{assunto}</p>
              <p className="text-[11px] text-slate-400 truncate">Olá {dest.nome.split(" ")[0]}, {fillEmailVars(body.linhas[0], vars)}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 space-y-1">
              <p className="text-sm font-bold text-slate-800 leading-snug">{assunto}</p>
              <p className="text-[11px] text-slate-400">De <span className="text-slate-700 font-medium">ENA Formação &lt;formacao@ena.pt&gt;</span></p>
              <p className="text-[11px] text-slate-400">Para <span className="text-slate-700 font-medium">{dest.email}</span> <span className="text-slate-400">· {dest.papel}</span></p>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="bg-amber-500 text-white text-xs font-extrabold tracking-widest px-2.5 py-1.5 rounded-md inline-block">ENA</div>
              <p className="text-sm text-slate-800">Olá {dest.nome.split(" ")[0]},</p>
              {body.linhas.map(l => (
                <p key={l} className="text-sm text-slate-600 leading-relaxed">{fillEmailVars(l, vars)}</p>
              ))}
              <button type="button" className="inline-flex px-3.5 py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg">
                {body.cta}
              </button>
              <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">Equipa ENA · formacao@ena.pt · Email automático da regra.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const transacoesData = [
  { id: "TRX-17550", nome: "Tiago Bento", valor: 125, metodo: "MB Way", curso: "Formação de Formadores - CCP", data: "2026-09-03 16:21", estado: "Pago" },
  { id: "TRX-17539", nome: "Aline Cristina Pereira", valor: 120, metodo: "Cartão", curso: "Formação de Formadores - CCP", data: "2026-09-04 11:07", estado: "Pago" },
  { id: "TRX-17536", nome: "Priscila Damasceno", valor: 300, metodo: "Transferência", curso: "Auxiliar de Medicina Dentária", data: "2026-09-04 09:52", estado: "Pendente" },
  { id: "TRX-17530", nome: "Maria Mota", valor: 120, metodo: "Cartão", curso: "Formação de Formadores - CCP", data: "2026-09-01 09:36", estado: "Pago" },
  { id: "TRX-17522", nome: "Hugo Baldaia", valor: 145, metodo: "MB Way", curso: "Formação de Formadores - CCP", data: "2026-08-31 14:32", estado: "Pago" },
];

const metodosPagamento = [
  { metodo: "MB Way", valor: 127840, pct: 42, color: "#F59E0B" },
  { metodo: "Cartão de Crédito/Débito", valor: 91520, pct: 30, color: "#3B82F6" },
  { metodo: "Transferência Bancária", valor: 51840, pct: 17, color: "#8B5CF6" },
  { metodo: "Multibanco (MB)", valor: 24360, pct: 8, color: "#10B981" },
  { metodo: "PayPal", valor: 9120, pct: 3, color: "#6366F1" },
];

const receitaMensal = [
  { mes: "Out", v: 18420 }, { mes: "Nov", v: 22180 }, { mes: "Dez", v: 19640 },
  { mes: "Jan", v: 24800 }, { mes: "Fev", v: 21350 }, { mes: "Mar", v: 28960 },
  { mes: "Abr", v: 31240 }, { mes: "Mai", v: 27580 }, { mes: "Jun", v: 33410 },
  { mes: "Jul", v: 29870 }, { mes: "Ago", v: 26540 }, { mes: "Set", v: 35200 },
];

const topCursos = [
  { nome: "Formação de Formadores - CCP", inscritos: 4821, receita: 120525, taxa: 78 },
  { nome: "Auxiliar de Medicina Dentária", inscritos: 642, receita: 192600, taxa: 65 },
  { nome: "Auxiliar de Medicina Veterinária", inscritos: 418, receita: 167200, taxa: 61 },
  { nome: "Publicidade nas Redes Sociais", inscritos: 389, receita: 48625, taxa: 54 },
];

const conhecimentoEna = [
  { id: "web", fonte: "Website / pesquisa Google", curto: "Website", detalhe: "ena.pt e resultados orgânicos", n: 2472, pct: 38, color: "#F59E0B" },
  { id: "ref", fonte: "Referência", curto: "Referência", detalhe: "Formando, formador ou empresa", n: 1106, pct: 17, color: "#10B981" },
  { id: "ig", fonte: "Instagram", curto: "Instagram", detalhe: "Reels e campanhas pagas", n: 976, pct: 15, color: "#E1306C" },
  { id: "fb", fonte: "Facebook", curto: "Facebook", detalhe: "Grupos e anúncios", n: 781, pct: 12, color: "#3B82F6" },
  { id: "li", fonte: "LinkedIn", curto: "LinkedIn", detalhe: "CCP e formação para empresas", n: 455, pct: 7, color: "#0A66C2" },
  { id: "iefp", fonte: "IEFP / Centro de emprego", curto: "IEFP", detalhe: "Turmas financiadas", n: 390, pct: 6, color: "#8B5CF6" },
  { id: "outro", fonte: "Outdoor, feira ou outro", curto: "Outro", detalhe: "Eventos e material impresso", n: 325, pct: 5, color: "#94A3B8" },
];

const notificacoesData: Array<{ id: number; tipo: string; titulo: string; texto: string; tempo: string; lida: boolean } & NavTarget> = [
  { id: 1, tipo: "warn", titulo: "VNG-SM-07/09 sem vagas", texto: "A turma de V.N.Gaia (07/09) atingiu capacidade máxima - 10/10 formandos.", tempo: "2 min", lida: false, view: "gold-cockpit-turma", turmaId: 943, tab: "overview" },
  { id: 2, tipo: "error", titulo: "67 pagamentos pendentes", texto: "€8 400 por confirmar. 12 com mais de 7 dias sem resposta.", tempo: "15 min", lida: false, view: "pagamentos" },
  { id: 3, tipo: "warn", titulo: "DTP da turma UFCD 3564 · T1 a 54%", texto: "A turma não arranca: faltam habilitações, CV e comprovativo de emprego.", tempo: "1h", lida: false, view: "fin-cockpit-turma", turmaId: 218, tab: "dtp" },
  { id: 6, tipo: "warn", titulo: "DTP incompleto - turma VNG-SM-07/09", texto: "PIP, simulações e sumários em falta. Não emitir CCP.", tempo: "45 min", lida: false, view: "gold-cockpit-turma", turmaId: 943, tab: "dtp" },
  { id: 4, tipo: "info", titulo: "Nova pré-inscrição Gold", texto: "Inês Caetano inscreveu-se em CCP - turma VNG-SM-07/09.", tempo: "2h", lida: true, view: "gold-preinscricoes" },
  { id: 5, tipo: "info", titulo: "Turma BRG-PL-15/09 com poucas inscrições", texto: "Apenas 2 de 16 vagas preenchidas. A 15/09 está próxima.", tempo: "3h", lida: true, view: "gold-turmas" },
];

// ─── UI Primitives ────────────────────────────────────────────────────────────

type BadgeVariant = "green" | "gray" | "blue" | "amber" | "indigo" | "red" | "teal" | "orange" | "violet";
const badgeCls: Record<BadgeVariant, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200", teal: "bg-teal-50 text-teal-700 border-teal-200",
  gray: "bg-slate-100 text-slate-600 border-slate-200", blue: "bg-blue-50 text-blue-700 border-blue-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200", amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-600 border-red-200", orange: "bg-orange-50 text-orange-700 border-orange-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
};
function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${badgeCls[variant]}`}>{label}</span>;
}
function estadoBadge(estado: string) {
  const m: Record<string, BadgeVariant> = {
    "Ativo": "green", "Inactivo": "gray", "Ativa": "green", "Inativa": "gray", "1º Contacto": "blue", "2º Contacto": "indigo",
    "Não contactado": "amber", "Pago": "teal", "Formando": "green", "Matriculado": "green",
    "Elegível": "teal", "A montar": "red", "A decorrer": "green", "Encerrada": "gray",
    "Reembolsado": "violet", "Pendente": "orange", "Realizada": "green", "Agendada": "blue",
  };
  return <Badge label={estado} variant={m[estado] ?? "gray"} />;
}

function formatSessaoLine(s: SessaoCronograma) {
  return `${formatSessaoLabel(s.data)} · ${(s.horaInicio || "").replace(":", "h")}–${(s.horaFim || "").replace(":", "h")}`;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>{children}</div>;
}
function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
      <div><h1 className="text-xl font-bold text-slate-800 leading-tight">{title}</h1>{sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}</div>
      {action}
    </div>
  );
}
function NewBtn({ label, onClick, accent = "gold" }: { label: string; onClick?: () => void; accent?: "gold" | "fin" }) {
  const text = label.replace(/^\+\s*/, "");
  const cls = accent === "gold" ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700";
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-4 py-2 ${cls} text-white text-sm font-semibold rounded-lg transition-colors shadow-sm whitespace-nowrap`}>{I.plus}{text}</button>;
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50 border-b border-slate-200 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
function IdCell({ id }: { id: number | string }) {
  return <span className="text-slate-400 font-mono text-xs">{id}</span>;
}
const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>{children}</div>;
}
function ActBtn({ icon, label, color = "blue", onClick }: { icon: React.ReactNode; label: string; color?: string; onClick?: () => void }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200", red: "bg-red-100 text-red-600 hover:bg-red-200",
    orange: "bg-amber-100 text-amber-700 hover:bg-amber-200", gray: "bg-slate-100 text-slate-500 hover:bg-slate-200",
    teal: "bg-teal-100 text-teal-700 hover:bg-teal-200", purple: "bg-violet-100 text-violet-700 hover:bg-violet-200",
    green: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
  };
  return (
    <button title={label} aria-label={label} onClick={onClick}
      className={`w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ${colorMap[color] ?? colorMap.blue}`}>
      {icon}
    </button>
  );
}
function Pagination({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = Math.max(1, page - 1); const end = Math.min(pages, start + 3);
  const nums: number[] = []; for (let i = start; i <= end; i++) nums.push(i);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">‹</button>
      {start > 1 && <button onClick={() => onChange(1)} className="w-7 h-7 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">1</button>}
      {nums.map(n => <button key={n} onClick={() => onChange(n)} className={`w-7 h-7 text-xs rounded-lg border transition-colors font-medium ${n === page ? "bg-amber-500 border-amber-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{n}</button>)}
      {end < pages && <button onClick={() => onChange(pages)} className="w-7 h-7 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">{pages}</button>}
      <button onClick={() => onChange(page + 1)} disabled={page === pages} className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">›</button>
    </div>
  );
}
function TableFooter({ page, perPage, total, note, onChange }: { page: number; perPage: number; total: number; note?: string; onChange: (p: number) => void }) {
  const from = Math.min((page - 1) * perPage + 1, total); const to = Math.min(page * perPage, total);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
      <div>
        <p className="text-xs text-slate-500">A mostrar <strong className="text-slate-700">{from}–{to}</strong> de <strong className="text-slate-700">{total.toLocaleString("pt-PT")}</strong></p>
        {note && <p className="text-xs text-slate-400 mt-0.5">{note}</p>}
      </div>
      <Pagination page={page} total={total} perPage={perPage} onChange={onChange} />
    </div>
  );
}
function TableToolbar({ search, onSearch, perPage, onPerPage }: { search: string; onSearch: (v: string) => void; perPage: number; onPerPage: (v: number) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Mostrar</span>
        <select value={perPage} onChange={e => onPerPage(Number(e.target.value))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
          {[10, 25, 50, 100].map(n => <option key={n}>{n}</option>)}
        </select>
        <span className="text-xs text-slate-500">por página</span>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{I.search}</span>
        <input type="text" value={search} onChange={e => onSearch(e.target.value)} placeholder="Pesquisar…" className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 w-full sm:w-52" />
      </div>
    </div>
  );
}
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? "bg-emerald-500" : "bg-slate-300"}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4.5" : "translate-x-0.5"}`} />
    </button>
  );
}
function MiniBarChart({ data, color }: { data: { mes: string; v: number }[]; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="flex items-end gap-1.5 h-40" role="img" aria-label="Receita mensal">
        {data.map((d, i) => {
          const pct = Math.max(8, (d.v / max) * 100);
          const active = hover === i;
          const dim = hover !== null && !active;
          return (
            <div key={d.mes} className="relative flex-1 h-full flex items-end cursor-pointer"
              onMouseEnter={() => setHover(i)}>
              {active && (
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 z-10">
                  <div className="bg-slate-800 text-white rounded-lg px-2.5 py-1 shadow-lg whitespace-nowrap">
                    <p className="text-xs font-semibold">{d.mes}</p>
                    <p className="text-xs text-emerald-300 font-bold">€ {d.v.toLocaleString("pt-PT")}</p>
                  </div>
                </div>
              )}
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${pct}%`,
                  backgroundColor: color,
                  opacity: active ? 1 : dim ? 0.22 : i === data.length - 1 ? 1 : 0.5,
                  transform: active ? "translateY(-4px)" : undefined,
                  transition: "opacity 160ms ease, transform 160ms ease",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-2">
        {data.map((d, i) => (
          <span key={d.mes} className={`flex-1 text-center text-xs ${hover === i ? "text-slate-700 font-semibold" : "text-slate-400"}`}>
            {d.mes}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConhecimentoEnaCard({ onVerMais }: { onVerMais: () => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = conhecimentoEna.reduce((s, d) => s + d.n, 0);
  const active = conhecimentoEna.find(d => d.id === hover) ?? null;
  const r = 56;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const segments = conhecimentoEna.map(d => {
    const len = (d.pct / 100) * c;
    const offset = c * 0.25 - acc;
    acc += len;
    return { ...d, len, offset };
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Como conheceram a ENA</p>
          <p className="text-xs text-slate-400 mt-0.5">Pergunta da ficha de inscrição · {total.toLocaleString("pt-PT")} formandos</p>
        </div>
        <button type="button" onClick={onVerMais} className="text-xs font-semibold text-slate-400 hover:text-amber-600 whitespace-nowrap">
          Pré-inscrições →
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
        <div className="flex justify-center" onMouseLeave={() => setHover(null)}>
          <svg viewBox="0 0 160 160" className="w-44 h-44" role="img" aria-label="Origem dos formandos">
            {segments.map(s => (
              <circle
                key={s.id}
                cx="80" cy="80" r={r} fill="none"
                stroke={s.color}
                strokeWidth={hover && hover !== s.id ? 16 : 22}
                strokeDasharray={`${s.len} ${c - s.len}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
                className="cursor-pointer"
                style={{ transition: "stroke-width 160ms ease", opacity: hover && hover !== s.id ? 0.28 : 1 }}
                onMouseEnter={() => setHover(s.id)}
              />
            ))}
            <circle cx="80" cy="80" r="40" fill="white" />
            <text x="80" y={active ? 72 : 76} textAnchor="middle" className="fill-slate-800" style={{ fontSize: active ? 16 : 18, fontWeight: 700 }}>
              {active ? `${active.pct}%` : total.toLocaleString("pt-PT")}
            </text>
            <text x="80" y={active ? 90 : 94} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>
              {active ? active.curto : "formandos"}
            </text>
          </svg>
        </div>
        <div className="space-y-2">
          {conhecimentoEna.map(d => {
            const on = hover === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onMouseEnter={() => setHover(d.id)}
                onMouseLeave={() => setHover(null)}
                className={`w-full text-left rounded-lg px-2 py-1.5 transition-colors ${on ? "bg-slate-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className={`text-xs truncate ${on ? "font-semibold text-slate-800" : "font-medium text-slate-700"}`}>{d.fonte}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-700 flex-shrink-0">{d.pct}%</span>
                </div>
                <div className="flex items-center gap-2 pl-4">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
                  </div>
                  <span className="text-[11px] text-slate-400 w-10 text-right">{d.n.toLocaleString("pt-PT")}</span>
                </div>
                {on && <p className="text-[11px] text-slate-400 pl-4 mt-0.5">{d.detalhe}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ─── Modal (substitui as antigas gavetas laterais) ────────────────────────────

function SlideOver({ open, onClose, title, sub, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string; sub?: string;
  children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl";
}) {
  return <AppModal open={open} onClose={onClose} title={title} sub={sub} size={size}>{children}</AppModal>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return <AppModal open={open} onClose={onClose} title={title} size="md">{children}</AppModal>;
}

type DestinoTurma = {
  id: number; nome: string; curso: string; horario: string; local: string;
  ocupadas: number; vagas: number; activa: boolean;
};

function ConfirmEliminarFormandoModal({
  open, onClose, nome, turma, onConfirm,
}: {
  open: boolean; onClose: () => void; nome: string; turma: string; onConfirm: () => void;
}) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Eliminar formando"
      sub={nome}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={() => { onConfirm(); onClose(); }} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white">Eliminar</button>
        </>
      }
    >
      <div className="p-5 space-y-2">
        <p className="text-sm text-slate-700">
          Remover <span className="font-semibold">{nome}</span> da turma <span className="font-semibold">{turma}</span>?
        </p>
        <p className="text-xs text-slate-500">Sai da lista desta turma. Deixa de contar para vagas, presenças e certificados.</p>
      </div>
    </AppModal>
  );
}

function TransferirTurmaModal({
  open, onClose, nome, turmaAtual, destinos, onTransfer, accent = "gold",
}: {
  open: boolean;
  onClose: () => void;
  nome: string;
  turmaAtual: string;
  destinos: DestinoTurma[];
  onTransfer: (dest: DestinoTurma) => void;
  accent?: "gold" | "fin";
}) {
  const [curso, setCurso] = useState("");
  const [horario, setHorario] = useState("");
  const [turmaNome, setTurmaNome] = useState("");
  useEffect(() => {
    if (open) { setCurso(""); setHorario(""); setTurmaNome(""); }
  }, [open]);

  const cursoOpts = uniqueOpts(destinos.map(d => d.curso));
  const horarioOpts = uniqueOpts(destinos.filter(d => !curso || d.curso === curso).map(d => d.horario));
  const turmas = destinos.filter(d =>
    (!curso || d.curso === curso) && (!horario || d.horario === horario)
  );
  const turmaOpts = turmas.map(d => ({
    value: d.nome,
    sub: `${d.local} · ${d.horario} · ${d.ocupadas}/${d.vagas}${!d.activa ? " · inativa" : d.ocupadas >= d.vagas ? " · lotada" : " vagas"}`,
  }));
  const dest = turmas.find(d => d.nome === turmaNome);
  const bloqueada = dest ? (!dest.activa || dest.ocupadas >= dest.vagas) : true;
  const btn = accent === "fin" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-500 hover:bg-amber-600";

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Transferir de turma"
      sub={nome}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button
            type="button"
            disabled={bloqueada}
            onClick={() => { if (!dest || bloqueada) return; onTransfer(dest); onClose(); }}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg text-white disabled:opacity-40 ${btn}`}
          >
            Transferir
          </button>
        </>
      }
    >
      <div className="p-5 space-y-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          Está em <span className="font-semibold text-slate-800">{turmaAtual}</span>. Escolha o curso, o horário e a turma de destino.
        </div>
        <Field label="Curso">
          <SearchSelect
            value={curso}
            onChange={v => { setCurso(v); setHorario(""); setTurmaNome(""); }}
            options={cursoOpts}
            placeholder="Pesquisar curso…"
            empty="Não há outros cursos com turmas."
          />
        </Field>
        <Field label="Horário">
          <SearchSelect
            value={horario}
            onChange={v => { setHorario(v); setTurmaNome(""); }}
            options={horarioOpts}
            placeholder={curso ? "Pesquisar horário…" : "Escolha primeiro o curso…"}
            empty="Sem horários para este curso."
          />
        </Field>
        <Field label="Turma">
          <SearchSelect
            value={turmaNome}
            onChange={setTurmaNome}
            options={turmaOpts}
            placeholder={horario || curso ? "Pesquisar turma…" : "Escolha curso e horário…"}
            empty="Não há turmas para este filtro."
          />
        </Field>
        {dest && !dest.activa && <p className="text-xs font-medium text-amber-700">Esta turma está inativa e não aceita transferências.</p>}
        {dest && dest.activa && dest.ocupadas >= dest.vagas && <p className="text-xs font-medium text-red-600">A turma {dest.nome} está lotada ({dest.ocupadas}/{dest.vagas}).</p>}
        {dest && dest.activa && dest.ocupadas < dest.vagas && (
          <p className="text-xs text-slate-500">{dest.nome} · {dest.local} · {dest.vagas - dest.ocupadas} vagas livres.</p>
        )}
        {destinos.length === 0 && <p className="text-xs text-slate-500">Não há outras turmas para onde transferir.</p>}
      </div>
    </AppModal>
  );
}

function DocumentosGoldPanel({ formando }: { formando: FormandoTurma }) {
  const [docs, setDocs] = useState(() => [
    { id: "cc", label: "Cartão de Cidadão", ok: true, data: formando.inscrito.slice(0, 10) },
    { id: "contrato", label: "Contrato de formação", ok: formando.pago, data: formando.pago ? formando.inscrito.slice(0, 10) : "" },
    { id: "pip", label: "PIP - Projeto de Intervenção Pedagógica", ok: formando.id % 3 !== 0, data: formando.id % 3 !== 0 ? "2026-08-20" : "" },
    { id: "exp", label: "Comprovativo de 5 anos de experiência", ok: formando.id % 2 === 0, data: formando.id % 2 === 0 ? "2026-08-12" : "" },
    { id: "regulamento", label: "Regulamento de formação aceite", ok: true, data: formando.inscrito.slice(0, 10) },
  ]);
  const emFalta = docs.filter(d => !d.ok).length;
  return (
    <div className="space-y-3">
      <div className={`rounded-xl p-4 flex items-center gap-3 ${emFalta === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${emFalta === 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
          {emFalta === 0 ? I.check : I.warn}
        </div>
        <div>
          <p className={`text-sm font-bold ${emFalta === 0 ? "text-emerald-700" : "text-amber-700"}`}>
            {emFalta === 0 ? "Documentos completos" : `${emFalta} documentos em falta`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{formando.nome} {formando.apelido} · {formando.turma}</p>
        </div>
      </div>
      <div className="space-y-2">
        {docs.map(d => (
          <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border ${d.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <button type="button" onClick={() => setDocs(xs => xs.map(x => x.id === d.id ? { ...x, ok: !x.ok, data: !x.ok ? new Date().toISOString().slice(0, 10) : "" } : x))}
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${d.ok ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-red-300"}`}>
              {d.ok && I.check}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${d.ok ? "text-emerald-700" : "text-red-600"}`}>{d.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{d.ok && d.data ? `Validado em ${d.data}` : "Em falta"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ficha do Formando ────────────────────────────────────────────────────────

type FormandoRecord = FormandoTurma;

function FichaFormando({ formando, tipo = "gold", onClose, initialTab = "documentos" }: {
  formando: FormandoRecord; tipo?: "gold" | "fin"; onClose: () => void;
  initialTab?: "info" | "documentos" | "pagamentos" | "historico" | "notas";
}) {
  const [tab, setTab] = useState<"info" | "documentos" | "pagamentos" | "historico" | "notas">(initialTab);
  const [nota, setNota] = useState("");
  const [notas, setNotas] = useState([
    { id: 1, texto: "Ligou a questionar sobre o horário de sábado. Confirmou presença.", data: "2026-09-02 10:15", autor: "Tania" },
  ]);

  const { gold } = useTurmas();
  const turma = gold.find(t => t.id === formando.turmaId);

  return (
    <div className="flex flex-col h-full">
      {/* Header card */}
      <div className={`px-5 py-4 border-b ${tipo === "gold" ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 ${tipo === "gold" ? "bg-amber-500" : "bg-blue-600"}`}>
            {formando.nome[0]}{formando.apelido[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800">{formando.nome} {formando.apelido}</p>
            <p className="text-xs text-slate-500 truncate">{formando.email}</p>
            <div className="flex items-center gap-2 mt-1">{estadoBadge(formando.estado)}<span className="text-xs text-slate-400">{formando.turma}{turma && !isTurmaActiva(turma) ? " · turma inativa" : ""}</span></div>
          </div>
          <div className={`text-right flex-shrink-0 ${formando.pago ? "text-emerald-600" : "text-amber-600"}`}>
            <p className="text-lg font-bold">€{formando.valor}</p>
            <p className="text-xs">{formando.pago ? "Pago" : "Pendente"}</p>
          </div>
        </div>
        {/* Quick actions */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <a href={`tel:${formando.telf}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">{I.phone} {formando.telf}</a>
          <a href={`https://wa.me/351${formando.telf}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 rounded-lg text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">{I.whatsapp} WhatsApp</a>
          <a href={`mailto:${formando.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white hover:bg-blue-700 transition-colors">{I.mail} Email</a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-5 bg-white flex-shrink-0 overflow-x-auto">
        {(["info", "documentos", "pagamentos", "historico", "notas"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-amber-500 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "info" ? "Informação" : t === "documentos" ? "Documentos" : t === "pagamentos" ? "Pagamento" : t === "historico" ? "Histórico" : "Notas"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === "info" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: "Curso", v: formando.curso },
                { l: "Turma", v: formando.turma },
                { l: "Local", v: formando.local },
                { l: "Inscrito a", v: formando.inscrito },
                { l: "Telemóvel", v: formando.telf },
                { l: "Email", v: formando.email },
              ].map(f => (
                <div key={f.l} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{f.l}</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5 break-all">{f.v}</p>
                </div>
              ))}
            </div>
            {turma && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Turma</p>
                <p className="text-sm font-bold text-slate-800">{turma.nome}</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div><p className="text-xs text-slate-400">Início</p><p className="text-xs font-semibold">{turma.dataInicio}</p></div>
                  <div><p className="text-xs text-slate-400">Local</p><p className="text-xs font-semibold">{turma.local}</p></div>
                  <div><p className="text-xs text-slate-400">Vagas</p><p className="text-xs font-semibold">{turma.totalAlunos}/{turma.vagas}</p></div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "documentos" && <DocumentosGoldPanel formando={formando} />}

        {tab === "pagamentos" && (
          <div className="space-y-3">
            <div className={`rounded-xl p-4 border ${formando.pago ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">€ {formando.valor}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formando.metodo}</p>
                </div>
                {formando.pago ? <Badge label="Pago" variant="green" /> : <Badge label="Pendente" variant="amber" />}
              </div>
            </div>
            {!formando.pago && (
              <div className="grid grid-cols-2 gap-2">
                <button className="py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors">Gerar referência MB</button>
                <button className="py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">Link MB Way</button>
              </div>
            )}
            {formando.pago && (
              <button className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">{I.receipt} Enviar recibo</button>
            )}
          </div>
        )}

        {tab === "historico" && (
          <div className="space-y-2">
            {[
              { acao: "Pré-inscrição recebida", data: formando.inscrito, tipo: "inscricao" },
              { acao: "Email de boas-vindas enviado", data: formando.inscrito, tipo: "email" },
              { acao: "Pagamento confirmado (" + formando.metodo + ")", data: "2026-09-03 18:00", tipo: "pagamento" },
              { acao: "Atribuído à turma " + formando.turma, data: "2026-09-03 18:05", tipo: "turma" },
            ].filter(h => formando.pago || h.tipo !== "pagamento").map((h, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${h.tipo === "pagamento" ? "bg-emerald-500" : h.tipo === "email" ? "bg-blue-500" : h.tipo === "turma" ? "bg-violet-500" : "bg-amber-500"}`} />
                <div>
                  <p className="text-xs font-semibold text-slate-700">{h.acao}</p>
                  <p className="text-xs text-slate-400">{h.data}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "notas" && (
          <div className="space-y-3">
            <div className="space-y-2">
              {notas.map(n => (
                <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-slate-700">{n.texto}</p>
                  <p className="text-xs text-slate-400 mt-1">{n.autor} · {n.data}</p>
                </div>
              ))}
            </div>
            <div>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} placeholder="Adicionar nota de chamada, email ou observação…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              <button onClick={() => { if (nota.trim()) { setNotas(p => [...p, { id: Date.now(), texto: nota, data: new Date().toISOString().slice(0, 16), autor: "Tania" }]); setNota(""); } }}
                className="mt-2 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors">Guardar nota</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">Fechar</button>
      </div>
    </div>
  );
}

// ─── Cockpit da Turma ─────────────────────────────────────────────────────────

const sessoesSample: SessaoMeta[] = [
  { n: 1, data: "Sáb, 07 Set 2026", hora: "09h–13h", formador: "Isac Silva", formadores: ["Isac Silva"], estado: "Realizada", plano: true, modulo: "M1 · Aprendizagem e pedagogia", modulos: ["M1 · Aprendizagem e pedagogia"], duracao: "4h" },
  { n: 2, data: "Sáb, 14 Set 2026", hora: "09h–13h", formador: "Isac Silva", formadores: ["Isac Silva"], estado: "Realizada", plano: true, modulo: "M2 · Comunicação e dinâmica de grupos", modulos: ["M2 · Comunicação e dinâmica de grupos"], duracao: "4h" },
  { n: 3, data: "Sáb, 21 Set 2026", hora: "09h–13h", formador: "Isac Silva · Ivan Esteves", formadores: ["Isac Silva", "Ivan Esteves"], estado: "Agendada", plano: false, modulo: "M2 · Comunicação e dinâmica de grupos", modulos: ["M2 · Comunicação e dinâmica de grupos"], duracao: "4h" },
  { n: 4, data: "Sáb, 28 Set 2026", hora: "09h–13h", formador: "Isac Silva", formadores: ["Isac Silva"], estado: "Agendada", plano: false, modulo: "M3 · Avaliação da formação", modulos: ["M3 · Avaliação da formação"], duracao: "4h" },
  { n: 5, data: "Sáb, 05 Out 2026", hora: "09h–13h", formador: "Isac Silva", formadores: ["Isac Silva"], estado: "Agendada", plano: false, modulo: "M3 · Avaliação da formação", modulos: ["M3 · Avaliação da formação"], duracao: "4h" },
];

const finSessoesSample: SessaoMeta[] = [
  { n: 1, data: "Qua, 27 Ago 2026", hora: "19h–22h", formador: "Vânia Fernandes", formadores: ["Vânia Fernandes"], estado: "Realizada", plano: true, modulo: "UFCD 3564 · Avaliação primária e SVB", modulos: ["UFCD 3564 · Avaliação primária e SVB"], duracao: "5h" },
  { n: 2, data: "Qua, 03 Set 2026", hora: "19h–22h", formador: "Vânia Fernandes", formadores: ["Vânia Fernandes"], estado: "Realizada", plano: true, modulo: "UFCD 3564 · Trauma e hemorragias", modulos: ["UFCD 3564 · Trauma e hemorragias"], duracao: "5h" },
  { n: 3, data: "Qua, 10 Set 2026", hora: "19h–22h", formador: "Vânia Fernandes · Cátia Pinheiro", formadores: ["Vânia Fernandes", "Cátia Pinheiro"], estado: "Agendada", plano: false, modulo: "UFCD 3564 · Queimaduras e intoxicações", modulos: ["UFCD 3564 · Queimaduras e intoxicações"], duracao: "5h" },
  { n: 4, data: "Qua, 17 Set 2026", hora: "19h–22h", formador: "Vânia Fernandes", formadores: ["Vânia Fernandes"], estado: "Agendada", plano: false, modulo: "UFCD 3564 · Emergências médicas", modulos: ["UFCD 3564 · Emergências médicas"], duracao: "5h" },
  { n: 5, data: "Qua, 24 Set 2026", hora: "19h–22h", formador: "Vânia Fernandes", formadores: ["Vânia Fernandes"], estado: "Agendada", plano: false, modulo: "UFCD 3564 · Simulação e avaliação", modulos: ["UFCD 3564 · Simulação e avaliação"], duracao: "5h" },
];

function ModulosCell({ sessao }: { sessao: { modulo?: string; modulos?: string[] } }) {
  const list = sessaoModulos(sessao);
  if (!list.length) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className="flex flex-col gap-0.5 min-w-[10rem] max-w-[16rem]">
      {list.map(m => (
        <span key={m} className="text-xs text-slate-700 leading-snug">{m}</span>
      ))}
    </div>
  );
}

function FormadoresCell({
  sessao, onOpen,
}: {
  sessao: { formador?: string; formadores?: string[] };
  onOpen?: (nome: string) => void;
}) {
  const list = sessaoFormadores(sessao);
  if (!list.length) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className="flex flex-col gap-0.5 min-w-[8rem] max-w-[14rem]">
      {list.map(nome => onOpen ? (
        <button key={nome} type="button" onClick={() => onOpen(nome)} className="text-left text-xs font-medium text-slate-700 hover:text-violet-700">
          {nome}
        </button>
      ) : (
        <span key={nome} className="text-xs font-medium text-slate-700">{nome}</span>
      ))}
    </div>
  );
}

function sumarioLabel(s?: SumarioSessaoData) {
  if (s?.assinado && sumarioPreenchido(s)) return "Ver sumário";
  if (sumarioPreenchido(s)) return "Assinar sumário";
  return "+ Preencher sumário";
}
function sumarioBtnCls(s: SumarioSessaoData | undefined, gold: boolean) {
  if (s?.assinado && sumarioPreenchido(s)) return "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100";
  return gold ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
}

function SessoesTurmaTab({
  accent, turmaNome, sessoes, sumarios, onNovaSessao, onPlano, onSumario, onPresencas, onOpenFormador,
}: {
  accent: "gold" | "fin";
  turmaNome: string;
  sessoes: SessaoMeta[];
  sumarios: Record<number, SumarioSessaoData>;
  onNovaSessao: () => void;
  onPlano: (s: SessaoMeta) => void;
  onSumario: (s: SessaoMeta) => void;
  onPresencas: (s: SessaoMeta) => void;
  onOpenFormador?: (nome: string) => void;
}) {
  const gold = accent === "gold";
  const numCls = gold ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";
  const planoTodo = gold ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
  return (
    <Card>
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Sessões - {turmaNome}</p>
        <NewBtn accent={accent} label="+ Nova Sessão" onClick={onNovaSessao} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Nº</Th><Th>Data / Hora</Th><Th>Módulo</Th><Th>Formadores</Th>
              <Th>Plano de Sessão</Th><Th>Sumário</Th><Th>Presenças</Th><Th>Estado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessoes.map(s => {
              const sum = sumarios[s.n];
              const realizada = s.estado === "Realizada";
              return (
                <tr key={s.n} className="hover:bg-slate-50">
                  <Td><span className={`w-7 h-7 rounded-full ${numCls} text-xs font-bold flex items-center justify-center`}>{s.n}</span></Td>
                  <Td>
                    <p className="text-xs font-medium text-slate-800 whitespace-nowrap">{s.data}</p>
                    <p className="text-xs text-slate-400">{s.hora}</p>
                  </Td>
                  <Td><ModulosCell sessao={s} /></Td>
                  <Td><FormadoresCell sessao={s} onOpen={onOpenFormador} /></Td>
                  <Td>
                    <button type="button" onClick={() => onPlano(s)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${s.plano ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" : planoTodo}`}>
                      {s.plano ? "Ver plano" : "+ Preencher plano"}
                    </button>
                  </Td>
                  <Td>
                    <button type="button" onClick={() => onSumario(s)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${sumarioBtnCls(sum, gold)}`}>
                      {sumarioLabel(sum)}
                    </button>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      disabled={!realizada}
                      title={realizada ? "Marcar presenças desta sessão" : "As presenças só se marcam depois da sessão"}
                      onClick={() => realizada && onPresencas(s)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${
                        realizada
                          ? "text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100"
                          : "text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed"
                      }`}
                    >
                      {realizada ? "Marcar presenças" : "Após a sessão"}
                    </button>
                  </Td>
                  <Td>{estadoBadge(s.estado)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sessoes.length === 0 && (
        <p className="px-4 py-8 text-center text-xs text-slate-400">Ainda não há sessões. Gere o cronograma ou adicione a primeira sessão.</p>
      )}
    </Card>
  );
}

const certificadosSample = [
  { id: 1, nome: "Tiago Bento", presencas: 100, elearning: 90, nota: 17, certificado: true },
  { id: 2, nome: "Luciana D'Avila", presencas: 80, elearning: 100, nota: 15, certificado: false },
  { id: 3, nome: "Ciara Gonçalves", presencas: 60, elearning: 70, nota: 10, certificado: false },
  { id: 4, nome: "Liliana Real", presencas: 100, elearning: 95, nota: 19, certificado: true },
  { id: 5, nome: "Angélica Ribeiro", presencas: 80, elearning: 85, nota: 14, certificado: false },
  { id: 6, nome: "Maria Mota", presencas: 100, elearning: 80, nota: 16, certificado: false },
  { id: 7, nome: "Elisabete Soares", presencas: 40, elearning: 50, nota: 8, certificado: false },
  { id: 8, nome: "Andreia Arantes", presencas: 100, elearning: 100, nota: 18, certificado: true },
];

type DocEstado = "ok" | "parcial" | "falta";
type DocItem = { label: string; detalhe: string; estado: DocEstado; bloqueante?: boolean; payload?: unknown };
const docsTurmaGrupos: { id: string; label: string; color: string; icon: React.ReactNode; items: DocItem[] }[] = [
  { id: "turma", label: "Documentos da turma", color: "bg-amber-50 border-amber-200 text-amber-800", icon: I.school, items: [
    { label: "Programa de formação", detalhe: "Objetivos, conteúdos, metodologias e avaliação.", estado: "ok" },
    { label: "Regulamento de formação", detalhe: "Regulamento ENA aceite pelos formandos.", estado: "ok" },
    { label: "Cronograma da turma", detalhe: "12 sábados · 09h–13h + 4 síncronas.", estado: "ok" },
    { label: "Registo de ocorrências", detalhe: "Sem ocorrências registadas.", estado: "ok" },
    { label: "Relatório final da turma", detalhe: "Fecha o DTP.", estado: "falta", bloqueante: true },
  ]},
  { id: "sessoes", label: "Documentos das sessões", color: "bg-slate-50 border-slate-200 text-slate-700", icon: I.calendar, items: [
    { label: "Planos de sessão", detalhe: "12/16 planos carregados.", estado: "parcial" },
    { label: "Sumários assinados", detalhe: "3/16 sessões.", estado: "falta", bloqueante: true },
    { label: "Folhas de presença", detalhe: "Assinatura do formador por período.", estado: "parcial" },
  ]},
  { id: "formandos", label: "Documentos dos formandos", color: "bg-blue-50 border-blue-200 text-blue-800", icon: I.users, items: [
    { label: "Contratos de formação", detalhe: "8/10 assinados.", estado: "parcial" },
    { label: "PIP", detalhe: "0/10 projetos arquivados.", estado: "falta", bloqueante: true },
    { label: "Simulação pedagógica inicial", detalhe: "Grelhas em falta.", estado: "falta", bloqueante: true },
    { label: "Simulação pedagógica final", detalhe: "Aguardar módulo final.", estado: "falta" },
    { label: "Comprovativo de 5 anos de experiência", detalhe: "7/10 com declaração.", estado: "parcial" },
  ]},
  { id: "formadores", label: "Documentos dos formadores", color: "bg-violet-50 border-violet-200 text-violet-800", icon: I.person, items: [
    { label: "CCP / CCPE do formador", detalhe: "CCP n.º F-44821 · válido.", estado: "ok" },
    { label: "CV do formador", detalhe: "Atualizado em 2026-04-12.", estado: "ok" },
    { label: "Contrato do formador", detalhe: "Isac Silva · 2026/CCP-17.", estado: "ok" },
  ]},
];

const docsFinGrupos: typeof docsTurmaGrupos = [
  { id: "turma", label: "Documentos da turma", color: "bg-blue-50 border-blue-200 text-blue-800", icon: I.school, items: [
    { label: "Programa de formação UFCD", detalhe: "UFCD 3564 · Primeiros Socorros · 25h.", estado: "ok" },
    { label: "Regulamento de formação", detalhe: "Regulamento ENA + regras do financiador.", estado: "ok" },
    { label: "Cronograma da turma", detalhe: "5 sessões síncronas · Sala Virtual.", estado: "ok" },
    { label: "Enquadramento do financiador", detalhe: "Candidatura e regras da tipologia.", estado: "ok" },
    { label: "Relatório de execução", detalhe: "Fecha o DTP da turma financiada.", estado: "falta", bloqueante: true },
  ]},
  { id: "sessoes", label: "Documentos das sessões", color: "bg-slate-50 border-slate-200 text-slate-700", icon: I.calendar, items: [
    { label: "Planos de sessão", detalhe: "0/5 planos carregados.", estado: "falta", bloqueante: true },
    { label: "Sumários assinados", detalhe: "Ainda sem sessões fechadas.", estado: "falta" },
    { label: "Folhas de presença", detalhe: "Assinatura digital por sessão.", estado: "falta" },
    { label: "Mapa de assiduidade em horas", detalhe: "Obrigatório no regime financiado.", estado: "falta", bloqueante: true },
  ]},
  { id: "formandos", label: "Documentos dos formandos", color: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: I.users, items: [
    { label: "Contratos de formação", detalhe: "14/17 assinados.", estado: "parcial" },
    { label: "Cartão de cidadão", detalhe: "15/17 nos documentos.", estado: "parcial" },
    { label: "Certificado de habilitações", detalhe: "12/17 validados.", estado: "parcial" },
    { label: "Curriculum vitae", detalhe: "14/17.", estado: "parcial" },
    { label: "IBAN", detalhe: "3/17. Sem IBAN não há apoios.", estado: "falta", bloqueante: true },
    { label: "Comprovativo de emprego", detalhe: "10/17.", estado: "parcial" },
  ]},
  { id: "formadores", label: "Documentos dos formadores", color: "bg-violet-50 border-violet-200 text-violet-800", icon: I.person, items: [
    { label: "CCP / CCPE do formador", detalhe: "Vânia Fernandes · CCP válido.", estado: "ok" },
    { label: "CV do formador", detalhe: "Atualizado em 2026-03-02.", estado: "ok" },
    { label: "Contrato do formador", detalhe: "2026/UFCD-3564.", estado: "ok" },
  ]},
];

function TurmaTabBar({ tab, onChange, accent = "gold", dtpPct }: { tab: CockpitTab; onChange: (t: CockpitTab) => void; accent?: "gold" | "fin"; dtpPct: number }) {
  const active = accent === "gold" ? "border-amber-500 text-amber-600" : "border-blue-600 text-blue-600";
  const chip = accent === "gold" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";
  const tabs: { id: CockpitTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Visão Geral", icon: I.school },
    { id: "cronograma", label: "Cronograma", icon: I.calendar },
    { id: "sessoes", label: "Sessões", icon: I.calendar },
    { id: "documentos", label: "Documentos", icon: I.file },
    { id: "dtp", label: "Dossiê TP", icon: I.folder },
    { id: "certificados", label: "Certificados", icon: I.doc },
  ];
  return (
    <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto scrollbar-hide">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold transition-colors -mb-px border-b-2 whitespace-nowrap ${tab === t.id ? active : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          {t.icon} {t.label}
          {t.id === "dtp" && <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${chip}`}>{dtpPct}%</span>}
        </button>
      ))}
    </div>
  );
}

function cloneGrupos(src: typeof docsTurmaGrupos) {
  return src.map(g => ({ ...g, items: g.items.map(i => ({ ...i })) }));
}

function applyDocSave(
  grupos: typeof docsTurmaGrupos,
  ref: { grupoId: string; label: string },
  next: { estado: DocEstado; detalhe: string; payload?: unknown },
) {
  return grupos.map(g => g.id !== ref.grupoId ? g : {
    ...g,
    items: g.items.map(d => d.label !== ref.label ? d : {
      ...d,
      estado: next.estado,
      detalhe: next.detalhe,
      payload: next.payload !== undefined ? next.payload : d.payload,
    }),
  });
}

function DocumentosTurmaTab({ regime = "gold", curso }: { regime?: "gold" | "fin"; curso?: string }) {
  const estadoCfg: Record<DocEstado, { dot: string; chip: string; label: string }> = {
    ok: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "No dossiê" },
    parcial: { dot: "bg-amber-400", chip: "bg-amber-50 text-amber-700 border-amber-200", label: "Parcial" },
    falta: { dot: "bg-red-400", chip: "bg-red-50 text-red-600 border-red-200", label: "Em falta" },
  };
  const seed = regime === "fin" ? docsFinGrupos : docsTurmaGrupos;
  const [grupos, setGrupos] = useState(() => cloneGrupos(seed));
  const [resolver, setResolver] = useState<{ grupoId: string; label: string } | null>(null);
  const resolverRef = useRef(resolver);
  resolverRef.current = resolver;
  useEffect(() => { setGrupos(cloneGrupos(seed)); setResolver(null); }, [regime]);

  const { formandosFin, formandosTurmas } = useLists();
  const nomesFormandos = regime === "fin"
    ? formandosFin.map(f => `${f.nome} ${f.apelido}`)
    : formandosTurmas.map(f => `${f.nome} ${f.apelido}`);
  const nomesSessoes = regime === "fin"
    ? ["Sessão 1 · 27 Ago", "Sessão 2 · 03 Set", "Sessão 3 · 10 Set", "Sessão 4 · 17 Set", "Sessão 5 · 24 Set"]
    : Array.from({ length: 16 }, (_, i) => `Sessão ${i + 1}`);
  const cursoNome = curso ?? (regime === "gold" ? "Formação de Formadores - CCP" : undefined);

  const aberto = resolver
    ? grupos.flatMap(g => g.items.filter(d => g.id === resolver.grupoId && d.label === resolver.label).map(d => ({ grupoId: g.id, grupo: g.id, doc: d })))[0]
    : undefined;

  function abrir(grupoId: string, doc: { label: string; detalhe: string; estado: DocEstado }) {
    setResolver({ grupoId, label: doc.label });
  }

  function targetFromDoc(grupoId: string, doc: DocItem): ResolveDocTarget {
    const isPip = doc.label === "PIP";
    const isSim = /simula/i.test(doc.label);
    if (isPip) {
      return {
        label: doc.label, detalhe: doc.detalhe, estado: doc.estado, kind: "pip",
        pipItems: seedPipItems(nomesFormandos, doc.payload as PipItem[] | undefined),
      };
    }
    if (isSim) {
      const params = getParametrosAvaliacao(cursoNome);
      return {
        label: doc.label, detalhe: doc.detalhe, estado: doc.estado, kind: "simulacao",
        simItems: seedSimItems(nomesFormandos, params.criterios, doc.payload as SimItem[] | undefined),
        criterios: params.criterios,
        curso: params.curso,
      };
    }
    const lista = /\d+\s*\/\s*\d+/.test(doc.detalhe) || grupoId === "formandos" || grupoId === "sessoes";
    const nomes = grupoId === "sessoes" ? nomesSessoes : nomesFormandos;
    return {
      label: doc.label,
      detalhe: doc.detalhe,
      estado: doc.estado,
      kind: lista ? "lista" : "ficheiro",
      items: lista ? seedListaFromDetalhe(doc.detalhe, nomes) : undefined,
    };
  }

  return (
    <div className="space-y-4">
      {grupos.map(g => {
        const ok = g.items.filter(d => d.estado === "ok").length;
        return (
          <Card key={g.id}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${g.color} rounded-t-xl`}>
              <div className="flex items-center gap-2"><span>{g.icon}</span><p className="text-sm font-semibold">{g.label}</p></div>
              <span className="text-xs font-bold">{ok}/{g.items.length} no dossiê</span>
            </div>
            <div className="divide-y divide-slate-50">
              {g.items.map(doc => {
                const cfg = estadoCfg[doc.estado];
                return (
                  <div key={doc.label} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-medium text-slate-800">{doc.label}</p>
                        {doc.bloqueante && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">bloqueante</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{doc.detalhe}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrir(g.id, doc)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${doc.estado === "ok" ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50" : regime === "gold" ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"}`}>
                        {doc.estado === "ok" ? "Substituir" : "Resolver"}
                      </button>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.chip} whitespace-nowrap`}>{cfg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      <ResolverDocumentoModal
        open={!!aberto}
        onClose={() => setResolver(null)}
        accent={regime}
        target={aberto ? targetFromDoc(aberto.grupoId, aberto.doc) : null}
        onSave={next => {
          const ref = resolverRef.current;
          if (!ref) return;
          setGrupos(prev => applyDocSave(prev, ref, next));
        }}
      />
    </div>
  );
}

function CertificadosTurmaTab({ formandos, issued, onUpload }: {
  formandos: { id: number; nome: string }[];
  issued?: Record<number, boolean>;
  onUpload?: (id: number) => void;
}) {
  const rows = (formandos.length ? formandos : certificadosSample.map(c => ({ id: c.id, nome: c.nome }))).map((f, i) => {
    const sample = certificadosSample[i % certificadosSample.length];
    return {
      id: f.id,
      nome: f.nome,
      presencas: sample.presencas,
      elearning: sample.elearning,
      nota: sample.nota,
      certificado: issued?.[f.id] ?? sample.certificado,
    };
  });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Elegíveis", v: rows.filter(c => c.presencas >= 75 && c.nota >= 10).length, color: "text-emerald-600", bg: "bg-emerald-50" },
          { l: "Não elegíveis", v: rows.filter(c => c.presencas < 75 || c.nota < 10).length, color: "text-red-600", bg: "bg-red-50" },
          { l: "Certificados emitidos", v: rows.filter(c => c.certificado).length, color: "text-blue-600", bg: "bg-blue-50" },
        ].map(s => (
          <Card key={s.l} className={`p-4 ${s.bg}`}>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{s.l}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.v}</p>
          </Card>
        ))}
      </div>
      <Card>
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">Elegibilidade por formando</p>
          <p className="text-xs text-slate-400 mt-0.5">Mínimo: 75% presenças e nota ≥ 10</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Formando</Th><Th className="text-center">Presenças</Th><Th className="text-center">E-Learning</Th><Th className="text-center">Nota Final</Th><Th className="text-center">Elegibilidade</Th><Th className="text-center">Certificado</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(c => {
                const elegivel = c.presencas >= 75 && c.nota >= 10;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td className="text-xs font-medium text-slate-800">{c.nome}</Td>
                    <Td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width: `${c.presencas}%`, backgroundColor: c.presencas >= 75 ? "#10B981" : "#EF4444" }} /></div>
                        <span className={`text-xs font-bold ${c.presencas >= 75 ? "text-emerald-600" : "text-red-600"}`}>{c.presencas}%</span>
                      </div>
                    </Td>
                    <Td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${c.elearning}%` }} /></div>
                        <span className="text-xs font-bold text-blue-600">{c.elearning}%</span>
                      </div>
                    </Td>
                    <Td className="text-center"><span className={`text-sm font-bold ${c.nota >= 10 ? "text-emerald-600" : "text-red-600"}`}>{c.nota}/20</span></Td>
                    <Td className="text-center"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${elegivel ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{elegivel ? "Elegível" : "Não elegível"}</span></Td>
                    <Td className="text-center">
                      {c.certificado
                        ? <div className="flex items-center justify-center gap-1"><span className="text-xs text-emerald-600 font-semibold">Emitido</span><ActBtn icon={I.eye} label="Ver" color="gray" /></div>
                        : <button onClick={() => onUpload?.(c.id)} disabled={!elegivel} className="text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed">Upload</button>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CockpitTurmaView({ turmaId, onBack, initialTab = "overview", onNavigate }: { turmaId?: number; onBack: () => void; initialTab?: CockpitTab; onNavigate?: (v: View) => void }) {
  const { gold, toggleGold, setGoldCronograma, patchGold } = useTurmas();
  const { formandosTurmas, addFormandoTurma, patchFormandoTurma, removeFormandoTurma } = useLists();
  const turma = gold.find(t => t.id === turmaId) ?? gold[0];
  const activa = isTurmaActiva(turma);
  const membros = formandosTurmas.filter(f => f.turmaId === turma.id);
  const pagos = membros.filter(f => f.pago).length;
  const vagasLivres = turma.vagas - turma.totalAlunos;
  const sessoesTurma = turma.cronograma.length ? cronogramaToSessoes(turma.cronograma) : sessoesSample;
  const [fichaOpen, setFichaOpen] = useState<FormandoRecord | null>(null);
  const [apagarFormando, setApagarFormando] = useState<FormandoRecord | null>(null);
  const [transferirFormando, setTransferirFormando] = useState<FormandoRecord | null>(null);
  const [tab, setTab] = useState<CockpitTab>(initialTab);
  const [planoSessao, setPlanoSessao] = useState<SessaoMeta | null>(null);
  const [planos, setPlanos] = useState<Record<number, PlanoSessaoData>>(defaultPlanos);
  const [sumarioSessao, setSumarioSessao] = useState<SessaoMeta | null>(null);
  const [sumarios, setSumarios] = useState<Record<number, SumarioSessaoData>>(defaultSumarios);
  const [presencasSession, setPresencasSession] = useState<SessaoMeta | null>(null);
  const [presencasBySessao, setPresencasBySessao] = useState<Record<number, { id: number; nome: string; presente: boolean }[]>>({});
  const [uploadCert, setUploadCert] = useState<number | null>(null);
  const [certsIssued, setCertsIssued] = useState<Record<number, boolean>>({});
  const [formadorOpen, setFormadorOpen] = useState<string | null>(null);
  const [novaSessao, setNovaSessao] = useState(false);
  const [formadoresSessao, setFormadoresSessao] = useState<string[]>(["Isac Silva"]);
  const formadorOptsSessao = useFormadorOptions(formadoresSessao);
  const [moduloSessao, setModuloSessao] = useState<string[]>([]);
  const [dataSessao, setDataSessao] = useState("");
  const [horaSessao, setHoraSessao] = useState("09:00");
  const [addFormando, setAddFormando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoTelf, setNovoTelf] = useState("");
  const [editTurma, setEditTurma] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editLocal, setEditLocal] = useState("");
  const [editHorario, setEditHorario] = useState("");
  const [editFormador, setEditFormador] = useState("");
  const [editInicio, setEditInicio] = useState("");
  const [editVagas, setEditVagas] = useState(16);
  const formadorOpts = useFormadorOptions();
  useEffect(() => { setTab(initialTab); }, [initialTab, turmaId]);
  const nomesCockpit = membros.map(f => ({ id: f.id, nome: `${f.nome} ${f.apelido}` }));

  return (
    <>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <button onClick={onBack} className="hover:text-amber-600 transition-colors">Turmas Gold</button>
          <span>›</span><span className="font-semibold text-slate-700">{turma.nome}</span>
        </div>

        {/* Hero card */}
        <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-2xl p-5 text-white">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg">{turma.nome}</span>
                {estadoBadge(turma.estado)}
                <TurmaActivaToggle compact light activa={activa} onChange={v => toggleGold(turma.id, v)} />
              </div>
              <p className="text-lg font-bold mt-1">{turma.curso}</p>
              <div className="flex flex-wrap gap-4 mt-2 text-slate-300 text-xs">
                <span className="flex items-center gap-1">{I.location} {turma.local}</span>
                <span className="flex items-center gap-1">{I.calendar} {turma.dataInicio}</span>
                <span className="flex items-center gap-1">{I.school} {turma.horario}</span>
              </div>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button onClick={() => {
                setEditNome(turma.nome); setEditLocal(turma.local); setEditHorario(turma.horario);
                setEditFormador(turma.formador); setEditInicio(turma.dataInicio); setEditVagas(turma.vagas);
                setEditTurma(true);
              }} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors">Editar turma</button>
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors">{I.download}</button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">{turma.totalAlunos} formandos inscritos</span>
              <span className={vagasLivres === 0 ? "text-red-400 font-bold" : vagasLivres <= 3 ? "text-amber-400 font-bold" : "text-emerald-400"}>
                {vagasLivres === 0 ? "LOTADA" : `${vagasLivres} vagas livres`}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${(turma.totalAlunos / turma.vagas) * 100}%`, backgroundColor: vagasLivres === 0 ? "#EF4444" : vagasLivres <= 3 ? "#F59E0B" : "#10B981" }} />
            </div>
            <div className="flex justify-between text-xs mt-1 text-slate-400">
              <span>0</span><span>{turma.vagas} vagas total</span>
            </div>
          </div>
        </div>

        <TurmaTabBar tab={tab} onChange={setTab} accent="gold" dtpPct={dtpPctGold(turma.id)} />

        {!activa && (
          <TurmaInactivaBanner nome={turma.nome} onActivate={() => toggleGold(turma.id, true)} />
        )}

        {tab === "cronograma" && (
          <CronogramaEditor
            layout="page"
            sessoes={turma.cronograma}
            onChange={next => setGoldCronograma(turma.id, next)}
            inicio={turma.dataInicio}
            horario={turma.horario}
            horas={turma.horas}
            formador={turma.formador}
            curso={turma.curso}
          />
        )}

        {tab === "dtp" && (
          <DtpPanel regime="gold" turma={{ codigo: turma.nome, id: turma.id, titulo: turma.curso, sub: `${turma.local} · ${turma.horario}` }} />
        )}
        {tab === "sessoes" && (
          <SessoesTurmaTab
            accent="gold"
            turmaNome={turma.nome}
            sessoes={sessoesTurma}
            sumarios={sumarios}
            onNovaSessao={() => { setFormadoresSessao(turma.formador ? [turma.formador] : []); setModuloSessao([]); setNovaSessao(true); }}
            onPlano={setPlanoSessao}
            onSumario={setSumarioSessao}
            onPresencas={setPresencasSession}
            onOpenFormador={setFormadorOpen}
          />
        )}
        {tab === "documentos" && <DocumentosTurmaTab regime="gold" curso={turma.curso} />}
        {tab === "certificados" && <CertificadosTurmaTab formandos={nomesCockpit} issued={certsIssued} onUpload={id => setUploadCert(id)} />}

        {tab === "overview" && <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: "Formandos", v: turma.totalAlunos, c: "text-slate-800" },
              { l: "Pagamentos ok", v: `${pagos}/${membros.length}`, c: pagos === membros.length ? "text-emerald-600" : "text-amber-600" },
              { l: "Receita confirmada", v: `€ ${pagos * 125}`, c: "text-emerald-600" },
              { l: "Por cobrar", v: `€ ${(membros.length - pagos) * 125}`, c: (membros.length - pagos) > 0 ? "text-amber-600" : "text-slate-400" },
            ].map(s => (
              <Card key={s.l} className="p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{s.l}</p>
                <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
              </Card>
            ))}
          </div>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Programa de Formação</p>
              <button onClick={() => onNavigate?.("gold-cursos")} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800">{I.edit} Editar programa →</button>
            </div>
            <div className="space-y-2">
              {[
                "Módulo 1 - Fundamentos da Formação Profissional (8h)",
                "Módulo 2 - Planeamento e Organização da Formação (16h)",
                "Módulo 3 - Comunicação e Dinamização de Grupos (16h)",
                "Módulo 4 - Avaliação das Aprendizagens (8h)",
                "Módulo 5 - Elaboração do Portefólio (8h)",
              ].map((line, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </Card>

        {/* Formandos table */}
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Lista de Formandos</p>
            {activa
              ? <NewBtn label="Adicionar" onClick={() => setAddFormando(true)} />
              : <button disabled title="Turma inativa - não aceita novas inscrições" className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-200 text-slate-400 text-sm font-semibold rounded-lg cursor-not-allowed">Adicionar</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Nome</Th><Th>Contacto</Th><Th>Inscrito a</Th><Th className="text-center">Pago</Th><Th>Método</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {membros.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Ainda sem formandos nesta turma.</td></tr>
                )}
                {membros.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <Td>
                      <button onClick={() => setFichaOpen(f)} className="text-left">
                        <p className="text-xs font-semibold text-blue-600 hover:text-blue-800">{f.nome} {f.apelido}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[140px]">{f.email}</p>
                      </button>
                    </Td>
                    <Td className="font-mono text-xs text-slate-500">{f.telf}</Td>
                    <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{f.inscrito.slice(0, 10)}</Td>
                    <Td className="text-center">
                      <span className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-white ${f.pago ? "bg-emerald-500" : "bg-slate-200"}`}>
                        {f.pago ? I.check : ""}
                      </span>
                    </Td>
                    <Td className="text-xs text-slate-600">{f.metodo}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <ActBtn icon={I.eye} label="Ver" onClick={() => setFichaOpen(f)} />
                        <ActBtn icon={I.transfer} label="Transferir de turma" color="purple" onClick={() => setTransferirFormando(f)} />
                        <ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagarFormando(f)} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormadoresAtribuidosCard
            sessoes={turma.cronograma}
            fallback={turma.formador}
            onOpen={setFormadorOpen}
          />
          <Card className="p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Próximas Sessões</p>
            <div className="space-y-2">
              {(turma.cronograma.length ? turma.cronograma : []).filter(s => s.data >= "2026-09-06").slice(0, 3).map((s, i) => (
                <div key={s.id ?? i} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-slate-600">{formatSessaoLine(s)}</span>
                </div>
              ))}
              {turma.cronograma.filter(s => s.data >= "2026-09-06").length === 0 && (
                <p className="text-xs text-slate-400">Sem sessões futuras. Edite o cronograma da turma.</p>
              )}
            </div>
          </Card>
        </div>
        </>}
      </div>

      <SlideOver open={!!fichaOpen} onClose={() => setFichaOpen(null)} title="Ficha do Formando" sub={fichaOpen ? `#${fichaOpen.id}` : ""} size="lg">
        {fichaOpen && <FichaFormando formando={fichaOpen} onClose={() => setFichaOpen(null)} initialTab="documentos" />}
      </SlideOver>
      <ConfirmEliminarFormandoModal
        open={!!apagarFormando}
        onClose={() => setApagarFormando(null)}
        nome={apagarFormando ? `${apagarFormando.nome} ${apagarFormando.apelido}` : ""}
        turma={turma.nome}
        onConfirm={() => {
          if (!apagarFormando) return;
          removeFormandoTurma(apagarFormando.id);
          patchGold(turma.id, { totalAlunos: Math.max(0, turma.totalAlunos - 1) });
          if (fichaOpen?.id === apagarFormando.id) setFichaOpen(null);
        }}
      />
      <TransferirTurmaModal
        open={!!transferirFormando}
        onClose={() => setTransferirFormando(null)}
        nome={transferirFormando ? `${transferirFormando.nome} ${transferirFormando.apelido}` : ""}
        turmaAtual={turma.nome}
        destinos={gold.filter(t => t.id !== turma.id).map(t => ({
          id: t.id, nome: t.nome, curso: t.curso, horario: t.horario, local: t.local,
          ocupadas: t.totalAlunos, vagas: t.vagas, activa: isTurmaActiva(t),
        }))}
        onTransfer={dest => {
          if (!transferirFormando) return;
          patchFormandoTurma(transferirFormando.id, {
            turma: dest.nome, turmaId: dest.id, curso: dest.curso, local: dest.local,
          });
          patchGold(turma.id, { totalAlunos: Math.max(0, turma.totalAlunos - 1) });
          patchGold(dest.id, { totalAlunos: dest.ocupadas + 1 });
          if (fichaOpen?.id === transferirFormando.id) setFichaOpen(null);
        }}
      />
      <PlanoSessaoModal
        open={!!planoSessao}
        onClose={() => setPlanoSessao(null)}
        sessao={planoSessao ?? undefined}
        plano={planoSessao ? (planos[planoSessao.n] ?? emptyPlano()) : emptyPlano()}
        onSave={data => { if (planoSessao) setPlanos(prev => ({ ...prev, [planoSessao.n]: data })); }}
      />
      <SumarioSessaoModal
        open={!!sumarioSessao}
        onClose={() => setSumarioSessao(null)}
        sessao={sumarioSessao ?? undefined}
        sumario={sumarioSessao ? (sumarios[sumarioSessao.n] ?? emptySumario()) : emptySumario()}
        onSave={data => { if (sumarioSessao) setSumarios(prev => ({ ...prev, [sumarioSessao.n]: data })); }}
      />
      <PresencasSessaoModal
        open={!!presencasSession}
        onClose={() => setPresencasSession(null)}
        sessao={presencasSession ?? undefined}
        formandos={nomesCockpit}
        onSave={rows => { if (presencasSession) setPresencasBySessao(p => ({ ...p, [presencasSession.n]: rows })); }}
      />
      <FileUploadModal open={uploadCert !== null} onClose={() => setUploadCert(null)} title="Carregar certificado"
        onConfirm={() => { if (uploadCert != null) setCertsIssued(p => ({ ...p, [uploadCert]: true })); }} />
      <FormadorProfileSlideOver open={!!formadorOpen} onClose={() => setFormadorOpen(null)} nome={formadorOpen ?? ""} />
      <SlideOver open={novaSessao} onClose={() => setNovaSessao(false)} title="Nova sessão" sub={turma.nome}>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data"><input type="date" className={iCls} value={dataSessao} onChange={e => setDataSessao(e.target.value)} /></Field>
            <Field label="Hora início"><input type="time" className={iCls} value={horaSessao} onChange={e => setHoraSessao(e.target.value)} /></Field>
          </div>
          <Field label="Formadores">
            <MultiSearchSelect
              values={formadoresSessao}
              onChange={setFormadoresSessao}
              options={formadorOptsSessao}
              placeholder="Pesquisar formador…"
              noneLabel="Selecionar formadores…"
              unitSingular="formador"
              unitPlural="formadores"
            />
          </Field>
          <Field label="Módulos">
            <MultiSearchSelect
              values={moduloSessao}
              onChange={setModuloSessao}
              options={modulosOptsForCurso(turma.curso)}
              placeholder="Pesquisar módulo do curso…"
              noneLabel="Selecionar módulos…"
              unitSingular="módulo"
              unitPlural="módulos"
            />
          </Field>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setNovaSessao(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={() => {
              if (!dataSessao) return;
              const [h, m] = (horaSessao || "09:00").split(":").map(Number);
              const endH = String((h || 9) + 4).padStart(2, "0");
              setGoldCronograma(turma.id, [...turma.cronograma, {
                id: `s-manual-${Date.now()}`,
                data: dataSessao,
                horaInicio: horaSessao || "09:00",
                horaFim: `${endH}:${String(m || 0).padStart(2, "0")}`,
                modulos: moduloSessao,
                formadores: formadoresSessao,
              }]);
              setNovaSessao(false);
            }} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg">Criar sessão</button>
          </div>
        </div>
      </SlideOver>
      <SlideOver open={addFormando} onClose={() => setAddFormando(false)} title="Inscrever formando" sub={turma.nome}>
        <div className="p-5 space-y-3">
          {activa ? (
            <>
              <p className="text-xs text-slate-500">A turma está ativa e tem {Math.max(0, turma.vagas - turma.totalAlunos)} vagas. Só turmas ativas aceitam novas inscrições.</p>
              <Field label="Nome"><input className={iCls} value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome completo" /></Field>
              <Field label="Email"><input className={iCls} type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} /></Field>
              <Field label="Telemóvel"><input className={iCls} value={novoTelf} onChange={e => setNovoTelf(e.target.value)} /></Field>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setAddFormando(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
                <button disabled={!novoNome.trim() || vagasLivres <= 0} onClick={() => {
                  const { nome, apelido } = splitNome(novoNome);
                  addFormandoTurma({
                    id: nextListId(formandosTurmas),
                    nome, apelido: apelido || "-",
                    telf: novoTelf.trim() || "-",
                    email: novoEmail.trim() || `${nome.toLowerCase()}@mail.pt`,
                    inscrito: nowStamp(),
                    local: turma.local, curso: turma.curso, turma: turma.nome, turmaId: turma.id,
                    estado: "Formando", pago: false, valor: 125, metodo: "-",
                  });
                  patchGold(turma.id, { totalAlunos: turma.totalAlunos + 1 });
                  setAddFormando(false); setNovoNome(""); setNovoEmail(""); setNovoTelf("");
                }} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">Inscrever</button>
              </div>
            </>
          ) : (
            <TurmaInactivaBanner nome={turma.nome} onActivate={() => toggleGold(turma.id, true)} />
          )}
        </div>
      </SlideOver>
      <SlideOver open={editTurma} onClose={() => setEditTurma(false)} title={`Editar ${turma.nome}`} sub="Dados da turma Gold" size="lg">
        <div className="p-5 space-y-3">
          <Field label="Código interno"><input className={iCls} value={editNome} onChange={e => setEditNome(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Local"><SearchSelect value={editLocal} onChange={setEditLocal} options={locaisOpts} placeholder="Pesquisar local…" /></Field>
            <Field label="Horário"><SearchSelect value={editHorario} onChange={setEditHorario} options={horariosOpts} /></Field>
          </div>
          <Field label="Formador"><SearchSelect value={editFormador} onChange={setEditFormador} options={formadorOpts} placeholder="Pesquisar formador…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de início"><input type="date" className={iCls} value={editInicio} onChange={e => setEditInicio(e.target.value)} /></Field>
            <Field label="Vagas"><input type="number" className={iCls} value={editVagas} onChange={e => setEditVagas(Number(e.target.value) || 0)} /></Field>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setEditTurma(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={() => {
              patchGold(turma.id, { nome: editNome.trim() || turma.nome, local: editLocal, horario: editHorario, formador: editFormador, dataInicio: editInicio, vagas: editVagas });
              setEditTurma(false);
            }} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg">Guardar</button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}

function dtpPctGold(id: number) {
  const map: Record<number, number> = { 947: 72, 946: 61, 945: 40, 944: 55, 943: 48, 940: 68, 939: 52, 938: 58, 937: 91, 936: 88 };
  return map[id] ?? 50;
}
function dtpPctFin(id: number) {
  const map: Record<number, number> = { 222: 38, 220: 62, 219: 71, 218: 54, 217: 66 };
  return map[id] ?? 50;
}

function DtpTurmasPicker({ regime, onOpen }: { regime: "gold" | "fin"; onOpen: (id: number) => void }) {
  const { gold, fin } = useTurmas();
  const isGold = regime === "gold";
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroLocal, setFiltroLocal] = useState("");
  const all = isGold
    ? gold.map(t => ({ id: t.id, codigo: t.nome, curso: t.curso, local: t.local, extra: `${t.local} · ${t.horario}`, estado: t.estado, pct: dtpPctGold(t.id) }))
    : fin.map(t => ({ id: t.id, codigo: t.nome, curso: t.curso, local: t.local, extra: `UFCD ${t.ufcdCod} · ${t.formador}`, estado: isTurmaActiva(t) ? t.estado : "Inativa", pct: dtpPctFin(t.id) }));
  const rows = all.filter(t => matchesFilter(t.curso, filtroCurso) && (!isGold || matchesFilter(t.local, filtroLocal)));
  return (
    <div className="space-y-4">
      <PageHeader
        title={isGold ? "Dossiê TP - Gold" : "Dossiê TP - Financiada"}
        sub="Na ENA o DTP vive dentro da turma. O código interno (VNG-SM-07/09, UFCD 3564) identifica a turma - não é uma “ação” à parte."
      />
      <ViewFilters
        accent={isGold ? "gold" : "fin"}
        fields={[
          { label: "Curso", value: filtroCurso, onChange: setFiltroCurso, options: uniqueOpts(all.map(t => t.curso)) },
          ...(isGold ? [{ label: "Local", value: filtroLocal, onChange: setFiltroLocal, options: uniqueOpts(all.map(t => t.local)) }] : []),
        ]}
        onClear={() => { setFiltroCurso(""); setFiltroLocal(""); }}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Código interno</Th><Th>Curso</Th><Th>Detalhe</Th><Th>Estado</Th><Th>DTP</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td>
                    <button onClick={() => onOpen(t.id)} className="text-xs font-bold font-mono text-blue-600 hover:text-blue-800">{t.codigo}</button>
                  </Td>
                  <Td className="text-xs text-slate-600 max-w-[200px]">{t.curso}</Td>
                  <Td className="text-xs text-slate-500">{t.extra}</Td>
                  <Td>{estadoBadge(t.estado)}</Td>
                  <Td>
                    <div className="flex items-center gap-2 min-w-[110px]">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${t.pct}%`, backgroundColor: t.pct >= 80 ? "#10B981" : t.pct >= 50 ? (isGold ? "#F59E0B" : "#2563EB") : "#EF4444" }} />
                      </div>
                      <span className={`text-xs font-bold ${t.pct >= 80 ? "text-emerald-600" : t.pct >= 50 ? "text-amber-600" : "text-red-500"}`}>{t.pct}%</span>
                    </div>
                  </Td>
                  <Td>
                    <button onClick={() => onOpen(t.id)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white ${isGold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                      Abrir dossiê
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FinCockpitTurmaView({ turmaId, onBack, initialTab = "overview", onNavigate }: { turmaId?: number; onBack: () => void; initialTab?: CockpitTab; onNavigate?: (v: View | NavTarget) => void }) {
  const { fin, toggleFin, setFinCronograma, patchFin } = useTurmas();
  const { formandosFin, addFormandoFin, patchFormandoFin, removeFormandoFin } = useLists();
  const turma = fin.find(t => t.id === turmaId) ?? fin.find(t => t.ufcdCod === "3564") ?? fin[0];
  const activa = isTurmaActiva(turma);
  const sessoesTurma = turma.cronograma.length ? cronogramaToSessoes(turma.cronograma) : finSessoesSample;
  const [tab, setTab] = useState<CockpitTab>(initialTab);
  const [formadorOpen, setFormadorOpen] = useState<string | null>(null);
  const [uploadCert, setUploadCert] = useState<number | null>(null);
  const [certsIssued, setCertsIssued] = useState<Record<number, boolean>>({});
  const [planoSessao, setPlanoSessao] = useState<SessaoMeta | null>(null);
  const [planos, setPlanos] = useState<Record<number, PlanoSessaoData>>(defaultPlanos);
  const [sumarioSessao, setSumarioSessao] = useState<SessaoMeta | null>(null);
  const [sumarios, setSumarios] = useState<Record<number, SumarioSessaoData>>(defaultSumariosFin);
  const [presencasSession, setPresencasSession] = useState<SessaoMeta | null>(null);
  const [novaSessao, setNovaSessao] = useState(false);
  const [formadoresSessao, setFormadoresSessao] = useState<string[]>([]);
  const formadorOptsSessao = useFormadorOptions(formadoresSessao);
  const [moduloSessao, setModuloSessao] = useState<string[]>([]);
  const [dataSessao, setDataSessao] = useState("");
  const [horaSessao, setHoraSessao] = useState("19:00");
  const [docsOpen, setDocsOpen] = useState<FinFormando | null>(null);
  const [apagarFormando, setApagarFormando] = useState<FinFormando | null>(null);
  const [transferirFormando, setTransferirFormando] = useState<FinFormando | null>(null);
  const [addFormando, setAddFormando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoTelf, setNovoTelf] = useState("");
  const [editTurma, setEditTurma] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editCurso, setEditCurso] = useState("");
  const [editFormador, setEditFormador] = useState("");
  const [editLocal, setEditLocal] = useState("");
  const [editInicio, setEditInicio] = useState("");
  const formadorOpts = useFormadorOptions();
  useEffect(() => { setTab(initialTab); }, [initialTab, turmaId]);
  const membros = formandosFin.filter(f => {
    if (f.turma === turma.nome) return true;
    const noutra = fin.some(t => t.id !== turma.id && t.nome === f.turma);
    return !noutra && f.curso === turma.curso;
  });
  const listaFormandos = membros;
  const prontos = listaFormandos.filter(f => ["cc", "ch", "cu", "ci", "ce"].every(k => f[k as DocKey].ok)).length;
  const nomesCockpit = listaFormandos.map(f => ({ id: f.id, nome: `${f.nome} ${f.apelido}` }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button onClick={onBack} className="hover:text-blue-600 transition-colors">Turmas Financiadas</button>
        <span>›</span><span className="font-semibold text-slate-700">{turma.nome}</span>
      </div>
      <div className="bg-gradient-to-br from-[#0F172A] to-[#1E3A5F] rounded-2xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg">UFCD {turma.ufcdCod}</span>
              <span className="bg-white/10 text-white text-xs font-bold px-2.5 py-1 rounded-lg font-mono">{turma.nome}</span>
              {estadoBadge(turma.estado)}
              <TurmaActivaToggle compact light accent="fin" activa={activa} onChange={v => toggleFin(turma.id, v)} />
            </div>
            <p className="text-lg font-bold mt-1">{turma.curso}</p>
            <div className="flex flex-wrap gap-4 mt-2 text-slate-300 text-xs">
              <span className="flex items-center gap-1">{I.location} {turma.local}</span>
              <span className="flex items-center gap-1">{I.calendar} {turma.dataInicio}</span>
              <span className="flex items-center gap-1">{I.school} {turma.formador} · {turma.horas}h</span>
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button onClick={() => {
              setEditNome(turma.nome); setEditCurso(turma.curso); setEditFormador(turma.formador);
              setEditLocal(turma.local); setEditInicio(turma.dataInicio); setEditTurma(true);
            }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">Editar turma</button>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors">{I.download}</button>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">{turma.alunos} formandos · {prontos} com documentos prontos</span>
            <span className="text-blue-300">{turma.alunosTotal} vagas</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="h-2 rounded-full bg-blue-400" style={{ width: `${(turma.alunos / turma.alunosTotal) * 100}%` }} />
          </div>
        </div>
      </div>
      <TurmaTabBar tab={tab} onChange={setTab} accent="fin" dtpPct={dtpPctFin(turma.id)} />
      {!activa && <TurmaInactivaBanner nome={turma.nome} onActivate={() => toggleFin(turma.id, true)} />}
      {tab === "cronograma" && (
        <CronogramaEditor
          layout="page"
          accent="fin"
          sessoes={turma.cronograma}
          onChange={next => setFinCronograma(turma.id, next)}
          inicio={turma.dataInicio}
          horario={turma.horario}
          horas={turma.horas}
          formador={turma.formador}
          curso={turma.curso}
        />
      )}
      {tab === "dtp" && (
        <DtpPanel regime="fin" turma={{ codigo: turma.ufcdCod === "3564" ? "UFCD 3564 · T1" : turma.nome, id: turma.id, titulo: turma.curso, sub: `UFCD ${turma.ufcdCod} · ${turma.horas}h` }} />
      )}
      {tab === "sessoes" && (
        <SessoesTurmaTab
          accent="fin"
          turmaNome={turma.nome}
          sessoes={sessoesTurma}
          sumarios={sumarios}
          onNovaSessao={() => { setFormadoresSessao(turma.formador ? [turma.formador] : []); setModuloSessao([]); setNovaSessao(true); }}
          onPlano={setPlanoSessao}
          onSumario={setSumarioSessao}
          onPresencas={setPresencasSession}
          onOpenFormador={setFormadorOpen}
        />
      )}
      {tab === "documentos" && <DocumentosTurmaTab regime="fin" curso={turma.curso} />}
      {tab === "certificados" && <CertificadosTurmaTab formandos={nomesCockpit} issued={certsIssued} onUpload={id => setUploadCert(id)} />}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: "Código interno", v: turma.nome, c: "text-slate-800" },
              { l: "UFCD", v: turma.ufcdCod, c: "text-blue-600" },
              { l: "Formandos", v: `${turma.alunos}/${turma.alunosTotal}`, c: "text-slate-800" },
              { l: "Documentos prontos", v: `${prontos}/${turma.alunos}`, c: prontos === turma.alunos ? "text-emerald-600" : "text-amber-600" },
            ].map(s => (
              <Card key={s.l} className="p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{s.l}</p>
                <p className={`text-lg font-bold ${s.c} truncate`}>{s.v}</p>
              </Card>
            ))}
          </div>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Programa da UFCD</p>
              <button onClick={() => onNavigate?.("fin-cursos")} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800">{I.edit} Editar programa →</button>
            </div>
            <div className="space-y-2">
              {[
                `UFCD ${turma.ufcdCod} · ${turma.curso} (${turma.horas}h)`,
                "Sessões síncronas em sala virtual + trabalho na plataforma",
                "Assiduidade e avaliação contínua para certificado",
              ].map((line, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Lista de Formandos</p>
              {activa
                ? <NewBtn accent="fin" label="Adicionar" onClick={() => { setNovoNome(""); setNovoEmail(""); setNovoTelf(""); setAddFormando(true); }} />
                : <button disabled title="Turma inativa - não aceita novas inscrições" className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-200 text-slate-400 text-sm font-semibold rounded-lg cursor-not-allowed">Adicionar</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>Nome</Th><Th>Contacto</Th><Th>Turma</Th><Th>Estado</Th><Th>Documentos</Th><Th>Ações</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {listaFormandos.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Ainda sem formandos nesta turma.</td></tr>
                  )}
                  {listaFormandos.map(f => {
                    const keys: DocKey[] = ["cc", "ch", "cu", "ci", "ce"];
                    const okCount = keys.filter(k => f[k].ok).length;
                    const complete = okCount === 5;
                    return (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <Td>
                        <button type="button" onClick={() => setDocsOpen(f)} className="text-left">
                          <p className="text-xs font-semibold text-blue-600 hover:text-blue-800">{f.nome} {f.apelido}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[160px]">{f.email}</p>
                        </button>
                      </Td>
                      <Td className="font-mono text-xs text-slate-500">{f.telf}</Td>
                      <Td className="text-xs text-slate-600 whitespace-nowrap">{f.turma}</Td>
                      <Td>{estadoBadge(f.estado)}</Td>
                      <Td>
                        <button type="button" onClick={() => setDocsOpen(f)} title="CC · CH · CU · CI · CE"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${complete ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                          {complete ? "✓ Completos" : `${okCount}/5 · ${5 - okCount} em falta`}
                        </button>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          <ActBtn icon={I.eye} label="Ver" onClick={() => setDocsOpen(f)} />
                          <ActBtn icon={I.transfer} label="Transferir de turma" color="purple" onClick={() => setTransferirFormando(f)} />
                          <ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagarFormando(f)} />
                        </div>
                      </Td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormadoresAtribuidosCard
              sessoes={turma.cronograma}
              fallback={turma.formador}
              onOpen={setFormadorOpen}
            />
            <Card className="p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Próximas Sessões</p>
              <div className="space-y-2">
                {turma.cronograma.filter(s => s.data >= "2026-09-06").slice(0, 3).map((s, i) => (
                  <div key={s.id ?? i} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-slate-600">{formatSessaoLine(s)}</span>
                  </div>
                ))}
                {turma.cronograma.filter(s => s.data >= "2026-09-06").length === 0 && (
                  <p className="text-xs text-slate-400">Sem sessões futuras. Edite o cronograma da turma.</p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
      <PlanoSessaoModal
        open={!!planoSessao}
        onClose={() => setPlanoSessao(null)}
        sessao={planoSessao ?? undefined}
        plano={planoSessao ? (planos[planoSessao.n] ?? emptyPlano()) : emptyPlano()}
        onSave={data => { if (planoSessao) setPlanos(prev => ({ ...prev, [planoSessao.n]: data })); }}
      />
      <SumarioSessaoModal
        open={!!sumarioSessao}
        onClose={() => setSumarioSessao(null)}
        accent="fin"
        sessao={sumarioSessao ?? undefined}
        sumario={sumarioSessao ? (sumarios[sumarioSessao.n] ?? emptySumario()) : emptySumario()}
        onSave={data => { if (sumarioSessao) setSumarios(prev => ({ ...prev, [sumarioSessao.n]: data })); }}
      />
      <PresencasSessaoModal
        open={!!presencasSession}
        onClose={() => setPresencasSession(null)}
        sessao={presencasSession ?? undefined}
        formandos={nomesCockpit}
        onSave={() => setPresencasSession(null)}
      />
      <SlideOver open={!!docsOpen} onClose={() => setDocsOpen(null)} title="Ficha do Formando" sub={docsOpen ? `#${docsOpen.id}` : ""} size="lg">
        {docsOpen && <FichaFormandoFin formando={docsOpen} onClose={() => setDocsOpen(null)} />}
      </SlideOver>
      <ConfirmEliminarFormandoModal
        open={!!apagarFormando}
        onClose={() => setApagarFormando(null)}
        nome={apagarFormando ? `${apagarFormando.nome} ${apagarFormando.apelido}` : ""}
        turma={turma.nome}
        onConfirm={() => {
          if (!apagarFormando) return;
          removeFormandoFin(apagarFormando.id);
          patchFin(turma.id, { alunos: Math.max(0, turma.alunos - 1) });
          if (docsOpen?.id === apagarFormando.id) setDocsOpen(null);
        }}
      />
      <TransferirTurmaModal
        open={!!transferirFormando}
        onClose={() => setTransferirFormando(null)}
        nome={transferirFormando ? `${transferirFormando.nome} ${transferirFormando.apelido}` : ""}
        turmaAtual={turma.nome}
        accent="fin"
        destinos={fin.filter(t => t.id !== turma.id).map(t => ({
          id: t.id, nome: t.nome, curso: t.curso, horario: t.horario, local: t.local,
          ocupadas: t.alunos, vagas: t.alunosTotal, activa: isTurmaActiva(t),
        }))}
        onTransfer={dest => {
          if (!transferirFormando) return;
          patchFormandoFin(transferirFormando.id, { turma: dest.nome, curso: dest.curso });
          patchFin(turma.id, { alunos: Math.max(0, turma.alunos - 1) });
          patchFin(dest.id, { alunos: dest.ocupadas + 1 });
          if (docsOpen?.id === transferirFormando.id) setDocsOpen(null);
        }}
      />
      <FormadorProfileSlideOver open={!!formadorOpen} onClose={() => setFormadorOpen(null)} nome={formadorOpen ?? turma.formador} />
      <FileUploadModal open={uploadCert !== null} onClose={() => setUploadCert(null)} title="Carregar certificado" accent="fin"
        onConfirm={() => { if (uploadCert != null) setCertsIssued(p => ({ ...p, [uploadCert]: true })); }} />
      <SlideOver open={addFormando} onClose={() => setAddFormando(false)} title="Inscrever formando" sub={turma.nome}>
        <div className="p-5 space-y-3">
          {activa ? (
            <>
              <p className="text-xs text-slate-500">A turma tem {Math.max(0, turma.alunosTotal - turma.alunos)} vagas.</p>
              <Field label="Nome"><input className={iCls} value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome completo" /></Field>
              <Field label="Email"><input className={iCls} type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} /></Field>
              <Field label="Telemóvel"><input className={iCls} value={novoTelf} onChange={e => setNovoTelf(e.target.value)} /></Field>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setAddFormando(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
                <button disabled={!novoNome.trim()} onClick={() => {
                  const { nome, apelido } = splitNome(novoNome);
                  addFormandoFin({
                    id: nextListId(formandosFin),
                    nome, apelido: apelido || "-",
                    turma: turma.nome, telf: novoTelf.trim() || "-",
                    email: novoEmail.trim() || `${nome.toLowerCase()}@mail.pt`,
                    curso: turma.curso, estado: "Elegível",
                    ...emptyFinDocs(),
                  });
                  patchFin(turma.id, { alunos: turma.alunos + 1 });
                  setAddFormando(false);
                }} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">Inscrever</button>
              </div>
            </>
          ) : (
            <TurmaInactivaBanner nome={turma.nome} onActivate={() => toggleFin(turma.id, true)} />
          )}
        </div>
      </SlideOver>
      <SlideOver open={editTurma} onClose={() => setEditTurma(false)} title={`Editar ${turma.nome}`} sub="Dados da turma financiada" size="lg">
        <div className="p-5 space-y-3">
          <Field label="Código da turma"><input className={iCls} value={editNome} onChange={e => setEditNome(e.target.value)} /></Field>
          <Field label="Curso / UFCD"><SearchSelect value={editCurso} onChange={setEditCurso} options={cursosFinOpts} placeholder="Pesquisar UFCD…" /></Field>
          <Field label="Formador"><SearchSelect value={editFormador} onChange={setEditFormador} options={formadorOpts} placeholder="Pesquisar formador…" /></Field>
          <Field label="Local"><SearchSelect value={editLocal} onChange={setEditLocal} options={locaisOpts} placeholder="Pesquisar local…" /></Field>
          <Field label="Data de início"><input type="date" className={iCls} value={editInicio} onChange={e => setEditInicio(e.target.value)} /></Field>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setEditTurma(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={() => {
              patchFin(turma.id, { nome: editNome.trim() || turma.nome, curso: editCurso, formador: editFormador, local: editLocal, dataInicio: editInicio });
              setEditTurma(false);
            }} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg">Guardar</button>
          </div>
        </div>
      </SlideOver>
      <SlideOver open={novaSessao} onClose={() => setNovaSessao(false)} title="Nova sessão" sub={turma.nome}>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data"><input type="date" className={iCls} value={dataSessao} onChange={e => setDataSessao(e.target.value)} /></Field>
            <Field label="Hora início"><input type="time" className={iCls} value={horaSessao} onChange={e => setHoraSessao(e.target.value)} /></Field>
          </div>
          <Field label="Formadores">
            <MultiSearchSelect
              values={formadoresSessao}
              onChange={setFormadoresSessao}
              options={formadorOptsSessao}
              placeholder="Pesquisar formador…"
              noneLabel="Selecionar formadores…"
              unitSingular="formador"
              unitPlural="formadores"
            />
          </Field>
          <Field label="Módulos">
            <MultiSearchSelect
              values={moduloSessao}
              onChange={setModuloSessao}
              options={modulosOptsForCurso(turma.curso)}
              placeholder="Pesquisar módulo do curso…"
              noneLabel="Selecionar módulos…"
              unitSingular="módulo"
              unitPlural="módulos"
            />
          </Field>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setNovaSessao(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={() => {
              if (!dataSessao) return;
              const [h, m] = (horaSessao || "19:00").split(":").map(Number);
              const endH = String((h || 19) + 3).padStart(2, "0");
              setFinCronograma(turma.id, [...turma.cronograma, {
                id: `s-manual-${Date.now()}`,
                data: dataSessao,
                horaInicio: horaSessao || "19:00",
                horaFim: `${endH}:${String(m || 0).padStart(2, "0")}`,
                modulos: moduloSessao,
                formadores: formadoresSessao,
              }]);
              setNovaSessao(false);
            }} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg">Criar sessão</button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

// ─── Kanban Pré-inscrições Gold ───────────────────────────────────────────────

const kanbanCols = [
  { id: "Não contactado", label: "Não contactado", color: "border-amber-400 bg-amber-50", dot: "bg-amber-400" },
  { id: "1º Contacto", label: "1.º Contacto", color: "border-blue-400 bg-blue-50", dot: "bg-blue-400" },
  { id: "2º Contacto", label: "2.º Contacto", color: "border-indigo-400 bg-indigo-50", dot: "bg-indigo-400" },
  { id: "Pago", label: "Pago", color: "border-teal-400 bg-teal-50", dot: "bg-teal-400" },
  { id: "Formando", label: "Formando ✓", color: "border-emerald-400 bg-emerald-50", dot: "bg-emerald-400" },
];

function KanbanCard({ item, onClick }: { item: Preinscricao; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-sm p-3 hover:shadow-md hover:border-amber-300 transition-all">
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-bold text-slate-800 leading-snug">{item.nome} {item.apelido}</p>
        <span className="text-xs font-bold text-amber-600 whitespace-nowrap">€{item.preco}</span>
      </div>
      <p className="text-xs text-slate-500 mt-0.5 truncate">{item.curso}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-blue-600 font-medium">{item.local}</span>
        <span className="text-xs text-slate-400">{item.inscrito.slice(5, 10)}</span>
      </div>
      <div className="flex gap-2 mt-2">
        <a href={`tel:${item.telf}`} onClick={e => e.stopPropagation()} className="flex-1 py-1 text-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1">{I.phone}</a>
        <a href={`https://wa.me/351${item.telf}`} onClick={e => e.stopPropagation()} className="flex-1 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1">{I.whatsapp}</a>
      </div>
    </button>
  );
}

function KanbanBoard({ onCardClick, visible, items, onMove }: {
  onCardClick: (item: Preinscricao) => void;
  visible?: (item: Preinscricao) => boolean;
  items: Preinscricao[];
  onMove: (id: number, estado: string) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  function onDragStart(id: number) { setDragId(id); }
  function onDrop(col: string) {
    if (dragId === null) return;
    onMove(dragId, col);
    setDragId(null); setDragOver(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
      {kanbanCols.map(col => {
        const colItems = items.filter(i => i.estado === col.id && (visible ? visible(i) : true));
        return (
          <div key={col.id}
            className={`flex-shrink-0 w-64 rounded-xl border-t-4 ${col.color} ${dragOver === col.id ? "ring-2 ring-amber-400" : ""} transition-all`}
            onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => onDrop(col.id)}
          >
            <div className="px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-xs font-bold text-slate-700">{col.label}</span>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded-full">{colItems.length}</span>
            </div>
            <div className="px-2 pb-2 space-y-2">
              {colItems.map(item => (
                <div key={item.id} draggable onDragStart={() => onDragStart(item.id)}>
                  <KanbanCard item={item} onClick={() => onCardClick(item)} />
                </div>
              ))}
              {colItems.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">Arrasta cartões aqui</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal Ficha Comercial (pré-inscrição) ────────────────────────────────────

function FichaComercial({ item, open, onClose, onConvert }: { item: Preinscricao | null; open: boolean; onClose: () => void; onConvert?: (turma: string) => void }) {
  const { gold } = useTurmas();
  const [notas, setNotas] = useState("Ligou a perguntar sobre horários. Interessada em Sábado manhã.");
  const [proximoContacto, setProximoContacto] = useState("2026-09-06");
  const [escolherTurma, setEscolherTurma] = useState(false);
  const [turmaConv, setTurmaConv] = useState("");
  const [convMsg, setConvMsg] = useState("");
  useEffect(() => {
    setEscolherTurma(false);
    setTurmaConv("");
    setConvMsg("");
  }, [item?.id, open]);
  if (!item) return null;
  const turmaOpts = turmaGoldOpts(gold, { curso: item.curso });
  return (
    <Modal open={open} onClose={onClose} title={`${item.nome} ${item.apelido}`}>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">{item.nome[0]}{item.apelido[0]}</div>
          <div>
            <p className="text-xs text-slate-500">{item.email} · {item.telf}</p>
            <p className="text-xs text-slate-500 mt-0.5">Origem: <strong>{item.origem}</strong> · Campanha: <strong>{item.campanha}</strong></p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-400">Curso</p><p className="font-semibold text-slate-700 mt-0.5">{item.curso}</p></div>
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-400">Local / Início</p><p className="font-semibold text-slate-700 mt-0.5">{item.local}</p></div>
          <div className="bg-amber-50 rounded-xl p-3"><p className="text-amber-600">Valor</p><p className="font-bold text-amber-700 mt-0.5 text-base">€ {item.preco}</p></div>
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-400">Estado</p><div className="mt-0.5">{estadoBadge(item.estado)}</div></div>
        </div>
        <Field label="Próximo contacto">
          <input type="date" value={proximoContacto} onChange={e => setProximoContacto(e.target.value)} className={iCls} />
        </Field>
        <Field label="Notas da chamada">
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3} className={`${iCls} resize-none`} />
        </Field>
        <div className="flex gap-2">
          <a href={`tel:${item.telf}`} className="flex-1 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 hover:bg-slate-700 transition-colors">{I.phone} Ligar</a>
          <a href={`https://wa.me/351${item.telf}`} className="flex-1 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors">{I.whatsapp} WhatsApp</a>
        </div>
        {!escolherTurma ? (
          <button onClick={() => { setEscolherTurma(true); setConvMsg(""); }} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2">{I.convert} Converter em Formando - Escolher turma</button>
        ) : (
          <div className="space-y-2">
            <Field label="Turma ativa">
              <SearchSelect value={turmaConv} onChange={setTurmaConv} options={turmaOpts} placeholder="Só turmas ativas…" empty="Não há turmas ativas para este curso." />
            </Field>
            <TurmaInscricaoHint optsLen={turmaOpts.length} curso={item.curso} />
            {convMsg && <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{convMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => setEscolherTurma(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button
                disabled={!turmaConv}
                onClick={() => {
                  onConvert?.(turmaConv);
                  setConvMsg(`${item.nome} ${item.apelido} inscrita na turma ${turmaConv}.`);
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg"
              >
                Confirmar inscrição
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Documentos Financiada (CC, CH, CU, CI, CE) ───────────────────────────────

type FinFormando = FormandoFin;
type DocKey = "cc" | "ch" | "cu" | "ci" | "ce";
const docLabels: Record<DocKey, string> = {
  cc: "Cartão de Cidadão", ch: "Certif. Habilitações", cu: "Curriculum Vitae", ci: "IBAN / Certif. Emprego", ce: "Comp. Emprego",
};

function DocumentosFinPanel({ formando }: { formando: FinFormando }) {
  const { formandosFin, patchFormandoFin } = useLists();
  const live = formandosFin.find(f => f.id === formando.id) ?? formando;
  const [docs, setDocs] = useState(live);
  useEffect(() => { setDocs(live); }, [live]);
  const keys: DocKey[] = ["cc", "ch", "cu", "ci", "ce"];
  const completo = keys.every(k => docs[k].ok);
  function toggleDoc(k: DocKey) {
    const next = { ...docs, [k]: { ok: !docs[k].ok, data: !docs[k].ok ? new Date().toISOString().slice(0, 10) : "" } };
    setDocs(next);
    patchFormandoFin(docs.id, { [k]: next[k] });
  }

  return (
    <div className="p-5 space-y-5">
      {/* Status banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${completo ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${completo ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
          {completo ? I.check : I.warn}
        </div>
        <div>
          <p className={`text-sm font-bold ${completo ? "text-emerald-700" : "text-amber-700"}`}>
            {completo ? "Documentos completos" : `${keys.filter(k => !docs[k].ok).length} documentos em falta`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{docs.nome} {docs.apelido} · {docs.curso}</p>
        </div>
      </div>

      {/* Doc checklist */}
      <div className="space-y-2">
        {keys.map(k => (
          <div key={k} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${docs[k].ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <button onClick={() => toggleDoc(k)}
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${docs[k].ok ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-red-300"}`}>
              {docs[k].ok && I.check}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${docs[k].ok ? "text-emerald-700" : "text-red-600"}`}>{docLabels[k]}</p>
              {docs[k].ok && docs[k].data && <p className="text-xs text-slate-400 mt-0.5">Validado em {docs[k].data}</p>}
              {!docs[k].ok && <p className="text-xs text-red-400 mt-0.5">Em falta</p>}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{k.toUpperCase()}</span>
          </div>
        ))}
      </div>

      <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors">Enviar lembrete de documentos</button>
    </div>
  );
}

function FichaFormandoFin({ formando, onClose }: { formando: FormandoFin; onClose: () => void }) {
  const [tab, setTab] = useState<"info" | "documentos">("documentos");
  const { formandosFin } = useLists();
  const live = formandosFin.find(f => f.id === formando.id) ?? formando;
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b bg-blue-50 border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 bg-blue-600">
            {live.nome[0]}{live.apelido[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800">{live.nome} {live.apelido}</p>
            <p className="text-xs text-slate-500 truncate">{live.email}</p>
            <div className="flex items-center gap-2 mt-1">{estadoBadge(live.estado)}<span className="text-xs text-slate-400">{live.turma}</span></div>
          </div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <a href={`tel:${live.telf}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">{I.phone} {live.telf}</a>
          <a href={`mailto:${live.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white hover:bg-blue-700">{I.mail} Email</a>
        </div>
      </div>
      <div className="flex border-b border-slate-100 px-5 bg-white flex-shrink-0">
        {(["info", "documentos"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px ${tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "info" ? "Informação" : "Documentos"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "info" && (
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { l: "Curso", v: live.curso },
              { l: "Turma", v: live.turma },
              { l: "Telemóvel", v: live.telf },
              { l: "Email", v: live.email },
              { l: "Estado", v: live.estado },
            ].map(f => (
              <div key={f.l} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{f.l}</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5 break-all">{f.v}</p>
              </div>
            ))}
          </div>
        )}
        {tab === "documentos" && <DocumentosFinPanel formando={live} />}
      </div>
      <div className="flex-shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Fechar</button>
      </div>
    </div>
  );
}

// ─── Painel ───────────────────────────────────────────────────────────────────

function PainelView({ onNavigate }: { onNavigate: (v: View | NavTarget) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: "Pré-inscritos", value: "16 537", sub: "+124 esta semana", color: "text-blue-600", bg: "bg-blue-50", icon: I.clipboard, view: "gold-preinscricoes" as View },
          { label: "Formandos Ativos", value: "6 505", sub: "+38 este mês", color: "text-emerald-600", bg: "bg-emerald-50", icon: I.users, view: "gold-formandos-turmas" as View },
          { label: "Turmas ativas", value: "13", sub: "167 total", color: "text-violet-600", bg: "bg-violet-50", icon: I.school, view: "gold-turmas" as View },
          { label: "Cursos Ativos", value: "8", sub: "3 Gold · 5 Financiados", color: "text-amber-600", bg: "bg-amber-50", icon: I.book, view: "gold-cursos" as View },
        ].map(s => (
          <Card key={s.label} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
            </div>
            <p className={`text-2xl font-bold ${s.color} leading-none`}>{s.value}</p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-slate-400">{s.sub}</p>
              <button onClick={() => onNavigate(s.view)} className="text-xs font-semibold text-slate-400 hover:text-amber-600 transition-colors">Ver →</button>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: "Receita Total", value: "€ 304 680", sub: "Desde o início", c: "text-slate-800" },
          { label: "Receita Este Mês", value: "€ 35 200", sub: "+32% vs mês anterior", c: "text-emerald-600" },
          { label: "Ticket Médio", value: "€ 127", sub: "Por formando ativo", c: "text-blue-600" },
          { label: "Pagamentos Pendentes", value: "€ 8 400", sub: "67 transações", c: "text-amber-600" },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div><p className="text-sm font-semibold text-slate-700">Receita Mensal</p><p className="text-xs text-slate-400">Últimos 12 meses</p></div>
            <span className="text-sm font-bold text-emerald-600">€ 339 190</span>
          </div>
          <MiniBarChart data={receitaMensal} color="#F59E0B" />
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Funil de Conversão</p>
          <div className="space-y-2">
            {[
              { l: "Pré-inscritos", v: 16537, pct: 100, c: "#94A3B8" },
              { l: "Contactados", v: 10800, pct: 65, c: "#60A5FA" },
              { l: "Pagaram", v: 6379, pct: 39, c: "#F59E0B" },
              { l: "Formandos", v: 6505, pct: 39, c: "#10B981" },
            ].map(f => (
              <div key={f.l}>
                <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-600">{f.l}</span><span className="font-semibold text-slate-700">{f.v.toLocaleString("pt-PT")}</span></div>
                <div className="w-full bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ width: `${f.pct}%`, backgroundColor: f.c }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <ConhecimentoEnaCard onVerMais={() => onNavigate("gold-preinscricoes")} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Métodos de Pagamento</p>
          <div className="space-y-3">
            {metodosPagamento.map(m => (
              <div key={m.metodo}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">{m.metodo}</span>
                  <div className="flex gap-2"><span className="text-xs text-slate-500">€{(m.valor / 1000).toFixed(0)}k</span><span className="text-xs font-bold text-slate-700 w-8 text-right">{m.pct}%</span></div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ width: `${m.pct}%`, backgroundColor: m.color }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Top Cursos</p>
          <div className="space-y-2.5">
            {topCursos.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{c.nome}</p>
                  <p className="text-xs text-slate-400">{c.inscritos.toLocaleString("pt-PT")} inscritos · €{(c.receita / 1000).toFixed(0)}k</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-emerald-600">{c.taxa}%</p>
                  <p className="text-xs text-slate-400">conversão</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── PreInscricoes Gold (tabela + kanban) ─────────────────────────────────────

function PreInscricoesGoldView() {
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [filtro, setFiltro] = useState("Todos");
  const [fichaItem, setFichaItem] = useState<Preinscricao | null>(null);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [novo, setNovo] = useState(false);
  const [editLead, setEditLead] = useState<Preinscricao | null>(null);
  const { gold, patchGold } = useTurmas();
  const { preinscricoes, addPreinscricao, patchPreinscricao, removePreinscricao, addFormandoTurma, formandosTurmas, cursosGold } = useLists();
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [telf, setTelf] = useState("");
  const [curso, setCurso] = useState("");
  const [turma, setTurma] = useState("");
  const [local, setLocal] = useState("");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroLocal, setFiltroLocal] = useState("");
  const turmaOpts = turmaGoldOpts(gold, { curso: curso || undefined });

  function openFicha(item: Preinscricao) { setFichaItem(item); setFichaOpen(true); }
  function resetLeadForm(lead?: Preinscricao) {
    setNome(lead?.nome ?? "");
    setApelido(lead?.apelido ?? "");
    setEmail(lead?.email ?? "");
    setTelf(lead?.telf ?? "");
    setCurso(lead?.curso ?? "Formação de Formadores - CCP");
    setLocal(lead?.local ?? "V.N.Gaia");
    setTurma(turmaGoldOpts(gold, { curso: lead?.curso ?? "Formação de Formadores - CCP" })[0]?.value ?? "");
  }

  const matchRow = (x: Preinscricao) =>
    matchesFilter(x.curso, filtroCurso) && matchesFilter(x.local, filtroLocal);

  const f = preinscricoes.filter(x => {
    const q = `${x.nome} ${x.apelido} ${x.email} ${x.curso}`.toLowerCase().includes(s.toLowerCase());
    return q && matchRow(x) && (filtro === "Todos" || x.estado === filtro);
  });
  const rows = f.slice((p - 1) * pp, p * pp);

  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Pré-Inscrições Gold" sub={`${preinscricoes.length} pré-inscrições`}
          action={
            <div className="flex items-center gap-2">
              <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
                <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${viewMode === "table" ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{I.list} Lista</button>
                <button onClick={() => setViewMode("kanban")} className={`px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${viewMode === "kanban" ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{I.kanban} Kanban</button>
              </div>
              <NewBtn label="+ Nova" onClick={() => {
                setEditLead(null);
                resetLeadForm();
                setNovo(true);
              }} />
            </div>
          }
        />
        <ViewFilters
          fields={[
            { label: "Curso", value: filtroCurso, onChange: v => { setFiltroCurso(v); setP(1); }, options: uniqueOpts(preinscricoes.map(x => x.curso)) },
            { label: "Local", value: filtroLocal, onChange: v => { setFiltroLocal(v); setP(1); }, options: uniqueOpts(preinscricoes.map(x => x.local)) },
          ]}
          chips={viewMode === "table" ? { options: ["Todos", "Não contactado", "1º Contacto", "2º Contacto", "Pago", "Formando"], value: filtro, onChange: v => { setFiltro(v); setP(1); } } : undefined}
          onClear={() => { setFiltroCurso(""); setFiltroLocal(""); setFiltro("Todos"); setP(1); }}
        />

        {viewMode === "kanban" ? (
          <KanbanBoard items={preinscricoes} onMove={(id, estado) => patchPreinscricao(id, { estado })} onCardClick={openFicha} visible={matchRow} />
        ) : (
          <Card>
            <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>Id</Th><Th>Inscrito a</Th><Th>Nome</Th><Th>Curso</Th><Th>Local</Th><Th>Valor</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <Td><IdCell id={r.id} /></Td>
                      <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{r.inscrito}</Td>
                      <Td>
                        <button onClick={() => openFicha(r)} className="text-left">
                          <p className="text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap">{r.nome} {r.apelido}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[120px]">{r.email}</p>
                        </button>
                      </Td>
                      <Td className="text-xs text-slate-600 max-w-[130px]">{r.curso}</Td>
                      <Td className="text-xs text-slate-600 whitespace-nowrap">{r.local}</Td>
                      <Td className="text-xs font-bold text-amber-600">€ {r.preco}</Td>
                      <Td>{estadoBadge(r.estado)}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <ActBtn icon={I.eye} label="Ficha comercial" onClick={() => openFicha(r)} />
                          <ActBtn icon={I.edit} label="Editar" onClick={() => { setEditLead(r); resetLeadForm(r); setNovo(true); }} />
                          <ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => removePreinscricao(r.id)} />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
          </Card>
        )}
      </div>
      <FichaComercial item={fichaItem} open={fichaOpen} onClose={() => setFichaOpen(false)} onConvert={turmaNome => {
        if (!fichaItem) return;
        const t = gold.find(x => x.nome === turmaNome);
        if (!t || t.vagas - t.totalAlunos <= 0) return;
        addFormandoTurma({
          id: nextListId(formandosTurmas),
          nome: fichaItem.nome, apelido: fichaItem.apelido, telf: fichaItem.telf, email: fichaItem.email,
          inscrito: nowStamp(), local: t.local, curso: t.curso, turma: t.nome, turmaId: t.id,
          estado: "Formando", pago: false, valor: fichaItem.preco, metodo: "-",
        });
        patchGold(t.id, { totalAlunos: t.totalAlunos + 1 });
        patchPreinscricao(fichaItem.id, { estado: "Formando" });
        setFichaItem({ ...fichaItem, estado: "Formando" });
      }} />
      <SlideOver open={novo} onClose={() => { setNovo(false); setEditLead(null); }} title={editLead ? `Editar ${editLead.nome}` : "Nova pré-inscrição"} sub="Lead comercial Gold">
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} /></Field>
            <Field label="Apelido"><input className={iCls} value={apelido} onChange={e => setApelido(e.target.value)} /></Field>
          </div>
          <Field label="Email"><input className={iCls} type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Telemóvel"><input className={iCls} value={telf} onChange={e => setTelf(e.target.value)} /></Field>
          <Field label="Curso"><SearchSelect value={curso} onChange={v => { setCurso(v); setTurma(""); }} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <Field label="Turma">
            <SearchSelect value={turma} onChange={setTurma} options={turmaOpts} placeholder="Só turmas ativas…" empty="Não há turmas ativas para este curso." />
          </Field>
          <TurmaInscricaoHint optsLen={turmaOpts.length} curso={curso || undefined} />
          <Field label="Local"><SearchSelect value={local} onChange={setLocal} options={locaisOpts} placeholder="Pesquisar local…" /></Field>
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setNovo(false); setEditLead(null); }} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button disabled={!nome.trim()} onClick={() => {
              const cursoRow = cursosGold.find(c => c.nome === curso);
              const t = gold.find(x => x.nome === turma);
              const row: Preinscricao = {
                id: editLead?.id ?? nextListId(preinscricoes),
                inscrito: editLead?.inscrito ?? nowStamp(),
                nome: nome.trim(), apelido: apelido.trim(),
                email: email.trim() || `${nome.trim().toLowerCase().replace(/\s+/g, ".")}@mail.pt`,
                telf: telf.trim() || "-",
                inicioCurso: t?.dataInicio ?? editLead?.inicioCurso ?? "-",
                concelho: editLead?.concelho ?? "",
                local: local || t?.local || "V.N.Gaia",
                curso: curso || "Formação de Formadores - CCP",
                preco: cursoRow?.preco ?? editLead?.preco ?? 125,
                estado: editLead?.estado ?? "Não contactado",
                campanha: editLead?.campanha ?? "Setembro 2026",
                origem: editLead?.origem ?? "Manual",
              };
              if (editLead) patchPreinscricao(editLead.id, row);
              else addPreinscricao(row);
              setNovo(false); setEditLead(null);
            }} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">{editLead ? "Guardar" : "Criar lead"}</button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}

// ─── Turmas Gold ──────────────────────────────────────────────────────────────

function TurmasGoldView({ onCockpit }: { onCockpit: (id: number) => void }) {
  const { gold, patchGold, addGold, removeGold, toggleGold } = useTurmas();
  const formadorOpts = useFormadorOptions();
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [filtro, setFiltro] = useState("Todos");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroLocal, setFiltroLocal] = useState("");
  const [open, setOpen] = useState<TurmaGold | "new" | null>(null);
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("Formação de Formadores - CCP");
  const [local, setLocal] = useState("");
  const [horario, setHorario] = useState("");
  const [formador, setFormador] = useState("Isac Silva");
  const [dataInicio, setDataInicio] = useState("");
  const [vagas, setVagas] = useState(16);
  const [activa, setActiva] = useState(true);
  const [cronograma, setCronograma] = useState<SessaoCronograma[]>([]);
  const editing = open && open !== "new" ? open : null;
  const ativas = gold.filter(t => isTurmaActiva(t)).length;
  const f = gold.filter(t => {
    const q = `${t.nome} ${t.local} ${t.curso}`.toLowerCase().includes(s.toLowerCase());
    return q && matchesFilter(t.curso, filtroCurso) && matchesFilter(t.local, filtroLocal) && (filtro === "Todos" || t.estado === filtro);
  });
  const rows = f.slice((p - 1) * pp, p * pp);
  const horasCurso = cursosGoldData.find(c => c.nome === curso)?.horas ?? 90;
  useEffect(() => {
    if (open) {
      setNome(editing?.nome ?? "");
      setCurso(editing?.curso ?? "Formação de Formadores - CCP");
      setLocal(editing?.local ?? "");
      setHorario(editing?.horario ?? "");
      setFormador(editing?.formador ?? "Isac Silva");
      setDataInicio(editing?.dataInicio ?? "");
      setVagas(editing?.vagas ?? 16);
      setActiva(editing ? isTurmaActiva(editing) : true);
      setCronograma(editing?.cronograma ?? []);
    }
  }, [open, editing]);
  function guardar() {
    const payload = {
      nome: nome.trim() || "Nova turma",
      curso, local, horario, formador, dataInicio, vagas,
      estado: (activa ? "Ativa" : "Inativa") as TurmaGold["estado"],
      horas: horasCurso,
      cronograma,
    };
    if (editing) patchGold(editing.id, payload);
    else addGold({ id: Date.now() % 100000, totalAlunos: 0, ...payload });
    setOpen(null);
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Turmas Gold" sub={`${ativas} ativas · ${gold.length} no total · só as ativas aceitam inscrições`} action={<NewBtn label="+ Nova Turma" onClick={() => setOpen("new")} />} />
      <ViewFilters
        fields={[
          { label: "Curso", value: filtroCurso, onChange: v => { setFiltroCurso(v); setP(1); }, options: uniqueOpts(gold.map(t => t.curso)) },
          { label: "Local", value: filtroLocal, onChange: v => { setFiltroLocal(v); setP(1); }, options: uniqueOpts(gold.map(t => t.local)) },
        ]}
        chips={{ options: ["Todos", "Ativa", "Inativa"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
        onClear={() => { setFiltroCurso(""); setFiltroLocal(""); setFiltro("Todos"); setP(1); }}
      />
      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Id</Th><Th>Data Início</Th><Th>Nome</Th><Th>Local</Th><Th>Horário</Th><Th>Vagas</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(t => {
                const livre = t.vagas - t.totalAlunos;
                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <Td><IdCell id={t.id} /></Td>
                    <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{t.dataInicio}</Td>
                    <Td>
                      <button onClick={() => onCockpit(t.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap text-left">{t.nome}</button>
                      <p className="text-xs text-slate-400">{t.cronograma.length} sessões no cronograma</p>
                    </Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{t.local}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{t.horario}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${livre === 0 ? "text-red-600" : livre <= 3 ? "text-amber-600" : "text-slate-700"}`}>{t.totalAlunos}/{t.vagas}</span>
                        {livre === 0 && <Badge label="Lotada" variant="red" />}
                        {livre > 0 && livre <= 3 && <Badge label="Quase cheia" variant="amber" />}
                      </div>
                    </Td>
                    <Td>
                      <TurmaActivaToggle compact activa={isTurmaActiva(t)} onChange={v => toggleGold(t.id, v)} />
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <ActBtn icon={I.eye} label="Cockpit" onClick={() => onCockpit(t.id)} color="teal" />
                        <ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(t)} />
                        <ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => removeGold(t.id)} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
      </Card>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? `Editar ${editing.nome}` : "Nova turma Gold"} sub="Código interno da turma - o objeto de gestão é a turma, não a ação." size="xl">
        <div className="p-5 space-y-3">
          <TurmaActivaToggle activa={activa} onChange={setActiva} />
          <Field label="Código interno"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} placeholder="VNG-SM-07/09" /></Field>
          <Field label="Curso"><SearchSelect value={curso} onChange={setCurso} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Local"><SearchSelect value={local} onChange={setLocal} options={locaisOpts} placeholder="Pesquisar local…" /></Field>
            <Field label="Horário"><SearchSelect value={horario} onChange={setHorario} options={horariosOpts} /></Field>
          </div>
          <Field label="Formador"><SearchSelect value={formador} onChange={setFormador} options={formadorOpts} placeholder="Pesquisar formador…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de início"><input type="date" className={iCls} value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></Field>
            <Field label="Vagas"><input type="number" className={iCls} value={vagas} onChange={e => setVagas(Number(e.target.value) || 0)} /></Field>
          </div>
          <CronogramaEditor
            sessoes={cronograma}
            onChange={setCronograma}
            inicio={dataInicio}
            horario={horario}
            horas={horasCurso}
            formador={formador}
            curso={curso}
          />
          <div className="flex gap-2 pt-2">
            <button onClick={() => setOpen(null)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={guardar} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg">Guardar</button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

// ─── Formandos Turmas ─────────────────────────────────────────────────────────

function FormandosTurmasView() {
  const { gold, patchGold } = useTurmas();
  const { formandosTurmas, addFormandoTurma, patchFormandoTurma, removeFormandoTurma } = useLists();
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [filtro, setFiltro] = useState("Todos");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroLocal, setFiltroLocal] = useState("");
  const [fichaOpen, setFichaOpen] = useState<FormandoRecord | null>(null);
  const [edit, setEdit] = useState<FormandoRecord | "new" | null>(null);
  const [turma, setTurma] = useState("");
  const [cursoEdit, setCursoEdit] = useState("");
  const [nomeNovo, setNomeNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [telfNovo, setTelfNovo] = useState("");
  const editing = edit && edit !== "new" ? edit : null;
  const turmaOpts = turmaGoldOpts(gold, { curso: cursoEdit || undefined, includeNome: editing?.turma });
  const f = formandosTurmas.filter(x => {
    const q = `${x.nome} ${x.apelido} ${x.turma}`.toLowerCase().includes(s.toLowerCase());
    const byPago = filtro === "Todos" || (filtro === "Pago" ? x.pago : filtro === "Por pagar" ? !x.pago : true);
    return q && byPago && matchesFilter(x.curso, filtroCurso) && matchesFilter(x.local, filtroLocal);
  });
  const rows = f.slice((p - 1) * pp, p * pp);
  useEffect(() => {
    if (edit === "new") {
      setTurma(""); setCursoEdit("Formação de Formadores - CCP"); setNomeNovo(""); setEmailNovo(""); setTelfNovo("");
    } else if (edit) { setTurma(edit.turma); setCursoEdit(edit.curso); }
  }, [edit]);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Formandos Turmas" sub={`${formandosTurmas.length} formandos em turma`} action={<NewBtn label="+ Novo formando" onClick={() => setEdit("new")} />} />
        <ViewFilters
          fields={[
            { label: "Curso", value: filtroCurso, onChange: v => { setFiltroCurso(v); setP(1); }, options: uniqueOpts(formandosTurmas.map(x => x.curso)) },
            { label: "Local", value: filtroLocal, onChange: v => { setFiltroLocal(v); setP(1); }, options: uniqueOpts(formandosTurmas.map(x => x.local)) },
          ]}
          chips={{ options: ["Todos", "Pago", "Por pagar"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
          onClear={() => { setFiltroCurso(""); setFiltroLocal(""); setFiltro("Todos"); setP(1); }}
        />
        <Card>
          <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Nome</Th><Th>Turma</Th><Th>Curso</Th><Th>Local</Th><Th className="text-center">Pago</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <Td><IdCell id={r.id} /></Td>
                    <Td>
                      <button onClick={() => setFichaOpen(r)} className="text-left">
                        <p className="text-xs font-medium text-blue-600 hover:text-blue-800">{r.nome} {r.apelido}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[140px]">{r.email}</p>
                      </button>
                    </Td>
                    <Td className="text-xs font-semibold text-blue-600 whitespace-nowrap">{r.turma}</Td>
                    <Td className="text-xs text-slate-600 max-w-[130px]">{r.curso}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{r.local}</Td>
                    <Td className="text-center">
                      <span className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-white text-xs ${r.pago ? "bg-emerald-500" : "bg-amber-400"}`}>
                        {r.pago ? I.check : "€"}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <ActBtn icon={I.eye} label="Ficha" onClick={() => setFichaOpen(r)} />
                        <ActBtn icon={I.edit} label="Editar" onClick={() => setEdit(r)} />
                        <ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => {
                          const t = gold.find(x => x.id === r.turmaId);
                          removeFormandoTurma(r.id);
                          if (t) patchGold(t.id, { totalAlunos: Math.max(0, t.totalAlunos - 1) });
                        }} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
        </Card>
      </div>
      <SlideOver open={!!fichaOpen} onClose={() => setFichaOpen(null)} title="Ficha do Formando" sub={fichaOpen ? `#${fichaOpen.id}` : ""} size="lg">
        {fichaOpen && <FichaFormando formando={fichaOpen} onClose={() => setFichaOpen(null)} />}
      </SlideOver>
      <SlideOver open={!!edit} onClose={() => setEdit(null)} title={editing ? `${editing.nome} ${editing.apelido}` : "Novo formando"} sub={editing ? "Mover de turma ou actualizar dados" : "Inscrever numa turma ativa"}>
        <div className="p-5 space-y-3">
          {!editing && (
            <>
              <Field label="Nome"><input className={iCls} value={nomeNovo} onChange={e => setNomeNovo(e.target.value)} placeholder="Nome completo" /></Field>
              <Field label="Email"><input className={iCls} type="email" value={emailNovo} onChange={e => setEmailNovo(e.target.value)} /></Field>
              <Field label="Telemóvel"><input className={iCls} value={telfNovo} onChange={e => setTelfNovo(e.target.value)} /></Field>
            </>
          )}
          <Field label="Turma">
            <SearchSelect value={turma} onChange={setTurma} options={turmaOpts} placeholder="Só turmas ativas…" empty="Não há turmas ativas para este curso." />
          </Field>
          <TurmaInscricaoHint optsLen={turmaOpts.length} curso={cursoEdit || undefined} />
          <Field label="Curso"><SearchSelect value={cursoEdit} onChange={v => { setCursoEdit(v); if (turma && !turmaGoldOpts(gold, { curso: v, includeNome: editing?.turma }).some(o => o.value === turma)) setTurma(""); }} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setEdit(null)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button disabled={!turma || (!editing && !nomeNovo.trim())} onClick={() => {
              const dest = gold.find(x => x.nome === turma);
              if (!dest) return;
              if (editing) {
                const prev = gold.find(x => x.id === editing.turmaId);
                patchFormandoTurma(editing.id, { turma: dest.nome, turmaId: dest.id, curso: dest.curso || cursoEdit, local: dest.local });
                if (prev && prev.id !== dest.id) {
                  patchGold(prev.id, { totalAlunos: Math.max(0, prev.totalAlunos - 1) });
                  patchGold(dest.id, { totalAlunos: dest.totalAlunos + 1 });
                }
              } else {
                const { nome, apelido } = splitNome(nomeNovo);
                addFormandoTurma({
                  id: nextListId(formandosTurmas),
                  nome, apelido: apelido || "-",
                  telf: telfNovo.trim() || "-",
                  email: emailNovo.trim() || `${nome.toLowerCase()}@mail.pt`,
                  inscrito: nowStamp(), local: dest.local, curso: dest.curso, turma: dest.nome, turmaId: dest.id,
                  estado: "Formando", pago: false, valor: 125, metodo: "-",
                });
                patchGold(dest.id, { totalAlunos: dest.totalAlunos + 1 });
              }
              setEdit(null);
            }} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">{editing ? "Guardar" : "Inscrever"}</button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}

// ─── Formandos Financiada com Documentos ─────────────────────────────────────

function FinFormandosView() {
  const { fin, patchFin } = useTurmas();
  const { formandosFin, addFormandoFin } = useLists();
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [filtro, setFiltro] = useState("Todos");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [docsOpen, setDocsOpen] = useState<FinFormando | null>(null);
  const [novo, setNovo] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [telfNovo, setTelfNovo] = useState("");
  const [cursoNovo, setCursoNovo] = useState("");
  const [turmaNovo, setTurmaNovo] = useState("");
  const f = formandosFin.filter(x => {
    const q = `${x.nome} ${x.apelido} ${x.email}`.toLowerCase().includes(s.toLowerCase());
    return q && matchesFilter(x.curso, filtroCurso) && (filtro === "Todos" || x.estado === filtro);
  });
  const rows = f.slice((p - 1) * pp, p * pp);
  const turmaOpts = fin.filter(t => !cursoNovo || t.curso === cursoNovo).map(t => ({ value: t.nome, sub: t.curso }));
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Formandos Financiados" sub={`${formandosFin.length} formandos`} action={<NewBtn accent="fin" label="+ Novo formando" onClick={() => { setNomeNovo(""); setEmailNovo(""); setTelfNovo(""); setCursoNovo(""); setTurmaNovo(""); setNovo(true); }} />} />
        <ViewFilters
          accent="fin"
          fields={[{ label: "Curso / UFCD", value: filtroCurso, onChange: v => { setFiltroCurso(v); setP(1); }, options: uniqueOpts(formandosFin.map(x => x.curso)) }]}
          chips={{ options: ["Todos", "Elegível"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
          onClear={() => { setFiltroCurso(""); setFiltro("Todos"); setP(1); }}
        />
        <Card>
          <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Nome</Th><Th>Turma</Th><Th>Curso</Th><Th>Estado</Th>
                  <Th>Documentos</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => {
                  const keys: DocKey[] = ["cc", "ch", "cu", "ci", "ce"];
                  const okCount = keys.filter(k => r[k].ok).length;
                  const complete = okCount === 5;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <Td>
                        <p className="text-xs font-medium text-blue-600">{r.nome} {r.apelido}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[140px]">{r.email}</p>
                      </Td>
                      <Td className="text-xs text-slate-600 whitespace-nowrap">{r.turma}</Td>
                      <Td className="text-xs text-slate-600 max-w-[130px]">{r.curso}</Td>
                      <Td>{estadoBadge(r.estado)}</Td>
                      <Td>
                        <button onClick={() => setDocsOpen(r)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${complete ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                          {complete ? "✓ Completos" : `${okCount}/5 · ${5 - okCount} em falta`}
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
        </Card>
      </div>
      <SlideOver open={!!docsOpen} onClose={() => setDocsOpen(null)} title="Documentos do formando" sub={docsOpen ? `${docsOpen.nome} ${docsOpen.apelido}` : ""}>
        {docsOpen && <DocumentosFinPanel formando={docsOpen} />}
      </SlideOver>
      <SlideOver open={novo} onClose={() => setNovo(false)} title="Novo formando financiado" sub="Candidato elegível numa turma">
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} value={nomeNovo} onChange={e => setNomeNovo(e.target.value)} placeholder="Nome completo" /></Field>
          <Field label="Email"><input className={iCls} type="email" value={emailNovo} onChange={e => setEmailNovo(e.target.value)} /></Field>
          <Field label="Telemóvel"><input className={iCls} value={telfNovo} onChange={e => setTelfNovo(e.target.value)} /></Field>
          <Field label="Curso / UFCD"><SearchSelect value={cursoNovo} onChange={v => { setCursoNovo(v); setTurmaNovo(""); }} options={cursosFinOpts} placeholder="Pesquisar UFCD…" /></Field>
          <Field label="Turma"><SearchSelect value={turmaNovo} onChange={setTurmaNovo} options={turmaOpts} placeholder="Turma destino…" empty="Não há turmas para esta UFCD." /></Field>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setNovo(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button disabled={!nomeNovo.trim() || !cursoNovo} onClick={() => {
              const { nome, apelido } = splitNome(nomeNovo);
              addFormandoFin({
                id: nextListId(formandosFin),
                nome, apelido: apelido || "-",
                turma: turmaNovo || "-", telf: telfNovo.trim() || "-",
                email: emailNovo.trim() || `${nome.toLowerCase()}@mail.pt`,
                curso: cursoNovo, estado: "Elegível",
                ...emptyFinDocs(),
              });
              const dest = fin.find(t => t.nome === turmaNovo);
              if (dest) patchFin(dest.id, { alunos: dest.alunos + 1 });
              setNovo(false);
            }} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">Criar formando</button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}

// ─── Turmas Financiadas ───────────────────────────────────────────────────────

function FinTurmasView({ onCockpit }: { onCockpit: (id: number, tab?: CockpitTab) => void }) {
  const { fin, patchFin, addFin, removeFin, toggleFin } = useTurmas();
  const formadorOpts = useFormadorOptions();
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [filtro, setFiltro] = useState("Todos");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [open, setOpen] = useState<TurmaFin | "new" | null>(null);
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("");
  const [formador, setFormador] = useState("");
  const [localFin, setLocalFin] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [activa, setActiva] = useState(true);
  const [cronograma, setCronograma] = useState<SessaoCronograma[]>([]);
  const editing = open && open !== "new" ? open : null;
  const ativas = fin.filter(t => isTurmaActiva(t)).length;
  const f = fin.filter(t => {
    const q = `${t.nome} ${t.curso}`.toLowerCase().includes(s.toLowerCase());
    const activaLbl = isTurmaActiva(t) ? "Ativa" : "Inativa";
    return q && matchesFilter(t.curso, filtroCurso) && (filtro === "Todos" || t.estado === filtro || activaLbl === filtro);
  });
  const rows = f.slice((p - 1) * pp, p * pp);
  useEffect(() => {
    if (open) {
      setNome(editing?.nome ?? "");
      setCurso(editing?.curso ?? "");
      setFormador(editing?.formador ?? "");
      setLocalFin(editing?.local ?? "Sala Virtual");
      setDataInicio(editing?.dataInicio ?? "");
      setActiva(editing ? isTurmaActiva(editing) : true);
      setCronograma(editing?.cronograma ?? []);
    }
  }, [open, editing]);
  function guardar() {
    const horas = editing?.horas ?? 25;
    const payload = {
      nome: nome.trim() || "Nova turma",
      curso, formador, local: localFin, dataInicio, activa, cronograma, horas,
    };
    if (editing) patchFin(editing.id, payload);
    else addFin({
      id: Date.now() % 100000,
      ufcdCod: "0000",
      horario: "Online",
      alunos: 0,
      alunosTotal: 20,
      estado: "A montar",
      ...payload,
    });
    setOpen(null);
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Turmas Financiadas" sub={`${ativas} ativas · ${fin.length} no total · só as ativas aceitam novas inscrições`} action={<NewBtn label="+ Nova Turma" onClick={() => setOpen("new")} />} />
      <ViewFilters
        accent="fin"
        fields={[{ label: "Curso / UFCD", value: filtroCurso, onChange: v => { setFiltroCurso(v); setP(1); }, options: uniqueOpts(fin.map(t => t.curso)) }]}
        chips={{ options: ["Todos", "Ativa", "Inativa", "A montar", "A decorrer"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
        onClear={() => { setFiltroCurso(""); setFiltro("Todos"); setP(1); }}
      />
      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Id</Th><Th>Início</Th><Th>UFCD</Th><Th>Turma / Curso</Th><Th>Formador</Th><Th>Elegíveis</Th><Th>Estado</Th><Th>Inscrições</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(t => {
                const prontos = Math.floor(t.alunos * 0.8);
                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <Td><IdCell id={t.id} /></Td>
                    <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{t.dataInicio}</Td>
                    <Td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">{t.ufcdCod}</span></Td>
                    <Td>
                      <button onClick={() => onCockpit(t.id, "overview")} className="text-left">
                        <p className="text-xs font-semibold text-blue-600 max-w-[160px] hover:text-blue-800">{t.nome}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[160px]">{t.curso} · {t.cronograma.length} sessões</p>
                      </button>
                    </Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{t.formador}</Td>
                    <Td>
                      <div>
                        <span className={`text-xs font-bold ${prontos === t.alunos ? "text-emerald-600" : "text-amber-600"}`}>{prontos}/{t.alunos} prontos</span>
                        <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-0.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${(prontos / t.alunos) * 100}%`, backgroundColor: prontos === t.alunos ? "#10B981" : "#F59E0B" }} />
                        </div>
                      </div>
                    </Td>
                    <Td>{estadoBadge(t.estado)}</Td>
                    <Td>
                      <TurmaActivaToggle compact accent="fin" activa={isTurmaActiva(t)} onChange={v => toggleFin(t.id, v)} />
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <ActBtn icon={I.eye} label="Cockpit" color="teal" onClick={() => onCockpit(t.id, "overview")} />
                        <ActBtn icon={I.attend} label="Presenças" color="teal" onClick={() => onCockpit(t.id, "sessoes")} />
                        <ActBtn icon={I.doc} label="Dossiê da turma" color="orange" onClick={() => onCockpit(t.id, "dtp")} />
                        <ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(t)} />
                        <ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => removeFin(t.id)} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
      </Card>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? editing.nome : "Nova turma financiada"} sub="UFCD e turma - o objeto de gestão é a turma." size="xl">
        <div className="p-5 space-y-3">
          <TurmaActivaToggle accent="fin" activa={activa} onChange={setActiva} />
          <Field label="Curso / UFCD"><SearchSelect value={curso} onChange={setCurso} options={cursosFinOpts} placeholder="Pesquisar UFCD…" /></Field>
          <Field label="Código da turma"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} placeholder="UFCD 3564 · T1" /></Field>
          <Field label="Formador"><SearchSelect value={formador} onChange={setFormador} options={formadorOpts} placeholder="Pesquisar formador…" /></Field>
          <Field label="Local"><SearchSelect value={localFin} onChange={setLocalFin} options={locaisOpts} placeholder="Pesquisar local…" /></Field>
          <Field label="Data de início"><input type="date" className={iCls} value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></Field>
          <CronogramaEditor
            accent="fin"
            sessoes={cronograma}
            onChange={setCronograma}
            inicio={dataInicio}
            horario={editing?.horario ?? "Pós Laboral"}
            horas={editing?.horas ?? 25}
            formador={formador}
            curso={curso}
          />
          <div className="flex gap-2 pt-2">
            <button onClick={() => setOpen(null)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={guardar} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg">Guardar</button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

// ─── Remaining views (simplified) ────────────────────────────────────────────

function GoldCursoFichaScreen({ cursoId, onBack, onOpenModulos }: { cursoId?: number | "new"; onBack: () => void; onOpenModulos: (nome: string) => void }) {
  const { cursosGold, addCursoGold, patchCursoGold } = useLists();
  const curso = cursoId && cursoId !== "new" ? cursosGold.find(c => c.id === cursoId) : undefined;
  return (
    <CursoFichaView
      curso={curso}
      onBack={onBack}
      onOpenModulos={onOpenModulos}
      onCommit={saved => {
        if (curso) patchCursoGold(curso.id, { nome: saved.nome, categoria: saved.categoria ?? curso.categoria, tipo: saved.tipo ?? curso.tipo, preco: saved.preco ?? curso.preco, regime: saved.regime, horas: saved.horas, estado: saved.estado });
        else addCursoGold({ id: saved.id, nome: saved.nome, categoria: saved.categoria || "CCP e Gestão da Formação", tipo: saved.tipo || "Gold", preco: saved.preco ?? 0, regime: saved.regime, horas: saved.horas, estado: saved.estado || "Ativo" });
      }}
    />
  );
}

function FinCursoFichaScreen({ cursoId, onBack }: { cursoId?: number | "new"; onBack: () => void }) {
  const { cursosFin, addCursoFin, patchCursoFin } = useLists();
  const raw = cursoId && cursoId !== "new" ? cursosFin.find(c => c.id === cursoId) : undefined;
  return (
    <CursoFichaView
      accent="fin"
      curso={raw ? { id: raw.id, nome: raw.nomeComercial, ufcdCod: raw.ufcdCod, ufcd: raw.ufcd, regime: raw.regime, horas: raw.horas, estado: raw.estado } : undefined}
      onBack={onBack}
      onCommit={saved => {
        const ufcdCod = saved.ufcdCod || raw?.ufcdCod || "0000";
        const row = { id: saved.id, ufcdCod, ufcd: saved.ufcd || saved.nome, nomeComercial: saved.nome, regime: saved.regime, horas: saved.horas, estado: saved.estado || "Ativo" };
        if (raw) patchCursoFin(raw.id, row);
        else addCursoFin(row);
      }}
    />
  );
}

function CursosGoldView({ onOpen }: { onOpen: (id: number | "new") => void }) {
  const { cursosGold, removeCursoGold } = useLists();
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [filtro, setFiltro] = useState("Todos");
  const [filtroCat, setFiltroCat] = useState("");
  const f = cursosGold.filter(c => {
    const q = `${c.nome} ${c.categoria}`.toLowerCase().includes(s.toLowerCase());
    return q && matchesFilter(c.categoria, filtroCat) && (filtro === "Todos" || c.estado === filtro);
  });
  const rows = f.slice((p - 1) * pp, p * pp);

  return (
    <div>
      <PageHeader title="Cursos Gold" sub="Clique num curso para editar a página pública e a ficha operacional." action={<NewBtn label="+ Novo Curso" onClick={() => onOpen("new")} />} />
      <div className="mb-4">
        <ViewFilters
          fields={[{ label: "Área temática", value: filtroCat, onChange: v => { setFiltroCat(v); setP(1); }, options: uniqueOpts(cursosGold.map(c => c.categoria)) }]}
          chips={{ options: ["Todos", "Ativo", "Inactivo"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
          onClear={() => { setFiltroCat(""); setFiltro("Todos"); setP(1); }}
        />
      </div>
      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Id</Th><Th>Nome</Th><Th>Categoria</Th><Th>Tipo</Th><Th>Preço</Th><Th>Regime</Th><Th className="text-center">Horas</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td><IdCell id={c.id} /></Td>
                  <Td className="max-w-[200px]"><button onClick={() => onOpen(c.id)} className="text-xs font-medium text-blue-600 leading-snug text-left hover:underline">{c.nome}</button></Td>
                  <Td className="text-xs text-slate-600 whitespace-nowrap">{c.categoria}</Td>
                  <Td><Badge label={c.tipo} variant={c.tipo === "Gold" ? "amber" : "gray"} /></Td>
                  <Td className="text-xs font-semibold text-amber-600">€ {c.preco}</Td>
                  <Td><span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.regime === "e-learning" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{c.regime}</span></Td>
                  <Td className="text-center text-xs text-slate-600">{c.horas || "-"}</Td>
                  <Td>{estadoBadge(c.estado)}</Td>
                  <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar página" onClick={() => onOpen(c.id)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => removeCursoGold(c.id)} /></div></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
      </Card>
    </div>
  );
}


function BlogView() {
  const { blogPosts, addBlogPost, patchBlogPost, removeBlogPost } = useLists();
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [tematica, setTematica] = useState("");
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const f = blogPosts.filter(x => x.titulo.toLowerCase().includes(s.toLowerCase()) && (filtro === "Todos" || x.status === filtro));
  return (
    <div className="space-y-4">
      <PageHeader title="Blog - Posts" action={<NewBtn label="+ Novo Post" onClick={() => { setEditId(null); setTitulo(""); setSlug(""); setTematica(""); setOpen(true); }} />} />
      <ViewFilters
        chips={{ options: ["Todos", "Ativo", "Inactivo"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
        onClear={() => setFiltro("Todos")}
      />
      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Id</Th><Th>Título</Th><Th>Slug</Th><Th>Data</Th><Th>Status</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {f.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td><IdCell id={r.id} /></Td>
                  <Td className="text-sm font-medium text-slate-700 max-w-[220px]">{r.titulo}</Td>
                  <Td className="font-mono text-xs text-slate-500">{r.slug}</Td>
                  <Td className="font-mono text-xs text-slate-500">{r.data}</Td>
                  <Td>{estadoBadge(r.status)}</Td>
                  <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => { setEditId(r.id); setTitulo(r.titulo); setSlug(r.slug); setTematica(""); setOpen(true); }} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => removeBlogPost(r.id)} /></div></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
      </Card>
      <SlideOver open={open} onClose={() => setOpen(false)} title={editId != null ? "Editar post" : "Novo post"} sub="Artigo no site da ENA">
        <div className="p-5 space-y-3">
          <Field label="Título"><input className={iCls} value={titulo} onChange={e => setTitulo(e.target.value)} /></Field>
          <Field label="Temática"><SearchSelect value={tematica} onChange={setTematica} options={blogTematicasOpts} placeholder="Pesquisar temática…" /></Field>
          <Field label="Slug"><input className={iCls} value={slug} onChange={e => setSlug(e.target.value)} placeholder="ccp-formacao-formadores" /></Field>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={() => {
              if (!titulo.trim()) return;
              const s = (slug.trim() || titulo).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              if (editId != null) patchBlogPost(editId, { titulo: titulo.trim(), slug: s });
              else addBlogPost({ id: nextListId(blogPosts), titulo: titulo.trim(), slug: s, data: new Date().toISOString().slice(0, 10), status: "Ativo" });
              setOpen(false); setTitulo(""); setSlug(""); setTematica(""); setEditId(null);
            }} disabled={!titulo.trim()} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">{editId != null ? "Guardar" : "Criar post"}</button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

function CampanhasView() {
  const { campanhas, addCampanha, removeCampanha } = useLists();
  const [open, setOpen] = useState(false);
  const [cursoCamp, setCursoCamp] = useState("");
  const [nomeCamp, setNomeCamp] = useState("");
  const [dataCamp, setDataCamp] = useState("");
  return (
    <div className="space-y-4">
      <PageHeader title="Campanhas" action={<NewBtn label="+ Nova Campanha" onClick={() => { setNomeCamp(""); setDataCamp(""); setCursoCamp(""); setOpen(true); }} />} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {campanhas.map(c => (
          <Card key={c.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-slate-800">{c.nome || <span className="italic text-slate-400">sem nome</span>}</p>
                <p className="text-xs text-slate-400 mt-0.5">{c.data} · {c.encarregado}</p>
              </div>
              <ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => removeCampanha(c.id)} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { l: "Inscrições", v: c.preinscricoes.toLocaleString("pt-PT"), c: "text-blue-600" },
                { l: "Pagamentos", v: c.pagos.toLocaleString("pt-PT"), c: "text-teal-600" },
                { l: "Receita", v: `€ ${c.receita.toLocaleString("pt-PT")}`, c: "text-emerald-600" },
                { l: "ROI", v: `${Math.round((c.receita - c.custo) / c.custo * 100)}%`, c: "text-amber-600" },
              ].map(s => (
                <div key={s.l} className="bg-slate-50 rounded-xl p-2.5">
                  <p className="text-xs text-slate-400">{s.l}</p>
                  <p className={`text-sm font-bold ${s.c} mt-0.5`}>{s.v}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <SlideOver open={open} onClose={() => setOpen(false)} title="Nova campanha" sub="Campanha comercial Gold">
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} value={nomeCamp} onChange={e => setNomeCamp(e.target.value)} placeholder="Outubro 2026" /></Field>
          <Field label="Curso em destaque"><SearchSelect value={cursoCamp} onChange={setCursoCamp} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <Field label="Data de início"><input type="date" className={iCls} value={dataCamp} onChange={e => setDataCamp(e.target.value)} /></Field>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={() => {
              if (!nomeCamp.trim()) return;
              addCampanha({ id: nextListId(campanhas), nome: nomeCamp.trim(), data: dataCamp || new Date().toISOString().slice(0, 10), encarregado: "Aguilar", preinscricoes: 0, pagos: 0, receita: 0, custo: 1 });
              setOpen(false);
            }} disabled={!nomeCamp.trim()} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">Criar campanha</button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

function FinCursosView({ onOpen }: { onOpen: (id: number | "new") => void }) {
  const { cursosFin, removeCursoFin } = useLists();
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [filtro, setFiltro] = useState("Todos");
  const [filtroRegime, setFiltroRegime] = useState("");
  const f = cursosFin.filter(c => `${c.ufcd} ${c.nomeComercial}`.toLowerCase().includes(s.toLowerCase()) && matchesFilter(c.regime, filtroRegime) && (filtro === "Todos" || c.estado === filtro));
  const rows = f.slice((p - 1) * pp, p * pp);
  return (
    <div className="space-y-4">
      <PageHeader title="Cursos Financiados" sub="Clique numa UFCD para editar a página pública e a ficha operacional." action={<NewBtn label="+ Novo Curso" onClick={() => onOpen("new")} />} />
      <ViewFilters
        accent="fin"
        fields={[{ label: "Regime", value: filtroRegime, onChange: v => { setFiltroRegime(v); setP(1); }, options: uniqueOpts(cursosFin.map(c => c.regime)) }]}
        chips={{ options: ["Todos", "Ativo", "Inactivo"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
        onClear={() => { setFiltroRegime(""); setFiltro("Todos"); setP(1); }}
      />
      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Cód. UFCD</Th><Th>UFCD</Th><Th>Nome Comercial</Th><Th>Regime</Th><Th className="text-center">Horas</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">{c.ufcdCod}</span></Td>
                  <Td className="max-w-[180px]"><button onClick={() => onOpen(c.id)} className="text-xs text-blue-600 font-medium text-left hover:underline">{c.ufcd}</button></Td>
                  <Td className="text-xs text-slate-600 max-w-[200px]">{c.nomeComercial}</Td>
                  <Td><span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.regime === "e-learning" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{c.regime}</span></Td>
                  <Td className="text-center text-xs text-slate-600">{c.horas || "-"}</Td>
                  <Td>{estadoBadge(c.estado)}</Td>
                  <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar página" onClick={() => onOpen(c.id)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => removeCursoFin(c.id)} /></div></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
      </Card>
    </div>
  );
}

function EmailsView() {
  const [tab, setTab] = useState<"regras" | "templates" | "historico">("regras");
  const [regras, setRegras] = useState(emailRegras);
  const [templates, setTemplates] = useState(emailTemplates);
  const [editRegraId, setEditRegraId] = useState<number | null>(null);
  const [editTpl, setEditTpl] = useState<typeof emailTemplates[number] | null>(null);
  const [novaRegra, setNovaRegra] = useState(false);
  const [previewTipo, setPreviewTipo] = useState<string | null>(null);
  const [previewGatilho, setPreviewGatilho] = useState("");
  const [nomeRegra, setNomeRegra] = useState("");
  const [nomeTouched, setNomeTouched] = useState(false);
  const [gatilho, setGatilho] = useState("");
  const [templateNome, setTemplateNome] = useState("");
  const [cursoEmail, setCursoEmail] = useState("");
  const [atraso, setAtraso] = useState("Imediatamente");
  const [ativoRegra, setAtivoRegra] = useState(true);
  const [erroRegra, setErroRegra] = useState("");

  const templateOpts = templates.map(t => ({ value: t.nome, sub: t.assunto }));
  const templateTipo = templates.find(t => t.nome === templateNome)?.tipo ?? "";

  function syncNome(nextGatilho: string, nextTemplate: string) {
    if (nomeTouched) return;
    if (nextTemplate && nextGatilho) setNomeRegra(`${nextTemplate} · ${nextGatilho}`);
    else if (nextTemplate) setNomeRegra(nextTemplate);
    else setNomeRegra("");
  }

  function onGatilho(v: string) {
    setGatilho(v);
    const sug = GATILHO_TEMPLATE[v];
    const nextTpl = templateNome || sug || "";
    if (!templateNome && sug) setTemplateNome(sug);
    syncNome(v, nextTpl);
  }

  function onTemplate(v: string) {
    setTemplateNome(v);
    syncNome(gatilho, v);
  }

  function abrirNova() {
    setEditRegraId(null);
    setNomeRegra("");
    setNomeTouched(false);
    setGatilho("");
    setTemplateNome("");
    setCursoEmail("");
    setAtraso("Imediatamente");
    setAtivoRegra(true);
    setErroRegra("");
    setNovaRegra(true);
  }

  function abrirEditarRegra(r: typeof emailRegras[number]) {
    setEditRegraId(r.id);
    setNomeRegra(r.nome);
    setNomeTouched(true);
    setGatilho(r.gatilho);
    const tpl = templates.find(t => t.tipo === r.template);
    setTemplateNome(tpl?.nome ?? "");
    setCursoEmail("");
    setAtraso("Imediatamente");
    setAtivoRegra(r.ativo);
    setErroRegra("");
    setNovaRegra(true);
  }

  function guardarRegra() {
    if (!nomeRegra.trim()) {
      setErroRegra("Dê um nome à regra.");
      return;
    }
    if (!gatilho) {
      setErroRegra("Escolha o gatilho que dispara o email.");
      return;
    }
    if (!templateTipo) {
      setErroRegra("Escolha o template que o formando recebe.");
      return;
    }
    if (editRegraId != null) {
      setRegras(prev => prev.map(x => x.id === editRegraId ? { ...x, nome: nomeRegra.trim(), gatilho, template: templateTipo, ativo: ativoRegra } : x));
    } else {
      setRegras(prev => [{
        id: Date.now() % 100000,
        nome: nomeRegra.trim(),
        gatilho,
        template: templateTipo,
        ativo: ativoRegra,
        envios: 0,
        taxaAbertura: 0,
      }, ...prev]);
    }
    setNovaRegra(false);
    setEditRegraId(null);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Emails Automáticos" sub="Uma regra = um gatilho + um template. O preview mostra o email com dados de exemplo." action={<NewBtn label="+ Nova Regra" onClick={abrirNova} />} />
      <div className="flex gap-1 border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3">
        {(["regras", "templates", "historico"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors -mb-px ${tab === t ? "bg-white border-t border-l border-r border-slate-200 text-amber-600 border-b-white" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "regras" ? "Regras de Envio" : t === "templates" ? "Templates" : "Histórico"}
          </button>
        ))}
      </div>
      {tab === "regras" && (
        <Card>
          <div className="divide-y divide-slate-100">
            {regras.map(r => (
              <div key={r.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{r.nome}</p>
                    <Badge label={r.ativo ? "Ativo" : "Inativo"} variant={r.ativo ? "green" : "gray"} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">⚡ {r.gatilho}</p>
                  <div className="flex gap-4 mt-1.5">
                    <span className="text-xs text-slate-400">{r.envios.toLocaleString("pt-PT")} enviados</span>
                    <span className="text-xs text-slate-400">{r.taxaAbertura}% abertura</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Toggle checked={r.ativo} onChange={val => setRegras(prev => prev.map(x => x.id === r.id ? { ...x, ativo: val } : x))} />
                  <ActBtn icon={I.eye} label="Preview" color="gray" onClick={() => { setPreviewTipo(r.template); setPreviewGatilho(r.gatilho); }} />
                  <ActBtn icon={I.edit} label="Editar" onClick={() => abrirEditarRegra(r)} />
                  <ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setRegras(prev => prev.filter(x => x.id !== r.id))} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "templates" && (
        <Card>
          <div className="divide-y divide-slate-100">
            {templates.map(t => (
              <div key={t.id} className="px-4 py-4 flex items-center gap-3 hover:bg-slate-50">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white ${t.tipo === "welcome" ? "bg-blue-500" : t.tipo === "payment" ? "bg-emerald-500" : t.tipo === "certificate" ? "bg-violet-500" : "bg-amber-500"}`}>{I.mail}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{t.nome}</p>
                  <p className="text-xs text-slate-500 truncate">{t.assunto}</p>
                  <p className="text-xs text-slate-400">Editado {t.editado}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <ActBtn icon={I.edit} label="Editar" onClick={() => setEditTpl(t)} />
                  <ActBtn icon={I.eye} label="Preview" color="gray" onClick={() => { setPreviewTipo(t.tipo); setPreviewGatilho(""); }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "historico" && (
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
            {[{ l: "Enviados (30d)", v: "48 920", c: "text-slate-800" }, { l: "Taxa abertura", v: "84.3%", c: "text-emerald-600" }, { l: "Taxa cliques", v: "12.7%", c: "text-blue-600" }, { l: "Erros", v: "0.8%", c: "text-red-500" }].map(s => (
              <div key={s.l} className="bg-white p-4"><p className="text-xs text-slate-400">{s.l}</p><p className={`text-xl font-bold mt-1 ${s.c}`}>{s.v}</p></div>
            ))}
          </div>
          <div className="p-4 text-center text-xs text-slate-400">Os disparos das regras novas aparecem aqui depois do primeiro envio.</div>
        </Card>
      )}

      {novaRegra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setNovaRegra(false)} />
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden" style={{ animation: "scaleIn 0.15s ease" }}>
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-800">{editRegraId != null ? "Editar regra de email" : "Nova regra de email"}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Quando acontece o gatilho, a ENA envia o template. O email à direita usa dados de exemplo.</p>
              </div>
              <button type="button" onClick={() => setNovaRegra(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-xs text-slate-600">
                  {gatilho || templateNome ? (
                    <>Quando <span className="font-semibold text-slate-800">{gatilho || "…"}</span>, enviar <span className="font-semibold text-slate-800">{templateNome || "…"}</span> {atraso.toLowerCase()}{cursoEmail ? ` em ${cursoEmail}` : ""}.</>
                  ) : (
                    <>Comece pelo gatilho - o template e o nome da regra preenchem-se sozinhos.</>
                  )}
                </div>
                <Field label="1. Gatilho">
                  <SearchSelect value={gatilho} onChange={onGatilho} options={emailGatilhosOpts} placeholder="Quando disparar…" />
                </Field>
                <Field label="2. Template">
                  <SearchSelect value={templateNome} onChange={onTemplate} options={templateOpts} placeholder="Que email enviar…" />
                </Field>
                <Field label="3. Atraso">
                  <SearchSelect value={atraso} onChange={setAtraso} options={emailAtrasosOpts} />
                </Field>
                <Field label="Curso (opcional)">
                  <SearchSelect value={cursoEmail} onChange={setCursoEmail} options={cursosGoldOpts} placeholder="Todas as turmas, ou só este curso…" allowEmpty />
                </Field>
                <Field label="Nome da regra">
                  <input
                    className={iCls}
                    value={nomeRegra}
                    onChange={e => { setNomeTouched(true); setNomeRegra(e.target.value); }}
                    placeholder="Preenche-se com o gatilho e o template"
                  />
                </Field>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Regra activa</p>
                    <p className="text-[11px] text-slate-400">Desligada fica guardada mas não dispara.</p>
                  </div>
                  <Toggle checked={ativoRegra} onChange={setAtivoRegra} />
                </div>
                {erroRegra && <p className="text-xs font-medium text-red-600">{erroRegra}</p>}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Preview do novo email</p>
                <EmailPreviewPane tipo={templateTipo} curso={cursoEmail} gatilho={gatilho} atraso={atraso} />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
              <button type="button" onClick={() => setNovaRegra(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={guardarRegra} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg">{editRegraId != null ? "Guardar regra" : "Criar regra"}</button>
            </div>
          </div>
        </div>
      )}

      {previewTipo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewTipo(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ animation: "scaleIn 0.15s ease" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-800">Preview do email</p>
              <button type="button" onClick={() => setPreviewTipo(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
            </div>
            <div className="p-4">
              <EmailPreviewPane tipo={previewTipo} curso="Formação de Formadores - CCP" gatilho={previewGatilho} />
            </div>
          </div>
        </div>
      )}
      <SlideOver open={!!editTpl} onClose={() => setEditTpl(null)} title={editTpl ? `Editar ${editTpl.nome}` : ""} sub="Assunto e nome do template">
        {editTpl && (
          <div className="p-5 space-y-3">
            <Field label="Nome"><input className={iCls} value={editTpl.nome} onChange={e => setEditTpl({ ...editTpl, nome: e.target.value })} /></Field>
            <Field label="Assunto"><input className={iCls} value={editTpl.assunto} onChange={e => setEditTpl({ ...editTpl, assunto: e.target.value })} /></Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditTpl(null)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={() => {
                setTemplates(prev => prev.map(t => t.id === editTpl.id ? { ...editTpl, editado: "hoje" } : t));
                setEditTpl(null);
              }} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg">Guardar</button>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function PagamentosView() {
  const [lista, setLista] = useState(transacoesData);
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("");
  const [valor, setValor] = useState("125");
  const [metodo, setMetodo] = useState("MB Way");
  const f = lista.filter(t =>
    `${t.nome} ${t.curso} ${t.metodo}`.toLowerCase().includes(s.toLowerCase())
    && matchesFilter(t.curso, filtroCurso)
    && (filtro === "Todos" || t.estado === filtro)
  );
  return (
    <div className="space-y-5">
      <PageHeader title="Pagamentos" action={<NewBtn label="+ Nova transação" onClick={() => { setNome(""); setCurso(""); setValor("125"); setMetodo("MB Way"); setNovo(true); }} />} />
      <ViewFilters
        fields={[{ label: "Curso", value: filtroCurso, onChange: v => { setFiltroCurso(v); setP(1); }, options: uniqueOpts(lista.map(t => t.curso)) }]}
        chips={{ options: ["Todos", "Pago", "Pendente"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
        onClear={() => { setFiltroCurso(""); setFiltro("Todos"); setP(1); }}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: "Receita Total", v: "€ 304 680", c: "text-slate-800" }, { l: "Este Mês", v: "€ 35 200", c: "text-emerald-600" }, { l: "Pendente", v: "€ 8 400", c: "text-amber-600" }, { l: "Reembolsados", v: "€ 1 240", c: "text-red-500" }].map(s => (
          <Card key={s.l} className="p-4"><p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{s.l}</p><p className={`text-xl font-bold ${s.c}`}>{s.v}</p></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Métodos de Pagamento</p>
          <div className="space-y-3">
            {metodosPagamento.map(m => (
              <div key={m.metodo}>
                <div className="flex justify-between mb-1"><span className="text-xs font-medium text-slate-700">{m.metodo}</span><span className="text-xs font-bold text-slate-700">{m.pct}%</span></div>
                <div className="w-full bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ width: `${m.pct}%`, backgroundColor: m.color }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Receita Mensal</p>
          <MiniBarChart data={receitaMensal} color="#F59E0B" />
        </Card>
      </div>
      <Card>
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <p className="text-sm font-semibold text-slate-700">Transações Recentes</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{I.search}</span>
            <input value={s} onChange={e => { setS(e.target.value); setP(1); }} className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Pesquisar…" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>ID</Th><Th>Nome</Th><Th>Curso</Th><Th>Valor</Th><Th>Método</Th><Th>Data</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {f.slice((p - 1) * pp, p * pp).map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td><IdCell id={t.id} /></Td>
                  <Td className="text-xs font-medium text-slate-700 whitespace-nowrap">{t.nome}</Td>
                  <Td className="text-xs text-slate-600 max-w-[150px]">{t.curso}</Td>
                  <Td className="text-sm font-bold text-slate-800 whitespace-nowrap">€ {t.valor}</Td>
                  <Td className="text-xs text-slate-600">{t.metodo}</Td>
                  <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{t.data}</Td>
                  <Td>{estadoBadge(t.estado)}</Td>
                  <Td><div className="flex gap-1"><ActBtn icon={I.eye} label="Detalhes" color="gray" /><ActBtn icon={I.receipt} label="Recibo" /></div></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
      </Card>
      <SlideOver open={novo} onClose={() => setNovo(false)} title="Nova transação" sub="Pagamento Gold">
        <div className="p-5 space-y-3">
          <Field label="Nome do formando"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} /></Field>
          <Field label="Curso"><SearchSelect value={curso} onChange={setCurso} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (€)"><input className={iCls} type="number" value={valor} onChange={e => setValor(e.target.value)} /></Field>
            <Field label="Método">
              <select className={iCls} value={metodo} onChange={e => setMetodo(e.target.value)}>
                {["MB Way", "Cartão", "Transferência", "Multibanco", "PayPal"].map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setNovo(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button disabled={!nome.trim() || !curso} onClick={() => {
              setLista(xs => [{
                id: `TRX-${Date.now() % 100000}`,
                nome: nome.trim(), valor: Number(valor) || 0, metodo, curso,
                data: nowStamp(), estado: "Pago",
              }, ...xs]);
              setNovo(false);
            }} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">Registar</button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

// ─── Pesquisa Global (Ctrl+K) ─────────────────────────────────────────────────

const allSearchable: Array<{ tipo: string; nome: string; sub: string } & NavTarget> = [
  ...formandosTurmasData.map(f => ({ tipo: "Formando Gold", nome: `${f.nome} ${f.apelido}`, sub: f.email, view: "gold-formandos-turmas" as View })),
  ...finFormandosData.map(f => ({ tipo: "Formando Financiado", nome: `${f.nome} ${f.apelido}`, sub: f.email, view: "fin-formandos" as View })),
  ...turmasGoldData.map(t => ({ tipo: "Turma Gold", nome: t.nome, sub: `${t.local} · ${t.curso}`, view: "gold-cockpit-turma" as View, turmaId: t.id, tab: "overview" as CockpitTab })),
  ...finTurmasData.map(t => ({ tipo: "Turma Financiada", nome: t.nome, sub: `UFCD ${t.ufcdCod}`, view: "fin-cockpit-turma" as View, turmaId: t.id, tab: "overview" as CockpitTab })),
  ...cursosGoldData.map(c => ({ tipo: "Curso Gold", nome: c.nome, sub: c.categoria, view: "gold-curso-ficha" as View, cursoId: c.id })),
  ...finCursosData.map(c => ({ tipo: "UFCD", nome: `${c.ufcdCod} · ${c.ufcd}`, sub: c.nomeComercial, view: "fin-curso-ficha" as View, cursoId: c.id })),
  { tipo: "DTP", nome: "Dossiê da turma VNG-SM-07/09", sub: "CCP · Gold", view: "gold-cockpit-turma" as View, turmaId: 943, tab: "dtp" as CockpitTab },
  { tipo: "DTP", nome: "Dossiê da turma UFCD 3564 · T1", sub: "Primeiros Socorros · Financiada", view: "fin-cockpit-turma" as View, turmaId: 218, tab: "dtp" as CockpitTab },
  { tipo: "Inquérito", nome: "Satisfação CCP", sub: "Gold · 5 perguntas", view: "gold-inqueritos" as View },
  { tipo: "Inquérito", nome: "Satisfação UFCD 3564", sub: "Financiada · 4 perguntas", view: "fin-inqueritos" as View },
  ...FORMADORES_SEED.map(f => ({
    tipo: f.regimes.includes("gold") ? "Formador Gold" : "Formador Financiado",
    nome: f.nome,
    sub: f.especialidade || f.email,
    view: (f.regimes.includes("gold") ? "gold-formadores" : "fin-formadores") as View,
  })),
];

function GlobalSearch({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (t: NavTarget) => void }) {
  const [q, setQ] = useState("");
  const results = q.length > 1 ? allSearchable.filter(r => `${r.nome} ${r.sub} ${r.tipo}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); open ? onClose() : undefined; }
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const tipoColor: Record<string, string> = {
    "Formando Gold": "bg-amber-100 text-amber-700", "Formando Financiado": "bg-blue-100 text-blue-700",
    "Turma Gold": "bg-violet-100 text-violet-700", "Turma Financiada": "bg-teal-100 text-teal-700",
    "Curso Gold": "bg-orange-100 text-orange-700", "UFCD": "bg-emerald-100 text-emerald-700",
    "Formador Gold": "bg-violet-100 text-violet-700", "Formador Financiado": "bg-blue-100 text-blue-700",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ animation: "scaleIn 0.15s ease" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <span className="text-slate-400">{I.cmdK}</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar formandos, turmas, cursos, UFCD…"
            className="flex-1 text-sm text-slate-800 placeholder-slate-400 focus:outline-none" />
          <kbd className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>
        {q.length > 1 && (
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">Sem resultados para "{q}"</p>
            ) : results.map((r, i) => (
              <button key={i} onClick={() => { onNavigate({ view: r.view, turmaId: r.turmaId, tab: r.tab }); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${tipoColor[r.tipo] ?? "bg-slate-100 text-slate-600"}`}>{r.tipo}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.nome}</p>
                  <p className="text-xs text-slate-400 truncate">{r.sub}</p>
                </div>
                <span className="text-slate-300 flex-shrink-0">{I.chevRight}</span>
              </button>
            ))}
          </div>
        )}
        {q.length <= 1 && (
          <div className="px-4 py-4 grid grid-cols-2 gap-2">
            {[
              { l: "Pré-Inscrições", v: "gold-preinscricoes" as View }, { l: "Turmas Gold", v: "gold-turmas" as View },
              { l: "Dossiê TP Gold", v: "gold-dtp" as View }, { l: "Inquéritos Gold", v: "gold-inqueritos" as View },
            ].map(s => (
              <button key={s.l} onClick={() => { onNavigate({ view: s.v }); onClose(); }}
                className="text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors">{s.l}</button>
            ))}
          </div>
        )}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex gap-4 text-xs text-slate-400">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>ESC fechar</span>
        </div>
      </div>
    </div>
  );
}

// ─── Notificações ─────────────────────────────────────────────────────────────

function NotificacoesPanel({ onNavigate, onClose }: { onNavigate: (t: NavTarget) => void; onClose: () => void }) {
  const [items, setItems] = useState(notificacoesData);
  const naoLidas = items.filter(n => !n.lida).length;

  function markRead(id: number) { setItems(p => p.map(n => n.id === id ? { ...n, lida: true } : n)); }
  function markAllRead() { setItems(p => p.map(n => ({ ...n, lida: true }))); }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50" style={{ animation: "dropIn 0.15s ease" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-800">Notificações</p>
          {naoLidas > 0 && <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{naoLidas}</span>}
        </div>
        {naoLidas > 0 && <button onClick={markAllRead} className="text-xs text-amber-600 hover:text-amber-700 font-semibold">Marcar todas como lidas</button>}
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
        {items.map(n => (
          <button key={n.id} onClick={() => { markRead(n.id); onNavigate({ view: n.view, turmaId: n.turmaId, tab: n.tab }); onClose(); }}
            className={`w-full flex gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${n.lida ? "opacity-60" : ""}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${n.tipo === "warn" ? "bg-amber-100 text-amber-600" : n.tipo === "error" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
              {n.tipo === "error" ? I.warn : n.tipo === "warn" ? I.warn : I.info}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <p className="text-xs font-semibold text-slate-800 leading-snug">{n.titulo}</p>
                {!n.lida && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-0.5" />}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.texto}</p>
              <p className="text-xs text-slate-400 mt-1">há {n.tempo}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-slate-100 text-center">
        <button className="text-xs text-amber-600 hover:text-amber-700 font-semibold">Ver todas as notificações</button>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

type NavGroup = { group: string; items: NavLeaf[] };
type NavLeaf = { label: string; view?: View; icon: React.ReactNode; children?: { label: string; view: View }[] };

const sidebarConfig: NavGroup[] = [
  { group: "Principal", items: [{ label: "Painel", view: "painel", icon: I.home }] },
  { group: "Gold", items: [
    { label: "Pré-Inscrições", view: "gold-preinscricoes", icon: I.clipboard },
    { label: "Formandos", icon: I.users, children: [{ label: "Formandos Turmas", view: "gold-formandos-turmas" }, { label: "Formandos Gold", view: "gold-formandos-gold" }] },
    { label: "Campanhas", view: "gold-campanhas", icon: I.megaphone },
    { label: "Edição de Cursos", icon: I.book, children: [
      { label: "Cursos Gold", view: "gold-cursos" }, { label: "Módulos", view: "gold-modulos" },
      { label: "Conteúdos", view: "gold-conteudos" }, { label: "Datas", view: "gold-datas" },
      { label: "Locais", view: "gold-locais" }, { label: "Áreas Temáticas", view: "gold-areas-tematicas" },
    ]},
    { label: "Turmas", view: "gold-turmas", icon: I.school },
    { label: "Formadores", view: "gold-formadores", icon: I.person },
    { label: "Dossiê TP", view: "gold-dtp", icon: I.folder },
    { label: "Inquéritos", view: "gold-inqueritos", icon: I.doc },
  ]},
  { group: "Financiada", items: [
    { label: "Inscrições", view: "fin-inscricoes", icon: I.clipboard },
    { label: "Formandos", view: "fin-formandos", icon: I.users },
    { label: "Turmas", view: "fin-turmas", icon: I.school },
    { label: "Formadores", view: "fin-formadores", icon: I.person },
    { label: "Cursos", view: "fin-cursos", icon: I.book },
    { label: "Dossiê TP", view: "fin-dtp", icon: I.folder },
    { label: "Inquéritos", view: "fin-inqueritos", icon: I.doc },
  ]},
  { group: "Gestão", items: [
    { label: "Blog", icon: I.blog, children: [{ label: "Posts", view: "blog-posts" }, { label: "Temáticas", view: "blog-tematicas" }] },
  ]},
  { group: "Sistema", items: [
    { label: "Emails Automáticos", view: "emails", icon: I.mail },
    { label: "Pagamentos", view: "pagamentos", icon: I.creditcard },
    { label: "Configurações", view: "configuracoes", icon: I.settings },
  ]},
];

function SidebarNav({ view, onNavigate, onClose }: { view: View; onNavigate: (v: View | NavTarget) => void; onClose?: () => void }) {
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const open: string[] = ["Principal"];
    sidebarConfig.forEach(g => {
      if (g.items.some(item => item.view === view || item.children?.some(c => c.view === view))) open.push(g.group);
    });
    return open;
  });
  const [openLeaves, setOpenLeaves] = useState<string[]>(() => {
    const open: string[] = [];
    sidebarConfig.forEach(g => g.items.forEach(item => {
      if (item.children?.some(c => c.view === view)) open.push(item.label);
    }));
    return open;
  });

  function toggleGroup(name: string) { setOpenGroups(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]); }
  function toggleLeaf(label: string) { setOpenLeaves(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]); }
  function isActive(v?: View) {
    if (v === view) return true;
    if (v === "gold-turmas" && view === "gold-cockpit-turma") return true;
    if (v === "fin-turmas" && view === "fin-cockpit-turma") return true;
    return false;
  }
  function groupHasActive(g: NavGroup) {
    return g.items.some(item => isActive(item.view) || item.children?.some(c => isActive(c.view)));
  }
  function leafHasActive(item: NavLeaf) { return item.view === view || item.children?.some(c => c.view === view); }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-14 flex-shrink-0 border-b border-white/10">
        <button onClick={() => { onNavigate("painel"); onClose?.(); }}
          className="bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-sm px-3.5 py-1.5 rounded-lg tracking-widest transition-colors">GESFORMA</button>
        {onClose && <button onClick={onClose} className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">{I.x}</button>}
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-hide">
        {sidebarConfig.map(group => {
          const isOpen = openGroups.includes(group.group);
          const hasActive = groupHasActive(group);
          if (group.group === "Principal") {
            return (
              <div key={group.group} className="mb-1">
                {group.items.map(item => (
                  <button key={item.label} onClick={() => { item.view && onNavigate(item.view); onClose?.(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive(item.view) ? "bg-amber-500 text-white font-semibold" : "text-slate-400 hover:text-white hover:bg-white/10"}`}>
                    <span className="flex-shrink-0">{item.icon}</span><span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            );
          }
          return (
            <div key={group.group} className="mb-1">
              <button onClick={() => toggleGroup(group.group)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${isOpen ? "bg-white/10" : ""}`}>
                <span className={`text-xs font-bold uppercase tracking-widest flex-1 text-left ${isOpen ? "text-slate-300" : "text-slate-500"}`}>{group.group}</span>
                {hasActive && !isOpen && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                <span className={`flex-shrink-0 transition-transform text-slate-500 ${isOpen ? "rotate-90" : ""}`}>{I.chevRight}</span>
              </button>
              {isOpen && (
                <div className="mt-0.5 ml-2 space-y-0.5 border-l border-white/10 pl-2">
                  {group.items.map(item => (
                    <div key={item.label}>
                      {item.children ? (
                        <>
                          <button onClick={() => toggleLeaf(item.label)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${leafHasActive(item) ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/10"}`}>
                            <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                            <span className="flex-1 text-left truncate text-xs">{item.label}</span>
                            <span className={`transition-transform flex-shrink-0 ${openLeaves.includes(item.label) ? "rotate-90" : ""}`}>{I.chevRight}</span>
                          </button>
                          {openLeaves.includes(item.label) && (
                            <div className="ml-6 mt-0.5 space-y-0.5">
                              {item.children.map(child => (
                                <button key={child.label} onClick={() => { onNavigate(child.view); onClose?.(); }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${isActive(child.view) ? "bg-amber-500 text-white font-semibold" : "text-slate-500 hover:text-white hover:bg-white/10"}`}>
                                  {child.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <button onClick={() => { item.view && onNavigate(item.view); onClose?.(); }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${isActive(item.view) ? "bg-amber-500 text-white font-semibold" : "text-slate-400 hover:text-white hover:bg-white/10"}`}>
                          <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                          <span className="truncate text-xs">{item.label}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="flex-shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-bold">T</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white">Tania</p><p className="text-xs text-slate-500">Administradora</p></div>
          <button title="Sair" className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors">{I.power}</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

const viewTitles: Partial<Record<View, string>> = {
  painel: "Painel", "gold-preinscricoes": "Pré-Inscrições Gold",
  "gold-formandos-turmas": "Formandos Turmas", "gold-formandos-gold": "Formandos Gold",
  "gold-campanhas": "Campanhas", "gold-cursos": "Cursos Gold", "gold-curso-ficha": "Ficha do curso", "gold-datas": "Datas Gold",
  "gold-locais": "Locais", "gold-areas-tematicas": "Áreas Temáticas",
  "gold-modulos": "Módulos", "gold-conteudos": "Conteúdos",
  "gold-turmas": "Turmas Gold", "gold-formadores": "Formadores Gold", "gold-cockpit-turma": "Cockpit da Turma", "gold-dtp": "Dossiê TP - Gold",
  "gold-inqueritos": "Inquéritos - Gold",
  "fin-inscricoes": "Inscrições Financiadas", "fin-formandos": "Formandos Financiados",
  "fin-cursos": "Cursos Financiados", "fin-curso-ficha": "Ficha UFCD", "fin-turmas": "Turmas Financiadas", "fin-formadores": "Formadores Financiada", "fin-presencas": "Sessões da turma",
  "fin-dtp": "Dossiê TP - Financiada", "fin-cockpit-turma": "Cockpit da Turma Financiada",
  "fin-inqueritos": "Inquéritos - Financiada",
  formadores: "Formadores Gold", "blog-posts": "Blog - Posts", "blog-tematicas": "Blog - Temáticas",
  emails: "Emails Automáticos", pagamentos: "Pagamentos", configuracoes: "Configurações",
};

export default function App() {
  return (
    <ListsProvider seeds={{
      preinscricoes: preinscricoesData,
      formandosTurmas: formandosTurmasData,
      formandosFin: finFormandosData,
      cursosGold: cursosGoldData,
      cursosFin: finCursosData,
      blogPosts: blogPostsData,
      campanhas: campanhasData,
    }}>
      <AppShell />
    </ListsProvider>
  );
}

function AppShell() {
  const [view, setView] = useState<View>("painel");
  const [cockpitId, setCockpitId] = useState<number | undefined>();
  const [finCockpitId, setFinCockpitId] = useState<number | undefined>();
  const [cockpitTab, setCockpitTab] = useState<CockpitTab>("overview");
  const [cursoFichaId, setCursoFichaId] = useState<number | "new" | undefined>();
  const [moduloCurso, setModuloCurso] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const go = useCallback((v: View) => {
    setView(v); setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const navigate = useCallback((target: View | NavTarget) => {
    const t: NavTarget = typeof target === "string" ? { view: target } : target;
    if (t.view === "gold-cockpit-turma") {
      setCockpitId(t.turmaId); setCockpitTab(t.tab ?? "overview");
    }
    if (t.view === "fin-cockpit-turma") {
      setFinCockpitId(t.turmaId); setCockpitTab(t.tab ?? "overview");
    }
    if (t.view === "gold-curso-ficha" || t.view === "fin-curso-ficha") {
      setCursoFichaId(t.cursoId ?? "new");
    }
    if (t.view === "gold-modulos") {
      setModuloCurso(t.cursoNome);
    }
    go(t.view);
  }, [go]);

  function openCockpit(id: number, tab: CockpitTab = "overview") { setCockpitId(id); setCockpitTab(tab); setView("gold-cockpit-turma"); }
  function openFinCockpit(id: number, tab: CockpitTab = "overview") { setFinCockpitId(id); setCockpitTab(tab); setView("fin-cockpit-turma"); }

  // Ctrl+K
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(p => !p); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Close notif on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Close sidebar overlay
  useEffect(() => {
    const h = (e: MouseEvent) => { if (overlayRef.current === e.target) setSidebarOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const naoLidas = notificacoesData.filter(n => !n.lida).length;

  function renderView() {
    switch (view) {
      case "painel": return <PainelView onNavigate={navigate} />;
      case "gold-cursos": return <CursosGoldView onOpen={id => { setCursoFichaId(id); go("gold-curso-ficha"); }} />;
      case "gold-curso-ficha": return <GoldCursoFichaScreen cursoId={cursoFichaId} onBack={() => navigate("gold-cursos")} onOpenModulos={nome => navigate({ view: "gold-modulos", cursoNome: nome })} />;
      case "gold-turmas": return <TurmasGoldView onCockpit={openCockpit} />;
      case "gold-cockpit-turma": return <CockpitTurmaView turmaId={cockpitId} initialTab={cockpitTab} onBack={() => navigate("gold-turmas")} onNavigate={navigate} />;
      case "gold-dtp": return <DtpTurmasPicker regime="gold" onOpen={(id) => openCockpit(id, "dtp")} />;
      case "gold-preinscricoes": return <PreInscricoesGoldView />;
      case "gold-formandos-turmas": return <FormandosTurmasView />;
      case "gold-formandos-gold": return <FormandosGoldView />;
      case "gold-campanhas": return <CampanhasView />;
      case "gold-datas": return <DatasGoldView />;
      case "gold-locais": return <LocaisView />;
      case "gold-areas-tematicas": return <AreasTematicasView />;
      case "gold-modulos": return <ModulosView cursoInicial={moduloCurso} />;
      case "gold-conteudos": return <ConteudosView />;
      case "gold-inqueritos": return <InqueritosView acento="gold" />;
      case "gold-formadores":
      case "formadores": return <FormadoresView regime="gold" />;
      case "fin-inscricoes": return <FinInscricoesView />;
      case "fin-formandos": return <FinFormandosView />;
      case "fin-cursos": return <FinCursosView onOpen={id => { setCursoFichaId(id); go("fin-curso-ficha"); }} />;
      case "fin-curso-ficha": return <FinCursoFichaScreen cursoId={cursoFichaId} onBack={() => navigate("fin-cursos")} />;
      case "fin-turmas": return <FinTurmasView onCockpit={openFinCockpit} />;
      case "fin-presencas": {
        const tid = finCockpitId ?? 218;
        return <FinCockpitTurmaView turmaId={tid} initialTab="sessoes" onBack={() => navigate("fin-turmas")} onNavigate={navigate} />;
      }
      case "fin-dtp": return <DtpTurmasPicker regime="fin" onOpen={(id) => openFinCockpit(id, "dtp")} />;
      case "fin-cockpit-turma": return <FinCockpitTurmaView turmaId={finCockpitId} initialTab={cockpitTab} onBack={() => navigate("fin-turmas")} onNavigate={navigate} />;
      case "fin-inqueritos": return <InqueritosView acento="fin" />;
      case "fin-formadores": return <FormadoresView regime="fin" />;
      case "blog-posts": return <BlogView />;
      case "blog-tematicas": return <BlogTematicasView />;
      case "emails": return <EmailsView />;
      case "pagamentos": return <PagamentosView />;
      case "configuracoes": return <ConfiguracoesView />;
      default: return <PainelView onNavigate={navigate} />;
    }
  }

  return (
    <>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .scrollbar-hide { scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="flex h-full bg-slate-100">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-60 flex-col bg-[#0F172A] flex-shrink-0 h-full sticky top-0">
          <SidebarNav view={view} onNavigate={navigate} />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div ref={overlayRef} className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm">
            <aside className="w-64 h-full bg-[#0F172A] flex flex-col shadow-2xl">
              <SidebarNav view={view} onNavigate={navigate} onClose={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 min-h-full">
          {/* Top bar */}
          <header className="sticky top-0 z-30 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-14 flex-shrink-0 shadow-sm">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors">{I.menu}</button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-slate-800 truncate">{viewTitles[view] ?? ""}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Global search button */}
              <button onClick={() => setSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                {I.cmdK}<span>Pesquisar</span><kbd className="font-mono text-slate-300">⌘K</kbd>
              </button>
              <button onClick={() => setSearchOpen(true)} className="sm:hidden p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">{I.search}</button>

              {/* Notifications */}
              <div ref={notifRef} className="relative">
                <button onClick={() => setNotifOpen(p => !p)} className="relative p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                  {I.bell}
                  {naoLidas > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
                </button>
                {notifOpen && <NotificacoesPanel onNavigate={v => { navigate(v); setNotifOpen(false); }} onClose={() => setNotifOpen(false)} />}
              </div>

              <a href="https://ena.pt" target="_blank" rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                {I.link} <span>ena.pt</span>
              </a>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-5 overflow-auto">{renderView()}</main>

          <footer className="bg-white border-t border-slate-100 px-5 py-2.5 text-center flex-shrink-0">
            <p className="text-xs text-slate-400">GesForma © 2026 · <span className="font-semibold text-slate-500">ENA</span> - Escola de Negócios e Administração</p>
          </footer>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigate} />
    </>
  );
}
