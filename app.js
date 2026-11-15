(() => {
  const STAGE_LABEL = {
    1: "1단계 확인 중",
    2: "2단계 주의",
    3: "3단계 위험",
  };

  const listEl = document.getElementById("list");
  const statusEl = document.getElementById("status");
  const searchEl = document.getElementById("search");
  const filterBtns = [...document.querySelectorAll(".filters button")];
  const routineEl = document.getElementById("routine-prompt");
  const jsonLink = document.getElementById("json-url");
  const txtLink = document.getElementById("txt-url");

  let rows = [];
  let stageFilter = "all";
  let query = "";

  const PAGES_BASE = "https://koala-1234.github.io/botwatch";

  function listBase() {
    const host = location.hostname;
    const local = host === "localhost" || host === "127.0.0.1" || host === "";
    if (location.protocol.startsWith("http") && !local) {
      // Directory of this page so project Pages under /botwatch/ resolve correctly
      return new URL("./", location.href).href.replace(/\/$/, "");
    }
    return PAGES_BASE;
  }

  function fillBotUrls() {
    const base = listBase();
    if (jsonLink) {
      jsonLink.href = "./list.json";
      jsonLink.textContent = `${base}/list.json`;
    }
    if (txtLink) {
      txtLink.href = "./list.txt";
      txtLink.textContent = `${base}/list.txt`;
    }
    if (routineEl) {
      routineEl.textContent =
        `매일 아침 ${base}/list.json 을 읽고 stage 3인 계정 중 새로 올라온 것만 알려줘. 알려줄 때는 아이디, 이유, 근거 링크를 함께 적어줘.`;
    }
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
      statusEl.textContent = total
        ? `표시 ${shown}건 / 전체 ${total}건`
        : "목록을 불러오는 중";
    }

    if (!filtered.length) {
      listEl.innerHTML = `<p class="empty">해당하는 계정이 없습니다.</p>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((item) => {
        const handle = String(item.handle || "").replace(/^@/, "");
        const stage = Number(item.stage) || 0;
        const label = STAGE_LABEL[stage] || `${stage}단계`;
        const reason = escapeHtml(item.reason || "");
        const evidence = item.evidence_url
          ? `<a href="${escapeAttr(item.evidence_url)}" rel="noopener noreferrer">근거 게시물</a>`
          : "근거 없음";
        const first = escapeHtml(item.first_reported || "—");
        const updated = escapeHtml(item.updated || "—");
        const ex = isExample(handle)
          ? ` <span class="badge ex">예시 데이터</span>`
          : "";
        const count = item.reporters_count != null ? `제보 ${item.reporters_count}명` : "";
        return `<article class="row stage-${stage}">
          <div class="row-top">
            <div class="handle"><a href="https://x.com/${encodeURIComponent(handle)}" rel="noopener noreferrer">@${escapeHtml(handle)}</a>${ex}</div>
            <div class="row-stage"><span class="badge s${stage}">${label}</span>${count ? `<span>${count}</span>` : ""}</div>
          </div>
          <p class="reason">${reason}</p>
          <div class="meta">${evidence} · 최초 ${first} · 갱신 ${updated}</div>
        </article>`;
      })
      .join("");
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
        setTimeout(() => {
          btn.textContent = prev;
        }, 1200);
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
