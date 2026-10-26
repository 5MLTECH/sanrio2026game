/**
 * Sanrio Character Database
 * ========================
 * 20 characters with speech recognition aliases.
 *
 * To add/update characters:
 *  - Add entry to CHARACTERS array
 *  - acceptedAnswers must be lowercase (speech engine normalizes input)
 *  - Keep image/voice paths relative to project root
 *  - id must be unique
 *
 * acceptedAnswers priority order:
 *  1. Japanese pronunciation (romaji) — these names ARE Japanese
 *  2. English pronunciation variants
 *  3. Common speech recognition mishearings (both ja-JP and en-US engines)
 *  4. Short-form / nickname variants
 */

window.SanrioGame = window.SanrioGame || {};

/**
 * Per-character size multiplier for visual normalization.
 * Characters with naturally small assets get a boost so all characters
 * appear roughly the same perceived size during gameplay.
 * 1.0 = normal, >1.0 = bigger. Applied on top of the walk path scale.
 */

window.SanrioGame.CHARACTERS = [
  {
    id: 1,
    displayName: "Hello Kitty",
    nameColor: "#e85489",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ハローキティ (harou kiti)
      "ハローキティ",
      "はろーきてぃ",
      "haro kiti",
      "harou kiti",
      "haro kitty",
      "harou kitty",
      "haroh kiti",
      "haro kichi",
      // English
      "hello kitty",
      "hellokitty",
      "hello kiti",
      "hello kit",
      "hell kitty",
      "hello kitti",
      "hello kiddy",
      "halo kitty",
      "helo kitty",
      // Common speech recognition outputs
      "hello katie",
      "hello city",
      "hello key tea",
      "hero kitty",
      "hollow kitty",
      "how low kitty",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/01_character_hellokitty.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/01_character_hellokitty@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Hello Kitty_voice file.aac",
  },
  {
    id: 2,
    displayName: "Cinnamoroll",
    nameColor: "#70B8E8",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: シナモロール (shinamorooru)
      "シナモロール",
      "しなもろーる",
      "shinamoroll",
      "shina moroll",
      "shinamon roll",
      "shinamo roll",
      "shinamororu",
      "shinamo roru",
      // English
      "cinnamoroll",
      "cinnamon roll",
      "cinnamon",
      "cinnamorol",
      "cinamoroll",
      "cinnamo roll",
      "cinnamonroll",
      "cinnamon role",
      "cinnamon row",
      // Common speech recognition outputs
      "cinema roll",
      "cinema role",
      "sin a more roll",
      "sin a moral",
      "cinnamaru",
      "china more roll",
      "she no more roll",
      "sin a moral",
      "sin amor roll",
      "cinnamon role",
      "synonym roll",
      "cinema role",
      "senior moral",
      "signal moral",
      "sin a more role",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/02_character_cinnamoroll.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/02_character_cinnamoroll@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Cinnamoroll_voice file.aac",
  },
  {
    id: 3,
    displayName: "Dear Daniel",
    nameColor: "#4A7FB5",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ディアダニエル (dia danieru)
      "ディアダニエル",
      "でぃあだにえる",
      "dia danieru",
      "dia daniel",
      "dia danny",
      // English
      "dear daniel",
      "deardaniel",
      "dear danielle",
      "dear deny",
      "deer daniel",
      "dear dan",
      "deer danielle",
      "deer danny",
      // Common speech recognition outputs
      "dear deny all",
      "deer deny",
      "dia deny",
      "dear then you",
      "dear danny oh",
      "did daniel",
      "the daniel",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/03_character_deardaniel.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/03_character_deardaniel@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Dear Daniel_voice file.aac",
  },
  {
    id: 4,
    displayName: "Gudetama",
    nameColor: "#F0C800",
    primaryLang: "ja-JP",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ぐでたま (gudetama)
      "ぐでたま",
      "グデタマ",
      "gudetama",
      "gude tama",
      "gu de ta ma",
      "goode tama",
      "goo deh tah mah",
      "goo data ma",
      // English
      "goodetama",
      "godetama",
      "gudatama",
      "goo day tama",
      "good tama",
      "good a tama",
      "gouda tama",
      "goo de tama",
      // Common speech recognition outputs
      "good at mama",
      "could a tama",
      "good the tama",
      "goo tama",
      "goody tama",
      "could tama",
      "google tama",
      "who the tama",
      "good a trauma",
      "good day tom",
      "good day comma",
      "good the tomah",
      "goo the tama",
      "could the tama",
      "would tama",
      "booty tama",
      "good data",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/04_character_gudetama.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/04_character_gudetama@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Gudetama_voice file.aac",
  },
  {
    id: 5,
    displayName: "Hangyodon",
    nameColor: "#4BA8D0",
    primaryLang: "ja-JP",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ハンギョドン (hangyodon)
      "ハンギョドン",
      "はんぎょどん",
      "hangyodon",
      "han gyo don",
      "han gyo dong",
      "hungyo don",
      "hung yodon",
      // English
      "hangyo don",
      "hangio don",
      "hang your don",
      "hangydon",
      "hang yo don",
      "hangiodon",
      "hong yo don",
      "hang yodon",
      "hung yo don",
      "hang yodo",
      "hank yo don",
      "hang you don",
      "hang geo don",
      // Common speech recognition outputs
      "hang yo dawn",
      "hang your dawn",
      "hunky don",
      "honky don",
      "hanky don",
      "hang yodon",
      "han good on",
      "hang yoda",
      "hung yo dawn",
      "hang garden",
      "hang yo done",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/05_character_hangyodon.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/05_character_hangyodon@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Hangyodon_voice file.aac",
  },
  {
    id: 6,
    displayName: "Hello Mimmy",
    nameColor: "#F0A500",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ハローミミィ (harou mimii)
      "ハローミミィ",
      "はろーみみぃ",
      "haro mimmy",
      "harou mimi",
      "harou mimii",
      "haro mimi",
      "haro mimii",
      // English
      "hello mimmy",
      "hellomimmy",
      "hello mimi",
      "hello mini",
      "hello me me",
      "halo mimmy",
      "helo mimmy",
      // Common speech recognition outputs
      "hello me me",
      "hello meme",
      "hello many",
      "hollow mimi",
      "hero mimi",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/06_character_hellomimmy.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/06_character_hellomimmy@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Hello Mimmy_voice file.aac",
  },
  {
    id: 7,
    displayName: "Kerokerokeroppi",
    nameColor: "#4CAF50",
    primaryLang: "ja-JP",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ケロケロケロッピ (kero kero keroppi)
      "ケロケロケロッピ",
      "けろけろけろっぴ",
      "ケロッピ",
      "けろっぴ",
      "kero kero keroppi",
      "kero kero keroppu",
      "kero kero keropee",
      "kerokerokeroppi",
      // English — official short name only ("keroppi"); no 2-word partial forms
      "keroppi",
      // Common speech recognition outputs (en-US often hears "carol")
      "carol carol carol",
      "carol carol keroppi",
      "carol carol carol b",
      "carol carol kara b",
      "carlo carlo keroppi",
      "carol keroppi",
      "care oh care oh keroppi",
      "kero kero keppi",
      "carol kero peppy",
      "carousel keroppi",
      "carol carol",
      "carlo carlo",
      "care oh care oh",
      "kero kero kero",
      "kero kero pi",
      "care oh pi",
      "carol carol perry",
      "care of care of",
      "kelo kelo kelopy",
      "hello hello hello pi",
      "carol carol carol pi",
      "carol perry",
      "carol happy",
      "carol carol kopi",
      "kero kero copy",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/07_character_kerokerokeroppi.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/07_character_kerokerokeroppi@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Kerokerokeroppi_voice file.aac",
  },
  {
    id: 8,
    displayName: "Kirimichan",
    nameColor: "#FF7E5F",
    primaryLang: "ja-JP",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: キリミちゃん (kirimi chan)
      "キリミちゃん",
      "きりみちゃん",
      "kirimi chan",
      "kiri mi chan",
      "kilimi chan",
      "kirimi tyan",
      // English
      "kirimichan",
      "kilimichan",
      "kinimichan",
      // Common speech recognition outputs
      "curry me chan",
      "kiri me chan",
      "clearly me chan",
      "kiri mee chan",
      "career me chan",
      "kiddie me chan",
      "kiri mitchan",
      "kitty me chan",
      "carry me chan",
      "kelly me chan",
      "currently chan",
      "kirimi john",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/08_character_kirimichan.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/08_character_kirimichan@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Kinimichan_voice file.aac",
  },
  {
    id: 9,
    displayName: "Kuromi",
    nameColor: "#9B3DB8",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: クロミ (kuromi)
      "クロミ",
      "くろみ",
      "kuromi",
      "ku ro mi",
      "koo roh mee",
      "kuh roh me",
      "kurumi",
      "kuro mi",
      // English
      "chrome me",
      "chromy",
      "crew me",
      "koromi",
      "crew only",
      "crew omi",
      "cool romy",
      "cool oh me",
      "guru me",
      "kuru me",
      "cure oh me",
      "grew me",
      "crewme",
      // Common speech recognition outputs
      "chrome mi",
      "crew mi",
      "cool me",
      "cooler me",
      "groomy",
      "gloomy",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/09_character_kuromi.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/09_character_kuromi@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Kuromi_voice file.aac",
  },
  {
    id: 10,
    displayName: "Little Twin Stars",
    nameColor: "#7B9ED9",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: リトルツインスターズ (ritoru tsuin sutaazu)
      "リトルツインスターズ",
      "りとるついんすたーず",
      "ritoru tsuin sutaazu",
      "ritoru tsuin",
      // English
      "little twin stars",
      "little twin star",
      "twin stars",
      "little twin",
      "twinstars",
      "kiki and lala",
      "kiki lala",
      "lala kiki",
      // Common en-US speech recognition outputs
      "little twin star",
      "little twins stars",
      "little twin store",
      "little twin starz",
      "little to in stars",
      "little twin staff",
      "little queen stars",
      "little twins star",
      "little twin style",
      "little twins",
      "little to win stars",
      "little twin stuff",
      "little twin starves",
      "little twin start",
      "literal twin stars",
      "little twins star",
      "litter twin stars",
      "little tone stars",
      "little 20 stars",
      "little doing stars",
      "little twin sauce",
      "little twin stars",
      // Common ja-JP misrecognitions (English spoken → Japanese engine)
      "リトルツインスター",
      "れてと インスタンス",
      "リトル ツイン スターズ",
      "りとるついんすたー",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/10_character_littletwinstars.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/10_character_littletwinstars@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Little Twin Star_voice file.aac",
  },
  {
    id: 11,
    displayName: "Marroncream",
    nameColor: "#C8935A",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: マロンクリーム (maron kuriimu)
      "マロンクリーム",
      "まろんくりーむ",
      "maron kuriimu",
      "maron kurimu",
      "maron cream",
      "malon cream",
      "maron creme",
      "maron kurimu",
      // English
      "marroncream",
      "marron cream",
      "maron cream",
      "maroncream",
      "moron cream",
      "marrone cream",
      "maroon cream",
      "marone cream",
      "maroon creme",
      // Common speech recognition outputs
      "my wrong cream",
      "meringue cream",
      "merengue cream",
      "moron creme",
      "melon cream",
      "marathon cream",
      "my room cream",
      "mullen cream",
      "mirror cream",
      "mirin cream",
      "maroon dream",
      "mount cream",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/11_character_marroncream.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/11_character_marroncream@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Marroncream_voice file.aac",
  },
  {
    id: 12,
    displayName: "Minna no Tabo",
    nameColor: "#E75957",
    primaryLang: "ja-JP",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: みんなのたあ坊 (minna no taabou)
      "みんなのたあ坊",
      "ミンナノタアボウ",
      "たあ坊",
      "タアボウ",
      "minna no taabou",
      "minna no tabou",
      "minna no tabo",
      "mina no taabou",
      "mina no tabou",
      "mina no tabo",
      "minna no tabu",
      // English
      "minnano tabo",
      "minna tabo",
      "minna no taboo",
      "mina tabo",
      "mina no tabo",
      // Common speech recognition outputs
      "mean a no taco",
      "me no tabo",
      "mina taco",
      "meaner no tabo",
      "minna no table",
      "minado taboo",
      "minano taboo",
      "minano table",
      "minano tabo",
      "mena no tabo",
      "me not tabo",
      "minute tabo",
      "mineral tabo",
      "minotaur",
      "mean no tabo",
      "mina taboo",
      "minnow tabo",
      "minnow no tabo",
      "me not table",
      "minnow no table",
      "minute a table",
      "mean not table",
      "minute on tabo",
      "me no table",
      "mina not tabo",
      "me know tabo",
      // ja-JP misrecognitions
      "みんなのたぼ",
      "みんなのたーぼう",
      "みんな の たぼ",
      "ミナノタボ",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/12_character_minnanotabo.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/12_character_minnanotabo@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Minna no Tabo_voice file.aac",
  },
  {
    id: 13,
    displayName: "My Melody",
    nameColor: "#E8569A",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: マイメロディ (mai merodi)
      "マイメロディ",
      "まいめろでぃ",
      "mai merodi",
      "mai melody",
      "mai melo",
      "my merodi",
      // English
      "my melody",
      "my melodi",
      // Common speech recognition outputs
      "my melody",
      "my melanie",
      "my melon tea",
      "my melody",
      "miami lady",
      "my melody",
      "my melo d",
      "my merrily",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/13_character_mymelody.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/13_character_mymelody@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/My Melody_voice file.aac",
  },
  {
    id: 14,
    displayName: "My Sweet Piano",
    nameColor: "#9B7ED9",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: マイスウィートピアノ (mai suiito piano)
      "マイスウィートピアノ",
      "まいすうぃーとぴあの",
      "mai suiito piano",
      "mai sweet piano",
      "my suito piano",
      // English
      "my sweet piano",
      "mysweetpiano",
      "my sweet pian",
      "my suite piano",
      "maisweet piano",
      // Common speech recognition outputs
      "my sweet be on a",
      "my sweet piano",
      "my suite piano",
      "my sweet be anna",
      "my sweet pee on a",
      "my suite be on",
      "my sweet peano",
      "mice wheat piano",
      "my sweet beyond",
      "mai suite piano",
      "my suite be on a",
      "my sweet beyond",
      "my sweet pee on oh",
      "my suite beyond",
      // ja-JP misrecognitions
      "マイスイートピアノ",
      "まいすいーとぴあの",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/14_character_mysweetpiano.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/14_character_mysweetpiano@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/My Sweet Piano_voice file.aac",
  },
  {
    id: 15,
    displayName: "Pochacco",
    nameColor: "#EA5455",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ポチャッコ (pochakko)
      "ポチャッコ",
      "ぽちゃっこ",
      "pochakko",
      "po chakko",
      "po cha ko",
      "poh chah koh",
      "pochako",
      // English
      "pochacco",
      "pochaco",
      "po chaco",
      "po chacco",
      "pocchaco",
      "pocha ko",
      "pocha co",
      // Common speech recognition outputs
      "poncho co",
      "po chocolate",
      "botch echo",
      "po choco",
      "po jacko",
      "put choco",
      "push echo",
      "pa choco",
      "pocha go",
      "botch a go",
      "pro choco",
      "posh echo",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/15_character_pochacco.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/15_character_pochacco@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Pochacco_voice file.aac",
  },
  {
    id: 16,
    displayName: "Pompompurin",
    nameColor: "#fedd15",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ポムポムプリン (pomu pomu purin)
      "ポムポムプリン",
      "ぽむぽむぷりん",
      "pomu pomu purin",
      "pomupomupurin",
      "pom pom pureen",
      // English
      "pompompurin",
      "pom pom purin",
      "pompon purin",
      "pompom purin",
      "pompompurine",
      "pom pom pure in",
      "pom pom pudding",
      // Common speech recognition outputs
      "palm palm purin",
      "pompon pudding",
      "palm palm purine",
      "pump on purin",
      "pump pump urine",
      "pump pump purin",
      "palm palm pudding",
      "pom pom pudding",
      "pump on pudding",
      "pom pom putin",
      "bomb bomb purin",
      "bom bom purin",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/16_character_pompompurin.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/16_character_pompompurin@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Pompompurin_voice file.aac",
  },
  {
    id: 17,
    displayName: "Bad-Badtz-Maru",
    nameColor: "#444466",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: バッドばつ丸 (baddo batsu maru)
      "バッドばつ丸",
      "ばっどばつまる",
      "baddo batsu maru",
      "bad batsu maru",
      "bado batsu maru",
      "batsu maru",
      // English
      "bad badtz maru",
      "bad bads maru",
      "bad batch maru",
      "bad bad maru",
      "bad badges maru",
      "bad bats maru",
      "badtz maru",
      "bats maru",
      // Common speech recognition outputs
      "bad batch ma ru",
      "bad badge maru",
      "bad buzz maru",
      "bad buds maru",
      "bad about maru",
      "about smog",
      "bad but small",
      "bad bats maloo",
      "bad bots maru",
      "bad birds maru",
      "bad but my room",
      "bad butts maru",
      "bat bat smaru",
      "bat su maru",
      "bad bad zoo maru",
      "bad odds maru",
      "bad bads ma ru",
      "bad batch my room",
      "bad badge my room",
      "bad bots my room",
      "bad bot smaru",
      "bad batch morrow",
      "bad bad smart",
      "bad bats moral",
      "bad bads moral",
      "bad buds moral",
      // ja-JP misrecognitions
      "バッドバツマル",
      "ばっどばつまる",
      "バドバツマル",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/17_character_badbadtzmaru.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/17_character_badbadtzmaru@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Bad-Badtz-Maru_voice file.aac",
  },
  {
    id: 18,
    displayName: "Tuxedosam",
    nameColor: "#1976D2",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: タキシードサム (takishiido samu)
      "タキシードサム",
      "たきしーどさむ",
      "takishiido samu",
      "takishido sam",
      "taki sido samu",
      "takushi do samu",
      // English
      "tuxedosam",
      "tuxedo sam",
      "tuxedo sum",
      "tuxedosome",
      "tux sam",
      "tuxido sam",
      "tuxedo samu",
      // Common speech recognition outputs
      "taxi do sam",
      "taxi doh sam",
      "talk she do sam",
      "duck see do sam",
      "tuxedo some",
      "tuxedo psalm",
      "talk to sam",
      "taxi sam",
      "tax he does am",
      "tuxedos am",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/18_character_tuxedosam.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/18_character_tuxedosam@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Tuxedosam_voice file.aac",
  },
  {
    id: 19,
    displayName: "Usahana",
    nameColor: "#E0449A",
    primaryLang: "ja-JP",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ウサハナ (usahana)
      "ウサハナ",
      "うさはな",
      "usahana",
      "u sa ha na",
      "usa hana",
      "oo sah hah nah",
      "oo sa ha na",
      // English
      "usaha na",
      "usahanna",
      "osa hana",
      "usa hannah",
      "oosa hana",
      "uza hana",
      "usa hanna",
      "uhsahana",
      // Common speech recognition outputs
      "who saw hana",
      "who sa hana",
      "usa honor",
      "who's a hana",
      "ooh saw hana",
      "oo saw honey",
      "oh sa hana",
      "use a hana",
      "you saw hana",
      "user hana",
      "usa wanna",
      "osakana",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/19_character_usahana.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/19_character_usahana@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Usahana_voice file.aac",
  },
  {
    id: 20,
    displayName: "Wish me mell",
    nameColor: "#BCB5D8",
    sizeMultiplier: 1.0,
    acceptedAnswers: [
      // Japanese: ウィッシュミーメル (wisshu mii meru)
      "ウィッシュミーメル",
      "うぃっしゅみーめる",
      "wisshu mii meru",
      "wishu mi meru",
      "wish me meru",
      // English
      "wish me mell",
      "wishmemell",
      "wish me mel",
      "wish me male",
      "wish memel",
      "wish me well",
      "wish mi meru",
      // Common speech recognition outputs
      "wish me mel",
      "wish me male",
      "wish me mail",
      "wish memaw",
      "wish me now",
      "wish mi mel",
      "wish premier",
      "wish me more",
      "wish me mel",
      "which me mel",
    ],
    image:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/1x/20_character_wishmemell.png",
    image4x:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/characters/4x/20_character_wishmemell@4x.png",
    voicePath:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/character-names-pronounce/Wish me mell_voice file.aac",
  },
];

/**
 * Tier badge asset mapping
 * Used by the result screen to display the correct badge
 */
window.SanrioGame.TIERS = {
  gold: {
    id: "gold",
    label: "金獎",
    labelEn: "Gold",
    minPercentage: 90,
    textImage:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/game-visuals/result_gold_text.png",
    characterImage:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/game-visuals/result_gold_character.png",
  },
  silver: {
    id: "silver",
    label: "銀獎",
    labelEn: "Silver",
    minPercentage: 75,
    textImage:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/game-visuals/result_sliver_text.png",
    characterImage:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/game-visuals/result_sliver_character.png",
  },
  copper: {
    id: "copper",
    label: "銅獎",
    labelEn: "Copper",
    minPercentage: 50,
    textImage:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/game-visuals/result_copper_text.png",
    characterImage:
      "https://sanrio.mmdbfiles.com/sanrio2026game/assets/say-my-name/game-visuals/result_copper_character.png",
  },
};
