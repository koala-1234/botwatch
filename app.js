(() => {
  const PAGES_BASE = "https://koala-1234.github.io/botwatch";
  const STAGE_LABEL = { 1: "1 운영자 확인", 2: "2 제보 3명+", 3: "3 확인 중" };
  const STAGE_COLOR = { 1: "#990000", 2: "#666600", 3: "#555555" };
  const SORT_LABEL = { i: "#", handle: "아이디", stage: "단계", appeal: "이의 점수", date: "등록일", updated: "업데이트 날짜" };

  const statusEl = document.getElementById("status");
  const searchEl = document.getElementById("search");
  const dateEl = document.getElementById("date-filter");
  const filterBtns = [...document.querySelectorAll("#filters button")];
  const tabBtns = [...document.querySelectorAll("#tabs button")];
  const botPanel = document.getElementById("bot-panel");
  const humanPanel = document.getElementById("human-panel");
  const humanBody = document.getElementById("human-body");
  const bodyEl = document.getElementById("sheet-body");
  const headBtns = [...document.querySelectorAll("thead [data-sort]")];

  let allRows = [];
  let humans = [];
  let humanSet = new Set();
  let filtered = [];
  let stageFilter = "all";
  let query = "";
  let dateFilter = "all";
  let updateIndex = { dates: [], days: [] };
  let sortKey = "stage";
  let sortDir = "asc";
  let tab = "bot";
  let enhanced = false;

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
    const lead = `매일 ${base}/updates/index.json 을 읽고, 내가 마지막으로 처리한 날짜 이후의 항목만 updates/{날짜}.json 으로 가져와.`;
    const skip = `human_added와 human.txt에 있는 아이디는 사람으로 확인된 계정이니 건너뛰어.`;
    if (kind === "stage1") {
      return `${lead} added와 stage_changed 중에서 stage가 1인 계정만 반영하고, removed는 빼. ${skip}`;
    }
    if (kind === "le2") {
      return `${lead} added와 stage_changed 중에서 stage가 1 또는 2인 계정만 반영하고, removed는 빼. ${skip}`;
    }
    if (kind === "report") {
      return `이 아이디들 skhy@mail.grokbot.com 으로 제목 [봇제보] 붙여서 보내줘`;
    }
    return `${lead} added·removed·stage_changed를 모두 반영하고, ${skip}`;
  }

  function rowsFromTable() {
    if (!bodyEl) return [];
    return [...bodyEl.querySelectorAll("tr[data-handle]")].map((tr, i) => ({
      handle: tr.getAttribute("data-handle") || "",
      stage: Number(tr.getAttribute("data-stage")) || 0,
      appeal_score: Number(tr.getAttribute("data-appeal")) || 0,
      first_reported: tr.getAttribute("data-first") || "",
      updated: tr.getAttribute("data-updated") || "",
      _i: i,
    }));
  }

  function humansFromTable() {
    if (!humanBody) return [];
    return [...humanBody.querySelectorAll("tr[data-handle]")].map((tr) => ({
      handle: tr.getAttribute("data-handle") || "",
      name: (tr.children[1] && tr.children[1].textContent) || "",
      note: (tr.children[2] && tr.children[2].textContent) || "",
    }));
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
    } else if (key === "updated") {
      av = a.updated || "";
      bv = b.updated || "";
    } else if (key === "appeal") {
      av = Number(a.appeal_score) || 0;
      bv = Number(b.appeal_score) || 0;
    } else {
      av = a.first_reported || "";
      bv = b.first_reported || "";
    }
    if (av < bv) return -1;
    if (av > bv) return 1;
    return String(a.handle || "").toLowerCase() < String(b.handle || "").toLowerCase() ? -1 : 0;
  }

  function apply() {
    if (!enhanced && !allRows.length) return;
    const t0 = performance.now();
    const q = query.trim().toLowerCase().replace(/^@/, "");
    filtered = allRows.filter((item) => {
      const handle = String(item.handle || "").replace(/^@/, "");
      if (humanSet.has(handle.toLowerCase())) return false;
      if (stageFilter !== "all" && String(item.stage) !== stageFilter) return false;
      if (dateFilter !== "all" && String(item.updated || "") !== dateFilter) return false;
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
    paint();
    recordPerf(t0, filtered.length);
  }

  function paint() {
    if (!bodyEl || !enhanced) return;
    if (!filtered.length) {
      bodyEl.innerHTML = `<tr><td colspan="6">해당하는 계정이 없습니다.</td></tr>`;
      return;
    }
    let html = "";
    for (let i = 0; i < filtered.length; i++) html += rowHtml(filtered[i], i);
    bodyEl.innerHTML = html;
  }

  function rowHtml(item, i) {
    const handle = String(item.handle || "").replace(/^@/, "");
    const stage = Number(item.stage) || 0;
    const label = STAGE_LABEL[stage] || String(stage);
    const first = escapeHtml(item.first_reported || "—");
    const updated = escapeHtml(item.updated || "—");
    const bg = i % 2 === 1 ? ` bgcolor="#f0f0f0"` : "";
    const color = STAGE_COLOR[stage];
    const stageCell = color
      ? `<font color="${color}">${escapeHtml(label)}</font>`
      : escapeHtml(label);
    const score = Number(item.appeal_score) || 0;
    return `<tr${bg} data-handle="${escapeHtml(handle)}" data-stage="${stage}" data-appeal="${score}" data-first="${first}" data-updated="${updated}">
      <td align="right">${i + 1}</td>
      <td><a href="https://x.com/${encodeURIComponent(handle)}">@${escapeHtml(handle)}</a></td>
      <td>${stageCell}</td>
      <td align="right">${score}</td>
      <td>${first}</td>
      <td>${updated}</td>
    </tr>`;
  }

  function recordPerf(t0, visible) {
    window.__botwatch = {
      count: allRows.length,
      shown: filtered.length,
      visible,
      lastPaintMs: Math.round((performance.now() - t0) * 100) / 100,
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateSortMarks() {
    headBtns.forEach((b) => {
      const key = b.dataset.sort;
      const label = SORT_LABEL[key] || key;
      const on = key === sortKey;
      b.textContent = label + (on ? (sortDir === "asc" ? " ▲" : " ▼") : "");
      b.setAttribute("aria-sort", on ? (sortDir === "asc" ? "ascending" : "descending") : "none");
    });
  }

  function setTab(next) {
    tab = next;
    tabBtns.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    if (botPanel) botPanel.hidden = tab !== "bot";
    if (humanPanel) humanPanel.hidden = tab !== "human";
    if (tab === "human") {
      if (statusEl) statusEl.textContent = `사람 확인 ${humans.length}명 (차단 대상 아님)`;
    } else {
      apply();
    }
  }

  function renderHumans() {
    if (!humanBody || !humans.length) return;
    humanBody.innerHTML = humans
      .map((h) => {
        const handle = String(h.handle || "").replace(/^@/, "");
        return `<tr data-handle="${escapeHtml(handle)}">
          <td><a href="https://x.com/${encodeURIComponent(handle)}">@${escapeHtml(handle)}</a></td>
          <td>${escapeHtml(h.name || "")}</td>
          <td>${escapeHtml(h.note || "")}</td>
        </tr>`;
      })
      .join("");
  }

  function fillDateFilter(rows) {
    if (!dateEl) return;
    const dates = [...new Set(rows.map((r) => r.updated).filter(Boolean))].sort().reverse();
    const current = dateEl.value || "all";
    dateEl.innerHTML = `<option value="all">전체</option>` + dates.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
    dateEl.value = dates.includes(current) ? current : "all";
    dateFilter = dateEl.value;
  }

  function renderUpdateLog(index) {
    const log = document.getElementById("update-log");
    if (!log) return;
    const days = Array.isArray(index && index.days) ? index.days : [];
    if (!days.length) return;
    log.innerHTML = days
      .map((d) => {
        const date = String(d.date || "");
        const counts = `추가 ${d.added || 0} · 삭제 ${d.removed || 0} · 단계변경 ${d.stage_changed || 0} · 사람 확인 +${d.human_added || 0} / −${d.human_removed || 0} · 이의변경 ${d.appeal_changed || 0}`;
        return `<li><b>${escapeHtml(date)}</b> — ${counts} — <a href="./updates/${encodeURIComponent(date)}.json">json</a>, <a href="./updates/${encodeURIComponent(date)}.txt">txt</a></li>`;
      })
      .join("");
  }

  function enhanceFromDom() {
    const baked = rowsFromTable();
    if (!baked.length) return false;
    allRows = baked;
    if (!humans.length) humans = humansFromTable();
    humanSet = new Set(humans.map((h) => String(h.handle || "").replace(/^@/, "").toLowerCase()));
    allRows = allRows.filter((item) => !humanSet.has(String(item.handle || "").replace(/^@/, "").toLowerCase()));
    enhanced = true;
    fillDateFilter(allRows);
    updateSortMarks();
    apply();
    return true;
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      stageFilter = btn.dataset.stage || "all";
      filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      apply();
    });
  });

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab || "bot"));
  });

  if (searchEl) {
    searchEl.addEventListener("input", () => {
      query = searchEl.value;
      apply();
    });
  }
  if (dateEl) {
    dateEl.addEventListener("change", () => {
      dateFilter = dateEl.value || "all";
      apply();
    });
  }

  headBtns.forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const key = btn.dataset.sort || "handle";
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = key === "date" || key === "updated" ? "desc" : "asc";
      }
      updateSortMarks();
      apply();
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
  enhanceFromDom();

  Promise.all([
    fetch("./list.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch("./human.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch("./human.txt", { cache: "no-store" }).then((r) => (r.ok ? r.text() : "")).catch(() => ""),
    fetch("./updates/index.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([data, humanJson, humanTxt, idx]) => {
    const fromTxt = String(humanTxt || "").split(/\s+/).map((s) => s.replace(/^@/, "").trim()).filter(Boolean);
    if (Array.isArray(humanJson) && humanJson.length) humans = humanJson;
    humanSet = new Set([
      ...humans.map((h) => String(h.handle || "").replace(/^@/, "").toLowerCase()),
      ...fromTxt.map((h) => h.toLowerCase()),
    ]);
    if (Array.isArray(data) && data.length) {
      allRows = data
        .filter((item) => !humanSet.has(String(item.handle || "").replace(/^@/, "").toLowerCase()))
        .map((item, i) => Object.assign({ _i: i }, item));
      enhanced = true;
    }
    if (idx && typeof idx === "object") {
      updateIndex = idx;
      renderUpdateLog(updateIndex);
    }
    if (humans.length) renderHumans();
    if (allRows.length) {
      fillDateFilter(allRows);
      updateSortMarks();
      apply();
    }
    window.__botwatch = Object.assign(window.__botwatch || {}, {
      loadMs: Math.round((performance.now() - tLoad) * 100) / 100,
    });
  }).catch(() => {
    // Keep the baked table as-is if extra files fail.
  });
})();
