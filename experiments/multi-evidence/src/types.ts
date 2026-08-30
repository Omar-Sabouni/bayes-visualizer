namespace App {
  export type AppMode = "hypothesis" | "parameter";
  export type FocusMode = "prior" | "b1" | "b2" | "strength";
  export type StepKeyKind = "prior" | "stage1" | "stage2" | "strength";

  export interface ProbabilityInputs {
    pA: number;
    pB1gA: number;
    pB1gNotA: number;
    pB2gA: number;
    pB2gNotA: number;
  }

  export interface PresetDefinition extends ProbabilityInputs {
    id: string;
    label: string;
    description: string;
  }

  export interface SingleUpdateResult {
    prior: number | null;
    pNotPrior: number | null;
    pBgA: number | null;
    pBgNotA: number | null;
    fromA: number | null;
    fromNotA: number | null;
    pB: number | null;
    posterior: number | null;
    notPosterior: number | null;
    shareA: number;
    shareNotA: number;
  }

  export interface SequentialModel {
    inputs: ProbabilityInputs;
    stage1: SingleUpdateResult;
    stage2: SingleUpdateResult;
    pB1B2: number | null;
    directA: number;
    directNotA: number;
    directDenominator: number;
    directPosterior: number | null;
    lr1: number | null;
    lr2: number | null;
    priorOdds: number;
    oddsAfterB1: number | null;
    oddsAfterB2: number | null;
  }

  export interface CoinInputs {
    alpha: number;
    beta: number;
    heads: number;
    tails: number;
  }

  export interface CoinPosterior {
    alpha: number;
    beta: number;
  }

  export interface DensityPoint {
    x: number;
    y: number;
  }

  export interface DensitySeries {
    points: DensityPoint[];
    yMax: number;
  }

  export interface CoinModel {
    inputs: CoinInputs;
    posterior: CoinPosterior;
    priorSeries: DensitySeries;
    posteriorSeries: DensitySeries;
    sharedYMax: number;
  }

  export interface StepDefinition {
    title: string;
    theory: string;
    formula: string;
    focus: FocusMode;
    focusLine: string;
    keyKind: StepKeyKind;
    showContribB1: boolean;
    showContribB2: boolean;
    showStrength: boolean;
  }

  export interface AppState {
    mode: AppMode;
    currentStep: number;
    lastValidModel: SequentialModel | null;
    lastValidCoinModel: CoinModel | null;
  }

  export type ValidationResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: string };

  export interface CircleGeometry {
    xA: number;
    xB: number;
    rA: number;
    rB: number;
    intersectionProbability: number;
  }

  export interface UiElements {
    modeSelect: HTMLSelectElement;
    hypothesisControls: HTMLElement;
    hypothesisTheory: HTMLElement;
    hypothesisVisualization: HTMLElement;
    hypothesisResults: HTMLElement;
    parameterRoot: HTMLElement;
    presetSelect: HTMLSelectElement;
    presetDescription: HTMLElement;
    pAInput: HTMLInputElement;
    pB1gAInput: HTMLInputElement;
    pB1gNotAInput: HTMLInputElement;
    pB2gAInput: HTMLInputElement;
    pB2gNotAInput: HTMLInputElement;
    inputError: HTMLElement;
    prevStepBtn: HTMLButtonElement;
    nextStepBtn: HTMLButtonElement;
    stepChips: HTMLElement;
    stepCounter: HTMLElement;
    stepTitle: HTMLElement;
    stepTheory: HTMLElement;
    stepFormula: HTMLElement;
    stepKey: HTMLElement;
    priorValue: HTMLElement;
    postB1Value: HTMLElement;
    postB1B2Value: HTMLElement;
    progressionDelta: HTMLElement;
    contribB1Panel: HTMLElement;
    contribB1Text: HTMLElement;
    contribB1A: HTMLElement;
    contribB1NotA: HTMLElement;
    contribB2Panel: HTMLElement;
    contribB2Text: HTMLElement;
    contribB2A: HTMLElement;
    contribB2NotA: HTMLElement;
    strengthPanel: HTMLElement;
    lr1Value: HTMLElement;
    lr2Value: HTMLElement;
    oddsValue: HTMLElement;
    strengthNote: HTMLElement;
    stepFocus: HTMLElement;
    vennSvg: SVGSVGElement;
    circleA: SVGCircleElement;
    clipCircleA: SVGCircleElement;
    circleB: SVGCircleElement;
    overlapCircle: SVGCircleElement;
    labelA: SVGTextElement;
    labelB: SVGTextElement;
    labelIntersection: SVGTextElement;
    labelPosterior: SVGTextElement;
    formulaSubstitute: HTMLElement;
    posteriorValue: HTMLElement;
    pB1Value: HTMLElement;
    pA_B1Value: HTMLElement;
    pB2_B1Value: HTMLElement;
    pA_B1B2Value: HTMLElement;
    pB1B2Value: HTMLElement;
    interpretationText: HTMLElement;
    alphaInput: HTMLInputElement;
    betaInput: HTMLInputElement;
    headsInput: HTMLInputElement;
    tailsInput: HTMLInputElement;
    parameterError: HTMLElement;
    posteriorParamText: HTMLElement;
    parameterNarrative: HTMLElement;
    priorDensityPath: SVGPathElement;
    posteriorDensityPath: SVGPathElement;
    priorDensityLabel: HTMLElement;
    posteriorDensityLabel: HTMLElement;
  }
}
