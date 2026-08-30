namespace App {
  function requireHTMLElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLElement)) {
      throw new Error("Missing required HTML element: #" + id);
    }
    return element as T;
  }

  function requireSVGElement<T extends SVGElement>(id: string): T {
    const element = document.getElementById(id);
    if (!(element instanceof SVGElement)) {
      throw new Error("Missing required SVG element: #" + id);
    }
    return element as unknown as T;
  }

  export function getUiElements(): UiElements {
    return {
      modeSelect: requireHTMLElement<HTMLSelectElement>("modeSelect"),
      hypothesisControls: requireHTMLElement("hypothesisControls"),
      hypothesisTheory: requireHTMLElement("hypothesisTheory"),
      hypothesisVisualization: requireHTMLElement("hypothesisVisualization"),
      hypothesisResults: requireHTMLElement("hypothesisResults"),
      parameterRoot: requireHTMLElement("parameterRoot"),
      presetSelect: requireHTMLElement<HTMLSelectElement>("presetSelect"),
      presetDescription: requireHTMLElement("presetDescription"),
      pAInput: requireHTMLElement<HTMLInputElement>("pAInput"),
      pB1gAInput: requireHTMLElement<HTMLInputElement>("pB1gAInput"),
      pB1gNotAInput: requireHTMLElement<HTMLInputElement>("pB1gNotAInput"),
      pB2gAInput: requireHTMLElement<HTMLInputElement>("pB2gAInput"),
      pB2gNotAInput: requireHTMLElement<HTMLInputElement>("pB2gNotAInput"),
      inputError: requireHTMLElement("inputError"),
      prevStepBtn: requireHTMLElement<HTMLButtonElement>("prevStepBtn"),
      nextStepBtn: requireHTMLElement<HTMLButtonElement>("nextStepBtn"),
      stepChips: requireHTMLElement("stepChips"),
      stepCounter: requireHTMLElement("stepCounter"),
      stepTitle: requireHTMLElement("stepTitle"),
      stepTheory: requireHTMLElement("stepTheory"),
      stepFormula: requireHTMLElement("stepFormula"),
      stepKey: requireHTMLElement("stepKey"),
      priorValue: requireHTMLElement("priorValue"),
      postB1Value: requireHTMLElement("postB1Value"),
      postB1B2Value: requireHTMLElement("postB1B2Value"),
      progressionDelta: requireHTMLElement("progressionDelta"),
      contribB1Panel: requireHTMLElement("contribB1Panel"),
      contribB1Text: requireHTMLElement("contribB1Text"),
      contribB1A: requireHTMLElement("contribB1A"),
      contribB1NotA: requireHTMLElement("contribB1NotA"),
      contribB2Panel: requireHTMLElement("contribB2Panel"),
      contribB2Text: requireHTMLElement("contribB2Text"),
      contribB2A: requireHTMLElement("contribB2A"),
      contribB2NotA: requireHTMLElement("contribB2NotA"),
      strengthPanel: requireHTMLElement("strengthPanel"),
      lr1Value: requireHTMLElement("lr1Value"),
      lr2Value: requireHTMLElement("lr2Value"),
      oddsValue: requireHTMLElement("oddsValue"),
      strengthNote: requireHTMLElement("strengthNote"),
      stepFocus: requireHTMLElement("stepFocus"),
      vennSvg: requireSVGElement<SVGSVGElement>("vennSvg"),
      circleA: requireSVGElement<SVGCircleElement>("circleA"),
      clipCircleA: requireSVGElement<SVGCircleElement>("clipCircleA"),
      circleB: requireSVGElement<SVGCircleElement>("circleB"),
      overlapCircle: requireSVGElement<SVGCircleElement>("overlapCircle"),
      labelA: requireSVGElement<SVGTextElement>("labelA"),
      labelB: requireSVGElement<SVGTextElement>("labelB"),
      labelIntersection: requireSVGElement<SVGTextElement>("labelIntersection"),
      labelPosterior: requireSVGElement<SVGTextElement>("labelPosterior"),
      formulaSubstitute: requireHTMLElement("formulaSubstitute"),
      posteriorValue: requireHTMLElement("posteriorValue"),
      pB1Value: requireHTMLElement("pB1Value"),
      pA_B1Value: requireHTMLElement("pA_B1Value"),
      pB2_B1Value: requireHTMLElement("pB2_B1Value"),
      pA_B1B2Value: requireHTMLElement("pA_B1B2Value"),
      pB1B2Value: requireHTMLElement("pB1B2Value"),
      interpretationText: requireHTMLElement("interpretationText"),
      alphaInput: requireHTMLElement<HTMLInputElement>("alphaInput"),
      betaInput: requireHTMLElement<HTMLInputElement>("betaInput"),
      headsInput: requireHTMLElement<HTMLInputElement>("headsInput"),
      tailsInput: requireHTMLElement<HTMLInputElement>("tailsInput"),
      parameterError: requireHTMLElement("parameterError"),
      posteriorParamText: requireHTMLElement("posteriorParamText"),
      parameterNarrative: requireHTMLElement("parameterNarrative"),
      priorDensityPath: requireSVGElement<SVGPathElement>("priorDensityPath"),
      posteriorDensityPath: requireSVGElement<SVGPathElement>("posteriorDensityPath"),
      priorDensityLabel: requireHTMLElement("priorDensityLabel"),
      posteriorDensityLabel: requireHTMLElement("posteriorDensityLabel")
    };
  }
}
