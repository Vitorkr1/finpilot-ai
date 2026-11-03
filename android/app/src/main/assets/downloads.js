(() => {
  if (window.__criaosDownloadsInstalled || !window.CriaOSFiles) return;
  window.__criaosDownloadsInstalled = true;
  const nativePort = window.CriaOSFiles;
  let busy = false;
  nativePort.onmessage = (reply) => {
    busy = false;
    try { const result = JSON.parse(reply.data); if (result.error) alert(result.error); } catch {}
  };
  document.addEventListener('click', async (event) => {
    const link = event.target.closest?.('a[download]');
    if (!link || !link.href.startsWith(`blob:${window.location.origin}/`)) return;
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const response = await fetch(link.href);
      const blob = await response.blob();
      if (blob.size > 16 * 1024 * 1024) throw new Error('Arquivo maior que 16 MB. Baixe pelo navegador.');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        reader.readAsDataURL(blob);
      });
      nativePort.postMessage(JSON.stringify({ type: 'save-file', name: link.download, data }));
    } catch (error) { busy = false; alert(error.message || 'Não foi possível salvar o arquivo.'); }
  }, true);
})();
