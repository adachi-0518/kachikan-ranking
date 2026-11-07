(() => {
  "use strict";

  const Q = window.QUESTIONS || [];
  const RANKS = 3;
  const STORE_KEY = "kachikan-ranking-v3";
  const app = document.getElementById("app");
  const CATS = [...new Set(Q.map((q) => q.cat || "その他"))];

  // めくったあとに話すこと（お題の番号で順番に出す）
  const TALK = {
    answer: [
      "1位を選んだ理由は？",
      "3位と4位の差はなんだった？",
      "逆に、絶対に選ばないのはどれ？",
      "昔の自分なら、何を1位にしていた？",
      "最後まで迷ったのはどれとどれ？",
      "1位は、いつからそう思っている？"
    ],
    guess: [
      "なんでそう予想した？",
      "いちばん意外だったのはどれ？",
      "相手のどこを見てそう思った？",
      "自分なら、どれを1位にする？",
      "いちばん自信があったのはどれ？",
      "外れたものの理由を聞いてみよう"
    ]
  };

  // ---------- 状態 ----------
  const fresh = () => ({
    screen: "home",
    me: "",
    friend: "",
    firstRole: "answer", // 最初の役。以降は1問ごとに交代
    cat: "all",          // 一覧の絞り込み
    q: null,             // いま遊んでいるお題の番号（0始まり）
    role: "answer",      // いまのお題での役
    picks: [],
    revealed: 0,
    hits: null,
    history: [],         // { q, role, picks, hits }
    peer: null,          // 読み込んだ相手の回答 { name, entries, at }
    pendingPeer: null
  });

  let S = load() || fresh();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? Object.assign(fresh(), JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できなくても遊べる */ }
  }

  const meName = () => S.me.trim() || "あなた";
  const friendName = () => S.friend.trim() || "相手";
  const other = (r) => (r === "answer" ? "guess" : "answer");
  const nextDefaultRole = () => (S.history.length % 2 === 0 ? S.firstRole : other(S.firstRole));
  const played = () => new Set(S.history.map((h) => h.q));
  const inCat = (i) => S.cat === "all" || Q[i].cat === S.cat;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const buzz = (ms) => { try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(ms); } catch (e) {} };

  function go(screen) {
    S.screen = screen;
    save();
    render();
    window.scrollTo(0, 0);
  }

  function startQuestion(i) {
    Object.assign(S, { q: i, role: nextDefaultRole(), picks: [], revealed: 0, hits: null });
    go("question");
  }

  function randomQuestion() {
    const done = played();
    const all = Q.map((_, i) => i).filter(inCat);
    const fresh = all.filter((i) => !done.has(i));
    const list = fresh.length ? fresh : all;
    startQuestion(list[Math.floor(Math.random() * list.length)]);
  }

  // ---------- 画面 ----------
  function render() {
    app.classList.toggle("no-dock", S.screen !== "question");
    if (S.screen === "list") return renderList();
    if (S.screen === "question" && Q[S.q]) return renderQuestion();
    if (S.screen === "reveal" && Q[S.q]) return renderReveal();
    if (S.screen === "result") return renderResult();
    if (S.screen === "compare") return renderCompare();
    if (S.screen === "import") return renderImport();
    return renderHome();
  }

  function renderHome() {
    const n = S.history.length;
    app.innerHTML = `
      <header class="hero">
        <svg class="fan" viewBox="0 0 168 112" aria-hidden="true">
          <g transform="rotate(-18 84 160)"><rect x="56" y="12" width="56" height="80" rx="8" class="c3"/><text x="64" y="32" class="cn">3</text></g>
          <g transform="rotate(18 84 160)"><rect x="56" y="12" width="56" height="80" rx="8" class="c2"/><text x="104" y="32" class="cn" text-anchor="end">2</text></g>
          <g><rect x="56" y="6" width="56" height="80" rx="8" class="c1"/><text x="64" y="26" class="cn">1</text><text x="84" y="58" class="cq">?</text></g>
        </svg>
        <h1>価値観ランキング</h1>
        <p>1〜3位を選んで、同時にめくる。<br>相手の答え、当てられる？</p>
      </header>

      <section class="section">
        <h2>あそびかた</h2>
        <ol class="steps">
          <li>2人とも自分のスマホでこのページを開く</li>
          <li>同じお題を選ぶ（番号を伝え合う）</li>
          <li>答える人は本音で、当てる人は相手を予想して1〜3位を選ぶ</li>
          <li>3位→2位→1位の順に同時にめくって、理由を話す</li>
        </ol>
      </section>

      <section class="section">
        <h2>名前</h2>
        <div class="names">
          <div>
            <label class="input-label" for="me">自分</label>
            <input class="input" id="me" maxlength="10" placeholder="あなた" autocomplete="off" value="${esc(S.me)}">
          </div>
          <div>
            <label class="input-label" for="friend">相手</label>
            <input class="input" id="friend" maxlength="10" placeholder="相手" autocomplete="off" value="${esc(S.friend)}">
          </div>
        </div>
        <p class="hint">空欄のままでも遊べます。</p>
      </section>

      <section class="section">
        <fieldset class="radios">
          <legend>最初のあなたの役</legend>
          <div class="role-opts">
            <label class="radio">
              <input type="radio" name="role" value="answer" ${S.firstRole === "answer" ? "checked" : ""}>
              <b>答える人</b><small>自分の本音で順位をつける</small>
            </label>
            <label class="radio">
              <input type="radio" name="role" value="guess" ${S.firstRole === "guess" ? "checked" : ""}>
              <b>当てる人</b><small>相手の順位を予想する</small>
            </label>
          </div>
        </fieldset>
        <p class="hint">相手とは別の役にしてください。1問ごとに自動で入れかわり、お題の画面でも変えられます。</p>
      </section>

      <div class="start">
        <button class="btn" id="pick">お題を選ぶ</button>
        <button class="btn outline" id="random">ランダムで1問</button>
        ${n ? `<div class="center"><button class="text-btn" id="result">これまでの結果（${n}問）</button></div>` : ""}
        ${S.peer ? `<div class="center"><button class="text-btn" id="cmp">${esc(peerName())}の回答と見比べる</button></div>` : ""}
      </div>
    `;

    const me = app.querySelector("#me");
    const fr = app.querySelector("#friend");
    me.addEventListener("input", () => { S.me = me.value; save(); });
    fr.addEventListener("input", () => { S.friend = fr.value; save(); });
    app.querySelectorAll('input[name="role"]').forEach((r) => {
      r.addEventListener("change", () => { S.firstRole = r.value; save(); });
    });
    app.querySelector("#pick").addEventListener("click", () => go("list"));
    app.querySelector("#random").addEventListener("click", randomQuestion);
    const res = app.querySelector("#result");
    if (res) res.addEventListener("click", () => go("result"));
    const cmp = app.querySelector("#cmp");
    if (cmp) cmp.addEventListener("click", () => go("compare"));
  }

  function renderList() {
    const done = played();
    const items = Q.map((q, i) => ({ q, i })).filter(({ i }) => inCat(i));
    app.innerHTML = `
      <div class="list-head">
        <button class="text-btn" id="home">← トップ</button>
        <h1>お題を選ぶ</h1>
        <p class="sub">相手と同じ番号のお題を選んでください。${done.size ? "遊んだお題には「済」がつきます。" : ""}</p>
      </div>

      <div class="chips" role="group" aria-label="カテゴリで絞り込む">
        <button class="chip" data-cat="all" aria-pressed="${S.cat === "all"}">すべて</button>
        ${CATS.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${S.cat === c}">${esc(c)}</button>`).join("")}
      </div>

      <button class="btn outline random-btn" id="random">${S.cat === "all" ? "ランダムで1問" : `「${esc(S.cat)}」からランダムで1問`}</button>

      <ul class="qlist">
        ${items.map(({ q, i }) => `
          <li><button class="qrow ${done.has(i) ? "done" : ""}" data-i="${i}">
            <span class="no">No.${i + 1}</span>
            <span class="qt">${esc(q.title)}<small>${esc(q.cat || "")}</small></span>
            ${done.has(i) ? `<span class="mark">済</span>` : ""}
          </button></li>`).join("")}
      </ul>
    `;

    app.querySelector("#home").addEventListener("click", () => go("home"));
    app.querySelector("#random").addEventListener("click", randomQuestion);
    app.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      S.cat = c.dataset.cat;
      save();
      renderList();
    }));
    app.querySelectorAll(".qrow").forEach((b) => b.addEventListener("click", () => startQuestion(Number(b.dataset.i))));
  }

  // お題カード（青い面）。お題画面とめくる画面で共通
  function qCard(sub, canSwitch) {
    const q = Q[S.q];
    const roleBox = canSwitch
      ? `<div class="role-switch" role="group" aria-label="このお題での${esc(meName())}の役">
          <button data-r="answer" aria-pressed="${S.role === "answer"}">答える</button>
          <button data-r="guess" aria-pressed="${S.role === "guess"}">当てる</button>
        </div>`
      : `<span class="role-tag">${S.role === "answer" ? "答える番" : "当てる番"}</span>`;
    return `
      <div class="q-card">
        <div class="q-meta">
          <span class="q-no"><b>No.${S.q + 1}</b>${esc(q.cat || "")}</span>
          ${roleBox}
        </div>
        <h2>${esc(q.title)}</h2>
        ${sub ? `<p>${sub}</p>` : ""}
      </div>
    `;
  }

  function renderQuestion() {
    const item = Q[S.q];
    const sub = S.role === "answer"
      ? `${esc(meName())}の本音で、1位から順にタップ。`
      : `${esc(friendName())}が選びそうな順に、1位からタップ。`;
    const left = RANKS - S.picks.length;

    app.innerHTML = `
      ${qCard(sub, true)}
      <ul class="opts">
        ${item.options.map((t, i) => {
          const r = S.picks.indexOf(i);
          return `<li><button class="opt ${r >= 0 ? "picked" : ""}" data-i="${i}" aria-pressed="${r >= 0}">
            <span class="rank">${r >= 0 ? `${r + 1}<small>位</small>` : ""}</span>
            <span class="label">${esc(t)}</span>
          </button></li>`;
        }).join("")}
      </ul>
      <p class="sub undo-hint">選んだものをもう一度タップすると取り消せます。</p>
      <div class="back-home"><button class="text-btn" id="back">← お題の一覧に戻る</button></div>

      <div class="dock"><div class="dock-inner">
        <ol class="picked-list" aria-label="選んだ順位">
          ${[0, 1, 2].map((r) => {
            const idx = S.picks[r];
            return `<li><span class="n">${r + 1}位</span><span class="v ${idx == null ? "empty" : ""}">${idx == null ? "未選択" : esc(item.options[idx])}</span></li>`;
          }).join("")}
        </ol>
        <button class="btn" id="next" ${left > 0 ? "disabled" : ""}>
          ${left > 0 ? `あと${left}つ選んでください` : "この順位で決定する"}
        </button>
      </div></div>
    `;

    const rerender = (focusSel) => {
      const y = window.scrollY;
      renderQuestion();
      window.scrollTo(0, y);
      const el = focusSel && app.querySelector(focusSel);
      if (el) el.focus({ preventScroll: true });
    };

    app.querySelectorAll(".opt").forEach((b) => {
      b.addEventListener("click", () => {
        const i = Number(b.dataset.i);
        const at = S.picks.indexOf(i);
        if (at >= 0) S.picks.splice(at, 1);
        else if (S.picks.length < RANKS) S.picks.push(i);
        else return;
        buzz(10);
        save();
        rerender(`.opt[data-i="${i}"]`);
      });
    });
    app.querySelectorAll(".role-switch button").forEach((b) => {
      b.addEventListener("click", () => {
        S.role = b.dataset.r;
        save();
        rerender(`.role-switch [data-r="${S.role}"]`);
      });
    });
    app.querySelector("#next").addEventListener("click", () => {
      S.revealed = 0;
      S.hits = null;
      go("reveal");
    });
    app.querySelector("#back").addEventListener("click", () => go("list"));
  }

  function renderReveal() {
    const item = Q[S.q];
    const role = S.role;
    const done = S.revealed >= RANKS;
    const nextRank = RANKS - S.revealed; // 3 → 2 → 1
    const talk = TALK[role][S.q % TALK[role].length];
    const guesser = role === "guess" ? meName() : friendName();

    app.innerHTML = `
      ${qCard("", false)}
      <p class="status" role="status">${done
        ? "3つともめくりました。"
        : `相手と同時に、<b>${nextRank}位</b>をめくります。`}</p>

      <ol class="flips">
        ${[1, 2, 3].map((rank) => {
          const label = item.options[S.picks[rank - 1]];
          const open = rank > RANKS - S.revealed;
          const isNext = !done && rank === nextRank;
          return `<li class="${rank === 1 ? "first" : ""}">
            <button class="flip ${open ? "open" : ""} ${isNext ? "next" : ""}" data-rank="${rank}" ${isNext ? "" : "disabled"}
              aria-label="${open ? `${rank}位 ${esc(label)}` : isNext ? `${rank}位をめくる` : `${rank}位（まだめくれません）`}">
              <span class="inner">
                <span class="face back">
                  <span class="idx">${rank}<small>位</small></span>
                  <span class="hint-text">${isNext ? "タップしてめくる" : ""}</span>
                  <span class="idx end">${rank}</span>
                </span>
                <span class="face front">
                  <span class="idx">${rank}<small>位</small></span>
                  <span class="txt">${esc(label)}</span>
                </span>
              </span>
            </button>
          </li>`;
        }).join("")}
      </ol>

      ${done ? `
        <section class="after">
          <div class="talk-box">
            <h3>話してみよう</h3>
            <p class="talk">${esc(talk)}</p>
          </div>

          <fieldset class="score">
            <legend>${esc(guesser)}が当てた数</legend>
            <p>順位がちがっても、3位までに入っていれば1つと数えます。</p>
            <div class="segs">
              ${[0, 1, 2, 3].map((n) => `<label><input type="radio" name="hits" value="${n}" ${S.hits === n ? "checked" : ""}><span>${n}</span></label>`).join("")}
            </div>
          </fieldset>

          <div class="next-wrap">
            <button class="btn" id="to-list" ${S.hits == null ? "disabled" : ""}>次のお題を選ぶ</button>
            <button class="btn outline" id="to-random" ${S.hits == null ? "disabled" : ""}>ランダムで次へ</button>
          </div>
          <div class="redo">
            <button class="text-btn" id="to-result" ${S.hits == null ? "disabled" : ""}>ここで終わって結果を見る</button>
            <button class="text-btn" id="redo">順位を選び直す</button>
          </div>
        </section>
      ` : ""}
    `;

    const btn = app.querySelector(".flip.next");
    if (btn) btn.addEventListener("click", () => {
      btn.classList.add("open");
      btn.disabled = true;
      buzz(20);
      S.revealed += 1;
      save();
      setTimeout(() => {
        renderReveal();
        const n = app.querySelector(".flip.next");
        if (n) n.focus({ preventScroll: true });
      }, 480);
    });

    if (!done) return;

    const nav = ["#to-list", "#to-random", "#to-result"].map((s) => app.querySelector(s));
    app.querySelectorAll('input[name="hits"]').forEach((r) => {
      r.addEventListener("change", () => {
        S.hits = Number(r.value);
        nav.forEach((b) => { b.disabled = false; });
        save();
      });
    });

    const record = () => {
      S.history.push({ q: S.q, role, picks: S.picks.slice(), hits: S.hits });
      Object.assign(S, { picks: [], revealed: 0, hits: null });
    };
    app.querySelector("#to-list").addEventListener("click", () => { record(); go("list"); });
    app.querySelector("#to-random").addEventListener("click", () => { record(); randomQuestion(); });
    app.querySelector("#to-result").addEventListener("click", () => { record(); go("result"); });
    app.querySelector("#redo").addEventListener("click", () => { S.revealed = 0; S.hits = null; go("question"); });
  }

  // ---------- 回答コード（サーバーを使わずに回答を交換する） ----------
  // 形式: "KR" + base64url( 版 | 名前の長さ | 名前(UTF-8) | 件数 | [お題, 役と当たり数, 順位2バイト]… | 検査用の合計 )
  const CODE_PREFIX = "KR";

  function utf8Cut(str, maxBytes) {
    const enc = new TextEncoder();
    let s = str;
    while (enc.encode(s).length > maxBytes) s = s.slice(0, -1);
    return enc.encode(s);
  }
  function toB64url(bytes) {
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64url(s) {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  function encodeCode() {
    const entries = S.history.filter((h) => Q[h.q] && h.q < 256).slice(-255);
    const name = utf8Cut(S.me.trim(), 30);
    const bytes = [1, name.length, ...name, entries.length];
    entries.forEach((h) => {
      const p = (h.picks[0] & 7) | ((h.picks[1] & 7) << 3) | ((h.picks[2] & 7) << 6);
      bytes.push(h.q, (h.role === "guess" ? 128 : 0) | ((h.hits & 3) << 5), p >> 8, p & 255);
    });
    bytes.push(bytes.reduce((a, b) => (a + b) & 255, 0));
    return CODE_PREFIX + toB64url(bytes);
  }

  function decodeCode(input) {
    let s = String(input || "").trim();
    const m = s.match(/[#&?]c=([A-Za-z0-9_-]+)/);
    if (m) s = m[1];
    s = s.replace(/\s+/g, "");
    if (!s.startsWith(CODE_PREFIX)) throw new Error("「KR」で始まるコードか、送られてきたリンクを貼り付けてください。");
    let b;
    try { b = fromB64url(s.slice(CODE_PREFIX.length)); } catch (e) { throw new Error("コードの文字が途中で欠けているようです。"); }
    const body = b.slice(0, -1);
    const sum = body.reduce((a, x) => (a + x) & 255, 0);
    if (!b.length || sum !== b[b.length - 1]) throw new Error("コードの一部が欠けているか、まちがっています。最初から最後までコピーしてください。");
    let i = 0;
    if (body[i++] !== 1) throw new Error("このコードの形式には対応していません。");
    const nl = body[i++];
    const name = new TextDecoder().decode(body.slice(i, i + nl)); i += nl;
    const n = body[i++];
    const entries = [];
    for (let k = 0; k < n; k++) {
      const q = body[i++], rh = body[i++], p = (body[i++] << 8) | body[i++];
      const picks = [p & 7, (p >> 3) & 7, (p >> 6) & 7];
      if (!Q[q] || new Set(picks).size !== 3) continue; // 知らないお題は飛ばす
      entries.push({ q, role: rh & 128 ? "guess" : "answer", hits: (rh >> 5) & 3, picks });
    }
    if (i !== body.length) throw new Error("コードの長さが合いません。最初から最後までコピーしてください。");
    return { name, entries, at: Date.now() };
  }

  const shareLink = (code) => `${location.origin}${location.pathname}#c=${code}`;
  const peerName = () => (S.peer && S.peer.name) || friendName();

  // お題ごとの最新の記録
  function latestByQ(list) {
    const map = new Map();
    list.forEach((h) => map.set(h.q, h));
    return map;
  }

  function exchangeSection() {
    const has = S.history.length > 0;
    return `
      <section class="section exchange" id="exchange">
        <h2>回答を交換する</h2>
        <p class="sub">回答をコードにして相手に送ります。サーバーには何も保存しません。お互いのコードを読み込むと、相手の回答と見比べられます。</p>

        <h3>1. 自分のコードを送る</h3>
        <button class="btn" id="share" ${has ? "" : "disabled"}>${has ? "コードを送る（LINEなど）" : "まだ送れる回答がありません"}</button>
        ${has ? `
          <details class="code-details">
            <summary>コードを文字で見る</summary>
            <textarea class="code-box" id="my-code" readonly rows="3">${encodeCode()}</textarea>
            <button class="btn outline" id="copy">コードをコピー</button>
          </details>` : ""}
        <p class="note" id="share-note" role="status"></p>

        <h3>2. 相手のコードを読み込む</h3>
        <p class="sub small">送られてきたリンクを開くか、ここに貼り付けてください。</p>
        <label class="visually-hidden" for="peer-code">相手のコード</label>
        <textarea class="code-box" id="peer-code" rows="3" placeholder="KR から始まるコード、またはリンク"></textarea>
        <p class="err" id="peer-err" role="alert"></p>
        <button class="btn outline" id="load">読み込む</button>

        ${S.peer ? `
          <div class="peer-ready">
            <p><b>${esc(peerName())}</b>の回答（${S.peer.entries.length}問）を読み込み済み</p>
            <button class="btn" id="compare">${esc(peerName())}の回答と見比べる</button>
          </div>` : ""}
      </section>
    `;
  }

  function bindExchange() {
    const share = app.querySelector("#share");
    const note = app.querySelector("#share-note");
    const copyText = async (text, msg) => {
      try { await navigator.clipboard.writeText(text); note.textContent = msg; }
      catch (e) {
        const box = app.querySelector("#my-code");
        if (box) { box.closest("details").open = true; box.select(); }
        note.textContent = "自動でコピーできませんでした。コードを長押ししてコピーしてください。";
      }
    };
    if (share && !share.disabled) share.addEventListener("click", async () => {
      const code = encodeCode();
      const url = shareLink(code);
      if (navigator.share) {
        try {
          await navigator.share({ title: "価値観ランキング", text: `${meName()}の回答です。リンクを開くと見比べられます。`, url });
          note.textContent = "送りました。相手のコードも送ってもらいましょう。";
          return;
        } catch (e) { if (e && e.name === "AbortError") return; }
      }
      copyText(url, "リンクをコピーしました。LINEなどに貼り付けて送ってください。");
    });
    const copy = app.querySelector("#copy");
    if (copy) copy.addEventListener("click", () => copyText(encodeCode(), "コードをコピーしました。"));

    app.querySelector("#load").addEventListener("click", () => {
      const err = app.querySelector("#peer-err");
      err.textContent = "";
      try {
        const peer = decodeCode(app.querySelector("#peer-code").value);
        if (!peer.entries.length) throw new Error("このコードには回答が入っていません。");
        S.peer = peer;
        save();
        go("compare");
      } catch (e) { err.textContent = e.message; }
    });
    const cmp = app.querySelector("#compare");
    if (cmp) cmp.addEventListener("click", () => go("compare"));
  }

  function renderResult() {
    const hist = S.history.filter((h) => Q[h.q]);
    if (!hist.length) {
      app.innerHTML = `
        <header class="result-head"><h1>結果</h1><p class="count">まだ遊んだお題がありません</p></header>
        <div class="result-actions"><button class="btn" id="pick">お題を選ぶ</button></div>
        ${exchangeSection()}`;
      app.querySelector("#pick").addEventListener("click", () => go("list"));
      bindExchange();
      return;
    }
    const sum = (arr) => arr.reduce((a, h) => a + (h.hits || 0), 0);
    const total = sum(hist);
    const max = hist.length * RANKS;
    const pct = Math.round((total / max) * 100);
    const mine = hist.filter((h) => h.role === "guess");
    const theirs = hist.filter((h) => h.role === "answer");
    const comment =
      pct >= 80 ? "ほとんど言わなくても伝わる2人です。" :
      pct >= 60 ? "かなりお互いのことが分かっています。" :
      pct >= 40 ? "半分くらい当たりました。まだ知らない一面がありそうです。" :
      pct >= 20 ? "意外な答えが多かったようです。話すネタはたくさんあります。" :
      "予想がほとんど外れました。ここから知っていく2人です。";

    // ジャンル別（カテゴリの並びは固定。多い順に並べ替えない）
    const byCat = CATS.map((c) => {
      const hs = hist.filter((h) => Q[h.q].cat === c);
      const got = sum(hs), all = hs.length * RANKS;
      return { c, n: hs.length, got, all, pct: all ? Math.round((got / all) * 100) : 0 };
    }).filter((x) => x.n > 0);
    const best = byCat.length > 1 ? byCat.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;

    app.innerHTML = `
      <header class="result-head">
        <h1>${hist.length}問の結果</h1>
        <p class="count">${max}個中 <b>${total}個</b> 当たり（${pct}%）</p>
        <p>${comment}</p>
      </header>

      <dl class="tally">
        <div><dt>${esc(meName())}が当てた数</dt><dd>${sum(mine)}<small> / ${mine.length * RANKS}</small></dd></div>
        <div><dt>${esc(friendName())}が当てた数</dt><dd>${sum(theirs)}<small> / ${theirs.length * RANKS}</small></dd></div>
      </dl>

      <section class="section">
        <h2>ジャンル別の当たり率</h2>
        ${best ? `<p class="sub small cat-note">いちばん分かり合えているのは「${esc(best.c)}」です。</p>` : ""}
        <ul class="cat-bars">
          ${byCat.map((x) => `
            <li>
              <div class="cb-head"><span class="cb-name">${esc(x.c)}</span><span class="cb-val"><b>${x.pct}%</b>（${x.got}/${x.all}・${x.n}問）</span></div>
              <div class="cb-track" role="img" aria-label="${esc(x.c)} ${x.pct}%"><span style="width:${x.pct}%"></span></div>
            </li>`).join("")}
        </ul>
      </section>

      ${exchangeSection()}

      <section class="section">
        <h2>${esc(meName())}がつけた順位</h2>
        <ul class="history">
          ${hist.map((h) => {
            const item = Q[h.q];
            return `<li>
              <div class="h-q"><span class="h-no">No.${h.q + 1}</span>${esc(item.title)}</div>
              <div class="h-meta">${h.role === "answer" ? "自分の本音" : `${esc(friendName())}の予想`}／当たり ${h.hits}個</div>
              <ol>${h.picks.map((p, r) => `<li><span class="sub">${r + 1}位</span> ${esc(item.options[p])}</li>`).join("")}</ol>
            </li>`;
          }).join("")}
        </ul>
      </section>

      <div class="result-actions">
        <button class="btn" id="more">続けて遊ぶ</button>
        <button class="btn outline" id="reset">記録を消して最初から</button>
        <div class="center"><button class="text-btn" id="home">トップに戻る</button></div>
      </div>
    `;

    app.querySelector("#more").addEventListener("click", () => go("list"));
    app.querySelector("#home").addEventListener("click", () => go("home"));
    app.querySelector("#reset").addEventListener("click", () => {
      if (!window.confirm("これまでの記録と読み込んだ相手の回答を消します。よろしいですか？")) return;
      Object.assign(S, { q: null, picks: [], revealed: 0, hits: null, history: [], peer: null });
      go("home");
    });
    bindExchange();
  }

  // ---------- 相手の回答と見比べる ----------
  function renderCompare() {
    if (!S.peer) return go("result");
    const pn = peerName();
    const mine = latestByQ(S.history.filter((h) => Q[h.q]));
    const theirs = latestByQ(S.peer.entries);
    const both = [...mine.keys()].filter((q) => theirs.has(q)).sort((a, b) => a - b);
    const onlyMe = [...mine.keys()].filter((q) => !theirs.has(q)).length;
    const onlyThem = [...theirs.keys()].filter((q) => !mine.has(q)).length;

    // 役がちがうお題は自動で採点（予想が本音の3位以内に入った数／順位まで同じ数）
    let meGot = 0, meAll = 0, thGot = 0, thAll = 0, exact = 0;
    const rows = both.map((q) => {
      const a = mine.get(q), b = theirs.get(q);
      const inter = a.picks.filter((p) => b.picks.includes(p)).length;
      const same = a.picks.filter((p, i) => b.picks[i] === p).length;
      if (a.role !== b.role) {
        exact += same;
        if (a.role === "guess") { meGot += inter; meAll += 3; } else { thGot += inter; thAll += 3; }
      }
      return { q, a, b, inter, same };
    });

    const roleLabel = (h, who) => (h.role === "answer" ? `${who}の本音` : `${who}の予想`);
    const col = (h, who, otherPicks) => `
      <div class="cmp-col">
        <div class="cmp-who">${esc(roleLabel(h, who))}</div>
        <ol>${h.picks.map((p, i) => {
          const hit = otherPicks.includes(p);
          const same = otherPicks[i] === p;
          return `<li class="${hit ? "hit" : ""}"><span class="r">${i + 1}位</span><span class="t">${esc(Q[h.q].options[p])}</span>${same ? `<span class="same">同じ順位</span>` : ""}</li>`;
        }).join("")}</ol>
      </div>`;

    app.innerHTML = `
      <div class="list-head">
        <button class="text-btn" id="back">← 結果に戻る</button>
        <h1>${esc(pn)}と見比べる</h1>
        <p class="sub">2人とも遊んだお題 ${both.length}問。${onlyMe || onlyThem ? `片方だけのお題は${onlyMe + onlyThem}問あります。` : ""}</p>
      </div>

      ${meAll + thAll ? `
        <dl class="tally">
          <div><dt>${esc(meName())}の予想</dt><dd>${meGot}<small> / ${meAll}</small></dd></div>
          <div><dt>${esc(pn)}の予想</dt><dd>${thGot}<small> / ${thAll}</small></dd></div>
        </dl>
        <p class="sub small auto-note">回答どうしを照らし合わせて自動で数えています。順位までぴったり同じだったのは${exact}個。</p>
      ` : ""}

      ${rows.length ? `<ul class="cmp-list">
        ${rows.map(({ q, a, b, inter }) => `
          <li class="cmp">
            <div class="cmp-q"><span class="h-no">No.${q + 1}</span>${esc(Q[q].title)}</div>
            <div class="cmp-sum">${a.role === b.role
              ? `2人とも${a.role === "answer" ? "本音" : "予想"}。共通は${inter}個`
              : `${inter}個 当たり`}</div>
            <div class="cmp-cols">
              ${col(a, meName(), b.picks)}
              ${col(b, pn, a.picks)}
            </div>
          </li>`).join("")}
      </ul>` : `<p class="section">同じお題をまだ遊んでいません。同じ番号のお題を遊んでから、もう一度コードを交換してください。</p>`}

      <div class="result-actions">
        <button class="btn outline" id="back2">結果に戻る</button>
      </div>
    `;
    app.querySelector("#back").addEventListener("click", () => go("result"));
    app.querySelector("#back2").addEventListener("click", () => go("result"));
  }

  // リンクで開いたとき（#c=…）の確認画面
  function renderImport() {
    const p = S.pendingPeer;
    if (!p) return go("home");
    app.innerHTML = `
      <header class="result-head">
        <h1>回答コード</h1>
        <p class="count">${esc(p.name || "相手")}の回答（${p.entries.length}問）</p>
        <p>読み込むと、自分の回答と見比べられます。この端末の中だけに保存されます。</p>
      </header>
      ${p.name ? "" : `
        <section class="section">
          <label class="input-label" for="pname">相手の名前</label>
          <input class="input" id="pname" maxlength="10" placeholder="相手" value="${esc(S.friend)}">
        </section>`}
      <div class="result-actions">
        <button class="btn" id="ok">読み込む</button>
        <button class="btn outline" id="cancel">やめる</button>
      </div>
    `;
    app.querySelector("#ok").addEventListener("click", () => {
      const nm = app.querySelector("#pname");
      if (nm && nm.value.trim()) p.name = nm.value.trim();
      S.peer = p;
      if (!S.friend.trim() && p.name) S.friend = p.name;
      S.pendingPeer = null;
      go("compare");
    });
    app.querySelector("#cancel").addEventListener("click", () => { S.pendingPeer = null; go("home"); });
  }

  if (!Q.length) { app.textContent = "お題がありません（questions.js を確認してください）"; return; }
  if ((S.screen === "question" || S.screen === "reveal") && !Q[S.q]) S.screen = "list";
  if (S.screen === "reveal" && S.picks.length < RANKS) S.screen = "question";
  if (/[#&]c=/.test(location.hash)) {
    try {
      S.pendingPeer = decodeCode(location.hash);
      S.screen = "import";
    } catch (e) {
      window.alert("リンクのコードを読み込めませんでした。" + e.message);
    }
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }
  render();
})();
