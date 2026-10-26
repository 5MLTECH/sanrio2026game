<?php

declare(strict_types=1);

require __DIR__ . '/api/bootstrap.php';
$appUrl = app_url();
?>
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta
      name="apple-mobile-web-app-status-bar-style"
      content="black-translucent"
    />
    <meta name="theme-color" content="#FFB6D9" />
    <meta name="format-detection" content="telephone=no" />
    <title>Say My Name | Sanrio Character Ranking 2026</title>
    <link
      rel="preload"
      href="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/font/dfn/DFNYuanXBold-B5.TTC"
      as="font"
      type="font/collection"
      crossorigin
    />
    <link rel="stylesheet" href="css/style.php?v=109" />
  </head>
  <body>
    <div id="app">
      <!-- Global mute/unmute button (top-right, all screens) -->
      <button class="mute-btn" id="mute-btn" aria-label="Mute/Unmute">
        <img
          class="mute-icon"
          id="mute-icon"
          src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/Volume.png"
          alt="Sound on"
        />
      </button>

      <!-- ============================================
         HOME SCREEN
         ============================================ -->
      <div id="screen-home" class="screen">
        <!-- Full-screen stacked layers (all 1080x1920 assets) -->
        <img
          src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_background_with_copyright.jpg"
          alt=""
          class="home-layer home-bg"
        />
        <img
          src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_top.png"
          alt=""
          class="home-layer"
          style="z-index: 1"
        />
        <img
          src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_title_top.png"
          alt="41st Sanrio Character Ranking 2026"
          class="home-layer"
          style="z-index: 2"
        />

        <!-- Character cluster (individual images positioned over the layers) -->
        <div class="home-characters" style="z-index: 3">
          <!-- First line  -->
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_character_1.png"
            alt=""
            class="home-char-img home-char-1"
          />
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_character_2.png"
            alt=""
            class="home-char-img home-char-2"
          />
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_character_3.png"
            alt=""
            class="home-char-img home-char-3"
          />
          <!-- Second line  -->
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_character_4.png"
            alt=""
            class="home-char-img home-char-4"
          />
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_character_5.png"
            alt=""
            class="home-char-img home-char-5"
          />
          <!-- Third line  -->
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_character_6.png"
            alt=""
            class="home-char-img home-char-6"
          />
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_character_7.png"
            alt=""
            class="home-char-img home-char-7"
          />
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_character_8.png"
            alt=""
            class="home-char-img home-char-8"
          />
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_deco_character_9.png"
            alt=""
            class="home-char-img home-char-9"
          />
        </div>

        <!-- Game title (full-screen layer) -->
        <img
          src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_title_bottom.png"
          alt="Say My Name"
          class="home-layer home-title-anim"
          style="z-index: 4"
        />

        <!-- Buttons (positioned at bottom) -->
        <div class="home-buttons" style="z-index: 5">
          <button class="home-btn home-btn-start" id="btn-start">
            <img
              src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_btn_start.png"
              alt="開始遊戲"
            />
          </button>
        </div>
      </div>

      <!-- ============================================
         INSTRUCTIONS POPUP
         ============================================ -->
      <div id="popup-instructions" class="popup">
        <div class="popup-card instructions-card">
          <div class="popup-title">遊戲玩法</div>
          <div class="instruction-mock-text">
            為Sanrio characters ranking 參選角色打打氣！​<br />遊戲開始前請先授權遊戲使用電話及電子設備的錄音裝置。<br />
            每回合Sanrio characters 會在跑道上出現，看到Sanrio character後，​
            按下遊戲星星錄音按鈕，大聲喊出Sanrio characters
            的官方名字，即可幫助角色順利衝線，如說錯角色的名字，請重新嘗試。<br />​
            我們一起為Sanrio characters 打氣吧！​
          </div>
          <!-- Game preview video -->
          <div class="instruction-preview">
            <video
              class="instr-prev-video"
              id="instr-prev-video"
              autoplay
              loop
              muted
              playsinline
              preload="auto"
              src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/intro-vd.mp4"
            ></video>
          </div>
          <!-- Start button -->
          <button class="popup-btn-img" id="btn-instructions-start">
            <img
              src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/home_btn_start_now.png"
              alt="立即開始"
            />
          </button>
        </div>
      </div>

      <!-- ============================================
         SPEECH UNSUPPORTED POPUP
         ============================================ -->
      <div id="popup-unsupported" class="popup">
        <div class="popup-card">
          <button class="popup-close" id="btn-unsupported-close">
            &times;
          </button>
          <div class="popup-title">瀏覽器提示</div>
          <p
            style="
              text-align: center;
              font-size: 15px;
              line-height: 1.6;
              margin-bottom: 16px;
              color: #555;
            "
          >
            你的瀏覽器不支援語音辨識功能。<br />
            建議使用 <strong>Chrome</strong> 或
            <strong>Safari</strong> 開啟此遊戲。<br /><br />
            你仍可使用<strong>文字輸入</strong>方式遊玩。
          </p>
          <button
            class="popup-btn-start"
            id="btn-unsupported-ok"
            onclick="this.closest('.popup').classList.remove('active')"
          >
            知道了
          </button>
        </div>
      </div>

      <!-- ============================================
         GAME SCREEN
         ============================================ -->
      <div id="screen-game" class="screen">
        <!-- 3-2-1 countdown overlay (shown before first character walks in) -->
        <div id="game-countdown" class="game-countdown hidden">
          <span id="game-countdown-num"></span>
        </div>

        <!-- Background layer: solid color base + floating animated image -->
        <div class="game-bg-layer" id="game-bg">
          <!-- Animated floating image overlay (flowers/hearts drift) -->
          <div class="game-bg-anim" id="game-bg-anim">
            <!-- Normal bg: visible by default -->
            <img
              src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/game_bg.jpg"
              alt=""
              class="game-bg-anim-img game-bg-anim-default"
              id="game-bg-default"
            />
            <!-- Win bg: visible on success -->
            <img
              src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/game_bg_win.jpg"
              alt=""
              class="game-bg-anim-img game-bg-anim-win"
              id="game-bg-win"
            />
          </div>
        </div>

        <!-- Game header: progress + score -->
        <div class="game-header">
          <div class="progress-dots" id="progress-dots">
            <div class="progress-dot">1</div>
            <div class="progress-dot">2</div>
            <div class="progress-dot">3</div>
            <div class="progress-dot">4</div>
            <div class="progress-dot">5</div>
          </div>
          <div class="score-badge">⭐ <span id="score-display">0</span></div>
        </div>

        <!-- Track area (fills entire screen) -->
        <div class="track-area" id="track-area">
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/game_bg_track.png"
            alt=""
            class="track-bg-img"
          />

          <!-- Win background overlay (golden glow on success) -->
          <div class="win-bg-overlay" id="win-bg-overlay"></div>

          <!-- Character (walker controls position/scale, rocker controls rotation) -->
          <div id="character-walker" class="hidden">
            <div id="character-rocker">
              <!-- Stars burst above character head on success (inside rocker so they rock together) -->
              <img
                src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/game_win_effect.png"
                alt=""
                id="win-stars"
                class="win-stars"
              />
              <img id="game-character-img" src="" alt="" />
            </div>
          </div>

          <!-- Finish line / Rope -->
          <div class="finish-line" id="finish-line">
            <img
              src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/game_finishline_left.png"
              alt=""
              id="rope-left"
              class="rope-piece"
            />
            <img
              src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/game_finishline_right.png"
              alt=""
              id="rope-right"
              class="rope-piece"
            />
          </div>

          <!-- Win effect (stars) -->
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/game_win_effect.png"
            alt=""
            id="win-effect"
            class="win-effect"
          />

          <!-- Star mic button — floating, near rope area on right -->
          <button class="star-mic-btn disabled" id="mic-btn">
            <div id="mic-img"></div>
          </button>
          <script>
            (function () {
              fetch(
                "<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/mic-star.svg",
              )
                .then(function (r) {
                  return r.text();
                })
                .then(function (svg) {
                  document.getElementById("mic-img").innerHTML = svg;
                });
            })();
          </script>

          <!-- Bottom overlay (inside track area) -->
          <div class="game-bottom-overlay">
            <!-- Character name (no mic button in this row) -->
            <div class="character-name-row hidden" id="character-name-display">
              <button class="voice-btn" id="voice-btn" title="聽發音">
                🔊
              </button>
              <div class="char-name-text" id="char-name-text"></div>
            </div>

            <!-- Mic label -->
            <div class="mic-label" id="mic-label"></div>

            <!-- Listening indicator -->
            <div class="listening-indicator hidden" id="listening-indicator">
              <span class="listening-dot"></span>
              <span class="listening-dot"></span>
              <span class="listening-dot"></span>
            </div>

            <!-- Volume bars (driven by AnalyserNode real-time data) -->
            <div class="volume-bars hidden" id="volume-bars">
              <span class="vol-bar"></span>
              <span class="vol-bar"></span>
              <span class="vol-bar"></span>
              <span class="vol-bar"></span>
              <span class="vol-bar"></span>
            </div>

            <!-- Speech feedback -->
            <div class="speech-feedback hidden" id="speech-feedback">
              <span id="feedback-text"></span>
              <span class="feedback-sub" id="feedback-sub"></span>
            </div>

            <!-- Continue button (shown after fail) -->
            <button class="btn-continue hidden" id="btn-continue">
              繼續 →
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================
         ROUND RESULT SCREEN
         ============================================ -->
      <!-- ============================================
         TIER RESULT SCREEN
         ============================================ -->
      <div id="screen-tier-result" class="screen">
        <!-- Full-screen stacked layers (all 1080x1920 assets) -->
        <img
          src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_bg.jpg"
          alt=""
          class="tier-layer tier-bg"
        />
        <img
          src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_top_title.png"
          alt="多謝你"
          class="tier-layer tier-top-title"
        />
        <img
          src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_middle_title.png"
          alt=""
          class="tier-layer tier-middle-title"
        />
        <img
          src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_bottom_title.png"
          alt=""
          class="tier-layer tier-bottom-title"
        />

        <!-- Interactive content (positioned above layers) -->
        <div class="tier-content">
          <!-- Award toggle (must be before imgs for CSS ~ sibling selector) -->
          <div class="tier-award" id="tier-award"></div>

          <!-- Tier character (absolutely positioned, big) -->
          <img
            src=""
            alt=""
            class="tier-character-img"
            id="tier-character-img"
          />

          <!-- Bottom group: tier text + share + CTA buttons -->
          <div class="tier-bottom-group">
            <img src="" alt="" class="tier-text-img" id="tier-text-img" />

            <div class="share-buttons" id="share-buttons">
              <button class="share-btn" id="btn-share-whatsapp">
                <img
                  src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_btn_whatsapp.png"
                  alt="WhatsApp"
                />
              </button>
              <button class="share-btn" id="btn-share-facebook">
                <img
                  src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_btn_facebook.png"
                  alt="Facebook"
                />
              </button>
              <button class="share-btn" id="btn-share-threads">
                <img
                  src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_btn_threads.png"
                  alt="Threads"
                />
              </button>
            </div>

            <div class="tier-cta-buttons">
              <button class="tier-cta-btn" id="btn-vote">
                <img
                  src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_btn_vote.png"
                  alt="投票"
                />
              </button>
              <button class="tier-cta-btn" id="btn-more">
                <img
                  src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/btn_home_savesurprise.png"
                  alt="更多定額"
                />
              </button>
            </div>
          </div>
          <!-- /.tier-bottom-group -->

          <!-- Play again button removed -->
        </div>
      </div>

      <!-- ============================================
         MORE INFO POPUP (tier screen)
         ============================================ -->
      <div id="popup-more" class="popup">
        <div class="popup-more-card">
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_popup_bg.png"
            alt=""
            class="popup-more-bg"
          />
          <img
            src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_popup_deco.png"
            alt=""
            class="popup-more-deco"
          />
          <button class="popup-more-btn" id="btn-more-go">
            <img
              src="<?= htmlspecialchars($appUrl, ENT_QUOTES, "UTF-8") ?>/sanrio2026game/assets/say-my-name/game-visuals/result_popup_btn_back.png"
              alt="回到主頁"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- Azure Speech SDK (browser) — for live pronunciation assessment -->
    <script src="https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@1.40.0/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js"></script>

    <!-- Scripts (order matters) -->
    <script src="js/data/characters.js?v=71"></script>
    <script src="js/speech.js?v=65"></script>
    <script src="js/audio-features.js?v=65"></script>
    <script src="js/voice-engine.js?v=74"></script>
    <script src="js/game.js?v=65"></script>
    <script src="js/audio-manager.js?v=7"></script>
    <script src="api/speech-config.php"></script>
    <script src="js/azure-speech.js?v=11"></script>
    <script src="js/app.js?v=121"></script>
  </body>
</html>
