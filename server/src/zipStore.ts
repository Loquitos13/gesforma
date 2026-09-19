import { deflateRawSync } from "node:zlib";

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

export function zipStore(files: { name: string; data: Buffer }[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name.replace(/\\/g, "/").replace(/^\/+/, ""), "utf8");
    const data = file.data;
    const crc = crc32(data);
    const compressed = deflateRawSync(data);
    const use = compressed.length < data.length ? compressed : data;
    const method = compressed.length < data.length ? 8 : 0;
    const payload = method === 8 ? compressed : data;
    const local = Buffer.concat([
      Buffer.from("PK\u0003\u0004"),
      u16(20), u16(0), u16(method), u16(0), u16(0),
      u32(crc), u32(payload.length), u32(data.length),
      u16(name.length), u16(0),
      name, payload,
    ]);
    const central = Buffer.concat([
      Buffer.from("PK\u0001\u0002"),
      u16(20), u16(20), u16(0), u16(method), u16(0), u16(0),
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
