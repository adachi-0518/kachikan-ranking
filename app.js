(() => {
  "use strict";

  const Q = window.QUESTIONS || [];
  const RANKS = 3;
  const STORE_KEY = "kachikan-ranking-v1";
  const app = document.getElementById("app");

  const TALK = {
    answer: [
      "1位を選んだ理由を話してみよう",
      "3位と4位の差はなんだった？",
      "逆に絶対選ばないのはどれ？",
      "昔の自分なら何を1位にしてた？",
      "迷ったのはどれとどれ？",
      "1位、いつからそう思ってる？"
    ],
    guess: [
      "なんでそう予想した？",
      "当たってた？意外だったのはどれ？",
      "相手のどこを見てそう思った？",
      "自分ならどれを1位にする？",
      "いちばん自信あったのはどれ？",
      "外れたやつ、理由を聞いてみよう"
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

  function go(screen) {
    S.screen = screen;
    save();
    render();
    window.scrollTo(0, 0);
  }

  // ---------- 画面 ----------
  function render() {
    if (S.screen === "question") return renderQuestion();
    if (S.screen === "reveal") return renderReveal();
    if (S.screen === "result") return renderResult();
    return renderHome();
  }

  function renderHome() {
    const canResume = S.history.length > 0 && S.history.length < Q.length;
    app.innerHTML = `
      <section class="hero">
        <div class="cards-deco" aria-hidden="true">🃏🂠🃏</div>
        <h1>価値観ランキング</h1>
        <p>8つの中から1〜3位。相手の答え、当てられる？</p>
      </section>

      <section class="panel">
        <h2>あそびかた</h2>
        <ol class="steps">
          <li>2人とも自分のスマホでこのページを開く</li>
          <li>「答える人」は本音で、「当てる人」は相手の答えを予想して1〜3位を選ぶ</li>
          <li>せーので3位 → 2位 → 1位の順にタップしてめくる</li>
          <li>「なんでそれ選んだ？」で話そう。役はお題ごとに交代</li>
        </ol>
      </section>

      <section class="panel">
        <h2>名前（なくてもOK）</h2>
        <div class="field">
          <div><label for="me">自分</label><input id="me" maxlength="10" placeholder="あなた" value="${esc(S.me)}"></div>
          <div><label for="friend">相手</label><input id="friend" maxlength="10" placeholder="相手" value="${esc(S.friend)}"></div>
        </div>
      </section>

      <section class="panel">
        <h2>1問目、あなたは？</h2>
        <div class="choice" role="group">
          <button data-role="answer" aria-pressed="${S.firstRole === "answer"}"><b>🙋 答える人</b><small>自分の本音を選ぶ</small></button>
          <button data-role="guess" aria-pressed="${S.firstRole === "guess"}"><b>🔮 当てる人</b><small>相手の答えを予想</small></button>
        </div>
        <p class="note">相手とは逆を選んでね。2問目からは自動で交代します。</p>
      </section>

      <button class="btn" id="start">${canResume ? "最初からはじめる" : "はじめる"}</button>
      ${canResume ? `<button class="btn ghost" id="resume">続きから（${S.history.length + 1}問目）</button>` : ""}
    `;

    const me = app.querySelector("#me");
    const fr = app.querySelector("#friend");
    me.addEventListener("input", () => { S.me = me.value; save(); });
    fr.addEventListener("input", () => { S.friend = fr.value; save(); });

    app.querySelectorAll("[data-role]").forEach((b) => {
      b.addEventListener("click", () => {
        S.firstRole = b.dataset.role;
        app.querySelectorAll("[data-role]").forEach((x) => x.setAttribute("aria-pressed", x === b));
        save();
      });
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

  function dots() {
    return `<div class="dots" aria-hidden="true">${Q.map((_, i) =>
      `<span class="${i < S.q ? "done" : i === S.q ? "now" : ""}"></span>`).join("")}</div>`;
  }

  function roleChip(role) {
    return role === "answer"
      ? `<span class="role answer">🙋 ${esc(meName())}が答える番</span>`
      : `<span class="role guess">🔮 ${esc(meName())}が当てる番</span>`;
  }

  function renderQuestion() {
    const item = Q[S.q];
    const role = roleAt(S.q);
    const sub = role === "answer"
      ? `本音で1〜3位を選んでね（タップした順）`
      : `${esc(friendName())}の1〜3位を予想してね（タップした順）`;

    app.innerHTML = `
      <div class="topbar">
        <span>お題 ${S.q + 1} / ${Q.length}</span>
        ${dots()}
      </div>
      ${roleChip(role)}
      <h2 class="q-title">${esc(item.title)}</h2>
      <p class="q-sub">${sub}</p>
      <div class="grid">
        ${item.options.map((o, i) => {
          const r = S.picks.indexOf(i);
          return `<button class="opt ${r >= 0 ? "picked" : ""}" data-i="${i}" aria-label="${esc(o.t)}${r >= 0 ? `（${r + 1}位）` : ""}">
            ${r >= 0 ? `<span class="badge rank-${r + 1}">${r + 1}位</span>` : ""}
            <span class="emoji">${o.e}</span>
            <span class="label">${esc(o.t)}</span>
          </button>`;
        }).join("")}
      </div>
      <p style="text-align:center;margin-top:14px">
        <button class="small-link" id="home">トップへ戻る</button>
      </p>

      <div class="dock"><div class="dock-inner">
        <div class="slots">
          ${[0, 1, 2].map((r) => {
            const idx = S.picks[r];
            const o = idx != null ? item.options[idx] : null;
            return `<div class="slot ${o ? "filled s" + (r + 1) : ""}">
              <span class="n">${r + 1}位</span>
              <span class="v">${o ? o.e + " " + esc(o.t) : "—"}</span>
            </div>`;
          }).join("")}
        </div>
        <button class="btn" id="next" ${S.picks.length < RANKS ? "disabled" : ""}>
          ${S.picks.length < RANKS ? `あと${RANKS - S.picks.length}つ選んでね` : "決定！めくる画面へ"}
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
        if (navigator.vibrate) navigator.vibrate(10);
        save();
        renderQuestion();
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
      <div class="topbar">
        <span>お題 ${S.q + 1} / ${Q.length}</span>
        ${dots()}
      </div>
      <div class="reveal-head">
        ${roleChip(role)}
        <h2>${esc(item.title)}</h2>
        <p>${done ? "全部めくれた！" : `せーので <b>${nextRank}位</b> をタップ！`}</p>
      </div>

      <div class="flip-list">
        ${[1, 2, 3].map((rank) => {
          const o = item.options[S.picks[rank - 1]];
          const open = rank > RANKS - S.revealed;
          const isNext = !done && rank === nextRank;
          return `<button class="flip r${rank} ${open ? "open" : ""} ${isNext ? "next" : ""}" data-rank="${rank}" ${isNext ? "" : "disabled"}
              aria-label="${open ? `${rank}位 ${esc(o.t)}` : `${rank}位（タップでめくる）`}">
            <span class="inner">
              <span class="face back"><span>${rank}位</span><span class="q">？</span></span>
              <span class="face front">
                <span class="medal rank-${rank}">${rank}位</span>
                <span class="emoji">${o.e}</span>
                <span class="label">${esc(o.t)}</span>
              </span>
            </span>
          </button>`;
        }).join("")}
      </div>

      ${done ? `
        <section class="after">
          <div class="talk">
            <div class="t-label">TALK</div>
            <div class="t-text">${esc(talk)}</div>
          </div>
          <div class="score-q">
            ${esc(guesser)}はいくつ当てた？
            <small>順位がズレていても、3位までに入っていれば1つ</small>
          </div>
          <div class="nums" role="group">
            ${[0, 1, 2, 3].map((n) => `<button data-n="${n}" aria-pressed="${S.hits === n}">${n}</button>`).join("")}
          </div>
          <button class="btn" id="next" ${S.hits == null ? "disabled" : ""}>${isLast ? "結果を見る" : "次のお題へ"}</button>
          <p style="text-align:center;margin-top:6px">
            <button class="small-link" id="redo">選び直す</button>
          </p>
        </section>
      ` : ""}
    `;

    const btn = app.querySelector(".flip.next");
    if (btn) btn.addEventListener("click", () => {
      btn.classList.add("open");
      btn.disabled = true;
      if (navigator.vibrate) navigator.vibrate(20);
      S.revealed += 1;
      save();
      const finished = S.revealed >= RANKS;
      if (finished) burst();
      setTimeout(renderReveal, finished ? 700 : 620);
    });

    app.querySelectorAll("[data-n]").forEach((b) => {
      b.addEventListener("click", () => {
        S.hits = Number(b.dataset.n);
        app.querySelectorAll("[data-n]").forEach((x) => x.setAttribute("aria-pressed", x === b));
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
    const total = S.history.reduce((a, h) => a + (h ? h.hits || 0 : 0), 0);
    const max = S.history.filter(Boolean).length * RANKS || 1;
    const pct = Math.round((total / max) * 100);
    const myHits = S.history.filter((h) => h && h.role === "guess").reduce((a, h) => a + h.hits, 0);
    const frHits = S.history.filter((h) => h && h.role === "answer").reduce((a, h) => a + h.hits, 0);
    const comment =
      pct >= 80 ? "以心伝心！もはや同一人物" :
      pct >= 60 ? "かなり分かり合えてる！" :
      pct >= 40 ? "いい感じ。まだ発見がありそう" :
      pct >= 20 ? "意外な一面だらけ。話のネタが多い！" :
      "お互いのこと、これから知っていこう";

    app.innerHTML = `
      <section class="result-hero">
        <div class="label">2人のシンクロ率</div>
        <div class="big">${pct}<small>%</small></div>
        <div class="comment">${comment}</div>
      </section>

      <div class="vs">
        <div><span>${esc(meName())}が当てた数</span><b>${myHits}</b></div>
        <div><span>${esc(friendName())}が当てた数</span><b>${frHits}</b></div>
      </div>

      <section class="panel">
        <h2>${esc(meName())}が選んだランキング</h2>
        <ul class="history">
          ${S.history.filter(Boolean).map((h) => {
            const item = Q[h.q];
            return `<li>
              <div class="h-q">${esc(item.title)}</div>
              <div class="h-role">${h.role === "answer" ? "🙋 自分の本音" : `🔮 ${esc(friendName())}を予想`}・当たり ${h.hits}/3</div>
              <div class="h-picks">${h.picks.map((p, r) => `<span>${r + 1}位 ${item.options[p].e} ${esc(item.options[p].t)}</span>`).join("")}</div>
            </li>`;
          }).join("")}
        </ul>
      </section>

      <button class="btn" id="again">もう一回あそぶ</button>
      <button class="btn ghost" id="swap">役を入れかえてもう一回</button>
    `;
    burst();

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

  function burst() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#e2583e", "#e9a92b", "#4f7890", "#9aa3ad", "#c07a4a", "#7bb662"];
    const wrap = document.createElement("div");
    wrap.className = "burst";
    for (let i = 0; i < 36; i++) {
      const p = document.createElement("i");
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * 200;
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--x", `${Math.cos(a) * d}px`);
      p.style.setProperty("--y", `${Math.sin(a) * d + 120}px`);
      p.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
      p.style.animationDelay = `${Math.random() * 0.1}s`;
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 1400);
  }

  if (!Q.length) { app.textContent = "お題がありません（questions.js を確認してください）"; return; }
  if (S.screen !== "home" && !Q[S.q]) S = fresh();
  if (S.screen === "reveal" && S.picks.length < RANKS) S.screen = "question";
  render();
})();
