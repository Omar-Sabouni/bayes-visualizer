namespace App {
  export function createInitialState(): AppState {
    return {
      mode: "hypothesis",
      currentStep: 1,
      lastValidModel: null,
      lastValidCoinModel: null
    };
  }

  export function setStep(state: AppState, nextStep: number): void {
    state.currentStep = clamp(Math.round(nextStep), 1, STEPS.length);
  }

  export function currentStepDefinition(state: AppState): StepDefinition {
    return STEPS[state.currentStep - 1] as StepDefinition;
  }
}
