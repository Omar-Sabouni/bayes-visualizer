(function () {
  "use strict";

  const core = window.BayesCore;
  if (!core) {
    throw new Error("BayesCore must load before the page controller.");
  }

  const COHORT_SIZE = 10000;
  const CHART = Object.freeze({ left: 60, right: 680, top: 36, bottom: 300 });

  const SCENARIOS = [
    {
      id: "medical-screening",
      label: "Medical screening",
      description: "Made-up screening numbers.",
      prose: [["", " of people have the condition. "], ["The test catches ", " of them, "], ["but it also flags ", " of healthy people."]],
      question: "After a positive test, how likely is the condition?",
      priorLabel: "Condition prevalence",
      truePositiveLabel: "Test sensitivity",
      falsePositiveLabel: "False-positive rate",
      hypothesisLabel: "Condition present",
      notHypothesisLabel: "Condition absent",
      evidenceLabel: "Positive test",
      evidencePlural: "positive tests",
      noEvidenceLabel: "Negative test",
      noEvidencePlural: "negative tests",
      hypothesisSource: "people with the condition",
      likelihoodSentence: (value) =>
        "Among people who have the condition, " + value + " receive a positive test.",
      posteriorSentence: (value) =>
        "Among people with a positive test, " + value + " have the condition.",
      values: { prior: 1, truePositiveRate: 95, falsePositiveRate: 5 }
    },
    {
      id: "quality-inspection",
      label: "Quality inspection",
      description: "An inspection camera on a production line.",
      prose: [["", " of parts come off the line defective. "], ["The camera catches ", " of them, "], ["but it also flags ", " of good parts."]],
      question: "After an item is flagged, how likely is it to be defective?",
      priorLabel: "Defect rate",
      truePositiveLabel: "Defect detection rate",
      falsePositiveLabel: "False-alarm rate",
      hypothesisLabel: "Item defective",
      notHypothesisLabel: "Item not defective",
      evidenceLabel: "Flagged by inspection",
      evidencePlural: "inspection flags",
      noEvidenceLabel: "Not flagged",
      noEvidencePlural: "unflagged items",
      hypothesisSource: "defective items",
      likelihoodSentence: (value) =>
        "Among defective items, " + value + " are flagged by the inspection.",
      posteriorSentence: (value) =>
        "Among flagged items, " + value + " are actually defective.",
      values: { prior: 5, truePositiveRate: 90, falsePositiveRate: 8 }
    },
    {
      id: "spam-filter",
      label: "Spam filter",
      description: "An email spam filter.",
      prose: [["", " of incoming mail is spam. "], ["The filter catches ", " of it, "], ["but it also flags ", " of real mail."]],
      question: "After a message is flagged, how likely is it to be spam?",
      priorLabel: "Spam rate",
      truePositiveLabel: "Spam detection rate",
      falsePositiveLabel: "Legitimate-mail flag rate",
      hypothesisLabel: "Message is spam",
      notHypothesisLabel: "Message is legitimate",
      evidenceLabel: "Flagged by filter",
      evidencePlural: "flagged messages",
      noEvidenceLabel: "Not flagged",
      noEvidencePlural: "unflagged messages",
      hypothesisSource: "spam messages",
      likelihoodSentence: (value) =>
        "Among spam messages, " + value + " are flagged by the filter.",
      posteriorSentence: (value) =>
        "Among flagged messages, " + value + " are actually spam.",
      values: { prior: 20, truePositiveRate: 85, falsePositiveRate: 10 }
    },
    {
      id: "abstract",
      label: "Abstract A and B",
      description: "Plain A and B.",
      prose: [["A is true ", " of the time. "], ["When it is, B happens ", " of the time; "], ["when it isn't, B still happens ", " of the time."]],
      question: "After observing B, how likely is A?",
      priorLabel: "Prior probability",
      truePositiveLabel: "Likelihood under A",
      falsePositiveLabel: "Likelihood under not A",
      hypothesisLabel: "A is true",
      notHypothesisLabel: "A is false",
      evidenceLabel: "B occurs",
      evidencePlural: "B cases",
      noEvidenceLabel: "B does not occur",
      noEvidencePlural: "non-B cases",
      hypothesisSource: "cases where A is true",
      likelihoodSentence: (value) =>
        "Among cases where A is true, B occurs " + value + " of the time.",
      posteriorSentence: (value) =>
        "Among cases where B occurs, A is true " + value + " of the time.",
      values: { prior: 30, truePositiveRate: 70, falsePositiveRate: 25 }
    }
  ];

  const COIN_PRESETS = [
    {
      id: "uniform-eight-two",
      label: "Uniform prior, 8 heads / 2 tails",
      description: "Begin open-minded, then update with a short heads-heavy sample.",
      values: { alpha: 1, beta: 1, heads: 8, tails: 2 }
    },
    {
      id: "weak-fair",
      label: "Weak fair-coin prior, 8 heads / 2 tails",
      description: "A mild belief in a fair coin is shifted by the same ten observations.",
      values: { alpha: 2, beta: 2, heads: 8, tails: 2 }
    },
    {
      id: "strong-fair",
      label: "Strong fair-coin prior, 8 heads / 2 tails",
      description: "A concentrated prior moves less when the sample is small.",
      values: { alpha: 20, beta: 20, heads: 8, tails: 2 }
    },
    {
      id: "no-observations",
      label: "No observations",
      description: "With no data, the posterior is exactly the prior.",
      values: { alpha: 2, beta: 2, heads: 0, tails: 0 }
    }
  ];

  const ui = bindUi();
  let activeScenario = SCENARIOS[0];
  let scenarioCustomOption = null;
  let printDisclosureSnapshot = null;

  init();

  function init() {
    buildScenarioOptions();
    buildCoinPresetOptions();
    wireProbabilityControls();
    wireCoinControls();
    wirePrintDisclosures();
    applyScenario(SCENARIOS[0]);
    applyCoinPreset(COIN_PRESETS[0]);
  }

  function wirePrintDisclosures() {
    if (typeof window.addEventListener !== "function") {
      return;
    }

    window.addEventListener("beforeprint", expandDisclosuresForPrint);
    window.addEventListener("afterprint", restoreDisclosuresAfterPrint);
  }

  function expandDisclosuresForPrint() {
    if (printDisclosureSnapshot !== null) {
      return;
    }

    printDisclosureSnapshot = Array.from(
      document.querySelectorAll("details.appendix-section")
    ).map((disclosure) => ({ disclosure, wasOpen: disclosure.open }));

    printDisclosureSnapshot.forEach(({ disclosure }) => {
      disclosure.open = true;
    });
  }

  function restoreDisclosuresAfterPrint() {
    if (printDisclosureSnapshot === null) {
      return;
    }

    printDisclosureSnapshot.forEach(({ disclosure, wasOpen }) => {
      disclosure.open = wasOpen;
    });
    printDisclosureSnapshot = null;
  }

  function bindUi() {
    const ids = [
      "presetSelect", "presetDescription", "priorLabel", "truePositiveLabel",
      "falsePositiveLabel", "scenarioQuestion", "pAProseBefore", "pAProseAfter", "pBgAProseBefore",
      "pBgAProseAfter", "pBgNotAProseBefore", "pBgNotAProseAfter", "pAInput", "pAError", "pBgAInput", "pBgAError",
      "pBgNotAInput", "pBgNotAError", "summaryNarrative",
      "conditionalLikelihoodValue", "conditionalLikelihoodText",
      "conditionalPosteriorValue", "conditionalPosteriorText", "frequencyDescription",
      "frequencyPoolAnswer", "evidenceComposition", "evidenceFromHypothesis",
      "populationCanvas", "populationTrueEvidence", "populationHypothesisOnly",
      "populationFalseEvidence", "populationNeither", "populationTrueEvidenceLabel",
      "populationHypothesisOnlyLabel", "populationFalseEvidenceLabel", "populationNeitherLabel",
      "evidenceColumnHeading", "noEvidenceColumnHeading",
      "hypothesisRowHeading", "tableTrueEvidence", "tableMiss", "tableHypothesisTotal",
      "notHypothesisRowHeading", "tableFalseEvidence", "tableCorrectReject",
      "tableNotHypothesisTotal", "tableEvidenceTotal", "tableNoEvidenceTotal",
      "formulaSubstitute", "posteriorResult",
      "baseRateCaption", "baseRateBody", "baseRateTakeaway", "likelihoodRatioValue",
      "likelihoodRatioText", "oddsUpdateText", "evidenceTakeaway", "coinPresetSelect",
      "coinPresetDescription", "alphaInput", "alphaError", "betaInput", "betaError",
      "headsInput", "headsError", "tailsInput", "tailsError",
      "densityDescription", "densitySvgDesc", "densityScaleNote", "priorDensityPath", "posteriorDensityPath",
      "priorShapeGuidePath", "posteriorShapeGuidePath", "shapeGuideLegend",
      "priorMeanLine", "posteriorMeanLine", "priorParameterCell", "priorMeanCell",
      "priorSdCell", "posteriorParameterCell", "posteriorMeanCell", "posteriorSdCell",
      "coinNarrative"
    ];

    return ids.reduce((elements, elementId) => {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error("Missing required element #" + elementId);
      }
      elements[elementId] = element;
      return elements;
    }, {});
  }

  function buildScenarioOptions() {
    SCENARIOS.forEach((scenario) => {
      ui.presetSelect.appendChild(createOption(scenario.id, scenario.label));
    });
    scenarioCustomOption = createOption("custom", "Custom values");
    ui.presetSelect.appendChild(scenarioCustomOption);
  }

  function buildCoinPresetOptions() {
    COIN_PRESETS.forEach((preset) => {
      ui.coinPresetSelect.appendChild(createOption(preset.id, preset.label));
    });
    ui.coinPresetSelect.appendChild(createOption("custom", "Custom values"));
  }

  function createOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function wireProbabilityControls() {
    ui.presetSelect.addEventListener("change", () => {
      if (ui.presetSelect.value === "custom") {
        ui.presetDescription.textContent =
          "Custom values using the " + activeScenario.label.toLowerCase() + " scenario.";
        renderScenarioLanguage();
        updateBayesFromInputs();
        return;
      }

      const scenario = SCENARIOS.find((item) => item.id === ui.presetSelect.value);
      if (scenario) {
        applyScenario(scenario);
      }
    });

    [ui.pAInput, ui.pBgAInput, ui.pBgNotAInput].forEach((input) => {
      input.addEventListener("input", () => {
        markScenarioCustom();
        updateBayesFromInputs();
      });
    });
  }

  function wireCoinControls() {
    ui.coinPresetSelect.addEventListener("change", () => {
      if (ui.coinPresetSelect.value === "custom") {
        ui.coinPresetDescription.textContent = "Using manually entered prior and observation values.";
        updateCoinFromInputs();
        return;
      }

      const preset = COIN_PRESETS.find((item) => item.id === ui.coinPresetSelect.value);
      if (preset) {
        applyCoinPreset(preset);
      }
    });

    [ui.alphaInput, ui.betaInput, ui.headsInput, ui.tailsInput].forEach((input) => {
      input.addEventListener("input", () => {
        ui.coinPresetSelect.value = "custom";
        ui.coinPresetDescription.textContent = "Using manually entered prior and observation values.";
        updateCoinFromInputs();
      });
    });
  }

  function applyScenario(scenario) {
    activeScenario = scenario;
    scenarioCustomOption.textContent = "Custom " + scenario.label.toLowerCase() + " values";
    ui.presetSelect.value = scenario.id;
    ui.presetDescription.textContent = scenario.description;
    ui.pAInput.value = String(scenario.values.prior);
    ui.pBgAInput.value = String(scenario.values.truePositiveRate);
    ui.pBgNotAInput.value = String(scenario.values.falsePositiveRate);
    renderScenarioLanguage();
    updateBayesFromInputs();
  }

  function applyCoinPreset(preset) {
    ui.coinPresetSelect.value = preset.id;
    ui.coinPresetDescription.textContent = preset.description;
    ui.alphaInput.value = String(preset.values.alpha);
    ui.betaInput.value = String(preset.values.beta);
    ui.headsInput.value = String(preset.values.heads);
    ui.tailsInput.value = String(preset.values.tails);
    updateCoinFromInputs();
  }

  function markScenarioCustom() {
    if (ui.presetSelect.value !== "custom") {
      ui.presetSelect.value = "custom";
      scenarioCustomOption.textContent =
        "Custom " + activeScenario.label.toLowerCase() + " values";
      ui.presetDescription.textContent = "Your own " + activeScenario.label.toLowerCase() + " numbers.";
    }
  }

  function renderScenarioLanguage() {
    const scenario = activeScenario;
    ui.priorLabel.textContent = scenario.priorLabel;
    ui.truePositiveLabel.textContent = scenario.truePositiveLabel;
    ui.falsePositiveLabel.textContent = scenario.falsePositiveLabel;
    ui.scenarioQuestion.textContent = scenario.question;
    [["pAProseBefore", "pAProseAfter"], ["pBgAProseBefore", "pBgAProseAfter"], ["pBgNotAProseBefore", "pBgNotAProseAfter"]]
      .forEach(([before, after], index) => {
        ui[before].textContent = scenario.prose[index][0];
        ui[after].textContent = scenario.prose[index][1];
      });
    ui.evidenceColumnHeading.textContent = scenario.evidenceLabel;
    ui.noEvidenceColumnHeading.textContent = scenario.noEvidenceLabel;
    ui.hypothesisRowHeading.textContent = scenario.hypothesisLabel;
    ui.notHypothesisRowHeading.textContent = scenario.notHypothesisLabel;
    ui.populationTrueEvidenceLabel.textContent =
      scenario.hypothesisLabel + " and " + scenario.evidenceLabel.toLowerCase();
    ui.populationHypothesisOnlyLabel.textContent =
      scenario.hypothesisLabel + ", " + scenario.noEvidenceLabel.toLowerCase();
    ui.populationFalseEvidenceLabel.textContent =
      scenario.notHypothesisLabel + ", but " + scenario.evidenceLabel.toLowerCase();
    ui.populationNeitherLabel.textContent =
      scenario.notHypothesisLabel + " and " + scenario.noEvidenceLabel.toLowerCase();
  }

  function updateBayesFromInputs() {
    const validation = core.validatePercentInputs({
      prior: ui.pAInput.value,
      truePositiveRate: ui.pBgAInput.value,
      falsePositiveRate: ui.pBgNotAInput.value
    });

    renderBayesValidation(validation.errors);

    if (!validation.ok) {
      renderBayesUnavailable();
      return;
    }

    const model = core.computeBayes(validation.values);
    const frequency = core.buildFrequencyModel(model, COHORT_SIZE);
    renderBayesModel(model, frequency);
  }

  function renderBayesValidation(errors) {
    const bindings = {
      prior: [ui.pAInput, ui.pAError],
      truePositiveRate: [ui.pBgAInput, ui.pBgAError],
      falsePositiveRate: [ui.pBgNotAInput, ui.pBgNotAError]
    };

    Object.entries(bindings).forEach(([field, elements]) => {
      const message = errors[field] || "";
      elements[0].setAttribute("aria-invalid", message ? "true" : "false");
      elements[1].textContent = message ? "Error: " + message : "";
    });
  }

  function renderBayesModel(model, frequency) {
    renderSummary(model);
    renderConditional(model);
    renderFrequency(model, frequency);
    renderPosterior(model);
    renderBaseRate(model);
    renderEvidenceStrength(model);
  }

  function renderSummary(model) {
    if (model.posterior === null) {
      ui.summaryNarrative.textContent = "P(A|B) is undefined because P(B) = 0.";
      return;
    }
    ui.summaryNarrative.textContent =
      "P(A|B) = " + core.formatPercent(model.posterior) +
      "  (prior " + core.formatPercent(model.prior) +
      ", P(B) " + core.formatPercent(model.pEvidence) + ")";
  }

  function renderConditional(model) {
    const likelihood = core.formatPercent(model.truePositiveRate);
    ui.conditionalLikelihoodValue.textContent = likelihood;
    ui.conditionalLikelihoodText.textContent = activeScenario.likelihoodSentence(likelihood);
    ui.conditionalPosteriorValue.textContent = core.formatPercent(model.posterior);
    ui.conditionalPosteriorText.textContent =
      model.posterior === null
        ? "The reverse probability is undefined because the evidence never occurs."
        : activeScenario.posteriorSentence(core.formatPercent(model.posterior));
  }

  function renderFrequency(model, frequency) {
    const count = core.formatCount;
    ui.frequencyDescription.textContent =
      "Expected counts out of 10,000 for the " + activeScenario.label.toLowerCase() + " model.";
    ui.frequencyPoolAnswer.textContent =
      model.posterior === null
        ? "Nobody gets " + activeScenario.evidenceLabel.toLowerCase() + ", so there is nothing to work out."
        : count(frequency.evidence.total) + " " + activeScenario.evidencePlural + ". " +
          count(frequency.evidence.fromHypothesis) + " of them come from " +
          activeScenario.hypothesisSource + ".";

    ui.tableTrueEvidence.textContent = count(frequency.hypothesis.evidence);
    ui.tableMiss.textContent = count(frequency.hypothesis.noEvidence);
    ui.tableHypothesisTotal.textContent = count(frequency.hypothesis.total);
    ui.tableFalseEvidence.textContent = count(frequency.nonHypothesis.evidence);
    ui.tableCorrectReject.textContent = count(frequency.nonHypothesis.noEvidence);
    ui.tableNotHypothesisTotal.textContent = count(frequency.nonHypothesis.total);
    ui.tableEvidenceTotal.textContent = count(frequency.evidence.total);
    ui.tableNoEvidenceTotal.textContent = count(frequency.noEvidence.total);
    renderPopulation(frequency);
    renderEvidenceComposition(model);
  }

  function renderPopulation(frequency) {
    const values = [
      frequency.hypothesis.evidence,
      frequency.hypothesis.noEvidence,
      frequency.nonHypothesis.evidence,
      frequency.nonHypothesis.noEvidence
    ];
    const labels = [
      activeScenario.hypothesisLabel + " and " + activeScenario.evidenceLabel.toLowerCase(),
      activeScenario.hypothesisLabel + " and " + activeScenario.noEvidenceLabel.toLowerCase(),
      activeScenario.notHypothesisLabel + " and " + activeScenario.evidenceLabel.toLowerCase(),
      activeScenario.notHypothesisLabel + " and " + activeScenario.noEvidenceLabel.toLowerCase()
    ];

    ui.populationTrueEvidence.textContent = core.formatCount(values[0]);
    ui.populationHypothesisOnly.textContent = core.formatCount(values[1]);
    ui.populationFalseEvidence.textContent = core.formatCount(values[2]);
    ui.populationNeither.textContent = core.formatCount(values[3]);
    ui.populationCanvas.setAttribute(
      "aria-label",
      "Population of 10,000 modeled cases: " + labels
        .map((label, index) => core.formatCount(values[index]) + " " + label)
        .join("; ") + "."
    );

    if (typeof ui.populationCanvas.getContext !== "function") {
      return;
    }
    const context = ui.populationCanvas.getContext("2d");
    if (!context) {
      return;
    }

    const roundedCounts = allocatePopulationMarks(values, COHORT_SIZE);
    const styles = typeof window.getComputedStyle === "function"
      ? window.getComputedStyle(document.documentElement)
      : null;
    const colors = [
      styles ? styles.getPropertyValue("--true-evidence").trim() : "#34414c",
      styles ? styles.getPropertyValue("--hypothesis-only").trim() : "#8f5d12",
      styles ? styles.getPropertyValue("--false-evidence").trim() : "#c43d2f",
      styles ? styles.getPropertyValue("--neither").trim() : "#d8d6d1"
    ];

    context.clearRect(0, 0, 500, 500);
    let mark = 0;
    roundedCounts.forEach((categoryCount, category) => {
      context.fillStyle = colors[category];
      for (let categoryMark = 0; categoryMark < categoryCount; categoryMark += 1) {
        const x = (mark % 100) * 5;
        const y = Math.floor(mark / 100) * 5;
        context.fillRect(x, y, 4, 4);
        mark += 1;
      }
    });
  }

  function allocatePopulationMarks(values, total) {
    const floors = values.map((value) => Math.max(0, Math.floor(value)));
    let remainder = total - floors.reduce((sum, value) => sum + value, 0);
    const fractions = values
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
    for (let index = 0; index < remainder; index += 1) {
      floors[fractions[index % fractions.length].index] += 1;
    }
    return floors;
  }

  function renderEvidenceComposition(model) {
    if (model.posterior === null) {
      clearEvidenceComposition("Evidence composition unavailable because no evidence cases occur.");
      return;
    }

    const share = Math.max(0, Math.min(1, model.posterior));
    ui.evidenceComposition.hidden = false;
    ui.evidenceFromHypothesis.setAttribute("width", String(share * 100) + "%");
    ui.evidenceComposition.setAttribute(
      "aria-label",
      "Evidence composition. Of all " + activeScenario.evidencePlural + ": " +
        activeScenario.hypothesisLabel + ", " + core.formatPercent(share) + "; " +
        activeScenario.notHypothesisLabel + ", " + core.formatPercent(1 - share) + "."
    );
  }

  function clearEvidenceComposition(message) {
    ui.evidenceFromHypothesis.setAttribute("width", "0%");
    ui.evidenceComposition.setAttribute("aria-label", message);
    ui.evidenceComposition.hidden = true;
  }

  function renderPosterior(model) {
    const prior = core.formatDecimal(model.prior, { maximumSignificantDigits: 5 });
    const trueRate = core.formatDecimal(model.truePositiveRate, { maximumSignificantDigits: 5 });
    const falseRate = core.formatDecimal(model.falsePositiveRate, { maximumSignificantDigits: 5 });
    const complement = core.formatDecimal(model.complementPrior, { maximumSignificantDigits: 5 });

    if (model.posterior === null) {
      ui.formulaSubstitute.textContent =
        "Both evidence paths sum to zero, so P(B) = 0 and division is not defined.";
      ui.posteriorResult.textContent = "Posterior P(A|B): undefined";
    } else {
      ui.formulaSubstitute.textContent =
        "P(A|B) = (" + trueRate + " × " + prior + ") / [(" + trueRate + " × " +
        prior + ") + (" + falseRate + " × " + complement + ")] = " +
        core.formatDecimal(model.posterior, { maximumSignificantDigits: 5 });
      ui.posteriorResult.textContent =
        "Posterior P(A|B): " + core.formatPercent(model.posterior);
    }

  }

  function renderBaseRate(model) {
    const priors = uniqueSortedNumbers([0.01, model.prior, 0.1, 0.5]);
    ui.baseRateBody.replaceChildren();
    ui.baseRateCaption.textContent =
      "Expected evidence per 10,000 with " + core.formatPercent(model.truePositiveRate) +
      " likelihood and " + core.formatPercent(model.falsePositiveRate) + " false-evidence rate";

    priors.forEach((prior) => {
      const comparison = core.computeBayes({
        prior,
        truePositiveRate: model.truePositiveRate,
        falsePositiveRate: model.falsePositiveRate
      });
      const frequency = core.buildFrequencyModel(comparison, COHORT_SIZE);
      const row = document.createElement("tr");
      if (nearlyEqual(prior, model.prior)) {
        row.setAttribute("aria-current", "true");
      }

      const priorCell = document.createElement("th");
      priorCell.scope = "row";
      priorCell.textContent = core.formatPercent(prior);
      if (nearlyEqual(prior, model.prior)) {
        const currentBadge = document.createElement("span");
        currentBadge.textContent = " (current)";
        priorCell.appendChild(currentBadge);
      }
      row.appendChild(priorCell);
      row.appendChild(createCell(core.formatCount(frequency.evidence.fromHypothesis)));
      row.appendChild(createCell(core.formatCount(frequency.evidence.fromNonHypothesis)));
      row.appendChild(createCell(core.formatPercent(comparison.posterior)));
      row.appendChild(createCell(formatPercentagePointChange(comparison.posterior, prior)));
      ui.baseRateBody.appendChild(row);
    });

    const defined = priors
      .map((prior) => core.computeBayes({
        prior,
        truePositiveRate: model.truePositiveRate,
        falsePositiveRate: model.falsePositiveRate
      }))
      .filter((comparison) => comparison.posterior !== null);

    if (defined.length === 0) {
      ui.baseRateTakeaway.textContent =
        "The evidence is impossible at every comparison prior, so none of the posteriors is defined.";
    } else if (model.truePositiveRate === 0) {
      ui.baseRateTakeaway.textContent =
        "The true-evidence path is zero. Whenever the evidence occurs, it comes only from the alternative, so every defined posterior is 0%.";
    } else if (model.falsePositiveRate === 0) {
      ui.baseRateTakeaway.textContent =
        "The false-evidence path is zero. Whenever the evidence occurs, it identifies the hypothesis perfectly, so every defined posterior is 100%.";
    } else if (model.evidenceDirection === "neutral") {
      ui.baseRateTakeaway.textContent =
        "The evidence is equally likely either way, so it is neutral: each posterior stays equal to its prior.";
    } else {
      ui.baseRateTakeaway.textContent =
        "The evidence quality is unchanged across the table. Higher starting prevalence changes the mix of true and false paths in the evidence pool.";
    }
  }

  function renderEvidenceStrength(model) {
    ui.likelihoodRatioValue.textContent = core.formatRatio(model.likelihoodRatio);

    if (model.pEvidence === 0) {
      ui.likelihoodRatioText.textContent =
        "Evidence strength cannot be interpreted because the evidence never occurs in this model.";
      ui.oddsUpdateText.textContent = "The odds update is undefined when P(B) = 0.";
      ui.evidenceTakeaway.textContent =
        "Adjust at least one path into the evidence pool before interpreting its strength.";
      return;
    }

    if (model.evidenceDirection === "supports") {
      ui.likelihoodRatioText.textContent =
        "The evidence is more expected when the hypothesis is true, so it supports the hypothesis.";
    } else if (model.evidenceDirection === "opposes") {
      ui.likelihoodRatioText.textContent =
        "The evidence is less expected when the hypothesis is true, so it counts against the hypothesis.";
    } else {
      ui.likelihoodRatioText.textContent =
        "The evidence is equally expected either way, so it does not distinguish the two possibilities.";
    }

    ui.oddsUpdateText.textContent =
      formatOdds(model.priorOdds) + " × " + formatLikelihoodFactor(model.likelihoodRatio) +
      " = " + formatOdds(model.posteriorOdds) + ".";
    ui.evidenceTakeaway.textContent =
      "Evidence changes odds by a multiplier, but the prior still determines where that multiplication begins.";
  }

  function renderBayesUnavailable() {
    ui.summaryNarrative.textContent = "Enter valid percentages from 0 to 100.";
    ui.conditionalLikelihoodValue.textContent = "—";
    ui.conditionalPosteriorValue.textContent = "—";
    ui.conditionalLikelihoodText.textContent = "Enter valid percentages to compare these two conditional probabilities.";
    ui.conditionalPosteriorText.textContent = "No previous result is retained while the form is invalid.";

    [
      ui.tableTrueEvidence, ui.tableMiss, ui.tableHypothesisTotal,
      ui.tableFalseEvidence, ui.tableCorrectReject, ui.tableNotHypothesisTotal,
      ui.tableEvidenceTotal, ui.tableNoEvidenceTotal, ui.likelihoodRatioValue
    ].forEach(setDash);
    [
      ui.populationTrueEvidence, ui.populationHypothesisOnly,
      ui.populationFalseEvidence, ui.populationNeither
    ].forEach(setDash);
    ui.populationCanvas.setAttribute(
      "aria-label",
      "Population graphic unavailable while an input is invalid."
    );
    if (typeof ui.populationCanvas.getContext === "function") {
      const context = ui.populationCanvas.getContext("2d");
      if (context) {
        context.clearRect(0, 0, 500, 500);
      }
    }
    ui.frequencyDescription.textContent = "Expected counts are unavailable while an input is invalid.";
    ui.frequencyPoolAnswer.textContent = "Unavailable.";
    clearEvidenceComposition("Evidence composition unavailable while an input is invalid.");
    ui.formulaSubstitute.textContent = "Correct the highlighted input to substitute values into Bayes theorem.";
    ui.posteriorResult.textContent = "Posterior P(A|B): unavailable";
    renderUnavailableBaseRateRow();
    ui.baseRateCaption.textContent = "Base-rate comparison unavailable while an input is invalid";
    ui.baseRateTakeaway.textContent = "Base-rate comparisons are hidden until the model is valid.";
    ui.likelihoodRatioText.textContent = "Evidence strength is unavailable while the model is invalid.";
    ui.oddsUpdateText.textContent = "Odds update unavailable.";
    ui.evidenceTakeaway.textContent = "Enter three valid percentages from 0 to 100.";
  }

  function renderUnavailableBaseRateRow() {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Correct the highlighted input to compare base rates.";
    row.appendChild(cell);
    ui.baseRateBody.replaceChildren(row);
  }

  function updateCoinFromInputs() {
    const validation = core.validateBetaInputs({
      alpha: ui.alphaInput.value,
      beta: ui.betaInput.value,
      heads: ui.headsInput.value,
      tails: ui.tailsInput.value
    });
    renderCoinValidation(validation.errors);

    if (!validation.ok) {
      renderCoinUnavailable();
      return;
    }

    renderCoinModel(core.computeBetaModel(validation.values));
  }

  function renderCoinValidation(errors) {
    const bindings = {
      alpha: [ui.alphaInput, ui.alphaError],
      beta: [ui.betaInput, ui.betaError],
      heads: [ui.headsInput, ui.headsError],
      tails: [ui.tailsInput, ui.tailsError]
    };

    Object.entries(bindings).forEach(([field, elements]) => {
      const message = errors[field] || "";
      elements[0].setAttribute("aria-invalid", message ? "true" : "false");
      elements[1].textContent = message ? "Error: " + message : "";
    });
  }

  function renderCoinModel(model) {
    ui.priorDensityPath.setAttribute("d", buildDensityPath(model.priorSeries));
    ui.posteriorDensityPath.setAttribute("d", buildDensityPath(model.posteriorSeries));
    setMeanLine(ui.priorMeanLine, model.prior.mean);
    setMeanLine(ui.posteriorMeanLine, model.posterior.mean);
    ui.priorMeanLine.style.display = "";
    ui.posteriorMeanLine.style.display = "";

    ui.priorParameterCell.textContent = formatBetaParameters(model.prior);
    ui.posteriorParameterCell.textContent = formatBetaParameters(model.posterior);
    ui.priorMeanCell.textContent = core.formatPercent(model.prior.mean);
    ui.posteriorMeanCell.textContent = core.formatPercent(model.posterior.mean);
    ui.priorSdCell.textContent = core.formatPercent(model.prior.sd);
    ui.posteriorSdCell.textContent = core.formatPercent(model.posterior.sd);

    const priorCompressed = model.priorSeries.yMax < 0.01;
    const posteriorCompressed = model.posteriorSeries.yMax < 0.01;
    const compressedCurve = priorCompressed || posteriorCompressed;
    renderShapeGuide(ui.priorShapeGuidePath, model.priorSeries, priorCompressed);
    renderShapeGuide(ui.posteriorShapeGuidePath, model.posteriorSeries, posteriorCompressed);
    ui.shapeGuideLegend.hidden = !compressedCurve;
    const scaleNote = compressedCurve
      ? " A dotted, individually scaled guide reveals the compressed curve's shape while the main curves retain their shared density scale."
      : "";
    const description =
      "Prior " + formatBetaParameters(model.prior) + " has mean " +
      core.formatPercent(model.prior.mean) + ". Posterior " +
      formatBetaParameters(model.posterior) + " has mean " +
      core.formatPercent(model.posterior.mean) + " after " + model.observations.heads +
      " heads and " + model.observations.tails + " tails." + scaleNote;
    ui.densityDescription.textContent = description;
    ui.densitySvgDesc.textContent = description;
    ui.densityScaleNote.textContent = compressedCurve
      ? "Shared-scale note: the main curves remain directly comparable; a dotted guide rescales only the compressed curve to make its shape visible."
      : "Both curves use one shared density scale, so their relative heights are directly comparable.";

    if (model.observations.total === 0) {
      ui.coinNarrative.textContent =
        "No observations were added, so the posterior is identical to the prior: the mean and uncertainty are unchanged.";
      return;
    }

    const meanDirection =
      model.meanChange > 0 ? "up" : model.meanChange < 0 ? "down" : "not at all";
    ui.coinNarrative.textContent =
      "After " + model.observations.total + " observations, the mean moves " + meanDirection +
      " from " + core.formatPercent(model.prior.mean) + " to " +
      core.formatPercent(model.posterior.mean) + ". The standard deviation changes from " +
      core.formatPercent(model.prior.sd) + " to " + core.formatPercent(model.posterior.sd) +
      ", so uncertainty is " + model.uncertaintyChange + ".";
  }

  function renderCoinUnavailable() {
    ui.priorDensityPath.setAttribute("d", "");
    ui.posteriorDensityPath.setAttribute("d", "");
    ui.priorShapeGuidePath.setAttribute("d", "");
    ui.posteriorShapeGuidePath.setAttribute("d", "");
    ui.priorShapeGuidePath.setAttribute("hidden", "");
    ui.posteriorShapeGuidePath.setAttribute("hidden", "");
    ui.shapeGuideLegend.hidden = true;
    ui.priorMeanLine.style.display = "none";
    ui.posteriorMeanLine.style.display = "none";
    [
      ui.priorParameterCell, ui.priorMeanCell, ui.priorSdCell,
      ui.posteriorParameterCell, ui.posteriorMeanCell, ui.posteriorSdCell
    ].forEach(setDash);
    ui.densityDescription.textContent = "The density chart is unavailable while an input is invalid.";
    ui.densitySvgDesc.textContent = "Coin-bias chart unavailable because an input is invalid.";
    ui.densityScaleNote.textContent = "Correct the highlighted input to restore the shared-scale comparison.";
    ui.coinNarrative.textContent = "Correct the highlighted input to update the prior and posterior.";
  }

  function buildDensityPath(series) {
    return series.points
      .map((point, index) => {
        const x = CHART.left + point.x * (CHART.right - CHART.left);
        const y = CHART.bottom - point.y * (CHART.bottom - CHART.top);
        return (index === 0 ? "M " : "L ") + x.toFixed(3) + " " + y.toFixed(3);
      })
      .join(" ");
  }

  function renderShapeGuide(path, series, visible) {
    if (!visible) {
      path.setAttribute("hidden", "");
      path.setAttribute("d", "");
      return;
    }

    path.removeAttribute("hidden");
    const ownScaleSeries = {
      points: series.points.map((point) => {
        const logDifference = point.logDensity - series.logPeak;
        return {
          x: point.x,
          y: logDifference < -745 ? 0 : Math.exp(Math.min(0, logDifference))
        };
      })
    };
    path.setAttribute("d", buildDensityPath(ownScaleSeries));
  }

  function setMeanLine(line, mean) {
    const x = CHART.left + mean * (CHART.right - CHART.left);
    line.setAttribute("x1", x.toFixed(3));
    line.setAttribute("x2", x.toFixed(3));
  }

  function formatBetaParameters(statistics) {
    return "Beta(" + core.formatDecimal(statistics.alpha, { maximumSignificantDigits: 5 }) +
      ", " + core.formatDecimal(statistics.beta, { maximumSignificantDigits: 5 }) + ")";
  }

  function formatOdds(value) {
    if (value === null) {
      return "undefined";
    }
    return core.formatDecimal(value, { maximumSignificantDigits: 4 });
  }

  function formatLikelihoodFactor(value) {
    if (value === null) {
      return "undefined";
    }
    return core.formatDecimal(value, { maximumSignificantDigits: 4 });
  }

  function formatPercentagePointChange(posterior, prior) {
    if (posterior === null) {
      return "undefined";
    }
    const points = (posterior - prior) * 100;
    const sign = points > 0 ? "+" : "";
    return sign + core.formatDecimal(points, { maximumSignificantDigits: 3, scientificBelow: 0 }) + " pp";
  }

  function uniqueSortedNumbers(values) {
    const unique = [];
    values.forEach((value) => {
      if (!unique.some((existing) => nearlyEqual(existing, value))) {
        unique.push(value);
      }
    });
    return unique.sort((left, right) => left - right);
  }

  function nearlyEqual(left, right) {
    return Math.abs(left - right) <= 1e-12;
  }

  function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
  }

  function setDash(element) {
    element.textContent = "—";
  }
})();
