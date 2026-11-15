(() => {
  const PAGES_BASE = "https://koala-1234.github.io/botwatch";
  const ROW_H = 24;
  const OVERSCAN = 16;
  const STAGE_LABEL = { 1: "1 확인 중", 2: "2 주의", 3: "3 위험" };

  const statusEl = document.getElementById("status");
  const searchEl = document.getElementById("search");
  const filterBtns = [...document.querySelectorAll(".filters button")];
  const tabBtns = [...document.querySelectorAll(".tabs button")];
  const botPanel = document.getElementById("bot-panel");
  const humanPanel = document.getElementById("human-panel");
  const humanBody = document.getElementById("human-body");
  const sheet = document.getElementById("sheet");
  const bodyEl = document.getElementById("sheet-body");
  const canvasEl = document.getElementById("sheet-canvas");
  const windowEl = document.getElementById("sheet-window");
  const headBtns = [...document.querySelectorAll(".sheet-head [data-sort]")];
  const exampleBanner = document.getElementById("example-banner");

  let allRows = [];
  let humans = [];
  let humanSet = new Set();
  let filtered = [];
  let stageFilter = "all";
  let query = "";
  let sortKey = "handle";
  let sortDir = "asc";
  let tab = "bot";
  let raf = 0;

  function listBase() {
    const host = location.hostname;
    const local = host === "localhost" || host === "127.0.0.1" || host === "";
    if (location.protocol.startsWith("http") && !local) {
      return new URL("./", location.href).href.replace(/\/$/, "");
    }
    return PAGES_BASE;
  }

  function fillBotUrls() {
    const base = listBase();
    document.querySelectorAll("[data-file-url]").forEach((el) => {
      const file = el.getAttribute("data-file-url");
      if (el.tagName === "A") {
        el.href = "./" + file;
        el.textContent = `${base}/${file}`;
      } else {
        el.textContent = `${base}/${file}`;
      }
    });
    document.querySelectorAll("[data-routine]").forEach((el) => {
      el.textContent = routineText(base, el.getAttribute("data-routine"));
    });
  }

  function routineText(base, kind) {
    const skip = `같은 주소의 ${base}/human.txt 에 있는 아이디는 사람으로 확인된 계정이니 건너뛰어.`;
    if (kind === "stage3") {
      return `매일 아침 ${base}/stage3.txt 을 읽고, 한 줄에 하나인 아이디 중에서 이전에 알려준 적 없는 계정만 알려줘. ${skip}`;
    }
    if (kind === "ge2") {
      return `매일 아침 ${base}/ge2.txt 을 읽고, 한 줄에 하나인 아이디 중에서 이전에 알려준 적 없는 계정만 알려줘. 이 파일은 2단계 이상(주의·위험)이다. ${skip}`;
    }
    if (kind === "report") {
      return `이 아이디들 skhy@mail.grokbot.com 으로 제목 [봇제보] 붙여서 보내줘`;
    }
    return `매일 아침 ${base}/list.json 을 읽고, 새로 올라온 계정만 단계와 함께 알려줘. ${skip}`;
  }

  function cmp(a, b, key) {
    let av, bv;
    if (key === "i") {
      av = a._i;
      bv = b._i;
    } else if (key === "handle") {
      av = String(a.handle || "").toLowerCase();
      bv = String(b.handle || "").toLowerCase();
    } else if (key === "stage") {
      av = Number(a.stage) || 0;
      bv = Number(b.stage) || 0;
    } else {
      av = a.first_reported || "";
      bv = b.first_reported || "";
    }
    if (av < bv) return -1;
    if (av > bv) return 1;
    return String(a.handle || "").toLowerCase() < String(b.handle || "").toLowerCase() ? -1 : 0;
  }

  function apply() {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    filtered = allRows.filter((item) => {
      const handle = String(item.handle || "").replace(/^@/, "");
      if (humanSet.has(handle.toLowerCase())) return false;
      if (stageFilter !== "all" && String(item.stage) !== stageFilter) return false;
      if (q && !handle.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sortDir === "desc" ? -1 : 1;
    filtered.sort((a, b) => dir * cmp(a, b, sortKey));
    if (statusEl && tab === "bot") {
      statusEl.textContent = allRows.length
        ? `표시 ${filtered.length}건 / 전체 ${allRows.length}건`
        : "목록을 불러오는 중";
    }
    layoutSheet();
  }

  function layoutSheet() {
    if (!bodyEl || tab !== "bot") return;
    const extras = document.querySelector(".extras");
    const footer = document.querySelector("footer");
    const top = bodyEl.getBoundingClientRect().top;
    const extraH = (extras ? extras.offsetHeight : 0) + (footer ? footer.offsetHeight : 0) + 16;
    const avail = Math.max(ROW_H * 6, window.innerHeight - top - extraH);
    const needed = filtered.length * ROW_H;
    bodyEl.style.height = Math.min(Math.max(needed, ROW_H), avail) + "px";
    canvasEl.style.height = needed + "px";
    paint();
  }

  function paint() {
    const t0 = performance.now();
    if (!filtered.length) {
      windowEl.style.transform = "translateY(0)";
      windowEl.innerHTML = `<div class="empty">해당하는 계정이 없습니다.</div>`;
      canvasEl.style.height = "40px";
      recordPerf(t0, 0);
      return;
    }
    const scrollTop = bodyEl.scrollTop;
    const viewH = bodyEl.clientHeight || 0;
    const n = filtered.length;
    const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
    const end = Math.min(n, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);
    windowEl.style.transform = `translateY(${start * ROW_H}px)`;
    let html = "";
    for (let i = start; i < end; i++) {
      html += rowHtml(filtered[i], i);
    }
    windowEl.innerHTML = html;
    recordPerf(t0, end - start);
  }

  function rowHtml(item, i) {
    const handle = String(item.handle || "").replace(/^@/, "");
    const stage = Number(item.stage) || 0;
    const label = STAGE_LABEL[stage] || String(stage);
    const date = escapeHtml(item.first_reported || "—");
    const odd = i % 2 === 1 ? " odd" : "";
    return `<div class="sheet-row${odd}" style="height:${ROW_H}px">
      <div class="col-num">${i + 1}</div>
      <div class="handle"><a href="https://x.com/${encodeURIComponent(handle)}" rel="noopener noreferrer">@${escapeHtml(handle)}</a></div>
      <div><span class="badge s${stage}">${label}</span></div>
      <div class="col-date">${date}</div>
    </div>`;
  }

  function recordPerf(t0, visible) {
    const ms = performance.now() - t0;
    window.__botwatch = {
      count: allRows.length,
      shown: filtered.length,
      visible,
      lastPaintMs: Math.round(ms * 100) / 100,
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setTab(next) {
    tab = next;
    tabBtns.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    if (botPanel) botPanel.hidden = tab !== "bot";
    if (humanPanel) {
      humanPanel.hidden = tab !== "human";
      humanPanel.classList.toggle("on", tab === "human");
    }
    if (tab === "human") {
      if (statusEl) statusEl.textContent = `사람 확인 ${humans.length}명 (차단 대상 아님)`;
    } else {
      apply();
    }
  }

  function renderHumans() {
    if (!humanBody) return;
    if (!humans.length) {
      humanBody.innerHTML = `<p class="empty">확인된 계정이 없습니다.</p>`;
      return;
    }
    const rows = humans
      .map((h) => {
        const handle = String(h.handle || "").replace(/^@/, "");
        return `<tr>
          <td class="handle"><a href="https://x.com/${encodeURIComponent(handle)}" rel="noopener noreferrer">@${escapeHtml(handle)}</a></td>
          <td>${escapeHtml(h.name || "")}</td>
          <td>${escapeHtml(h.note || "")}</td>
        </tr>`;
      })
      .join("");
    humanBody.innerHTML = rows;
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      stageFilter = btn.dataset.stage || "all";
      filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      if (bodyEl) bodyEl.scrollTop = 0;
      apply();
    });
  });

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab || "bot"));
  });

  if (searchEl) {
    searchEl.addEventListener("input", () => {
      query = searchEl.value;
      if (bodyEl) bodyEl.scrollTop = 0;
      apply();
    });
  }

  headBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.sort || "handle";
      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDir = key === "stage" || key === "date" ? "desc" : "asc";
      }
      headBtns.forEach((b) => {
        b.setAttribute("aria-sort", b.dataset.sort === sortKey ? (sortDir === "asc" ? "ascending" : "descending") : "none");
      });
      if (bodyEl) bodyEl.scrollTop = 0;
      apply();
    });
  });

  if (bodyEl) {
    bodyEl.addEventListener("scroll", () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        paint();
      });
    }, { passive: true });
  }
  window.addEventListener("resize", () => {
    if (tab === "bot") layoutSheet();
  });
  document.querySelectorAll("details.block").forEach((d) => {
    d.addEventListener("toggle", () => {
      if (tab === "bot") layoutSheet();
    });
  });

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const sel = btn.getAttribute("data-copy");
      const node = sel ? document.querySelector(sel) : null;
      const text = node ? node.textContent : "";
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = "복사됨";
        setTimeout(() => { btn.textContent = prev; }, 1200);
      } catch {
        btn.textContent = "복사 실패";
      }
    });
  });

  fillBotUrls();

  const tLoad = performance.now();
  Promise.all([
    fetch("./list.json", { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("목록을 불러오지 못했습니다.");
      return r.json();
    }),
    fetch("./human.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch("./human.txt", { cache: "no-store" }).then((r) => (r.ok ? r.text() : "")).catch(() => ""),
  ])
    .then(([data, humanJson, humanTxt]) => {
      humans = Array.isArray(humanJson) ? humanJson : [];
      const fromTxt = String(humanTxt || "")
        .split(/\s+/)
        .map((s) => s.replace(/^@/, "").trim())
        .filter(Boolean);
      humanSet = new Set([
        ...humans.map((h) => String(h.handle || "").replace(/^@/, "").toLowerCase()),
        ...fromTxt.map((h) => h.toLowerCase()),
      ]);
      const raw = Array.isArray(data) ? data : [];
      allRows = raw
        .filter((item) => !humanSet.has(String(item.handle || "").replace(/^@/, "").toLowerCase()))
        .map((item, i) => Object.assign({ _i: i }, item));
      if (exampleBanner) {
        const onlyEx = allRows.length && allRows.every((r) => /^example_/i.test(r.handle || ""));
        exampleBanner.hidden = !onlyEx;
      }
      renderHumans();
      headBtns.forEach((b) => {
        b.setAttribute("aria-sort", b.dataset.sort === sortKey ? "ascending" : "none");
      });
      apply();
      window.__botwatch = Object.assign(window.__botwatch || {}, {
        loadMs: Math.round((performance.now() - tLoad) * 100) / 100,
      });
    })
    .catch((err) => {
      if (windowEl) windowEl.innerHTML = `<div class="error">${escapeHtml(err.message || "목록을 불러오지 못했습니다.")}</div>`;
      if (statusEl) statusEl.textContent = "불러오기 실패";
    });
})();
