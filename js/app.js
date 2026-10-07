(function () {
  const data = window.FIT_DATA;
  const checkKey = "fit-for-me-checks-v3";
  const patternKey = "fit-for-me-pattern-v2";
  const weekdayIds = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const calWeekLabels = ["一", "二", "三", "四", "五", "六", "日"];

  const els = {
    week: document.getElementById("week"),
    session: document.getElementById("sessionView"),
    progress: document.getElementById("progressView"),
    stats: document.getElementById("statsView"),
    patternToggle: document.getElementById("patternToggle"),
    main: document.getElementById("mainView"),
    nav: document.querySelectorAll(".nav-btn"),
  };

  let currentDay = pickTodayId();
  let currentTab = "today";
  let patternId = localStorage.getItem(patternKey) || "aba";
  let checks = loadChecks();
  let statsCursor = startOfMonth(new Date());

  function pickTodayId() {
    return weekdayIds[new Date().getDay()];
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function todayStr() {
    return formatDate(new Date());
  }

  /** Map week-strip weekday to a real calendar date in the week containing today. */
  function dateForWeekday(dayId) {
    const target = weekdayIds.indexOf(dayId);
    const now = new Date();
    const diff = target - now.getDay();
    return formatDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff));
  }

  function loadChecks() {
    try {
      return JSON.parse(localStorage.getItem(checkKey) || "{}");
    } catch {
      return {};
    }
  }

  function saveChecks() {
    localStorage.setItem(checkKey, JSON.stringify(checks));
  }

  function isChecked(dateStr, kind, index) {
    const day = checks[dateStr];
    return !!(day && day[`${kind}-${index}`]);
  }

  function setChecked(dateStr, kind, index, value) {
    if (!checks[dateStr]) checks[dateStr] = {};
    const key = `${kind}-${index}`;
    if (value) checks[dateStr][key] = true;
    else delete checks[dateStr][key];
    if (checks[dateStr] && Object.keys(checks[dateStr]).length === 0) {
      delete checks[dateStr];
    }
    saveChecks();
  }

  function countForDate(dateStr) {
    const day = checks[dateStr];
    if (!day) return 0;
    return Object.values(day).filter(Boolean).length;
  }

  function totalCompleted() {
    return Object.keys(checks).reduce((sum, dateStr) => sum + countForDate(dateStr), 0);
  }

  function dayKind(dayId) {
    return data.patterns[patternId].days[dayId];
  }

  function dayShort(kind) {
    if (kind === "A") return "A";
    if (kind === "B") return "B";
    if (kind === "cardio") return "氧";
    return "休";
  }

  function dayNameShort(id) {
    return data.dayNames[id].replace("周", "");
  }

  function dayType(kind) {
    if (kind === "A" || kind === "B") return "train";
    if (kind === "cardio") return "cardio";
    return "rest";
  }

  function pulseMain() {
    if (!els.main) return;
    els.main.classList.remove("is-entering");
    void els.main.offsetWidth;
    els.main.classList.add("is-entering");
  }

  function renderPatternToggle() {
    const p = data.patterns[patternId];
    els.patternToggle.innerHTML = `
      <div class="pattern-bar">
        <button type="button" class="pattern-btn ${patternId === "aba" ? "active" : ""}" data-p="aba">A / B / A</button>
        <button type="button" class="pattern-btn ${patternId === "bab" ? "active" : ""}" data-p="bab">B / A / B</button>
      </div>
      <p class="pattern-hint">${p.hint}</p>`;

    els.patternToggle.querySelectorAll(".pattern-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        patternId = btn.dataset.p;
        localStorage.setItem(patternKey, patternId);
        render({ animate: true });
      });
    });
  }

  function renderWeek() {
    els.week.innerHTML = Object.keys(data.dayNames)
      .map((id) => {
        const kind = dayKind(id);
        return `
        <button class="day-btn ${id === currentDay ? "active" : ""}" data-day="${id}" data-type="${dayType(kind)}" type="button">
          <span class="d">${dayNameShort(id)}</span>
          <span class="dot" aria-hidden="true"></span>
          <span class="t">${dayShort(kind)}</span>
        </button>`;
      })
      .join("");

    els.week.querySelectorAll(".day-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentDay = btn.dataset.day;
        currentTab = "today";
        syncNav();
        render({ animate: true });
      });
    });
  }

  function exerciseHtml(ex, dateStr, kind, index) {
    const checked = isChecked(dateStr, kind, index);
    return `
      <article class="exercise">
        <label class="exercise-head">
          <input class="check" type="checkbox" data-date="${dateStr}" data-kind="${kind}" data-index="${index}" ${checked ? "checked" : ""} />
          <span class="exercise-main">
            <span class="ex-title">${ex.name}</span>
            <span class="ex-stats">
              <span class="stat">
                <span class="stat-label">组数</span>
                <span class="stat-value accent">${ex.sets}</span>
              </span>
              <span class="stat">
                <span class="stat-label">起始试重</span>
                <span class="stat-value">${ex.startWeight}</span>
              </span>
            </span>
            <span class="ex-meta">${ex.goal}</span>
          </span>
        </label>
        <ul class="cue-list">
          ${ex.cues.map((c) => `<li>${c}</li>`).join("")}
        </ul>
      </article>`;
  }

  function renderWorkout(kind) {
    const w = data.workouts[kind];
    const dayName = data.dayNames[currentDay];
    const dateStr = dateForWeekday(currentDay);
    let html = `
      <section class="panel">
        <div class="session-badge">Session ${kind}</div>
        <h2>${dayName} · ${w.title}</h2>
        <p class="sub">${w.focus}</p>

        <div class="warmup-block">
          <div class="section-label">${w.warmup.title}</div>
          <ul class="note-list">
            ${w.warmup.items.map((i) => `<li>${i}</li>`).join("")}
          </ul>
          ${w.warmup.note ? `<p class="tips">${w.warmup.note}</p>` : ""}
        </div>

        <div class="section-label">正式训练 · 4 个动作</div>`;

    w.exercises.forEach((ex, i) => {
      html += exerciseHtml(ex, dateStr, kind, i);
    });

    html += `</section>`;
    els.session.innerHTML = html;
    bindChecks();
  }

  function renderRestOrCardio(kind) {
    const dayName = data.dayNames[currentDay];
    const block = kind === "cardio" ? data.cardioDay : data.restDay;
    const panelClass = kind === "cardio" ? "panel panel-cardio" : "panel panel-rest";
    els.session.innerHTML = `
      <section class="${panelClass}">
        <div class="session-badge ${kind === "cardio" ? "badge-cardio" : "badge-rest"}">${block.title}</div>
        <h2>${dayName} · ${block.title}</h2>
        <p class="sub">${block.subtitle}</p>
        <ul class="note-list">${block.notes.map((n) => `<li>${n}</li>`).join("")}</ul>
      </section>`;
  }

  function bindChecks() {
    els.session.querySelectorAll(".check").forEach((box) => {
      box.addEventListener("change", () => {
        setChecked(box.dataset.date, box.dataset.kind, Number(box.dataset.index), box.checked);
      });
    });
  }

  function renderSession() {
    const kind = dayKind(currentDay);
    if (kind === "A" || kind === "B") renderWorkout(kind);
    else renderRestOrCardio(kind);
  }

  function renderProgress() {
    const p = data.progression;
    const g = data.goals;
    els.progress.innerHTML = `
      <section class="panel">
        <div class="session-badge">Start</div>
        <h2>上手怎么练</h2>
        <p class="quick-note">${data.quickStart}</p>
        <p class="quick-note">${data.cycleNote}</p>
      </section>
      <section class="panel">
        <div class="session-badge">Progress</div>
        <h2>${p.title}</h2>
        <p class="sub">${p.intro}</p>
        <ol class="info-list numbered">
          ${p.steps.map((s) => `<li>${s}</li>`).join("")}
        </ol>
        <div class="section-label">第一次试重范围</div>
        <div class="weight-table">
          ${p.table
            .map(
              (row) => `
            <div class="weight-row">
              <span>${row.name}</span>
              <strong>${row.start}</strong>
            </div>`
            )
            .join("")}
        </div>
        <p class="tips">${p.note}</p>
      </section>
      <section class="panel">
        <div class="session-badge">Goals</div>
        <h2>${g.title}</h2>
        <p class="sub">${g.intro}</p>
        <div class="compare">
          <div>
            <div class="section-label">第 1 周示例</div>
            <ul class="note-list">${g.week1.map((i) => `<li>${i}</li>`).join("")}</ul>
          </div>
          <div>
            <div class="section-label">第 6 周示例</div>
            <ul class="note-list">${g.week6.map((i) => `<li>${i}</li>`).join("")}</ul>
          </div>
        </div>
        <p class="tips">${g.feel}</p>
      </section>`;
  }

  function buildCalendarCells(year, month) {
    // month: 0-based. Grid starts on Monday.
    const first = new Date(year, month, 1);
    const firstWeekday = (first.getDay() + 6) % 7; // Mon=0 ... Sun=6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const today = todayStr();
    const cells = [];

    for (let i = 0; i < 42; i++) {
      let y = year;
      let m = month;
      let day;
      let inMonth = true;

      if (i < firstWeekday) {
        inMonth = false;
        m = month - 1;
        day = prevDays - firstWeekday + i + 1;
        if (m < 0) {
          m = 11;
          y = year - 1;
        }
      } else if (i >= firstWeekday + daysInMonth) {
        inMonth = false;
        m = month + 1;
        day = i - firstWeekday - daysInMonth + 1;
        if (m > 11) {
          m = 0;
          y = year + 1;
        }
      } else {
        day = i - firstWeekday + 1;
      }

      const dateStr = `${y}-${pad2(m + 1)}-${pad2(day)}`;
      const count = countForDate(dateStr);
      cells.push({ day, dateStr, inMonth, count, isToday: dateStr === today });
    }

    // Trim trailing empty week if unused
    const lastInMonth = firstWeekday + daysInMonth;
    const weeks = Math.ceil(lastInMonth / 7);
    return cells.slice(0, weeks * 7);
  }

  function renderStats() {
    const year = statsCursor.getFullYear();
    const month = statsCursor.getMonth();
    const cells = buildCalendarCells(year, month);
    const total = totalCompleted();

    els.stats.innerHTML = `
      <section class="panel">
        <div class="session-badge">Stats</div>
        <h2>训练统计</h2>
        <p class="sub">勾选动作后，按日期记入日历。</p>
        <div class="stats-hero">
          <span class="stats-number">${total}</span>
          <span class="stats-label">累计完成动作</span>
        </div>

        <div class="cal-head">
          <button type="button" class="cal-nav" data-cal="prev" aria-label="上一月">‹</button>
          <div class="cal-title">${year} 年 ${month + 1} 月</div>
          <button type="button" class="cal-nav" data-cal="next" aria-label="下一月">›</button>
        </div>
        <div class="cal-weekdays">
          ${calWeekLabels.map((l) => `<span>${l}</span>`).join("")}
        </div>
        <div class="cal-grid">
          ${cells
            .map((c) => {
              const cls = [
                "cal-cell",
                c.inMonth ? "in-month" : "out-month",
                c.isToday ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const countCls = c.count > 0 ? "cal-count" : "cal-count is-zero";
              return `
              <div class="${cls}" title="${c.dateStr}">
                <span class="cal-day">${c.day}</span>
                <span class="${countCls}">${c.count > 0 ? c.count : "0"}</span>
              </div>`;
            })
            .join("")}
        </div>
      </section>`;

    els.stats.querySelectorAll("[data-cal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = btn.dataset.cal === "prev" ? -1 : 1;
        statsCursor = new Date(year, month + delta, 1);
        renderStats();
      });
    });
  }

  function syncNav() {
    els.nav.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === currentTab);
    });
  }

  function render(opts) {
    const animate = opts && opts.animate;
    const showToday = currentTab === "today";
    els.session.classList.toggle("hidden", !showToday);
    els.progress.classList.toggle("hidden", currentTab !== "progress");
    els.stats.classList.toggle("hidden", currentTab !== "stats");

    renderPatternToggle();
    renderWeek();
    if (showToday) renderSession();
    if (currentTab === "progress") renderProgress();
    if (currentTab === "stats") renderStats();
    if (animate) pulseMain();
  }

  els.nav.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.tab;
      syncNav();
      render({ animate: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.getElementById("focusChips").innerHTML = data.profile.focus
    .map((f) => `<span class="chip">${f}</span>`)
    .join("");

  syncNav();
  render({ animate: true });
})();
