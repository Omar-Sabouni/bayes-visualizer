(function (root, factory) {
  "use strict";

  const api = Object.freeze(factory());

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BayesCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LIMITS = deepFreeze({
    percent: { min: 0, max: 100 },
    alpha: { min: 0.1, max: 1000 },
    beta: { min: 0.1, max: 1000 },
    count: { min: 0, max: 10000 },
    density: { defaultSteps: 280, minSteps: 80, maxSteps: 2000 }
  });

  const BETA_BOUNDARY_EPSILON = 1e-12;
  const COMPARISON_EPSILON = 1e-12;

  function computeBayes(inputs) {
    if (!inputs || typeof inputs !== "object") {
      throw new TypeError("Bayes inputs must be provided as an object.");
    }

    const prior = requireProbability(inputs.prior, "prior");
    const truePositiveRate = requireProbability(
      inputs.truePositiveRate,
      "truePositiveRate"
    );
    const falsePositiveRate = requireProbability(
      inputs.falsePositiveRate,
      "falsePositiveRate"
    );

    const complementPrior = 1 - prior;
    const hypothesisAndEvidence = prior * truePositiveRate;
    const nonHypothesisAndEvidence = complementPrior * falsePositiveRate;
    const pEvidence = hypothesisAndEvidence + nonHypothesisAndEvidence;
    const posterior = pEvidence === 0 ? null : hypothesisAndEvidence / pEvidence;
    const complementPosterior =
      pEvidence === 0 ? null : nonHypothesisAndEvidence / pEvidence;
    const rawLikelihoodRatio = calculateLikelihoodRatio(
      truePositiveRate,
      falsePositiveRate
    );
    const likelihoodRatio = pEvidence === 0 ? null : rawLikelihoodRatio;
    const priorOdds = probabilityToOdds(prior);
    const posteriorOdds = posterior === null ? null : probabilityToOdds(posterior);
    const updateDirection = classifyUpdate(prior, posterior, likelihoodRatio);
    const evidenceDirection = classifyEvidence(likelihoodRatio, pEvidence);

    return {
      prior,
      truePositiveRate,
      falsePositiveRate,
      complementPrior,
      hypothesisAndEvidence,
      nonHypothesisAndEvidence,
      pEvidence,
      posterior,
      complementPosterior,
      rawLikelihoodRatio,
      likelihoodRatio,
      priorOdds,
      posteriorOdds,
      updateDirection,
      evidenceDirection
    };
  }

  function buildFrequencyModel(model, cohortSize) {
    const size = cohortSize === undefined ? 10000 : cohortSize;

    if (!Number.isSafeInteger(size) || size <= 0) {
      throw new RangeError("cohortSize must be a positive safe integer.");
    }

    assertBayesModel(model);

    const hypothesisTotal = normalizeNegativeZero(size * model.prior);
    const nonHypothesisTotal = normalizeNegativeZero(size * model.complementPrior);
    const trueEvidenceCount = normalizeNegativeZero(
      size * model.hypothesisAndEvidence
    );
    const falseEvidenceCount = normalizeNegativeZero(
      size * model.nonHypothesisAndEvidence
    );
    const hypothesisNoEvidenceCount = normalizeNegativeZero(
      hypothesisTotal - trueEvidenceCount
    );
    const nonHypothesisNoEvidenceCount = normalizeNegativeZero(
      nonHypothesisTotal - falseEvidenceCount
    );
    const totalEvidenceCount = normalizeNegativeZero(
      trueEvidenceCount + falseEvidenceCount
    );
    const totalNoEvidenceCount = normalizeNegativeZero(
      hypothesisNoEvidenceCount + nonHypothesisNoEvidenceCount
    );

    const displayedCounts = [
      hypothesisTotal,
      nonHypothesisTotal,
      trueEvidenceCount,
      falseEvidenceCount,
      hypothesisNoEvidenceCount,
      nonHypothesisNoEvidenceCount,
      totalEvidenceCount,
      totalNoEvidenceCount
    ];

    return {
      cohortSize: size,
      hypothesis: {
        total: hypothesisTotal,
        evidence: trueEvidenceCount,
        noEvidence: hypothesisNoEvidenceCount
      },
      nonHypothesis: {
        total: nonHypothesisTotal,
        evidence: falseEvidenceCount,
        noEvidence: nonHypothesisNoEvidenceCount
      },
      evidence: {
        total: totalEvidenceCount,
        fromHypothesis: trueEvidenceCount,
        fromNonHypothesis: falseEvidenceCount,
        posterior: model.posterior
      },
      noEvidence: {
        total: totalNoEvidenceCount,
        fromHypothesis: hypothesisNoEvidenceCount,
        fromNonHypothesis: nonHypothesisNoEvidenceCount
      },
      hypothesisTotal,
      nonHypothesisTotal,
      trueEvidenceCount,
      falseEvidenceCount,
      hypothesisNoEvidenceCount,
      nonHypothesisNoEvidenceCount,
      totalEvidenceCount,
      totalNoEvidenceCount,
      hasApproximateCounts: displayedCounts.some(
        (count) => !isEffectivelyInteger(count)
      )
    };
  }

  function validatePercentInputs(rawInputs) {
    const raw = rawInputs && typeof rawInputs === "object" ? rawInputs : {};
    const errors = {};
    const percentages = {};

    ["prior", "truePositiveRate", "falsePositiveRate"].forEach((field) => {
      const parsed = parseRequiredNumber(raw[field]);

      if (parsed.reason === "required") {
        errors[field] = "Enter a percentage from 0 to 100.";
        return;
      }

      if (parsed.reason === "number") {
        errors[field] = "Use a finite number from 0 to 100.";
        return;
      }

      if (parsed.value < LIMITS.percent.min || parsed.value > LIMITS.percent.max) {
        errors[field] = "Use a percentage from 0 to 100.";
        return;
      }

      percentages[field] = parsed.value;
    });

    if (Object.keys(errors).length > 0) {
      return { ok: false, values: null, percentages: null, errors };
    }

    return {
      ok: true,
      values: {
        prior: percentages.prior / 100,
        truePositiveRate: percentages.truePositiveRate / 100,
        falsePositiveRate: percentages.falsePositiveRate / 100
      },
      percentages,
      errors: {}
    };
  }

  function validateBetaInputs(rawInputs) {
    const raw = rawInputs && typeof rawInputs === "object" ? rawInputs : {};
    const errors = {};
    const values = {};

    ["alpha", "beta"].forEach((field) => {
      const parsed = parseRequiredNumber(raw[field]);
      const limit = LIMITS[field];

      if (parsed.reason === "required") {
        errors[field] = "Enter a value from 0.1 to 1,000.";
        return;
      }

      if (parsed.reason === "number") {
        errors[field] = "Use a finite number from 0.1 to 1,000.";
        return;
      }

      if (parsed.value < limit.min || parsed.value > limit.max) {
        errors[field] = "Use a value from 0.1 to 1,000.";
        return;
      }

      values[field] = parsed.value;
    });

    ["heads", "tails"].forEach((field) => {
      const parsed = parseRequiredNumber(raw[field]);

      if (parsed.reason === "required") {
        errors[field] = "Enter a whole number from 0 to 10,000.";
        return;
      }

      if (parsed.reason === "number" || !Number.isSafeInteger(parsed.value)) {
        errors[field] = "Use a whole number from 0 to 10,000.";
        return;
      }

      if (parsed.value < LIMITS.count.min || parsed.value > LIMITS.count.max) {
        errors[field] = "Use a whole number from 0 to 10,000.";
        return;
      }

      values[field] = parsed.value;
    });

    if (Object.keys(errors).length > 0) {
      return { ok: false, values: null, errors };
    }

    return { ok: true, values, errors: {} };
  }

  function computeBetaModel(inputs) {
    const validation = validateBetaInputs(inputs);

    if (!validation.ok) {
      const fields = Object.keys(validation.errors).join(", ");
      throw new RangeError("Invalid Beta inputs: " + fields + ".");
    }

    const values = validation.values;
    const prior = betaStatistics(values.alpha, values.beta);
    const posterior = betaStatistics(
      values.alpha + values.heads,
      values.beta + values.tails
    );
    const observationCount = values.heads + values.tails;
    const sdDifference = posterior.sd - prior.sd;
    const uncertaintyChange =
      Math.abs(sdDifference) <=
      COMPARISON_EPSILON * Math.max(1, prior.sd, posterior.sd)
        ? "unchanged"
        : sdDifference < 0
          ? "narrower"
          : "wider";

    const priorOwnSeries = buildBetaDensitySeries(prior.alpha, prior.beta);
    const posteriorOwnSeries = buildBetaDensitySeries(
      posterior.alpha,
      posterior.beta
    );
    const sharedLogPeak = Math.max(
      priorOwnSeries.logPeak,
      posteriorOwnSeries.logPeak
    );
    const priorSeries = normalizeDensitySeries(priorOwnSeries, sharedLogPeak);
    const posteriorSeries = normalizeDensitySeries(
      posteriorOwnSeries,
      sharedLogPeak
    );

    return {
      inputs: values,
      prior,
      posterior,
      observations: {
        heads: values.heads,
        tails: values.tails,
        total: observationCount
      },
      meanChange: posterior.mean - prior.mean,
      varianceChange: posterior.variance - prior.variance,
      sdChange: sdDifference,
      uncertaintyChange,
      priorSeries,
      posteriorSeries,
      sharedLogPeak
    };
  }

  function buildBetaDensitySeries(alpha, beta, options) {
    requirePositiveFinite(alpha, "alpha");
    requirePositiveFinite(beta, "beta");

    const settings = options && typeof options === "object" ? options : {};
    const requestedSteps =
      settings.steps === undefined ? LIMITS.density.defaultSteps : settings.steps;

    if (
      !Number.isSafeInteger(requestedSteps) ||
      requestedSteps < LIMITS.density.minSteps ||
      requestedSteps > LIMITS.density.maxSteps
    ) {
      throw new RangeError(
        "Density steps must be a whole number from " +
          LIMITS.density.minSteps +
          " to " +
          LIMITS.density.maxSteps +
          "."
      );
    }

    const grid = buildModeAwareGrid(alpha, beta, requestedSteps);
    const logNormalizer = logBeta(alpha, beta);
    const logPoints = grid.map((x) => {
      const evaluationX = clamp(
        x,
        BETA_BOUNDARY_EPSILON,
        1 - BETA_BOUNDARY_EPSILON
      );
      const logDensity =
        (alpha - 1) * Math.log(evaluationX) +
        (beta - 1) * Math.log1p(-evaluationX) -
        logNormalizer;

      return {
        x,
        logDensity: Number.isFinite(logDensity) ? logDensity : -Infinity
      };
    });

    const logPeak = logPoints.reduce(
      (peak, point) => Math.max(peak, point.logDensity),
      -Infinity
    );
    const referenceLogPeak =
      Number.isFinite(settings.referenceLogPeak) &&
      settings.referenceLogPeak >= logPeak
        ? settings.referenceLogPeak
        : logPeak;

    const points = logPoints.map((point) => ({
      x: point.x,
      y: finiteExponential(point.logDensity - referenceLogPeak),
      logDensity: point.logDensity
    }));

    return {
      alpha,
      beta,
      mode: betaMode(alpha, beta),
      points,
      logPeak,
      referenceLogPeak,
      yMax: points.reduce((peak, point) => Math.max(peak, point.y), 0)
    };
  }

  function formatDecimal(value, options) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "undefined";
    }

    if (value === Infinity) {
      return "∞";
    }

    if (value === -Infinity) {
      return "−∞";
    }

    if (!Number.isFinite(value)) {
      return "undefined";
    }

    if (Object.is(value, -0) || value === 0) {
      return "0";
    }

    const settings = options && typeof options === "object" ? options : {};
    const maximumSignificantDigits = clampInteger(
      settings.maximumSignificantDigits,
      1,
      12,
      4
    );
    const scientificBelow =
      Number.isFinite(settings.scientificBelow) && settings.scientificBelow >= 0
        ? settings.scientificBelow
        : 0.0001;
    const scientificAtOrAbove =
      Number.isFinite(settings.scientificAtOrAbove) &&
      settings.scientificAtOrAbove > 0
        ? settings.scientificAtOrAbove
        : 1000000;
    const absolute = Math.abs(value);

    if (
      (scientificBelow > 0 && absolute < scientificBelow) ||
      absolute >= scientificAtOrAbove
    ) {
      return tidyExponential(
        value.toExponential(Math.max(0, maximumSignificantDigits - 1))
      );
    }

    return tidyDecimal(value.toPrecision(maximumSignificantDigits));
  }

  function formatPercent(value, options) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "undefined";
    }

    const settings = options && typeof options === "object" ? options : {};
    const thresholdPercent =
      Number.isFinite(settings.thresholdPercent) && settings.thresholdPercent >= 0
        ? settings.thresholdPercent
        : 0.01;
    const percent = value * 100;

    if (percent === 0 || Object.is(percent, -0)) {
      return "0%";
    }

    if (Math.abs(percent) < thresholdPercent) {
      const threshold = formatDecimal(thresholdPercent, {
        maximumSignificantDigits: 4,
        scientificBelow: 0
      });
      return percent > 0 ? "<" + threshold + "%" : ">−" + threshold + "%";
    }

    return (
      formatDecimal(percent, {
        maximumSignificantDigits: clampInteger(
          settings.maximumSignificantDigits,
          1,
          10,
          3
        ),
        scientificBelow: 0
      }) + "%"
    );
  }

  function formatCount(value, options) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "undefined";
    }

    if (isEffectivelyInteger(value)) {
      return String(Math.round(value));
    }

    const settings = options && typeof options === "object" ? options : {};
    return (
      "≈" +
      formatDecimal(value, {
        maximumSignificantDigits: clampInteger(
          settings.maximumSignificantDigits,
          1,
          10,
          4
        )
      })
    );
  }

  function formatRatio(value, options) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "undefined";
    }

    if (value === Infinity) {
      return "∞×";
    }

    if (value === -Infinity) {
      return "−∞×";
    }

    if (!Number.isFinite(value)) {
      return "undefined";
    }

    return formatDecimal(value, options) + "×";
  }

  function betaStatistics(alpha, beta) {
    const total = alpha + beta;
    const mean = alpha / total;
    const variance = (alpha * beta) / (total * total * (total + 1));

    return {
      alpha,
      beta,
      mean,
      variance,
      sd: Math.sqrt(variance)
    };
  }

  function normalizeDensitySeries(series, referenceLogPeak) {
    const points = series.points.map((point) => ({
      x: point.x,
      y: finiteExponential(point.logDensity - referenceLogPeak),
      logDensity: point.logDensity
    }));

    return {
      alpha: series.alpha,
      beta: series.beta,
      mode: series.mode,
      points,
      logPeak: series.logPeak,
      referenceLogPeak,
      yMax: points.reduce((peak, point) => Math.max(peak, point.y), 0)
    };
  }

  function buildModeAwareGrid(alpha, beta, steps) {
    const values = new Set([0, 1]);

    for (let index = 0; index <= steps; index += 1) {
      addGridValue(values, index / steps);
    }

    for (let exponent = 2; exponent <= 12; exponent += 1) {
      const offset = Math.pow(10, -exponent);
      addGridValue(values, offset);
      addGridValue(values, 1 - offset);
    }

    const mode = betaMode(alpha, beta);
    if (mode !== null) {
      addGridValue(values, mode);
    }

    const statistics = betaStatistics(alpha, beta);
    const centers = [statistics.mean];
    if (mode !== null) {
      centers.push(mode);
    }

    centers.forEach((center) => {
      [0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 4].forEach((multiple) => {
        addGridValue(values, center - statistics.sd * multiple);
        addGridValue(values, center + statistics.sd * multiple);
      });

      if (center > 0 && center < 1) {
        [-3, -2, -1, -0.5, 0.5, 1, 2, 3].forEach((power) => {
          addGridValue(values, center * Math.pow(10, power));
          addGridValue(values, 1 - (1 - center) * Math.pow(10, power));
        });
      }
    });

    for (let index = -24; index <= 24; index += 1) {
      addGridValue(values, 1 / (1 + Math.exp(-index)));
    }

    return Array.from(values).sort((left, right) => left - right);
  }

  function addGridValue(values, value) {
    if (Number.isFinite(value) && value >= 0 && value <= 1) {
      values.add(Number(value.toPrecision(15)));
    }
  }

  function betaMode(alpha, beta) {
    if (alpha > 1 && beta > 1) {
      return (alpha - 1) / (alpha + beta - 2);
    }

    if (alpha < 1 && beta >= 1) {
      return 0;
    }

    if (beta < 1 && alpha >= 1) {
      return 1;
    }

    if (alpha === 1 && beta > 1) {
      return 0;
    }

    if (beta === 1 && alpha > 1) {
      return 1;
    }

    if (alpha === 1 && beta === 1) {
      return null;
    }

    return null;
  }

  function logBeta(alpha, beta) {
    return logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  }

  function logGamma(value) {
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

    if (value < 0.5) {
      return (
        Math.log(Math.PI) -
        Math.log(Math.sin(Math.PI * value)) -
        logGamma(1 - value)
      );
    }

    let sum = 0.9999999999998099;
    const shifted = value - 1;

    for (let index = 0; index < coefficients.length; index += 1) {
      sum += coefficients[index] / (shifted + index + 1);
    }

    const t = shifted + coefficients.length - 0.5;
    return (
      0.9189385332046727 +
      (shifted + 0.5) * Math.log(t) -
      t +
      Math.log(sum)
    );
  }

  function calculateLikelihoodRatio(truePositiveRate, falsePositiveRate) {
    if (falsePositiveRate === 0) {
      return truePositiveRate === 0 ? null : Infinity;
    }

    return truePositiveRate / falsePositiveRate;
  }

  function probabilityToOdds(probability) {
    if (probability === 1) {
      return Infinity;
    }

    if (probability === 0) {
      return 0;
    }

    return probability / (1 - probability);
  }

  function classifyUpdate(prior, posterior, likelihoodRatio) {
    if (posterior === null) {
      return "undefined";
    }

    if (prior === 0 || prior === 1 || likelihoodRatio === 1) {
      return "unchanged";
    }

    if (likelihoodRatio === Infinity || likelihoodRatio > 1) {
      return "increase";
    }

    return "decrease";
  }

  function classifyEvidence(likelihoodRatio, pEvidence) {
    if (pEvidence === 0 || likelihoodRatio === null) {
      return "undefined";
    }

    if (likelihoodRatio === Infinity || likelihoodRatio > 1) {
      return "supports";
    }

    if (likelihoodRatio < 1) {
      return "opposes";
    }

    return "neutral";
  }

  function finiteExponential(value) {
    if (value === -Infinity || value < -745) {
      return 0;
    }

    if (!Number.isFinite(value)) {
      return value > 0 ? 1 : 0;
    }

    return clamp(Math.exp(Math.min(0, value)), 0, 1);
  }

  function parseRequiredNumber(rawValue) {
    if (
      rawValue === null ||
      rawValue === undefined ||
      (typeof rawValue === "string" && rawValue.trim() === "")
    ) {
      return { reason: "required" };
    }

    const value =
      typeof rawValue === "number" ? rawValue : Number(String(rawValue).trim());

    if (!Number.isFinite(value)) {
      return { reason: "number" };
    }

    return { value };
  }

  function assertBayesModel(model) {
    if (!model || typeof model !== "object") {
      throw new TypeError("model must be returned by computeBayes.");
    }

    [
      "prior",
      "complementPrior",
      "hypothesisAndEvidence",
      "nonHypothesisAndEvidence",
      "pEvidence"
    ].forEach((field) => {
      if (!Number.isFinite(model[field]) || model[field] < 0 || model[field] > 1) {
        throw new TypeError("model must be returned by computeBayes.");
      }
    });
  }

  function requireProbability(value, name) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(name + " must be a finite probability from 0 to 1.");
    }

    return value;
  }

  function requirePositiveFinite(value, name) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(name + " must be a finite number greater than 0.");
    }
  }

  function isEffectivelyInteger(value) {
    const nearest = Math.round(value);
    if (nearest === 0 && value !== 0) {
      return false;
    }

    return (
      Math.abs(value - nearest) <=
      Number.EPSILON * 16 * Math.max(1, Math.abs(value))
    );
  }

  function normalizeNegativeZero(value) {
    return Object.is(value, -0) ? 0 : value;
  }

  function tidyDecimal(value) {
    if (/[eE]/.test(value)) {
      return tidyExponential(value);
    }

    return value
      .replace(/(\.\d*?[1-9])0+$/, "$1")
      .replace(/\.0+$/, "")
      .replace(/-/g, "−");
  }

  function tidyExponential(value) {
    return value
      .replace(/\.0+(?=e)/i, "")
      .replace(/(\.\d*?[1-9])0+(?=e)/i, "$1")
      .replace(/e\+?/i, "e")
      .replace(/e(-?)0+(\d+)/i, "e$1$2")
      .replace(/-/g, "−");
  }

  function clampInteger(value, minimum, maximum, fallback) {
    if (!Number.isSafeInteger(value)) {
      return fallback;
    }

    return Math.min(maximum, Math.max(minimum, value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function deepFreeze(value) {
    Object.keys(value).forEach((key) => {
      if (value[key] && typeof value[key] === "object") {
        deepFreeze(value[key]);
      }
    });
    return Object.freeze(value);
  }

  return {
    LIMITS,
    computeBayes,
    buildFrequencyModel,
    validatePercentInputs,
    validateBetaInputs,
    computeBetaModel,
    buildBetaDensitySeries,
    formatDecimal,
    formatPercent,
    formatCount,
    formatRatio
  };
});
