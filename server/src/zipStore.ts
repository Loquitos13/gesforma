import { deflateRawSync } from "node:zlib";
import { partesLisboa } from "./datas.js";

/** Formatos já comprimidos: entram tal como estão (comprimir de novo só gasta tempo da função). */
const JA_COMPRIMIDOS = /\.(pdf|jpe?g|png|webp|heic|gif|mp4|webm|mov|mp3|zip|docx|xlsx|pptx|odt|ods|odp|7z|gz|rar)$/i;

/** Bit 11 das flags: o nome vai em UTF-8 (sem ele o Windows mostra «SumÃ¡rios»). */
const FLAG_UTF8 = 0x0800;

/** Data e hora MS-DOS na hora de Lisboa (o explorador do Windows mostra-a tal como está). */
export function dataDos(instante: Date = new Date()) {
  const p = partesLisboa(instante);
  const ano = Math.max(1980, Number(p.ano));
  return {
    hora: (Number(p.hora) << 11) | (Number(p.minuto) << 5),
    data: ((ano - 1980) << 9) | (Number(p.mes) << 5) | Number(p.dia),
  };
}

function crc32(buf: Buffer) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function u16(n: number) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}
function u32(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

export function zipStore(files: { name: string; data: Buffer }[], instante: Date = new Date()) {
  const { hora, data: dia } = dataDos(instante);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name.replace(/\\/g, "/").replace(/^\/+/, ""), "utf8");
    const data = file.data;
    const crc = crc32(data);
    const compressed = JA_COMPRIMIDOS.test(file.name) ? null : deflateRawSync(data);
    const method = compressed && compressed.length < data.length ? 8 : 0;
    const payload = method === 8 ? compressed! : data;
    const local = Buffer.concat([
      Buffer.from("PK\u0003\u0004"),
      u16(20), u16(FLAG_UTF8), u16(method), u16(hora), u16(dia),
      u32(crc), u32(payload.length), u32(data.length),
      u16(name.length), u16(0),
      name, payload,
    ]);
    const central = Buffer.concat([
      Buffer.from("PK\u0001\u0002"),
      u16(20), u16(20), u16(FLAG_UTF8), u16(method), u16(hora), u16(dia),
      u32(crc), u32(payload.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.concat([
    Buffer.from("PK\u0005\u0006"),
    u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...locals, central, end]);
}
