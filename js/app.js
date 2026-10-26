/**
 * App - Main application controller
 * ===================================
 * Manages screen flow, DOM updates, event binding, and
 * orchestrates GameEngine + VoiceEngine + SpeechEngine.
 *
 * Voice matching uses a two-tier strategy:
 *   1. Audio comparison (cosine similarity of RMS energy features)
 *   2. Text comparison  (SpeechRecognition transcripts + fuzzy matching)
 *   Success if EITHER tier matches.
 */

window.SanrioGame = window.SanrioGame || {};

(function () {
  "use strict";

  var GameEngine = window.SanrioGame.GameEngine;
  var SpeechEngine = window.SanrioGame.SpeechEngine;
  var VoiceEngine = window.SanrioGame.VoiceEngine;
  var AudioFeatureExtractor = window.SanrioGame.AudioFeatureExtractor;
  var STATE = GameEngine.STATE;
  var ANIM_CONFIG = GameEngine.ANIM_CONFIG;

  // ========================
  // Debug mode via URL param
  // ========================
  var DEBUG = window.location.search.indexOf("debug=true") !== -1;

  // ========================
  // Match threshold
  // ========================
  // Audio comparison is Tier 2 fallback — if text matching fails,
  // audio similarity above this threshold counts as a pass.
  var AUDIO_MATCH_THRESHOLD = 60; // 60% similarity — strict enough to stand alone when Azure is unavailable

  // ========================
  // Google Analytics helper
  // ========================
  function trackEvent(eventName, params) {
    try {
      if (typeof window.gtag === "function") {
        if (params) {
          window.gtag("event", eventName, params);
        } else {
          window.gtag("event", eventName);
        }
      }
    } catch (e) {
      /* swallow — analytics must never break gameplay */
    }
  }

  /**
   * @class App
   */
  function App() {
    this.debug = DEBUG;
    this.game = null;
    this.voice = null; // VoiceEngine (replaces direct SpeechEngine usage)

    // DOM cache (populated in _cacheDom)
    this.dom = {};

    // Audio manager (BGM + SFX)
    this.audio = new window.SanrioGame.AudioManager();

    // Audio element for voice playback
    this.voiceAudio = new Audio();

    // Track if we've already handled a voice result for this character
    this._voiceHandled = false;

    // Init on DOM ready
    var self = this;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        self._init();
      });
    } else {
      this._init();
    }
  }

  // ========================
  // Initialization
  // ========================

  App.prototype._init = function () {
    this._cacheDom();
    this._initEngines();
    this._bindEvents();
    this._requestMicPermission();
    this._showScreen("home");

    // Show debug panel if enabled
    if (this.debug) {
      this.dom.debugPanel.classList.add("visible");
    }

    // Restore mute button UI from saved state
    if (this.dom.muteBtn && this.audio.isMuted()) {
      this.dom.muteIcon.src =
        "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/game-visuals/Mute.png";
      this.dom.muteIcon.alt = "Sound off";
      this.dom.muteBtn.classList.add("muted");
    }

    // Before first user gesture, browser blocks autoplay — show Volume.png dimmed
    if (this.dom.muteBtn) {
      this.dom.muteBtn.classList.add("auto-muted");
      var self = this;
      this.audio.onUnlock = function () {
        self.dom.muteBtn.classList.remove("auto-muted");
      };
    }

    this._log("App initialized");
  };

  App.prototype._cacheDom = function () {
    var d = this.dom;

    // Screens
    d.screenHome = document.getElementById("screen-home");
    d.screenGame = document.getElementById("screen-game");
    // d.screenRoundResult removed (round result screen deleted)
    d.screenTierResult = document.getElementById("screen-tier-result");
    d.popupInstructions = document.getElementById("popup-instructions");
    d.popupUnsupported = document.getElementById("popup-unsupported");

    // Home buttons
    d.btnStart = document.getElementById("btn-start");
    d.btnHowToPlay = document.getElementById("btn-how-to-play");
    d.btnInstructionsStart = document.getElementById("btn-instructions-start");
    d.btnInstructionsClose = document.getElementById("btn-instructions-close");
    d.btnUnsupportedClose = document.getElementById("btn-unsupported-close");

    // Game screen elements
    d.progressDots = document.getElementById("progress-dots");
    d.scoreDisplay = document.getElementById("score-display");
    d.trackArea = document.getElementById("track-area");
    d.characterWalker = document.getElementById("character-walker");
    d.characterRocker = document.getElementById("character-rocker");
    d.characterImg = document.getElementById("game-character-img");
    d.ropeLine = document.getElementById("finish-line");
    d.ropeLeft = document.getElementById("rope-left");
    d.ropeRight = document.getElementById("rope-right");
    d.winEffect = document.getElementById("win-effect");
    d.winStars = document.getElementById("win-stars");
    d.winBgOverlay = document.getElementById("win-bg-overlay");
    d.gameCountdown = document.getElementById("game-countdown");
    d.gameCountdownNum = document.getElementById("game-countdown-num");
    d.charNameDisplay = document.getElementById("character-name-display");
    d.charNameText = document.getElementById("char-name-text");
    d.voiceBtn = document.getElementById("voice-btn");
    d.micBtn = document.getElementById("mic-btn");
    d.micImg = document.getElementById("mic-img");
    d.micLabel = document.getElementById("mic-label");
    d.listeningIndicator = document.getElementById("listening-indicator");
    d.volumeBars = document.getElementById("volume-bars");
    d.speechFeedback = document.getElementById("speech-feedback");
    d.feedbackText = document.getElementById("feedback-text");
    d.feedbackSub = document.getElementById("feedback-sub");
    d.btnContinue = document.getElementById("btn-continue");
    d.gameBg = document.getElementById("game-bg");

    // Round result
    // Round result DOM refs removed (screen deleted)

    // Tier result
    d.tierCharacterImg = document.getElementById("tier-character-img");
    d.tierTextImg = document.getElementById("tier-text-img");
    // d.tierPercentage and d.tierRounds removed (stats section deleted)
    d.tierAward = document.getElementById("tier-award");
    // d.btnPlayAgain removed (play again button deleted)
    d.btnShare = document.getElementById("btn-share");
    d.btnVote = document.getElementById("btn-vote");
    d.btnMore = document.getElementById("btn-more");
    d.shareButtons = document.getElementById("share-buttons");

    // Mute button
    d.muteBtn = document.getElementById("mute-btn");
    d.muteIcon = document.getElementById("mute-icon");

    // Debug
    d.debugPanel = document.getElementById("debug-panel");
    d.debugState = document.getElementById("debug-state");
    d.debugChar = document.getElementById("debug-char");
    d.debugRecognized = document.getElementById("debug-recognized");
    d.debugMatch = document.getElementById("debug-match");
    d.debugRound = document.getElementById("debug-round");
    d.debugOverall = document.getElementById("debug-overall");
    d.debugClose = document.getElementById("debug-close");
    d.debugToggle = document.getElementById("debug-toggle");

    // Text input fallback
    d.textInputFallback = document.getElementById("text-input-fallback");
    d.textInput = document.getElementById("text-input");
    d.btnTextSubmit = document.getElementById("btn-text-submit");
  };

  App.prototype._initEngines = function () {
    var self = this;

    // Init Azure Pronunciation Assessment (visual syllable highlighting)
    // A short-lived token is loaded from the same-origin PHP endpoint.
    if (window.AzureSpeech && window.AZURE_SPEECH_TOKEN) {
      window.AzureSpeech.init(
        window.AZURE_SPEECH_TOKEN,
        window.AZURE_SPEECH_REGION || "eastasia",
      );
    }

    // Game engine
    this.game = new GameEngine({
      debug: this.debug,
      onStateChange: function (newState, oldState) {
        self._onGameStateChange(newState, oldState);
      },
      onWalkProgress: function (progress, bottom, scale, leftPos) {
        self._onWalkProgress(progress, bottom, scale, leftPos);
      },
      onRoundComplete: function (roundData) {
        // handled in advanceToNext flow
      },
    });

    // Voice engine (combines SpeechRecognition + MediaRecorder + AnalyserNode)
    this.voice = new VoiceEngine({
      debug: this.debug,
      lang: "en-US",
      maxAlternatives: 10,
      timeout: 15000, // Safety max — player manually stops mic by tapping again
      audioMatchThreshold: AUDIO_MATCH_THRESHOLD,
      onResult: function (result) {
        self._onVoiceResult(result);
      },
      onError: function (error) {
        self._onVoiceError(error);
      },
      onStart: function () {
        self._onVoiceStart();
      },
      onEnd: function () {
        self._onVoiceEnd();
      },
      onVolumeChange: function (volume) {
        self._updateVolumeBars(volume);
        self._updateMicGradient(volume);
      },
      onSilenceDetected: function () {
        // Keep mic in "listening" state during the 1s delay so the user
        // can still see it's active and tap to stop manually.  The mic
        // only transitions to "disabled" when _handleManualStop fires.
        self._log("Silence detected — waiting 1s before auto-stop");
        var silenceGen = self._micGen;
        setTimeout(function () {
          if (self._micGen !== silenceGen) return; // session changed
          if (
            self._isMicActive() &&
            !self._manualStopPending &&
            !self._voiceHandled
          ) {
            self._log("Auto-stop: closing mic after silence + 1s delay");
            self._manualStopPending = true;
            self._handleManualStop();
          }
        }, 1000);
      },
    });

    // Live matching: auto-stop mic when Web Speech API transcribes the name.
    // Allows exact/contains/phonetic always, AND fuzzy matches if transcript
    // length is close to expected (to handle Kirimichan etc. that Web Speech
    // often transcribes imperfectly).
    this.voice.onInterimResult = function (newTranscripts) {
      if (self._voiceHandled) return;
      if (!self.voice.isListening) return;
      var char = self.game.getCurrentCharacter();
      if (!char) return;

      var textMatch = SpeechEngine.match(
        newTranscripts,
        char.acceptedAnswers,
        4,
      );
      if (!textMatch.matched) return;

      var transcript = (textMatch.transcript || "").replace(/\s/g, "");
      var expectedRef = (char.azureRef || char.displayName || "").replace(
        /\s/g,
        "",
      );
      var minLen = Math.floor(expectedRef.length * 0.7);

      var isStrong =
        textMatch.method === "exact" ||
        textMatch.method === "contains" ||
        textMatch.method === "phonetic";
      var isFuzzyCloseLen =
        textMatch.method === "fuzzy" &&
        transcript.length >= Math.floor(expectedRef.length * 0.8);

      if (!isStrong && !isFuzzyCloseLen) {
        return; // fuzzy match with too-different length → keep listening
      }

      // Length guard: don't auto-stop on short-form matches
      if (transcript.length < minLen) {
        self._log(
          'Live match too short: "' +
            transcript +
            '" (' +
            transcript.length +
            " < " +
            minLen +
            ") — waiting for more",
        );
        return;
      }

      self._log(
        "⚡ Live match detected (" +
          textMatch.method +
          ', "' +
          textMatch.transcript +
          '") → auto-stopping mic',
      );
      // stop() triggers _onVoiceResult which runs Azure syllable check
      self._setMicState("disabled");
      self._showAnalyzingToast();
      self.voice.stop();
    };
  };

  /**
   * Pre-request microphone permission on page load.
   * This avoids a delay when the player first taps the mic during gameplay.
   * The stream is immediately released after permission is granted.
   */
  App.prototype._requestMicPermission = function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    var self = this;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        // Permission granted — release the stream immediately
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        self._log("Mic permission pre-granted");
      })
      .catch(function (e) {
        self._log("Mic permission pre-request failed:", e.message);
        // Don't show error — permission will be requested again when needed
      });
  };

  // ========================
  // Event binding
  // ========================

  App.prototype._bindEvents = function () {
    var self = this;

    // Mute / Unmute toggle
    if (this.dom.muteBtn) {
      this.dom.muteBtn.addEventListener("click", function () {
        var isMuted = self.audio.isMuted();
        self.audio.setMuted(!isMuted);
        var nowMuted = !isMuted;
        self.dom.muteIcon.src = nowMuted
          ? "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/game-visuals/Mute.png"
          : "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/game-visuals/Volume.png";
        self.dom.muteIcon.alt = nowMuted ? "Sound off" : "Sound on";
        self.dom.muteBtn.classList.toggle("muted", nowMuted);
      });
    }

    // Home screen
    this.dom.btnStart.addEventListener("click", function () {
      self.audio.playSFX("btn-click");
      self._showPopup("instructions");
    });

    if (this.dom.btnHowToPlay) {
      this.dom.btnHowToPlay.addEventListener("click", function () {
        self._showPopup("instructions");
      });
    }

    this.dom.btnInstructionsStart.addEventListener("click", function () {
      self._hidePopup("instructions");
      self._startGame();
    });

    if (this.dom.btnInstructionsClose) {
      this.dom.btnInstructionsClose.addEventListener("click", function () {
        self._hidePopup("instructions");
      });
    }

    if (this.dom.btnUnsupportedClose) {
      this.dom.btnUnsupportedClose.addEventListener("click", function () {
        self._hidePopup("unsupported");
      });
    }

    // Mic button
    this.dom.micBtn.addEventListener("click", function () {
      self.audio.playSFX("btn-click");
      self._onMicTap();
    });

    // Voice pronunciation button
    this.dom.voiceBtn.addEventListener("click", function () {
      self._playVoice();
    });

    // Continue button (after fail / give up)
    this.dom.btnContinue.addEventListener("click", function () {
      self.audio.playSFX("btn-click");
      self.audio.playSFX("exit");
      self._continueToNext();
    });

    // Tier result buttons — vote = sanrio.com.hk, more = show popup
    this.dom.btnVote.addEventListener("click", function () {
      self.audio.playSFX("btn-click");
      // GA event: user clicked the voting link
      trackEvent("clicked voting link");
      window.open("https://ranking.sanrio.co.jp/en/", "_blank");
    });
    this.dom.btnMore.addEventListener("click", function () {
      self.audio.playSFX("btn-click");
      document.getElementById("popup-more").classList.add("active");
    });

    // More popup — "回到主頁" button → go back to home
    document
      .getElementById("btn-more-go")
      .addEventListener("click", function () {
        self.audio.playSFX("btn-click");
        document.getElementById("popup-more").classList.remove("active");
        self.audio.stopBGM();
        self.game.resetAll();
        self._showScreen("home");
      });
    // All share buttons use Web Share API with image file
    var shareLinks = this.dom.shareButtons.querySelectorAll(".share-btn");
    for (var i = 0; i < shareLinks.length; i++) {
      shareLinks[i].addEventListener("click", function () {
        self.audio.playSFX("btn-click");
        self._handleShare();
      });
    }

    // Debug panel
    if (this.dom.debugClose) {
      this.dom.debugClose.addEventListener("click", function () {
        self.dom.debugPanel.classList.remove("visible");
      });
    }
    if (this.dom.debugToggle) {
      this.dom.debugToggle.addEventListener("click", function () {
        self.dom.debugPanel.classList.toggle("visible");
      });
    }

    // Text input fallback
    if (this.dom.btnTextSubmit) {
      this.dom.btnTextSubmit.addEventListener("click", function () {
        self._handleTextInput();
      });
      this.dom.textInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          self._handleTextInput();
        }
      });
    }
  };

  // ========================
  // Screen management
  // ========================

  App.prototype._showScreen = function (screenId) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.remove("active");
    }

    var target = document.getElementById("screen-" + screenId);
    if (target) {
      // Small delay for transition effect
      setTimeout(function () {
        target.classList.add("active");
      }, 50);
    }

    // BGM transitions per screen
    if (screenId === "home") {
      this.audio.playBGM("intro");
    } else if (screenId === "game") {
      this.audio.stopBGM();
    } else if (screenId === "tier-result") {
      this.audio.stopBGM();
    }

    this._log("Show screen:", screenId);
  };

  App.prototype._showPopup = function (popupId) {
    var popup = document.getElementById("popup-" + popupId);
    if (popup) popup.classList.add("active");

    // Play intro video when instructions popup opens
    if (popupId === "instructions") {
      var vid = document.getElementById("instr-prev-video");
      if (vid) {
        vid.currentTime = 0;
        vid.play().catch(function () {});
      }
    }
  };

  App.prototype._hidePopup = function (popupId) {
    var popup = document.getElementById("popup-" + popupId);
    if (popup) popup.classList.remove("active");

    // Pause video when popup closes
    if (popupId === "instructions") {
      var vid = document.getElementById("instr-prev-video");
      if (vid) {
        vid.pause();
        vid.currentTime = 0;
      }
    }
  };

  // ========================
  // Game flow
  // ========================

  App.prototype._startGame = function () {
    // GA event: user clicked start game
    trackEvent("clicked start game");

    // Check voice support
    if (!this.voice.isSupported) {
      this._showPopup("unsupported");
      // Show text input fallback
      if (this.dom.textInputFallback) {
        this.dom.textInputFallback.classList.remove("hidden");
      }
    }

    this._startNewRound();
  };

  App.prototype._startNewRound = function () {
    this.game.startNewRound();
    this._showScreen("game");
    this._updateProgressDots();
    this._updateScore();

    // Hide leftover name + character from the previous round BEFORE countdown starts
    this.dom.charNameDisplay.classList.add("hidden");
    this.dom.characterWalker.classList.add("hidden");
    this.dom.gameBg.classList.remove("win-bg");
    if (this.dom.winBgOverlay) this.dom.winBgOverlay.classList.remove("show");
    if (this.dom.winStars) this.dom.winStars.classList.remove("show");
    this.dom.winEffect.classList.remove("show");
    this.dom.ropeLeft.classList.remove("broken");
    this.dom.ropeRight.classList.remove("broken");

    // Wait for custom font to be ready, then run 3-2-1-Go countdown
    var self = this;
    function beginCountdown() {
      self._runCountdown(3, function () {
        self._presentCharacter();
      });
    }
    if (document.fonts && document.fonts.check) {
      // Wait specifically for AG Book Rounded to be loaded
      var fontReady = document.fonts.check('bold 48px "AG Book Rounded"');
      if (fontReady) {
        beginCountdown();
      } else {
        document.fonts
          .load('bold 48px "AG Book Rounded"')
          .then(beginCountdown)
          .catch(beginCountdown);
      }
    } else {
      beginCountdown();
    }
  };

  /**
   * Show 3-2-1 countdown overlay with SFX, then call onDone.
   */
  App.prototype._runCountdown = function (from, onDone) {
    var self = this;
    var count = from;

    // Play the countdown SFX once at the very start
    self.audio.playSFX("countdown");

    function showNext() {
      if (count <= 0) {
        // Play "Ready Go" SFX first, then show "Go!" text synced to the "Go" part
        self.dom.gameCountdown.classList.add("hidden");
        self.audio.playSFX("ready-go");

        setTimeout(function () {
          // Show "Go!" text when the "Go" part of the audio plays
          self.dom.gameCountdownNum.classList.add("ready-go-text");
          self.dom.gameCountdownNum.textContent = "Go!";
          self.dom.gameCountdown.classList.remove("hidden");
          self.dom.gameCountdownNum.style.animation = "none";
          void self.dom.gameCountdownNum.offsetWidth;
          self.dom.gameCountdownNum.style.animation = "";

          setTimeout(function () {
            self.dom.gameCountdown.classList.add("hidden");
            self.dom.gameCountdownNum.classList.remove("ready-go-text");
            onDone();
          }, 800);
        }, 800);
        return;
      }

      // Restart the pop animation each tick by toggling animation
      self.dom.gameCountdownNum.textContent = count;
      self.dom.gameCountdown.classList.remove("hidden");
      self.dom.gameCountdownNum.style.animation = "none";
      void self.dom.gameCountdownNum.offsetWidth; // force reflow
      self.dom.gameCountdownNum.style.animation = "";

      count--;
      setTimeout(showNext, 950);
    }

    showNext();
  };

  /**
   * Show "Ready, Go!" text overlay after countdown, then call onDone.
   * Reuses the countdown overlay element.
   */
  App.prototype._showReadyGo = function (onDone) {
    var self = this;
    var span = self.dom.gameCountdownNum;

    // Use smaller font for text (vs big numbers)
    span.classList.add("ready-go-text");

    // Show "Ready?" text
    span.textContent = "Ready?";
    self.dom.gameCountdown.classList.remove("hidden");
    span.style.animation = "none";
    void span.offsetWidth;
    span.style.animation = "";

    setTimeout(function () {
      // Show "Go!" text
      span.textContent = "Go!";
      span.style.animation = "none";
      void span.offsetWidth;
      span.style.animation = "";

      setTimeout(function () {
        self.dom.gameCountdown.classList.add("hidden");
        span.classList.remove("ready-go-text");
        onDone();
      }, 800);
    }, 800);
  };

  /**
   * Present the current character: load image, show name, start walk
   */
  App.prototype._presentCharacter = function () {
    var char = this.game.getCurrentCharacter();
    if (!char) return;

    // Full reset of mic + stream state for the new character.
    // Bump generation so any pending callbacks from the previous character
    // (Azure SDK or VoiceEngine) are immediately invalidated.
    this._micGen = (this._micGen || 0) + 1;
    this._voiceHandled = false;
    this._azureStreamFinalized = false;
    this._azureLastParsed = null;
    this._manualStopPending = false;
    this._stopAzureStream();
    if (this.voice && this.voice.isListening) {
      try {
        this.voice.abort();
      } catch (e) {}
    }

    // Pre-warm reference audio features so compareAudio is instant later.
    // The extractor caches by URL so this only fetches once per character.
    if (char.voicePath && this.voice && this.voice.featureExtractor) {
      this.voice.featureExtractor
        .extractFromUrl(char.voicePath)
        .catch(function () {});
    }

    // Reset visual state (walker stays hidden via display:none)
    this._resetGameVisuals();

    // Clear the old image immediately to prevent any flash of previous character
    this.dom.characterImg.src = "";

    // Set initial walker position (while still hidden)
    this.dom.characterWalker.style.bottom = ANIM_CONFIG.walkStartBottom + "%";
    this.dom.characterWalker.style.left = ANIM_CONFIG.walkStartLeft + "%";
    this.dom.characterWalker.style.transform =
      "translateX(-50%) scale(" + ANIM_CONFIG.walkStartScale + ")";

    // Show character name — render as syllable spans for Azure highlight support
    this.dom.charNameText.style.setProperty(
      "--char-name-color",
      char.nameColor || "var(--yellow-text)",
    );
    // Uniform size for all character names (CSS handles the scaling to fit)
    this.dom.charNameText.style.fontSize = "";
    this.dom.charNameText.style.letterSpacing = "";
    // Build syllable spans (no colors yet — colored after Azure result)
    this._buildSyllableSpans(char);
    this.dom.charNameDisplay.classList.remove("hidden");

    // Apply per-character star config and hide for new character
    if (this.dom.winStars) {
      this.dom.winStars.classList.remove("show");
      var starCfg = this.game.getStarConfig();
      this.dom.winStars.style.top = starCfg.starTop + "%";
      this.dom.winStars.style.left = starCfg.starLeft + "%";
      this.dom.winStars.style.width = starCfg.starWidth + "%";
      this.dom.winStars.style.setProperty(
        "--star-rotate",
        starCfg.starRotate + "deg",
      );
    }

    // Enable mic early — player can speak during approach
    this._setMicState("enabled");

    // Show text fallback early if voice not supported
    if (!this.voice.isSupported && this.dom.textInputFallback) {
      this.dom.textInputFallback.classList.remove("hidden");
    }

    // Track if voice result came in during walk
    this._earlyVoiceResult = null;
    this._currentWalkProgress = 0;
    this.game.onWalkThroughComplete = null;
    this._isWalkThrough = false;

    // Load new character image, wait for it to load, THEN show and start walk
    var self = this;
    var newImg = new Image();
    newImg.onload = function () {
      // Image loaded — now safe to set src and reveal
      self.dom.characterImg.src = newImg.src;
      self.dom.characterImg.alt = char.displayName;

      // Double rAF to ensure position + image are both painted before revealing
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          self.dom.characterWalker.classList.remove("hidden");
          self.dom.characterRocker.classList.add("rocking");
          self.audio.playBGM("gameplay");
          // Start walk first, then play entrance SFX after a short delay
          // so the sound syncs with the character becoming visible on screen.
          // Characters start off-screen (left: -40) and need ~150ms to reach
          // the visible edge — play SFX to match.
          self.game.startWalk();
          setTimeout(function () {
            self.audio.playSFX("entrance");
          }, 120);
        });
      });
    };
    // If 4x image fails, fallback to 1x; if both fail, continue without image
    newImg.onerror = function () {
      console.warn("[App] Image failed to load:", newImg.src);
      if (newImg.src !== char.image && char.image) {
        console.log("[App] Trying 1x fallback:", char.image);
        newImg.src = char.image;
      } else {
        // Both failed — show character anyway (blank image)
        console.warn("[App] All images failed — continuing without image");
        self.dom.characterImg.alt = char.displayName;
        self.dom.characterWalker.classList.remove("hidden");
        self.dom.characterRocker.classList.add("rocking");
        self.audio.playBGM("gameplay");
        self.game.startWalk();
      }
    };
    // Start loading — if cached, onload fires synchronously or next microtask
    newImg.src = char.image4x || char.image;

    this._log("Presenting character:", char.displayName);
    this._updateDebug();
  };

  /**
   * Reset visual elements to default state
   */
  App.prototype._resetGameVisuals = function () {
    // Hide feedback
    this.dom.speechFeedback.classList.add("hidden");
    this.dom.speechFeedback.classList.remove("success", "fail");
    this.dom.btnContinue.classList.add("hidden");

    // Reset star mic button
    this._setMicState("disabled");
    this.dom.micLabel.textContent = "";
    this.dom.listeningIndicator.classList.add("hidden");

    // Reset volume bars
    if (this.dom.volumeBars) {
      this.dom.volumeBars.classList.add("hidden");
      var bars = this.dom.volumeBars.querySelectorAll(".vol-bar");
      for (var b = 0; b < bars.length; b++) {
        bars[b].style.height = "15%";
      }
    }

    // Reset rope
    this.dom.ropeLeft.classList.remove("broken");
    this.dom.ropeRight.classList.remove("broken");
    this.dom.ropeLine.classList.remove("rope-hit");

    // Reset win effect + golden overlay + stars
    this.dom.winEffect.classList.remove("show");
    if (this.dom.winStars) {
      this.dom.winStars.classList.remove("show");
    }
    if (this.dom.winBgOverlay) {
      this.dom.winBgOverlay.classList.remove("show");
    }

    // Hide character name from previous round
    this.dom.charNameDisplay.classList.add("hidden");

    // Hide character first to prevent flash at old position
    this.dom.characterWalker.classList.add("hidden");

    // Stop stuck shake interval
    this._stopStuckInterval();

    // Reset character (remove all animation classes)
    this.dom.characterWalker.classList.remove(
      "fail-bounce-back",
      "fail-stuck",
      "rope-shake",
    );
    this.dom.characterRocker.classList.remove("rocking");

    // Reset character position to walk start (road vanishing point)
    this.dom.characterWalker.style.left = ANIM_CONFIG.walkStartLeft + "%";
    this.dom.characterWalker.style.bottom = ANIM_CONFIG.walkStartBottom + "%";
    this.dom.characterWalker.style.transform =
      "translateX(-50%) scale(" + ANIM_CONFIG.walkStartScale + ")";

    // Reset background
    this.dom.gameBg.classList.remove("win-bg");

    // Hide text fallback if visible
    if (this.dom.textInputFallback) {
      this.dom.textInput.value = "";
    }

    // Reset feedback sub text
    if (this.dom.feedbackSub) {
      this.dom.feedbackSub.textContent = "";
    }
  };

  /**
   * Centralized mic UI state update.
   * @param {"disabled"|"enabled"|"listening"} state
   * If voice is actively recording and you try to set "disabled" or "enabled",
   * it forces "listening" instead to prevent out-of-sync visuals.
   */
  App.prototype._setMicState = function (state) {
    this.dom.micBtn.classList.remove("listening", "enabled", "disabled");
    this.dom.micBtn.classList.add(state);

    // Reset amplitude ring when not listening
    if (state !== "listening") {
      this.dom.micBtn.style.setProperty("--mic-amp", "0");
    }
  };

  /**
   * Helper: stop all listening-related visuals
   * (reduces duplication between success/fail/error handlers)
   */
  App.prototype._stopListeningVisuals = function () {
    this._setMicState("disabled");
    this._hideAnalyzingToast();
    this.dom.listeningIndicator.classList.add("hidden");
    this.dom.micLabel.textContent = "";

    // Hide volume bars
    if (this.dom.volumeBars) {
      this.dom.volumeBars.classList.add("hidden");
    }

    // Hide text input
    if (this.dom.textInputFallback) {
      this.dom.textInputFallback.classList.add("hidden");
      this.dom.textInput.value = "";
    }
  };

  // ========================
  // Walk animation callback
  // ========================

  App.prototype._onWalkProgress = function (progress, bottom, scale, leftPos) {
    this._currentWalkProgress = progress;
    this._currentWalkScale = scale;
    this.dom.characterWalker.style.bottom = bottom + "%";
    this.dom.characterWalker.style.left = leftPos + "%";
    this.dom.characterWalker.style.transform =
      "translateX(-50%) scale(" + scale + ")";
    // Store end scale as CSS variable for stuck/success animations
    this.dom.characterWalker.style.setProperty("--end-scale", scale);
  };

  // ========================
  // Game state change handler
  // ========================

  App.prototype._onGameStateChange = function (newState, oldState) {
    this._updateDebug();

    switch (newState) {
      case STATE.AT_ROPE:
        this._onCharacterAtRope();
        break;
      case STATE.LISTENING:
        this._onListeningStart();
        break;
      case STATE.SUCCESS:
        this._onSuccess();
        break;
      case STATE.FAIL:
        this._onFail();
        break;
    }
  };

  /**
   * Character has arrived at the rope - play collision shake, then wait for input
   */
  App.prototype._onCharacterAtRope = function () {
    var self = this;

    // Stop rocking animation at rope
    this.dom.characterRocker.classList.remove("rocking");

    // Snap character to per-character rope config position
    var ropeConfig = this.game.getRopeConfig();
    this.dom.characterWalker.style.bottom = ropeConfig.ropeBottom + "%";
    this.dom.characterWalker.style.left = ropeConfig.ropeLeft + "%";
    this.dom.characterWalker.style.transform =
      "translateX(-50%) scale(" + ropeConfig.ropeScale + ")";
    this.dom.characterWalker.style.setProperty(
      "--end-scale",
      ropeConfig.ropeScale,
    );
    this._currentWalkScale = ropeConfig.ropeScale;

    // If voice result came in during walk (no match), process now
    if (this._earlyVoiceResult) {
      var earlyResult = this._earlyVoiceResult;
      this._earlyVoiceResult = null;
      this._log(
        "Processing early voice result from walk phase — skipping shake",
      );
      this._onVoiceResult(earlyResult);
      return;
    }

    // No early result — play normal rope collision shake and wait for input
    this.dom.characterWalker.classList.add("rope-shake");
    this.dom.ropeLine.classList.add("rope-hit");

    // Remove shake class then start stuck animation
    setTimeout(function () {
      self.dom.characterWalker.classList.remove("rope-shake");
      self.dom.ropeLine.classList.remove("rope-hit");
      // Start stuck struggle animation on first rope arrival (same as wrong-answer stuck)
      self._playStuckShake();
      self._startStuckInterval();
    }, 500);

    // _setMicState auto-guards: if voice is recording, keeps "listening" state
    this._setMicState("enabled");

    // Show text fallback if voice not supported
    if (!this.voice.isSupported && this.dom.textInputFallback) {
      this.dom.textInputFallback.classList.remove("hidden");
    }

    this._log("Character at rope, shake played");
  };

  /**
   * Listening state visual feedback
   */
  App.prototype._onListeningStart = function () {
    this._setMicState("listening");
  };

  /**
   * Handle success: rope breaks, stars above head, character pushes through
   */
  App.prototype._onSuccess = function () {
    var self = this;

    // GA event: track which quiz number (1-5) was just solved.
    // currentCharIndex hasn't advanced yet at this point — it advances
    // later via advanceToNext() in _continueToNext.
    var quizNum = (this.game.currentCharIndex || 0) + 1;
    trackEvent("solved quiz " + quizNum);

    // If walk-through is active, the walk animation handles everything.
    // Skip the push-through animation — character is still walking to rope and will exit.
    if (this._isWalkThrough) {
      this._log("Walk-through active — skipping push-through animation");
      return;
    }

    // ── SAFETY: if the walk animation is still running, convert to walk-through ──
    // This catches ANY code path that calls recordSuccess() during WALKING
    // (e.g. _handleManualStop, _onVoiceResult, _finalizeStream).
    // Without this, the push-through animation and walk animation would fight
    // over the same CSS properties, causing the character to jump/shake.
    if (this.game._walkAnimId) {
      this._log("Walk still running — converting to walk-through");
      this._isWalkThrough = true;
      this.game.activateWalkThrough();

      // Stop listening visuals
      this._stopListeningVisuals();

      // Correct answer + rope snap SFX
      this.audio.playSFX("correct");
      setTimeout(function () {
        self.audio.playSFX("rope-snap");
      }, 200);

      // Show stars, break rope, win background
      if (this.dom.winStars) {
        this.dom.winStars.classList.add("show");
      }
      this.dom.ropeLeft.classList.add("broken");
      this.dom.ropeRight.classList.add("broken");
      if (this.dom.winBgOverlay) {
        setTimeout(function () {
          self.dom.winBgOverlay.classList.add("show");
        }, 200);
      }
      this.dom.gameBg.classList.add("win-bg");

      this._updateScore();
      this._updateProgressDots();

      // Set callback for when walk-through exit completes
      this.game.onWalkThroughComplete = function () {
        self.dom.characterWalker.classList.add("hidden");
        self.dom.characterRocker.classList.remove("rocking");
        self.game.onWalkThroughComplete = null;
        self.audio.playSFX("exit");
        self.audio.stopBGM();
        self._continueToNext();
      };
      return;
    }

    // Stop listening visuals
    this._stopListeningVisuals();

    // Correct answer SFX
    this.audio.playSFX("correct");

    // Stop stuck shake interval and force-stop any CSS animation on walker
    this._stopStuckInterval();
    this.dom.characterWalker.classList.remove(
      "fail-stuck",
      "rope-shake",
      "fail-bounce-back",
    );
    this.dom.characterWalker.style.animation = "none";
    // Force reflow to ensure animation is cleared before push-through starts
    void this.dom.characterWalker.offsetWidth;
    this.dom.characterWalker.style.animation = "";
    this.dom.characterRocker.classList.add("rocking");

    // Show stars above character head FIRST (before rope breaks)
    if (this.dom.winStars) {
      this.dom.winStars.classList.add("show");
    }

    // Break rope after stars appear (short delay)
    setTimeout(function () {
      self.audio.playSFX("rope-snap");
      self.dom.ropeLeft.classList.add("broken");
      self.dom.ropeRight.classList.add("broken");
    }, 400);

    // Show golden overlay + win background
    if (this.dom.winBgOverlay) {
      setTimeout(function () {
        self.dom.winBgOverlay.classList.add("show");
      }, 500);
    }
    // Switch to win background (pink → deeper pink with white flowers)
    this.dom.gameBg.classList.add("win-bg");

    // Start success push-through animation AFTER rope breaks
    var ropeConfig = this.game.getRopeConfig();
    var pushDelay = 500;
    var pushDuration = 2500;
    var startBottom = ropeConfig.ropeBottom;
    var endBottom = -70; // Exit completely below screen
    var startScale = ropeConfig.ropeScale;
    var endScale = startScale * 1.17; // Scale up proportionally
    var startLeft = ropeConfig.ropeLeft;
    var endLeft = 50; // Drift toward center as exiting

    // Delay push animation so stars show first, then rope breaks, then character exits
    setTimeout(function () {
      self.audio.playSFX("exit");
      var pushStart = performance.now();

      function pushTick(now) {
        var elapsed = now - pushStart;
        var t = Math.min(elapsed / pushDuration, 1);

        var bottom = startBottom + (endBottom - startBottom) * t;
        var scale = startScale + (endScale - startScale) * t;
        var left = startLeft + (endLeft - startLeft) * t;

        self.dom.characterWalker.style.bottom = bottom + "%";
        self.dom.characterWalker.style.left = left + "%";
        self.dom.characterWalker.style.transform =
          "translateX(-50%) scale(" + scale + ")";

        if (t < 1) {
          requestAnimationFrame(pushTick);
        } else {
          // Hide character after exit animation completes
          self.dom.characterWalker.classList.add("hidden");
          self.audio.stopBGM();
        }
      }
      requestAnimationFrame(pushTick);
    }, pushDelay);

    // No success text — stars effect above character is the only feedback

    // Update score
    this._updateScore();
    this._updateProgressDots();

    // Auto-advance after delay (includes push delay + push animation + buffer)
    setTimeout(
      function () {
        // Ensure character is hidden before loading next
        self.dom.characterWalker.classList.add("hidden");
        self._continueToNext();
      },
      pushDelay + pushDuration + 500,
    );
  };

  /**
   * Walk-through success: triggered when voice matches during walking.
   * Stars appear immediately, rope breaks, character continues walking
   * through the rope and exits below the screen without stopping.
   */
  App.prototype._walkThroughSuccess = function (char, score) {
    var self = this;

    // Stop listening visuals
    this._stopListeningVisuals();

    // Correct answer + rope snap SFX
    this.audio.playSFX("correct");
    setTimeout(function () {
      self.audio.playSFX("rope-snap");
    }, 200);

    // Show stars immediately
    if (this.dom.winStars) {
      this.dom.winStars.classList.add("show");
    }

    // Break rope immediately
    this.dom.ropeLeft.classList.add("broken");
    this.dom.ropeRight.classList.add("broken");

    // Show golden overlay + win background
    if (this.dom.winBgOverlay) {
      setTimeout(function () {
        self.dom.winBgOverlay.classList.add("show");
      }, 200);
    }
    // Switch to win background (pink → deeper pink with white flowers)
    this.dom.gameBg.classList.add("win-bg");

    // IMPORTANT: activate walk-through BEFORE recordSuccess,
    // because recordSuccess sets state to SUCCESS which triggers _onSuccess.
    // _onSuccess checks this flag to skip the push-through animation.
    this._isWalkThrough = true;

    // Activate walk-through in game engine: walk continues past rope
    this.game.activateWalkThrough();

    // Record success (this triggers state change → _onSuccess,
    // but _onSuccess will skip push-through because _isWalkThrough is true)
    this.game.recordSuccess(score);
    this._updateScore();
    this._updateProgressDots();

    // Set callback for when character exits below screen
    this.game.onWalkThroughComplete = function () {
      self.dom.characterWalker.classList.add("hidden");
      self.dom.characterRocker.classList.remove("rocking");
      self.game.onWalkThroughComplete = null;
      self.audio.playSFX("exit");
      self.audio.stopBGM();
      self._continueToNext();
    };

    this._voiceHandled = true;

    this._log("Walk-through success for: " + char.displayName);
  };

  /**
   * Handle wrong answer: infinite stuck animation, re-enable mic for retry.
   * Does NOT record a fail or advance to next character.
   * Called directly from _processMatchResults / _handleTextInput, not from game state machine.
   */
  /**
   * Show "Try again!" toast at top center. Auto-fades out after 1s
   * (with a 400ms opacity transition defined in CSS).
   */
  App.prototype._showTryAgainToast = function () {
    var toast = document.getElementById("try-again-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "try-again-toast";
      toast.textContent = "Try again!";
      document.body.appendChild(toast);
    }
    if (this._tryAgainTimer) {
      clearTimeout(this._tryAgainTimer);
      this._tryAgainTimer = null;
    }
    // Force reflow so the transition replays if shown twice in a row
    toast.classList.remove("visible");
    void toast.offsetWidth;
    toast.classList.add("visible");
    var self = this;
    this._tryAgainTimer = setTimeout(function () {
      toast.classList.remove("visible");
      self._tryAgainTimer = null;
    }, 1000);
  };

  App.prototype._showAnalyzingToast = function () {
    var toast = document.getElementById("analyzing-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "analyzing-toast";
      toast.textContent = "打氣中";
      document.body.appendChild(toast);
    }
    // Don't restart if already showing — prevents animation reset flicker
    if (toast.classList.contains("visible")) return;
    toast.classList.add("visible");
  };

  App.prototype._hideAnalyzingToast = function () {
    var toast = document.getElementById("analyzing-toast");
    if (toast) toast.classList.remove("visible");
  };

  App.prototype._onWrongAnswer = function () {
    var self = this;

    // Wrong answer SFX
    this.audio.playSFX("wrong");

    // "Try again!" toast — show with the wrong SFX, fade out after 1s
    this._showTryAgainToast();

    // Stop listening indicators but keep input available
    this._setMicState("enabled");
    this.dom.listeningIndicator.classList.add("hidden");
    if (this.dom.volumeBars) this.dom.volumeBars.classList.add("hidden");
    this.dom.micLabel.textContent = "";

    // Rope wobbles on impact
    this.dom.ropeLine.classList.add("rope-hit");
    setTimeout(function () {
      self.dom.ropeLine.classList.remove("rope-hit");
    }, 500);

    // Ensure character is at rope config position before stuck animation
    var ropeConfig = this.game.getRopeConfig();
    var stuckScale = ropeConfig.ropeScale;
    this.dom.characterWalker.style.bottom = ropeConfig.ropeBottom + "%";
    this.dom.characterWalker.style.left = ropeConfig.ropeLeft + "%";
    this.dom.characterWalker.style.setProperty("--end-scale", stuckScale);
    // Set inline transform to EXACTLY match animation's 0% keyframe
    // so there's no visual jump when the animation starts
    this.dom.characterWalker.style.transform =
      "translateX(-50%) scale(" + stuckScale + ")";
    this._currentWalkScale = stuckScale;

    // Force browser to apply the above styles before starting animation
    // (prevents first-frame flicker)
    void this.dom.characterWalker.offsetHeight;

    // Play stuck shake once immediately, then repeat every 300ms
    this._playStuckShake();
    this._startStuckInterval();

    // Set state back to AT_ROPE so mic can be tapped again
    this.game.state = STATE.AT_ROPE;
    this._voiceHandled = false;
    this._azureStreamFinalized = false;
    this._azureLastParsed = null;
    this._manualStopPending = false;
    // Bump generation so stale callbacks from the dying session are ignored
    this._micGen = (this._micGen || 0) + 1;
    this._updateDebug();

    // Re-enable mic after brief wobble plays
    var wrongGen = this._micGen;
    setTimeout(function () {
      // Skip if a new session has started (user tapped mic again quickly)
      if (self._micGen !== wrongGen) return;
      self._setMicState("enabled");

      // Keep text fallback available for retry
      if (!self.voice.isSupported && self.dom.textInputFallback) {
        self.dom.textInputFallback.classList.remove("hidden");
        self.dom.textInput.value = "";
      }
    }, 600);

    this._log("Wrong answer — stuck animation, retry enabled");
  };

  /**
   * Legacy _onFail — no longer used in new flow (wrong answers use _onWrongAnswer).
   * Kept as safety net if game state machine triggers FAIL somehow.
   */
  App.prototype._onFail = function () {
    // Redirect to wrong answer handler
    this._onWrongAnswer();
  };

  /**
   * Play one stuck shake animation (removes and re-adds class to retrigger).
   */
  App.prototype._playStuckShake = function () {
    var walker = this.dom.characterWalker;
    walker.classList.remove("fail-stuck");
    void walker.offsetHeight;
    walker.classList.add("fail-stuck");
  };

  /**
   * Start stuck shake loop: shake once (0.45s) → rest 300ms → repeat.
   */
  App.prototype._startStuckInterval = function () {
    this._stopStuckInterval();
    this._stuckRunning = true;
    var self = this;

    function loop() {
      if (!self._stuckRunning) return;
      self._playStuckShake();
      // Wait for animation (450ms) + rest (500ms) before next shake
      self._stuckTimeoutId = setTimeout(function () {
        if (self._stuckRunning) loop();
      }, 950);
    }
    loop();
  };

  /**
   * Stop the stuck shake loop.
   */
  App.prototype._stopStuckInterval = function () {
    this._stuckRunning = false;
    if (this._stuckTimeoutId) {
      clearTimeout(this._stuckTimeoutId);
      this._stuckTimeoutId = null;
    }
    this.dom.characterWalker.classList.remove("fail-stuck");
  };

  /**
   * Continue to next character or show round result
   * Guarded to prevent double-click from skipping characters
   */
  App.prototype._continueToNext = function () {
    // Guard: only advance from SUCCESS state (fail no longer advances)
    if (
      this.game.state !== STATE.SUCCESS &&
      this.game.state !== STATE.ROUND_COMPLETE
    ) {
      this._log("_continueToNext ignored - state:", this.game.state);
      return;
    }

    var result = this.game.advanceToNext();

    if (result.isRoundComplete) {
      // Skip round result popup — go straight to tier result (Gold/Silver/Bronze)
      this._showTierResult();
    } else {
      this._presentCharacter();
    }
  };

  // ========================
  // Mic / Voice handling
  // ========================

  /**
   * Handle mic button tap.
   * - First tap: start Azure streaming + VoiceEngine (for amplitude UI)
   * - Second tap: stop streaming and finalize result
   */
  App.prototype._onMicTap = function () {
    // ── Priority 1: currently recording → stop immediately ──
    if (this.voice.isListening) {
      this._log("Mic tap — manual stop (voice active)");
      this._manualStopPending = true;
      this._handleManualStop();
      return;
    }

    // ── Priority 2: assessment in flight or pending stop → cancel and reset ──
    if (this._restPending || this._manualStopPending) {
      this._log("Mic tap — cancelling in-flight assessment");
      this._micGen = (this._micGen || 0) + 1;
      this._restPending = false;
      this._manualStopPending = false;
      this._voiceHandled = false;
      try {
        this.voice.abort();
      } catch (e) {}
      this._softResetMic();
      return;
    }

    if (
      this.game.state !== STATE.AT_ROPE &&
      this.game.state !== STATE.WALKING
    ) {
      this._log(
        "Mic tap ignored - not at rope or walking. State:",
        this.game.state,
      );
      return;
    }

    // During walking, only allow mic after progress >= 0.18
    if (
      this.game.state === STATE.WALKING &&
      (this._currentWalkProgress || 0) < 0.18
    ) {
      this._log(
        "Mic tap ignored - walk progress too early: " +
          (this._currentWalkProgress || 0).toFixed(2),
      );
      return;
    }

    // Reset all state for a fresh attempt
    this._voiceHandled = false;
    this._azureStreamFinalized = false;
    this._azureLastParsed = null;
    this._manualStopPending = false;
    // Bump generation — stale callbacks from previous sessions will bail out
    this._micGen = (this._micGen || 0) + 1;

    this._stopStuckInterval();
    this._resetSyllableHighlight();
    this._setMicState("listening");

    if (this.game.state === STATE.AT_ROPE) {
      this.game.setListening();
    }

    var char = this.game.getCurrentCharacter();
    var self = this;
    var startGen = this._micGen;

    // NOTE: SDK streaming recognizer is intentionally disabled. Its
    // `recognizing` events rarely carry PA data and its stop() can take
    // 5–10s to flush. Instead VoiceEngine captures PCM and we call Azure
    // REST once on stop (_onVoiceResult path). No pseudo-stream flag —
    // mic-active state is driven by VoiceEngine + _restPending.
    void startGen;
    void char;

    // ── Also start VoiceEngine for amplitude ring + text fallback ──
    var primaryLang = char && char.primaryLang ? char.primaryLang : "en-US";
    this.voice.start({ primaryLang: primaryLang });
  };

  /**
   * Returns true if the recording session is currently active.
   * Uses _azureStream as the single source of truth — voice.isListening
   * is an independent amplitude-UI engine and shouldn't drive mic logic.
   */
  App.prototype._isMicActive = function () {
    return this.voice.isListening || !!this._restPending;
  };

  /**
   * Deterministic manual-stop handler.
   *
   *   1. If we already have PA partial data → finalize now (instant).
   *   2. Otherwise: call SDK.stop() and WAIT for its `recognized` event
   *      (which flushes buffered audio and delivers full PA, ~300-700ms).
   *   3. Safety timeout at 1500ms → soft reset if SDK never responds.
   *
   * We keep `_azureStream` alive during the wait so its callbacks aren't
   * considered stale. `_finalizeStream` will null it out once PA arrives.
   */
  App.prototype._handleManualStop = function () {
    var char = this.game.getCurrentCharacter();
    if (!char) {
      this._manualStopPending = false;
      this._softResetMic();
      return;
    }

    // Abort VoiceEngine synchronously — this flushes voice.pcmWavBlob
    // immediately via _stopVolumeMonitoring. We do NOT use voice.stop()
    // because Web Speech API's graceful shutdown can take several seconds
    // to emit its end event, causing the observed "result appears later"
    // bug. abort() is synchronous.
    var hadVoice = this.voice && this.voice.hasVoiceDetected;
    this._voiceHandled = true; // prevents _onVoiceResult/_onVoiceEnd races
    try {
      this.voice.abort();
    } catch (e) {}

    // Show analyzing toast immediately when mic closes
    this._setMicState("disabled");
    this._showAnalyzingToast();

    var pcm = this.voice && this.voice.pcmWavBlob;

    // Guard: if no real speech was detected or the PCM blob is too small
    // (< 4KB ≈ barely any audio), don't run assessment — treat as wrong.
    // This prevents passing when manually stopping without saying anything,
    // or when SFX bleed into the mic triggers a false-positive.
    var MIN_PCM_SIZE = 4000; // ~0.1s of 16-bit 16kHz mono WAV
    if (!hadVoice || !pcm || pcm.size < MIN_PCM_SIZE) {
      this._log(
        "Manual stop — no speech detected (hadVoice=" +
          !!hadVoice +
          ", pcmSize=" +
          (pcm ? pcm.size : 0) +
          "), treating as wrong",
      );
      this._manualStopPending = false;
      this._hideAnalyzingToast();
      this._onWrongAnswer();
      return;
    }

    if (!window.AzureSpeech || !window.AzureSpeech.assess) {
      this._log("Manual stop — no Azure available, soft reset");
      this._manualStopPending = false;
      this._hideAnalyzingToast();
      this._softResetMic();
      return;
    }

    // Processing state — disable mic while analyzing
    this._restPending = true;
    if (this.dom.micLabel) this.dom.micLabel.textContent = "";
    this._log(
      "Manual stop — REST assess (" + (pcm.size / 1024).toFixed(1) + "KB)",
    );

    var self = this;
    var gen = this._micGen;
    var done = false;

    // Run audio similarity (vs voicePath) AND Azure PA in parallel.
    // Pass if EITHER signal is strong enough:
    //   - audioSimilarity >= AUDIO_MATCH_THRESHOLD    → pass (primary)
    //   - Azure all syllables green                    → pass (secondary)
    var audioPromise =
      char.voicePath && self.voice && self.voice.compareAudio
        ? self.voice.compareAudio(char.voicePath).catch(function () {
            return { similarity: 0, supported: false };
          })
        : Promise.resolve({ similarity: 0, supported: false });

    var azurePromise = window.AzureSpeech.assess(pcm, char).catch(
      function (err) {
        self._log("Azure assess error: " + (err && err.message));
        return null;
      },
    );

    var finish = function (audioResult, parsed) {
      if (done) return;
      done = true;
      self._restPending = false;
      self._manualStopPending = false;
      self._hideAnalyzingToast();
      if (self._micGen !== gen) return;

      // ── Azure syllable signal (secondary) ──
      var azureOverall = (parsed && parsed.overallScore) || 0;
      var azurePass = false;
      if (parsed && parsed.syllableResults) {
        azurePass = true;
        for (var i = 0; i < parsed.syllableResults.length; i++) {
          var syl = parsed.syllableResults[i];
          if (!syl.isSpace && syl.score !== null && !syl.correct) {
            azurePass = false;
            break;
          }
        }
      }

      // ── Audio similarity signal (primary) ──
      var audioSim = (audioResult && audioResult.similarity) || 0;
      var audioPass =
        audioResult &&
        audioResult.supported &&
        audioSim >= AUDIO_MATCH_THRESHOLD;

      // Safety: don't trust audio similarity alone — Azure must confirm
      // EVERY syllable was attempted. A score of 0 means the player
      // didn't say that syllable at all (e.g. "Cin Na" without "Mo Roll").
      // Audio pass is only trusted when all syllables have score > 0.
      if (audioPass && parsed && parsed.syllableResults) {
        var missedSyls = [];
        for (var si = 0; si < parsed.syllableResults.length; si++) {
          var ss = parsed.syllableResults[si];
          if (ss.isSpace) continue;
          if (ss.score === 0 || ss.score === null) {
            missedSyls.push(ss.text);
          }
        }
        if (missedSyls.length > 0) {
          self._log(
            "Audio pass overridden — missed syllables: " +
              missedSyls.join(", ") +
              " (score=0)",
          );
          audioPass = false;
        }
      }
      // Also block audio pass if Azure overall ≤ 10 (nothing recognized)
      if (audioPass && parsed && azureOverall <= 10) {
        self._log(
          "Audio pass overridden — Azure overall=" +
            azureOverall +
            " too low, likely no real speech",
        );
        audioPass = false;
      }

      // Word order check: block pass if words were spoken out of order
      if (parsed && parsed.wordOrderCorrect === false) {
        self._log("Word order incorrect — overriding pass to FAIL");
        azurePass = false;
        audioPass = false;
      }

      var finalPass = audioPass || azurePass;

      // Render syllable highlights AFTER deciding pass/fail so we can keep
      // the visual state consistent with the final result. If audio passed
      // but Azure marked some syllables as wrong, force all syllables to
      // green so the player doesn't see a "wrong" highlight on a passing
      // attempt.
      if (parsed && parsed.syllableResults) {
        if (parsed.wordOrderCorrect === false) {
          // Word order wrong — force all syllables red
          var wrongOrder = parsed.syllableResults.map(function (s) {
            if (s.isSpace) return s;
            return { text: s.text, score: s.score, correct: false };
          });
          self._renderSyllableHighlight(wrongOrder);
        } else if (finalPass && !azurePass) {
          var forced = parsed.syllableResults.map(function (s) {
            if (s.isSpace) return s;
            return { text: s.text, score: s.score, correct: true };
          });
          self._renderSyllableHighlight(forced);
        } else {
          self._renderSyllableHighlight(parsed.syllableResults);
        }
      } else {
        // Azure returned no syllable data — mirror final pass/fail on every syllable
        self._forceAllSyllables(finalPass);
      }
      var finalScore = Math.max(
        Math.round(audioSim),
        (parsed && parsed.overallScore) || 0,
      );

      self._log(
        "Manual result: " +
          (finalPass ? "PASS" : "FAIL") +
          "  audio=" +
          audioSim.toFixed(0) +
          (audioPass ? "✅" : "❌") +
          "  azure=" +
          ((parsed && parsed.overallScore) || 0) +
          (azurePass ? "✅" : "❌") +
          "  wordOrder=" +
          (parsed && parsed.wordOrderCorrect !== false ? "✅" : "❌"),
      );

      if (finalPass) {
        // If character is still walking, use walk-through success path
        if (self.game.state === STATE.WALKING) {
          self._walkThroughSuccess(char, finalScore);
        } else {
          self.game.recordSuccess(finalScore);
        }
      } else {
        self._onWrongAnswer();
      }
    };

    // ── Both signals must be available before deciding pass/fail.
    // Audio similarity alone can't be trusted — Azure must confirm
    // at least half the syllables were said correctly.
    Promise.all([audioPromise, azurePromise]).then(function (results) {
      finish(results[0], results[1]);
    });

    // Hard safety cap
    setTimeout(function () {
      finish(null, null);
    }, 6000);
  };

  /**
   * Start Azure SDK streaming session for live pronunciation assessment.
   * Auto-stops when:
   *   - all syllables are green (live), or
   *   - SDK detects 1s of silence (built-in)
   *
   * @param {Object} char - current character
   * @param {number} gen  - session generation; stale callbacks bail out
   */
  App.prototype._startAzureStream = function (char, gen) {
    if (!window.AzureSpeech || !window.AzureSpeech.startStreaming) {
      this._log(
        "AzureSpeech.startStreaming not available — skipping live mode",
      );
      return;
    }
    if (
      !window.AZURE_SPEECH_TOKEN
    ) {
      this._log("Azure key not configured — skipping live mode");
      return;
    }
    if (!char.azureRef || !char.nameSyllables) {
      this._log("Char missing azureRef/nameSyllables — skipping live mode");
      return;
    }

    // If the character has an alt ref, rotate between primary and alt
    // on successive retries of the same character. First attempt uses
    // primary; after a fail, next attempt uses alt; after that, primary again.
    var streamChar = char;
    if (char.azureRefAlt) {
      this._retryRefIndex = this._retryRefIndex || {};
      var prevIdx = this._retryRefIndex[char.id] || 0;
      if (prevIdx === 1) {
        // Use alt — clone char and swap refs
        streamChar = {};
        for (var k in char) streamChar[k] = char[k];
        streamChar.azureRef = char.azureRefAlt;
        this._log('Using ALT ref: "' + streamChar.azureRef + '"');
      } else {
        this._log('Using PRIMARY ref: "' + char.azureRef + '"');
      }
    }

    var self = this;
    var startedAt = Date.now();
    var isStale = function () {
      return self._micGen !== gen;
    };

    this._azureStream = window.AzureSpeech.startStreaming(streamChar, {
      onPartial: function (parsed) {
        if (isStale()) return;
        if (self._azureStreamFinalized) return;
        // Live highlight update — force red if word order wrong
        self._azureLastParsed = parsed;
        if (parsed.wordOrderCorrect === false) {
          var woPartial = parsed.syllableResults.map(function (s) {
            if (s.isSpace) return s;
            return { text: s.text, score: s.score, correct: false };
          });
          self._renderSyllableHighlight(woPartial);
        } else {
          self._renderSyllableHighlight(parsed.syllableResults);
        }

        // Auto-stop the moment ALL syllables are green
        if (self._allSyllablesGreen(parsed)) {
          self._log("⚡ All syllables green — auto-stopping mic");
          self._finalizeStream("all-green", parsed);
        }
      },
      onFinal: function (parsed) {
        if (isStale()) {
          self._log(
            "Stale onFinal ignored (gen " + gen + " vs " + self._micGen + ")",
          );
          return;
        }
        var elapsed = Date.now() - startedAt;
        var hasPA = parsed && parsed.syllableResults;
        // Ignore "ghost final" — empty PA arriving very fast (only when not
        // manual-stopping) means the recognizer hadn't connected yet.
        if (!hasPA && elapsed < 400 && !self._manualStopPending) {
          self._log("Ghost onFinal ignored (no PA, elapsed " + elapsed + "ms)");
          return;
        }
        if (hasPA) {
          self._azureLastParsed = parsed;
        }
        // Use "manual" reason if player initiated the stop
        var reason = self._manualStopPending ? "manual" : "sdk-final";
        self._finalizeStream(reason, self._azureLastParsed);
      },
      onError: function (msg) {
        if (isStale()) {
          self._log("Stale onError ignored: " + msg);
          return;
        }
        self._log("Azure stream error: " + msg);
        self._finalizeStream("error", self._azureLastParsed);
      },
    });
  };

  /**
   * UNIFIED finalize path. Called from any of these triggers:
   *   - "all-green"  : live partial showed all syllables green → success
   *   - "sdk-final"  : SDK silence timeout fired → use last parsed
   *   - "manual"     : player tapped mic to stop → use last parsed
   *   - "error"      : SDK errored → use last parsed (or no-PA fail)
   *
   * Always:
   *   1. Marks _voiceHandled + _azureStreamFinalized synchronously
   *   2. Aborts both stream + voice engine (no async result fires)
   *   3. Decides PASS / FAIL from last parsed
   *   4. Mic state is reset by recordSuccess / _onWrongAnswer
   */
  App.prototype._finalizeStream = function (reason, parsed) {
    if (this._voiceHandled) return;
    this._voiceHandled = true;
    this._azureStreamFinalized = true;
    this._manualStopPending = false;
    this._restPending = false;
    this._hideAnalyzingToast();

    parsed = parsed || this._azureLastParsed;

    // Stop both engines IMMEDIATELY.
    // Use voice.abort() (not stop) so VoiceEngine doesn't fire another
    // _onVoiceResult — we already have all the data we need from Azure stream.
    this._stopAzureStream();
    if (this.voice.isListening) {
      try {
        this.voice.abort();
      } catch (e) {}
    }

    var char = this.game.getCurrentCharacter();
    if (!char) {
      this._setMicState("enabled");
      return;
    }

    if (parsed && parsed.syllableResults) {
      // Render highlights — force red if word order is wrong
      if (parsed.wordOrderCorrect === false) {
        var woResults = parsed.syllableResults.map(function (s) {
          if (s.isSpace) return s;
          return { text: s.text, score: s.score, correct: false };
        });
        this._renderSyllableHighlight(woResults);
      } else {
        this._renderSyllableHighlight(parsed.syllableResults);
      }
      if (this._allSyllablesGreen(parsed)) {
        this._logStreamResult(char, parsed, true, reason);
        // Reset retry index on success
        if (this._retryRefIndex) this._retryRefIndex[char.id] = 0;
        // If character is still walking, use walk-through success path
        if (this.game.state === STATE.WALKING) {
          this._walkThroughSuccess(char, parsed.overallScore || 0);
        } else {
          this.game.recordSuccess(parsed.overallScore || 0);
        }
        return;
      }
      this._logStreamResult(char, parsed, false, reason);
      // Toggle ref index so next retry uses the other pronunciation
      if (char.azureRefAlt) {
        this._retryRefIndex = this._retryRefIndex || {};
        this._retryRefIndex[char.id] =
          (this._retryRefIndex[char.id] || 0) === 0 ? 1 : 0;
      }
      this._onWrongAnswer();
      return;
    }

    // No PA data at all — silent retry, NO fail animation
    // (often means SDK closed before player started speaking, or
    // network/init error — don't punish the player for it).
    console.log(
      "%c📊 Stream silent (" +
        reason +
        "): " +
        char.displayName +
        " — no PA data, mic re-enabled",
      "color:#FF9800;font-weight:bold;font-size:13px",
    );
    this._softResetMic();
  };

  /**
   * Soft reset: clear all stream state and re-enable the mic without
   * triggering the wrong-answer animation. Used when SDK closes silently.
   */
  App.prototype._softResetMic = function () {
    // Bump generation so any pending callbacks from the dying session are stale
    this._micGen = (this._micGen || 0) + 1;
    this._voiceHandled = false;
    this._azureStreamFinalized = false;
    this._azureLastParsed = null;
    this._manualStopPending = false;
    this._restPending = false;
    this._stopAzureStream();
    if (this.voice.isListening) {
      try {
        this.voice.abort();
      } catch (e) {}
    }
    // Snap UI back so the next tap starts fresh
    this._setMicState("enabled");
    this._hideAnalyzingToast();
    this.dom.listeningIndicator.classList.add("hidden");
    if (this.dom.volumeBars) this.dom.volumeBars.classList.add("hidden");
    if (this.dom.micLabel) this.dom.micLabel.textContent = "";
    // Game state back to AT_ROPE so mic can be tapped again
    if (this.game.state === STATE.LISTENING) {
      this.game.state = STATE.AT_ROPE;
    }
  };

  /** Pretty-print stream result to console. */
  App.prototype._logStreamResult = function (char, parsed, pass, reason) {
    var sylLog = parsed.syllableResults
      .filter(function (r) {
        return !r.isSpace;
      })
      .map(function (r) {
        return r.text + ":" + r.score + (r.correct ? "✅" : "❌");
      })
      .join("  ");
    console.log(
      "%c📊 Stream " +
        (pass ? "PASS" : "FAIL") +
        " (" +
        reason +
        "): " +
        char.displayName +
        " %c" +
        (parsed.overallScore || 0) +
        "%  " +
        sylLog,
      "color:#FF6BB1;font-weight:bold;font-size:13px",
      "color:" +
        (pass ? "#66BB6A" : "#EF5350") +
        ";font-weight:bold;font-size:13px",
    );
  };

  /** Stop the Azure streaming session if active. */
  App.prototype._stopAzureStream = function () {
    if (this._azureStream) {
      try {
        this._azureStream.stop();
      } catch (e) {}
      this._azureStream = null;
    }
  };

  /** Check if every non-space syllable in a parsed result is green. */
  App.prototype._allSyllablesGreen = function (parsed) {
    if (!parsed || !parsed.syllableResults) return false;
    // Word order must be correct
    if (parsed.wordOrderCorrect === false) return false;
    var hasAny = false;
    for (var i = 0; i < parsed.syllableResults.length; i++) {
      var s = parsed.syllableResults[i];
      if (s.isSpace) continue;
      if (s.score === null) continue;
      hasAny = true;
      if (!s.correct) return false;
    }
    return hasAny; // require at least one scored syllable
  };

  App.prototype._onVoiceStart = function () {
    this._log("Voice capture started");
  };

  /**
   * Handle voice result — Azure Pronunciation Assessment is primary matcher.
   * Falls back to text matching (SpeechEngine) only if Azure is unavailable.
   *
   * @param {{transcripts:Array, recordedBlob:Blob|null, hasAudio:boolean}} result
   */
  App.prototype._onVoiceResult = function (result) {
    if (this._voiceHandled) return;
    // Clear processing flag — we're about to handle the result.
    this._restPending = false;
    this._manualStopPending = false;
    this._hideAnalyzingToast();

    // ── WALKING: store result for rope arrival (Azure needs full recording) ──
    if (this.game.state === STATE.WALKING) {
      this._earlyVoiceResult = result;
      this._log("Voice result during walk — stored for Azure at rope");
      return;
    }

    this._voiceHandled = true;
    this.game.setProcessing();

    var char = this.game.getCurrentCharacter();
    if (!char) return;

    var self = this;
    var progress = this.game.getProgress();

    console.log(
      "%c🎯 Character " +
        progress.current +
        "/" +
        progress.total +
        ": " +
        char.displayName,
      "color:#FF6BB1;font-weight:bold;font-size:14px",
    );

    // ── Text matching (instant — runs alongside Azure) ──
    var textMatch = { matched: false };
    if (result.transcripts && result.transcripts.length > 0) {
      textMatch = SpeechEngine.match(
        result.transcripts,
        char.acceptedAnswers,
        4,
      );
    }
    var textScore = 0;
    if (textMatch.matched) {
      if (textMatch.method === "exact" || textMatch.method === "contains") {
        textScore = 100;
      } else if (textMatch.method === "phonetic") {
        textScore = 85;
      } else if (textMatch.method === "fuzzy") {
        var normIn = SpeechEngine.normalize(textMatch.transcript || "");
        var normAn = SpeechEngine.normalize(textMatch.answer || "");
        var mLen = Math.max(normIn.length, normAn.length, 1);
        textScore = Math.round((1 - (textMatch.distance || 0) / mLen) * 100);
        textScore = Math.max(0, Math.min(65, textScore));
      }
    }
    var textPass = textScore >= 40;

    // ── Azure Pronunciation Assessment (parallel — 2 s timeout) ──
    var azureBlob = result.pcmWavBlob || result.recordedBlob;
    var useAzure =
      window.AzureSpeech &&
      window.AZURE_SPEECH_TOKEN &&
      azureBlob &&
      char.nameSyllables;

    if (useAzure) {
      // Wait for REST PA (typically 300–900ms). Hard cap at 6s safety.
      Promise.race([
        window.AzureSpeech.assess(azureBlob, char),
        new Promise(function (r) {
          setTimeout(function () {
            r(null);
          }, 6000);
        }),
      ]).then(function (azureResult) {
        var azureScore = (azureResult && azureResult.overallScore) || 0;

        // Azure pass: ALL syllables must be >= 50% (not just overall average)
        var allSyllablesPass = true;
        if (azureResult && azureResult.syllableResults) {
          for (var si = 0; si < azureResult.syllableResults.length; si++) {
            var syl = azureResult.syllableResults[si];
            if (!syl.isSpace && syl.score !== null && !syl.correct) {
              allSyllablesPass = false;
              break;
            }
          }
        } else {
          allSyllablesPass = false;
        }
        var azurePass = allSyllablesPass;

        // Word order check: block pass if words were spoken out of order
        if (azureResult && azureResult.wordOrderCorrect === false) {
          self._log("Word order incorrect — overriding Azure pass to FAIL");
          azurePass = false;
        }

        // If Azure returned syllable results, it's the source of truth.
        // If Azure failed entirely (null result), fall back to text match.
        var azureAvailable = !!(azureResult && azureResult.syllableResults);
        var finalPass = azureAvailable ? azurePass : textPass;
        var finalScore = Math.max(azureScore, textScore);

        // Show syllable highlights AFTER word order check
        if (azureAvailable) {
          if (azureResult.wordOrderCorrect === false) {
            // Word order wrong — force all syllables red
            var wrongOrder = azureResult.syllableResults.map(function (s) {
              if (s.isSpace) return s;
              return { text: s.text, score: s.score, correct: false };
            });
            self._renderSyllableHighlight(wrongOrder);
          } else {
            self._renderSyllableHighlight(azureResult.syllableResults);
          }
        } else {
          // Azure unavailable — mirror text-match pass/fail on every syllable
          self._forceAllSyllables(finalPass);
        }

        self._logMatchResult(
          char,
          azureScore,
          azurePass,
          textScore,
          textPass,
          finalPass,
          finalScore,
          azureResult,
        );

        if (finalPass) {
          if (self.game.state === STATE.WALKING) {
            self._walkThroughSuccess(char, finalScore);
          } else {
            self.game.recordSuccess(finalScore);
          }
        } else {
          self._onWrongAnswer();
        }
      });
    } else {
      // Azure not configured — text matching only
      console.log("%c── Text matching only (no Azure) ──", "color:#999");
      if (textPass) {
        if (this.game.state === STATE.WALKING) {
          this._walkThroughSuccess(char, textScore);
        } else {
          this.game.recordSuccess(textScore);
        }
      } else {
        this._onWrongAnswer();
      }
    }
  };

  /**
   * Log the combined Azure + text matching result to console.
   */
  App.prototype._logMatchResult = function (
    char,
    azureScore,
    azurePass,
    textScore,
    textPass,
    finalPass,
    finalScore,
    azureResult,
  ) {
    console.group(
      "%c📊 Voice Match Result",
      "color:#FF6BB1;font-weight:bold;font-size:13px",
    );
    console.log("  Character: " + char.displayName);

    if (azureResult && azureResult.syllableResults) {
      var syllableLog = azureResult.syllableResults
        .filter(function (s) {
          return !s.isSpace;
        })
        .map(function (s) {
          return s.text + ":" + s.score + (s.correct ? "✅" : "❌");
        })
        .join("  ");
      console.log("  Syllables: " + syllableLog);
      console.log(
        "  Azure: %c" + azureScore + "% " + (azurePass ? "✅" : "❌"),
        "color:" + (azurePass ? "#66BB6A" : "#EF5350") + ";font-weight:bold",
      );
    }
    console.log(
      "  Text:  %c" + textScore + "% " + (textPass ? "✅" : "❌"),
      "color:" + (textPass ? "#66BB6A" : "#EF5350") + ";font-weight:bold",
    );
    console.log(
      "  %cFinal: " +
        finalScore +
        "% → " +
        (finalPass ? "✅ PASS" : "❌ FAIL") +
        (finalPass && !azurePass && textPass ? "  (text match saved it)" : ""),
      "color:" +
        (finalPass ? "#66BB6A" : "#EF5350") +
        ";font-weight:bold;font-size:13px",
    );
    console.groupEnd();
    if (this.dom.feedbackSub) this.dom.feedbackSub.textContent = "";
  };

  /**
   * Build syllable <span> elements inside #char-name-text.
   * Called when a new character is presented (no colours yet).
   * @param {Object} char - character data with optional nameSyllables
   */
  App.prototype._buildSyllableSpans = function (char) {
    var el = this.dom.charNameText;
    if (!el) return;

    if (char.nameSyllables && char.nameSyllables.length) {
      // nameSyllables items:
      //   - "|"           → Azure word boundary, NO visible separator
      //   - " ", "-", ".", "•"  → Azure word boundary WITH visible separator
      //   - any other     → a pronounced syllable
      // Fallback: if using legacy "|" only, a separator is inferred from
      // displayName (space / hyphen).
      var dn = char.displayName || "";
      var inferredSep = "";
      if (char.displaySeparator) inferredSep = char.displaySeparator;
      else if (dn.indexOf(" ") !== -1) inferredSep = " ";
      else if (dn.indexOf("-") !== -1) inferredSep = "-";

      var SEP_CHARS = { " ": 1, "-": 1, ".": 1, "•": 1 };
      var html = "";
      for (var i = 0; i < char.nameSyllables.length; i++) {
        var tok = char.nameSyllables[i];
        if (tok === "|") {
          if (inferredSep) {
            html +=
              '<span class="char-syllable-space" data-sep="' +
              i +
              '">' +
              inferredSep +
              "</span>";
          }
        } else if (SEP_CHARS[tok]) {
          var cls = "char-syllable-space";
          if (tok === ".") cls += " sep-dot";
          else if (tok === "-") cls += " sep-hyphen";
          html +=
            '<span class="' + cls + '" data-sep="' + i + '">' + tok + "</span>";
        } else {
          html +=
            '<span class="char-syllable" data-syl="' +
            i +
            '">' +
            tok +
            "</span>";
        }
      }
      el.innerHTML = html;
    } else {
      // Fallback: plain text (no Azure data for this character)
      el.textContent = char.displayName.toUpperCase();
    }
  };

  /**
   * Reset syllable spans to neutral colour (remove green/red).
   * Called when player starts a new recording attempt.
   */
  App.prototype._resetSyllableHighlight = function () {
    var el = this.dom.charNameText;
    if (!el) return;
    var spans = el.querySelectorAll(".char-syllable, .char-syllable-space");
    for (var i = 0; i < spans.length; i++) {
      spans[i].classList.remove("syl-correct", "syl-wrong");
    }
  };

  /**
   * Force all syllable spans to a single colour. Used when Azure didn't
   * return syllable data but the audio-similarity path decided pass/fail.
   */
  App.prototype._forceAllSyllables = function (correct) {
    var el = this.dom.charNameText;
    if (!el) return;
    var spans = el.querySelectorAll(".char-syllable, .char-syllable-space");
    var cls = correct ? "syl-correct" : "syl-wrong";
    for (var i = 0; i < spans.length; i++) {
      spans[i].classList.remove("syl-correct", "syl-wrong");
      spans[i].classList.add(cls);
    }
  };

  /**
   * Colour syllable spans green/red based on Azure assessment results.
   * Called after Azure Pronunciation Assessment returns.
   * @param {Array} syllableResults - [{text, score, correct, isSpace?}, ...]
   */
  App.prototype._renderSyllableHighlight = function (syllableResults) {
    var el = this.dom.charNameText;
    if (!el || !syllableResults) return;

    var sylSpans = el.querySelectorAll(".char-syllable");
    var sepSpans = el.querySelectorAll(".char-syllable-space");
    var sylIdx = 0;
    var sylClasses = [];

    for (var i = 0; i < syllableResults.length; i++) {
      var r = syllableResults[i];
      if (r.isSpace) continue;
      var span = sylSpans[sylIdx];
      if (!span) break;
      span.classList.remove("syl-correct", "syl-wrong");
      var cls = "";
      if (r.score !== null) {
        cls = r.correct ? "syl-correct" : "syl-wrong";
        span.classList.add(cls);
      }
      sylClasses.push(cls);
      sylIdx++;
    }

    // Color each separator to match the NEXT (right) syllable's result,
    // so "." in "KI.RI.MI.CHAN" follows the syllable it precedes.
    // Falls back to left syllable if no right neighbor.
    for (var k = 0; k < sepSpans.length; k++) {
      var sep = sepSpans[k];
      sep.classList.remove("syl-correct", "syl-wrong");
      var right = sylClasses[k + 1];
      var left = sylClasses[k];
      var match = right || left;
      if (match) {
        sep.classList.add(match);
      }
    }
  };

  /**
   * Combine text match + audio match results and decide success/fail.
   *
   * @param {Object} textMatch - Result from SpeechEngine.match()
   * @param {Object} audioResult - Result from VoiceEngine.compareAudio()
   * @param {Object} char - Current character data
   * @param {Array} transcripts - Raw speech transcripts
   */
  App.prototype._processMatchResults = function (
    textMatch,
    audioResult,
    char,
    transcripts,
  ) {
    // ══════════════════════════════════════════════════════
    // TWO-TIER SCORING LOGIC
    // ══════════════════════════════════════════════════════
    //
    // Tier 1: SpeechRecognition text matching (primary)
    //   - Exact/contains/phonetic = 100% / 85%
    //   - Fuzzy = proportional (capped at 65%)
    //   - Pass if textScore >= 50%
    //
    // Tier 2: Audio feature comparison (fallback)
    //   - Compares recorded audio vs reference .aac pronunciation
    //   - Only used when Tier 1 text match FAILS
    //   - Pass if audio similarity >= AUDIO_MATCH_THRESHOLD (70%)
    //
    // Success if EITHER tier passes.
    // ══════════════════════════════════════════════════════

    var textScore = 0;
    if (textMatch.matched) {
      if (textMatch.method === "exact" || textMatch.method === "contains") {
        textScore = 100;
      } else if (textMatch.method === "phonetic") {
        textScore = 85; // Phonetic match is high confidence
      } else if (textMatch.method === "fuzzy") {
        var normalizedInput = SpeechEngine.normalize(
          textMatch.transcript || "",
        );
        var normalizedAnswer = SpeechEngine.normalize(textMatch.answer || "");
        var maxLen = Math.max(
          normalizedInput.length,
          normalizedAnswer.length,
          1,
        );
        textScore = Math.round((1 - (textMatch.distance || 0) / maxLen) * 100);
        textScore = Math.max(0, Math.min(65, textScore));
      }
    }

    // Tier 2: Audio similarity (fallback when text fails)
    var audioSimilarity = audioResult.supported ? audioResult.similarity : 0;
    var audioPass =
      audioResult.supported && audioSimilarity >= AUDIO_MATCH_THRESHOLD;

    // Final: text match OR audio match
    var characterScore = textScore;
    if (!textMatch.matched && audioPass) {
      characterScore = Math.round(audioSimilarity); // Use audio similarity as score
    }
    var success = characterScore >= 40; // Lowered from 50 — game should be EASY

    // ── Developer Console Debug ──
    var recognizedText =
      transcripts.length > 0 ? transcripts[0].text : "(none)";
    var normalizedText =
      transcripts.length > 0
        ? SpeechEngine.normalize(transcripts[0].text)
        : "(none)";
    var expectedName = char.displayName;

    console.group(
      "%c📊 Voice Match Result",
      "color:#FF6BB1;font-weight:bold;font-size:13px",
    );
    console.log('  Recognized:  "' + recognizedText + '"');
    console.log('  Normalized:  "' + normalizedText + '"');
    console.log('  Expected:    "' + expectedName + '"');
    console.log(
      "  Text score:  %c" +
        textScore +
        "%%" +
        (textMatch.matched
          ? "  (" +
            textMatch.method +
            ' → "' +
            textMatch.answer +
            '"' +
            (textMatch.distance > 0 ? ", dist=" + textMatch.distance : "") +
            ")"
          : "  (no match)"),
      "color:" +
        (textScore >= 50 ? "#66BB6A" : "#EF5350") +
        ";font-weight:bold",
    );
    if (audioResult.supported) {
      console.log(
        "  Audio (debug): %c" +
          Math.round(audioSimilarity) +
          "%%  (not used for pass/fail)",
        "color:#999;font-weight:bold",
      );
    }
    console.log(
      "  %cFinal: " +
        Math.round(characterScore) +
        "%%  →  " +
        (success ? "✅ PASS" : "❌ FAIL"),
      "color:" +
        (success ? "#66BB6A" : "#EF5350") +
        ";font-weight:bold;font-size:13px",
    );
    console.groupEnd();
    console.log("");

    // Update debug panel
    this._updateDebugMatch(transcripts, textMatch, audioResult);

    // Score is console-only — no UI display
    if (this.dom.feedbackSub) {
      this.dom.feedbackSub.textContent = "";
    }

    // On success: record and advance. On fail: stuck animation + retry (no record).
    if (success) {
      this.game.recordSuccess(characterScore);
    } else {
      // Don't record fail — player retries until correct
      this._onWrongAnswer();
    }
  };

  /**
   * Handle voice engine errors
   */
  App.prototype._onVoiceError = function (error) {
    this._log("Voice error:", error);

    if (error === "not-allowed" || error === "service-not-allowed") {
      // Permission denied
      this.dom.feedbackText.textContent = "請允許使用麥克風";
      this.dom.speechFeedback.classList.remove("hidden", "success", "fail");

      // Go back to AT_ROPE to allow retry
      this.game.state = STATE.AT_ROPE;
      this._setMicState("enabled");
      this.dom.listeningIndicator.classList.add("hidden");
      if (this.dom.volumeBars) this.dom.volumeBars.classList.add("hidden");

      // Also show text input as fallback
      if (this.dom.textInputFallback) {
        this.dom.textInputFallback.classList.remove("hidden");
      }
    } else if (error === "start-failed") {
      // Could not acquire mic
      this.dom.feedbackText.textContent = "無法存取麥克風";
      this.dom.speechFeedback.classList.remove("hidden", "success", "fail");

      this.game.state = STATE.AT_ROPE;
      this._setMicState("enabled");
      this.dom.listeningIndicator.classList.add("hidden");
      if (this.dom.volumeBars) this.dom.volumeBars.classList.add("hidden");
      this._voiceHandled = false;
    }
  };

  /**
   * Handle voice engine end (when no result was captured)
   */
  App.prototype._onVoiceEnd = function () {
    // If REST is still pending, let it finish — don't reset UI now.
    if (this._restPending) return;
    // If no result was processed and we're still in listening/processing state,
    // allow retry
    if (
      !this._voiceHandled &&
      (this.game.state === STATE.LISTENING || this.game.state === STATE.WALKING)
    ) {
      if (this.game.state === STATE.LISTENING) {
        this.game.state = STATE.AT_ROPE;
      }
      this._setMicState("enabled");
      this.dom.listeningIndicator.classList.add("hidden");
      if (this.dom.volumeBars) this.dom.volumeBars.classList.add("hidden");
      this.dom.micLabel.textContent = "再試一次";

      this.dom.feedbackText.textContent = "未有偵測到聲音，請再試";
      this.dom.speechFeedback.classList.remove("hidden", "success", "fail");
    }
  };

  // ========================
  // Volume visualization
  // ========================

  /**
   * Update volume bar heights based on current microphone volume
   * @param {number} volume - 0 to 100
   */
  App.prototype._updateVolumeBars = function (volume) {
    // Drive amplitude ring on mic button (0 to 1 range)
    var amp = Math.min(1, volume / 80);
    this.dom.micBtn.style.setProperty("--mic-amp", amp.toFixed(2));

    if (!this.dom.volumeBars) return;

    var bars = this.dom.volumeBars.querySelectorAll(".vol-bar");
    if (bars.length === 0) return;

    var baseHeight = Math.max(15, Math.min(100, volume * 1.2));
    var now = Date.now();

    for (var i = 0; i < bars.length; i++) {
      // Add wave-like variation across bars
      var offset = Math.sin((i / bars.length) * Math.PI + now / 300) * 25;
      var height = Math.max(10, baseHeight + offset);
      bars[i].style.height = Math.min(100, height) + "%";
    }
  };

  /**
   * Drive the mic SVG gradient "water level" based on voice amplitude.
   * offset=1 means fully gold (silent), offset=0 means fully orange (loud).
   */
  App.prototype._updateMicGradient = function (volume) {
    var stop1 = document.getElementById("mic-grad-stop1");
    var stop2 = document.getElementById("mic-grad-stop2");
    if (!stop1 || !stop2) return;

    // Map volume (0-100) to offset (1.0 down to 0)
    // Higher volume → lower offset → more orange "fills up"
    var level = Math.min(1, volume / 40);
    var offset = 1 - level;
    var val = offset.toFixed(2);
    stop1.setAttribute("offset", val);
    stop2.setAttribute("offset", val);
  };

  // ========================
  // Text input fallback
  // ========================

  /**
   * Handle text input fallback for unsupported browsers
   */
  App.prototype._handleTextInput = function () {
    if (this.game.state !== STATE.AT_ROPE && this.game.state !== STATE.WALKING)
      return;

    var text = this.dom.textInput.value.trim();
    if (!text) return;

    this._voiceHandled = true;
    this.game.setProcessing();

    var char = this.game.getCurrentCharacter();
    if (!char) return;

    // Always log character info to console
    var progress = this.game.getProgress();
    console.log(
      "%c🎯 Character " +
        progress.current +
        "/" +
        progress.total +
        ": " +
        char.displayName +
        "  (text input)",
      "color:#FF6BB1;font-weight:bold;font-size:14px",
    );

    // Create fake transcript for matching
    var transcripts = [{ text: text, confidence: 1.0 }];
    var matchResult = SpeechEngine.match(transcripts, char.acceptedAnswers, 2);

    // Compute text score (same logic as _processMatchResults)
    var textScore = 0;
    if (matchResult.matched) {
      if (matchResult.method === "exact" || matchResult.method === "contains") {
        textScore = 100;
      } else if (matchResult.method === "fuzzy") {
        // Use max of both lengths for conservative scoring
        var normalizedInput = SpeechEngine.normalize(text);
        var normalizedAnswer = SpeechEngine.normalize(matchResult.answer || "");
        var maxLen = Math.max(
          normalizedInput.length,
          normalizedAnswer.length,
          1,
        );
        textScore = Math.round(
          (1 - (matchResult.distance || 0) / maxLen) * 100,
        );
        // Cap fuzzy matches at 65% — they are close but not exact
        textScore = Math.max(0, Math.min(65, textScore));
      }
    }

    var success = textScore >= 50;

    // Always log final outcome
    if (success) {
      console.log(
        "%c→ RESULT: ✅ SUCCESS%c  score=" +
          textScore +
          "%  method=" +
          matchResult.method +
          '  answer="' +
          matchResult.answer +
          '"' +
          (matchResult.distance > 0
            ? "  distance=" + matchResult.distance
            : ""),
        "background:#66BB6A;color:#fff;padding:3px 8px;border-radius:4px;font-weight:bold",
        "color:#333",
      );
    } else {
      console.log(
        "%c→ RESULT: ❌ FAIL%c  score=" +
          textScore +
          '%  No matching answer for "' +
          text +
          '"',
        "background:#EF5350;color:#fff;padding:3px 8px;border-radius:4px;font-weight:bold",
        "color:#333",
      );
    }
    console.log("");

    this._log("Text match result:", matchResult, "Score:", textScore);
    this._updateDebugMatch(transcripts, matchResult, null);

    // On success: record and advance. On fail: stuck animation + retry.
    if (success) {
      this.game.recordSuccess(textScore);
    } else {
      this._onWrongAnswer();
    }

    this.dom.textInput.value = "";
  };

  // ========================
  // Voice pronunciation playback
  // ========================

  App.prototype._playVoice = function () {
    var char = this.game.getCurrentCharacter();
    if (!char || !char.voicePath) return;

    this.voiceAudio.src = char.voicePath;
    this.voiceAudio.play().catch(function (e) {
      // Ignore autoplay errors
    });
  };

  // ========================
  // Result screens
  // ========================

  App.prototype._showTierResult = function () {
    var stats = this.game.getOverallStats();
    var tierData = stats.tierData || window.SanrioGame.TIERS.copper;

    this.dom.tierAward.classList.remove("hidden");
    this.dom.tierCharacterImg.src = tierData.characterImage;
    this.dom.tierTextImg.src = tierData.textImage;

    this._showScreen("tier-result");

    // Play tier badge reveal SFX (respects mute state)
    this.audio.playSFX("tier-reveal");
  };

  // ========================
  // UI updates
  // ========================

  App.prototype._updateProgressDots = function () {
    var progress = this.game.getProgress();
    var dots = this.dom.progressDots.querySelectorAll(".progress-dot");

    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.remove("active", "success", "fail", "current");

      if (i < progress.results.length) {
        dots[i].classList.add(progress.results[i].success ? "success" : "fail");
      } else if (i === this.game.currentCharIndex) {
        dots[i].classList.add("current");
      }
    }
  };

  App.prototype._updateScore = function () {
    this.dom.scoreDisplay.textContent = this.game.roundScore;
  };

  // ========================
  // Sharing (placeholder hooks)
  // ========================

  /**
   * Share using Web Share API (native share sheet).
   * Captures the tier result screen as an image and shares it.
   * Falls back to clipboard copy if Web Share API is unavailable.
   */
  App.prototype._handleShare = function () {
    var stats = this.game.getOverallStats();
    var shareText =
      "我在 Sanrio Say My Name 遊戲中取得了 " +
      stats.percentage +
      "% 的成績！一起來挑戰吧！";
    var shareUrl = window.location.origin + window.location.pathname;
    var self = this;

    console.log("[Share] navigator.share:", !!navigator.share);
    console.log("[Share] navigator.canShare:", !!navigator.canShare);

    if (!navigator.share) {
      console.log("[Share] Web Share API not available — clipboard fallback");
      self._shareClipboardFallback(shareText, shareUrl);
      return;
    }

    // Capture the tier result screen as a PNG via canvas
    self
      ._captureResultImage()
      .then(function (blob) {
        console.log(
          "[Share] Captured blob:",
          blob ? (blob.size / 1024).toFixed(0) + "KB" : "null",
        );

        if (!blob) {
          console.log("[Share] No blob — text-only share");
          return navigator.share({
            title: "Sanrio Say My Name",
            text: shareText,
            url: shareUrl,
          });
        }

        var file = new File([blob], "sanrio-result.png", { type: "image/png" });
        var canShareFiles =
          navigator.canShare && navigator.canShare({ files: [file] });
        console.log("[Share] canShare files:", canShareFiles);

        if (canShareFiles) {
          // Copy text to clipboard so user can paste as caption
          // (sharing files + text together causes some apps to ignore the image)
          try {
            navigator.clipboard.writeText(shareText + " " + shareUrl);
          } catch (e) {}

          return navigator.share({
            files: [file],
          });
        } else {
          console.log("[Share] File sharing not supported — text-only share");
          return navigator.share({
            title: "Sanrio Say My Name",
            text: shareText,
            url: shareUrl,
          });
        }
      })
      .then(function () {
        console.log("[Share] Success");
      })
      .catch(function (error) {
        if (error.name !== "AbortError") {
          console.warn("[Share] Failed:", error);
          self._shareClipboardFallback(shareText, shareUrl);
        }
      });
  };

  /**
   * Capture the tier result screen as a composite PNG.
   * Draws only the full-screen layers (.tier-layer) + character + tier text
   * at their correct positions on a 1080×1920 canvas.
   * @returns {Promise<Blob|null>}
   */
  App.prototype._captureResultImage = function () {
    var tierScreen = document.getElementById("screen-tier-result");
    if (!tierScreen) return Promise.resolve(null);

    var W = 1080,
      H = 1920;

    // Collect images to draw with their canvas positions
    // { src, x, y, w, h } — coordinates in the 1080×1920 canvas
    var drawList = [];

    // 1) Full-screen tier layers (background, titles) — all are 1080×1920, draw full
    var layers = tierScreen.querySelectorAll(".tier-layer");
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].src) {
        drawList.push({ src: layers[i].src, x: 0, y: 0, w: W, h: H });
      }
    }

    // 2) Tier character — centered at top:25%, width:95%, height:48% (object-fit:contain)
    var charImg = this.dom.tierCharacterImg;
    if (charImg && charImg.src && charImg.naturalWidth > 0) {
      // Maintain aspect ratio within the 95%×48% bounding box
      var boxW = W * 0.95,
        boxH = H * 0.48;
      var ratio = Math.min(
        boxW / charImg.naturalWidth,
        boxH / charImg.naturalHeight,
      );
      var cw = charImg.naturalWidth * ratio;
      var ch = charImg.naturalHeight * ratio;
      var cx = (W - cw) / 2; // centered horizontally
      var cy = H * 0.25 + (boxH - ch) / 2; // top:25% + centered in box
      drawList.push({ src: charImg.src, x: cx, y: cy, w: cw, h: ch });
    }

    // 3) Tier text image — positioned below character
    var textImg = this.dom.tierTextImg;
    if (textImg && textImg.src && textImg.naturalWidth > 0) {
      var tw = W * 0.65;
      var tRatio = tw / textImg.naturalWidth;
      var th = textImg.naturalHeight * tRatio;
      var tx = (W - tw) / 2;
      var ty = H * 0.73; // approximate bottom area
      drawList.push({ src: textImg.src, x: tx, y: ty, w: tw, h: th });
    }

    if (drawList.length === 0) {
      console.warn("[Share] No images found to capture");
      return Promise.resolve(null);
    }

    // Load all images with CORS
    var loadPromises = drawList.map(function (item) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function () {
          resolve({ img: img, x: item.x, y: item.y, w: item.w, h: item.h });
        };
        img.onerror = function () {
          console.warn("[Share] Failed to load:", item.src);
          resolve(null);
        };
        img.src =
          item.src +
          (item.src.indexOf("?") === -1 ? "?" : "&") +
          "cors=" +
          Date.now();
      });
    });

    return Promise.all(loadPromises).then(function (loaded) {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        var ctx = canvas.getContext("2d");

        // Draw each image at its designated position
        for (var j = 0; j < loaded.length; j++) {
          if (!loaded[j]) continue;
          var item = loaded[j];
          ctx.drawImage(item.img, item.x, item.y, item.w, item.h);
        }

        return new Promise(function (resolve) {
          canvas.toBlob(function (blob) {
            console.log(
              "[Share] Captured result image:",
              blob ? (blob.size / 1024).toFixed(0) + "KB" : "failed",
            );
            resolve(blob);
          }, "image/png");
        });
      } catch (e) {
        console.warn("[Share] Canvas composite failed:", e);
        return null;
      }
    });
  };

  /** Fallback: copy share text + URL to clipboard */
  App.prototype._shareClipboardFallback = function (text, url) {
    var fullText = text + " " + url;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(fullText)
        .then(function () {
          alert("已複製分享連結！");
        })
        .catch(function () {
          alert("此瀏覽器不支援分享功能");
        });
    } else {
      alert("此瀏覽器不支援分享功能");
    }
  };

  // ========================
  // Debug panel
  // ========================

  App.prototype._updateDebug = function () {
    if (!this.debug) return;

    var char = this.game.getCurrentCharacter();
    var progress = this.game.getProgress();
    var overall = this.game.getOverallStats();

    this.dom.debugState.textContent = this.game.state;
    this.dom.debugChar.textContent = char
      ? char.displayName + " (id:" + char.id + ")"
      : "-";
    this.dom.debugRound.textContent =
      progress.current + "/" + progress.total + " | Score: " + progress.score;
    this.dom.debugOverall.textContent =
      overall.percentage +
      "% | Tier: " +
      (overall.tier || "none") +
      " | Rounds: " +
      overall.rounds;
  };

  App.prototype._updateDebugMatch = function (
    transcripts,
    matchResult,
    audioResult,
  ) {
    if (!this.debug) return;

    var texts = transcripts.map(function (t) {
      return '"' + t.text + '" (' + Math.round(t.confidence * 100) + "%)";
    });
    this.dom.debugRecognized.textContent = texts.join(", ");

    var matchInfo = "";
    if (matchResult.matched) {
      matchInfo =
        "TEXT: YES (" + matchResult.method + ') → "' + matchResult.answer + '"';
    } else {
      matchInfo = "TEXT: NO";
    }
    if (audioResult && audioResult.supported) {
      matchInfo += " | AUDIO: " + Math.round(audioResult.similarity) + "%";
    }
    this.dom.debugMatch.textContent = matchInfo;
    this.dom.debugMatch.className =
      matchResult.matched ||
      (audioResult &&
        audioResult.supported &&
        audioResult.similarity >= AUDIO_MATCH_THRESHOLD)
        ? "debug-success"
        : "debug-fail";
  };

  // ========================
  // Helpers
  // ========================

  App.prototype._findCharById = function (id) {
    var chars = window.SanrioGame.CHARACTERS;
    for (var i = 0; i < chars.length; i++) {
      if (chars[i].id === id) return chars[i];
    }
    return null;
  };

  App.prototype._log = function () {
    if (!this.debug) return;
    var args = ["[App]"].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  };

  // ========================
  // Export & auto-start
  // ========================

  window.SanrioGame.App = App;

  // Auto-initialize
  new App();
})();
