namespace App {
  export function inUnitRange(value: number): boolean {
    return value >= 0 && value <= 1;
  }

  export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  export function computeSingleUpdate(
    prior: number,
    pBgA: number,
    pBgNotA: number
  ): SingleUpdateResult {
    const pNotPrior = 1 - prior;
    const fromA = pBgA * prior;
    const fromNotA = pBgNotA * pNotPrior;
    const pB = fromA + fromNotA;
    const posterior = pB === 0 ? null : fromA / pB;
    const notPosterior = pB === 0 ? null : fromNotA / pB;

    return {
      prior,
      pNotPrior,
      pBgA,
      pBgNotA,
      fromA,
      fromNotA,
      pB,
      posterior,
      notPosterior,
      shareA: pB === 0 ? 0 : fromA / pB,
      shareNotA: pB === 0 ? 0 : fromNotA / pB
    };
  }

  export function createUndefinedUpdate(): SingleUpdateResult {
    return {
      prior: null,
      pNotPrior: null,
      pBgA: null,
      pBgNotA: null,
      fromA: null,
      fromNotA: null,
      pB: null,
      posterior: null,
      notPosterior: null,
      shareA: 0,
      shareNotA: 0
    };
  }

  export function computeSequentialModel(inputs: ProbabilityInputs): SequentialModel {
    const stage1 = computeSingleUpdate(inputs.pA, inputs.pB1gA, inputs.pB1gNotA);
    const stage2 =
      stage1.posterior === null
        ? createUndefinedUpdate()
        : computeSingleUpdate(stage1.posterior, inputs.pB2gA, inputs.pB2gNotA);

    const pB1B2 =
      stage1.pB === null || stage2.pB === null ? null : stage1.pB * stage2.pB;

    const directA = inputs.pA * inputs.pB1gA * inputs.pB2gA;
    const directNotA = (1 - inputs.pA) * inputs.pB1gNotA * inputs.pB2gNotA;
    const directDenominator = directA + directNotA;
    const directPosterior =
      directDenominator === 0 ? null : directA / directDenominator;

    const lr1 = computeLikelihoodRatio(inputs.pB1gA, inputs.pB1gNotA);
    const lr2 = computeLikelihoodRatio(inputs.pB2gA, inputs.pB2gNotA);
    const priorOdds = computeOdds(inputs.pA);
    const oddsAfterB1 = stage1.posterior === null ? null : computeOdds(stage1.posterior);
    const oddsAfterB2 = stage2.posterior === null ? null : computeOdds(stage2.posterior);

    return {
      inputs,
      stage1,
      stage2,
      pB1B2,
      directA,
      directNotA,
      directDenominator,
      directPosterior,
      lr1,
      lr2,
      priorOdds,
      oddsAfterB1,
      oddsAfterB2
    };
  }

  export function computeLikelihoodRatio(
    numerator: number,
    denominator: number
  ): number | null {
    if (denominator === 0) {
      if (numerator === 0) {
        return null;
      }
      return Infinity;
    }

    return numerator / denominator;
  }

  export function computeOdds(probability: number): number {
    if (probability === 0) {
      return 0;
    }
    if (probability === 1) {
      return Infinity;
    }

    return probability / (1 - probability);
  }

  export function productRatio(a: number | null, b: number | null): number | null {
    if (a === null || b === null) {
      return null;
    }
    if (a === Infinity || b === Infinity) {
      if (a === 0 || b === 0) {
        return null;
      }
      return Infinity;
    }

    return a * b;
  }

  export function computeCoinPosterior(inputs: CoinInputs): CoinPosterior {
    return {
      alpha: inputs.alpha + inputs.heads,
      beta: inputs.beta + inputs.tails
    };
  }

  export function computeCoinModel(inputs: CoinInputs): CoinModel {
    const posterior = computeCoinPosterior(inputs);
    const priorSeries = buildBetaDensitySeries(inputs.alpha, inputs.beta);
    const posteriorSeries = buildBetaDensitySeries(posterior.alpha, posterior.beta);
    const sharedYMax = Math.max(priorSeries.yMax, posteriorSeries.yMax, 1);

    return {
      inputs,
      posterior,
      priorSeries,
      posteriorSeries,
      sharedYMax
    };
  }

  export function buildBetaDensitySeries(
    alpha: number,
    beta: number,
    steps: number = DENSITY_GRID_STEPS
  ): DensitySeries {
    const points: DensityPoint[] = [];
    let yMax = 0;

    for (let i = 0; i <= steps; i += 1) {
      const x = i / steps;
      const xSafe = clamp(x, DENSITY_EPSILON, 1 - DENSITY_EPSILON);
      const y = betaDensity(xSafe, alpha, beta);
      const ySafe = Number.isFinite(y) ? y : 0;
      yMax = Math.max(yMax, ySafe);
      points.push({ x, y: ySafe });
    }

    return { points, yMax };
  }

  export function betaDensity(x: number, alpha: number, beta: number): number {
    if (alpha <= 0 || beta <= 0 || x <= 0 || x >= 1) {
      return 0;
    }

    const logPdf =
      (alpha - 1) * Math.log(x) +
      (beta - 1) * Math.log(1 - x) -
      logBeta(alpha, beta);

    return Math.exp(logPdf);
  }

  function logBeta(alpha: number, beta: number): number {
    return logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  }

  // Lanczos approximation for stable Beta density computation.
  function logGamma(z: number): number {
    const coefficients = [
      676.5203681218851,
      -1259.1392167224028,
      771.3234287776531,
      -176.6150291621406,
      12.507343278686905,
      -0.13857109526572012,
      9.984369578019571e-6,
      1.5056327351493116e-7
    ];

    if (z < 0.5) {
      return (
        Math.log(Math.PI) -
        Math.log(Math.sin(Math.PI * z)) -
        logGamma(1 - z)
      );
    }

    let x = 0.9999999999998099;
    const shifted = z - 1;
    for (let i = 0; i < coefficients.length; i += 1) {
      const coefficient = coefficients[i] ?? 0;
      x += coefficient / (shifted + i + 1);
    }

    const t = shifted + coefficients.length - 0.5;
    return (
      0.9189385332046727 +
      (shifted + 0.5) * Math.log(t) -
      t +
      Math.log(x)
    );
  }

  export function radiusFromProbability(probability: number): number {
    if (probability <= 0) {
      return 0;
    }

    return MAX_RADIUS * Math.sqrt(probability);
  }

  export function solveCircleDistance(
    radiusA: number,
    radiusB: number,
    targetIntersectionArea: number
  ): number {
    if (radiusA <= 0 || radiusB <= 0) {
      return radiusA + radiusB + 16;
    }

    const minDistance = Math.abs(radiusA - radiusB);
    const maxDistance = radiusA + radiusB;
    const maxOverlap = Math.PI * Math.min(radiusA, radiusB) * Math.min(radiusA, radiusB);
    const boundedTarget = clamp(targetIntersectionArea, 0, maxOverlap);

    if (boundedTarget === 0) {
      return maxDistance + 12;
    }
    if (Math.abs(boundedTarget - maxOverlap) < 1e-6) {
      return minDistance;
    }

    let low = minDistance;
    let high = maxDistance;

    for (let i = 0; i < 50; i += 1) {
      const mid = (low + high) / 2;
      const area = circleIntersectionArea(radiusA, radiusB, mid);
      if (area > boundedTarget) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2;
  }

  export function circleIntersectionArea(
    radiusA: number,
    radiusB: number,
    distance: number
  ): number {
    if (distance >= radiusA + radiusB) {
      return 0;
    }

    if (distance <= Math.abs(radiusA - radiusB)) {
      const r = Math.min(radiusA, radiusB);
      return Math.PI * r * r;
    }

    const alpha = Math.acos(
      clamp(
        (distance * distance + radiusA * radiusA - radiusB * radiusB) /
          (2 * distance * radiusA),
        -1,
        1
      )
    );
    const beta = Math.acos(
      clamp(
        (distance * distance + radiusB * radiusB - radiusA * radiusA) /
          (2 * distance * radiusB),
        -1,
        1
      )
    );

    const areaA = radiusA * radiusA * alpha;
    const areaB = radiusB * radiusB * beta;
    const areaTriangle =
      0.5 *
      Math.sqrt(
        Math.max(
          0,
          (-distance + radiusA + radiusB) *
            (distance + radiusA - radiusB) *
            (distance - radiusA + radiusB) *
            (distance + radiusA + radiusB)
        )
      );

    return areaA + areaB - areaTriangle;
  }

  export function formatDecimal(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return "undefined";
    }

    return value.toFixed(4);
  }

  export function formatPercent(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return "undefined";
    }

    return (value * 100).toFixed(1) + "%";
  }

  export function formatSignedPercent(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return "undefined";
    }

    const sign = value > 0 ? "+" : "";
    return sign + (value * 100).toFixed(1) + "%";
  }

  export function formatWithPercent(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return "undefined";
    }

    return formatDecimal(value) + " (" + formatPercent(value) + ")";
  }

  export function formatRatio(value: number | null): string {
    if (value === null) {
      return "undefined";
    }
    if (value === Infinity) {
      return "infinite";
    }

    return value.toFixed(4) + "x";
  }
}
