/**
 * VoiceEngine - Combined voice capture & analysis engine
 * ========================================================
 * Wraps three browser APIs into a single interface:
 *
 *  1. SpeechRecognition  → text transcripts (for text-based matching)
 *  2. MediaRecorder      → raw audio blob   (for audio-based matching)
 *  3. AnalyserNode       → real-time volume  (for UI visualization)
 *
 * Two-tier matching strategy:
 *   Primary:  SpeechRecognition text matching (en-US + ja-JP dual language)
 *   Secondary: Audio feature comparison via AudioFeatureExtractor
 *
 * Key design:
 *   - Mic starts recording immediately on start()
 *   - Auto-stops after 3000ms (configurable via timeout)
 *   - SpeechRecognition runs in parallel but does NOT control timing
 *   - Results emitted once on finalize (text transcripts + audio blob)
 */

window.SanrioGame = window.SanrioGame || {};

(function () {
  "use strict";

  var AudioFeatureExtractor = window.SanrioGame.AudioFeatureExtractor;

  /**
   * @class VoiceEngine
   * @param {Object} [options]
   * @param {boolean} [options.debug=false]
   * @param {string}  [options.lang='en-US']
   * @param {number}  [options.maxAlternatives=10]
   * @param {number}  [options.timeout=3000]        Auto-stop after this (ms)
   * @param {number}  [options.audioMatchThreshold=50] Audio similarity pass (%)
   */
  function VoiceEngine(options) {
    options = options || {};

    this.debug = options.debug || false;

    // ─── Speech Recognition ───
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.SpeechRecognition = SR;
    this.hasSpeechRecognition = !!SR;
    this.recognition = null;

    // ─── Platform detection ───
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isAndroid = /Android/i.test(navigator.userAgent);
    this.isSafari =
      /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    // ─── Configuration ───
    this.lang = options.lang || "en-US";
    this.maxAlternatives = options.maxAlternatives || 10;
    this.timeout = options.timeout || 3000; // Auto-stop: 3 seconds
    this.audioMatchThreshold = options.audioMatchThreshold || 50;

    // ─── Recording state ───
    this.isListening = false;
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordedBlob = null;

    // ─── Raw PCM capture (for Azure Pronunciation Assessment) ───
    this._pcmChunks = [];
    this._pcmProcessor = null;
    this._pcmSource = null;
    this.pcmWavBlob = null; // WAV blob with real PCM data

    // ─── Volume monitoring ───
    this.volumeMonitorId = null;
    this.currentVolume = 0;
    this.hasVoiceDetected = false;

    // ─── Silence detection (auto-stop when speech ends) ───
    this._silenceStart = 0;       // timestamp when volume first dropped below threshold
    this._silenceThreshold = 600; // ms of silence after voice detected → auto-stop

    // ─── Audio feature extraction ───
    this.featureExtractor = new AudioFeatureExtractor();

    // ─── Internal state ───
    this._timeoutId = null;
    this._speechHandled = false;
    this._transcripts = [];

    // ─── Callbacks ───
    this.onResult = options.onResult || function () {};
    this.onError = options.onError || function () {};
    this.onStart = options.onStart || function () {};
    this.onEnd = options.onEnd || function () {};
    this.onVolumeChange = options.onVolumeChange || function () {};
    this.onSilenceDetected = options.onSilenceDetected || function () {};

    this._log(
      "VoiceEngine initialized. SpeechAPI:",
      this.hasSpeechRecognition,
      "Timeout:",
      this.timeout + "ms",
    );
  }

  // ========================
  // Public API
  // ========================

  Object.defineProperty(VoiceEngine.prototype, "isSupported", {
    get: function () {
      return (
        this.hasSpeechRecognition ||
        !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      );
    },
  });

  /**
   * Start listening: acquire mic, start recording + speech recognition + volume monitoring.
   * Automatically stops after this.timeout ms.
   */
  /**
   * Start listening.
   * @param {Object} [options]
   * @param {string} [options.primaryLang] - Language to use first ('en-US' or 'ja-JP').
   *   The other language is used as secondary for the remaining time.
   *   Defaults to 'en-US'.
   */
  VoiceEngine.prototype.start = function (options) {
    if (this.isListening) {
      this._log("Already listening, ignoring start()");
      return;
    }

    options = options || {};
    // Always use en-US first — gives best transcript results for all characters.
    // ja-JP runs as secondary to catch any Japanese speech.
    this._sessionPrimaryLang = "en-US";
    this._sessionSecondaryLang = "ja-JP";

    this.isListening = true;
    this._speechHandled = false;
    this._transcripts = [];
    this.recordedBlob = null;
    this.hasVoiceDetected = false;
    this._silenceStart = 0;
    this._silenceFired = false;
    this._lastVoiceAt = 0;
    this._firstVoiceAt = 0;
    // Session counter — every start() bumps this so any stale rAF
    // callbacks from a previous _monitorVolume loop bail out before
    // touching state or triggering onSilenceDetected.
    this._monitorSession = (this._monitorSession || 0) + 1;
    this._sessionStartAt = Date.now();

    var self = this;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        if (!self.isListening) {
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
          return;
        }

        self.mediaStream = stream;

        // Start MediaRecorder (raw audio capture)
        self._startRecording();

        // Start volume monitoring (AnalyserNode)
        self._startVolumeMonitoring();

        // Start speech recognition (text transcripts)
        if (self.hasSpeechRecognition) {
          self._startSpeechRecognition();
        }

        // Safety timeout only — player manually stops by toggling mic
        self._timeoutId = setTimeout(function () {
          self._log("Safety timeout — auto-stop after " + self.timeout + "ms");
          self._finalize();
        }, self.timeout);

        self.onStart();
        self._log("Listening started — player toggles mic to stop");
      })
      .catch(function (e) {
        self.isListening = false;
        self._log("getUserMedia failed:", e.message);

        if (
          e.name === "NotAllowedError" ||
          e.name === "PermissionDeniedError"
        ) {
          self.onError("not-allowed");
        } else {
          self.onError("start-failed");
        }
      });
  };

  /**
   * Stop listening and emit results
   */
  VoiceEngine.prototype.stop = function () {
    if (!this.isListening) return;
    this._finalize();
  };

  /**
   * Abort immediately without emitting results
   */
  VoiceEngine.prototype.abort = function () {
    this._clearTimeout();
    this.isListening = false;
    this._speechHandled = true;

    // Clear language switch timer
    if (this._langSwitchTimerId) {
      clearTimeout(this._langSwitchTimerId);
      this._langSwitchTimerId = null;
    }
    this._langSwitchDone = true;

    // Stop all recognition instances
    if (this._recognitions) {
      for (var r = 0; r < this._recognitions.length; r++) {
        try {
          this._recognitions[r].abort();
        } catch (e) {
          /* ignore */
        }
      }
      this._recognitions = [];
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        /* ignore */
      }
    }
    this._stopRecording();
    this._stopVolumeMonitoring();
    this._releaseStream();
  };

  /**
   * Compare the recorded audio against a reference audio URL.
   *
   * @param {string} referenceUrl - URL of reference audio file
   * @returns {Promise<{similarity:number, supported:boolean}>}
   */
  VoiceEngine.prototype.compareAudio = function (referenceUrl) {
    // Prefer recordedBlob (MediaRecorder). Fall back to pcmWavBlob
    // (ScriptProcessor PCM) which is always available synchronously
    // after abort() — needed when the caller runs immediately after abort
    // and MediaRecorder's onstop hasn't fired yet.
    var userBlob = this.recordedBlob || this.pcmWavBlob;
    if (!userBlob) {
      this._log("No recorded audio available for comparison");
      return Promise.resolve({ similarity: 0, supported: false });
    }

    var self = this;
    var userFeaturesPromise = this.featureExtractor.extractFromBlob(userBlob);
    var refFeaturesPromise = this.featureExtractor.extractFromUrl(referenceUrl);

    return Promise.all([userFeaturesPromise, refFeaturesPromise])
      .then(function (results) {
        var userFeatures = results[0];
        var refFeatures = results[1];
        var similarity = AudioFeatureExtractor.similarity(
          userFeatures,
          refFeatures,
        );

        // ── Console: Audio comparison details ──
        // console.group('%c🔊 Audio Match', 'color:#667eea;font-weight:bold;font-size:13px');
        var userEnergy = Array.isArray(userFeatures)
          ? userFeatures
          : userFeatures.energy || [];
        var refEnergy = Array.isArray(refFeatures)
          ? refFeatures
          : refFeatures.energy || [];
        // console.log(
        //   '%cUser energy:%c ' + userEnergy.map(function (v) { return v.toFixed(1); }).join(', '),
        //   'color:#555;font-weight:bold', 'color:#888'
        // );
        // console.log(
        //   '%cRef  energy:%c ' + refEnergy.map(function (v) { return v.toFixed(1); }).join(', '),
        //   'color:#555;font-weight:bold', 'color:#888'
        // );
        // if (userFeatures.duration) {
        //   console.log(
        //     '%cUser duration:%c ' + userFeatures.duration.toFixed(2) + 's  %cRef duration:%c ' + refFeatures.duration.toFixed(2) + 's',
        //     'color:#555;font-weight:bold', 'color:#888',
        //     'color:#555;font-weight:bold', 'color:#888'
        //   );
        // }

        var barLen = Math.round(similarity / 5);
        var bar = "\u2588".repeat(barLen) + "\u2591".repeat(20 - barLen);
        var simColor =
          similarity >= 80
            ? "#66BB6A"
            : similarity >= 60
              ? "#FFA726"
              : similarity >= 40
                ? "#42A5F5"
                : "#EF5350";
        // console.log(
        //   "  %c" +
        //     similarity.toFixed(1) +
        //     "%%" +
        //     "%c  " +
        //     bar +
        //     "  %c" +
        //     (similarity >= self.audioMatchThreshold ? "✅ PASS" : "✗ FAIL") +
        //     "  (threshold: " +
        //     self.audioMatchThreshold +
        //     "%)",
        //   "color:" + simColor + ";font-weight:bold;font-size:14px",
        //   "color:#ccc",
        //   "color:" +
        //     (similarity >= self.audioMatchThreshold ? "#66BB6A" : "#EF5350") +
        //     ";font-weight:bold",
        // );
        console.groupEnd();

        return {
          similarity: similarity,
          supported: true,
          userFeatures: userFeatures,
          refFeatures: refFeatures,
        };
      })
      .catch(function (e) {
        self._log("Audio comparison failed:", e.message);
        return { similarity: 0, supported: false };
      });
  };

  // ========================
  // MediaRecorder
  // ========================

  /** @private */
  VoiceEngine.prototype._startRecording = function () {
    this.audioChunks = [];

    try {
      var options = {};
      if (typeof MediaRecorder !== "undefined") {
        if (
          MediaRecorder.isTypeSupported &&
          MediaRecorder.isTypeSupported("audio/webm")
        ) {
          options.mimeType = "audio/webm";
        }
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

      var self = this;

      this.mediaRecorder.ondataavailable = function (event) {
        if (event.data.size > 0) {
          self.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = function () {
        if (self.audioChunks.length > 0) {
          self.recordedBlob = new Blob(self.audioChunks, {
            type:
              (self.mediaRecorder && self.mediaRecorder.mimeType) ||
              "audio/webm",
          });
          self._log(
            "Audio recorded:",
            (self.recordedBlob.size / 1024).toFixed(1) + "KB",
          );
        }
      };

      this.mediaRecorder.start();
      this._log("MediaRecorder started");
    } catch (e) {
      this._log("MediaRecorder not available:", e.message);
      this.mediaRecorder = null;
    }
  };

  /** @private */
  VoiceEngine.prototype._stopRecording = function () {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        this._log("MediaRecorder stop error:", e.message);
      }
    }
  };

  // ========================
  // Volume Monitoring
  // ========================

  /** @private */
  VoiceEngine.prototype._startVolumeMonitoring = function () {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      if (!this.audioContext) {
        this.audioContext = new AC();
      }

      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      this._pcmSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      this._pcmSource.connect(this.analyser);

      // ── Raw PCM capture via ScriptProcessor (for Azure WAV) ──
      this._pcmChunks = [];
      this.pcmWavBlob = null;
      try {
        // 4096 buffer, mono input, mono output (output is silent)
        this._pcmProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        var self2 = this;
        this._pcmProcessor.onaudioprocess = function (e) {
          if (!self2.isListening) return;
          // Copy the Float32 PCM samples from the input buffer
          var input = e.inputBuffer.getChannelData(0);
          self2._pcmChunks.push(new Float32Array(input));
        };
        this._pcmSource.connect(this._pcmProcessor);
        // ScriptProcessor requires an output connection (even if silent)
        this._pcmProcessor.connect(this.audioContext.destination);
        this._log("PCM capture started (ScriptProcessor)");
      } catch (pcmErr) {
        this._log("PCM capture setup failed:", pcmErr.message);
      }

      this._monitorVolume();
      this._log("Volume monitoring started");
    } catch (e) {
      this._log("Volume monitoring setup failed:", e.message);
    }
  };

  /** @private */
  VoiceEngine.prototype._monitorVolume = function (mySession) {
    if (!this.analyser || !this.isListening) return;
    // Session guard: if this rAF callback was scheduled by a previous
    // session, bail out so it can't touch new-session state.
    if (mySession == null) mySession = this._monitorSession;
    if (mySession !== this._monitorSession) return;

    var dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    var sum = 0;
    for (var i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    this.currentVolume = Math.round((sum / dataArray.length / 255) * 100);

    this.onVolumeChange(this.currentVolume);

    // ── Voice activity detection ──
    // Tuned for multi-syllable character names like "Kero Kero Keroppi"
    // where players naturally pause 800–1200ms between words. We need to
    // wait long enough that mid-utterance pauses don't trigger stop.
    var VOICE_THRESHOLD = 10;
    var SILENCE_THRESHOLD = 10;
    var SILENCE_MS = 2200;       // silence duration required to auto-stop
    var MIN_SPEECH_MS = 500;     // cumulative speech required before stop allowed
    var STARTUP_GRACE_MS = 600;  // ignore volume spikes in the first 600ms
    var now = Date.now();

    // Grace period: ignore volume for the first STARTUP_GRACE_MS after
    // session start. This prevents SFX (rope collision, button click)
    // that play when the mic opens from being misdetected as speech.
    var elapsed = now - (this._sessionStartAt || 0);
    if (elapsed < STARTUP_GRACE_MS) {
      // Still in grace period — skip voice detection, just schedule next frame
      var self2 = this;
      var sess2 = mySession;
      this.volumeMonitorId = requestAnimationFrame(function () {
        self2._monitorVolume(sess2);
      });
      return;
    }

    if (this.currentVolume >= VOICE_THRESHOLD) {
      if (!this.hasVoiceDetected) {
        this._firstVoiceAt = now;
      }
      this.hasVoiceDetected = true;
      this._lastVoiceAt = now;
    }

    // Silence auto-detect: only AFTER player has started speaking for
    // at least MIN_SPEECH_MS (prevents stopping mid-name on a brief pause).
    if (
      this.hasVoiceDetected &&
      !this._silenceFired &&
      this._firstVoiceAt &&
      now - this._firstVoiceAt >= MIN_SPEECH_MS &&
      this.currentVolume < SILENCE_THRESHOLD &&
      this._lastVoiceAt &&
      now - this._lastVoiceAt >= SILENCE_MS
    ) {
      this._silenceFired = true;
      this._log("Silence detected (" + SILENCE_MS + "ms after last voice)");
      try { this.onSilenceDetected(); } catch (e) { /* */ }
    }

    // Hard max-duration safety: if the player has been speaking for more
    // than 8s after voice was first detected, force auto-stop so the mic
    // can't get stuck when the silence condition never settles.
    if (
      this.hasVoiceDetected &&
      !this._silenceFired &&
      this._firstVoiceAt &&
      now - this._firstVoiceAt >= 8000
    ) {
      this._silenceFired = true;
      this._log("Max-duration reached (8s) — forcing auto-stop");
      try { this.onSilenceDetected(); } catch (e) { /* */ }
    }

    var self = this;
    var sess = mySession;
    this.volumeMonitorId = requestAnimationFrame(function () {
      self._monitorVolume(sess);
    });
  };

  /** @private */
  VoiceEngine.prototype._stopVolumeMonitoring = function () {
    if (this.volumeMonitorId) {
      cancelAnimationFrame(this.volumeMonitorId);
      this.volumeMonitorId = null;
    }

    // ── Build PCM WAV blob from captured chunks ──
    if (this._pcmProcessor) {
      try { this._pcmProcessor.disconnect(); } catch (e) { /* */ }
      this._pcmProcessor = null;
    }
    if (this._pcmChunks.length > 0 && this.audioContext) {
      var sampleRate = this.audioContext.sampleRate;
      // Merge all Float32 chunks into one array
      var totalLen = 0;
      for (var i = 0; i < this._pcmChunks.length; i++) {
        totalLen += this._pcmChunks[i].length;
      }
      var merged = new Float32Array(totalLen);
      var offset = 0;
      for (var j = 0; j < this._pcmChunks.length; j++) {
        merged.set(this._pcmChunks[j], offset);
        offset += this._pcmChunks[j].length;
      }
      this._pcmChunks = [];

      // Trim leading/trailing silence for smaller WAV & faster Azure response
      merged = this._trimSilence(merged, sampleRate);

      // Encode to 16-bit PCM WAV
      this.pcmWavBlob = this._encodePcmWav(merged, sampleRate);
      this._log(
        "PCM WAV built: " + (this.pcmWavBlob.size / 1024).toFixed(1) + "KB" +
        "  sampleRate=" + sampleRate +
        "  duration=" + (merged.length / sampleRate).toFixed(2) + "s"
      );
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (e) {
        /* ignore */
      }
      this.analyser = null;
    }
    if (this._pcmSource) {
      try { this._pcmSource.disconnect(); } catch (e) { /* */ }
      this._pcmSource = null;
    }
    this.currentVolume = 0;
    this.onVolumeChange(0);
  };

  /**
   * Encode Float32 PCM samples to a 16-bit mono WAV Blob.
   * @param {Float32Array} samples - raw PCM at original sampleRate
   * @param {number} sampleRate - e.g. 48000
   * @returns {Blob}
   */
  VoiceEngine.prototype._encodePcmWav = function (samples, sampleRate) {
    // Downsample to 16 kHz for Azure (simple decimation)
    var TARGET_SR = 16000;
    var ratio = sampleRate / TARGET_SR;
    var outLen = Math.ceil(samples.length / ratio);
    var out = new Float32Array(outLen);
    for (var i = 0; i < outLen; i++) {
      out[i] = samples[Math.floor(i * ratio)] || 0;
    }

    var buf = new ArrayBuffer(44 + out.length * 2);
    var v = new DataView(buf);
    function s(off, str) {
      for (var k = 0; k < str.length; k++) v.setUint8(off + k, str.charCodeAt(k));
    }
    s(0, "RIFF");  v.setUint32(4, 36 + out.length * 2, true);
    s(8, "WAVE");  s(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);           // PCM
    v.setUint16(22, 1, true);           // mono
    v.setUint32(24, TARGET_SR, true);
    v.setUint32(28, TARGET_SR * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    s(36, "data"); v.setUint32(40, out.length * 2, true);

    var off = 44;
    for (var j = 0; j < out.length; j++) {
      var val = Math.max(-1, Math.min(1, out[j]));
      v.setInt16(off, val < 0 ? val * 0x8000 : val * 0x7fff, true);
      off += 2;
    }

    return new Blob([buf], { type: "audio/wav" });
  };

  /**
   * Trim leading and trailing silence from Float32 PCM samples.
   * Keeps a small margin (50ms) around the detected speech so Azure
   * has enough context. This dramatically reduces WAV size and speeds
   * up the Azure REST call.
   *
   * @param {Float32Array} samples - raw PCM at sampleRate
   * @param {number} sampleRate
   * @returns {Float32Array} trimmed samples
   */
  VoiceEngine.prototype._trimSilence = function (samples, sampleRate) {
    var THRESHOLD = 0.01;            // amplitude below this = silence
    var MARGIN = Math.floor(sampleRate * 0.05); // 50ms margin
    var BLOCK = 256;                 // scan in blocks for speed

    // Find first non-silent block
    var start = 0;
    for (var i = 0; i < samples.length; i += BLOCK) {
      var peak = 0;
      var end = Math.min(i + BLOCK, samples.length);
      for (var j = i; j < end; j++) {
        var abs = samples[j] < 0 ? -samples[j] : samples[j];
        if (abs > peak) peak = abs;
      }
      if (peak >= THRESHOLD) { start = i; break; }
    }

    // Find last non-silent block
    var last = samples.length;
    for (var k = samples.length - BLOCK; k >= start; k -= BLOCK) {
      var peak2 = 0;
      var s = k < 0 ? 0 : k;
      var e = Math.min(s + BLOCK, samples.length);
      for (var m = s; m < e; m++) {
        var abs2 = samples[m] < 0 ? -samples[m] : samples[m];
        if (abs2 > peak2) peak2 = abs2;
      }
      if (peak2 >= THRESHOLD) { last = e; break; }
    }

    // Apply margin
    start = Math.max(0, start - MARGIN);
    last = Math.min(samples.length, last + MARGIN);

    if (last - start < sampleRate * 0.2) {
      // Less than 200ms of audio — don't trim, might be too aggressive
      return samples;
    }

    var trimmed = samples.subarray(start, last);
    this._log("Trimmed silence: " +
      (samples.length / sampleRate).toFixed(2) + "s → " +
      (trimmed.length / sampleRate).toFixed(2) + "s");
    return trimmed;
  };

  // ========================
  // Speech Recognition
  // ========================

  /**
   * Start SpeechRecognition with dual language support.
   *
   * Strategy: Run en-US and ja-JP with guaranteed time for each.
   *   - en-US starts immediately (gets first half of timeout)
   *   - After en-US ends OR half-timeout, force-switch to ja-JP
   *   - ja-JP gets the remaining time
   *   - Both sets of transcripts are merged for matching
   *
   * This ensures Japanese pronunciation gets fair recognition time
   * even when the player speaks English-sounding names.
   *
   * @private
   */
  /**
   * Start speech recognition — single en-US instance with continuous+interim.
   * Fires onInterimResult callback on every transcript for instant matching.
   * @private
   */
  VoiceEngine.prototype._startSpeechRecognition = function () {
    var SR = this.SpeechRecognition;
    var self = this;
    var seenTexts = {}; // deduplicate across restarts

    // Android Chrome has issues with continuous=true — recognition ends
    // immediately and restart loops fail silently. Use non-continuous mode
    // and create a fresh instance on each restart.
    var useContinuous = !this.isAndroid;

    self._log(
      "Platform: " + (this.isAndroid ? "Android" : this.isIOS ? "iOS" : "Desktop") +
      ", continuous=" + useContinuous,
    );

    function createRecognition() {
      var rec = new SR();
      rec.lang = "en-US";
      rec.continuous = useContinuous;
      rec.interimResults = true;
      rec.maxAlternatives = self.maxAlternatives;

      rec.onresult = function (event) {
        var newTranscripts = [];
        for (var i = 0; i < event.results.length; i++) {
          for (var j = 0; j < event.results[i].length; j++) {
            var text = event.results[i][j].transcript;
            var conf = event.results[i][j].confidence;
            var key = text.toLowerCase().trim();
            if (!seenTexts[key]) {
              seenTexts[key] = true;
              var entry = { text: text, confidence: conf };
              newTranscripts.push(entry);
              self._transcripts.push(entry);
            }
          }
        }
        if (newTranscripts.length > 0) {
          self._log(
            "Speech (" + newTranscripts.length + " new):",
            newTranscripts.map(function (t) {
              return '"' + t.text + '"';
            }).join(", "),
          );
          // Fire interim callback so app.js can match immediately
          if (self.onInterimResult) {
            self.onInterimResult(newTranscripts);
          }
        }
      };

      rec.onerror = function (event) {
        // "aborted" is expected whenever we manually stop — not a real error.
        // "no-speech" is common on Android silence — also not fatal.
        if (event.error !== "aborted" && event.error !== "no-speech") {
          console.warn("[VoiceEngine] SpeechRecognition error:", event.error);
        }
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          self.onError("not-allowed");
        }
        if (event.error === "aborted" || event.error === "network") {
          self._log("Recognition error (non-fatal): " + event.error);
        }
      };

      rec.onend = function () {
        self._log("SpeechRecognition ended");
        // Restart if still listening — on Android, create a FRESH instance
        // because restarting the same instance often fails silently
        if (self.isListening && !self._speechHandled) {
          setTimeout(function () {
            if (!self.isListening || self._speechHandled) return;
            self._log("Restarting SpeechRecognition…");
            var newRec = createRecognition();
            self.recognition = newRec;
            self._recognitions = [newRec];
            try {
              newRec.start();
              self._log("SpeechRecognition restarted");
            } catch (e) {
              self._log("SpeechRecognition restart failed:", e.message);
            }
          }, self.isAndroid ? 100 : 50); // Slightly longer delay on Android
        }
      };

      return rec;
    }

    var rec = createRecognition();
    this.recognition = rec;
    this._recognitions = [rec];

    try {
      rec.start();
      self._log(
        "SpeechRecognition started (en-US, continuous=" + useContinuous + ", interim)",
      );
    } catch (e) {
      self._log("SpeechRecognition start failed:", e.message);
    }
  };

  // ========================
  // Finalization
  // ========================

  /**
   * Finalize: stop everything and emit results.
   * @private
   */
  VoiceEngine.prototype._finalize = function () {
    if (this._speechHandled) return;
    this._speechHandled = true;
    this.isListening = false;

    this._clearTimeout();

    // Clear language switch timer
    if (this._langSwitchTimerId) {
      clearTimeout(this._langSwitchTimerId);
      this._langSwitchTimerId = null;
    }

    // Stop all speech recognition instances
    if (this._recognitions) {
      for (var r = 0; r < this._recognitions.length; r++) {
        try {
          this._recognitions[r].stop();
        } catch (e) {
          /* ignore */
        }
      }
      this._recognitions = [];
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        /* ignore */
      }
    }

    // Stop recording
    this._stopRecording();

    // Stop volume monitoring
    this._stopVolumeMonitoring();

    // Short delay — PCM WAV is already built, just need MediaRecorder to flush
    var self = this;
    setTimeout(function () {
      self._emitResult();
    }, 30);
  };

  /** @private */
  VoiceEngine.prototype._emitResult = function () {
    var result = {
      transcripts: this._transcripts,
      recordedBlob: this.recordedBlob,
      pcmWavBlob: this.pcmWavBlob,      // Real PCM WAV for Azure
      hasAudio: !!this.recordedBlob,
      hasVoice: this.hasVoiceDetected,
    };

    this._log(
      "Emitting result:",
      result.transcripts.length,
      "transcripts,",
      result.hasAudio
        ? (this.recordedBlob.size / 1024).toFixed(1) + "KB audio"
        : "no audio",
      "voice detected:",
      result.hasVoice,
    );

    this.onResult(result);
    this.onEnd();
    this._releaseStream();
  };

  /** @private */
  VoiceEngine.prototype._releaseStream = function () {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(function (track) {
        track.stop();
      });
      this.mediaStream = null;
    }
  };

  /** @private */
  VoiceEngine.prototype._clearTimeout = function () {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  };

  /** @private */
  VoiceEngine.prototype._log = function () {
    if (!this.debug) return;
    var args = ["[VoiceEngine]"].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  };

  // Export
  window.SanrioGame.VoiceEngine = VoiceEngine;
})();
