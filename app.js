(() => {
  const PAGES_BASE = "https://koala-1234.github.io/botwatch";
  const STAGE_LABEL = {
    1: "1 확인 중",
    2: "2 주의",
    3: "3 위험",
  };

  const listEl = document.getElementById("list");
  const statusEl = document.getElementById("status");
  const searchEl = document.getElementById("search");
  const filterBtns = [...document.querySelectorAll(".filters button")];

  let rows = [];
  let stageFilter = "all";
  let query = "";

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
      const href = "./" + file;
      if (el.tagName === "A") {
        el.href = href;
        el.textContent = `${base}/${file}`;
      } else {
        el.textContent = `${base}/${file}`;
      }
    });
    document.querySelectorAll("[data-routine]").forEach((el) => {
      const kind = el.getAttribute("data-routine");
      el.textContent = routineText(base, kind);
    });
  }

  function routineText(base, kind) {
    if (kind === "stage3") {
      return `매일 아침 ${base}/stage3.txt 을 읽고, 한 줄에 하나인 아이디 중에서 이전에 알려준 적 없는 계정만 알려줘.`;
    }
    if (kind === "ge2") {
      return `매일 아침 ${base}/ge2.txt 을 읽고, 한 줄에 하나인 아이디 중에서 이전에 알려준 적 없는 계정만 알려줘. 이 파일은 2단계 이상(주의·위험)이다.`;
    }
    return `매일 아침 ${base}/list.json 을 읽고, 새로 올라온 계정만 단계, 이유, 근거 링크와 함께 알려줘.`;
  }

  function isExample(handle) {
    return /^example_/i.test(handle);
  }

  function render() {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    const filtered = rows.filter((item) => {
      if (stageFilter !== "all" && String(item.stage) !== stageFilter) return false;
      if (!q) return true;
      const hay = [item.handle, item.reason, String(item.stage)].join(" ").toLowerCase();
      return hay.includes(q);
    });

    const total = rows.length;
    const shown = filtered.length;
    if (statusEl) {
      statusEl.textContent = total ? `표시 ${shown}건 / 전체 ${total}건` : "목록을 불러오는 중";
    }

    if (!filtered.length) {
      listEl.innerHTML = `<p class="empty">해당하는 계정이 없습니다.</p>`;
      return;
    }

    const body = filtered
      .map((item) => {
        const handle = String(item.handle || "").replace(/^@/, "");
        const stage = Number(item.stage) || 0;
        const label = STAGE_LABEL[stage] || `${stage}`;
        const reason = escapeHtml(item.reason || "");
        const evidence = item.evidence_url
          ? `<a href="${escapeAttr(item.evidence_url)}" rel="noopener noreferrer">근거</a>`
          : "—";
        const ex = isExample(handle) ? ` <span class="badge ex">예시</span>` : "";
        const title = escapeAttr(
          `@${handle} · ${label}` + (item.reason ? ` · ${item.reason}` : "")
        );
        return `<div class="row stage-${stage}" title="${title}">
          <div class="handle"><a href="https://x.com/${encodeURIComponent(handle)}" rel="noopener noreferrer">@${escapeHtml(handle)}</a>${ex}</div>
          <div class="col-stage"><span class="badge s${stage}">${label}</span></div>
          <p class="reason">${reason}</p>
          <div class="col-link">${evidence}</div>
        </div>`;
      })
      .join("");

    listEl.innerHTML = `<div class="table" role="table" aria-label="제보 목록">
      <div class="thead" role="row">
        <div>아이디</div><div>단계</div><div>이유</div><div>근거</div>
      </div>
      ${body}
    </div>`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      stageFilter = btn.dataset.stage || "all";
      filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      render();
    });
  });

  if (searchEl) {
    searchEl.addEventListener("input", () => {
      query = searchEl.value;
      render();
    });
  }

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

  fetch("./list.json", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("목록을 불러오지 못했습니다.");
      return res.json();
    })
    .then((data) => {
      rows = Array.isArray(data) ? data : [];
      render();
    })
    .catch((err) => {
      listEl.innerHTML = `<p class="error">${escapeHtml(err.message || "목록을 불러오지 못했습니다.")}</p>`;
      if (statusEl) statusEl.textContent = "불러오기 실패";
    });
})();
