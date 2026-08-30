"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const core = require("../bayes-core.js");
const ROOT = path.join(__dirname, "..");
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const CONTROLLER_SOURCE = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");

class FakeClassList {
  constructor(initialValue) {
    this.tokens = new Set(String(initialValue || "").split(/\s+/).filter(Boolean));
  }

  add(...tokens) {
    tokens.forEach((token) => this.tokens.add(token));
  }

  remove(...tokens) {
    tokens.forEach((token) => this.tokens.delete(token));
  }

  contains(token) {
    return this.tokens.has(token);
  }

  toString() {
    return Array.from(this.tokens).join(" ");
  }
}

class FakeElement {
  constructor(tagName, attributes = {}) {
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    Object.entries(attributes).forEach(([name, value]) => {
      this.attributes.set(name, String(value));
    });
    this.id = attributes.id || "";
    this.value = attributes.value || "";
    this.textContent = "";
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.classList = new FakeClassList(attributes.class);
    this.style = parseStyle(attributes.style);
    this.scope = attributes.scope || "";
    this.colSpan = attributes.colspan ? Number(attributes.colspan) : 1;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children.forEach((child) => {
      child.parentNode = null;
    });
    this.children = [];
    children.forEach((child) => this.appendChild(child));
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    const normalizedEvent = typeof event === "string" ? { type: event } : event;
    if (!normalizedEvent || !normalizedEvent.type) {
      throw new TypeError("Fake events need a type.");
    }
    normalizedEvent.target = normalizedEvent.target || this;
    normalizedEvent.currentTarget = this;
    (this.listeners.get(normalizedEvent.type) || []).forEach((listener) => {
      listener.call(this, normalizedEvent);
    });
    return true;
  }

  setAttribute(name, value) {
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "id") {
      this.id = normalized;
    } else if (name === "class") {
      this.classList = new FakeClassList(normalized);
    } else if (name === "value") {
      this.value = normalized;
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }
}

class FakeDocument {
  constructor(elements) {
    this.elements = elements;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

function parseStyle(rawStyle) {
  const style = {};
  String(rawStyle || "")
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .forEach((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator >= 0) {
        const property = declaration.slice(0, separator).trim();
        const value = declaration.slice(separator + 1).trim();
        const camelCase = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        style[camelCase] = value;
      }
    });
  return style;
}

function parseAttributes(rawAttributes) {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
  let match;
  while ((match = pattern.exec(rawAttributes)) !== null) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return attributes;
}

function buildFakeDocument(html) {
  const elements = new Map();
  const openingTagPattern = /<([a-z][\w-]*)\b([^>]*\bid\s*=\s*(?:"[^"]+"|'[^']+')[^>]*)>/gi;
  let match;

  while ((match = openingTagPattern.exec(html)) !== null) {
    const attributes = parseAttributes(match[2]);
    if (attributes.id && !elements.has(attributes.id)) {
      elements.set(attributes.id, new FakeElement(match[1], attributes));
    }
  }

  return new FakeDocument(elements);
}

function controllerBindingIds() {
  const bindingBlock = CONTROLLER_SOURCE.match(/const ids\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(bindingBlock, "controller should declare its required ID bindings");
  return Array.from(bindingBlock[1].matchAll(/"([^"]+)"/g), (match) => match[1]);
}

function bootstrapController() {
  const document = buildFakeDocument(HTML_SOURCE);
  const window = { BayesCore: core };
  const context = vm.createContext({ window, document, console });
  vm.runInContext(CONTROLLER_SOURCE, context, { filename: "script.js" });
  return {
    document,
    byId(id) {
      const element = document.getElementById(id);
      assert.ok(element, `expected #${id} in fake document`);
      return element;
    }
  };
}

function fire(element, type) {
  element.dispatchEvent({ type });
}

function setNumber(env, id, value) {
  const input = env.byId(id);
  input.value = String(value);
  fire(input, "input");
}

function dynamicRowLabels(body) {
  return body.children.map((row) => row.children[0].textContent);
}

test("HTML IDs and all controller bindings form a valid static contract", () => {
  const ids = Array.from(
    HTML_SOURCE.matchAll(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/gi),
    (match) => match[1] || match[2]
  );
  const counts = new Map();
  ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  const duplicates = Array.from(counts).filter(([, count]) => count > 1);

  assert.deepEqual(duplicates, [], "IDs must be unique");

  const requiredIds = controllerBindingIds();
  assert.ok(requiredIds.length > 40, "binding contract should cover the controller surface");
  assert.equal(new Set(requiredIds).size, requiredIds.length, "controller binding IDs must be unique");
  requiredIds.forEach((id) => {
    assert.equal(counts.get(id), 1, `controller binding #${id} must exist exactly once`);
  });

  assert.doesNotThrow(() => bootstrapController());
});

test("labels, ARIA references, fragment links, and classic script order resolve", () => {
  const ids = new Set(
    Array.from(
      HTML_SOURCE.matchAll(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/gi),
      (match) => match[1] || match[2]
    )
  );

  for (const match of HTML_SOURCE.matchAll(/<label\b[^>]*\bfor\s*=\s*"([^"]+)"[^>]*>/gi)) {
    assert.ok(ids.has(match[1]), `label target #${match[1]} must exist`);
  }

  for (const match of HTML_SOURCE.matchAll(/\baria-(?:labelledby|describedby)\s*=\s*"([^"]+)"/gi)) {
    match[1].trim().split(/\s+/).forEach((id) => {
      assert.ok(ids.has(id), `ARIA reference #${id} must exist`);
    });
  }

  for (const match of HTML_SOURCE.matchAll(/\bhref\s*=\s*"#([^"]+)"/gi)) {
    assert.ok(ids.has(match[1]), `fragment target #${match[1]} must exist`);
  }

  const scriptSources = Array.from(
    HTML_SOURCE.matchAll(/<script\b[^>]*\bsrc\s*=\s*"([^"]+)"[^>]*>/gi),
    (match) => match[1]
  );
  assert.ok(scriptSources.includes("bayes-core.js"));
  assert.ok(scriptSources.includes("script.js"));
  assert.ok(
    scriptSources.indexOf("bayes-core.js") < scriptSources.indexOf("script.js"),
    "the classic core script must load before the controller"
  );
});

test("controller bootstraps the medical example and default Beta update", () => {
  const env = bootstrapController();

  assert.equal(env.byId("presetSelect").value, "medical-screening");
  assert.match(env.byId("summaryNarrative").textContent, /P\(A\|B\) = 16\.1%/);
  assert.equal(env.byId("tableTrueEvidence").textContent, "95");
  assert.equal(env.byId("tableFalseEvidence").textContent, "495");
  assert.equal(env.byId("tableEvidenceTotal").textContent, "590");
  assert.equal(env.byId("populationTrueEvidence").textContent, "95");
  assert.equal(env.byId("populationHypothesisOnly").textContent, "5");
  assert.equal(env.byId("populationFalseEvidence").textContent, "495");
  assert.equal(env.byId("populationNeither").textContent, "9405");
  assert.match(env.byId("populationCanvas").getAttribute("aria-label"), /10,000 modeled cases/i);
  assert.equal(
    env.byId("frequencyPoolAnswer").textContent,
    "590 positive tests. 95 of them come from people with the condition."
  );
  assert.ok(
    Math.abs(parseFloat(env.byId("evidenceFromHypothesis").getAttribute("width")) - (95 / 590) * 100) < 1e-9
  );
  assert.equal(env.byId("evidenceComposition").hidden, false);
  assert.match(env.byId("evidenceComposition").getAttribute("aria-label"), /condition present, 16\.1%/i);
  assert.equal(env.byId("likelihoodRatioValue").textContent, "19×");

  assert.equal(env.byId("coinPresetSelect").value, "uniform-eight-two");
  assert.equal(env.byId("posteriorParameterCell").textContent, "Beta(9, 3)");
  assert.equal(env.byId("posteriorMeanCell").textContent, "75%");
  assert.equal(env.byId("posteriorSdCell").textContent, "12%");
  assert.match(env.byId("priorDensityPath").getAttribute("d"), /^M\s/);
  assert.match(env.byId("posteriorDensityPath").getAttribute("d"), /^M\s/);
  assert.doesNotMatch(env.byId("posteriorDensityPath").getAttribute("d"), /NaN|Infinity/);
});

test("percentage number fields update the model and switch to custom values", () => {
  const env = bootstrapController();
  const priorNumber = env.byId("pAInput");

  priorNumber.value = "12.3";
  fire(priorNumber, "input");
  assert.equal(env.byId("presetSelect").value, "custom");
  assert.match(env.byId("summaryNarrative").textContent, /prior 12\.3%/);

  priorNumber.value = "0";
  fire(priorNumber, "input");
  assert.match(env.byId("summaryNarrative").textContent, /prior 0%/);

  const likelihoodNumber = env.byId("pBgAInput");
  likelihoodNumber.value = "100";
  fire(likelihoodNumber, "input");
  assert.equal(likelihoodNumber.getAttribute("aria-invalid"), "false");
});

test("manual edits keep contextual scenario language and abstract mode remains explicit", () => {
  const env = bootstrapController();

  setNumber(env, "pAInput", 2);
  assert.equal(env.byId("presetSelect").value, "custom");
  assert.equal(env.byId("priorLabel").textContent, "Condition prevalence");
  assert.match(env.byId("presetDescription").textContent, /medical screening/i);

  env.byId("presetSelect").value = "abstract";
  fire(env.byId("presetSelect"), "change");
  assert.equal(env.byId("priorLabel").textContent, "Prior probability");
  assert.equal(env.byId("pAInput").value, "30");
});

test("base-rate rows deduplicate fixed and current priors", () => {
  const env = bootstrapController();
  const body = env.byId("baseRateBody");

  assert.deepEqual(dynamicRowLabels(body), ["1%", "10%", "50%"]);

  setNumber(env, "pAInput", 2);
  assert.deepEqual(dynamicRowLabels(body), ["1%", "2%", "10%", "50%"]);

  setNumber(env, "pAInput", 10);
  assert.deepEqual(dynamicRowLabels(body), ["1%", "10%", "50%"]);
  const currentRows = body.children.filter((row) => row.getAttribute("aria-current") === "true");
  assert.equal(currentRows.length, 1);
  assert.equal(currentRows[0].children[0].textContent, "10%");
});

test("an invalid Bayes input marks the field and clears every stale result", () => {
  const env = bootstrapController();
  const priorNumber = env.byId("pAInput");

  assert.match(env.byId("summaryNarrative").textContent, /16\.1%/);
  priorNumber.value = "";
  fire(priorNumber, "input");

  assert.equal(priorNumber.getAttribute("aria-invalid"), "true");
  assert.notEqual(env.byId("pAError").textContent, "");
  assert.equal(env.byId("tableTrueEvidence").textContent, "—");
  assert.equal(env.byId("populationTrueEvidence").textContent, "—");
  assert.equal(env.byId("populationNeither").textContent, "—");
  assert.match(env.byId("populationCanvas").getAttribute("aria-label"), /unavailable/i);
  assert.equal(env.byId("evidenceFromHypothesis").getAttribute("width"), "0%");
  assert.equal(env.byId("evidenceComposition").hidden, true);
  assert.equal(env.byId("baseRateBody").children.length, 1);
  assert.match(env.byId("posteriorResult").textContent, /unavailable/i);
  assert.doesNotMatch(env.byId("summaryNarrative").textContent, /16\.1|previous result/i);

  priorNumber.value = "1";
  fire(priorNumber, "input");
  assert.equal(priorNumber.getAttribute("aria-invalid"), "false");
  assert.match(env.byId("summaryNarrative").textContent, /16\.1%/);
});

test("impossible evidence is reported as undefined rather than strong support", () => {
  const env = bootstrapController();

  setNumber(env, "pAInput", 0);
  setNumber(env, "pBgAInput", 100);
  setNumber(env, "pBgNotAInput", 0);

  assert.equal(env.byId("tableEvidenceTotal").textContent, "0");
  assert.equal(env.byId("evidenceFromHypothesis").getAttribute("width"), "0%");
  assert.equal(env.byId("evidenceComposition").hidden, true);
  assert.match(env.byId("summaryNarrative").textContent, /undefined/);
  assert.match(env.byId("posteriorResult").textContent, /undefined/);
  assert.equal(env.byId("likelihoodRatioValue").textContent, "undefined");
  assert.match(env.byId("likelihoodRatioText").textContent, /never occurs/i);
  assert.match(env.byId("oddsUpdateText").textContent, /undefined/i);
  const evidenceCopy = [
    env.byId("likelihoodRatioText").textContent,
    env.byId("oddsUpdateText").textContent,
    env.byId("evidenceTakeaway").textContent
  ].join(" ");
  assert.doesNotMatch(evidenceCopy, /strong support|supports the hypothesis/i);
});

test("evidence composition preserves exact zero and full-width boundaries", () => {
  const env = bootstrapController();

  setNumber(env, "pAInput", 0);
  assert.equal(env.byId("evidenceComposition").hidden, false);
  assert.equal(env.byId("evidenceFromHypothesis").getAttribute("width"), "0%");

  setNumber(env, "pAInput", 100);
  assert.equal(env.byId("evidenceComposition").hidden, false);
  assert.equal(env.byId("evidenceFromHypothesis").getAttribute("width"), "100%");
});

test("base-rate explanation handles zero and neutral evidence paths", () => {
  const env = bootstrapController();

  setNumber(env, "pBgAInput", 0);
  assert.match(env.byId("baseRateTakeaway").textContent, /true-evidence path is zero/i);

  setNumber(env, "pBgAInput", 50);
  setNumber(env, "pBgNotAInput", 0);
  assert.match(env.byId("baseRateTakeaway").textContent, /false-evidence path is zero/i);

  setNumber(env, "pBgNotAInput", 50);
  assert.match(env.byId("baseRateTakeaway").textContent, /evidence is equally likely/i);

  setNumber(env, "pBgAInput", 50.00000000005);
  assert.doesNotMatch(env.byId("baseRateTakeaway").textContent, /evidence is equally likely/i);
});

test("an individually scaled guide reveals an extreme compressed Beta curve", () => {
  const env = bootstrapController();

  setNumber(env, "alphaInput", 0.1);
  setNumber(env, "betaInput", 1000);
  setNumber(env, "headsInput", 10000);
  setNumber(env, "tailsInput", 0);

  assert.equal(env.byId("posteriorShapeGuidePath").getAttribute("hidden"), null);
  assert.match(env.byId("posteriorShapeGuidePath").getAttribute("d"), /^M\s/);
  assert.match(env.byId("densityScaleNote").textContent, /dotted guide/i);
  assert.equal(env.byId("shapeGuideLegend").hidden, false);
});

test("an invalid Beta field clears paths, markers, and numerical output", () => {
  const env = bootstrapController();
  const alpha = env.byId("alphaInput");

  assert.notEqual(env.byId("priorDensityPath").getAttribute("d"), "");
  alpha.value = "";
  fire(alpha, "input");

  assert.equal(alpha.getAttribute("aria-invalid"), "true");
  assert.notEqual(env.byId("alphaError").textContent, "");
  assert.equal(env.byId("priorDensityPath").getAttribute("d"), "");
  assert.equal(env.byId("posteriorDensityPath").getAttribute("d"), "");
  assert.equal(env.byId("priorMeanLine").style.display, "none");
  assert.equal(env.byId("posteriorMeanLine").style.display, "none");
  assert.equal(env.byId("priorParameterCell").textContent, "—");
  assert.equal(env.byId("posteriorParameterCell").textContent, "—");
  assert.match(env.byId("coinNarrative").textContent, /correct the highlighted input/i);
});
