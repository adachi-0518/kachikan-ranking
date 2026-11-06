(() => {
  "use strict";

  const Q = window.QUESTIONS || [];
  const RANKS = 3;
  const STORE_KEY = "kachikan-ranking-v2";
  const app = document.getElementById("app");

  // めくったあとに話すこと（お題ごとに順番に出す）
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
    firstRole: "answer",
    q: 0,
    picks: [],
    revealed: 0,
    hits: null,
    history: []
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
  const roleAt = (i) => (i % 2 === 0 ? S.firstRole : (S.firstRole === "answer" ? "guess" : "answer"));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const buzz = (ms) => { try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(ms); } catch (e) {} };

  function go(screen) {
    S.screen = screen;
    save();
    render();
    window.scrollTo(0, 0);
  }

  // ---------- 画面 ----------
  function render() {
    app.classList.toggle("no-dock", S.screen !== "question");
    if (S.screen === "question") return renderQuestion();
    if (S.screen === "reveal") return renderReveal();
    if (S.screen === "result") return renderResult();
    return renderHome();
  }

  function renderHome() {
    const canResume = S.history.length > 0 && S.history.length < Q.length;
    app.innerHTML = `
      <header class="home-head">
        <h1>価値観ランキング</h1>
        <p>8つの選択肢から1〜3位を選び、同時にめくって見せ合う2人用のゲームです。</p>
      </header>

      <section class="section">
        <h2>あそびかた</h2>
        <ol class="steps">
          <li>2人とも、自分のスマホでこのページを開きます。</li>
          <li>答える人は自分の本音で、当てる人は相手の答えを予想して、1〜3位を選びます。</li>
          <li>2人とも選び終わったら、声をそろえて3位、2位、1位の順にめくります。</li>
          <li>選んだ理由を話し、当たった数を記録します。役はお題ごとに交代します。</li>
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
          <legend>1問目のあなたの役</legend>
          <label class="radio">
            <input type="radio" name="role" value="answer" ${S.firstRole === "answer" ? "checked" : ""}>
            <span><b>答える人</b><small>自分の本音で順位をつける</small></span>
          </label>
          <label class="radio">
            <input type="radio" name="role" value="guess" ${S.firstRole === "guess" ? "checked" : ""}>
            <span><b>当てる人</b><small>相手がつける順位を予想する</small></span>
          </label>
        </fieldset>
        <p class="hint">相手とは別の役を選んでください。2問目からは自動で入れかわります。</p>
      </section>

      <div class="start">
        ${canResume ? `<button class="btn" id="resume">${S.history.length + 1}問目から続ける</button>` : ""}
        <button class="btn ${canResume ? "outline" : ""}" id="start">${canResume ? "最初からはじめる" : "はじめる"}</button>
      </div>
    `;

    const me = app.querySelector("#me");
    const fr = app.querySelector("#friend");
    me.addEventListener("input", () => { S.me = me.value; save(); });
    fr.addEventListener("input", () => { S.friend = fr.value; save(); });
    app.querySelectorAll('input[name="role"]').forEach((r) => {
      r.addEventListener("change", () => { S.firstRole = r.value; save(); });
    });

    app.querySelector("#start").addEventListener("click", () => {
      Object.assign(S, { q: 0, picks: [], revealed: 0, hits: null, history: [] });
      go("question");
    });
    const resume = app.querySelector("#resume");
    if (resume) resume.addEventListener("click", () => {
      Object.assign(S, { q: S.history.length, picks: [], revealed: 0, hits: null });
      go("question");
    });
  }

  function meta() {
    const role = roleAt(S.q);
    const roleText = role === "answer" ? `${esc(meName())}が答える番` : `${esc(meName())}が当てる番`;
    return `
      <div class="q-meta"><span>お題 <b>${S.q + 1}</b> / ${Q.length}</span><b>${roleText}</b></div>
      <div class="progress" aria-hidden="true"><span style="width:${((S.q + 1) / Q.length) * 100}%"></span></div>
    `;
  }

  function renderQuestion() {
    const item = Q[S.q];
    const role = roleAt(S.q);
    const sub = role === "answer"
      ? "本音で、1位から順にタップします。"
      : `${esc(friendName())}が選びそうな順に、1位からタップします。`;
    const left = RANKS - S.picks.length;

    app.innerHTML = `
      ${meta()}
      <div class="q-head">
        <h2>${esc(item.title)}</h2>
        <p class="sub">${sub}</p>
      </div>
      <ul class="opts">
        ${item.options.map((t, i) => {
          const r = S.picks.indexOf(i);
          return `<li><button class="opt ${r >= 0 ? "picked" : ""}" data-i="${i}" aria-pressed="${r >= 0}">
            <span class="label">${esc(t)}</span>
            <span class="rank">${r >= 0 ? `${r + 1}位` : "&nbsp;"}</span>
          </button></li>`;
        }).join("")}
      </ul>
      <p class="sub" style="margin-top:12px">選んだものをもう一度タップすると取り消せます。</p>
      <div class="back-home"><button class="text-btn" id="home">トップに戻る</button></div>

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

    app.querySelectorAll(".opt").forEach((b) => {
      b.addEventListener("click", () => {
        const i = Number(b.dataset.i);
        const at = S.picks.indexOf(i);
        if (at >= 0) S.picks.splice(at, 1);
        else if (S.picks.length < RANKS) S.picks.push(i);
        else return;
        buzz(10);
        save();
        const y = window.scrollY;
        renderQuestion();
        window.scrollTo(0, y);
        const again = app.querySelector(`.opt[data-i="${i}"]`);
        if (again) again.focus({ preventScroll: true });
      });
    });
    app.querySelector("#next").addEventListener("click", () => {
      S.revealed = 0;
      S.hits = null;
      go("reveal");
    });
    app.querySelector("#home").addEventListener("click", () => go("home"));
  }

  function renderReveal() {
    const item = Q[S.q];
    const role = roleAt(S.q);
    const done = S.revealed >= RANKS;
    const nextRank = RANKS - S.revealed; // 3 → 2 → 1
    const talk = TALK[role][S.q % TALK[role].length];
    const guesser = role === "guess" ? meName() : friendName();
    const isLast = S.q === Q.length - 1;

    app.innerHTML = `
      ${meta()}
      <div class="reveal-head">
        <h2>${esc(item.title)}</h2>
      </div>
      <p class="status" role="status">${done
        ? "3つともめくりました。"
        : `相手と同時に、<b>${nextRank}位</b>をめくります。`}</p>

      <ol class="flips">
        ${[1, 2, 3].map((rank) => {
          const label = item.options[S.picks[rank - 1]];
          const open = rank > RANKS - S.revealed;
          const isNext = !done && rank === nextRank;
          return `<li class="${rank === 1 ? "first" : ""}">
            <span class="pos">${rank}位</span>
            <button class="flip ${open ? "open" : ""} ${isNext ? "next" : ""}" data-rank="${rank}" ${isNext ? "" : "disabled"}
              aria-label="${open ? `${rank}位 ${esc(label)}` : isNext ? `${rank}位をめくる` : `${rank}位（まだめくれません）`}">
              <span class="inner">
                <span class="face back">${isNext ? "タップしてめくる" : open ? "" : "裏向き"}</span>
                <span class="face front">${esc(label)}</span>
              </span>
            </button>
          </li>`;
        }).join("")}
      </ol>

      ${done ? `
        <section class="after">
          <h3>話してみよう</h3>
          <p class="talk">${esc(talk)}</p>

          <fieldset class="score">
            <legend>${esc(guesser)}が当てた数</legend>
            <p>順位がちがっても、3位までに入っていれば1つと数えます。</p>
            <div class="segs">
              ${[0, 1, 2, 3].map((n) => `<label><input type="radio" name="hits" value="${n}" ${S.hits === n ? "checked" : ""}><span>${n}</span></label>`).join("")}
            </div>
          </fieldset>

          <div class="next-wrap">
            <button class="btn" id="next" ${S.hits == null ? "disabled" : ""}>${isLast ? "結果を見る" : "次のお題へ"}</button>
          </div>
          <div class="redo"><button class="text-btn" id="redo">順位を選び直す</button></div>
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

    app.querySelectorAll('input[name="hits"]').forEach((r) => {
      r.addEventListener("change", () => {
        S.hits = Number(r.value);
        app.querySelector("#next").disabled = false;
        save();
      });
    });

    const next = app.querySelector("#next");
    if (next) next.addEventListener("click", () => {
      S.history[S.q] = { q: S.q, role, picks: S.picks.slice(), hits: S.hits };
      S.history.length = S.q + 1;
      if (isLast) return go("result");
      S.q += 1;
      S.picks = [];
      S.revealed = 0;
      S.hits = null;
      go("question");
    });
    const redo = app.querySelector("#redo");
    if (redo) redo.addEventListener("click", () => { S.revealed = 0; S.hits = null; go("question"); });
  }

  function renderResult() {
    const hist = S.history.filter(Boolean);
    const total = hist.reduce((a, h) => a + (h.hits || 0), 0);
    const max = hist.length * RANKS || 1;
    const pct = Math.round((total / max) * 100);
    const myHits = hist.filter((h) => h.role === "guess").reduce((a, h) => a + h.hits, 0);
    const frHits = hist.filter((h) => h.role === "answer").reduce((a, h) => a + h.hits, 0);
    const comment =
      pct >= 80 ? "ほとんど言わなくても伝わる2人です。" :
      pct >= 60 ? "かなりお互いのことが分かっています。" :
      pct >= 40 ? "半分くらい当たりました。まだ知らない一面がありそうです。" :
      pct >= 20 ? "意外な答えが多かったようです。話すネタはたくさんあります。" :
      "予想がほとんど外れました。ここから知っていく2人です。";

    app.innerHTML = `
      <header class="result-head">
        <h1>結果</h1>
        <p class="count">${max}個中 <b>${total}個</b> 当たり（${pct}%）</p>
        <p>${comment}</p>
      </header>

      <dl class="tally">
        <div><dt>${esc(meName())}が当てた数</dt><dd>${myHits}</dd></div>
        <div><dt>${esc(friendName())}が当てた数</dt><dd>${frHits}</dd></div>
      </dl>

      <section class="section">
        <h2>${esc(meName())}がつけた順位</h2>
        <ul class="history">
          ${hist.map((h) => {
            const item = Q[h.q];
            return `<li>
              <div class="h-q">${esc(item.title)}</div>
              <div class="h-meta">${h.role === "answer" ? "自分の本音" : `${esc(friendName())}の予想`}／当たり ${h.hits}個</div>
              <ol>${h.picks.map((p, r) => `<li><span class="sub">${r + 1}位</span>　${esc(item.options[p])}</li>`).join("")}</ol>
            </li>`;
          }).join("")}
        </ul>
      </section>

      <div class="result-actions">
        <button class="btn" id="swap">役を入れかえてもう一度</button>
        <button class="btn outline" id="again">トップに戻る</button>
      </div>
    `;

    app.querySelector("#again").addEventListener("click", () => {
      Object.assign(S, { q: 0, picks: [], revealed: 0, hits: null, history: [] });
      go("home");
    });
    app.querySelector("#swap").addEventListener("click", () => {
      S.firstRole = S.firstRole === "answer" ? "guess" : "answer";
      Object.assign(S, { q: 0, picks: [], revealed: 0, hits: null, history: [] });
      go("question");
    });
  }

  if (!Q.length) { app.textContent = "お題がありません（questions.js を確認してください）"; return; }
  if (S.screen !== "home" && !Q[S.q]) S = fresh();
  if (S.screen === "reveal" && S.picks.length < RANKS) S.screen = "question";
  render();
})();
