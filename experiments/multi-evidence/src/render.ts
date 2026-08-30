namespace App {
  export function renderModeVisibility(ui: UiElements, state: AppState): void {
    const hypothesisVisible = state.mode === "hypothesis";
    ui.hypothesisControls.hidden = !hypothesisVisible;
    ui.hypothesisTheory.hidden = !hypothesisVisible;
    ui.hypothesisVisualization.hidden = !hypothesisVisible;
    ui.hypothesisResults.hidden = !hypothesisVisible;
    ui.parameterRoot.hidden = hypothesisVisible;
  }

  export function renderStepOnly(ui: UiElements, state: AppState): void {
    const step = currentStepDefinition(state);
    ui.stepCounter.textContent =
      "Step " + String(state.currentStep) + " of " + String(STEPS.length);
    ui.stepTitle.textContent = step.title;
    ui.stepTheory.textContent = step.theory;
    ui.stepFormula.textContent = step.formula;
    ui.stepKey.textContent = "";
    ui.stepFocus.textContent = step.focusLine;
    ui.vennSvg.setAttribute("data-focus", step.focus);

    updateStepNavigation(ui, state);
    toggleStepPanels(ui, step);
  }

  export function renderAll(ui: UiElements, state: AppState, model: SequentialModel): void {
    const step = currentStepDefinition(state);
    renderStep(ui, state, step, model);
    renderProgression(ui, model);
    renderResults(ui, model);
    renderVenn(ui, step, model, state);
  }

  export function clearOutputs(ui: UiElements): void {
    ui.formulaSubstitute.textContent = "";
    ui.posteriorValue.textContent = "";
    ui.pB1Value.textContent = "-";
    ui.pA_B1Value.textContent = "-";
    ui.pB2_B1Value.textContent = "-";
    ui.pA_B1B2Value.textContent = "-";
    ui.pB1B2Value.textContent = "-";
    ui.interpretationText.textContent = "";
    ui.priorValue.textContent = "";
    ui.postB1Value.textContent = "";
    ui.postB1B2Value.textContent = "";
    ui.progressionDelta.textContent = "";
    ui.contribB1Text.textContent = "";
    ui.contribB2Text.textContent = "";
    ui.lr1Value.textContent = "";
    ui.lr2Value.textContent = "";
    ui.oddsValue.textContent = "";
    ui.strengthNote.textContent = "";
    ui.contribB1A.style.width = "0%";
    ui.contribB1NotA.style.width = "0%";
    ui.contribB2A.style.width = "0%";
    ui.contribB2NotA.style.width = "0%";
  }

  export function clearCoinOutputs(ui: UiElements): void {
    ui.parameterError.textContent = "";
    ui.posteriorParamText.textContent = "";
    ui.parameterNarrative.textContent = "";
    ui.priorDensityPath.setAttribute("d", "");
    ui.posteriorDensityPath.setAttribute("d", "");
    ui.priorDensityLabel.textContent = "";
    ui.posteriorDensityLabel.textContent = "";
  }

  export function renderCoinMode(ui: UiElements, model: CoinModel): void {
    const priorMean = model.inputs.alpha / (model.inputs.alpha + model.inputs.beta);
    const posteriorMean =
      model.posterior.alpha / (model.posterior.alpha + model.posterior.beta);
    const priorStrength = model.inputs.alpha + model.inputs.beta;
    const posteriorStrength = model.posterior.alpha + model.posterior.beta;
    const totalObservations = model.inputs.heads + model.inputs.tails;

    ui.posteriorParamText.textContent =
      "Posterior: Beta(" +
      formatDecimal(model.posterior.alpha) +
      ", " +
      formatDecimal(model.posterior.beta) +
      ")";

    ui.parameterNarrative.textContent =
      "Prior mean E[p] = " +
      formatPercent(priorMean) +
      ". After " +
      String(totalObservations) +
      " observations (" +
      String(model.inputs.heads) +
      " heads, " +
      String(model.inputs.tails) +
      " tails), posterior mean becomes " +
      formatPercent(posteriorMean) +
      " (" +
      formatSignedPercent(posteriorMean - priorMean) +
      "). Total concentration increases from " +
      formatDecimal(priorStrength) +
      " to " +
      formatDecimal(posteriorStrength) +
      ", so uncertainty narrows as evidence accumulates.";

    ui.priorDensityLabel.textContent =
      "Prior Beta(" +
      formatDecimal(model.inputs.alpha) +
      ", " +
      formatDecimal(model.inputs.beta) +
      ")";

    ui.posteriorDensityLabel.textContent =
      "Posterior Beta(" +
      formatDecimal(model.posterior.alpha) +
      ", " +
      formatDecimal(model.posterior.beta) +
      ")";

    const priorPath = buildDensityPath(model.priorSeries, model.sharedYMax);
    const posteriorPath = buildDensityPath(model.posteriorSeries, model.sharedYMax);
    ui.priorDensityPath.setAttribute("d", priorPath);
    ui.posteriorDensityPath.setAttribute("d", posteriorPath);
  }

  function renderStep(
    ui: UiElements,
    state: AppState,
    step: StepDefinition,
    model: SequentialModel
  ): void {
    ui.stepCounter.textContent =
      "Step " + String(state.currentStep) + " of " + String(STEPS.length);
    ui.stepTitle.textContent = step.title;
    ui.stepTheory.textContent = step.theory;
    ui.stepFormula.textContent = step.formula;
    ui.stepKey.textContent = describeStepKey(step.keyKind, model);
    ui.stepFocus.textContent = step.focusLine;

    updateStepNavigation(ui, state);
    toggleStepPanels(ui, step);

    if (step.showContribB1) {
      renderB1Contribution(ui, model);
    }
    if (step.showContribB2) {
      renderB2Contribution(ui, model);
    }
    if (step.showStrength) {
      renderStrengthPanel(ui, model);
    }
  }

  function updateStepNavigation(ui: UiElements, state: AppState): void {
    const chips = ui.stepChips.querySelectorAll(".chip");
    chips.forEach((chipNode) => {
      if (!(chipNode instanceof HTMLElement)) {
        return;
      }
      const step = Number(chipNode.dataset.step ?? "0");
      const active = step === state.currentStep;
      chipNode.classList.toggle("active", active);
      chipNode.setAttribute("aria-pressed", active ? "true" : "false");
    });

    ui.prevStepBtn.disabled = state.currentStep === 1;
    ui.nextStepBtn.disabled = state.currentStep === STEPS.length;
  }

  function toggleStepPanels(ui: UiElements, step: StepDefinition): void {
    ui.contribB1Panel.hidden = !step.showContribB1;
    ui.contribB2Panel.hidden = !step.showContribB2;
    ui.strengthPanel.hidden = !step.showStrength;
  }

  function renderProgression(ui: UiElements, model: SequentialModel): void {
    ui.priorValue.textContent = formatWithPercent(model.inputs.pA);
    ui.postB1Value.textContent = formatWithPercent(model.stage1.posterior);
    ui.postB1B2Value.textContent = formatWithPercent(model.stage2.posterior);

    if (model.stage2.posterior === null) {
      ui.progressionDelta.textContent =
        "Final posterior is undefined because a conditioning denominator is zero.";
      return;
    }

    ui.progressionDelta.textContent =
      "Net change from prior to final posterior: " +
      formatSignedPercent(model.stage2.posterior - model.inputs.pA) +
      ".";
  }

  function renderResults(ui: UiElements, model: SequentialModel): void {
    ui.pB1Value.textContent = formatWithPercent(model.stage1.pB);
    ui.pA_B1Value.textContent = formatWithPercent(model.stage1.posterior);
    ui.pB2_B1Value.textContent = formatWithPercent(model.stage2.pB);
    ui.pA_B1B2Value.textContent = formatWithPercent(model.stage2.posterior);
    ui.pB1B2Value.textContent = formatWithPercent(model.pB1B2);

    if (model.stage2.posterior === null) {
      ui.formulaSubstitute.textContent =
        "P(A|B1,B2) is undefined because at least one denominator is zero.";
      ui.posteriorValue.textContent = "Final posterior: undefined";
      ui.interpretationText.textContent =
        "Adjust inputs so evidence events have non-zero probability mass.";
      return;
    }

    ui.formulaSubstitute.textContent =
      "P(A|B1,B2) = (" +
      formatDecimal(model.inputs.pB2gA) +
      " * " +
      formatDecimal(model.stage1.posterior) +
      ") / " +
      formatDecimal(model.stage2.pB) +
      " = " +
      formatDecimal(model.stage2.posterior);

    ui.posteriorValue.textContent =
      "Final posterior P(A|B1,B2): " + formatPercent(model.stage2.posterior);
    ui.interpretationText.textContent =
      "Prior " +
      formatPercent(model.inputs.pA) +
      " changes to " +
      formatPercent(model.stage1.posterior) +
      " after B1 and to " +
      formatPercent(model.stage2.posterior) +
      " after B2.";
  }

  function renderB1Contribution(ui: UiElements, model: SequentialModel): void {
    ui.contribB1Text.textContent =
      "P(B1) = " +
      formatDecimal(model.stage1.fromA) +
      " + " +
      formatDecimal(model.stage1.fromNotA) +
      " = " +
      formatDecimal(model.stage1.pB) +
      ".";

    ui.contribB1A.style.width = (model.stage1.shareA * 100).toFixed(1) + "%";
    ui.contribB1NotA.style.width =
      (model.stage1.shareNotA * 100).toFixed(1) + "%";
  }

  function renderB2Contribution(ui: UiElements, model: SequentialModel): void {
    if (model.stage2.pB === null) {
      ui.contribB2Text.textContent =
        "B2 update is undefined because B1 does not produce a conditionable prior.";
      ui.contribB2A.style.width = "0%";
      ui.contribB2NotA.style.width = "0%";
      return;
    }

    ui.contribB2Text.textContent =
      "P(B2|B1) = " +
      formatDecimal(model.stage2.fromA) +
      " + " +
      formatDecimal(model.stage2.fromNotA) +
      " = " +
      formatDecimal(model.stage2.pB) +
      ".";

    ui.contribB2A.style.width = (model.stage2.shareA * 100).toFixed(1) + "%";
    ui.contribB2NotA.style.width =
      (model.stage2.shareNotA * 100).toFixed(1) + "%";
  }

  function renderStrengthPanel(ui: UiElements, model: SequentialModel): void {
    ui.lr1Value.textContent = formatRatio(model.lr1);
    ui.lr2Value.textContent = formatRatio(model.lr2);

    if (model.oddsAfterB2 === null) {
      ui.oddsValue.textContent = "undefined";
      ui.strengthNote.textContent =
        "Final posterior odds are unavailable because of zero denominator.";
      return;
    }

    ui.oddsValue.textContent =
      formatOdds(model.priorOdds) +
      " -> " +
      formatOdds(model.oddsAfterB2) +
      " using LR1*LR2 = " +
      formatRatio(productRatio(model.lr1, model.lr2));

    ui.strengthNote.textContent = strengthSummary(model.lr1, model.lr2);
  }

  function renderVenn(
    ui: UiElements,
    step: StepDefinition,
    model: SequentialModel,
    state: AppState
  ): void {
    const stage = state.currentStep >= 3 ? model.stage2 : model.stage1;
    const evidenceLabel = state.currentStep >= 3 ? "B2" : "B1";
    const prior = stage.prior ?? 0;
    const pEvidence = stage.pB ?? 0;
    const pIntersection = stage.fromA ?? 0;

    const rA = radiusFromProbability(prior);
    const rB = radiusFromProbability(pEvidence);
    const targetArea = pIntersection * Math.PI * MAX_RADIUS * MAX_RADIUS;
    const distance = solveCircleDistance(rA, rB, targetArea);
    const xA = CENTER_X - distance / 2;
    const xB = CENTER_X + distance / 2;

    setCircle(ui.circleA, xA, CENTER_Y, rA);
    setCircle(ui.clipCircleA, xA, CENTER_Y, rA);
    setCircle(ui.circleB, xB, CENTER_Y, rB);
    setCircle(ui.overlapCircle, xB, CENTER_Y, rB);

    ui.vennSvg.setAttribute("data-focus", step.focus);
    ui.labelA.setAttribute("x", String(xA - Math.max(14, rA * 0.4)));
    ui.labelA.setAttribute("y", String(CENTER_Y - Math.max(14, rA + 10)));
    ui.labelA.textContent =
      state.currentStep >= 3
        ? "A|B1: " + formatPercent(prior)
        : "A: " + formatPercent(prior);

    ui.labelB.setAttribute("x", String(xB - Math.max(10, rB * 0.2)));
    ui.labelB.setAttribute("y", String(CENTER_Y - Math.max(14, rB + 10)));
    ui.labelB.textContent = evidenceLabel + ": " + formatPercent(pEvidence);

    ui.labelIntersection.setAttribute("x", String((xA + xB) / 2 - 36));
    ui.labelIntersection.setAttribute("y", String(CENTER_Y + 4));
    ui.labelIntersection.textContent =
      "A&" + evidenceLabel + ": " + formatPercent(pIntersection);

    ui.labelPosterior.setAttribute("x", String(xB - Math.max(52, rB * 0.58)));
    ui.labelPosterior.textContent =
      stage.posterior === null
        ? "Posterior: undefined"
        : "Posterior: " + formatPercent(stage.posterior);
  }

  function setCircle(
    circle: SVGCircleElement,
    cx: number,
    cy: number,
    radius: number
  ): void {
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(Math.max(0, radius)));
  }

  function describeStepKey(kind: StepKeyKind, model: SequentialModel): string {
    switch (kind) {
      case "prior":
        return (
          "Prior is " +
          formatPercent(model.inputs.pA) +
          ", so P(~A) is " +
          formatPercent(1 - model.inputs.pA) +
          "."
        );
      case "stage1":
        return model.stage1.posterior === null
          ? "P(A|B1) is undefined because P(B1)=0."
          : "After B1, posterior is " + formatPercent(model.stage1.posterior) + ".";
      case "stage2":
        return model.stage2.posterior === null
          ? "P(A|B1,B2) is undefined at this setting."
          : "After B1 and B2, posterior is " + formatPercent(model.stage2.posterior) + ".";
      case "strength":
        return strengthSummary(model.lr1, model.lr2);
      default:
        return "";
    }
  }

  function strengthSummary(lr1: number | null, lr2: number | null): string {
    const combined = productRatio(lr1, lr2);
    if (combined === null) {
      return "Combined evidence strength is undefined at this input boundary.";
    }
    if (combined === Infinity) {
      return "Combined evidence strongly favors A.";
    }
    if (combined > 1.1) {
      return "Combined evidence favors A.";
    }
    if (combined < 0.9) {
      return "Combined evidence weighs against A.";
    }
    return "Combined evidence is weakly informative.";
  }

  function formatOdds(value: number): string {
    if (value === Infinity) {
      return "infinite";
    }
    return value.toFixed(4);
  }

  function buildDensityPath(series: DensitySeries, yMax: number): string {
    const width = 360;
    const height = 220;
    const padding = 28;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const safeMax = yMax <= 0 ? 1 : yMax;

    const commands: string[] = [];
    for (const [i, point] of series.points.entries()) {
      const x = padding + point.x * plotWidth;
      const y = height - padding - (point.y / safeMax) * plotHeight;
      commands.push((i === 0 ? "M " : "L ") + x.toFixed(3) + " " + y.toFixed(3));
    }

    return commands.join(" ");
  }
}
