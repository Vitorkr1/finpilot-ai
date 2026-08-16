// ==========================================================================
// FinPilot AI — face-scan.js
// Scanner facial automático: carrega os modelos, guia o posicionamento do
// rosto na câmera e dispara a captura sozinho (sem exigir clique do usuário)
// assim que o rosto está bem posicionado e estável por um curto período.
// Usado tanto no login facial quanto no cadastro facial.
// ==========================================================================

(function (global) {
  // Cache dos modelos entre instâncias/páginas para não recarregar à toa.
  let modelsPromise = null;
  function loadFaceModels() {
    if (!modelsPromise) {
      modelsPromise = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
    }
    return modelsPromise;
  }

  const DETECTOR_OPTS = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5,
  });

  class FaceScan {
    /**
     * @param {Object} opts
     * @param {HTMLElement} opts.wrapEl      contêiner com [data-state]
     * @param {HTMLVideoElement} opts.videoEl
     * @param {HTMLElement} opts.statusTextEl elemento onde o texto de status é escrito
     * @param {HTMLElement} [opts.holdFillEl] barra de progresso (opcional)
     * @param {(descriptor:number[]) => Promise<void>} opts.onCapture
     *        chamado automaticamente quando o rosto é confirmado. Deve
     *        retornar/lançar erro em caso de falha (o scanner volta a procurar).
     * @param {number} [opts.holdMs] tempo de estabilidade exigido antes de capturar
     */
    constructor(opts) {
      this.wrapEl = opts.wrapEl;
      this.videoEl = opts.videoEl;
      this.statusTextEl = opts.statusTextEl;
      this.holdFillEl = opts.holdFillEl || null;
      this.onCapture = opts.onCapture;
      this.holdMs = opts.holdMs || 900;

      this.stream = null;
      this.loopHandle = null;
      this.running = false;
      this.busy = false; // captura em andamento (evita disparos duplicados)
      this.goodSince = null;
      this._detectInterval = 180; // ms entre detecções
      this._lastDetectAt = 0;
    }

    setState(state, text) {
      if (this.wrapEl) this.wrapEl.dataset.state = state;
      if (text && this.statusTextEl) this.statusTextEl.textContent = text;
    }

    async start() {
      this.setState("loading", "Carregando reconhecimento facial…");
      try {
        const [, stream] = await Promise.all([
          loadFaceModels(),
          navigator.mediaDevices.getUserMedia({
            video: { width: 480, height: 360, facingMode: "user" },
          }),
        ]);
        this.stream = stream;
        this.videoEl.srcObject = stream;
        await new Promise((resolve) => {
          if (this.videoEl.readyState >= 2) return resolve();
          this.videoEl.onloadedmetadata = () => resolve();
        });
        this.setState("searching", "Posicione o rosto dentro da área indicada");
        this.running = true;
        this._tick();
      } catch (err) {
        this.setState("error", "Não foi possível acessar a câmera.");
        throw err;
      }
    }

    stop() {
      this.running = false;
      if (this.loopHandle) cancelAnimationFrame(this.loopHandle);
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
    }

    _tick() {
      if (!this.running) return;
      this.loopHandle = requestAnimationFrame(() => this._tick());

      const now = performance.now();
      if (this.busy || now - this._lastDetectAt < this._detectInterval) return;
      this._lastDetectAt = now;
      this._detectFrame();
    }

    async _detectFrame() {
      if (!this.videoEl.videoWidth) return;
      let detection;
      try {
        detection = await faceapi
          .detectSingleFace(this.videoEl, DETECTOR_OPTS)
          .withFaceLandmarks()
          .withFaceDescriptor();
      } catch (e) {
        return; // frame instável, ignora e tenta no próximo tick
      }

      if (this.busy) return;

      if (!detection) {
        this.goodSince = null;
        this._setHold(0);
        this.setState("searching", "Posicione o rosto dentro da área indicada");
        return;
      }

      const aligned = this._isAligned(detection.detection.box);

      if (!aligned.ok) {
        this.goodSince = null;
        this._setHold(0);
        this.setState("align", aligned.hint);
        return;
      }

      // Rosto bem posicionado: começa (ou continua) a contagem de estabilidade.
      if (!this.goodSince) this.goodSince = performance.now();
      const elapsed = performance.now() - this.goodSince;
      const pct = Math.min(100, (elapsed / this.holdMs) * 100);
      this._setHold(pct);
      this.setState("good", "Mantenha a posição, reconhecendo…");

      if (elapsed >= this.holdMs) {
        this._confirm(detection.descriptor);
      }
    }

    _setHold(pct) {
      if (this.holdFillEl) this.holdFillEl.style.width = pct + "%";
    }

    // Verifica se o rosto está centralizado e em uma distância adequada
    // em relação à guia oval central do vídeo (espelhado).
    _isAligned(box) {
      const vw = this.videoEl.videoWidth;
      const vh = this.videoEl.videoHeight;
      const faceCx = 1 - (box.x + box.width / 2) / vw; // espelhado (scaleX -1)
      const faceCy = (box.y + box.height / 2) / vh;
      const faceSize = box.height / vh;

      const dx = faceCx - 0.5;
      const dy = faceCy - 0.46;

      if (Math.abs(dx) > 0.16 || Math.abs(dy) > 0.16) {
        return { ok: false, hint: "Centralize seu rosto na área guiada" };
      }
      if (faceSize < 0.34) {
        return { ok: false, hint: "Aproxime um pouco o rosto da câmera" };
      }
      if (faceSize > 0.82) {
        return { ok: false, hint: "Afaste um pouco o rosto da câmera" };
      }
      return { ok: true };
    }

    async _confirm(descriptor) {
      this.busy = true;
      this.setState("good", "Reconhecendo…");
      try {
        await this.onCapture(Array.from(descriptor));
        this.setState("success", "Rosto reconhecido!");
      } catch (err) {
        this.setState("error", err && err.message ? err.message : "Não foi possível confirmar. Tente novamente.");
        // dá um respiro visual e volta a procurar automaticamente
        await new Promise((r) => setTimeout(r, 1400));
        this.goodSince = null;
        this._setHold(0);
        this.busy = false;
        if (this.running) this.setState("searching", "Posicione o rosto dentro da área indicada");
      }
    }
  }

  global.FaceScan = FaceScan;
})(window);
