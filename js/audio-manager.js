/**
 * AudioManager - BGM and SFX controller (Web Audio API)
 * =====================================================
 * SFX: Preloaded as AudioBuffers via Web Audio API — plays instantly,
 *       no per-play limits on mobile, unlimited concurrent sounds.
 *       All SFX route through a master GainNode so mute is instant.
 * BGM: Uses Web Audio API (AudioBufferSourceNode) for looping playback.
 *      This avoids iOS Safari's <audio> interruption when speech
 *      recognition or other audio sessions activate.
 *
 * CDN base is supplied at runtime through APP_URL.
 */

window.SanrioGame = window.SanrioGame || {};

(function () {
  "use strict";

  var CDN =
    window.APP_URL + "/sanrio2026game/assets/say-my-name/bgm/";

  var SFX_FILES = {
    "btn-click": { file: "Button Click.mp3", volume: 0.24 },
    entrance: { file: "Entrance Whoosh.mp3", volume: 0.21 },
    exit: { file: "Exit Whoosh.mp3", volume: 0.21 },
    countdown: { file: "Countdown.mp3", volume: 0.18 },
    correct: { file: "Correct Answer.mp4", volume: 0.3 },
    wrong: { file: "Wrong Answer.mp4", volume: 0.27 },
    "ready-go": { file: "Ready Go.mp4", volume: 0.3 },
    "rope-snap": { file: "Rope Snap.mp3", volume: 0.27 },
    "tier-reveal": { file: "Tier Badge Reveal.wav", volume: 0.3 },
  };

  var BGM_FILES = {
    intro: "Intro BG Music (Looping).mp3",
    gameplay: "Gameplay BGM Loop.mp3",
  };

  var BGM_VOLUME = 0.04;

  // ========================
  // Constructor
  // ========================

  function AudioManager() {
    this._ctx = null; // AudioContext (created on first gesture)
    this._masterGain = null; // Master GainNode — all SFX route through this
    this._bgmGain = null; // BGM GainNode — separate from SFX
    this._buffers = {}; // key → AudioBuffer (decoded SFX)
    this._bgmBuffers = {}; // name → AudioBuffer (decoded BGM)
    this._htmlSfx = {}; // key → preloaded <audio> (fallback)
    this._activeHtml = []; // currently-playing HTML Audio clones (for muting)
    this._bgmSource = null; // current BGM AudioBufferSourceNode
    this._bgmName = null;
    this._bgmStartOffset = 0; // track playback position for pause/resume
    this._bgmStartTime = 0; // ctx.currentTime when playback started
    this._muted = false;
    this._unlocked = false;
    this._pendingBGM = null;
    this.onUnlock = null; // callback fired once on first user gesture

    // Restore saved mute preference
    this._restoreMuteState();

    // Preload HTML Audio elements immediately (fallback for Web Audio)
    this._preloadHtmlSfx();
    this._attachUnlockListener();
  }

  // ========================
  // Autoplay unlock + AudioContext creation
  // ========================

  AudioManager.prototype._attachUnlockListener = function () {
    var self = this;
    var events = ["touchstart", "touchend", "click", "keydown"];

    function unlock() {
      if (self._unlocked) return;
      self._unlocked = true;

      events.forEach(function (e) {
        document.removeEventListener(e, unlock, true);
      });

      // Create AudioContext on first gesture (required by browsers)
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        self._ctx = new AC();
        // Resume if suspended (Safari requires this)
        if (self._ctx.state === "suspended") {
          self._ctx.resume();
        }

        // iOS: listen for AudioContext state changes and auto-resume
        self._ctx.addEventListener("statechange", function () {
          if (
            self._ctx.state === "interrupted" ||
            self._ctx.state === "suspended"
          ) {
            // Try to resume immediately
            self._ctx.resume().catch(function () {});
          }
        });

        // Create master gain node — all SFX connect through this
        self._masterGain = self._ctx.createGain();
        self._masterGain.gain.value = self._muted ? 0 : 1;
        self._masterGain.connect(self._ctx.destination);

        // Create BGM gain node — separate volume control
        self._bgmGain = self._ctx.createGain();
        self._bgmGain.gain.value = self._muted ? 0 : BGM_VOLUME;
        self._bgmGain.connect(self._ctx.destination);

        // Preload all SFX as decoded AudioBuffers
        self._preloadBuffers();
        // Preload all BGM as decoded AudioBuffers
        self._preloadBGMBuffers();
      }

      // Notify listener that audio is now unlocked
      if (self.onUnlock) self.onUnlock();

      // Play pending BGM if any
      if (self._pendingBGM) {
        var name = self._pendingBGM;
        self._pendingBGM = null;
        self.playBGM(name);
      }
    }

    events.forEach(function (e) {
      document.addEventListener(e, unlock, true);
    });
  };

  // ========================
  // SFX preload — HTML Audio (immediate, works as fallback)
  // ========================

  AudioManager.prototype._preloadHtmlSfx = function () {
    var self = this;
    Object.keys(SFX_FILES).forEach(function (key) {
      var cfg = SFX_FILES[key];
      var url = encodeURI(CDN + cfg.file);
      var audio = new Audio(url);
      audio.preload = "auto";
      audio.volume = cfg.volume;
      self._htmlSfx[key] = audio;
    });
  };

  // ========================
  // SFX preload — Web Audio API buffers (decoded, best for mobile)
  // ========================

  AudioManager.prototype._preloadBuffers = function () {
    var self = this;
    Object.keys(SFX_FILES).forEach(function (key) {
      var cfg = SFX_FILES[key];
      var url = encodeURI(CDN + cfg.file);

      fetch(url)
        .then(function (res) {
          return res.arrayBuffer();
        })
        .then(function (buf) {
          return self._ctx.decodeAudioData(buf);
        })
        .then(function (decoded) {
          self._buffers[key] = { buffer: decoded, volume: cfg.volume };
        })
        .catch(function (e) {
          console.warn("[AudioManager] Buffer preload failed:", key, e);
        });
    });
  };

  // ========================
  // BGM preload — Web Audio API buffers (avoids iOS <audio> interruption)
  // ========================

  AudioManager.prototype._preloadBGMBuffers = function () {
    var self = this;
    Object.keys(BGM_FILES).forEach(function (name) {
      var file = BGM_FILES[name];
      var url = encodeURI(CDN + file);

      fetch(url)
        .then(function (res) {
          return res.arrayBuffer();
        })
        .then(function (buf) {
          return self._ctx.decodeAudioData(buf);
        })
        .then(function (decoded) {
          self._bgmBuffers[name] = decoded;
          console.log("[AudioManager] BGM preloaded:", name);

          // If this BGM was pending while it loaded, play it now
          if (self._pendingBGM === name) {
            self._pendingBGM = null;
            self.playBGM(name);
          }
        })
        .catch(function (e) {
          console.warn("[AudioManager] BGM preload failed:", name, e);
        });
    });
  };

  // ========================
  // SFX playback — tries Web Audio API first, falls back to HTML Audio
  // ========================

  AudioManager.prototype.playSFX = function (key) {
    if (this._muted) return;

    // Try Web Audio API first (reliable on mobile, no concurrent limits)
    if (this._ctx && this._masterGain && this._buffers[key]) {
      if (this._ctx.state === "suspended") {
        this._ctx.resume();
      }
      var entry = this._buffers[key];
      var source = this._ctx.createBufferSource();
      source.buffer = entry.buffer;
      var gain = this._ctx.createGain();
      gain.gain.value = entry.volume;
      source.connect(gain);
      // Route through master gain (not directly to destination)
      gain.connect(this._masterGain);
      source.start(0);
      return;
    }

    // Fallback: HTML Audio (clone preloaded element)
    var src = this._htmlSfx[key];
    if (src) {
      var self = this;
      var clone = src.cloneNode();
      clone.volume = src.volume;
      // Track active clones so we can mute them
      self._activeHtml.push(clone);
      clone.addEventListener("ended", function () {
        var idx = self._activeHtml.indexOf(clone);
        if (idx !== -1) self._activeHtml.splice(idx, 1);
      });
      clone.play().catch(function () {});
    }
  };

  // ========================
  // BGM control (Web Audio API — buffer-based, immune to iOS interruption)
  // ========================

  AudioManager.prototype.playBGM = function (name) {
    // Already playing this BGM
    if (this._bgmName === name && this._bgmSource) return;

    var buffer = this._bgmBuffers[name];

    if (!this._unlocked) {
      this._pendingBGM = name;
      return;
    }

    // Buffer not loaded yet — queue it
    if (!buffer) {
      this._pendingBGM = name;
      return;
    }

    // Stop old BGM
    this._stopBGMSource();

    // Create new source
    var source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this._bgmGain);

    this._bgmSource = source;
    this._bgmName = name;
    this._bgmStartOffset = 0;

    if (!this._muted) {
      this._bgmGain.gain.value = BGM_VOLUME;
      source.start(0);
      this._bgmStartTime = this._ctx.currentTime;
    }
  };

  /** Internal: stop the current BGM source node */
  AudioManager.prototype._stopBGMSource = function () {
    if (this._bgmSource) {
      try {
        this._bgmSource.stop();
      } catch (e) {}
      this._bgmSource.disconnect();
      this._bgmSource = null;
    }
  };

  AudioManager.prototype.stopBGM = function () {
    this._stopBGMSource();
    this._bgmName = null;
    this._bgmStartOffset = 0;
  };

  // ========================
  // Mute toggle
  // ========================

  AudioManager.prototype.setMuted = function (muted) {
    this._muted = muted;

    // Instantly mute/unmute all currently-playing Web Audio SFX via master gain
    if (this._masterGain) {
      this._masterGain.gain.value = muted ? 0 : 1;
    }

    // Pause/stop any active HTML Audio SFX clones
    if (muted && this._activeHtml.length > 0) {
      this._activeHtml.forEach(function (a) {
        try {
          a.pause();
          a.currentTime = 0;
        } catch (e) {}
      });
      this._activeHtml = [];
    }

    // BGM mute/unmute via gain node
    if (this._bgmGain) {
      if (muted) {
        this._bgmGain.gain.value = 0;
      } else {
        // Resume AudioContext first (iOS may have suspended it)
        if (this._ctx && this._ctx.state === "suspended") {
          this._ctx.resume();
        }
        this._bgmGain.gain.value = BGM_VOLUME;

        // If BGM was set but source not started (muted at playBGM time), start it now
        if (this._bgmName && !this._bgmSource) {
          var buffer = this._bgmBuffers[this._bgmName];
          if (buffer) {
            var source = this._ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(this._bgmGain);
            this._bgmSource = source;
            source.start(0);
            this._bgmStartTime = this._ctx.currentTime;
          }
        }
      }
    }

    // Persist preference
    try {
      localStorage.setItem("sanrio_muted", muted ? "1" : "0");
    } catch (e) {}
  };

  AudioManager.prototype.isMuted = function () {
    return this._muted;
  };

  /** Restore mute state from localStorage */
  AudioManager.prototype._restoreMuteState = function () {
    try {
      var saved = localStorage.getItem("sanrio_muted");
      if (saved === "1") {
        this._muted = true;
      }
    } catch (e) {}
  };

  // ========================
  // Export
  // ========================

  window.SanrioGame.AudioManager = AudioManager;
})();
