# Bayes multi-evidence visualizer

Explore two sequential Bayesian updates or a Beta prior updated by observed coin flips.

## Modes

- `Hypothesis mode`: sequential update flow (`prior -> after B1 -> after B2`).
- `Parameter mode (coin bias)`: Beta prior and posterior density curves over `p(heads)`.

## Run

```bash
npm install
npm run build
```

Open `dist/index.html` in a browser.

## Notes

- Hypothesis mode formulas:
  - `P(A|B1) = [P(B1|A) * P(A)] / P(B1)`
  - `P(A|B1,B2) = [P(B2|A) * P(A|B1)] / P(B2|B1)`
- Parameter mode formulas:
  - Prior: `Beta(alpha, beta)`
  - Posterior after data: `Beta(alpha + heads, beta + tails)`
- Hypothesis mode assumes conditional independence of `B1` and `B2` given `A` and `~A`.
