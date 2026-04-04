const STORAGE_KEY = "miyamoto:maxes";
const USER_TIME_ZONE = "Asia/Kolkata";

const inputs = [
  { key: "pushUp", label: "Push-up max" },
  { key: "dip", label: "Dip max" },
  { key: "pullUp", label: "Pull-up max" },
  { key: "squat", label: "Squat max" },
];

const targetMap = {
  pushUp: "pushUp",
  dip: "dip",
  pullUpSet1: "pullUp",
  squat: "squat",
};

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: USER_TIME_ZONE,
  });

const getTodayIso = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: USER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const loadMaxes = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const saveMaxes = (value) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

const calculateTarget = (target, maxes, week) => {
  if (target.key === "pullUpSet2") {
    const pullTarget = calculateTarget(
      { key: "pullUpSet1", formula: "60% of pull-up max" },
      maxes,
      week,
    );
    return Number.isFinite(pullTarget)
      ? Math.max(0, Math.floor(pullTarget * week.pullUpSecondSetRatio))
      : null;
  }

  const maxKey = targetMap[target.key];
  const raw = Number(maxes[maxKey]);

  if (!Number.isFinite(raw) || raw <= 0) {
    return null;
  }

  return Math.max(0, Math.floor(raw * week.targetIntensity));
};

const renderFormulaValue = (target, maxes, week) => {
  const value = calculateTarget(target, maxes, week);

  if (!Number.isFinite(value)) {
    return `<span class="formula-value is-empty">Enter a max</span>`;
  }

  return `<span class="formula-value">${value} reps</span>`;
};

const getAnchorDay = (days) => {
  const today = getTodayIso();
  return (
    days.find((day) => day.date === today) ||
    days.find((day) => day.date > today) ||
    days[days.length - 1]
  );
};

const getNextDay = (days, anchorDay) => {
  const currentIndex = days.findIndex((day) => day.slug === anchorDay.slug);
  if (currentIndex === -1 || currentIndex === days.length - 1) {
    return null;
  }
  return days[currentIndex + 1];
};

const escapeHtml = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderTextBlock = (copy) =>
  copy ? `<p class="session-copy">${escapeHtml(copy)}</p>` : "";

const renderBullets = (bullets = []) =>
  bullets.length
    ? `<ul class="session-list">${bullets
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    : "";

const renderDuration = (duration) =>
  duration ? `<span class="session-time">${escapeHtml(duration)}</span>` : "";

const renderHeader = (data, anchorDay, nextDay) => `
  <header class="hero">
    <div class="shell">
      <div class="hero-panel">
        <div class="hero-copy-block">
          <span class="eyebrow">${escapeHtml(data.brand.kicker)}</span>
          <h1>${escapeHtml(data.brand.title)}</h1>
          <p class="hero-copy">${escapeHtml(data.brand.copy)}</p>
        </div>
        <div class="hero-meta-grid">
          <div class="hero-meta-row">
            <span class="hero-meta-label">Today</span>
            <div class="hero-meta-value">
              <strong>${escapeHtml(anchorDay.day)}</strong>
              <span>${escapeHtml(anchorDay.title)}</span>
            </div>
          </div>
          <div class="hero-meta-row">
            <span class="hero-meta-label">Next</span>
            <div class="hero-meta-value">
              ${
                nextDay
                  ? `<strong>${escapeHtml(nextDay.day)}</strong><span>${escapeHtml(nextDay.title)}</span>`
                  : `<strong>Week closes here</strong><span>Sunday rest stays locked.</span>`
              }
            </div>
          </div>
          <div class="hero-meta-row">
            <span class="hero-meta-label">Week</span>
            <div class="hero-meta-value">
              <strong>${escapeHtml(data.week.label)}</strong>
              <span>${escapeHtml(data.week.phase)}</span>
            </div>
          </div>
          <div class="hero-meta-row">
            <span class="hero-meta-label">Updated</span>
            <div class="hero-meta-value">
              <strong>${escapeHtml(data.week.updatedAtLabel)}</strong>
              <span>${escapeHtml(data.week.automation)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
`;

const renderQuickActions = (tracking) => `
  <div class="shell">
    <nav class="quick-actions" aria-label="Primary actions">
      <a class="quick-action is-primary" href="#today-board">Start with today</a>
      <a class="quick-action" href="#target-lab">Targets</a>
      <a class="quick-action" href="#week-board">Week board</a>
      <a class="quick-action" href="${tracking.url}" target="_blank" rel="noreferrer">
        ${escapeHtml(tracking.ctaLabel)}
      </a>
    </nav>
  </div>
`;

const renderOperatingSystem = () => `
  <section class="section-shell" id="workflow-guide">
    <div class="shell">
      <div class="section-head">
        <p class="section-kicker">How to use the board</p>
        <h2 class="section-title">Morning prepares. Evening builds.</h2>
        <p class="section-copy">
          This app should tell you what to do without interpretation. On normal training days, the
          main calisthenics skill work belongs inside the evening gym session, not as a token side note.
        </p>
      </div>
      <div class="workflow-grid">
        <article class="workflow-step">
          <span class="workflow-index">1</span>
          <h3>Morning prep only</h3>
          <p>Use the morning for mobility, flexibility, breathing, and joint prep. It sets up the evening session instead of competing with it.</p>
        </article>
        <article class="workflow-step">
          <span class="workflow-index">2</span>
          <h3>Long evening skill block</h3>
          <p>Standard days should carry a real 15-25 minute skill block before the main lift. Bridge days can stay shorter if recovery demands it.</p>
        </article>
        <article class="workflow-step">
          <span class="workflow-index">3</span>
          <h3>Finish and log it</h3>
          <p>End with the daily calisthenics block, then mark the session in the shared log. Blank completion still counts as skipped.</p>
        </article>
      </div>
    </div>
  </section>
`;

const renderTodayBoard = (day) => `
  <section class="section-shell" id="today-board">
    <div class="shell">
      <div class="section-head">
        <p class="section-kicker">Today</p>
        <h2 class="section-title">${escapeHtml(day.day)} / ${escapeHtml(day.title)}</h2>
        <p class="section-copy">${escapeHtml(day.summary)}</p>
        ${day.status ? `<span class="status-chip">${escapeHtml(day.status)}</span>` : ""}
      </div>
      ${renderBuildChips(day.builds)}
      <div class="today-grid">
        ${renderPrepBlock(day)}
        ${renderEveningMainBlock(day, true)}
        ${renderFinisherBlock(day)}
        ${renderSwapBlock(day)}
      </div>
    </div>
  </section>
`;

const renderTargetLab = (data, maxes) => `
  <section class="section-shell" id="target-lab">
    <div class="shell target-lab">
      <div>
        <div class="section-head">
          <p class="section-kicker">Target Lab</p>
          <h2 class="section-title">Set your maxes once.</h2>
          <p class="section-copy">
            This week uses ${Math.round(data.week.targetIntensity * 100)}% of your current technical max.
            The board already blends muscle density, skill work, agility, mobility, and flexibility. Set the numbers and follow the day.
          </p>
        </div>
        <div class="input-strip">
          <div class="input-grid">
            ${inputs
              .map(
                (input) => `
              <div class="field">
                <label for="${input.key}">${input.label}</label>
                <input
                  id="${input.key}"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  placeholder="0"
                  value="${maxes[input.key] ?? ""}"
                />
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </div>
      <div class="formula-list">
        <ul>
          ${data.targets
            .map(
              (target) => `
            <li>
              <div class="formula-meta">
                <span class="formula-label">${escapeHtml(target.label)}</span>
                <span class="formula-rule">${escapeHtml(target.formula)}</span>
              </div>
              ${renderFormulaValue(target, maxes, data.week)}
            </li>
          `,
            )
            .join("")}
        </ul>
      </div>
    </div>
  </section>
`;

const renderTrackingHub = (tracking) => `
  <section class="section-shell" id="tracking-hub">
    <div class="shell tracking-hub">
      <div class="section-head">
        <p class="section-kicker">Shared Tracking</p>
        <h2 class="section-title">${escapeHtml(tracking.title)}</h2>
        <p class="section-copy">${escapeHtml(tracking.copy)}</p>
      </div>
      <div class="tracking-card">
        <ul class="tracking-list">
          ${tracking.fields.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <a class="tracking-link" href="${tracking.url}" target="_blank" rel="noreferrer">
          ${escapeHtml(tracking.ctaLabel)}
        </a>
      </div>
    </div>
  </section>
`;

const renderBuildChips = (builds = []) =>
  builds.length
    ? `
      <div class="build-chip-row" aria-label="Training qualities">
        ${builds.map((item) => `<span class="build-chip">${escapeHtml(item)}</span>`).join("")}
      </div>
    `
    : "";

const renderPrepBlock = (day) => `
  <article class="session-block session-block--prep">
    <div class="session-step">1</div>
    <div class="session-body">
      <div class="session-head">
        <p class="session-kicker">Morning prep</p>
        <h3>${escapeHtml(day.morning.label)}</h3>
        ${renderDuration(day.morning.duration)}
      </div>
      ${renderTextBlock(day.morning.copy)}
      ${renderBullets(day.morning.bullets)}
    </div>
  </article>
`;

const renderEveningMainBlock = (day, isToday = false) => `
  <article class="session-block session-block--main">
    <div class="session-step">2</div>
    <div class="session-body">
      <div class="session-head">
        <p class="session-kicker">Evening main block</p>
        <h3>${isToday ? "Tonight's build" : "Skill + gym session"}</h3>
        <span class="session-time">
          ${
            day.skill.duration && day.evening.duration
              ? `${escapeHtml(day.skill.duration)} skill + ${escapeHtml(day.evening.duration)} lift`
              : "Skill first, lift second"
          }
        </span>
      </div>
      <div class="main-block-grid">
        <section class="sub-session sub-session--skill">
          <div class="sub-session-head">
            <p class="sub-session-kicker">Skill block</p>
            <h4>${escapeHtml(day.skill.label)}</h4>
            ${renderDuration(day.skill.duration)}
          </div>
          ${renderTextBlock(day.skill.copy)}
          ${renderBullets(day.skill.bullets)}
        </section>
        <section class="sub-session sub-session--lift">
          <div class="sub-session-head">
            <p class="sub-session-kicker">Gym block</p>
            <h4>${escapeHtml(day.evening.label)}</h4>
            ${renderDuration(day.evening.duration)}
          </div>
          ${renderTextBlock(day.evening.copy)}
          ${renderBullets(day.evening.bullets)}
        </section>
      </div>
    </div>
  </article>
`;

const renderFinisherBlock = (day) => `
  <article class="session-block session-block--finisher">
    <div class="session-step">3</div>
    <div class="session-body">
      <div class="session-head">
        <p class="session-kicker">Daily finisher</p>
        <h3>Daily calisthenics</h3>
      </div>
      <p class="session-copy">${escapeHtml(day.bodyweight)}</p>
      ${day.note ? `<p class="day-note">${escapeHtml(day.note)}</p>` : ""}
    </div>
  </article>
`;

const renderSwapBlock = (day) => `
  <article class="session-block session-block--swap">
    <div class="session-step">4</div>
    <div class="session-body">
      <div class="session-head">
        <p class="session-kicker">If something is unavailable</p>
        <h3>Swaps</h3>
      </div>
      <ul class="swap-list">
        ${day.swaps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  </article>
`;

const renderDayRail = (days, activeSlug) => `
  <div class="day-rail-wrap">
    <div class="shell">
      <nav class="day-rail" aria-label="Jump to day">
        ${days
          .map(
            (day) => `
          <button class="day-pill ${day.slug === activeSlug ? "active" : ""}" data-target="${day.slug}">
            <small>${escapeHtml(day.day)}</small>
            <strong>${escapeHtml(formatDate(day.date))}</strong>
          </button>
        `,
          )
          .join("")}
      </nav>
    </div>
  </div>
`;

const renderDaySection = (day) => `
  <section class="section-shell day-section" id="${day.slug}">
    <div class="shell">
      <div class="day-shell">
        <div class="day-head">
          <div class="day-topline">
            <span class="day-date">${escapeHtml(day.day)} / ${escapeHtml(formatDate(day.date))}</span>
            ${day.status ? `<span class="status-chip">${escapeHtml(day.status)}</span>` : ""}
          </div>
          <h2 class="day-title">${escapeHtml(day.title)}</h2>
          <p class="section-copy">${escapeHtml(day.summary)}</p>
          ${renderBuildChips(day.builds)}
        </div>
        <div class="day-session-stack">
          ${renderPrepBlock(day)}
          ${renderEveningMainBlock(day)}
          ${renderFinisherBlock(day)}
          ${renderSwapBlock(day)}
        </div>
      </div>
    </div>
  </section>
`;

const renderSkillTracks = (tracks) => `
  <section class="section-shell" id="skill-tracks">
    <div class="shell">
      <div class="section-head">
        <p class="section-kicker">Skill Tracks</p>
        <h2 class="section-title">Train the ladder, not a fantasy list.</h2>
        <p class="section-copy">
          Your board advances four tracks together: pushing and balance, pulling power, core and compression, and lower-body control.
        </p>
      </div>
      <div class="skill-grid">
        ${tracks
          .map(
            (track) => `
          <article class="skill-band">
            <p class="skill-kicker">${escapeHtml(track.horizon)}</p>
            <h3>${escapeHtml(track.title)}</h3>
            <p>${escapeHtml(track.currentFocus)}</p>
            <ul class="skill-milestones">
              ${track.milestones.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </article>
        `,
          )
          .join("")}
      </div>
    </div>
  </section>
`;

const renderAlternatives = (groups) => `
  <section class="section-shell" id="alternatives">
    <div class="shell">
      <div class="section-head">
        <p class="section-kicker">Exercise Alternatives</p>
        <h2 class="section-title">Keep the intent. Swap the tool.</h2>
        <p class="section-copy">
          Busy gym, sketchy joint, or missing equipment should not kill the session. Swap the tool and keep the training effect.
        </p>
      </div>
      <div class="alt-list">
        ${groups
          .map(
            (group) => `
          <details>
            <summary>${escapeHtml(group.title)}</summary>
            <div class="alt-table">
              ${group.items
                .map(
                  (item) => `
                <div class="alt-row">
                  <div class="alt-primary">${escapeHtml(item.primary)}</div>
                  <div class="alt-swaps">${item.swaps.map(escapeHtml).join(" / ")}</div>
                </div>
              `,
                )
                .join("")}
            </div>
          </details>
        `,
          )
          .join("")}
      </div>
    </div>
  </section>
`;

const renderSources = (sources) => `
  <section class="section-shell" id="sources">
    <div class="shell">
      <div class="section-head">
        <p class="section-kicker">Sources</p>
        <h2 class="section-title">Programming guardrails.</h2>
        <p class="section-copy">
          These references anchor the weekly load and recovery logic.
        </p>
      </div>
      <div class="source-list">
        <ul>
          ${sources
            .map(
              (source) => `
            <li>
              <div class="formula-meta">
                <span class="formula-label">${escapeHtml(source.label)}</span>
                <span class="formula-rule">${escapeHtml(source.note)}</span>
              </div>
              <a class="source-link" href="${source.url}" target="_blank" rel="noreferrer">Open</a>
            </li>
          `,
            )
            .join("")}
        </ul>
      </div>
    </div>
  </section>
`;

const renderFooter = () => `
  <footer class="shell footer">
    Weekly updates stay light on Sunday so Monday does not feel like punishment.
  </footer>
`;

const setupInputs = (data, rerender) => {
  const maxes = loadMaxes();

  inputs.forEach((input) => {
    const element = document.getElementById(input.key);
    if (!element) return;

    element.addEventListener("input", (event) => {
      maxes[input.key] = event.currentTarget.value;
      saveMaxes(maxes);
      rerender(data, maxes);
    });
  });
};

const setupDayRail = () => {
  const buttons = [...document.querySelectorAll(".day-pill")];
  const sections = [...document.querySelectorAll(".day-section")];

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.target);
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.18 },
  );

  sections.forEach((section) => revealObserver.observe(section));

  const activeObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      buttons.forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.target === visible.target.id,
        );
      });
    },
    { threshold: [0.25, 0.6, 0.9] },
  );

  sections.forEach((section) => activeObserver.observe(section));
};

const mount = (data, maxes) => {
  const anchorDay = getAnchorDay(data.days);
  const nextDay = getNextDay(data.days, anchorDay);
  const app = document.getElementById("app");

  app.innerHTML = [
    renderHeader(data, anchorDay, nextDay),
    renderQuickActions(data.tracking),
    "<main>",
    renderTodayBoard(anchorDay),
    renderOperatingSystem(),
    renderTargetLab(data, maxes),
    renderTrackingHub(data.tracking),
    `<section id="week-board">`,
    renderDayRail(data.days, anchorDay.slug),
    data.days.map(renderDaySection).join(""),
    `</section>`,
    renderSkillTracks(data.skillTracks),
    renderAlternatives(data.alternatives),
    renderSources(data.sources),
    "</main>",
    renderFooter(),
  ].join("");
};

const rerenderTargets = (data, maxes) => {
  const next = renderTargetLab(data, maxes);
  document.getElementById("target-lab")?.replaceWith(
    new DOMParser().parseFromString(next, "text/html").body.firstElementChild,
  );
  setupInputs(data, rerenderTargets);
};

const init = async () => {
  const response = await fetch(`./data/current-week.json?v=${Date.now()}`, {
    cache: "no-store",
  });
  const data = await response.json();
  const maxes = loadMaxes();

  mount(data, maxes);
  setupInputs(data, rerenderTargets);
  setupDayRail();
};

init().catch((error) => {
  const app = document.getElementById("app");
  app.innerHTML = `
    <main class="shell load-error">
      <h1>Project Miyamoto is not loading.</h1>
      <p>
        The weekly data file could not be loaded. Check
        <code>gym-web/data/current-week.json</code> and try again.
      </p>
      <pre>${String(error)}</pre>
    </main>
  `;
});
