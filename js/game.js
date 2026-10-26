/**
 * GameEngine - Core game logic and state management
 * ==================================================
 * Manages rounds, scoring, character selection, animation sequencing,
 * and tier calculation.
 */

window.SanrioGame = window.SanrioGame || {};

(function () {
  "use strict";

  var CHARACTERS = window.SanrioGame.CHARACTERS;
  var TIERS = window.SanrioGame.TIERS;

  /**
   * Game states
   */
  var STATE = {
    IDLE: "idle",
    WALKING: "walking",
    AT_ROPE: "at_rope",
    LISTENING: "listening",
    PROCESSING: "processing",
    SUCCESS: "success",
    FAIL: "fail",
    ROUND_COMPLETE: "round_complete",
  };

  /**
   * Animation configuration
   */
  var ANIM_CONFIG = {
    walkDuration: 5000, // ms - time for character to walk to rope
    // Walk start positions (percentage from bottom of track)
    walkStartBottom: 100, // % - character starts at very top of track
    // Left position (for curved path following road)
    walkStartLeft: -10, // % - start off-screen to the left
    // Scale range
    walkStartScale: 0.2,
  };

  /**
   * Per-character walk path configurations.
   * Key = character id (1-20).
   * Each entry is an object:
   *   path:      Array of waypoints { t, left, bottom, scale }
   *   ropeBottom: Bottom % where character meets the rope (adjust per character height/chest level)
   *   ropeScale:  Scale at rope meet point (used for stuck animation base scale)
   *   ropeLeft:   Left % at rope meet point
   *   starTop:    (optional) Stars top % relative to character (default: -40)
   *   starLeft:   (optional) Stars left % relative to character (default: 50)
   *   starWidth:  (optional) Stars width % relative to character (default: 120)
   *   starRotate: (optional) Stars rotation in degrees (default: 0)
   *
   * The last waypoint in path should match ropeBottom/ropeScale/ropeLeft.
   * Adjust these per character to control exactly where they stop at the rope.
   */

  /**
   * TEST MODE: Set character IDs to test specific characters in a round.
   */
  // var TEST_ROUND_IDS = [17, 18, 19, 20, 2, 4, 7, 12, 15, 17];
  var TEST_ROUND_IDS = null;
  var CHARACTER_WALK_PATHS = {
    // 1: Hello Kitty
    1: {
      ropeBottom: 23,
      ropeScale: 1.3,
      ropeLeft: 60,
      starTop: -48,
      starLeft: 59,
      starRotate: 10,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.52 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.57 },
        { t: 0.14, left: 20, bottom: 89, scale: 0.63 },
        { t: 0.22, left: 48, bottom: 82, scale: 0.69 },
        { t: 0.3, left: 56, bottom: 76, scale: 0.75 },
        { t: 0.38, left: 60, bottom: 69, scale: 0.82 },
        { t: 0.46, left: 62, bottom: 63, scale: 0.88 },
        { t: 0.54, left: 62, bottom: 56, scale: 0.94 },
        { t: 0.62, left: 62, bottom: 50, scale: 1.0 },
        { t: 0.7, left: 60, bottom: 43, scale: 1.07 },
        { t: 0.78, left: 60, bottom: 37, scale: 1.13 },
        { t: 0.86, left: 60, bottom: 30, scale: 1.19 },
        { t: 0.94, left: 60, bottom: 24, scale: 1.25 },
        { t: 1.0, left: 60, bottom: 23, scale: 1.3 },
      ],
    },
    // 2: Cinnamoroll
    2: {
      ropeBottom: 19,
      ropeScale: 1.56,
      ropeLeft: 50,
      starTop: -48,
      starRotate: -10,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.92 },
        { t: 0.06, left: -5, bottom: 95.1, scale: 0.96 },
        { t: 0.14, left: 20, bottom: 88.7, scale: 1.01 },
        { t: 0.22, left: 42, bottom: 82.2, scale: 1.06 },
        { t: 0.3, left: 49, bottom: 75.7, scale: 1.11 },
        { t: 0.38, left: 52, bottom: 69.2, scale: 1.16 },
        { t: 0.46, left: 53, bottom: 62.7, scale: 1.21 },
        { t: 0.54, left: 53, bottom: 56.3, scale: 1.27 },
        { t: 0.62, left: 53, bottom: 49.8, scale: 1.32 },
        { t: 0.7, left: 52, bottom: 43.3, scale: 1.37 },
        { t: 0.78, left: 51, bottom: 36.8, scale: 1.42 },
        { t: 0.86, left: 51, bottom: 30.3, scale: 1.47 },
        { t: 0.94, left: 50, bottom: 23.9, scale: 1.52 },
        { t: 1.0, left: 50, bottom: 19, scale: 1.56 },
      ],
    },
    // 3: Dear Daniel
    3: {
      ropeBottom: 22,
      ropeScale: 1.26,
      ropeLeft: 65,
      starTop: -43,
      starLeft: 62,
      starRotate: 11,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.52 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.56 },
        { t: 0.14, left: 20, bottom: 89, scale: 0.62 },
        { t: 0.22, left: 48, bottom: 83, scale: 0.68 },
        { t: 0.3, left: 56, bottom: 77, scale: 0.74 },
        { t: 0.38, left: 62, bottom: 70, scale: 0.8 },
        { t: 0.46, left: 65, bottom: 64, scale: 0.86 },
        { t: 0.54, left: 66, bottom: 58, scale: 0.92 },
        { t: 0.62, left: 66, bottom: 52, scale: 0.98 },
        { t: 0.7, left: 65, bottom: 45, scale: 1.04 },
        { t: 0.78, left: 65, bottom: 39, scale: 1.1 },
        { t: 0.86, left: 65, bottom: 33, scale: 1.16 },
        { t: 0.94, left: 65, bottom: 27, scale: 1.22 },
        { t: 1.0, left: 65, bottom: 22, scale: 1.26 },
      ],
    },
    // 4: Gudetama
    4: {
      ropeBottom: 24,
      ropeScale: 1.55,
      ropeLeft: 31,
      starTop: -35,
      starLeft: 55,
      starWidth: 90,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.82 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.86 },
        { t: 0.14, left: 20, bottom: 89, scale: 0.92 },
        { t: 0.22, left: 32, bottom: 83, scale: 0.98 },
        { t: 0.3, left: 36, bottom: 77, scale: 1.04 },
        { t: 0.38, left: 36, bottom: 71, scale: 1.1 },
        { t: 0.46, left: 36, bottom: 65, scale: 1.16 },
        { t: 0.54, left: 35, bottom: 59, scale: 1.21 },
        { t: 0.62, left: 35, bottom: 53, scale: 1.27 },
        { t: 0.7, left: 34, bottom: 47, scale: 1.33 },
        { t: 0.78, left: 32, bottom: 41, scale: 1.39 },
        { t: 0.86, left: 32, bottom: 35, scale: 1.45 },
        { t: 0.94, left: 31, bottom: 29, scale: 1.51 },
        { t: 1.0, left: 31, bottom: 24, scale: 1.55 },
      ],
    },
    // 5: Hangyodon
    5: {
      ropeBottom: 23,
      ropeScale: 1.26,
      ropeLeft: 56,
      starTop: -45,
      starLeft: 65,
      starRotate: 10,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.52 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.56 },
        { t: 0.14, left: 20, bottom: 89, scale: 0.62 },
        { t: 0.22, left: 50, bottom: 83, scale: 0.68 },
        { t: 0.3, left: 56, bottom: 77, scale: 0.74 },
        { t: 0.38, left: 60, bottom: 71, scale: 0.8 },
        { t: 0.46, left: 63, bottom: 65, scale: 0.86 },
        { t: 0.54, left: 64, bottom: 59, scale: 0.92 },
        { t: 0.62, left: 64, bottom: 53, scale: 0.98 },
        { t: 0.7, left: 62, bottom: 47, scale: 1.04 },
        { t: 0.78, left: 61, bottom: 41, scale: 1.1 },
        { t: 0.86, left: 59, bottom: 35, scale: 1.16 },
        { t: 0.94, left: 58, bottom: 29, scale: 1.22 },
        { t: 1.0, left: 56, bottom: 23, scale: 1.26 },
      ],
    },
    // 6: Hello Mimmy
    6: {
      ropeBottom: 24,
      ropeScale: 1.28,
      ropeLeft: 50,
      starTop: -48,
      starLeft: 42,
      starRotate: -7,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.6 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.64 },
        { t: 0.14, left: 20, bottom: 89, scale: 0.7 },
        { t: 0.22, left: 44, bottom: 83, scale: 0.75 },
        { t: 0.3, left: 51, bottom: 77, scale: 0.8 },
        { t: 0.38, left: 53, bottom: 71, scale: 0.86 },
        { t: 0.46, left: 56, bottom: 65, scale: 0.91 },
        { t: 0.54, left: 57, bottom: 59, scale: 0.97 },
        { t: 0.62, left: 57, bottom: 53, scale: 1.02 },
        { t: 0.7, left: 55, bottom: 47, scale: 1.08 },
        { t: 0.78, left: 54, bottom: 41, scale: 1.13 },
        { t: 0.86, left: 53, bottom: 35, scale: 1.18 },
        { t: 0.94, left: 52, bottom: 29, scale: 1.24 },
        { t: 1.0, left: 50, bottom: 24, scale: 1.28 },
      ],
    },
    // 7: Kerokerokeroppi
    7: {
      ropeBottom: 21,
      ropeScale: 1.37,
      ropeLeft: 52,
      starTop: -58,
      starLeft: 50,
      starRotate: -5,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.64 },
        { t: 0.06, left: -5, bottom: 95.3, scale: 0.68 },
        { t: 0.14, left: 20, bottom: 88.9, scale: 0.74 },
        { t: 0.22, left: 44, bottom: 82.6, scale: 0.8 },
        { t: 0.3, left: 52, bottom: 76.3, scale: 0.86 },
        { t: 0.38, left: 56, bottom: 70.0, scale: 0.92 },
        { t: 0.46, left: 58, bottom: 63.7, scale: 0.98 },
        { t: 0.54, left: 58, bottom: 57.3, scale: 1.03 },
        { t: 0.62, left: 58, bottom: 51.0, scale: 1.09 },
        { t: 0.7, left: 57, bottom: 44.7, scale: 1.15 },
        { t: 0.78, left: 55, bottom: 38.4, scale: 1.21 },
        { t: 0.86, left: 53, bottom: 32.1, scale: 1.27 },
        { t: 0.94, left: 53, bottom: 25.7, scale: 1.33 },
        { t: 1.0, left: 52, bottom: 21, scale: 1.37 },
      ],
    },
    // 8: Kirimichan
    8: {
      ropeBottom: 22,
      ropeScale: 1.6,
      ropeLeft: 61,
      starRotate: -10,
      starTop: -50,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.7 },
        { t: 0.06, left: -5, bottom: 95.3, scale: 0.75 },
        { t: 0.14, left: 20, bottom: 89.1, scale: 0.83 },
        { t: 0.22, left: 45, bottom: 82.8, scale: 0.9 },
        { t: 0.3, left: 55, bottom: 76.6, scale: 0.97 },
        { t: 0.38, left: 60, bottom: 70.4, scale: 1.04 },
        { t: 0.46, left: 63, bottom: 64.1, scale: 1.11 },
        { t: 0.54, left: 64, bottom: 57.9, scale: 1.19 },
        { t: 0.62, left: 64, bottom: 51.6, scale: 1.26 },
        { t: 0.7, left: 63, bottom: 45.4, scale: 1.33 },
        { t: 0.78, left: 62, bottom: 39.2, scale: 1.4 },
        { t: 0.86, left: 61, bottom: 32.9, scale: 1.47 },
        { t: 0.94, left: 61, bottom: 26.7, scale: 1.55 },
        { t: 1.0, left: 61, bottom: 22, scale: 1.6 },
      ],
    },
    // 9: Kuromi
    9: {
      ropeBottom: 24,
      ropeScale: 1.34,
      ropeLeft: 42,
      starRotate: -5,
      starTop: -25,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.54 },
        { t: 0.06, left: -5, bottom: 95.4, scale: 0.59 },
        { t: 0.14, left: 16, bottom: 89.4, scale: 0.65 },
        { t: 0.22, left: 38, bottom: 83.3, scale: 0.72 },
        { t: 0.3, left: 46, bottom: 77.2, scale: 0.78 },
        { t: 0.38, left: 48, bottom: 71.1, scale: 0.84 },
        { t: 0.46, left: 50, bottom: 65.0, scale: 0.91 },
        { t: 0.54, left: 50, bottom: 59.0, scale: 0.97 },
        { t: 0.62, left: 50, bottom: 52.9, scale: 1.04 },
        { t: 0.7, left: 48, bottom: 46.8, scale: 1.1 },
        { t: 0.78, left: 46, bottom: 40.7, scale: 1.16 },
        { t: 0.86, left: 43, bottom: 34.6, scale: 1.23 },
        { t: 0.94, left: 43, bottom: 28.6, scale: 1.29 },
        { t: 1.0, left: 42, bottom: 24, scale: 1.34 },
      ],
    },
    // 10: Little Twin Stars
    10: {
      ropeBottom: 24,
      ropeScale: 1.45,
      ropeLeft: 55,
      starTop: -80,
      starRotate: 5,
      starLeft: 55,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.62 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.67 },
        { t: 0.14, left: 28, bottom: 89, scale: 0.74 },
        { t: 0.22, left: 48, bottom: 83, scale: 0.8 },
        { t: 0.3, left: 56, bottom: 77, scale: 0.87 },
        { t: 0.38, left: 60, bottom: 71, scale: 0.94 },
        { t: 0.46, left: 62, bottom: 65, scale: 1.0 },
        { t: 0.54, left: 61, bottom: 59, scale: 1.07 },
        { t: 0.62, left: 61, bottom: 53, scale: 1.13 },
        { t: 0.7, left: 60, bottom: 47, scale: 1.2 },
        { t: 0.78, left: 58, bottom: 41, scale: 1.27 },
        { t: 0.86, left: 56, bottom: 35, scale: 1.33 },
        { t: 0.94, left: 56, bottom: 29, scale: 1.4 },
        { t: 1.0, left: 55, bottom: 24, scale: 1.45 },
      ],
    },
    // 11: Marroncream
    11: {
      ropeBottom: 19,
      ropeScale: 1.06,
      ropeLeft: 55,
      starLeft: 42,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.32 },
        { t: 0.06, left: -5, bottom: 95.1, scale: 0.36 },
        { t: 0.14, left: 15, bottom: 88.7, scale: 0.42 },
        { t: 0.22, left: 35, bottom: 82.2, scale: 0.48 },
        { t: 0.3, left: 46, bottom: 75.7, scale: 0.54 },
        { t: 0.38, left: 50, bottom: 69.2, scale: 0.6 },
        { t: 0.46, left: 53, bottom: 62.7, scale: 0.66 },
        { t: 0.54, left: 54, bottom: 56.3, scale: 0.72 },
        { t: 0.62, left: 54, bottom: 49.8, scale: 0.78 },
        { t: 0.7, left: 53, bottom: 43.3, scale: 0.84 },
        { t: 0.78, left: 53, bottom: 36.8, scale: 0.9 },
        { t: 0.86, left: 53, bottom: 30.3, scale: 0.96 },
        { t: 0.94, left: 55, bottom: 23.9, scale: 1.02 },
        { t: 1.0, left: 55, bottom: 19, scale: 1.06 },
      ],
    },
    // 12: Minna no Tabo
    12: {
      ropeBottom: 19,
      ropeScale: 1,
      ropeLeft: 62,
      starTop: -22,
      starRotate: 10,
      starLeft: 63,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.6 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.66 },
        { t: 0.14, left: -10, bottom: 89, scale: 0.35 },
        { t: 0.22, left: 28, bottom: 82, scale: 0.4 },
        { t: 0.3, left: 44, bottom: 76, scale: 0.46 },
        { t: 0.38, left: 54, bottom: 69, scale: 0.52 },
        { t: 0.46, left: 60, bottom: 63, scale: 0.58 },
        { t: 0.54, left: 60, bottom: 56, scale: 0.64 },
        { t: 0.62, left: 60, bottom: 50, scale: 0.72 },
        { t: 0.7, left: 60, bottom: 43, scale: 0.8 },
        { t: 0.78, left: 62, bottom: 37, scale: 0.88 },
        { t: 0.86, left: 62, bottom: 30, scale: 0.96 },
        { t: 0.94, left: 62, bottom: 24, scale: 1 },
        { t: 1.0, left: 62, bottom: 19, scale: 1 },
      ],
    },
    // 13: My Melody
    13: {
      ropeBottom: 24,
      ropeScale: 1.37,
      ropeLeft: 59,
      starTop: -55,
      starRotate: 15,
      starLeft: 63,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.54 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.59 },
        { t: 0.14, left: 20, bottom: 89, scale: 0.66 },
        { t: 0.22, left: 44, bottom: 83, scale: 0.72 },
        { t: 0.3, left: 52, bottom: 77, scale: 0.79 },
        { t: 0.38, left: 56, bottom: 71, scale: 0.86 },
        { t: 0.46, left: 59, bottom: 65, scale: 0.92 },
        { t: 0.54, left: 60, bottom: 59, scale: 0.99 },
        { t: 0.62, left: 59, bottom: 53, scale: 1.05 },
        { t: 0.7, left: 59, bottom: 47, scale: 1.12 },
        { t: 0.78, left: 59, bottom: 41, scale: 1.19 },
        { t: 0.86, left: 59, bottom: 35, scale: 1.25 },
        { t: 0.94, left: 59, bottom: 29, scale: 1.32 },
        { t: 1.0, left: 59, bottom: 24, scale: 1.37 },
      ],
    },
    // 14: My Sweet Piano
    14: {
      ropeBottom: 17,
      ropeScale: 1.35,
      ropeLeft: 48,
      starTop: -40,
      starLeft: 50,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.52 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.57 },
        { t: 0.14, left: 15, bottom: 89, scale: 0.64 },
        { t: 0.22, left: 38, bottom: 82, scale: 0.7 },
        { t: 0.3, left: 44, bottom: 76, scale: 0.77 },
        { t: 0.38, left: 50, bottom: 69, scale: 0.84 },
        { t: 0.46, left: 53, bottom: 63, scale: 0.9 },
        { t: 0.54, left: 53, bottom: 56, scale: 0.97 },
        { t: 0.62, left: 53, bottom: 50, scale: 1.03 },
        { t: 0.7, left: 53, bottom: 42, scale: 1.1 },
        { t: 0.78, left: 53, bottom: 36, scale: 1.17 },
        { t: 0.86, left: 51, bottom: 29, scale: 1.23 },
        { t: 0.94, left: 50, bottom: 23, scale: 1.3 },
        { t: 1.0, left: 48, bottom: 17, scale: 1.35 },
      ],
    },
    // 15: Pochacco
    15: {
      ropeBottom: 24,
      ropeScale: 1.3,
      ropeLeft: 63,
      starRotate: 20,
      starTop: -25,
      starLeft: 68,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.52 },
        { t: 0.06, left: -30, bottom: 96, scale: 0.57 },
        { t: 0.14, left: 20, bottom: 90, scale: 0.63 },
        { t: 0.22, left: 46, bottom: 84, scale: 0.69 },
        { t: 0.3, left: 56, bottom: 78, scale: 0.75 },
        { t: 0.38, left: 62, bottom: 72, scale: 0.82 },
        { t: 0.46, left: 65, bottom: 66, scale: 0.88 },
        { t: 0.54, left: 66, bottom: 60, scale: 0.94 },
        { t: 0.62, left: 66, bottom: 54, scale: 1.0 },
        { t: 0.7, left: 65, bottom: 48, scale: 1.07 },
        { t: 0.78, left: 63, bottom: 42, scale: 1.13 },
        { t: 0.86, left: 63, bottom: 36, scale: 1.19 },
        { t: 0.94, left: 63, bottom: 30, scale: 1.25 },
        { t: 1.0, left: 63, bottom: 24, scale: 1.3 },
      ],
    },
    // 16: Pompompurin
    16: {
      ropeBottom: 24,
      ropeScale: 1.35,
      ropeLeft: 50,
      starRotate: -8,
      starLeft: 45,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.52 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.57 },
        { t: 0.14, left: 18, bottom: 89, scale: 0.64 },
        { t: 0.22, left: 44, bottom: 83, scale: 0.7 },
        { t: 0.3, left: 50, bottom: 77, scale: 0.77 },
        { t: 0.38, left: 52, bottom: 70, scale: 0.84 },
        { t: 0.46, left: 52, bottom: 64, scale: 0.9 },
        { t: 0.54, left: 52, bottom: 58, scale: 0.97 },
        { t: 0.62, left: 52, bottom: 52, scale: 1.03 },
        { t: 0.7, left: 53, bottom: 45, scale: 1.1 },
        { t: 0.78, left: 53, bottom: 39, scale: 1.17 },
        { t: 0.86, left: 51, bottom: 33, scale: 1.23 },
        { t: 0.94, left: 51, bottom: 27, scale: 1.3 },
        { t: 1.0, left: 50, bottom: 24, scale: 1.35 },
      ],
    },
    // 17: Bad-Badtz-Maru
    17: {
      ropeBottom: 24,
      ropeScale: 1.35,
      ropeLeft: 55,
      starLeft: 68,
      starTop: -45,
      starRotate: 15,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.52 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.57 },
        { t: 0.14, left: 20, bottom: 89, scale: 0.64 },
        { t: 0.22, left: 45, bottom: 83, scale: 0.7 },
        { t: 0.3, left: 53, bottom: 77, scale: 0.77 },
        { t: 0.38, left: 59, bottom: 70, scale: 0.84 },
        { t: 0.46, left: 62, bottom: 64, scale: 0.9 },
        { t: 0.54, left: 63, bottom: 58, scale: 0.97 },
        { t: 0.62, left: 63, bottom: 52, scale: 1.03 },
        { t: 0.7, left: 62, bottom: 45, scale: 1.1 },
        { t: 0.78, left: 60, bottom: 39, scale: 1.17 },
        { t: 0.86, left: 58, bottom: 33, scale: 1.23 },
        { t: 0.94, left: 57, bottom: 27, scale: 1.3 },
        { t: 1.0, left: 55, bottom: 24, scale: 1.35 },
      ],
    },
    // 18: Tuxedosam
    18: {
      ropeBottom: 22,
      ropeScale: 1.35,
      ropeLeft: 54,
      starLeft: 30,
      starTop: -40,
      starRotate: -20,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.52 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.57 },
        { t: 0.14, left: 18, bottom: 89, scale: 0.64 },
        { t: 0.22, left: 44, bottom: 83, scale: 0.7 },
        { t: 0.3, left: 55, bottom: 77, scale: 0.77 },
        { t: 0.38, left: 57, bottom: 70, scale: 0.84 },
        { t: 0.46, left: 57, bottom: 64, scale: 0.9 },
        { t: 0.54, left: 56, bottom: 58, scale: 0.97 },
        { t: 0.62, left: 55, bottom: 52, scale: 1.03 },
        { t: 0.7, left: 54, bottom: 45, scale: 1.1 },
        { t: 0.78, left: 54, bottom: 39, scale: 1.17 },
        { t: 0.86, left: 54, bottom: 33, scale: 1.23 },
        { t: 0.94, left: 54, bottom: 27, scale: 1.3 },
        { t: 1.0, left: 54, bottom: 22, scale: 1.35 },
      ],
    },
    // 19: Usahana
    19: {
      ropeBottom: 25,
      ropeScale: 1.56,
      ropeLeft: 66,
      starLeft: 66,
      starRotate: 10,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.82 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.86 },
        { t: 0.14, left: 32, bottom: 89, scale: 0.92 },
        { t: 0.22, left: 48, bottom: 83, scale: 0.98 },
        { t: 0.3, left: 58, bottom: 77, scale: 1.04 },
        { t: 0.38, left: 62, bottom: 70, scale: 1.1 },
        { t: 0.46, left: 65, bottom: 64, scale: 1.16 },
        { t: 0.54, left: 66, bottom: 58, scale: 1.22 },
        { t: 0.62, left: 66, bottom: 52, scale: 1.28 },
        { t: 0.7, left: 66, bottom: 45, scale: 1.34 },
        { t: 0.78, left: 66, bottom: 39, scale: 1.4 },
        { t: 0.86, left: 66, bottom: 33, scale: 1.46 },
        { t: 0.94, left: 66, bottom: 27, scale: 1.52 },
        { t: 1.0, left: 66, bottom: 25, scale: 1.56 },
      ],
    },
    // 20: Wish me mell
    20: {
      ropeBottom: 20,
      ropeScale: 1.1,
      ropeLeft: 63,
      starTop: -10,
      starRotate: 5,
      starLeft: 55,
      path: [
        { t: 0, left: -40, bottom: 100, scale: 0.52 },
        { t: 0.06, left: -5, bottom: 95, scale: 0.57 },
        { t: 0.14, left: 20, bottom: 89, scale: 0.64 },
        { t: 0.22, left: 45, bottom: 82, scale: 0.7 },
        { t: 0.3, left: 56, bottom: 76, scale: 0.77 },
        { t: 0.38, left: 62, bottom: 69, scale: 0.84 },
        { t: 0.46, left: 65, bottom: 63, scale: 0.9 },
        { t: 0.54, left: 66, bottom: 56, scale: 0.97 },
        { t: 0.62, left: 66, bottom: 50, scale: 1.03 },
        { t: 0.7, left: 65, bottom: 43, scale: 1.08 },
        { t: 0.78, left: 65, bottom: 37, scale: 1.1 },
        { t: 0.86, left: 63, bottom: 30, scale: 1.1 },
        { t: 0.94, left: 63, bottom: 24, scale: 1.1 },
        { t: 1.0, left: 63, bottom: 20, scale: 1.1 },
      ],
    },
  };

  /**
   * Catmull-Rom interpolation for a single value
   * @param {number} p0 - point before a
   * @param {number} p1 - point a
   * @param {number} p2 - point b
   * @param {number} p3 - point after b
   * @param {number} t  - 0..1 segment progress
   * @returns {number}
   */
  function catmullRom(p0, p1, p2, p3, t) {
    var t2 = t * t;
    var t3 = t2 * t;
    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    );
  }

  /**
   * Interpolate walk path at a given progress value using Catmull-Rom splines
   * for smooth curved movement that follows the road perspective.
   * @param {number} t - Progress (0 to 1)
   * @returns {{left:number, bottom:number, scale:number}}
   */
  function interpolateWalkPath(t, customPath) {
    var path = customPath;
    var n = path.length;

    // Clamp to path's actual t range
    var maxT = path[n - 1].t;
    if (t <= path[0].t)
      return {
        left: path[0].left,
        bottom: path[0].bottom,
        scale: path[0].scale,
      };
    if (t >= maxT) {
      var last = path[n - 1];
      return { left: last.left, bottom: last.bottom, scale: last.scale };
    }

    // Find surrounding segment
    var segIdx = 0;
    for (var i = 0; i < n - 1; i++) {
      if (t >= path[i].t && t <= path[i + 1].t) {
        segIdx = i;
        break;
      }
    }

    var a = path[segIdx];
    var b = path[segIdx + 1];
    var segT = (t - a.t) / (b.t - a.t);

    // Get 4 control points for Catmull-Rom (clamp at edges)
    var i0 = Math.max(0, segIdx - 1);
    var i1 = segIdx;
    var i2 = segIdx + 1;
    var i3 = Math.min(n - 1, segIdx + 2);

    return {
      left: catmullRom(
        path[i0].left,
        path[i1].left,
        path[i2].left,
        path[i3].left,
        segT,
      ),
      bottom: catmullRom(
        path[i0].bottom,
        path[i1].bottom,
        path[i2].bottom,
        path[i3].bottom,
        segT,
      ),
      scale: catmullRom(
        path[i0].scale,
        path[i1].scale,
        path[i2].scale,
        path[i3].scale,
        segT,
      ),
    };
  }

  /**
   * @class GameEngine
   */
  function GameEngine(options) {
    options = options || {};

    this.roundSize = options.roundSize || 5;
    this.debug = options.debug || false;

    // Round state
    this.currentRound = [];
    this.currentCharIndex = 0;
    this.roundScore = 0;
    this.roundResults = []; // per-character results for current round
    this.state = STATE.IDLE;

    // History across all rounds
    this.roundHistory = [];

    // Animation
    this._walkAnimId = null;

    // Callbacks (set by App)
    this.onStateChange = options.onStateChange || function () {};
    this.onWalkProgress = options.onWalkProgress || function () {};
    this.onWalkThroughComplete = null; // set by App when walk-through success
    this.onRoundComplete = options.onRoundComplete || function () {};

    this._log("GameEngine initialized");
  }

  // ========================
  // Round management
  // ========================

  /**
   * Start a new round: pick 5 random unique characters
   * @returns {Object[]} The selected characters for this round
   */
  GameEngine.prototype.startNewRound = function () {
    if (TEST_ROUND_IDS) {
      // TEST MODE: use specific characters by ID
      this.currentRound = TEST_ROUND_IDS.map(function (id) {
        return CHARACTERS.find(function (c) {
          return c.id === id;
        });
      }).filter(Boolean);
    } else {
      // Normal mode: Fisher-Yates shuffle
      var pool = CHARACTERS.slice();
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = pool[i];
        pool[i] = pool[j];
        pool[j] = temp;
      }
      this.currentRound = pool.slice(0, this.roundSize);
    }
    this.currentCharIndex = 0;
    this.roundScore = 0;
    this.roundResults = [];
    this.state = STATE.IDLE;

    this._log(
      "New round started. Characters:",
      this.currentRound.map(function (c) {
        return c.displayName;
      }),
    );

    return this.currentRound;
  };

  /**
   * Get the current character in the round
   * @returns {Object|null}
   */
  GameEngine.prototype.getCurrentCharacter = function () {
    if (this.currentCharIndex >= this.currentRound.length) return null;
    return this.currentRound[this.currentCharIndex];
  };

  /**
   * Get round progress info
   * @returns {{current:number, total:number, score:number}}
   */
  GameEngine.prototype.getProgress = function () {
    return {
      current: this.currentCharIndex + 1,
      total: this.roundSize,
      score: this.roundScore,
      results: this.roundResults.slice(),
    };
  };

  // ========================
  // Character lifecycle
  // ========================

  /**
   * Begin the walk animation for the current character.
   * Calls onWalkProgress(progress, bottom, scale) during animation.
   * Transitions to AT_ROPE state when done.
   */
  GameEngine.prototype.startWalk = function () {
    this._cancelWalk();
    this._setState(STATE.WALKING);

    var self = this;
    var duration = ANIM_CONFIG.walkDuration;
    // Pre-advance the animation so the character starts at the screen edge
    // instead of far off-screen (left: -40). Characters reach visible area
    // around t=0.03 (~150ms). By subtracting this from startTime, frame 0
    // shows the character already entering the screen.
    var preAdvanceMs = duration * 0.03; // ~125ms head start
    var startTime = performance.now() - preAdvanceMs;
    var charId = this.getCurrentCharacter()
      ? this.getCurrentCharacter().id
      : null;
    var charConfig = CHARACTER_WALK_PATHS[charId];
    var charPath = charConfig.path;

    // Store per-character rope config for app.js to read
    this._currentRopeBottom = charConfig.ropeBottom;
    this._currentRopeScale = charConfig.ropeScale;
    this._currentRopeLeft = charConfig.ropeLeft;

    // Walk-through: when activated, character keeps walking the SAME path
    // to the rope, then continues below with a simple exit at the same speed.
    this._walkThroughActivated = false;
    this._walkThroughExitDone = false;

    // Exit phase: after reaching rope (t=1.0), simple linear exit below screen
    var exitStartTime = 0;
    // Exit takes 3 seconds (same steady pace as walk — rope to off-screen is ~65 units,
    // walk covers ~105 units in 10s, so 65/105 * 10s ≈ 6.2s, but character is bigger
    // and closer so 3s feels natural)
    var exitDuration = 3000;

    function tick(now) {
      var elapsed = now - startTime;
      var rawProgress = Math.min(elapsed / duration, 1.0);

      var pos = interpolateWalkPath(rawProgress, charPath);
      self.onWalkProgress(rawProgress, pos.bottom, pos.scale, pos.left);

      if (rawProgress < 1) {
        self._walkAnimId = requestAnimationFrame(tick);
      } else {
        // Reached rope position
        self._walkAnimId = null;
        if (self._walkThroughActivated) {
          // Continue past rope — start exit phase
          exitStartTime = now;
          self._walkAnimId = requestAnimationFrame(exitTick);
        } else {
          self._setState(STATE.AT_ROPE);
        }
      }
    }

    // Exit phase: character continues from rope position downward at steady speed
    var ropePos = {
      bottom: self._currentRopeBottom,
      scale: self._currentRopeScale,
      left: self._currentRopeLeft,
    };
    function exitTick(now) {
      var elapsed = now - exitStartTime;
      var t = Math.min(elapsed / exitDuration, 1);

      // Linear from rope position to below screen
      var bottom = ropePos.bottom + (-60 - ropePos.bottom) * t;
      var left = ropePos.left + (52 - ropePos.left) * t;
      var scale = ropePos.scale + (1.3 - ropePos.scale) * t;

      self.onWalkProgress(1.0, bottom, scale, left);

      if (t < 1) {
        self._walkAnimId = requestAnimationFrame(exitTick);
      } else {
        self._walkAnimId = null;
        self._walkThroughExitDone = true;
        if (self.onWalkThroughComplete) {
          self.onWalkThroughComplete();
        }
      }
    }

    this._walkAnimId = requestAnimationFrame(tick);
  };

  /**
   * Activate walk-through mode: character continues walking normally
   * to the rope, then exits below screen. Called when voice matches during walk.
   */
  GameEngine.prototype.activateWalkThrough = function () {
    this._walkThroughActivated = true;
  };

  /**
   * Get the current character's rope meet config.
   * @returns {{ropeBottom:number, ropeScale:number, ropeLeft:number}}
   */
  GameEngine.prototype.getRopeConfig = function () {
    return {
      ropeBottom: this._currentRopeBottom,
      ropeScale: this._currentRopeScale,
      ropeLeft: this._currentRopeLeft,
    };
  };

  /**
   * Get per-character star config with defaults.
   * Add starTop/starLeft/starWidth to CHARACTER_WALK_PATHS entries to customize.
   */
  GameEngine.prototype.getStarConfig = function () {
    var char = this.getCurrentCharacter();
    var walkPath = char ? CHARACTER_WALK_PATHS[char.id] : null;
    return {
      starTop:
        walkPath && walkPath.starTop !== undefined ? walkPath.starTop : -40,
      starLeft:
        walkPath && walkPath.starLeft !== undefined ? walkPath.starLeft : 50,
      starWidth:
        walkPath && walkPath.starWidth !== undefined ? walkPath.starWidth : 120,
      starRotate:
        walkPath && walkPath.starRotate !== undefined ? walkPath.starRotate : 0,
    };
  };

  /**
   * Set state to LISTENING (mic is active)
   */
  GameEngine.prototype.setListening = function () {
    this._setState(STATE.LISTENING);
  };

  /**
   * Set state to PROCESSING (evaluating speech result)
   */
  GameEngine.prototype.setProcessing = function () {
    this._setState(STATE.PROCESSING);
  };

  /**
   * Record a success for the current character
   * @param {number} [matchScore=100] - Matching score 0-100%
   * @returns {{isRoundComplete:boolean, score:number, total:number, charIndex:number}}
   */
  GameEngine.prototype.recordSuccess = function (matchScore) {
    matchScore = typeof matchScore === "number" ? matchScore : 100;
    this.roundScore++;
    this.roundResults.push({
      charId: this.getCurrentCharacter().id,
      success: true,
      matchScore: matchScore,
    });
    this._setState(STATE.SUCCESS);

    this._log(
      "SUCCESS:",
      this.getCurrentCharacter().displayName,
      "Score:",
      this.roundScore,
      "Match:",
      matchScore + "%",
    );

    return this._advanceResult();
  };

  /**
   * Record a failure for the current character
   * @param {number} [matchScore=0] - Matching score 0-100%
   * @returns {{isRoundComplete:boolean, score:number, total:number, charIndex:number}}
   */
  GameEngine.prototype.recordFail = function (matchScore) {
    matchScore = typeof matchScore === "number" ? matchScore : 0;
    this.roundResults.push({
      charId: this.getCurrentCharacter().id,
      success: false,
      matchScore: matchScore,
    });
    this._setState(STATE.FAIL);

    this._log(
      "FAIL:",
      this.getCurrentCharacter().displayName,
      "Match:",
      matchScore + "%",
    );

    return this._advanceResult();
  };

  /**
   * Advance to the next character (called after success/fail animation completes)
   */
  GameEngine.prototype.advanceToNext = function () {
    this.currentCharIndex++;

    if (this.currentCharIndex >= this.roundSize) {
      // Round complete — percentage is average of all matchScore values
      var totalMatchScore = 0;
      for (var r = 0; r < this.roundResults.length; r++) {
        totalMatchScore += this.roundResults[r].matchScore || 0;
      }
      var avgPercentage = Math.round(
        totalMatchScore / this.roundResults.length,
      );

      var roundData = {
        score: this.roundScore,
        total: this.roundSize,
        percentage: avgPercentage,
        passed: avgPercentage >= 50,
        results: this.roundResults.slice(),
      };

      this.roundHistory.push(roundData);
      this._setState(STATE.ROUND_COMPLETE);
      this.onRoundComplete(roundData);

      this._log("Round complete:", roundData);
      console.log(
        "[DEBUG] Round percentage:",
        avgPercentage + "%",
        "| passed:",
        avgPercentage >= 50,
        "| roundResults:",
        JSON.stringify(
          this.roundResults.map(function (r) {
            return {
              char: r.characterId,
              matchScore: r.matchScore,
              success: r.success,
            };
          }),
        ),
      );
      return { isRoundComplete: true, roundData: roundData };
    }

    this._setState(STATE.IDLE);
    return { isRoundComplete: false, nextChar: this.getCurrentCharacter() };
  };

  // ========================
  // Scoring & Tiers
  // ========================

  /**
   * Get cumulative stats across all completed rounds
   * @returns {{percentage:number, tier:string|null, tierData:Object|null, totalScore:number, totalQuestions:number, rounds:number}}
   */
  GameEngine.prototype.getOverallStats = function () {
    if (this.roundHistory.length === 0) {
      return {
        percentage: 0,
        tier: null,
        tierData: null,
        totalScore: 0,
        totalQuestions: 0,
        rounds: 0,
      };
    }

    // Collect all individual matchScore values across all rounds
    var totalMatchScore = 0;
    var totalCharacters = 0;
    var totalScore = 0;
    var totalQuestions = 0;
    for (var i = 0; i < this.roundHistory.length; i++) {
      totalScore += this.roundHistory[i].score;
      totalQuestions += this.roundHistory[i].total;
      var results = this.roundHistory[i].results;
      for (var j = 0; j < results.length; j++) {
        totalMatchScore += results[j].matchScore || 0;
        totalCharacters++;
      }
    }

    // Percentage is average of all individual match scores
    var percentage =
      totalCharacters > 0 ? Math.round(totalMatchScore / totalCharacters) : 0;

    var tier = null;
    var tierData = null;

    // Check tiers from highest to lowest
    if (percentage >= TIERS.gold.minPercentage) {
      tier = "gold";
      tierData = TIERS.gold;
    } else if (percentage >= TIERS.silver.minPercentage) {
      tier = "silver";
      tierData = TIERS.silver;
    } else if (percentage >= TIERS.copper.minPercentage) {
      tier = "copper";
      tierData = TIERS.copper;
    }

    console.log(
      "[DEBUG] Overall stats — percentage:",
      percentage + "%",
      "| tier:",
      tier,
      "| thresholds: gold≥90, silver≥75, copper≥50",
      "| totalMatchScore:",
      totalMatchScore,
      "| totalCharacters:",
      totalCharacters,
      "| totalScore:",
      totalScore + "/" + totalQuestions,
    );

    return {
      percentage: percentage,
      tier: tier,
      tierData: tierData,
      totalScore: totalScore,
      totalQuestions: totalQuestions,
      rounds: this.roundHistory.length,
    };
  };

  /**
   * Reset all game history (for full restart)
   */
  GameEngine.prototype.resetAll = function () {
    this.roundHistory = [];
    this.currentRound = [];
    this.currentCharIndex = 0;
    this.roundScore = 0;
    this.roundResults = [];
    this.state = STATE.IDLE;
    this._cancelWalk();
    this._log("Game fully reset");
  };

  // ========================
  // Internal helpers
  // ========================

  /** @private */
  GameEngine.prototype._advanceResult = function () {
    return {
      isLastChar: this.currentCharIndex >= this.roundSize - 1,
      score: this.roundScore,
      total: this.roundSize,
      charIndex: this.currentCharIndex,
    };
  };

  /** @private */
  GameEngine.prototype._setState = function (newState) {
    var oldState = this.state;
    this.state = newState;
    this._log("State:", oldState, "->", newState);
    this.onStateChange(newState, oldState);
  };

  /** @private */
  GameEngine.prototype._cancelWalk = function () {
    if (this._walkAnimId) {
      cancelAnimationFrame(this._walkAnimId);
      this._walkAnimId = null;
    }
  };

  /** @private */
  GameEngine.prototype._log = function () {
    if (!this.debug) return;
    var args = ["[GameEngine]"].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  };

  // Export
  GameEngine.STATE = STATE;
  GameEngine.ANIM_CONFIG = ANIM_CONFIG;
  GameEngine.CHARACTER_WALK_PATHS = CHARACTER_WALK_PATHS;
  GameEngine.interpolateWalkPath = interpolateWalkPath;
  window.SanrioGame.GameEngine = GameEngine;
})();
