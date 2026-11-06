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
    history: []          // { q, role, picks, hits }
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

  function renderResult() {
    const hist = S.history.filter((h) => Q[h.q]);
    if (!hist.length) {
      app.innerHTML = `
        <header class="result-head"><h1>結果</h1><p class="count">まだ遊んだお題がありません</p></header>
        <div class="result-actions"><button class="btn" id="pick">お題を選ぶ</button></div>`;
      app.querySelector("#pick").addEventListener("click", () => go("list"));
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
      if (!window.confirm("これまでの記録を消します。よろしいですか？")) return;
      Object.assign(S, { q: null, picks: [], revealed: 0, hits: null, history: [] });
      go("home");
    });
  }

  if (!Q.length) { app.textContent = "お題がありません（questions.js を確認してください）"; return; }
  if ((S.screen === "question" || S.screen === "reveal") && !Q[S.q]) S.screen = "list";
  if (S.screen === "reveal" && S.picks.length < RANKS) S.screen = "question";
  render();
})();
