namespace App {
  function bootstrap(): void {
    const ui = getUiElements();
    const state = createInitialState();

    buildPresetOptions(ui);
    buildStepChips(ui);
    applyPreset(ui, PRESETS[0] as PresetDefinition);
    initializeCoinDefaults(ui);
    ui.modeSelect.value = state.mode;
    renderModeVisibility(ui, state);
    wireEvents(ui, state);
    updateHypothesisFromInputs(ui, state);
    updateCoinFromInputs(ui, state);
  }

  function initializeCoinDefaults(ui: UiElements): void {
    ui.alphaInput.value = "1";
    ui.betaInput.value = "1";
    ui.headsInput.value = "0";
    ui.tailsInput.value = "0";
  }

  function buildPresetOptions(ui: UiElements): void {
    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = "Custom values";
    ui.presetSelect.appendChild(customOption);

    PRESETS.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      ui.presetSelect.appendChild(option);
    });
  }

  function buildStepChips(ui: UiElements): void {
    STEPS.forEach((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.step = String(index + 1);
      button.setAttribute("aria-label", "Step " + String(index + 1));
      button.textContent = String(index + 1);
      ui.stepChips.appendChild(button);
    });
  }

  function wireEvents(ui: UiElements, state: AppState): void {
    ui.modeSelect.addEventListener("change", () => {
      onModeChange(ui, state);
    });

    ui.presetSelect.addEventListener("change", () => {
      onPresetChange(ui, state);
    });

    ui.prevStepBtn.addEventListener("click", () => {
      setStep(state, state.currentStep - 1);
      if (state.mode === "hypothesis") {
        renderHypothesisFromState(ui, state);
      }
    });

    ui.nextStepBtn.addEventListener("click", () => {
      setStep(state, state.currentStep + 1);
      if (state.mode === "hypothesis") {
        renderHypothesisFromState(ui, state);
      }
    });

    ui.stepChips.addEventListener("click", (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const stepValue = target.dataset.step;
      if (!stepValue) {
        return;
      }

      setStep(state, Number(stepValue));
      if (state.mode === "hypothesis") {
        renderHypothesisFromState(ui, state);
      }
    });

    const hypothesisInputs: ReadonlyArray<HTMLInputElement> = [
      ui.pAInput,
      ui.pB1gAInput,
      ui.pB1gNotAInput,
      ui.pB2gAInput,
      ui.pB2gNotAInput
    ];

    hypothesisInputs.forEach((input) => {
      input.addEventListener("input", () => {
        if (ui.presetSelect.value !== "custom") {
          ui.presetSelect.value = "custom";
          ui.presetDescription.textContent = "Manual values";
        }
        updateHypothesisFromInputs(ui, state);
      });
    });

    const coinInputs: ReadonlyArray<HTMLInputElement> = [
      ui.alphaInput,
      ui.betaInput,
      ui.headsInput,
      ui.tailsInput
    ];

    coinInputs.forEach((input) => {
      input.addEventListener("input", () => {
        updateCoinFromInputs(ui, state);
      });
    });
  }

  function onModeChange(ui: UiElements, state: AppState): void {
    state.mode = ui.modeSelect.value === "parameter" ? "parameter" : "hypothesis";
    renderModeVisibility(ui, state);
    if (state.mode === "hypothesis") {
      renderHypothesisFromState(ui, state);
      return;
    }
    renderCoinFromState(ui, state);
  }

  function onPresetChange(ui: UiElements, state: AppState): void {
    if (ui.presetSelect.value === "custom") {
      ui.presetDescription.textContent = "Manual values";
      updateHypothesisFromInputs(ui, state);
      return;
    }

    const selected = PRESETS.find((preset) => preset.id === ui.presetSelect.value);
    if (!selected) {
      ui.inputError.textContent = "Selected preset was not found.";
      return;
    }

    applyPreset(ui, selected as PresetDefinition);
    updateHypothesisFromInputs(ui, state);
  }

  function applyPreset(ui: UiElements, preset: PresetDefinition): void {
    ui.presetSelect.value = preset.id;
    ui.presetDescription.textContent = preset.description;
    ui.pAInput.value = preset.pA.toFixed(3);
    ui.pB1gAInput.value = preset.pB1gA.toFixed(3);
    ui.pB1gNotAInput.value = preset.pB1gNotA.toFixed(3);
    ui.pB2gAInput.value = preset.pB2gA.toFixed(3);
    ui.pB2gNotAInput.value = preset.pB2gNotA.toFixed(3);
  }

  function updateHypothesisFromInputs(ui: UiElements, state: AppState): void {
    const parsed = parseHypothesisInputs(ui);
    if (!parsed.ok) {
      ui.inputError.textContent = parsed.error;
      if (state.lastValidModel) {
        if (state.mode === "hypothesis") {
          renderAll(ui, state, state.lastValidModel);
        }
      } else if (state.mode === "hypothesis") {
        clearOutputs(ui);
        renderStepOnly(ui, state);
      }
      return;
    }

    ui.inputError.textContent = "";
    const model = computeSequentialModel(parsed.value);
    state.lastValidModel = model;
    if (state.mode === "hypothesis") {
      renderAll(ui, state, model);
    }
  }

  function updateCoinFromInputs(ui: UiElements, state: AppState): void {
    const parsed = parseCoinInputs(ui);
    if (!parsed.ok) {
      ui.parameterError.textContent = parsed.error;
      if (state.lastValidCoinModel) {
        if (state.mode === "parameter") {
          renderCoinMode(ui, state.lastValidCoinModel);
        }
      } else if (state.mode === "parameter") {
        clearCoinOutputs(ui);
      }
      return;
    }

    ui.parameterError.textContent = "";
    const model = computeCoinModel(parsed.value);
    state.lastValidCoinModel = model;
    if (state.mode === "parameter") {
      renderCoinMode(ui, model);
    }
  }

  function renderHypothesisFromState(ui: UiElements, state: AppState): void {
    if (state.lastValidModel) {
      renderAll(ui, state, state.lastValidModel);
      return;
    }
    renderStepOnly(ui, state);
  }

  function renderCoinFromState(ui: UiElements, state: AppState): void {
    if (state.lastValidCoinModel) {
      renderCoinMode(ui, state.lastValidCoinModel);
      return;
    }
    clearCoinOutputs(ui);
  }

  function parseHypothesisInputs(
    ui: UiElements
  ): ValidationResult<ProbabilityInputs> {
    const rawValues = [
      ui.pAInput.value,
      ui.pB1gAInput.value,
      ui.pB1gNotAInput.value,
      ui.pB2gAInput.value,
      ui.pB2gNotAInput.value
    ];

    if (rawValues.some((value) => value.trim() === "")) {
      return { ok: false, error: "All five probabilities are required." };
    }

    const values: ProbabilityInputs = {
      pA: Number(ui.pAInput.value),
      pB1gA: Number(ui.pB1gAInput.value),
      pB1gNotA: Number(ui.pB1gNotAInput.value),
      pB2gA: Number(ui.pB2gAInput.value),
      pB2gNotA: Number(ui.pB2gNotAInput.value)
    };

    if (
      Number.isNaN(values.pA) ||
      Number.isNaN(values.pB1gA) ||
      Number.isNaN(values.pB1gNotA) ||
      Number.isNaN(values.pB2gA) ||
      Number.isNaN(values.pB2gNotA)
    ) {
      return { ok: false, error: "All values must be valid numbers." };
    }

    if (
      !inUnitRange(values.pA) ||
      !inUnitRange(values.pB1gA) ||
      !inUnitRange(values.pB1gNotA) ||
      !inUnitRange(values.pB2gA) ||
      !inUnitRange(values.pB2gNotA)
    ) {
      return { ok: false, error: "Each probability must be between 0 and 1." };
    }

    return { ok: true, value: values };
  }

  function parseCoinInputs(ui: UiElements): ValidationResult<CoinInputs> {
    const rawValues = [
      ui.alphaInput.value,
      ui.betaInput.value,
      ui.headsInput.value,
      ui.tailsInput.value
    ];

    if (rawValues.some((value) => value.trim() === "")) {
      return { ok: false, error: "Alpha, beta, heads, and tails are required." };
    }

    const values: CoinInputs = {
      alpha: Number(ui.alphaInput.value),
      beta: Number(ui.betaInput.value),
      heads: Number(ui.headsInput.value),
      tails: Number(ui.tailsInput.value)
    };

    if (
      Number.isNaN(values.alpha) ||
      Number.isNaN(values.beta) ||
      Number.isNaN(values.heads) ||
      Number.isNaN(values.tails)
    ) {
      return { ok: false, error: "All parameter mode inputs must be numbers." };
    }

    if (values.alpha <= 0 || values.beta <= 0) {
      return { ok: false, error: "Alpha and beta must be greater than 0." };
    }

    if (!isNonNegativeInteger(values.heads) || !isNonNegativeInteger(values.tails)) {
      return { ok: false, error: "Heads and tails must be non-negative integers." };
    }

    return { ok: true, value: values };
  }

  function isNonNegativeInteger(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
}
