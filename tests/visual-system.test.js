"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const ROOT_HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ROOT_SCRIPT = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");

test("the calculator reads from inputs to frequency field to posterior", () => {
  const prior = ROOT_HTML.indexOf('id="pAInput"');
  const likelihood = ROOT_HTML.indexOf('id="pBgAInput"');
  const alternativeLikelihood = ROOT_HTML.indexOf('id="pBgNotAInput"');
  const posterior = ROOT_HTML.indexOf('id="conditionalPosteriorValue"');
  const population = ROOT_HTML.indexOf('id="populationCanvas"');
  const appendices = ROOT_HTML.indexOf('class="appendices"');
  const derivation = ROOT_HTML.indexOf('id="posterior"');
  const baseRate = ROOT_HTML.indexOf('id="base-rate"');
  const betaBinomial = ROOT_HTML.indexOf('id="coin-lab"');

  assert.ok(prior > 0);
  assert.ok(prior < likelihood);
  assert.ok(likelihood < alternativeLikelihood);
  assert.ok(alternativeLikelihood < posterior);
  assert.ok(posterior < population);
  assert.ok(population < appendices);
  assert.ok(appendices < derivation);
  assert.ok(derivation < baseRate);
  assert.ok(baseRate < betaBinomial);
  assert.match(ROOT_HTML, /class="calculator-workspace"/);
  assert.match(ROOT_HTML, /<summary>2 × 2 count table<\/summary>/);
  assert.match(ROOT_HTML, /<summary>Derivation and odds form<\/summary>/);
  assert.match(ROOT_HTML, /<summary>Base-rate sensitivity<\/summary>/);
  assert.match(ROOT_HTML, /<summary>Beta–Binomial model<\/summary>/);
});

test("the population view exposes one mark per modeled case and exact text alternatives", () => {
  assert.match(
    ROOT_HTML,
    /<canvas\s+id="populationCanvas"\s+width="500"\s+height="500"/s
  );
  [
    "populationTrueEvidence",
    "populationHypothesisOnly",
    "populationFalseEvidence",
    "populationNeither",
    "frequencyDescription"
  ].forEach((id) => assert.match(ROOT_HTML, new RegExp(`id="${id}"`)));
  assert.match(ROOT_HTML, /One mark per expected case/);
  assert.match(ROOT_HTML, /2 × 2 count table/);
});

test("print exposes every appendix without mutating its screen disclosure state", () => {
  assert.match(ROOT_SCRIPT, /addEventListener\("beforeprint", expandDisclosuresForPrint\)/);
  assert.match(ROOT_SCRIPT, /addEventListener\("afterprint", restoreDisclosuresAfterPrint\)/);
  assert.match(ROOT_SCRIPT, /document\.querySelectorAll\("details\.appendix-section"\)/);
  assert.match(ROOT_SCRIPT, /disclosure\.open = true/);
  assert.match(ROOT_SCRIPT, /disclosure\.open = wasOpen/);
  assert.doesNotMatch(ROOT_HTML, /<details\b[^>]*\sopen(?:\s|>|=)/i);
});
