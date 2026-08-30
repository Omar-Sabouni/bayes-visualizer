# Bayes theorem calculator

A calculator showing how prior probability and evidence combine in Bayes' theorem.

> [!IMPORTANT]
> The scenarios and numbers are educational examples only. In particular, the medical-screening example is not medical advice and must not be used to interpret a real test result.

## What it covers

- A medical-screening example by default: 1% prevalence, 95% sensitivity, and a 5% false-positive rate.
- Named medical screening, quality inspection, and spam filtering scenarios, plus custom values.
- Percentage number fields for the prior `P(A)`, likelihood `P(B|A)`, and false-evidence rate `P(B|not A)`.
- One immediate result line with the prior, posterior, and evidence probability.
- A plain-language comparison of `P(B|A)` with the commonly confused reverse probability, `P(A|B)`.
- A natural-frequency contingency table and proportional evidence-composition strip for a cohort of 10,000.
- A base-rate table that holds evidence quality fixed while comparing different priors.
- A likelihood-ratio and odds calculation beside the Bayes calculation.
- A collapsed advanced Beta-Binomial lab for updating an unknown coin-bias parameter.

## Run the app

Open [`index.html`](./index.html) in a browser.

The three main inputs are percentages from 0% through 100%:

- Prior: how common or plausible the hypothesis is before observing the evidence.
- Likelihood: how often the evidence occurs when the hypothesis is true.
- False-evidence rate: how often the same evidence occurs when the hypothesis is false.

Choose a named scenario to load its terminology and values. Editing a number field switches the calculator to custom values while retaining that scenario's terminology.

## Reading the results

The app evaluates:

```text
P(B) = P(B|A)P(A) + P(B|not A)P(not A)
P(A|B) = P(B|A)P(A) / P(B)
likelihood ratio = P(B|A) / P(B|not A)
```

The natural-frequency counts are expected values for a hypothetical cohort of 10,000, not observations or people in a real dataset. A displayed `≈` marks a noninteger expected count. Very small nonzero values use threshold or scientific notation so that they are not mistaken for zero.

If `P(B)` is zero, the posterior and evidence-strength interpretation are undefined. The page reports that state instead of dividing by zero. Blank, nonfinite, or out-of-range inputs are rejected inline, and results are replaced with a correction prompt until the inputs are valid.

## Advanced Beta-Binomial lab

Expand **Beta–Binomial model** in the appendix to explore a different Bayesian question: estimating a coin's probability of heads. It starts with a `Beta(1, 1)` prior and observes 8 heads and 2 tails. Prior presets provide approachable starting points, while the alpha and beta fields allow direct control.

- Alpha and beta must each be finite values from 0.1 through 1,000.
- Heads and tails must each be safe integers from 0 through 10,000.
- The posterior is `Beta(alpha + heads, beta + tails)`.
- Prior and posterior densities share one 0–1 axis and normalization scale; an accompanying table reports their parameters, means, and standard deviations.

The uncertainty explanation compares the prior and posterior standard deviations, so it can report wider, narrower, or unchanged spread.
