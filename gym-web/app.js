const STORAGE_KEY = "miyamoto:maxes";

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
  });

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

  const suffix = target.key === "pullUpSet2" ? " reps" : " reps";
  return `<span class="formula-value">${value}${suffix}</span>`;
};

const renderHero = (data) => `
  <header class="hero">
    <div class="shell">
      <div class="hero-panel">
        <div class="hero-grid">
          <section>
            <span class="eyebrow">${data.brand.kicker}</span>
            <h1>${data.brand.title}</h1>
            <p class="hero-copy">${data.brand.copy}</p>
            <div class="hero-tags">
              <span class="hero-tag">${data.week.label}</span>
              <span class="hero-tag">${data.week.phase}</span>
              <span class="hero-tag">Sunday rest locked</span>
            </div>
          </section>
          <aside class="hero-meta">
            <div class="meta-line">
              <span class="meta-label">Focus</span>
              <div class="meta-value">${data.week.focus}</div>
            </div>
            <div class="meta-line">
              <span class="meta-label">Refresh</span>
              <div class="meta-value">${data.week.automation}</div>
            </div>
            <div class="meta-line">
              <span class="meta-label">Rhythm</span>
              <div class="meta-value">${data.week.rhythm}</div>
            </div>
            <div class="meta-line">
              <span class="meta-label">Updated</span>
              <div class="meta-value">${data.week.updatedAtLabel}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </header>
`;

const renderDayRail = (days) => `
  <div class="day-rail-wrap">
    <div class="shell">
      <nav class="day-rail" aria-label="Jump to day">
        ${days
          .map(
            (day) => `
          <button class="day-pill" data-target="${day.slug}">
            <small>${day.day}</small>
            <strong>${formatDate(day.date)}</strong>
          </button>
        `,
          )
          .join("")}
      </nav>
    </div>
  </div>
`;

const renderTargetLab = (data, maxes) => `
  <section class="section-shell" id="target-lab">
    <div class="shell target-lab">
      <div>
        <p class="section-kicker">Target Lab</p>
        <h2 class="section-title">Set your maxes once, then stop guessing.</h2>
        <p class="section-copy">
          This week is programmed at ${Math.round(data.week.targetIntensity * 100)}% of your
          current technical max. Keep 1-2 reps in reserve on most days and treat Sunday as a
          full reset.
        </p>
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
                <span class="formula-label">${target.label}</span>
                <span class="formula-rule">${target.formula}</span>
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

const renderDaySection = (day) => `
  <section class="section-shell day-section" id="${day.slug}">
    <div class="shell section-grid">
      <div class="day-head">
        <div class="day-date">${day.day} / ${formatDate(day.date)}</div>
        <h2 class="day-title">${day.title}</h2>
        <p class="section-copy">${day.summary}</p>
        ${
          day.status
            ? `<span class="status-chip">${day.status}</span>`
            : ""
        }
      </div>
      <div class="day-summary">
        <article class="day-detail">
          <h3>${day.morning.label}</h3>
          ${day.morning.copy ? `<p>${day.morning.copy}</p>` : ""}
          ${
            day.morning.bullets?.length
              ? `<ul>${day.morning.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`
              : ""
          }
        </article>
        <article class="day-detail">
          <h3>Daily bodyweight</h3>
          <p>${day.bodyweight}</p>
          ${
            day.note ? `<p class="day-note">${day.note}</p>` : ""
          }
        </article>
        <article class="day-detail">
          <h3>${day.evening.label}</h3>
          ${day.evening.copy ? `<p>${day.evening.copy}</p>` : ""}
          ${
            day.evening.bullets?.length
              ? `<ul>${day.evening.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`
              : ""
          }
        </article>
        <article class="day-detail">
          <h3>Swaps</h3>
          <ul>${day.swaps.map((item) => `<li>${item}</li>`).join("")}</ul>
        </article>
      </div>
    </div>
  </section>
`;

const renderSkillTracks = (tracks) => `
  <section class="section-shell" id="skill-tracks">
    <div class="shell section-grid">
      <div>
        <p class="section-kicker">Skill Tracks</p>
        <h2 class="section-title">Train the ladder, not a fantasy list.</h2>
        <p class="section-copy">
          "All the skills" is a long-term goal, not a weekly task list. The smart version is to
          move four tracks forward together: pushing and balance, pulling power, core and
          compression, and lower-body control.
        </p>
      </div>
      <div class="skill-grid">
        ${tracks
          .map(
            (track) => `
          <article class="skill-band">
            <p class="skill-kicker">${track.horizon}</p>
            <h3>${track.title}</h3>
            <p>${track.currentFocus}</p>
            <ul class="skill-milestones">
              ${track.milestones.map((item) => `<li>${item}</li>`).join("")}
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
    <div class="shell section-grid">
      <div>
        <p class="section-kicker">Exercise Alternatives</p>
        <h2 class="section-title">Keep the intent. Swap the tool.</h2>
        <p class="section-copy">
          Busy gym, sketchy joint, or equipment issue should not kill the session.
          These swaps preserve the training effect without forcing bad reps.
        </p>
      </div>
      <div class="alt-list">
        ${groups
          .map(
            (group) => `
          <details>
            <summary>${group.title}</summary>
            <div class="alt-table">
              ${group.items
                .map(
                  (item) => `
                <div class="alt-row">
                  <div class="alt-primary">${item.primary}</div>
                  <div class="alt-swaps">${item.swaps.join(" / ")}</div>
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
    <div class="shell section-grid">
      <div>
        <p class="section-kicker">Sources</p>
        <h2 class="section-title">Programming guardrails, not random gym lore.</h2>
        <p class="section-copy">
          These are the references behind the weekly load and recovery logic.
        </p>
      </div>
      <div class="source-list">
        <ul>
          ${sources
            .map(
              (source) => `
            <li>
              <div class="formula-meta">
                <span class="formula-label">${source.label}</span>
                <span class="formula-rule">${source.note}</span>
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
    Weekly updates are designed to be light on Sunday and useful on Monday.
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
      target?.scrollIntoView({ block: "start" });
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
  const app = document.getElementById("app");
  app.innerHTML = [
    renderHero(data),
    renderDayRail(data.days),
    "<main>",
    renderTargetLab(data, maxes),
    renderSkillTracks(data.skillTracks),
    data.days.map(renderDaySection).join(""),
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
  const response = await fetch("./data/current-week.json");
  const data = await response.json();
  const maxes = loadMaxes();

  mount(data, maxes);
  setupInputs(data, rerenderTargets);
  setupDayRail();
};

init().catch((error) => {
  const app = document.getElementById("app");
  app.innerHTML = `
    <main class="shell" style="padding: 4rem 1.25rem;">
      <h1 style="font-family: Sora, sans-serif;">Project Miyamoto is not loading.</h1>
      <p style="max-width: 40rem; line-height: 1.6;">
        The weekly data file could not be loaded. Check <code>gym-web/data/current-week.json</code>
        and try again.
      </p>
      <pre style="white-space: pre-wrap;">${String(error)}</pre>
    </main>
  `;
});
