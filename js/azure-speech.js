/**
 * AzureSpeech — Pronunciation Assessment Module
 * =============================================
 * Uses Azure Cognitive Services Speech REST API to get per-phoneme
 * accuracy scores, then maps them to syllable groups for green/red
 * visual feedback on the character name display.
 *
 * Usage:
 *   AzureSpeech.init("SHORT_LIVED_AUTH_TOKEN", "eastasia");
 *   AzureSpeech.assess(audioBlob, char).then(function(result) {
 *     // result.syllableResults = [{text, score, correct, isSpace?}, ...]
 *     // result.overallScore   = 0–100
 *   });
 */
(function (global) {
  "use strict";

  var _token = null;
  var _region = "eastasia";

  /** Score threshold: >= this value = correct (green) */
  var SCORE_PASS = 50;

  /** Public: set Azure credentials */
  function init(token, region) {
    _token = token;
    if (region) _region = region;
    console.log("[AzureSpeech] Initialized. Region:", _region);
  }

  /**
   * Public: assess pronunciation of a recorded audio blob.
   */
  function assess(audioBlob, char) {
    if (!_token) {
      console.warn("[AzureSpeech] authorization token not set");
      return Promise.resolve(null);
    }
    if (!audioBlob) {
      console.warn("[AzureSpeech] No audio blob");
      return Promise.resolve(null);
    }
    if (!char || !char.azureRef || !char.nameSyllables) {
      console.warn(
        "[AzureSpeech] Missing azureRef/nameSyllables:",
        char && char.displayName,
      );
      return Promise.resolve(null);
    }

    var lang = char.azureLang || "en-US";
    var refs = [char.azureRef];
    if (char.azureRefAlt) refs.push(char.azureRefAlt);

    console.log(
      "[AzureSpeech] Assessing: refs=" +
        JSON.stringify(refs) +
        "  lang=" +
        lang +
        "  blob=" +
        (audioBlob.size / 1024).toFixed(1) +
        "KB",
    );

    // Run refs in PARALLEL for speed. If only one ref, single call.
    // Azure F0 tier may 429 the second call, but _fetchWithRetry429
    // handles that with backoff — still faster than sequential.
    var primaryP = _assessOneRef(audioBlob, refs[0], lang, char.nameSyllables);

    if (refs.length === 1) {
      return primaryP;
    }

    var altP = _assessOneRef(audioBlob, refs[1], lang, char.nameSyllables);

    return Promise.all([
      primaryP.catch(function () { return null; }),
      altP.catch(function () { return null; }),
    ]).then(function (results) {
      var primary = results[0];
      var alt = results[1];

      // If primary passed all syllables, use it directly
      if (primary && _allSyllablesPass(primary)) {
        console.log(
          "[AzureSpeech] Primary ref passed all syllables",
        );
        primary._refUsed = refs[0];
        return primary;
      }

      // Merge per-syllable scores (take max of each syllable across both)
      var best = _mergeBestPerSyllable(primary, alt);
      if (best) {
        best._refUsed = "merged(" + refs.join("+") + ")";
        console.log(
          "[AzureSpeech] Merged syllables:",
          best.syllableResults
            .filter(function (r) { return !r.isSpace; })
            .map(function (r) {
              return r.text + ":" + r.score + (r.correct ? "✅" : "❌");
            })
            .join(" "),
        );
      }
      return best;
    });
  }

  /**
   * Merge two assessment results by taking the MAX score of each syllable.
   * If only one side has data, returns that side. Recomputes `correct` flag
   * from the merged score. Overall score = max of the two.
   */
  function _mergeBestPerSyllable(a, b) {
    if (!a && !b) return null;
    if (!a || !a.syllableResults) return b;
    if (!b || !b.syllableResults) return a;
    var la = a.syllableResults.length;
    var lb = b.syllableResults.length;
    // If the syllable layouts differ, fall back to pick-best-overall
    if (la !== lb) {
      return (b.overallScore || 0) > (a.overallScore || 0) ? b : a;
    }
    var merged = [];
    for (var i = 0; i < la; i++) {
      var sa = a.syllableResults[i];
      var sb = b.syllableResults[i];
      if (sa.isSpace || sb.isSpace) {
        merged.push(sa);
        continue;
      }
      var scoreA = sa.score == null ? -1 : sa.score;
      var scoreB = sb.score == null ? -1 : sb.score;
      var bestScore = Math.max(scoreA, scoreB);
      merged.push({
        text: sa.text,
        score: bestScore < 0 ? null : bestScore,
        correct: bestScore >= SCORE_PASS,
      });
    }
    return {
      syllableResults: merged,
      overallScore: Math.max(a.overallScore || 0, b.overallScore || 0),
      wordOrderCorrect:
        (a.wordOrderCorrect !== false) && (b.wordOrderCorrect !== false),
    };
  }

  /** Check if every non-space syllable in a result is green */
  function _allSyllablesPass(result) {
    if (!result || !result.syllableResults) return false;
    for (var i = 0; i < result.syllableResults.length; i++) {
      var s = result.syllableResults[i];
      if (!s.isSpace && s.score !== null && !s.correct) return false;
    }
    return true;
  }

  /**
   * Assess audio against a single reference text.
   * @private
   */
  function _assessOneRef(audioBlob, refText, lang, syllables) {
    var blobType = audioBlob.type || "";
    var isWav = blobType.indexOf("wav") !== -1;

    if (isWav) {
      return _callApiWav(audioBlob, refText, lang)
        .then(function (data) {
          return _parseSyllableScores(data, syllables);
        })
        .catch(function (err) {
          console.warn(
            '[AzureSpeech] WAV failed for "' + refText + '":',
            err.message,
          );
          return null;
        });
    }

    return _callApiRaw(audioBlob, refText, lang)
      .then(function (data) {
        return _parseSyllableScores(data, syllables);
      })
      .catch(function (err) {
        return _toWav(audioBlob)
          .then(function (wav) {
            return _callApiWav(wav, refText, lang);
          })
          .then(function (data) {
            return _parseSyllableScores(data, syllables);
          });
      })
      .catch(function (err) {
        console.warn(
          '[AzureSpeech] All failed for "' + refText + '":',
          err.message,
        );
        return null;
      });
  }

  // ─────────────────────────────────────────────────────────
  //  API calls
  // ─────────────────────────────────────────────────────────

  /** Build the same-origin pronunciation proxy URL. */
  function _endpoint(lang) {
    return "/api/pronunciation.php?language=" +
      encodeURIComponent(lang || "en-US");
  }

  /**
   * Send raw audio blob (webm/ogg/mp4) directly to Azure.
   * Azure REST API accepts audio/ogg, audio/webm, audio/mp4.
   */
  function _callApiRaw(audioBlob, referenceText, lang) {
    // Determine Content-Type from blob
    var blobType = audioBlob.type || "";
    var contentType;
    if (blobType.indexOf("ogg") !== -1) {
      contentType = "audio/ogg; codecs=opus";
    } else if (blobType.indexOf("webm") !== -1) {
      contentType = "audio/webm; codecs=opus";
    } else if (
      blobType.indexOf("mp4") !== -1 ||
      blobType.indexOf("aac") !== -1
    ) {
      contentType = "audio/mp4";
    } else {
      // Unknown format — try as-is, might work
      contentType = blobType || "application/octet-stream";
    }

    console.log("[AzureSpeech] Sending raw blob. Content-Type:", contentType);

    return _fetchWithRetry429(_endpoint(lang), {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "X-Reference-Text": encodeURIComponent(referenceText),
      },
      body: audioBlob,
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.text().then(function (t) {
            throw new Error("Azure " + resp.status + ": " + t.slice(0, 200));
          });
        }
        return resp.json();
      })
      .then(function (data) {
        console.log(
          "[AzureSpeech] Raw response:",
          JSON.stringify(data).slice(0, 300),
        );
        if (data.RecognitionStatus && data.RecognitionStatus !== "Success") {
          throw new Error("RecognitionStatus: " + data.RecognitionStatus);
        }
        return data;
      });
  }

  /**
   * Send WAV PCM to Azure. Accepts ArrayBuffer or Blob.
   * Retries up to 2 times on 429 (Too Many Requests) with exponential backoff.
   */
  function _callApiWav(wavData, referenceText, lang) {
    var sizeKB = wavData.byteLength
      ? (wavData.byteLength / 1024).toFixed(1)
      : (wavData.size / 1024).toFixed(1);
    console.log("[AzureSpeech] Sending WAV. Size:", sizeKB + "KB");
    return _fetchWithRetry429(_endpoint(lang), {
      method: "POST",
      headers: {
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "X-Reference-Text": encodeURIComponent(referenceText),
      },
      body: wavData,
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.text().then(function (t) {
            throw new Error(
              "Azure WAV " + resp.status + ": " + t.slice(0, 200),
            );
          });
        }
        return resp.json();
      })
      .then(function (data) {
        console.log(
          "[AzureSpeech] WAV response:",
          JSON.stringify(data).slice(0, 300),
        );
        if (data.RecognitionStatus && data.RecognitionStatus !== "Success") {
          throw new Error("RecognitionStatus: " + data.RecognitionStatus);
        }
        return data;
      });
  }

  /**
   * Fetch with automatic retry on 429 (Too Many Requests).
   * Retries up to 2 times with backoff: 400ms, 800ms.
   */
  function _fetchWithRetry429(url, opts, attempt) {
    attempt = attempt || 0;
    return fetch(url, opts).then(function (resp) {
      if (resp.status === 429 && attempt < 2) {
        var delay = 400 * (attempt + 1);
        console.warn(
          "[AzureSpeech] 429 — retrying in " +
            delay +
            "ms (attempt " +
            (attempt + 1) +
            ")",
        );
        return new Promise(function (r) {
          setTimeout(function () {
            r(_fetchWithRetry429(url, opts, attempt + 1));
          }, delay);
        });
      }
      return resp;
    });
  }

  // ─────────────────────────────────────────────────────────
  //  WAV conversion fallback
  // ─────────────────────────────────────────────────────────

  function _toWav(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function (e) {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          reject(new Error("No AudioContext"));
          return;
        }

        var tmpCtx = new AudioCtx();
        tmpCtx
          .decodeAudioData(e.target.result)
          .then(function (audioBuffer) {
            console.log(
              "[AzureSpeech] Decoded audio: duration=" +
                audioBuffer.duration.toFixed(2) +
                "s  sampleRate=" +
                audioBuffer.sampleRate +
                "  channels=" +
                audioBuffer.numberOfChannels,
            );
            var TARGET_SR = 16000;
            var numSamples = Math.max(
              1,
              Math.ceil(audioBuffer.duration * TARGET_SR),
            );
            var offCtx = new OfflineAudioContext(1, numSamples, TARGET_SR);
            var src = offCtx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(offCtx.destination);
            src.start(0);
            return offCtx.startRendering();
          })
          .then(function (rendered) {
            tmpCtx.close();
            var pcm = rendered.getChannelData(0);
            // Check if audio has actual content (not silence)
            var maxAmp = 0;
            for (var i = 0; i < pcm.length; i += 100) {
              var abs = Math.abs(pcm[i]);
              if (abs > maxAmp) maxAmp = abs;
            }
            console.log(
              "[AzureSpeech] WAV PCM: samples=" +
                pcm.length +
                "  maxAmplitude=" +
                maxAmp.toFixed(4) +
                (maxAmp < 0.001 ? "  ⚠️ SILENCE" : "  ✅ HAS AUDIO"),
            );
            resolve(_encodeWav(pcm, TARGET_SR));
          })
          .catch(reject);
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  function _encodeWav(samples, sr) {
    var buf = new ArrayBuffer(44 + samples.length * 2);
    var view = new DataView(buf);
    function str(off, s) {
      for (var i = 0; i < s.length; i++)
        view.setUint8(off + i, s.charCodeAt(i));
    }
    str(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    str(8, "WAVE");
    str(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    str(36, "data");
    view.setUint32(40, samples.length * 2, true);
    var off = 44;
    for (var i = 0; i < samples.length; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
    return buf;
  }

  // ─────────────────────────────────────────────────────────
  //  Response parser → syllable results
  // ─────────────────────────────────────────────────────────

  /**
   * Helper: extract AccuracyScore from an Azure object.
   * Azure puts it in different locations depending on API version:
   *   - obj.AccuracyScore                          (flat)
   *   - obj.PronunciationAssessment.AccuracyScore   (nested)
   */
  function _getAccuracy(obj) {
    if (!obj) return 0;
    if (typeof obj.AccuracyScore === "number") return obj.AccuracyScore;
    var pa = obj.PronunciationAssessment;
    if (pa && typeof pa.AccuracyScore === "number") return pa.AccuracyScore;
    return 0;
  }

  function _parseSyllableScores(data, syllables) {
    if (!data || !data.NBest || !data.NBest[0]) {
      console.warn("[AzureSpeech] No NBest in response:", data);
      return { syllableResults: null, overallScore: 0 };
    }

    var best = data.NBest[0];

    // Overall score — check both flat and nested locations
    var overallScore = Math.round(_getAccuracy(best) || best.PronScore || 0);
    var azWords = best.Words || [];

    // Debug: log the RAW first word structure to see what Azure returns
    if (azWords.length > 0) {
      console.log(
        "[AzureSpeech] Raw Word[0] keys:",
        Object.keys(azWords[0]).join(", "),
      );
      console.log(
        "[AzureSpeech] Raw Word[0]:",
        JSON.stringify(azWords[0]).slice(0, 300),
      );
    }

    console.log(
      "[AzureSpeech] Words from Azure:",
      azWords.length,
      azWords
        .map(function (w) {
          return w.Word + ":" + Math.round(_getAccuracy(w));
        })
        .join(", "),
    );

    // Split nameSyllables into word groups on any separator token:
    //   "|", " ", "-", ".", "•"  → all act as word boundaries for scoring
    var SEP_TOKENS = { "|": 1, " ": 1, "-": 1, ".": 1, "•": 1 };
    var wordGroups = [];
    var cur = [];
    for (var i = 0; i < syllables.length; i++) {
      if (SEP_TOKENS[syllables[i]]) {
        if (cur.length) {
          wordGroups.push(cur);
          cur = [];
        }
      } else {
        cur.push(syllables[i]);
      }
    }
    if (cur.length) wordGroups.push(cur);

    var results = [];

    for (var w = 0; w < wordGroups.length; w++) {
      var group = wordGroups[w];
      var azWord = azWords[w] || null;
      var wordScore = _getAccuracy(azWord);
      var azSyllables = (azWord && azWord.Syllables) || [];
      var phonemes = (azWord && azWord.Phonemes) || [];

      if (group.length === 1) {
        // Single display syllable for the whole word — use word score
        results.push({
          text: group[0],
          score: Math.round(wordScore),
          correct: wordScore >= SCORE_PASS,
        });
      } else {
        // PREFER Azure's native Syllables array when counts match —
        // it's much more accurate than slicing phonemes manually.
        var useNative =
          azSyllables.length === group.length && azSyllables.length > 0;

        if (useNative) {
          for (var s2 = 0; s2 < group.length; s2++) {
            var nativeScore = _getAccuracy(azSyllables[s2]);
            results.push({
              text: group[s2],
              score: Math.round(nativeScore),
              correct: nativeScore >= SCORE_PASS,
            });
          }
        } else if (azSyllables.length > 0) {
          // Counts mismatch — distribute Azure's syllables proportionally
          // across our display groups (e.g. Azure says 2 syllables, we show 3).
          var nAz = azSyllables.length;
          var nDsp = group.length;
          for (var s3 = 0; s3 < nDsp; s3++) {
            var startAz = Math.floor((s3 * nAz) / nDsp);
            var endAz = Math.floor(((s3 + 1) * nAz) / nDsp);
            if (endAz <= startAz) endAz = startAz + 1;
            endAz = Math.min(endAz, nAz);
            var sumAz = 0,
              cntAz = 0;
            for (var k = startAz; k < endAz; k++) {
              sumAz += _getAccuracy(azSyllables[k]);
              cntAz++;
            }
            var sc = cntAz > 0 ? sumAz / cntAz : wordScore;
            results.push({
              text: group[s3],
              score: Math.round(sc),
              correct: sc >= SCORE_PASS,
            });
          }
        } else {
          // No Azure syllables — fall back to phoneme slicing
          var nPhon = phonemes.length;
          var nSyl = group.length;
          for (var s = 0; s < nSyl; s++) {
            var start = Math.floor((s * nPhon) / nSyl);
            var end = Math.floor(((s + 1) * nPhon) / nSyl);
            if (end <= start) end = start + 1;
            end = Math.min(end, nPhon);
            var slice = phonemes.slice(start, end);
            var score;
            if (slice.length > 0) {
              var sum = 0;
              for (var p = 0; p < slice.length; p++) {
                sum += _getAccuracy(slice[p]);
              }
              score = sum / slice.length;
            } else {
              score = wordScore;
            }
            results.push({
              text: group[s],
              score: Math.round(score),
              correct: score >= SCORE_PASS,
            });
          }
        }
      }

      if (w < wordGroups.length - 1) {
        results.push({ text: " ", score: null, correct: true, isSpace: true });
      }
    }

    // ── Word order validation ──
    // Azure PA may align words regardless of spoken order (e.g. "Kitty Hello"
    // can score well against reference "Hello Kitty"). Check that words were
    // spoken in the correct order via their Offset timestamps and ErrorType.
    var wordOrderCorrect = true;

    // Check 1: Offsets must be in ascending order
    var prevWordOffset = -1;
    for (var wo = 0; wo < azWords.length; wo++) {
      var wordOffset = azWords[wo].Offset;
      if (typeof wordOffset === "number" && wordOffset >= 0) {
        if (wordOffset < prevWordOffset) {
          wordOrderCorrect = false;
          console.log(
            '[AzureSpeech] Word order mismatch: "' +
              azWords[wo].Word +
              '" offset ' +
              wordOffset +
              " < prev " +
              prevWordOffset,
          );
          break;
        }
        prevWordOffset = wordOffset;
      }
    }

    // Check 2: Any word with ErrorType != "None" means wrong word at that position
    for (var we = 0; we < azWords.length; we++) {
      var wPA =
        azWords[we].PronunciationAssessment ||
        azWords[we].pronunciationAssessment;
      if (wPA) {
        var errType = wPA.ErrorType || wPA.errorType;
        if (errType && errType !== "None") {
          wordOrderCorrect = false;
          console.log(
            '[AzureSpeech] Word error: "' +
              azWords[we].Word +
              '" ErrorType=' +
              errType,
          );
          break;
        }
      }
    }

    console.log(
      "[AzureSpeech] Overall:" +
        overallScore +
        "  WordOrder:" +
        (wordOrderCorrect ? "✅" : "❌") +
        "  Syllables:",
      results
        .map(function (r) {
          return r.isSpace
            ? "[ ]"
            : r.text + "(" + r.score + (r.correct ? "✅" : "❌") + ")";
        })
        .join(" "),
    );

    return {
      syllableResults: results,
      overallScore: overallScore,
      wordOrderCorrect: wordOrderCorrect,
    };
  }

  // ─────────────────────────────────────────────────────────
  //  STREAMING MODE — uses Azure Speech SDK for live PA
  //  Provides real-time syllable highlighting via the
  //  `recognizing` and `recognized` events.
  // ─────────────────────────────────────────────────────────

  /**
   * Start a live pronunciation assessment streaming session.
   * Uses the Azure Speech SDK (must be loaded via script tag).
   *
   * @param {Object} char - character with azureRef + nameSyllables
   * @param {Object} cb   - callbacks: { onPartial, onFinal, onError, onStarted }
   *                        - onPartial(parsed): fires as Azure scores parts of audio
   *                        - onFinal(parsed):   fires when speech ends (silence/manual)
   *                        - onError(msg):      fires on any error
   *                        - onStarted():       fires once recognition is actually live
   * @returns {{stop: Function}}  controller — call stop() to end the session
   */
  function startStreaming(char, cb) {
    cb = cb || {};
    var noop = function () {};
    cb.onPartial = cb.onPartial || noop;
    cb.onFinal = cb.onFinal || noop;
    cb.onError = cb.onError || noop;
    cb.onStarted = cb.onStarted || noop;

    if (!window.SpeechSDK) {
      cb.onError("Azure Speech SDK not loaded");
      return { stop: noop };
    }
    if (!_token) {
      cb.onError("Azure authorization token not set");
      return { stop: noop };
    }
    if (!char || !char.azureRef || !char.nameSyllables) {
      cb.onError("Missing azureRef/nameSyllables");
      return { stop: noop };
    }

    var sdk = window.SpeechSDK;
    var recognizer;
    var stopped = false;
    var finalDelivered = false;
    var lastParsed = null;

    try {
      var speechConfig = sdk.SpeechConfig.fromAuthorizationToken(_token, _region);
      speechConfig.speechRecognitionLanguage = char.azureLang || "en-US";

      // Silence auto-stop is handled by VoiceEngine's volume monitor in JS,
      // NOT by the SDK. We set SDK silence to 5000ms (the max allowed by
      // Azure — higher values cause WebSocket 1007 validation errors).
      // Our JS detector at 1500ms fires first, so SDK rarely reaches this.
      speechConfig.setProperty(
        sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs,
        "5000",
      );
      // Initial silence timeout — give player 8s to start speaking
      speechConfig.setProperty(
        sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        "8000",
      );

      // Output detailed JSON so we can parse PA scores
      speechConfig.outputFormat = sdk.OutputFormat.Detailed;

      var audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      var paConfig = new sdk.PronunciationAssessmentConfig(
        char.azureRef,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true, // enableMiscue
      );
      paConfig.applyTo(recognizer);

      // ── Partial recognition: try to extract live PA scores ──
      recognizer.recognizing = function (s, e) {
        if (stopped) return;
        try {
          var json = e.result.properties.getProperty(
            sdk.PropertyId.SpeechServiceResponse_JsonResult,
          );
          if (!json) return;
          var data = JSON.parse(json);
          // Partial results sometimes contain PA, sometimes not.
          // Only update if we got actual scores.
          if (data.NBest && data.NBest[0] && data.NBest[0].Words) {
            var parsed = _parseSyllableScores(data, char.nameSyllables);
            if (parsed && parsed.syllableResults) {
              lastParsed = parsed;
              cb.onPartial(parsed);
            }
          }
        } catch (err) {
          // Partial parse failure — ignore, wait for next event
        }
      };

      // ── Final recognition: definitive result ──
      // NOTE: we intentionally do NOT early-return when stopped===true.
      // When the user taps mic to stop, we call recognizer.stop() which
      // still emits a final `recognized` event — that's the one that
      // carries full PA data and we MUST deliver it.
      recognizer.recognized = function (s, e) {
        if (finalDelivered) return;
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          try {
            var json = e.result.properties.getProperty(
              sdk.PropertyId.SpeechServiceResponse_JsonResult,
            );
            var data = JSON.parse(json);
            var parsed = _parseSyllableScores(data, char.nameSyllables);
            if (parsed && parsed.syllableResults) {
              lastParsed = parsed;
            }
            console.log(
              "[AzureSpeech] Stream final:",
              parsed && parsed.overallScore + "%",
              parsed &&
                parsed.syllableResults
                  .filter(function (r) {
                    return !r.isSpace;
                  })
                  .map(function (r) {
                    return r.text + ":" + r.score;
                  })
                  .join(" "),
            );
            finalDelivered = true;
            cb.onFinal(parsed);
          } catch (err) {
            console.warn("[AzureSpeech] Final parse failed:", err);
            finalDelivered = true;
            cb.onFinal(lastParsed);
          }
        } else {
          // No speech recognized — return last partial if any
          finalDelivered = true;
          cb.onFinal(lastParsed);
        }
      };

      recognizer.canceled = function (s, e) {
        console.warn(
          "[AzureSpeech] Stream canceled:",
          e.errorDetails || e.reason,
        );
        if (!stopped) {
          stopped = true;
          cb.onError(e.errorDetails || "canceled");
        }
      };

      recognizer.sessionStopped = function () {
        // Session ended (after stopContinuousRecognitionAsync completes)
      };

      recognizer.startContinuousRecognitionAsync(
        function () {
          console.log(
            '[AzureSpeech] Streaming started for: "' + char.azureRef + '"',
          );
          cb.onStarted();
        },
        function (err) {
          console.warn("[AzureSpeech] Stream start failed:", err);
          cb.onError("start failed: " + err);
        },
      );
    } catch (e) {
      console.warn("[AzureSpeech] Stream setup failed:", e);
      cb.onError(e.message || "setup failed");
      return { stop: noop };
    }

    return {
      stop: function () {
        if (stopped) return;
        stopped = true;
        // Safety: if SDK doesn't emit `recognized` within 1200ms after
        // stop, deliver whatever partial we have so the UI isn't stuck.
        setTimeout(function () {
          if (finalDelivered) return;
          finalDelivered = true;
          console.log(
            "[AzureSpeech] Stop safety fallback — delivering lastParsed",
          );
          cb.onFinal(lastParsed);
        }, 1200);
        try {
          recognizer.stopContinuousRecognitionAsync(
            function () {
              try {
                recognizer.close();
              } catch (e) {}
            },
            function () {
              try {
                recognizer.close();
              } catch (e) {}
            },
          );
        } catch (e) {
          try {
            recognizer.close();
          } catch (e2) {}
        }
      },
      getLastParsed: function () {
        return lastParsed;
      },
    };
  }

  // Export
  global.AzureSpeech = {
    init: init,
    assess: assess,
    startStreaming: startStreaming,
  };
})(window);
