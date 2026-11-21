export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
export type OrderDocument = {name:string; mime:string; base64?:string; uploadId?:string; category:"Grunddaten"};
export function documentName(value:unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 240 || !/^[^/\\\x00-\x1f\x7f]+$/.test(value)) throw new Error("Ungültiger Dateiname.");
  return value;
}
export function validateDocument(value:unknown): OrderDocument {
  if (!value || typeof value !== "object") throw new Error("Für E-Mail bitte ein Dokument hochladen.");
  const file=value as Record<string,unknown>;
  const name=documentName(file.name);
  if (typeof file.uploadId === "string" && /^[a-f0-9-]{36}$/.test(file.uploadId)) return {name,mime:"application/octet-stream",uploadId:file.uploadId,category:"Grunddaten"};
  // Compatibility for previously persisted inline documents; new HTTP uploads use binary storage.
  if (typeof file.base64 !== "string" || file.base64.length > Math.ceil(MAX_DOCUMENT_BYTES/3)*4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) throw new Error("Ungültiges Dokument.");
  const bytes=Buffer.from(file.base64,"base64");
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new Error("Dokument muss zwischen 1 Byte und 100 MB groß sein.");
  return {name,mime:"application/octet-stream",base64:file.base64,category:"Grunddaten"};
}
export async function readUpload(body:ReadableStream<Uint8Array> | null): Promise<Buffer> {
  if (!body) throw new Error("Datei fehlt.");
  const reader=body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true) {const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_DOCUMENT_BYTES){await reader.cancel();throw new Error("Datei überschreitet 100 MB.");}chunks.push(value);}
    if (!size) throw new Error("Datei ist leer.");
    return Buffer.concat(chunks,size);
  } finally {reader.releaseLock();}
}
