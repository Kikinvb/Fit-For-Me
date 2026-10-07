(function () {
  const data = window.FIT_DATA;
  const checkKey = "fit-for-me-checks-v2";
  const patternKey = "fit-for-me-pattern-v2";

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

  function pickTodayId() {
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
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

  function exerciseHtml(ex, key) {
    const checked = !!checks[key];
    return `
      <article class="exercise">
        <label class="exercise-head">
          <input class="check" type="checkbox" data-key="${key}" ${checked ? "checked" : ""} />
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
      html += exerciseHtml(ex, `${patternId}-${currentDay}-${kind}-${i}`);
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
        checks[box.dataset.key] = box.checked;
        saveChecks();
      });
    });
  }

  function renderSession() {
    const kind = dayKind(currentDay);
    if (kind === "A" || kind === "B") renderWorkout(kind);
    else renderRestOrCardio(kind);
  }

  function collectStats() {
    const byExercise = {};
    ["A", "B"].forEach((kind) => {
      data.workouts[kind].exercises.forEach((ex) => {
        if (byExercise[ex.name] == null) byExercise[ex.name] = 0;
      });
    });

    ["aba", "bab"].forEach((pid) => {
      Object.keys(data.dayNames).forEach((dayId) => {
        const kind = data.patterns[pid].days[dayId];
        if (kind !== "A" && kind !== "B") return;
        data.workouts[kind].exercises.forEach((ex, i) => {
          const key = `${pid}-${dayId}-${kind}-${i}`;
          if (checks[key]) byExercise[ex.name] += 1;
        });
      });
    });

    const total = Object.values(byExercise).reduce((sum, n) => sum + n, 0);
    return { total, byExercise };
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

  function renderStats() {
    const { total, byExercise } = collectStats();
    const rows = Object.entries(byExercise)
      .map(
        ([name, count]) => `
        <li>
          <span>${name}</span>
          <strong>${count}</strong>
        </li>`
      )
      .join("");

    els.stats.innerHTML = `
      <section class="panel">
        <div class="session-badge">Stats</div>
        <h2>动作完成</h2>
        <p class="sub">在训练日勾选动作后，这里会累计次数。</p>
        <div class="stats-hero">
          <span class="stats-number">${total}</span>
          <span class="stats-label">累计完成次数</span>
        </div>
        <div class="section-label">各动作</div>
        <ul class="stats-list">${rows}</ul>
      </section>`;
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
