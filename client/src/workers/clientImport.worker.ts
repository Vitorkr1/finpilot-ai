import { readClientFile } from '../lib/readClientFile'
self.onmessage = async (event: MessageEvent<{ name: string; buffer: ArrayBuffer }>) => {
  try { self.postMessage({ sheets: await readClientFile(event.data.name, event.data.buffer) }) }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Não foi possível ler a planilha.' }) }
}
