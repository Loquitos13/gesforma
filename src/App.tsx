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
  getParametrosAvaliacao, setParametrosAvaliacao,
  type PlanoSessaoData, type SessaoMeta, type SumarioSessaoData, type ResolveDocTarget, type PipItem, type SimItem,
  type CriterioAvaliacao,
} from "./TurmaExtras";
import { ResolverDocumentoModal } from "./DocResolver";

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
};

// ─── Types ───────────────────────────────────────────────────────────────────

type View =
  | "painel" | "gold-preinscricoes" | "gold-formandos-turmas" | "gold-formandos-gold"
  | "gold-campanhas" | "gold-cursos" | "gold-datas" | "gold-locais" | "gold-areas-tematicas"
  | "gold-modulos" | "gold-conteudos" | "gold-turmas" | "gold-cockpit-turma" | "gold-dtp" | "gold-inqueritos"
  | "fin-inscricoes" | "fin-formandos" | "fin-cursos" | "fin-turmas" | "fin-presencas" | "fin-dtp" | "fin-cockpit-turma" | "fin-inqueritos"
  | "formadores" | "blog-posts" | "blog-tematicas"
  | "emails" | "pagamentos" | "configuracoes";

type CockpitTab = "overview" | "sessoes" | "documentos" | "dtp" | "certificados";
type NavTarget = { view: View; turmaId?: number; tab?: CockpitTab };

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
  { id: 947, dataInicio: "2026-09-03", nome: "2176/2026", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 16, vagas: 16, estado: "Ativo" },
  { id: 946, dataInicio: "2026-07-06", nome: "IRN LSB 01/09", curso: "Formação de Formadores - CCP", local: "Lisboa", horario: "Laboral Manhã", totalAlunos: 12, vagas: 16, estado: "Ativo" },
  { id: 945, dataInicio: "2026-09-15", nome: "BRG-PL-15/09", curso: "Formação de Formadores - CCP", local: "Braga", horario: "Pós Laboral", totalAlunos: 2, vagas: 16, estado: "Ativo" },
  { id: 944, dataInicio: "2026-09-21", nome: "BRG-SM-21/09", curso: "Formação de Formadores - CCP", local: "Braga", horario: "Sábado manhã", totalAlunos: 6, vagas: 16, estado: "Ativo" },
  { id: 943, dataInicio: "2026-09-07", nome: "VNG-SM-07/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Sábado manhã", totalAlunos: 10, vagas: 16, estado: "Ativo" },
  { id: 940, dataInicio: "2026-09-03", nome: "2175/2026", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 14, vagas: 16, estado: "Ativo" },
  { id: 939, dataInicio: "2026-09-04", nome: "VNG-PL-04/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Pós Laboral", totalAlunos: 9, vagas: 16, estado: "Ativo" },
  { id: 938, dataInicio: "2026-09-02", nome: "PEN-SM-02/09", curso: "Formação de Formadores - CCP", local: "Penafiel", horario: "Sábado manhã", totalAlunos: 13, vagas: 16, estado: "Ativo" },
  { id: 937, dataInicio: "2026-08-28", nome: "VNG-SM-28/08", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Sábado manhã", totalAlunos: 12, vagas: 16, estado: "Inactivo" },
  { id: 936, dataInicio: "2026-09-03", nome: "VNG-LM-03/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 12, vagas: 16, estado: "Inactivo" },
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

const formadoresData = [
  { id: 7, nome: "Isac Silva", telf: "914547554", email: "isacsilva1992@gmail.com" },
  { id: 8, nome: "Ivan Esteves", telf: "912370557", email: "exsorio2@gmail.com" },
  { id: 11, nome: "António Cardeal", telf: "915258691", email: "antoniocardeal71@gmail.com" },
  { id: 12, nome: "Cátia Pinheiro", telf: "91291929", email: "catiapinheiro@ena.pt" },
  { id: 19, nome: "Vânia Fernandes", telf: "967432879", email: "fernandes.c.vania@gmail.com" },
  { id: 20, nome: "Rosana Suarez", telf: "938039001", email: "roxana.suarez.costa@gmail.com" },
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
  { id: 2, nome: "Confirmação de pagamento", gatilho: "Pagamento confirmado", template: "payment_confirm", ativo: true, envios: 6379, taxaAbertura: 98.1 },
  { id: 3, nome: "Lembrete 24h antes do curso", gatilho: "24 horas antes do início", template: "reminder_24h", ativo: true, envios: 4892, taxaAbertura: 91.7 },
  { id: 5, nome: "Certificado de conclusão", gatilho: "Formando marcado como concluído", template: "certificate", ativo: true, envios: 3821, taxaAbertura: 99.2 },
  { id: 6, nome: "Reengajamento 30 dias", gatilho: "30 dias sem compra", template: "reengagement", ativo: false, envios: 8941, taxaAbertura: 76.3 },
];

const emailTemplates = [
  { id: 1, nome: "Boas-vindas", assunto: "Bem-vindo(a) à ENA! Confirme o seu interesse", editado: "2026-08-15", tipo: "welcome" },
  { id: 2, nome: "Confirmação de Pagamento", assunto: "Pagamento confirmado – {{curso}}", editado: "2026-07-22", tipo: "payment" },
  { id: 5, nome: "Certificado de Conclusão", assunto: "O seu certificado está disponível! 🎓", editado: "2026-08-01", tipo: "certificate" },
];

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
    "Ativo": "green", "Inactivo": "gray", "1º Contacto": "blue", "2º Contacto": "indigo",
    "Não contactado": "amber", "Pago": "teal", "Formando": "green", "Matriculado": "green",
    "Elegível": "teal", "A montar": "red", "A decorrer": "green", "Encerrada": "gray",
    "Reembolsado": "violet", "Pendente": "orange", "Realizada": "green", "Agendada": "blue",
  };
  return <Badge label={estado} variant={m[estado] ?? "gray"} />;
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
function NewBtn({ label, onClick }: { label: string; onClick?: () => void }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm whitespace-nowrap">{I.plus}{label}</button>;
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
  const h = 160;
  const gap = 8;
  const barW = (600 - gap * (data.length - 1)) / data.length;
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox="0 0 600 160" className="w-full h-40 block" role="img" aria-label="Receita mensal">
        {data.map((d, i) => {
          const bh = Math.max(6, (d.v / max) * (h - 8));
          const x = i * (barW + gap);
          const active = hover === i;
          const dim = hover !== null && !active;
          return (
            <g key={d.mes} onMouseEnter={() => setHover(i)} className="cursor-pointer">
              <rect x={x} y={0} width={barW} height={h} fill="transparent" />
              <rect
                x={x}
                y={active ? h - bh - 4 : h - bh}
                width={barW}
                height={active ? bh + 4 : bh}
                rx="4"
                fill={color}
                opacity={active ? 1 : dim ? 0.22 : i === data.length - 1 ? 1 : 0.5}
                style={{ transition: "opacity 160ms ease, y 160ms ease, height 160ms ease" }}
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%`, top: 4 }}
        >
          <div className="bg-slate-800 text-white rounded-lg px-2.5 py-1 shadow-lg whitespace-nowrap">
            <p className="text-xs font-semibold">{data[hover].mes}</p>
            <p className="text-xs text-emerald-300 font-bold">€ {data[hover].v.toLocaleString("pt-PT")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SlideOver Drawer ─────────────────────────────────────────────────────────

function SlideOver({ open, onClose, title, sub, children, width = "max-w-xl" }: {
  open: boolean; onClose: () => void; title: string; sub?: string;
  children: React.ReactNode; width?: string;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`w-full ${width} bg-white shadow-2xl flex flex-col h-full overflow-hidden`} style={{ animation: "slideInRight 0.22s ease" }}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-4">{I.x}</button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ animation: "scaleIn 0.18s ease" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">{I.xSm}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Ficha do Formando ────────────────────────────────────────────────────────

type FormandoRecord = typeof formandosTurmasData[number];

function FichaFormando({ formando, tipo = "gold", onClose }: { formando: FormandoRecord; tipo?: "gold" | "fin"; onClose: () => void }) {
  const [tab, setTab] = useState<"info" | "pagamentos" | "historico" | "notas">("info");
  const [nota, setNota] = useState("");
  const [notas, setNotas] = useState([
    { id: 1, texto: "Ligou a questionar sobre o horário de sábado. Confirmou presença.", data: "2026-09-02 10:15", autor: "Tania" },
  ]);

  const turma = turmasGoldData.find(t => t.id === formando.turmaId);

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
            <div className="flex items-center gap-2 mt-1">{estadoBadge(formando.estado)}<span className="text-xs text-slate-400">{formando.turma}</span></div>
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
      <div className="flex border-b border-slate-100 px-5 bg-white flex-shrink-0">
        {(["info", "pagamentos", "historico", "notas"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px ${tab === t ? "border-amber-500 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "info" ? "Informação" : t === "pagamentos" ? "Pagamento" : t === "historico" ? "Histórico" : "Notas"}
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

      {/* Footer actions */}
      <div className="flex-shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50 flex gap-2">
        <button className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5">{I.convert} Converter em Formando</button>
        <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">Fechar</button>
      </div>
    </div>
  );
}

// ─── Cockpit da Turma ─────────────────────────────────────────────────────────

const sessoesSample: SessaoMeta[] = [
  { n: 1, data: "Sáb, 07 Set 2026", hora: "09h–13h", formador: "Isac Silva", estado: "Realizada", plano: true, modulo: "Módulo 1 - Fundamentos da Formação Profissional", duracao: "4h" },
  { n: 2, data: "Sáb, 14 Set 2026", hora: "09h–13h", formador: "Isac Silva", estado: "Realizada", plano: true, modulo: "Módulo 2 - Planeamento e Organização da Formação", duracao: "4h" },
  { n: 3, data: "Sáb, 21 Set 2026", hora: "09h–13h", formador: "Isac Silva", estado: "Agendada", plano: false, modulo: "Módulo 2 - Planeamento e Organização da Formação", duracao: "4h" },
  { n: 4, data: "Sáb, 28 Set 2026", hora: "09h–13h", formador: "Isac Silva", estado: "Agendada", plano: false, modulo: "Módulo 3 - Comunicação e Dinamização de Grupos", duracao: "4h" },
  { n: 5, data: "Sáb, 05 Out 2026", hora: "09h–13h", formador: "Isac Silva", estado: "Agendada", plano: false, modulo: "Módulo 3 - Comunicação e Dinamização de Grupos", duracao: "4h" },
];

const finSessoesSample: SessaoMeta[] = [
  { n: 1, data: "Qua, 27 Ago 2026", hora: "19h–22h", formador: "Vânia Fernandes", estado: "Realizada", plano: true, modulo: "UFCD 3564 · Avaliação primária e SVB", duracao: "5h" },
  { n: 2, data: "Qua, 03 Set 2026", hora: "19h–22h", formador: "Vânia Fernandes", estado: "Realizada", plano: true, modulo: "UFCD 3564 · Trauma e hemorragias", duracao: "5h" },
  { n: 3, data: "Qua, 10 Set 2026", hora: "19h–22h", formador: "Vânia Fernandes", estado: "Agendada", plano: false, modulo: "UFCD 3564 · Queimaduras e intoxicações", duracao: "5h" },
  { n: 4, data: "Qua, 17 Set 2026", hora: "19h–22h", formador: "Vânia Fernandes", estado: "Agendada", plano: false, modulo: "UFCD 3564 · Emergências médicas", duracao: "5h" },
  { n: 5, data: "Qua, 24 Set 2026", hora: "19h–22h", formador: "Vânia Fernandes", estado: "Agendada", plano: false, modulo: "UFCD 3564 · Simulação e avaliação", duracao: "5h" },
];

function sumarioLabel(s?: SumarioSessaoData) {
  if (s?.assinado && sumarioPreenchido(s)) return "Ver sumário";
  if (sumarioPreenchido(s)) return "Assinar sumário";
  return "+ Preencher sumário";
}
function sumarioBtnCls(s: SumarioSessaoData | undefined, gold: boolean) {
  if (s?.assinado && sumarioPreenchido(s)) return "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100";
  return gold ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
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
    { label: "Cartão de cidadão", detalhe: "15/17 no dossier.", estado: "parcial" },
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

  const nomesFormandos = regime === "fin"
    ? finFormandosData.map(f => `${f.nome} ${f.apelido}`)
    : formandosTurmasData.map(f => `${f.nome} ${f.apelido}`);
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

function CertificadosTurmaTab({ onUpload }: { onUpload?: (id: number) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Elegíveis", v: certificadosSample.filter(c => c.presencas >= 75 && c.nota >= 10).length, color: "text-emerald-600", bg: "bg-emerald-50" },
          { l: "Não elegíveis", v: certificadosSample.filter(c => c.presencas < 75 || c.nota < 10).length, color: "text-red-600", bg: "bg-red-50" },
          { l: "Certificados emitidos", v: certificadosSample.filter(c => c.certificado).length, color: "text-blue-600", bg: "bg-blue-50" },
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
              {certificadosSample.map(c => {
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
  const turma = turmasGoldData.find(t => t.id === turmaId) ?? turmasGoldData[0];
  const membros = formandosTurmasData.filter(f => f.turmaId === turma.id);
  const pagos = membros.filter(f => f.pago).length;
  const vagasLivres = turma.vagas - turma.totalAlunos;
  const [fichaOpen, setFichaOpen] = useState<FormandoRecord | null>(null);
  const [tab, setTab] = useState<CockpitTab>(initialTab);
  const [planoSessao, setPlanoSessao] = useState<SessaoMeta | null>(null);
  const [planos, setPlanos] = useState<Record<number, PlanoSessaoData>>(defaultPlanos);
  const [sumarioSessao, setSumarioSessao] = useState<SessaoMeta | null>(null);
  const [sumarios, setSumarios] = useState<Record<number, SumarioSessaoData>>(defaultSumarios);
  const [presencasSession, setPresencasSession] = useState<SessaoMeta | null>(null);
  const [uploadCert, setUploadCert] = useState<number | null>(null);
  const [formadorOpen, setFormadorOpen] = useState(false);
  useEffect(() => { setTab(initialTab); }, [initialTab, turmaId]);

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
              </div>
              <p className="text-lg font-bold mt-1">{turma.curso}</p>
              <div className="flex flex-wrap gap-4 mt-2 text-slate-300 text-xs">
                <span className="flex items-center gap-1">{I.location} {turma.local}</span>
                <span className="flex items-center gap-1">{I.calendar} {turma.dataInicio}</span>
                <span className="flex items-center gap-1">{I.school} {turma.horario}</span>
              </div>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors">Editar turma</button>
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

        {tab === "dtp" && (
          <DtpPanel regime="gold" turma={{ codigo: turma.nome, id: turma.id, titulo: turma.curso, sub: `${turma.local} · ${turma.horario}` }} />
        )}
        {tab === "sessoes" && (
          <Card>
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Sessões - {turma.nome}</p>
              <NewBtn label="+ Nova Sessão" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>Nº</Th><Th>Data / Hora</Th><Th>Formador</Th><Th>Plano de Sessão</Th><Th>Sumário</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {sessoesSample.map(s => {
                    const sum = sumarios[s.n];
                    return (
                    <tr key={s.n} className="hover:bg-slate-50">
                      <Td><span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">{s.n}</span></Td>
                      <Td>
                        <p className="text-xs font-medium text-slate-800 whitespace-nowrap">{s.data}</p>
                        <p className="text-xs text-slate-400">{s.hora}</p>
                      </Td>
                      <Td className="text-xs font-medium text-slate-700">
                        <button onClick={() => setFormadorOpen(true)} className="hover:text-violet-700 font-medium">{s.formador}</button>
                      </Td>
                      <Td>
                        <button onClick={() => setPlanoSessao(s)}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${s.plano ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"}`}>
                          {s.plano ? "Ver plano" : "+ Preencher plano"}
                        </button>
                      </Td>
                      <Td>
                        <button onClick={() => setSumarioSessao(s)}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${sumarioBtnCls(sum, true)}`}>
                          {sumarioLabel(sum)}
                        </button>
                      </Td>
                      <Td>{estadoBadge(s.estado)}</Td>
                      <Td><div className="flex gap-1"><ActBtn icon={I.attend} label="Presenças" color={s.estado === "Realizada" ? "teal" : "gray"} onClick={() => s.estado === "Realizada" && setPresencasSession(s)} /><ActBtn icon={I.edit} label="Editar" /></div></Td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {tab === "documentos" && <DocumentosTurmaTab regime="gold" curso={turma.curso} />}
        {tab === "certificados" && <CertificadosTurmaTab onUpload={id => setUploadCert(id)} />}

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
            <NewBtn label="Adicionar" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Nome</Th><Th>Contacto</Th><Th>Inscrito a</Th><Th className="text-center">Pago</Th><Th>Método</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(membros.length > 0 ? membros : formandosTurmasData.slice(0, 4)).map(f => (
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
                      <div className="flex gap-1">
                        <ActBtn icon={I.eye} label="Ficha" onClick={() => setFichaOpen(f)} />
                        <ActBtn icon={f.pago ? I.receipt : I.euro} label={f.pago ? "Recibo" : "Marcar pago"} color={f.pago ? "gray" : "orange"} />
                        <ActBtn icon={I.trash} label="Remover" color="red" />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Formador + datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Formador</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 font-bold">I</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Isac Silva</p>
                <p className="text-xs text-slate-500">914 547 554</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setFormadorOpen(true)} className="flex-1 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg border border-violet-200">Ver perfil</button>
              <button className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg">Alterar</button>
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Próximas Sessões</p>
            <div className="space-y-2">
              {["Sáb, 07 Set 2026 · 09h–13h", "Sáb, 14 Set 2026 · 09h–13h", "Sáb, 21 Set 2026 · 09h–13h"].map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-slate-600">{s}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        </>}
      </div>

      <SlideOver open={!!fichaOpen} onClose={() => setFichaOpen(null)} title="Ficha do Formando" sub={fichaOpen ? `#${fichaOpen.id}` : ""}>
        {fichaOpen && <FichaFormando formando={fichaOpen} onClose={() => setFichaOpen(null)} />}
      </SlideOver>
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
      <PresencasSessaoModal open={!!presencasSession} onClose={() => setPresencasSession(null)} sessao={presencasSession ?? undefined} />
      <FileUploadModal open={uploadCert !== null} onClose={() => setUploadCert(null)} title="Carregar certificado" />
      <FormadorProfileSlideOver open={formadorOpen} onClose={() => setFormadorOpen(false)} nome="Isac Silva" />
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
  const isGold = regime === "gold";
  const rows = isGold
    ? turmasGoldData.map(t => ({ id: t.id, codigo: t.nome, curso: t.curso, extra: `${t.local} · ${t.horario}`, estado: t.estado, pct: dtpPctGold(t.id) }))
    : finTurmasData.map(t => ({ id: t.id, codigo: t.nome, curso: t.curso, extra: `UFCD ${t.ufcdCod} · ${t.formador}`, estado: t.estado, pct: dtpPctFin(t.id) }));
  return (
    <div className="space-y-4">
      <PageHeader
        title={isGold ? "Dossiê TP - Gold" : "Dossiê TP - Financiada"}
        sub="Na ENA o DTP vive dentro da turma. O código interno (VNG-SM-07/09, UFCD 3564) identifica a turma - não é uma “ação” à parte."
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

function FinCockpitTurmaView({ turmaId, onBack, initialTab = "overview" }: { turmaId?: number; onBack: () => void; initialTab?: CockpitTab }) {
  const turma = finTurmasData.find(t => t.id === turmaId) ?? finTurmasData.find(t => t.ufcdCod === "3564") ?? finTurmasData[0];
  const [tab, setTab] = useState<CockpitTab>(initialTab);
  const [formadorOpen, setFormadorOpen] = useState(false);
  const [uploadCert, setUploadCert] = useState<number | null>(null);
  useEffect(() => { setTab(initialTab); }, [initialTab, turmaId]);
  const prontos = Math.floor(turma.alunos * 0.8);
  const membros = finFormandosData.filter(f => f.curso === turma.curso || f.turma.includes(turma.ufcdCod));

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
            </div>
            <p className="text-lg font-bold mt-1">{turma.curso}</p>
            <div className="flex flex-wrap gap-4 mt-2 text-slate-300 text-xs">
              <span className="flex items-center gap-1">{I.location} {turma.local}</span>
              <span className="flex items-center gap-1">{I.calendar} {turma.dataInicio}</span>
              <span className="flex items-center gap-1">{I.school} {turma.formador} · {turma.horas}h</span>
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">Editar turma</button>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors">{I.download}</button>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300">{turma.alunos} formandos · {prontos} dossiers prontos</span>
            <span className="text-blue-300">{turma.alunosTotal} vagas</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="h-2 rounded-full bg-blue-400" style={{ width: `${(turma.alunos / turma.alunosTotal) * 100}%` }} />
          </div>
        </div>
      </div>
      <TurmaTabBar tab={tab} onChange={setTab} accent="fin" dtpPct={dtpPctFin(turma.id)} />
      {tab === "dtp" && (
        <DtpPanel regime="fin" turma={{ codigo: turma.ufcdCod === "3564" ? "UFCD 3564 · T1" : turma.nome, id: turma.id, titulo: turma.curso, sub: `UFCD ${turma.ufcdCod} · ${turma.horas}h` }} />
      )}
      {tab === "sessoes" && <PresencasView turmaId={turma.id} embedded />}
      {tab === "documentos" && <DocumentosTurmaTab regime="fin" curso={turma.curso} />}
      {tab === "certificados" && <CertificadosTurmaTab onUpload={id => setUploadCert(id)} />}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: "Código interno", v: turma.nome, c: "text-slate-800" },
              { l: "UFCD", v: turma.ufcdCod, c: "text-blue-600" },
              { l: "Formandos", v: `${turma.alunos}/${turma.alunosTotal}`, c: "text-slate-800" },
              { l: "Dossiers prontos", v: `${prontos}/${turma.alunos}`, c: prontos === turma.alunos ? "text-emerald-600" : "text-amber-600" },
            ].map(s => (
              <Card key={s.l} className="p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{s.l}</p>
                <p className={`text-lg font-bold ${s.c} truncate`}>{s.v}</p>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Formador</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 font-bold">{turma.formador[0]}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{turma.formador}</p>
                  <p className="text-xs text-slate-500">UFCD {turma.ufcdCod} · {turma.horas}h</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setFormadorOpen(true)} className="flex-1 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg border border-violet-200">Ver perfil</button>
                <button className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg">Alterar</button>
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Formandos desta turma</p>
              <div className="space-y-2">
                {(membros.length ? membros : finFormandosData).slice(0, 4).map(f => (
                  <div key={f.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{f.nome} {f.apelido}</span>
                    {estadoBadge(f.estado)}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
      <FormadorProfileSlideOver open={formadorOpen} onClose={() => setFormadorOpen(false)} nome={turma.formador} />
      <FileUploadModal open={uploadCert !== null} onClose={() => setUploadCert(null)} title="Carregar certificado" accent="fin" />
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

function KanbanCard({ item, onClick }: { item: typeof preinscricoesData[number]; onClick: () => void }) {
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

function KanbanBoard({ onCardClick }: { onCardClick: (item: typeof preinscricoesData[number]) => void }) {
  const [items, setItems] = useState(preinscricoesData);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  function onDragStart(id: number) { setDragId(id); }
  function onDrop(col: string) {
    if (dragId === null) return;
    setItems(prev => prev.map(i => i.id === dragId ? { ...i, estado: col } : i));
    setDragId(null); setDragOver(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
      {kanbanCols.map(col => {
        const colItems = items.filter(i => i.estado === col.id);
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

function FichaComercial({ item, open, onClose }: { item: typeof preinscricoesData[number] | null; open: boolean; onClose: () => void }) {
  const [notas, setNotas] = useState("Ligou a perguntar sobre horários. Interessada em Sábado manhã.");
  const [proximoContacto, setProximoContacto] = useState("2026-09-06");
  if (!item) return null;
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
        <button className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2">{I.convert} Converter em Formando - Escolher turma</button>
      </div>
    </Modal>
  );
}

// ─── Dossier Financiada ───────────────────────────────────────────────────────

type FinFormando = typeof finFormandosData[number];
type DocKey = "cc" | "ch" | "cu" | "ci" | "ce";
const docLabels: Record<DocKey, string> = {
  cc: "Cartão de Cidadão", ch: "Certif. Habilitações", cu: "Curriculum Vitae", ci: "IBAN / Certif. Emprego", ce: "Comp. Emprego",
};

function DossierPanel({ formando }: { formando: FinFormando }) {
  const [docs, setDocs] = useState({ ...formando });
  const keys: DocKey[] = ["cc", "ch", "cu", "ci", "ce"];
  const completo = keys.every(k => docs[k].ok);

  return (
    <div className="p-5 space-y-5">
      {/* Status banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${completo ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${completo ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
          {completo ? I.check : I.warn}
        </div>
        <div>
          <p className={`text-sm font-bold ${completo ? "text-emerald-700" : "text-amber-700"}`}>
            {completo ? "Dossier completo" : `${keys.filter(k => !docs[k].ok).length} documentos em falta`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{docs.nome} {docs.apelido} · {docs.curso}</p>
        </div>
      </div>

      {/* Doc checklist */}
      <div className="space-y-2">
        {keys.map(k => (
          <div key={k} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${docs[k].ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <button onClick={() => setDocs(p => ({ ...p, [k]: { ok: !p[k].ok, data: !p[k].ok ? new Date().toISOString().slice(0, 10) : "" } }))}
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

// ─── Folha de Presenças ───────────────────────────────────────────────────────

function PresencasView({ turmaId, embedded }: { turmaId?: number; embedded?: boolean }) {
  type Presenca = { [key: number]: boolean };
  const sessoes = ["Sess. 1 · 27 Ago", "Sess. 2 · 03 Set", "Sess. 3 · 10 Set", "Sess. 4 · 17 Set", "Sess. 5 · 24 Set"];
  const [presencas, setPresencas] = useState<Record<number, Presenca>>(() => {
    const init: Record<number, Presenca> = {};
    finFormandosData.forEach(f => {
      init[f.id] = {};
      sessoes.forEach((_, si) => { init[f.id][si] = Math.random() > 0.25; });
    });
    return init;
  });
  const [sumarioSessao, setSumarioSessao] = useState<SessaoMeta | null>(null);
  const [sumarios, setSumarios] = useState<Record<number, SumarioSessaoData>>(defaultSumariosFin);

  function toggle(fId: number, si: number) {
    setPresencas(prev => ({ ...prev, [fId]: { ...prev[fId], [si]: !prev[fId][si] } }));
  }

  const turma = finTurmasData.find(t => t.id === turmaId) ?? finTurmasData.find(t => t.ufcdCod === "3564") ?? finTurmasData[2];

  return (
    <div className="space-y-4">
      {!embedded && <PageHeader title="Folha de Presenças" sub={`${turma.nome} · UFCD ${turma.ufcdCod} · ${turma.horas}h`}
        action={<button className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors">{I.download} Exportar</button>} />}
      {embedded && <p className="text-xs text-slate-500">Sessões da turma <span className="font-semibold text-slate-700">{turma.nome}</span> · UFCD {turma.ufcdCod} · {turma.horas}h</p>}

      <Card>
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Sessões - {turma.nome}</p>
          <span className="text-xs text-slate-500">{Object.values(sumarios).filter(s => s.assinado).length}/{finSessoesSample.length} sumários assinados</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Nº</Th><Th>Data / Hora</Th><Th>Formador</Th><Th>Sumário</Th><Th>Estado</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {finSessoesSample.map(s => {
                const sum = sumarios[s.n];
                return (
                  <tr key={s.n} className="hover:bg-slate-50">
                    <Td><span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{s.n}</span></Td>
                    <Td>
                      <p className="text-xs font-medium text-slate-800 whitespace-nowrap">{s.data}</p>
                      <p className="text-xs text-slate-400">{s.hora}</p>
                    </Td>
                    <Td className="text-xs font-medium text-slate-700">{s.formador}</Td>
                    <Td>
                      <button onClick={() => setSumarioSessao(s)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${sumarioBtnCls(sum, false)}`}>
                        {sumarioLabel(sum)}
                      </button>
                    </Td>
                    <Td>{estadoBadge(s.estado)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Turma summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "UFCD", v: turma.ufcdCod, c: "text-blue-600" },
          { l: "Formador", v: turma.formador, c: "text-slate-800" },
          { l: "Sessões", v: `${sessoes.length}`, c: "text-slate-800" },
          { l: "Horas totais", v: `${turma.horas}h`, c: "text-violet-600" },
        ].map(s => (
          <Card key={s.l} className="p-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider">{s.l}</p>
            <p className={`text-base font-bold ${s.c} mt-0.5`}>{s.v}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Registo de presenças</p>
          <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded" /> Presente</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" /> Falta</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Formando</Th>
                {sessoes.map(s => <Th key={s} className="text-center whitespace-nowrap">{s}</Th>)}
                <Th className="text-center">Assiduidade</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {finFormandosData.map(f => {
                const p = presencas[f.id] ?? {};
                const presentes = sessoes.filter((_, i) => p[i]).length;
                const pct = Math.round((presentes / sessoes.length) * 100);
                return (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <Td>
                      <p className="text-xs font-semibold text-slate-800">{f.nome} {f.apelido}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[120px]">{f.email}</p>
                    </Td>
                    {sessoes.map((_, si) => (
                      <Td key={si} className="text-center">
                        <button onClick={() => toggle(f.id, si)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-white transition-colors ${p[si] ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-400 hover:bg-red-500"}`}>
                          {p[si] ? I.check : I.xSm}
                        </button>
                      </Td>
                    ))}
                    <Td className="text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-bold ${pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}`}>{pct}%</span>
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 mt-1">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 75 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444" }} />
                        </div>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <button className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors">Guardar presenças</button>
        </div>
      </Card>
      <SumarioSessaoModal
        open={!!sumarioSessao}
        onClose={() => setSumarioSessao(null)}
        accent="fin"
        sessao={sumarioSessao ?? undefined}
        sumario={sumarioSessao ? (sumarios[sumarioSessao.n] ?? emptySumario()) : emptySumario()}
        onSave={data => { if (sumarioSessao) setSumarios(prev => ({ ...prev, [sumarioSessao.n]: data })); }}
      />
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
          <div className="flex justify-between mt-2">{receitaMensal.map(d => <span key={d.mes} className="text-xs text-slate-400 flex-1 text-center">{d.mes}</span>)}</div>
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
  const [fichaItem, setFichaItem] = useState<typeof preinscricoesData[number] | null>(null);
  const [fichaOpen, setFichaOpen] = useState(false);

  function openFicha(item: typeof preinscricoesData[number]) { setFichaItem(item); setFichaOpen(true); }

  const f = preinscricoesData.filter(x => `${x.nome} ${x.apelido} ${x.email} ${x.curso}`.toLowerCase().includes(s.toLowerCase()));
  const rows = f.slice((p - 1) * pp, p * pp);

  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Pré-Inscrições Gold" sub="16 537 pré-inscrições"
          action={
            <div className="flex items-center gap-2">
              <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
                <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${viewMode === "table" ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{I.list} Lista</button>
                <button onClick={() => setViewMode("kanban")} className={`px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${viewMode === "kanban" ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{I.kanban} Kanban</button>
              </div>
              <NewBtn label="+ Nova" />
            </div>
          }
        />

        {viewMode === "kanban" ? (
          <KanbanBoard onCardClick={openFicha} />
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
                          <ActBtn icon={I.edit} label="Editar" />
                          <ActBtn icon={I.trash} label="Eliminar" color="red" />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TableFooter page={p} perPage={pp} total={16537} onChange={setP} />
          </Card>
        )}
      </div>
      <FichaComercial item={fichaItem} open={fichaOpen} onClose={() => setFichaOpen(false)} />
    </>
  );
}

// ─── Turmas Gold ──────────────────────────────────────────────────────────────

function TurmasGoldView({ onCockpit }: { onCockpit: (id: number) => void }) {
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const f = turmasGoldData.filter(t => `${t.nome} ${t.local} ${t.curso}`.toLowerCase().includes(s.toLowerCase()));
  const rows = f.slice((p - 1) * pp, p * pp);
  return (
    <div className="space-y-4">
      <PageHeader title="Turmas Gold" sub="13 ativas · 167 total" action={<NewBtn label="+ Nova Turma" />} />
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
                    <Td>{estadoBadge(t.estado)}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <ActBtn icon={I.eye} label="Cockpit" onClick={() => onCockpit(t.id)} color="teal" />
                        <ActBtn icon={I.edit} label="Editar" />
                        <ActBtn icon={I.trash} label="Eliminar" color="red" />
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
    </div>
  );
}

// ─── Formandos Turmas ─────────────────────────────────────────────────────────

function FormandosTurmasView() {
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [fichaOpen, setFichaOpen] = useState<FormandoRecord | null>(null);
  const f = formandosTurmasData.filter(x => `${x.nome} ${x.apelido} ${x.turma}`.toLowerCase().includes(s.toLowerCase()));
  const rows = f.slice((p - 1) * pp, p * pp);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Formandos Turmas" sub="6 075 formandos em turma" />
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
                        <ActBtn icon={I.edit} label="Editar" />
                        <ActBtn icon={I.trash} label="Eliminar" color="red" />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} perPage={pp} total={6075} onChange={setP} />
        </Card>
      </div>
      <SlideOver open={!!fichaOpen} onClose={() => setFichaOpen(null)} title="Ficha do Formando" sub={fichaOpen ? `#${fichaOpen.id}` : ""}>
        {fichaOpen && <FichaFormando formando={fichaOpen} onClose={() => setFichaOpen(null)} />}
      </SlideOver>
    </>
  );
}

// ─── Formandos Financiada com Dossier ────────────────────────────────────────

function FinFormandosView() {
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [dossierOpen, setDossierOpen] = useState<FinFormando | null>(null);
  const f = finFormandosData.filter(x => `${x.nome} ${x.apelido} ${x.email}`.toLowerCase().includes(s.toLowerCase()));
  const rows = f.slice((p - 1) * pp, p * pp);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Formandos Financiados" sub="1 390 formandos" />
        <Card>
          <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Nome</Th><Th>Turma</Th><Th>Curso</Th><Th>Estado</Th>
                  <Th className="text-center">Documentos</Th>
                  <Th>Dossier</Th>
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
                      <Td className="text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-6 rounded-full text-xs font-bold ${complete ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                          {okCount}/5
                        </span>
                      </Td>
                      <Td>
                        <button onClick={() => setDossierOpen(r)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${complete ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                          {complete ? "✓ Completo" : `${5 - okCount} em falta`}
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} perPage={pp} total={1390} onChange={setP} />
        </Card>
      </div>
      <SlideOver open={!!dossierOpen} onClose={() => setDossierOpen(null)} title="Dossier do Formando" sub={dossierOpen ? `${dossierOpen.nome} ${dossierOpen.apelido}` : ""}>
        {dossierOpen && <DossierPanel formando={dossierOpen} />}
      </SlideOver>
    </>
  );
}

// ─── Turmas Financiadas ───────────────────────────────────────────────────────

function FinTurmasView({ onCockpit }: { onCockpit: (id: number, tab?: CockpitTab) => void }) {
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const f = finTurmasData.filter(t => `${t.nome} ${t.curso}`.toLowerCase().includes(s.toLowerCase()));
  const rows = f.slice((p - 1) * pp, p * pp);
  return (
    <div className="space-y-4">
      <PageHeader title="Turmas Financiadas" sub={`${finTurmasData.length} turmas`} action={<NewBtn label="+ Nova Turma" />} />
      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Id</Th><Th>Início</Th><Th>UFCD</Th><Th>Turma / Curso</Th><Th>Formador</Th><Th>Elegíveis</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
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
                        <p className="text-xs text-slate-400 truncate max-w-[160px]">{t.curso}</p>
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
                      <div className="flex gap-1">
                        <ActBtn icon={I.eye} label="Cockpit" color="teal" onClick={() => onCockpit(t.id, "overview")} />
                        <ActBtn icon={I.attend} label="Presenças" color="teal" onClick={() => onCockpit(t.id, "sessoes")} />
                        <ActBtn icon={I.doc} label="Dossiê da turma" color="orange" onClick={() => onCockpit(t.id, "dtp")} />
                        <ActBtn icon={I.edit} label="Editar" />
                        <ActBtn icon={I.euro} label="Faturação" color="green" />
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
    </div>
  );
}

// ─── Remaining views (simplified) ────────────────────────────────────────────

function slugCriterio(label: string, existing: CriterioAvaliacao[]) {
  const base = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "criterio";
  let id = base; let n = 2;
  while (existing.some(c => c.id === id)) { id = `${base}-${n}`; n += 1; }
  return id;
}

function CursosGoldView() {
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [open, setOpen] = useState<typeof cursosGoldData[number] | null>(null);
  const [criterios, setCriterios] = useState<CriterioAvaliacao[]>([]);
  const [novoCriterio, setNovoCriterio] = useState("");
  const f = cursosGoldData.filter(c => `${c.nome} ${c.categoria}`.toLowerCase().includes(s.toLowerCase()));
  const rows = f.slice((p - 1) * pp, p * pp);
  const temAvaliacao = !!open && (/ccp/i.test(open.nome) || /ccp/i.test(open.categoria));

  function abrir(c: typeof cursosGoldData[number]) {
    setOpen(c);
    setCriterios(getParametrosAvaliacao(c.nome).criterios);
    setNovoCriterio("");
  }

  function guardarCurso() {
    if (open && temAvaliacao) setParametrosAvaliacao(open.nome, criterios.filter(c => c.label.trim()));
    setOpen(null);
  }

  return (
    <div>
      <PageHeader title="Cursos Gold" action={<NewBtn label="+ Novo Curso" />} />
      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Id</Th><Th>Nome</Th><Th>Categoria</Th><Th>Tipo</Th><Th>Preço</Th><Th>Regime</Th><Th className="text-center">Horas</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td><IdCell id={c.id} /></Td>
                  <Td className="max-w-[200px]"><button onClick={() => abrir(c)} className="text-xs font-medium text-blue-600 leading-snug text-left hover:underline">{c.nome}</button></Td>
                  <Td className="text-xs text-slate-600 whitespace-nowrap">{c.categoria}</Td>
                  <Td><Badge label={c.tipo} variant={c.tipo === "Gold" ? "amber" : "gray"} /></Td>
                  <Td className="text-xs font-semibold text-amber-600">€ {c.preco}</Td>
                  <Td><span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.regime === "e-learning" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{c.regime}</span></Td>
                  <Td className="text-center text-xs text-slate-600">{c.horas || "-"}</Td>
                  <Td>{estadoBadge(c.estado)}</Td>
                  <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => abrir(c)} /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
      </Card>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={open?.nome ?? "Curso"} sub="Ficha do curso e parâmetros da folha de avaliação.">
        <div className="p-5 space-y-4">
          <Field label="Nome"><input className={iCls} defaultValue={open?.nome ?? ""} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria"><input className={iCls} defaultValue={open?.categoria ?? ""} /></Field>
            <Field label="Preço (€)"><input className={iCls} type="number" defaultValue={open?.preco ?? 0} /></Field>
          </div>
          {temAvaliacao && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Parâmetros de avaliação</p>
                <p className="text-xs text-slate-500 mt-0.5">A folha das simulações inicial e final usa estes critérios, à escala 1–5.</p>
              </div>
              <div className="space-y-2">
                {criterios.length === 0 && <p className="text-xs text-slate-500">Ainda não há critérios. Adiciona o primeiro abaixo.</p>}
                {criterios.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-5">{i + 1}</span>
                    <input className={iCls} value={c.label}
                      onChange={e => setCriterios(prev => prev.map(x => x.id === c.id ? { ...x, label: e.target.value } : x))} />
                    <button type="button" onClick={() => setCriterios(prev => prev.filter(x => x.id !== c.id))}
                      className="p-2 text-slate-400 hover:text-red-500" aria-label="Remover critério">{I.trash}</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className={iCls} value={novoCriterio} placeholder="Novo critério (ex. Gestão do tempo)"
                  onChange={e => setNovoCriterio(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && novoCriterio.trim()) {
                      setCriterios(prev => [...prev, { id: slugCriterio(novoCriterio, prev), label: novoCriterio.trim() }]);
                      setNovoCriterio("");
                    }
                  }} />
                <button type="button"
                  onClick={() => {
                    if (!novoCriterio.trim()) return;
                    setCriterios(prev => [...prev, { id: slugCriterio(novoCriterio, prev), label: novoCriterio.trim() }]);
                    setNovoCriterio("");
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 whitespace-nowrap">
                  + Critério
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setOpen(null)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={guardarCurso} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg">Guardar</button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

function FormadoresView() {
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const [perfil, setPerfil] = useState<typeof formadoresData[number] | null>(null);
  const f = formadoresData.filter(x => `${x.nome} ${x.email}`.toLowerCase().includes(s.toLowerCase()));
  return (
    <div className="space-y-4">
      <PageHeader title="Formadores" action={<NewBtn label="+ Novo Formador" />} />
      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Id</Th><Th>Nome</Th><Th>Telf</Th><Th>Email</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {f.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td><IdCell id={r.id} /></Td>
                  <Td><button onClick={() => setPerfil(r)} className="text-sm font-medium text-blue-600 hover:text-blue-800">{r.nome}</button></Td>
                  <Td className="font-mono text-xs text-slate-500">{r.telf}</Td>
                  <Td className="text-xs text-blue-600">{r.email}</Td>
                  <Td><div className="flex gap-1"><ActBtn icon={I.eye} label="Perfil" onClick={() => setPerfil(r)} /><ActBtn icon={I.doc} label="Docs" color="orange" onClick={() => setPerfil(r)} /><ActBtn icon={I.edit} label="Editar" /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TableFooter page={p} perPage={pp} total={f.length} onChange={setP} />
      </Card>
      <FormadorProfileSlideOver open={!!perfil} onClose={() => setPerfil(null)} nome={perfil?.nome ?? ""} telf={perfil?.telf} />
    </div>
  );
}

function BlogView() {
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const f = blogPostsData.filter(x => x.titulo.toLowerCase().includes(s.toLowerCase()));
  return (
    <div className="space-y-4">
      <PageHeader title="Blog - Posts" action={<NewBtn label="+ Novo Post" />} />
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
                  <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
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

function CampanhasView() {
  return (
    <div className="space-y-4">
      <PageHeader title="Campanhas" action={<NewBtn label="+ Nova Campanha" />} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {campanhasData.map(c => (
          <Card key={c.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-slate-800">{c.nome || <span className="italic text-slate-400">sem nome</span>}</p>
                <p className="text-xs text-slate-400 mt-0.5">{c.data} · {c.encarregado}</p>
              </div>
              <ActBtn icon={I.edit} label="Editar" />
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
    </div>
  );
}

function FinCursosView() {
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const f = finCursosData.filter(c => `${c.ufcd} ${c.nomeComercial}`.toLowerCase().includes(s.toLowerCase()));
  return (
    <div className="space-y-4">
      <PageHeader title="Cursos Financiados" action={<NewBtn label="+ Novo Curso" />} />
      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={setPp} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Cód. UFCD</Th><Th>UFCD</Th><Th>Nome Comercial</Th><Th>Regime</Th><Th className="text-center">Horas</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {f.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">{c.ufcdCod}</span></Td>
                  <Td className="text-xs text-blue-600 font-medium max-w-[180px]">{c.ufcd}</Td>
                  <Td className="text-xs text-slate-600 max-w-[200px]">{c.nomeComercial}</Td>
                  <Td><span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.regime === "e-learning" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{c.regime}</span></Td>
                  <Td className="text-center text-xs text-slate-600">{c.horas || "-"}</Td>
                  <Td>{estadoBadge(c.estado)}</Td>
                  <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
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
  return (
    <div className="space-y-5">
      <PageHeader title="Emails Automáticos" action={<NewBtn label="+ Nova Regra" />} />
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
                  <ActBtn icon={I.edit} label="Editar" />
                  <ActBtn icon={I.trash} label="Eliminar" color="red" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "templates" && (
        <Card>
          <div className="divide-y divide-slate-100">
            {emailTemplates.map(t => (
              <div key={t.id} className="px-4 py-4 flex items-center gap-3 hover:bg-slate-50">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white ${t.tipo === "welcome" ? "bg-blue-500" : t.tipo === "payment" ? "bg-emerald-500" : "bg-amber-500"}`}>{I.mail}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{t.nome}</p>
                  <p className="text-xs text-slate-500 truncate">{t.assunto}</p>
                  <p className="text-xs text-slate-400">Editado {t.editado}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <ActBtn icon={I.edit} label="Editar" />
                  <ActBtn icon={I.eye} label="Preview" color="gray" />
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
          <div className="p-4 text-center text-xs text-slate-400">Histórico detalhado disponível na versão completa</div>
        </Card>
      )}
    </div>
  );
}

function PagamentosView() {
  const [s, setS] = useState(""); const [p, setP] = useState(1); const [pp, setPp] = useState(10);
  const f = transacoesData.filter(t => `${t.nome} ${t.curso} ${t.metodo}`.toLowerCase().includes(s.toLowerCase()));
  return (
    <div className="space-y-5">
      <PageHeader title="Pagamentos" />
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
          <div className="flex justify-between mt-2">{receitaMensal.map(d => <span key={d.mes} className="text-xs text-slate-400 flex-1 text-center">{d.mes}</span>)}</div>
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
    </div>
  );
}

// ─── Pesquisa Global (Ctrl+K) ─────────────────────────────────────────────────

const allSearchable: Array<{ tipo: string; nome: string; sub: string } & NavTarget> = [
  ...formandosTurmasData.map(f => ({ tipo: "Formando Gold", nome: `${f.nome} ${f.apelido}`, sub: f.email, view: "gold-formandos-turmas" as View })),
  ...finFormandosData.map(f => ({ tipo: "Formando Financiado", nome: `${f.nome} ${f.apelido}`, sub: f.email, view: "fin-formandos" as View })),
  ...turmasGoldData.map(t => ({ tipo: "Turma Gold", nome: t.nome, sub: `${t.local} · ${t.curso}`, view: "gold-cockpit-turma" as View, turmaId: t.id, tab: "overview" as CockpitTab })),
  ...finTurmasData.map(t => ({ tipo: "Turma Financiada", nome: t.nome, sub: `UFCD ${t.ufcdCod}`, view: "fin-cockpit-turma" as View, turmaId: t.id, tab: "overview" as CockpitTab })),
  ...cursosGoldData.map(c => ({ tipo: "Curso Gold", nome: c.nome, sub: c.categoria, view: "gold-cursos" as View })),
  ...finCursosData.map(c => ({ tipo: "UFCD", nome: `${c.ufcdCod} · ${c.ufcd}`, sub: c.nomeComercial, view: "fin-cursos" as View })),
  { tipo: "DTP", nome: "Dossiê da turma VNG-SM-07/09", sub: "CCP · Gold", view: "gold-cockpit-turma" as View, turmaId: 943, tab: "dtp" as CockpitTab },
  { tipo: "DTP", nome: "Dossiê da turma UFCD 3564 · T1", sub: "Primeiros Socorros · Financiada", view: "fin-cockpit-turma" as View, turmaId: 218, tab: "dtp" as CockpitTab },
  { tipo: "Inquérito", nome: "Satisfação CCP", sub: "Gold · 5 perguntas", view: "gold-inqueritos" as View },
  { tipo: "Inquérito", nome: "Satisfação UFCD 3564", sub: "Financiada · 4 perguntas", view: "fin-inqueritos" as View },
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
    { label: "Dossiê TP", view: "gold-dtp", icon: I.folder },
    { label: "Inquéritos", view: "gold-inqueritos", icon: I.doc },
  ]},
  { group: "Financiada", items: [
    { label: "Inscrições", view: "fin-inscricoes", icon: I.clipboard },
    { label: "Formandos", view: "fin-formandos", icon: I.users },
    { label: "Turmas", view: "fin-turmas", icon: I.school },
    { label: "Presenças", view: "fin-presencas", icon: I.attend },
    { label: "Cursos", view: "fin-cursos", icon: I.book },
    { label: "Dossiê TP", view: "fin-dtp", icon: I.folder },
    { label: "Inquéritos", view: "fin-inqueritos", icon: I.doc },
  ]},
  { group: "Gestão", items: [
    { label: "Formadores", view: "formadores", icon: I.person },
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
  "gold-campanhas": "Campanhas", "gold-cursos": "Cursos Gold", "gold-datas": "Datas Gold",
  "gold-locais": "Locais", "gold-areas-tematicas": "Áreas Temáticas",
  "gold-modulos": "Módulos", "gold-conteudos": "Conteúdos",
  "gold-turmas": "Turmas Gold", "gold-cockpit-turma": "Cockpit da Turma", "gold-dtp": "Dossiê TP - Gold",
  "gold-inqueritos": "Inquéritos - Gold",
  "fin-inscricoes": "Inscrições Financiadas", "fin-formandos": "Formandos Financiados",
  "fin-cursos": "Cursos Financiados", "fin-turmas": "Turmas Financiadas", "fin-presencas": "Folha de Presenças",
  "fin-dtp": "Dossiê TP - Financiada", "fin-cockpit-turma": "Cockpit da Turma Financiada",
  "fin-inqueritos": "Inquéritos - Financiada",
  formadores: "Formadores", "blog-posts": "Blog - Posts", "blog-tematicas": "Blog - Temáticas",
  emails: "Emails Automáticos", pagamentos: "Pagamentos", configuracoes: "Configurações",
};

export default function App() {
  const [view, setView] = useState<View>("painel");
  const [cockpitId, setCockpitId] = useState<number | undefined>();
  const [finCockpitId, setFinCockpitId] = useState<number | undefined>();
  const [cockpitTab, setCockpitTab] = useState<CockpitTab>("overview");
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
      case "gold-cursos": return <CursosGoldView />;
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
      case "gold-modulos": return <ModulosView />;
      case "gold-conteudos": return <ConteudosView />;
      case "gold-inqueritos": return <InqueritosView acento="gold" />;
      case "fin-inscricoes": return <FinInscricoesView />;
      case "fin-formandos": return <FinFormandosView />;
      case "fin-cursos": return <FinCursosView />;
      case "fin-turmas": return <FinTurmasView onCockpit={openFinCockpit} />;
      case "fin-presencas": return <PresencasView />;
      case "fin-dtp": return <DtpTurmasPicker regime="fin" onOpen={(id) => openFinCockpit(id, "dtp")} />;
      case "fin-cockpit-turma": return <FinCockpitTurmaView turmaId={finCockpitId} initialTab={cockpitTab} onBack={() => navigate("fin-turmas")} />;
      case "fin-inqueritos": return <InqueritosView acento="fin" />;
      case "formadores": return <FormadoresView />;
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
