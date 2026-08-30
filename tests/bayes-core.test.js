"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../bayes-core.js");

const {
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
} = core;

function closeTo(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`
  );
}

test("CommonJS exports and public limits are frozen", () => {
  assert.ok(Object.isFrozen(core));
  assert.ok(Object.isFrozen(LIMITS));
  assert.ok(Object.isFrozen(LIMITS.count));
  assert.equal(typeof computeBayes, "function");
});

test("classic-script loading exposes one frozen BayesCore browser global", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "bayes-core.js"),
    "utf8"
  );
  const browserContext = vm.createContext({});

  vm.runInContext(source, browserContext, { filename: "bayes-core.js" });

  assert.equal(typeof browserContext.BayesCore.computeBayes, "function");
  assert.equal(Object.isFrozen(browserContext.BayesCore), true);
  assert.equal(
    browserContext.BayesCore.formatPercent(
      browserContext.BayesCore.computeBayes({
        prior: 0.01,
        truePositiveRate: 0.95,
        falsePositiveRate: 0.05
      }).posterior
    ),
    "16.1%"
  );
});

test("medical screening default produces the expected posterior and frequencies", () => {
  const model = computeBayes({
    prior: 0.01,
    truePositiveRate: 0.95,
    falsePositiveRate: 0.05
  });
  const frequency = buildFrequencyModel(model);

  closeTo(model.hypothesisAndEvidence, 0.0095);
  closeTo(model.nonHypothesisAndEvidence, 0.0495);
  closeTo(model.pEvidence, 0.059);
  closeTo(model.posterior, 95 / 590);
  closeTo(model.complementPosterior, 495 / 590);
  closeTo(model.likelihoodRatio, 19);
  assert.equal(model.evidenceDirection, "supports");
  assert.equal(model.updateDirection, "increase");

  assert.equal(frequency.hypothesis.total, 100);
  assert.equal(frequency.trueEvidenceCount, 95);
  closeTo(frequency.falseEvidenceCount, 495);
  closeTo(frequency.totalEvidenceCount, 590);
  closeTo(frequency.totalNoEvidenceCount, 9410);
  assert.equal(frequency.hasApproximateCounts, false);
});

test("impossible evidence yields undefined posterior and a gated likelihood ratio", () => {
  const model = computeBayes({
    prior: 0.4,
    truePositiveRate: 0,
    falsePositiveRate: 0
  });

  assert.equal(model.pEvidence, 0);
  assert.equal(model.posterior, null);
  assert.equal(model.complementPosterior, null);
  assert.equal(model.rawLikelihoodRatio, null);
  assert.equal(model.likelihoodRatio, null);
  assert.equal(model.posteriorOdds, null);
  assert.equal(model.evidenceDirection, "undefined");
  assert.equal(model.updateDirection, "undefined");
});

test("likelihood ratio is also gated when boundary priors make evidence impossible", () => {
  const model = computeBayes({
    prior: 0,
    truePositiveRate: 1,
    falsePositiveRate: 0
  });

  assert.equal(model.rawLikelihoodRatio, Infinity);
  assert.equal(model.pEvidence, 0);
  assert.equal(model.likelihoodRatio, null);
  assert.equal(model.evidenceDirection, "undefined");
});

test("probability boundaries and zero or infinite raw ratios remain coherent", () => {
  const certain = computeBayes({
    prior: 1,
    truePositiveRate: 0.8,
    falsePositiveRate: 0
  });
  const counterEvidence = computeBayes({
    prior: 0.25,
    truePositiveRate: 0,
    falsePositiveRate: 0.4
  });

  assert.equal(certain.posterior, 1);
  assert.equal(certain.priorOdds, Infinity);
  assert.equal(certain.posteriorOdds, Infinity);
  assert.equal(certain.likelihoodRatio, Infinity);
  assert.equal(certain.updateDirection, "unchanged");

  assert.equal(counterEvidence.likelihoodRatio, 0);
  assert.equal(counterEvidence.posterior, 0);
  assert.equal(counterEvidence.evidenceDirection, "opposes");
  assert.equal(counterEvidence.updateDirection, "decrease");
});

test("tiny but meaningful posterior changes retain their mathematical direction", () => {
  const model = computeBayes({
    prior: 1e-13,
    truePositiveRate: 1,
    falsePositiveRate: 0.5
  });

  assert.equal(model.likelihoodRatio, 2);
  assert.equal(model.updateDirection, "increase");
  assert.ok(model.posterior > model.prior);
});

test("randomized Bayes models preserve decomposition and complement invariants", () => {
  let seed = 0x5eed1234;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  for (let index = 0; index < 750; index += 1) {
    const model = computeBayes({
      prior: random(),
      truePositiveRate: random(),
      falsePositiveRate: random()
    });
    const frequency = buildFrequencyModel(model, 10000);

    closeTo(
      model.hypothesisAndEvidence + model.nonHypothesisAndEvidence,
      model.pEvidence
    );
    closeTo(model.posterior + model.complementPosterior, 1);
    assert.ok(model.posterior >= 0 && model.posterior <= 1);
    closeTo(
      frequency.hypothesis.total + frequency.nonHypothesis.total,
      frequency.cohortSize,
      1e-9
    );
    closeTo(
      frequency.evidence.total + frequency.noEvidence.total,
      frequency.cohortSize,
      1e-9
    );
    closeTo(
      frequency.evidence.fromHypothesis +
        frequency.evidence.fromNonHypothesis,
      frequency.evidence.total,
      1e-9
    );
  }
});

test("computeBayes rejects missing, nonfinite, and out-of-range probabilities", () => {
  assert.throws(() => computeBayes(), TypeError);
  assert.throws(
    () =>
      computeBayes({
        prior: NaN,
        truePositiveRate: 0.5,
        falsePositiveRate: 0.5
      }),
    RangeError
  );
  assert.throws(
    () =>
      computeBayes({
        prior: 1.01,
        truePositiveRate: 0.5,
        falsePositiveRate: 0.5
      }),
    RangeError
  );
});

test("percentage validation converts 0–100 UI values into probabilities", () => {
  assert.deepEqual(
    validatePercentInputs({
      prior: "1",
      truePositiveRate: " 95 ",
      falsePositiveRate: 5
    }),
    {
      ok: true,
      values: {
        prior: 0.01,
        truePositiveRate: 0.95,
        falsePositiveRate: 0.05
      },
      percentages: {
        prior: 1,
        truePositiveRate: 95,
        falsePositiveRate: 5
      },
      errors: {}
    }
  );

  const invalid = validatePercentInputs({
    prior: "",
    truePositiveRate: Infinity,
    falsePositiveRate: 101
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.values, null);
  assert.deepEqual(Object.keys(invalid.errors).sort(), [
    "falsePositiveRate",
    "prior",
    "truePositiveRate"
  ]);
});

test("frequency formatting marks only genuinely fractional expected counts", () => {
  const model = computeBayes({
    prior: 0.013,
    truePositiveRate: 0.333,
    falsePositiveRate: 0.047
  });
  const frequency = buildFrequencyModel(model, 101);

  assert.equal(frequency.hasApproximateCounts, true);
  assert.match(formatCount(frequency.trueEvidenceCount), /^≈/);
  assert.equal(formatCount(495.00000000000006), "495");
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(1e-9), "≈1e−9");
  assert.notEqual(formatCount(1e-9), "≈0");
  assert.equal(formatCount(Number.MIN_VALUE), "≈4.941e−324");
});

test("formatters retain tiny nonzero values and identify undefined ratios", () => {
  assert.equal(formatDecimal(0.00000032), "3.2e−7");
  assert.equal(formatDecimal(12.3456), "12.35");
  assert.equal(formatPercent(0.000001), "<0.01%");
  assert.equal(formatPercent(0), "0%");
  assert.equal(formatPercent(95 / 590), "16.1%");
  assert.equal(formatRatio(19), "19×");
  assert.equal(formatRatio(Infinity), "∞×");
  assert.equal(formatRatio(null), "undefined");
});

test("Beta validation enforces parameter and safe observation bounds", () => {
  assert.equal(
    validateBetaInputs({ alpha: "0.1", beta: 1000, heads: "0", tails: 10000 })
      .ok,
    true
  );

  const invalid = validateBetaInputs({
    alpha: 0.09,
    beta: 1001,
    heads: 1.5,
    tails: 10001
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual(Object.keys(invalid.errors).sort(), [
    "alpha",
    "beta",
    "heads",
    "tails"
  ]);
});

test("Beta(1,1) updated by 8 heads and 2 tails has correct statistics", () => {
  const model = computeBetaModel({ alpha: 1, beta: 1, heads: 8, tails: 2 });

  assert.equal(model.posterior.alpha, 9);
  assert.equal(model.posterior.beta, 3);
  closeTo(model.prior.mean, 0.5);
  closeTo(model.prior.variance, 1 / 12);
  closeTo(model.posterior.mean, 0.75);
  closeTo(model.posterior.variance, 27 / (144 * 13));
  closeTo(model.posterior.sd, Math.sqrt(27 / (144 * 13)));
  assert.equal(model.observations.total, 10);
  assert.equal(model.uncertaintyChange, "narrower");
});

test("zero observations preserve uncertainty exactly", () => {
  const model = computeBetaModel({ alpha: 2, beta: 5, heads: 0, tails: 0 });

  assert.deepEqual(model.posterior, model.prior);
  assert.equal(model.varianceChange, 0);
  assert.equal(model.sdChange, 0);
  assert.equal(model.uncertaintyChange, "unchanged");
});

test("an observation can widen Beta uncertainty", () => {
  const model = computeBetaModel({ alpha: 100, beta: 1, heads: 0, tails: 1 });

  assert.ok(model.posterior.variance > model.prior.variance);
  assert.ok(model.posterior.sd > model.prior.sd);
  assert.equal(model.uncertaintyChange, "wider");
});

test("density sampling stays finite and mode-aware at all accepted extremes", () => {
  const cases = [
    { alpha: 0.1, beta: 0.1, heads: 0, tails: 0 },
    { alpha: 0.1, beta: 1000, heads: 10000, tails: 0 },
    { alpha: 1000, beta: 0.1, heads: 0, tails: 10000 },
    { alpha: 1000, beta: 1000, heads: 10000, tails: 10000 }
  ];

  cases.forEach((inputs) => {
    const model = computeBetaModel(inputs);

    [model.priorSeries, model.posteriorSeries].forEach((series) => {
      assert.ok(series.points.length >= LIMITS.density.defaultSteps);
      assert.ok(Number.isFinite(series.logPeak));
      assert.ok(Number.isFinite(series.yMax));
      assert.ok(series.yMax >= 0 && series.yMax <= 1);
      assert.equal(series.points[0].x, 0);
      assert.equal(series.points.at(-1).x, 1);

      series.points.forEach((point) => {
        assert.ok(Number.isFinite(point.x));
        assert.ok(Number.isFinite(point.y));
        assert.ok(point.x >= 0 && point.x <= 1);
        assert.ok(point.y >= 0 && point.y <= 1);
      });
    });

    closeTo(
      Math.max(model.priorSeries.yMax, model.posteriorSeries.yMax),
      1,
      1e-12
    );
  });
});

test("standalone density series includes the analytical interior mode", () => {
  const series = buildBetaDensitySeries(9, 3, { steps: 100 });
  const expectedMode = 0.8;

  closeTo(series.mode, expectedMode);
  assert.ok(series.points.some((point) => Math.abs(point.x - expectedMode) < 1e-14));
  closeTo(series.yMax, 1);
});
