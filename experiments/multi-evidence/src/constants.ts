namespace App {
  export const MAX_RADIUS = 88;
  export const CENTER_Y = 130;
  export const CENTER_X = 210;
  export const DENSITY_GRID_STEPS = 240;
  export const DENSITY_EPSILON = 1e-4;

  export const PRESETS: ReadonlyArray<PresetDefinition> = [
    {
      id: "neutral-chain",
      label: "Neutral chain",
      description: "Both evidence events support A with moderate strength.",
      pA: 0.3,
      pB1gA: 0.75,
      pB1gNotA: 0.3,
      pB2gA: 0.8,
      pB2gNotA: 0.25
    },
    {
      id: "rare-a-strong-signals",
      label: "Rare A, strong signals",
      description: "A starts rare but both evidence events strongly favor A.",
      pA: 0.05,
      pB1gA: 0.9,
      pB1gNotA: 0.15,
      pB2gA: 0.92,
      pB2gNotA: 0.2
    },
    {
      id: "mixed-evidence",
      label: "Mixed evidence",
      description: "B1 favors A but B2 is weaker and less selective.",
      pA: 0.2,
      pB1gA: 0.85,
      pB1gNotA: 0.25,
      pB2gA: 0.55,
      pB2gNotA: 0.4
    },
    {
      id: "common-a",
      label: "Common A",
      description: "A is common; additional evidence still changes certainty.",
      pA: 0.7,
      pB1gA: 0.72,
      pB1gNotA: 0.38,
      pB2gA: 0.7,
      pB2gNotA: 0.35
    }
  ];

  export const STEPS: ReadonlyArray<StepDefinition> = [
    {
      title: "Prior and event space",
      theory:
        "Start with prior belief P(A). Before evidence, uncertainty is split between A and not-A.",
      formula: "P(~A) = 1 - P(A)",
      focus: "prior",
      focusLine: "Step focus: event A before conditioning.",
      keyKind: "prior",
      showContribB1: false,
      showContribB2: false,
      showStrength: false
    },
    {
      title: "First update using B1",
      theory:
        "Compute P(B1) from two weighted paths, then condition on B1 to obtain P(A|B1).",
      formula: "P(A|B1) = [P(B1|A) * P(A)] / P(B1)",
      focus: "b1",
      focusLine: "Step focus: first evidence event B1.",
      keyKind: "stage1",
      showContribB1: true,
      showContribB2: false,
      showStrength: false
    },
    {
      title: "Second update using B2",
      theory:
        "Treat P(A|B1) as the new prior and update again with B2 to get P(A|B1,B2).",
      formula: "P(A|B1,B2) = [P(B2|A) * P(A|B1)] / P(B2|B1)",
      focus: "b2",
      focusLine: "Step focus: second evidence event B2 after B1.",
      keyKind: "stage2",
      showContribB1: false,
      showContribB2: true,
      showStrength: false
    },
    {
      title: "Evidence strength and caution",
      theory:
        "Each evidence event contributes a likelihood ratio. Odds update by multiplying LR1 and LR2.",
      formula: "Posterior odds = Prior odds * LR1 * LR2",
      focus: "strength",
      focusLine: "Step focus: combined support after both evidence events.",
      keyKind: "strength",
      showContribB1: false,
      showContribB2: false,
      showStrength: true
    }
  ];
}
