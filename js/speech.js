/**
 * SpeechEngine - Web Speech API wrapper with fuzzy matching
 * =========================================================
 * Handles browser speech recognition, text normalization,
 * and character name matching with configurable tolerance.
 *
 * Matching phases:
 *  1. Exact match (normalized text)
 *  2. Contains match (substring with length ratio guard)
 *  3. Phonetic match (consonant skeleton comparison)
 *  4. Fuzzy match (Levenshtein distance)
 *
 * Usage:
 *   const engine = new SpeechEngine({ debug: true });
 *   engine.onResult = (result) => { ... };
 *   engine.start();
 */

window.SanrioGame = window.SanrioGame || {};

(function () {
  "use strict";

  class SpeechEngine {
    constructor(options) {
      options = options || {};

      /** @type {boolean} Whether Web Speech API is available */
      this.isSupported = !!(
        window.SpeechRecognition || window.webkitSpeechRecognition
      );

      /** @type {SpeechRecognition|null} */
      this.recognition = null;

      /** @type {boolean} */
      this.isListening = false;

      /** @type {boolean} Show debug logs in console */
      this.debug = options.debug || false;

      /** @type {string} Recognition language */
      this.lang = options.lang || "en-US";

      /** @type {number} Max alternatives to request from API */
      this.maxAlternatives = options.maxAlternatives || 10;

      /** @type {number} Levenshtein distance threshold for fuzzy match */
      this.fuzzyThreshold = options.fuzzyThreshold || 3;

      /** @type {number} Auto-stop timeout in ms (0 = no auto-stop) */
      this.timeout = options.timeout || 8000;

      /** @type {number|null} Timeout timer ID */
      this._timeoutId = null;

      // Callbacks
      this.onResult = options.onResult || function () {};
      this.onError = options.onError || function () {};
      this.onStart = options.onStart || function () {};
      this.onEnd = options.onEnd || function () {};

      if (this.isSupported) {
        this._init();
      }

      this._log("SpeechEngine initialized. Supported:", this.isSupported);
    }

    /**
     * Initialize the SpeechRecognition instance
     * @private
     */
    _init() {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SR();
      this.recognition.lang = this.lang;
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = this.maxAlternatives;

      var self = this;

      this.recognition.onresult = function (event) {
        self._clearTimeout();
        var transcripts = [];
        for (var i = 0; i < event.results.length; i++) {
          for (var j = 0; j < event.results[i].length; j++) {
            transcripts.push({
              text: event.results[i][j].transcript,
              confidence: event.results[i][j].confidence,
            });
          }
        }
        self._log("Raw transcripts:", transcripts);
        self.onResult(transcripts);
      };

      this.recognition.onerror = function (event) {
        self._clearTimeout();
        self._log("Speech error:", event.error);
        self.isListening = false;
        self.onError(event.error);
      };

      this.recognition.onend = function () {
        self._clearTimeout();
        self.isListening = false;
        self._log("Recognition ended");
        self.onEnd();
      };

      this.recognition.onspeechstart = function () {
        self._log("Speech detected");
      };

      this.recognition.onnomatch = function () {
        self._log("No match found");
      };
    }

    /**
     * Start listening for speech
     */
    start() {
      if (!this.isSupported) {
        this.onError("not-supported");
        return;
      }
      if (this.isListening) {
        this._log("Already listening, ignoring start()");
        return;
      }

      try {
        this.isListening = true;
        this.recognition.start();
        this.onStart();
        this._log("Listening started");

        // Auto-stop after timeout
        if (this.timeout > 0) {
          var self = this;
          this._timeoutId = setTimeout(function () {
            if (self.isListening) {
              self._log("Timeout reached, stopping");
              self.stop();
            }
          }, this.timeout);
        }
      } catch (e) {
        this.isListening = false;
        this._log("Start error:", e.message);
        this.onError("start-failed");
      }
    }

    /**
     * Stop listening
     */
    stop() {
      this._clearTimeout();
      if (!this.isListening) return;
      try {
        this.recognition.stop();
      } catch (e) {
        this._log("Stop error:", e.message);
      }
      this.isListening = false;
    }

    /**
     * Abort recognition immediately
     */
    abort() {
      this._clearTimeout();
      if (!this.recognition) return;
      try {
        this.recognition.abort();
      } catch (e) {
        // ignore
      }
      this.isListening = false;
    }

    /** @private */
    _clearTimeout() {
      if (this._timeoutId) {
        clearTimeout(this._timeoutId);
        this._timeoutId = null;
      }
    }

    /** @private */
    _log() {
      if (!this.debug) return;
      var args = ["[SpeechEngine]"].concat(
        Array.prototype.slice.call(arguments),
      );
      console.log.apply(console, args);
    }

    // =====================
    // Static matching utils
    // =====================

    /**
     * Normalize text for comparison:
     *  - lowercase
     *  - remove punctuation (keep hyphens within words)
     *  - collapse whitespace
     *  - trim
     *
     * @param {string} text
     * @returns {string}
     */
    static normalize(text) {
      if (!text) return "";
      return (
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "")
          // keep: letters, numbers, spaces, hyphens, hiragana, katakana, kanji
          .replace(/\s+/g, " ")
          .trim()
      );
    }

    /**
     * Convert text to a phonetic skeleton for comparison.
     * Reduces text to core consonant sounds, merging similar-sounding groups.
     * This helps match "chrome me" → "kuromi", "cinema roll" → "cinnamoroll" etc.
     *
     * @param {string} text - Normalized text
     * @returns {string} Phonetic skeleton
     */
    static toPhonetic(text) {
      if (!text) return "";
      var s = text.toLowerCase().replace(/[\s\-]/g, "");

      // Normalize common phonetic equivalences
      s = s
        // Double letters → single
        .replace(/(.)\1+/g, "$1")
        // ph → f
        .replace(/ph/g, "f")
        // ck, cc → k
        .replace(/ck/g, "k")
        .replace(/cc/g, "k")
        // ch → ch (keep, important for chan)
        // sh → sh (keep)
        // th → t
        .replace(/th/g, "t")
        // wh → w
        .replace(/wh/g, "w")
        // x → ks
        .replace(/x/g, "ks")
        // qu → kw
        .replace(/qu/g, "kw")
        // c before e/i → s, otherwise → k
        .replace(/c([eiy])/g, "s$1")
        .replace(/c/g, "k")
        // Silent e at end
        .replace(/e$/, "")
        // igh → ai
        .replace(/igh/g, "ai")
        // oo → u
        .replace(/oo/g, "u")
        // ee → i
        .replace(/ee/g, "i")
        // ou/ow → au
        .replace(/ou/g, "au")
        .replace(/ow/g, "au")
        // Similar vowels: reduce to core sounds
        // Keep vowels but simplify
        .replace(/ai|ay|ei|ey/g, "e")
        // Remove duplicate consonants again after transforms
        .replace(/(.)\1+/g, "$1");

      return s;
    }

    /**
     * Extract syllable-like chunks from text for partial matching.
     * Splits on vowel-consonant boundaries to approximate syllables.
     *
     * @param {string} text - Normalized text
     * @returns {string[]} Array of syllable-like chunks
     */
    static getSyllables(text) {
      if (!text) return [];
      var clean = text.toLowerCase().replace(/[\s\-]/g, "");
      // Simple syllable split: split before consonant clusters that follow a vowel
      var syllables = clean.match(
        /[^aeiou]*[aeiou]+(?:[^aeiou]*$|[^aeiou](?=[^aeiou]))?/gi,
      ) || [clean];
      return syllables;
    }

    /**
     * Extract key consonants from a phrase: first letter of each word.
     * Used to reject similar-sounding but wrong words.
     * @param {string} text - Normalized text
     * @returns {string[]} Array of first letters of each word
     */
    static getKeyConsonants(text) {
      if (!text) return [];
      var words = text.replace(/[\-]/g, " ").split(/\s+/);
      var keys = [];
      for (var i = 0; i < words.length; i++) {
        if (words[i].length > 0) {
          var ch = SpeechEngine._normalizeConsonant(words[i].charAt(0));
          keys.push(ch);
        }
      }
      return keys;
    }

    /**
     * Normalize consonant to its sound-equivalent group.
     * @param {string} ch - Single character
     * @returns {string} Normalized character
     */
    static _normalizeConsonant(ch) {
      var groups = {
        c: "k",
        q: "k",
        f: "f",
        ph: "f",
        j: "g",
        z: "s",
        x: "s",
      };
      return groups[ch] || ch;
    }

    /**
     * Check if transcript's key consonants match the answer's key consonants.
     * More lenient for Japanese names where speech recognition may
     * produce completely different word boundaries.
     *
     * @param {string} transcript - Normalized transcript
     * @param {string} answer - Normalized accepted answer
     * @returns {boolean} true if key consonants are compatible
     */
    static checkKeyConsonants(transcript, answer) {
      var tKeys = SpeechEngine.getKeyConsonants(transcript);
      var aKeys = SpeechEngine.getKeyConsonants(answer);

      if (tKeys.length === 0 || aKeys.length === 0) return true;

      // For single-word answers: require first letter to match
      if (aKeys.length === 1) {
        for (var i = 0; i < tKeys.length; i++) {
          if (tKeys[i] === aKeys[0]) return true;
        }
        return false;
      }

      // For multi-word answers:
      // Check if any transcript word starts with the answer's first letter
      var firstMatch = false;
      for (var f = 0; f < tKeys.length; f++) {
        if (tKeys[f] === aKeys[0]) {
          firstMatch = true;
          break;
        }
      }
      if (!firstMatch) return false;

      // Count how many answer initials appear in transcript initials
      var matches = 0;
      var checkLen = Math.min(tKeys.length, aKeys.length);
      for (var j = 0; j < aKeys.length; j++) {
        for (var k = 0; k < tKeys.length; k++) {
          if (tKeys[k] === aKeys[j]) {
            matches++;
            break;
          }
        }
      }

      // At least 40% of answer words' initials found in transcript
      return matches >= Math.ceil(aKeys.length * 0.4);
    }

    /**
     * Calculate Levenshtein edit distance between two strings
     * @param {string} a
     * @param {string} b
     * @returns {number}
     */
    static levenshtein(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;

      var matrix = [];
      var i, j;

      for (i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }

      for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
          var cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1, // deletion
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + cost, // substitution
          );
        }
      }

      return matrix[b.length][a.length];
    }

    /**
     * Match speech transcripts against a character's accepted answers.
     *
     * Matching priority:
     *  1. Exact match (normalized)
     *  2. Contains match (transcript contains answer or vice versa)
     *  3. Phonetic match (consonant skeleton similarity)
     *  4. Fuzzy match (Levenshtein distance within threshold)
     *
     * @param {Array<{text:string, confidence:number}>} transcripts - From speech API
     * @param {string[]} acceptedAnswers - Lowercase accepted names
     * @param {number} [fuzzyThreshold=3] - Max edit distance for fuzzy match
     * @returns {{matched:boolean, transcript?:string, answer?:string, method?:string, distance?:number, allTranscripts:string[]}}
     */
    static match(transcripts, acceptedAnswers, fuzzyThreshold) {
      fuzzyThreshold = fuzzyThreshold || 3;
      var allTexts = [];

      // ── Console: header ──
      // console.group('%c🎤 Speech Match', 'color:#FF6BB1;font-weight:bold;font-size:13px');

      // Collect all transcript texts & log them
      for (var t = 0; t < transcripts.length; t++) {
        allTexts.push(transcripts[t].text);
      }
      // console.log(
      //   '%cTranscripts received:',
      //   'color:#555;font-weight:bold'
      // );
      for (var tl = 0; tl < transcripts.length; tl++) {
        var conf = Math.round(transcripts[tl].confidence * 100);
        var barLen = Math.round(conf / 5);
        var bar = "\u2588".repeat(barLen) + "\u2591".repeat(20 - barLen);
        // console.log(
        //   "  #" +
        //     (tl + 1) +
        //     "  %c" +
        //     conf +
        //     "%%" +
        //     "%c  " +
        //     bar +
        //     '  %c"' +
        //     transcripts[tl].text +
        //     '"',
        //   "color:" +
        //     (conf >= 80 ? "#66BB6A" : conf >= 50 ? "#FFA726" : "#EF5350") +
        //     ";font-weight:bold",
        //   "color:#ccc",
        //   "color:#333",
        // );
      }
      // console.log(
      //   "%cAccepted answers:%c " +
      //     acceptedAnswers.slice(0, 6).join(", ") +
      //     (acceptedAnswers.length > 6
      //       ? " ... (" + acceptedAnswers.length + " total)"
      //       : ""),
      //   "color:#555;font-weight:bold",
      //   "color:#888",
      // );

      // // ── Phase 1: Exact match ──
      // console.log(
      //   "%c── Phase 1: Exact Match ──",
      //   "color:#2196F3;font-weight:bold",
      // );
      for (var i = 0; i < transcripts.length; i++) {
        var normalized = SpeechEngine.normalize(transcripts[i].text);
        if (!normalized) continue;

        var noSpaces = normalized.replace(/[\s\-]/g, "");

        for (var j = 0; j < acceptedAnswers.length; j++) {
          var answer = SpeechEngine.normalize(acceptedAnswers[j]);
          var answerNoSpaces = answer.replace(/[\s\-]/g, "");

          if (normalized === answer || noSpaces === answerNoSpaces) {
            console.log(
              '  %c✅ EXACT MATCH%c 100% "' +
                normalized +
                '" === "' +
                answer +
                '"',
              "background:#66BB6A;color:#fff;padding:2px 6px;border-radius:3px",
              "color:#333",
            );
            console.groupEnd();
            return {
              matched: true,
              transcript: transcripts[i].text,
              answer: acceptedAnswers[j],
              method: "exact",
              distance: 0,
              allTranscripts: allTexts,
            };
          }
        }
      }
      console.log("  No exact match found");

      // ── Phase 2: Contains match (relaxed for long names) ──
      console.log(
        "%c── Phase 2: Contains Match ──",
        "color:#FF9800;font-weight:bold",
      );
      for (var i2 = 0; i2 < transcripts.length; i2++) {
        var norm2 = SpeechEngine.normalize(transcripts[i2].text);
        var noSp2 = norm2.replace(/[\s\-]/g, "");
        if (!norm2) continue;

        for (var j2 = 0; j2 < acceptedAnswers.length; j2++) {
          var ans2 = SpeechEngine.normalize(acceptedAnswers[j2]);
          var ansNoSp2 = ans2.replace(/[\s\-]/g, "");

          var minLen = Math.min(noSp2.length, ansNoSp2.length);
          var maxLenContains = Math.max(noSp2.length, ansNoSp2.length);
          // Ratio guards: 65% for long names (>10 chars), 80% for medium (>6), 88% for short
          // Raised medium from 75% to 80% to block "melody" matching "mymelody" (6/8=75%)
          var requiredRatio =
            maxLenContains > 10 ? 0.65 : maxLenContains > 6 ? 0.8 : 0.88;
          var lenRatio = minLen / maxLenContains;
          if (minLen < 3 || lenRatio < requiredRatio) {
            continue;
          }

          // Word-count guard: "kero kero" (2 words) must not contain-match
          // "kero kero keroppi" (3 words). Exact short forms are caught in Phase 1.
          var isJapAns2 = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(
            ans2,
          );
          if (!isJapAns2) {
            var tWc2 = norm2.split(/\s+/).filter(function (w) {
              return w.length > 0;
            }).length;
            var aWc2 = ans2.split(/\s+/).filter(function (w) {
              return w.length > 0;
            }).length;
            if (aWc2 > 1 && tWc2 < Math.ceil(aWc2 * 0.7)) continue;
          }

          var isContained =
            norm2.indexOf(ans2) !== -1 ||
            ans2.indexOf(norm2) !== -1 ||
            noSp2.indexOf(ansNoSp2) !== -1 ||
            ansNoSp2.indexOf(noSp2) !== -1;

          if (isContained) {
            // Relaxed distance check for longer strings
            var lenDiff = Math.abs(noSp2.length - ansNoSp2.length);
            if (lenDiff > 0) {
              var containsDist = SpeechEngine.levenshtein(noSp2, ansNoSp2);
              // Allow 1 edit per 4 chars (was 6) for long names
              var maxAllowedDist = Math.max(2, Math.floor(maxLenContains / 4));
              if (containsDist > maxAllowedDist) {
                console.log(
                  '  %c○%c  "' +
                    noSp2 +
                    '" contains "' +
                    ansNoSp2 +
                    '" but dist=' +
                    containsDist +
                    " > max=" +
                    maxAllowedDist +
                    "  %c✗ REJECTED",
                  "color:#EF5350",
                  "color:#555",
                  "color:#EF5350;font-weight:bold",
                );
                continue;
              }
            }
            console.log(
              '  %c✅ CONTAINS MATCH%c  "' +
                norm2 +
                '" ↔ "' +
                ans2 +
                '"  (ratio: ' +
                Math.round(lenRatio * 100) +
                "%)",
              "background:#FF9800;color:#fff;padding:2px 6px;border-radius:3px",
              "color:#333",
            );
            console.groupEnd();
            return {
              matched: true,
              transcript: transcripts[i2].text,
              answer: acceptedAnswers[j2],
              method: "contains",
              distance: 0,
              allTranscripts: allTexts,
            };
          }
        }
      }
      console.log("  No contains match found");

      // ── Phase 3: Phonetic match (consonant skeleton comparison) ──
      console.log(
        "%c── Phase 3: Phonetic Match ──",
        "color:#00BCD4;font-weight:bold",
      );
      var bestPhoneticDist = Infinity;
      var bestPhoneticResult = null;

      for (var i3p = 0; i3p < transcripts.length; i3p++) {
        var norm3p = SpeechEngine.normalize(transcripts[i3p].text);
        if (!norm3p) continue;
        var phonT = SpeechEngine.toPhonetic(norm3p);

        for (var j3p = 0; j3p < acceptedAnswers.length; j3p++) {
          var ans3p = SpeechEngine.normalize(acceptedAnswers[j3p]);
          var phonA = SpeechEngine.toPhonetic(ans3p);

          // Length guard: transcript phonetic must be > 45% of answer phonetic length
          var phonMinLen = Math.min(phonT.length, phonA.length);
          var phonMaxLen = Math.max(phonT.length, phonA.length, 1);
          if (phonMinLen < phonMaxLen * 0.45) continue;

          // Word-count guard (English only): prevents partial-word matches
          // e.g. "kero kero" (2) must not phonetic-match "kero kero keroppi" (3)
          //      "melody" (1) must not phonetic-match "my melody" (2)
          var isJapAns3p = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(
            ans3p,
          );
          if (!isJapAns3p) {
            var tWordCount3p = norm3p.split(/\s+/).filter(function (w) {
              return w.length > 0;
            }).length;
            var aWordCount3p = ans3p.split(/\s+/).filter(function (w) {
              return w.length > 0;
            }).length;
            if (
              aWordCount3p > 1 &&
              tWordCount3p < Math.ceil(aWordCount3p * 0.7)
            )
              continue;
          }

          var phonDist = SpeechEngine.levenshtein(phonT, phonA);
          var phonRatio = 1 - phonDist / phonMaxLen;
          var phonThreshold = 0.65; // 65% similarity required

          var phonPass = phonRatio >= phonThreshold;

          if (phonPass || phonRatio >= 0.6) {
            console.log(
              "  %c" +
                (phonPass ? "●" : "○") +
                '%c  "' +
                norm3p +
                '" [' +
                phonT +
                '] vs "' +
                ans3p +
                '" [' +
                phonA +
                "]  similarity=" +
                Math.round(phonRatio * 100) +
                "%" +
                (phonPass ? "  %c✓ PASS" : "  %c✗ FAIL"),
              "color:" + (phonPass ? "#66BB6A" : "#EF5350"),
              "color:#555",
              "color:" +
                (phonPass ? "#66BB6A" : "#EF5350") +
                ";font-weight:bold",
            );
          }

          if (phonPass && phonDist < bestPhoneticDist) {
            bestPhoneticDist = phonDist;
            bestPhoneticResult = {
              matched: true,
              transcript: transcripts[i3p].text,
              answer: acceptedAnswers[j3p],
              method: "phonetic",
              distance: phonDist,
              allTranscripts: allTexts,
            };
          }
        }
      }

      if (bestPhoneticResult) {
        console.log(
          '  %c✅ PHONETIC MATCH%c  Best: "' +
            bestPhoneticResult.transcript +
            '" → "' +
            bestPhoneticResult.answer +
            '"  (phonetic distance: ' +
            bestPhoneticResult.distance +
            ")",
          "background:#00BCD4;color:#fff;padding:2px 6px;border-radius:3px",
          "color:#333",
        );
        console.groupEnd();
        return bestPhoneticResult;
      }
      console.log("  No phonetic match found");

      // ── Phase 4: Fuzzy match (Levenshtein) ──
      console.log(
        "%c── Phase 4: Fuzzy Match (Levenshtein) ──",
        "color:#9C27B0;font-weight:bold",
      );
      var bestDistance = Infinity;
      var bestResult = null;

      for (var i3 = 0; i3 < transcripts.length; i3++) {
        var norm3 = SpeechEngine.normalize(transcripts[i3].text);
        var noSp3 = norm3.replace(/[\s\-]/g, "");
        if (!norm3) continue;

        for (var j3 = 0; j3 < acceptedAnswers.length; j3++) {
          var ans3 = SpeechEngine.normalize(acceptedAnswers[j3]);
          var ansNoSp3 = ans3.replace(/[\s\-]/g, "");

          // Length guard: transcript must be > 45% of answer length
          // Lowered from 60% to allow shorter transcripts to match
          var fuzzyMinLen = Math.min(noSp3.length, ansNoSp3.length);
          var fuzzyMaxLen = Math.max(noSp3.length, ansNoSp3.length);
          if (fuzzyMinLen < fuzzyMaxLen * 0.45) continue;

          // Word-count guard (English only): prevents partial-word fuzzy matches
          var isJapAns3 = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(
            ans3,
          );
          if (!isJapAns3) {
            var tWordCount3 = norm3.split(/\s+/).filter(function (w) {
              return w.length > 0;
            }).length;
            var aWordCount3 = ans3.split(/\s+/).filter(function (w) {
              return w.length > 0;
            }).length;
            if (aWordCount3 > 1 && tWordCount3 < Math.ceil(aWordCount3 * 0.7))
              continue;
          }

          var d1 = SpeechEngine.levenshtein(norm3, ans3);
          var d2 = SpeechEngine.levenshtein(noSp3, ansNoSp3);
          var dist = Math.min(d1, d2);

          // More generous scaled threshold for longer names
          // Short names (<=6): max(threshold, len*0.3)
          // Long names (>6): max(threshold, len*0.4)
          var ansLen = ansNoSp3.length;
          var scaleFactor = ansLen > 10 ? 0.45 : ansLen > 6 ? 0.4 : 0.3;
          var scaledThreshold = Math.max(
            fuzzyThreshold,
            Math.floor(ansLen * scaleFactor),
          );

          var withinThreshold = dist <= scaledThreshold;

          // Consonant check removed — too strict for easy game mode.
          // Levenshtein distance is sufficient guard.
          var finalPass = withinThreshold;
          console.log(
            "  %c" +
              (finalPass ? "●" : "○") +
              '%c  "' +
              norm3 +
              '" vs "' +
              ans3 +
              '"  dist=' +
              dist +
              "  threshold=" +
              scaledThreshold +
              "" +
              (finalPass ? "  %c✓ PASS" : "  %c✗ FAIL"),
            "color:" + (finalPass ? "#66BB6A" : "#EF5350"),
            "color:#555",
            "color:" +
              (finalPass ? "#66BB6A" : "#EF5350") +
              ";font-weight:bold",
          );

          if (finalPass && dist < bestDistance) {
            bestDistance = dist;
            bestResult = {
              matched: true,
              transcript: transcripts[i3].text,
              answer: acceptedAnswers[j3],
              method: "fuzzy",
              distance: dist,
              allTranscripts: allTexts,
            };
          }
        }
      }

      if (bestResult) {
        console.log(
          '  %c✅ FUZZY MATCH%c  Best: "' +
            bestResult.transcript +
            '" → "' +
            bestResult.answer +
            '"  (distance: ' +
            bestResult.distance +
            ")",
          "background:#9C27B0;color:#fff;padding:2px 6px;border-radius:3px",
          "color:#333",
        );
        console.groupEnd();
        return bestResult;
      }

      // ── No match ──
      console.log(
        "  %c❌ NO MATCH%c  None of the transcripts matched any accepted answer",
        "background:#EF5350;color:#fff;padding:2px 6px;border-radius:3px",
        "color:#333",
      );
      console.groupEnd();

      return {
        matched: false,
        transcript: transcripts.length > 0 ? transcripts[0].text : "",
        allTranscripts: allTexts,
      };
    }
  }

  // Export
  window.SanrioGame.SpeechEngine = SpeechEngine;
})();
