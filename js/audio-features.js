/**
 * AudioFeatureExtractor - Client-side audio analysis
 * ====================================================
 * Extracts spectral + energy features from audio data
 * and computes similarity between feature vectors.
 *
 * Uses MFCC-like spectral analysis via Web Audio API
 * for more accurate voice matching than simple RMS.
 *
 * Usage:
 *   var extractor = new AudioFeatureExtractor();
 *   var features = await extractor.extractFromBlob(audioBlob);
 *   var refFeatures = await extractor.extractFromUrl('audio/ref.aac');
 *   var score = AudioFeatureExtractor.similarity(features, refFeatures);
 */

window.SanrioGame = window.SanrioGame || {};

(function () {
  'use strict';

  /**
   * @class AudioFeatureExtractor
   */
  function AudioFeatureExtractor() {
    /** @type {AudioContext|null} */
    this.audioContext = null;

    /** @type {number} Number of time segments to divide audio into */
    this.timeSegments = 32;

    /** @type {number} Number of frequency bands per segment */
    this.freqBands = 13;

    /** @type {number} FFT size for spectral analysis */
    this.fftSize = 1024;

    /** @type {Object} Cache for reference audio features (keyed by URL) */
    this._cache = {};
  }

  /**
   * Get or create AudioContext (lazy init)
   * @private
   * @returns {AudioContext|null}
   */
  AudioFeatureExtractor.prototype._getContext = function () {
    if (!this.audioContext) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.audioContext = new AC();
      }
    }
    return this.audioContext;
  };

  /**
   * Extract features from an audio Blob
   * @param {Blob} blob - Recorded audio blob
   * @returns {Promise<Object>} Feature object with energy + spectral data
   */
  AudioFeatureExtractor.prototype.extractFromBlob = function (blob) {
    var self = this;
    return blob.arrayBuffer().then(function (arrayBuffer) {
      return self._decodeAndAnalyze(arrayBuffer);
    }).catch(function (e) {
      console.warn('[AudioFeatures] extractFromBlob failed:', e.message);
      return self._emptyFeatures();
    });
  };

  /**
   * Extract features from an audio URL (with caching)
   * @param {string} url - URL of reference audio file
   * @returns {Promise<Object>} Feature object
   */
  AudioFeatureExtractor.prototype.extractFromUrl = function (url) {
    if (this._cache[url]) {
      return Promise.resolve(this._cache[url]);
    }

    var self = this;
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.arrayBuffer();
    }).then(function (arrayBuffer) {
      return self._decodeAndAnalyze(arrayBuffer);
    }).then(function (features) {
      self._cache[url] = features;
      return features;
    }).catch(function (e) {
      console.warn('[AudioFeatures] extractFromUrl failed:', url, e.message);
      return self._emptyFeatures();
    });
  };

  /**
   * Decode ArrayBuffer to AudioBuffer, then extract features
   * @private
   */
  AudioFeatureExtractor.prototype._decodeAndAnalyze = function (arrayBuffer) {
    var ctx = this._getContext();
    if (!ctx) return Promise.resolve(this._emptyFeatures());

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    var self = this;
    return new Promise(function (resolve) {
      ctx.decodeAudioData(
        arrayBuffer,
        function (audioBuffer) {
          resolve(self._analyze(audioBuffer));
        },
        function (err) {
          console.warn('[AudioFeatures] decodeAudioData failed:', err);
          resolve(self._emptyFeatures());
        }
      );
    });
  };

  /**
   * Analyze decoded AudioBuffer → feature object with:
   * - energy: 32-segment RMS energy (normalized)
   * - spectral: 32x13 mel-scale frequency band energies
   * - duration: audio length in seconds
   * - zeroCrossings: 32-segment zero-crossing rates
   *
   * @private
   * @param {AudioBuffer} audioBuffer
   * @returns {Object}
   */
  AudioFeatureExtractor.prototype._analyze = function (audioBuffer) {
    var channelData = audioBuffer.getChannelData(0);
    var sampleRate = audioBuffer.sampleRate;
    var totalSamples = channelData.length;

    // Trim silence from start and end (threshold: 0.02)
    var trimThreshold = 0.02;
    var trimStart = 0;
    var trimEnd = totalSamples - 1;
    for (var ts = 0; ts < totalSamples; ts++) {
      if (Math.abs(channelData[ts]) > trimThreshold) {
        trimStart = ts;
        break;
      }
    }
    for (var te = totalSamples - 1; te >= 0; te--) {
      if (Math.abs(channelData[te]) > trimThreshold) {
        trimEnd = te;
        break;
      }
    }
    var trimmedLength = trimEnd - trimStart + 1;
    if (trimmedLength < sampleRate * 0.1) {
      // Less than 100ms of audio after trim — use full
      trimStart = 0;
      trimmedLength = totalSamples;
    }

    var segmentLength = Math.floor(trimmedLength / this.timeSegments);
    if (segmentLength < 1) segmentLength = 1;

    var energy = [];
    var zeroCrossings = [];
    var spectral = [];

    // Mel-scale frequency band edges (13 bands, 0-8000Hz)
    var melBands = this._melBandEdges(this.freqBands, 0, Math.min(8000, sampleRate / 2), sampleRate);

    for (var i = 0; i < this.timeSegments; i++) {
      var start = trimStart + i * segmentLength;
      var end = Math.min(start + segmentLength, trimStart + trimmedLength);
      if (end <= start) end = start + 1;

      // RMS energy
      var sumSquares = 0;
      var crossings = 0;
      for (var j = start; j < end && j < totalSamples; j++) {
        sumSquares += channelData[j] * channelData[j];
        if (j > start && ((channelData[j] >= 0) !== (channelData[j - 1] >= 0))) {
          crossings++;
        }
      }
      var segLen = end - start;
      var rms = Math.sqrt(sumSquares / segLen);
      energy.push(Math.min(100, rms * 140));
      zeroCrossings.push(crossings / segLen * sampleRate); // rate per second

      // Spectral features: compute FFT-like band energies
      var bandEnergies = this._computeBandEnergies(channelData, start, end, melBands, sampleRate);
      spectral.push(bandEnergies);
    }

    // Normalize energy to peak=100
    var maxEnergy = 0;
    for (var ei = 0; ei < energy.length; ei++) {
      if (energy[ei] > maxEnergy) maxEnergy = energy[ei];
    }
    if (maxEnergy > 0) {
      for (var en = 0; en < energy.length; en++) {
        energy[en] = (energy[en] / maxEnergy) * 100;
      }
    }

    // Normalize spectral features per frame (CMN - Cepstral Mean Normalization)
    // This removes speaker/mic gain differences so we compare SHAPE not absolute levels
    for (var si = 0; si < spectral.length; si++) {
      var frame = spectral[si];
      var fMean = 0;
      for (var fb = 0; fb < frame.length; fb++) {
        fMean += frame[fb];
      }
      fMean /= frame.length || 1;
      var fStd = 0;
      for (var fb2 = 0; fb2 < frame.length; fb2++) {
        fStd += (frame[fb2] - fMean) * (frame[fb2] - fMean);
      }
      fStd = Math.sqrt(fStd / (frame.length || 1)) || 1;
      for (var fb3 = 0; fb3 < frame.length; fb3++) {
        frame[fb3] = (frame[fb3] - fMean) / fStd;
      }
    }

    return {
      energy: energy,
      spectral: spectral,
      zeroCrossings: zeroCrossings,
      duration: audioBuffer.duration
    };
  };

  /**
   * Compute mel-scale band edge frequencies
   * @private
   */
  AudioFeatureExtractor.prototype._melBandEdges = function (numBands, lowFreq, highFreq, sampleRate) {
    // Convert Hz to Mel scale
    function hzToMel(hz) { return 2595 * Math.log10(1 + hz / 700); }
    function melToHz(mel) { return 700 * (Math.pow(10, mel / 2595) - 1); }

    var lowMel = hzToMel(lowFreq);
    var highMel = hzToMel(highFreq);
    var edges = [];

    for (var i = 0; i <= numBands; i++) {
      var mel = lowMel + (highMel - lowMel) * i / numBands;
      edges.push(melToHz(mel));
    }
    return edges;
  };

  /**
   * Compute energy in each mel-frequency band for a segment
   * Uses a simplified DFT approach for band energy estimation
   * @private
   */
  AudioFeatureExtractor.prototype._computeBandEnergies = function (data, start, end, melBands, sampleRate) {
    var segLen = end - start;
    // Use a window of up to fftSize samples
    var fftLen = Math.min(segLen, this.fftSize);
    var halfFft = Math.floor(fftLen / 2);

    // Compute power spectrum using DFT for key frequencies
    var bandEnergies = [];
    for (var b = 0; b < melBands.length - 1; b++) {
      var lowHz = melBands[b];
      var highHz = melBands[b + 1];
      var centerHz = (lowHz + highHz) / 2;

      // Compute energy at this center frequency using Goertzel-like approach
      var k = Math.round(centerHz * fftLen / sampleRate);
      if (k < 1) k = 1;
      if (k >= halfFft) k = halfFft - 1;

      var realSum = 0;
      var imagSum = 0;
      var omega = 2 * Math.PI * k / fftLen;

      for (var n = 0; n < fftLen && (start + n) < data.length; n++) {
        var sample = data[start + n];
        // Apply Hann window
        var window = 0.5 * (1 - Math.cos(2 * Math.PI * n / (fftLen - 1)));
        sample *= window;
        realSum += sample * Math.cos(omega * n);
        imagSum -= sample * Math.sin(omega * n);
      }

      var power = (realSum * realSum + imagSum * imagSum) / fftLen;
      // Log scale (dB-like), with floor to avoid -Infinity
      var logPower = Math.log10(Math.max(power, 1e-10)) * 10;
      bandEnergies.push(logPower);
    }

    return bandEnergies;
  };

  /**
   * Return empty feature object (error fallback)
   * @private
   */
  AudioFeatureExtractor.prototype._emptyFeatures = function () {
    var energy = [];
    var spectral = [];
    var zeroCrossings = [];
    for (var i = 0; i < this.timeSegments; i++) {
      energy.push(0);
      zeroCrossings.push(0);
      var bands = [];
      for (var b = 0; b < this.freqBands; b++) {
        bands.push(0);
      }
      spectral.push(bands);
    }
    return { energy: energy, spectral: spectral, zeroCrossings: zeroCrossings, duration: 0 };
  };

  // ========================
  // Static methods
  // ========================

  /**
   * Compute similarity between two feature objects.
   *
   * Features are already normalized per-frame (CMN), so cosine similarity
   * on normalized features compares spectral SHAPE, not absolute levels.
   * This is speaker/mic independent.
   *
   * Components:
   * - Spectral cosine similarity (50%): frame-by-frame normalized mel-band comparison
   * - Energy contour cosine similarity (25%): syllable rhythm/pattern matching
   * - Duration match (25%): word length matching (strong discriminator)
   *
   * @param {Object} f1 - First feature object
   * @param {Object} f2 - Second feature object
   * @returns {number} Similarity percentage 0–100
   */
  AudioFeatureExtractor.similarity = function (f1, f2) {
    if (!f1 || !f2) return 0;

    // Handle legacy format (plain arrays)
    if (Array.isArray(f1)) {
      return AudioFeatureExtractor._vectorCosine(f1, f2);
    }

    // 1. Spectral similarity (frame-by-frame cosine on CMN-normalized features)
    var spectralSim = AudioFeatureExtractor._spectralCosine(f1.spectral, f2.spectral);

    // 2. Energy contour cosine similarity (rhythm/syllable pattern)
    var energySim = AudioFeatureExtractor._vectorCosine(f1.energy, f2.energy);

    // 3. Duration match — strong discriminator for word identity
    var durationSim = 100;
    if (f1.duration > 0 && f2.duration > 0) {
      var ratio = Math.min(f1.duration, f2.duration) / Math.max(f1.duration, f2.duration);
      // Quadratic penalty: 50% mismatch → 25% score
      durationSim = Math.pow(ratio, 2) * 100;
    }

    // Weighted combination
    var combined = spectralSim * 0.50 + energySim * 0.25 + durationSim * 0.25;

    // Scale: raw cosine on normalized features for same-word-different-speaker
    // typically gives 55-80%. For different words typically 30-55%.
    // We want: same word → 50-80%, different word → 15-40%
    // Apply a contrast stretch: (score - 30) / 50 * 100, clamped to 0-100
    var stretched = Math.max(0, Math.min(100, (combined - 30) / 50 * 100));

    return stretched;
  };

  /**
   * Cosine similarity for two 1D vectors (0-100)
   * @private
   */
  AudioFeatureExtractor._vectorCosine = function (v1, v2) {
    if (!v1 || !v2 || v1.length === 0 || v2.length === 0) return 0;

    var len = Math.min(v1.length, v2.length);
    var dot = 0, n1 = 0, n2 = 0;

    for (var i = 0; i < len; i++) {
      var a = v1[i] || 0;
      var b = v2[i] || 0;
      dot += a * b;
      n1 += a * a;
      n2 += b * b;
    }

    if (n1 === 0 || n2 === 0) return 0;
    var sim = dot / (Math.sqrt(n1) * Math.sqrt(n2));
    return Math.max(0, Math.min(100, sim * 100));
  };

  /**
   * Spectral cosine similarity: average cosine similarity of mel-band
   * energies across time frames. Features should be CMN-normalized.
   * @private
   */
  AudioFeatureExtractor._spectralCosine = function (s1, s2) {
    if (!s1 || !s2 || s1.length === 0 || s2.length === 0) return 0;

    var len = Math.min(s1.length, s2.length);
    var totalSim = 0;

    for (var i = 0; i < len; i++) {
      totalSim += AudioFeatureExtractor._vectorCosine(s1[i], s2[i]);
    }

    return totalSim / len;
  };

  /**
   * Check if AudioContext is supported
   * @returns {boolean}
   */
  AudioFeatureExtractor.isSupported = function () {
    return !!(window.AudioContext || window.webkitAudioContext);
  };

  // Export
  window.SanrioGame.AudioFeatureExtractor = AudioFeatureExtractor;
})();
