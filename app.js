(function () {
  const LETTERS = ["A", "B", "C", "D"];

  const screens = {
    menu: document.getElementById("screen-menu"),
    mode: document.getElementById("screen-mode"),
    topics: document.getElementById("screen-topics"),
    list: document.getElementById("screen-list"),
    equiv: document.getElementById("screen-equiv"),
    const: document.getElementById("screen-const"),
    quiz: document.getElementById("screen-quiz"),
    result: document.getElementById("screen-result")
  };

  const el = {
    menuCount: document.getElementById("menu-count"),
    formulasList: document.getElementById("formulas-list"),
    equivList: document.getElementById("equiv-list"),
    constList: document.getElementById("const-list"),
    topicsTitle: document.getElementById("topics-title"),
    topicsHint: document.getElementById("topics-hint"),
    topicsList: document.getElementById("topics-list"),
    btnTopicsGo: document.getElementById("btn-topics-go"),
    quizProgress: document.getElementById("quiz-progress"),
    quizSection: document.getElementById("quiz-section"),
    quizQuestion: document.getElementById("quiz-question"),
    quizAnswers: document.getElementById("quiz-answers"),
    quizFeedback: document.getElementById("quiz-feedback"),
    btnNext: document.getElementById("btn-next"),
    quizFooter: document.getElementById("quiz-footer"),
    resultScore: document.getElementById("result-score"),
    resultText: document.getElementById("result-text")
  };

  let topicMode = "all"; // one | multi | all
  let selectedSections = [];
  let quizPool = [];
  let quizOrder = [];
  let quizIndex = 0;
  let score = 0;
  let answered = false;

  function show(name) {
    Object.values(screens).forEach((s) => s && s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo(0, 0);
  }

  function renderMath(tex) {
    if (!window.katex || !tex) return tex || "";
    try {
      return katex.renderToString(tex, {
        throwOnError: false,
        displayMode: false,
        output: "html"
      });
    } catch {
      return tex;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getSections() {
    const set = [];
    FORMULAS.forEach((f) => {
      if (!set.includes(f.section)) set.push(f.section);
    });
    return set;
  }

  function countInSection(section) {
    return FORMULAS.filter((f) => f.section === section).length;
  }

  function renderNotation(text) {
    if (!text) return "";

    function onePair(chunk) {
      const m = chunk.match(/^(.+?)\s+—\s+(.+)$/);
      if (!m) {
        if (/[\\^_{}]|\\[a-zA-Z]/.test(chunk) && !/[А-Яа-яЁё]/.test(chunk)) {
          return renderMath(chunk.trim());
        }
        return escapeHtml(chunk);
      }
      const left = m[1].trim();
      const right = m[2].trim();
      const leftHtml =
        /[\\^_{}]|\\[a-zA-Z]|[_^]/.test(left) || /[a-zA-Z]/.test(left)
          ? renderMath(left)
          : escapeHtml(left);
      return leftHtml + " — " + escapeHtml(right);
    }

    return text
      .split(/\s*;\s*/)
      .map((part) =>
        part
          .split(/\s*,\s*(?=[^,—]*—)/)
          .map(onePair)
          .join(", ")
      )
      .join("; ");
  }

  function buildFormulaTable(items, opts) {
    const showBase = !!(opts && opts.showBase);
    const bySection = new Map();
    items.forEach((f) => {
      if (!bySection.has(f.section)) bySection.set(f.section, []);
      bySection.get(f.section).push(f);
    });

    const parts = [];
    bySection.forEach((rowsItems, section) => {
      const rows = rowsItems
        .map((f) => {
          const formulaHtml = f.boxed
            ? `<span class="formula-box">${renderMath(f.formula)}</span>`
            : renderMath(f.formula);
          const num = f.id;
          const baseCell = showBase
            ? `<td class="col-base">${renderMath(f.base || "")}</td>`
            : "";
          const notation = showBase
            ? escapeHtml(f.notation || "")
            : renderNotation(f.notation);
          return `
            <tr>
              <td class="col-num">${escapeHtml(String(num))}</td>
              <td class="col-name">${escapeHtml(f.name)}</td>
              <td class="col-formula">${formulaHtml}</td>
              ${baseCell}
              <td class="col-notation">${notation}</td>
            </tr>`;
        })
        .join("");

      const cards = rowsItems
        .map((f) => {
          const formulaHtml = f.boxed
            ? `<span class="formula-box">${renderMath(f.formula)}</span>`
            : renderMath(f.formula);
          const notation = showBase
            ? escapeHtml(f.notation || "")
            : renderNotation(f.notation);
          const baseBlock = showBase
            ? `<p class="card-base"><span>Из</span> ${renderMath(f.base || "")}</p>`
            : "";
          return `
            <article class="formula-card">
              <div class="card-top">
                <span class="card-num">${escapeHtml(String(f.id))}</span>
                <h3 class="card-name">${escapeHtml(f.name)}</h3>
              </div>
              <div class="card-formula">${formulaHtml}</div>
              ${baseBlock}
              <p class="card-notation">${notation}</p>
            </article>`;
        })
        .join("");

      const headBase = showBase ? "<th>Из формулы</th>" : "";
      parts.push(`
        <div class="section-block">
          <h2 class="section-title">${escapeHtml(section)}</h2>
          <div class="table-scroll desktop-only">
            <table class="formula-table${showBase ? " formula-table-equiv" : ""}">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Название</th>
                  <th>Формула</th>
                  ${headBase}
                  <th>${showBase ? "Пояснение" : "Обозначения"}</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div class="formula-cards mobile-only">${cards}</div>
        </div>`);
    });

    return parts.join("");
  }

  function buildList() {
    el.formulasList.innerHTML = buildFormulaTable(FORMULAS);
  }

  function buildEquiv() {
    el.equivList.innerHTML = buildFormulaTable(EQUIVALENTS, { showBase: true });
  }

  function buildConst() {
    const rows = CONSTANTS.map(
      (c) => `
      <tr>
        <td class="col-name">${escapeHtml(c.name)}</td>
        <td class="col-formula">${renderMath(c.value)}</td>
      </tr>`
    ).join("");

    const cards = CONSTANTS.map(
      (c) => `
      <article class="formula-card">
        <h3 class="card-name">${escapeHtml(c.name)}</h3>
        <div class="card-formula">${renderMath(c.value)}</div>
      </article>`
    ).join("");

    el.constList.innerHTML = `
      <div class="table-scroll desktop-only">
        <table class="formula-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Значение</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="formula-cards mobile-only">${cards}</div>`;
  }

  /* ——— Выбор тем ——— */
  function openTopics(mode) {
    topicMode = mode;
    selectedSections = [];
    const sections = getSections();

    if (mode === "one") {
      el.topicsTitle.textContent = "Одна тема";
      el.topicsHint.textContent = "Нажмите на тему — тест начнётся сразу.";
      el.btnTopicsGo.hidden = true;
    } else {
      el.topicsTitle.textContent = "Несколько тем";
      el.topicsHint.textContent = "Отметьте нужные темы и нажмите «Начать тест».";
      el.btnTopicsGo.hidden = false;
      el.btnTopicsGo.disabled = true;
    }

    el.topicsList.innerHTML = sections
      .map((sec) => {
        const n = countInSection(sec);
        if (mode === "one") {
          return `<button type="button" class="topic-item" data-section="${escapeHtml(sec)}">
            <span class="topic-name">${escapeHtml(sec)}</span>
            <span class="topic-count">${n}</span>
          </button>`;
        }
        return `<label class="topic-item topic-check">
          <input type="checkbox" value="${escapeHtml(sec)}" />
          <span class="topic-name">${escapeHtml(sec)}</span>
          <span class="topic-count">${n}</span>
        </label>`;
      })
      .join("");

    if (mode === "one") {
      el.topicsList.querySelectorAll("[data-section]").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedSections = [btn.getAttribute("data-section")];
          startQuiz();
        });
      });
    } else {
      el.topicsList.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
        inp.addEventListener("change", () => {
          selectedSections = [...el.topicsList.querySelectorAll("input:checked")].map(
            (i) => i.value
          );
          el.btnTopicsGo.disabled = selectedSections.length === 0;
        });
      });
    }

    show("topics");
  }

  function startQuiz() {
    if (topicMode === "all") {
      quizPool = FORMULAS.slice();
    } else {
      quizPool = FORMULAS.filter((f) => selectedSections.includes(f.section));
    }

    if (!quizPool.length) {
      alert("Нет формул для выбранных тем.");
      return;
    }

    quizOrder = shuffle(quizPool.map((_, i) => i));
    quizIndex = 0;
    score = 0;
    show("quiz");
    renderQuestion();
  }

  function pickWrong(correct, count) {
    // Отвлекающие — из того же пула теста (те же темы)
    const pool = quizPool.filter(
      (f) => f.id !== correct.id && f.formula !== correct.formula
    );
    let wrong = shuffle(pool).slice(0, count);
    // Если в теме мало формул — добираем из всей базы
    if (wrong.length < count) {
      const extra = FORMULAS.filter(
        (f) =>
          f.id !== correct.id &&
          f.formula !== correct.formula &&
          !wrong.some((w) => w.id === f.id)
      );
      wrong = wrong.concat(shuffle(extra).slice(0, count - wrong.length));
    }
    return wrong;
  }

  function renderQuestion() {
    answered = false;
    el.btnNext.hidden = true;
    if (el.quizFooter) el.quizFooter.hidden = true;
    el.quizFeedback.hidden = true;
    el.quizFeedback.textContent = "";
    el.quizFeedback.className = "quiz-feedback";

    const item = quizPool[quizOrder[quizIndex]];
    el.quizProgress.textContent = `${quizIndex + 1} / ${quizOrder.length}`;
    el.quizSection.textContent = item.section;
    el.quizQuestion.textContent = item.name;

    const wrong = pickWrong(item, 3);
    const options = shuffle([
      { formula: item.formula, correct: true },
      ...wrong.map((w) => ({ formula: w.formula, correct: false }))
    ]);

    el.quizAnswers.innerHTML = "";
    options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer";
      btn.dataset.correct = opt.correct ? "1" : "0";
      btn.innerHTML = `
        <span class="answer-letter">${LETTERS[i]}</span>
        <span class="answer-body">${renderMath(opt.formula)}</span>`;
      btn.addEventListener("click", () => onAnswer(btn, opt.correct));
      el.quizAnswers.appendChild(btn);
    });
  }

  function onAnswer(btn, isCorrect) {
    if (answered) return;
    answered = true;

    const buttons = [...el.quizAnswers.querySelectorAll(".answer")];
    buttons.forEach((b) => {
      b.disabled = true;
      if (b.dataset.correct === "1") b.classList.add("correct");
    });

    if (isCorrect) {
      score += 1;
      el.quizFeedback.textContent = "Верно";
      el.quizFeedback.classList.add("ok");
    } else {
      btn.classList.add("wrong");
      el.quizFeedback.textContent = "Неверно";
      el.quizFeedback.classList.add("bad");
    }

    el.quizFeedback.hidden = false;
    el.btnNext.hidden = false;
    if (el.quizFooter) el.quizFooter.hidden = false;
    el.btnNext.textContent =
      quizIndex + 1 >= quizOrder.length ? "Результат" : "Далее";
  }

  function nextQuestion() {
    if (quizIndex + 1 >= quizOrder.length) {
      finishQuiz();
      return;
    }
    quizIndex += 1;
    renderQuestion();
  }

  function finishQuiz() {
    const total = quizOrder.length;
    const pct = total ? Math.round((score / total) * 100) : 0;
    el.resultScore.textContent = `${score} / ${total}`;

    let text = "Можно пройти ещё раз — ответы снова перемешаются.";
    if (pct === 100) text = "Отлично: все формулы на месте.";
    else if (pct >= 70) text = "Хороший результат. Повторите слабые места в списке.";
    else if (pct >= 40) text = "Есть над чем поработать — откройте таблицу формул.";
    else text = "Начните со списка формул, затем снова тест.";

    el.resultText.textContent = text;
    show("result");
  }

  /* ——— События ——— */
  document.getElementById("btn-start").addEventListener("click", () => show("mode"));
  document.getElementById("btn-list").addEventListener("click", () => show("list"));
  document.getElementById("btn-equiv").addEventListener("click", () => show("equiv"));
  document.getElementById("btn-const").addEventListener("click", () => show("const"));

  document.getElementById("btn-mode-one").addEventListener("click", () => openTopics("one"));
  document.getElementById("btn-mode-all").addEventListener("click", () => {
    topicMode = "all";
    selectedSections = getSections();
    startQuiz();
  });
  document.getElementById("btn-mode-multi").addEventListener("click", () => openTopics("multi"));
  document.getElementById("btn-topics-go").addEventListener("click", startQuiz);

  document.getElementById("btn-retry").addEventListener("click", startQuiz);
  document.getElementById("btn-next").addEventListener("click", nextQuestion);

  document.querySelectorAll("[data-go]").forEach((node) => {
    node.addEventListener("click", () => show(node.getAttribute("data-go")));
  });

  el.menuCount.textContent = `Основных: ${FORMULAS.length} · эквивалентов: ${EQUIVALENTS.length} · постоянных: ${CONSTANTS.length}`;
  buildList();
  buildEquiv();
  buildConst();
})();
