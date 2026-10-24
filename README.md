# Dice Analyzer

Dice Analyzer is a small Vue + TypeScript app for calculating exact dice probabilities and RPG damage outcomes. It helps you analyze the real distribution behind a roll, whether you are evaluating a single dice expression or comparing multiple combat actions in D&D 5e or Pathfinder 2e.

## Overview

This project focuses on precise, discrete probability calculations instead of rough estimates. It can:

- compute the full outcome distribution of a free-form dice expression,
- evaluate action success probabilities against a DC,
- model damage with saves, critical hits, and critical failures,
- combine multiple actions into a total damage distribution,
- display cumulative probabilities for damage thresholds.

It is especially useful when you want to compare builds, action choices, or critical-damage rules with real numbers.

## Supported modes

### Default

This mode keeps the original behavior: enter a dice expression such as `2d20+3d8+1` and inspect the histogram, cumulative chart, and summary statistics. An optional target DC adds success analysis.

### DnD

This mode analyzes a list of actions, each with:

- its own DC,
- a test condition such as Advantage or Disadvantage,
- one or more damage rolls,
- optional save behavior,
- critical-damage handling.

The app supports standard critical damage patterns and alternative critical-damage rules for D&D-style analysis.
An optional enemy can provide a shared AC and saving throw values. Attacks use the enemy AC and action modifier; Save actions use the selected enemy save and the action DC. Positive enemy HP enables its survival chart.
The enemy's More Options section supports damage resistances, weaknesses (vulnerabilities), and immunities. DnD resistances halve same-type damage (rounding down), weaknesses double it, and immunities negate it.
DnD damage types are Acid, Bludgeoning, Cold, Fire, Force, Lightning, Necrotic, Piercing, Poison, Psychic, Radiant, Slashing, and Thunder.

### PF2

This mode uses Pathfinder 2e success-degree logic. It tracks critical success, success, failure, and critical failure for each action and combines their contributions into a total distribution.
An optional enemy can provide a shared AC and Fortitude, Reflex, and Will values. Attacks use the enemy AC and action modifier; Save actions use the selected enemy save and the action DC. Positive enemy HP enables its survival chart.
The enemy's More Options section supports damage resistances, weaknesses, and immunities. PF2 resistances and weaknesses have a configurable non-negative value (default 5); resistance reduces matching damage per action, weakness adds its value per action that deals that damage type, and immunity negates it.
PF2 damage types are Bludgeoning, Piercing, Slashing, Acid, Cold, Electricity, Fire, Sonic, Vitality, Void, Force, Spirit, Mental, Poison, Bleed, Precision, Holy, and Unholy.

Damage types are selected from the active mode's list, and each type has an associated color used in damage charts. Types exclusive to one mode are not available in the other.

## Key features

- Exact probability distribution calculation for dice and damage
- Multi-action analysis with independent DCs per action or a shared enemy target
- Support for Advantage and Disadvantage in DnD
- Save and basic save handling
- Optional one-time reroll of damage dice that show 1
- Critical success and critical failure logic
- Per-roll, per-action, and total damage charts
- Probability of reaching or exceeding a threshold of total damage
- Enemy survival probability and remaining HP quantiles over the next 10 turns when positive enemy HP is provided
- URL-based mode switching via `?mode=dnd` and `?mode=pf2`

## Dice expressions and analysis

Expressions use standard dice notation, such as `2d20+3d8+1` or `1d6 - 2`. The Default mode accepts d2, d4, d6, d8, d10, d12, d20, and d100, with up to 100 dice per group. Damage expressions in DnD and PF2 are limited to d2 through d12. Negative dice counts and other dice notation are not supported.

In Default mode, the target DC is optional; when provided, the app also reports success probability. In DnD and PF2, each action has its own d20 test. Without an enemy, each action also has its own modifier and DC. With an enemy, attacks use its AC and the action modifier; Save actions use the selected enemy saving throw modifier and the action DC. Total damage analysis requires valid target values for every action and valid damage expressions. Leaving a required target blank still allows conditional damage rolls to be inspected, but excludes the global damage distribution.

When an enemy has positive HP and all actions have valid target and damage values, the app charts its probability of surviving each of the next 10 turns and the enemy's remaining HP quantiles (D1, Q1, median, Q3, and D9) after each turn. Defeated enemies remain at 0 HP in the quantile distribution. It assumes the same action set is repeated each turn and uses the total damage distribution after applying enemy damage traits.

DnD critical damage can use either doubled damage dice (modifiers apply once) or the alternative rule that adds the maximum possible dice result. PF2 doubles final damage on a critical success. Basic saves deal double damage on critical failure, normal damage on failure, half damage rounded down on success, and no damage on critical success.

## Quick start

Prerequisites: Node.js and npm.

```sh
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Production build

```sh
npm run build
```

To preview the built app:

```sh
npm run preview
```

## Deploy to GitHub Pages

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and deploys the app when changes are pushed to `main`. It can also be started manually from the **Actions** tab.

1. Push the repository to GitHub.
2. In **Settings > Pages**, set the build and deployment source to **GitHub Actions**.
3. Check the **Actions** tab for the deployment result. Once it succeeds, the app is available at <https://ahighwind.github.io/dice-analyzer/>.

This repository is a project site, so Vite uses `/dice-analyzer/` as its production base path in GitHub Actions builds. If you rename the repository or deploy it under a different path (for example, as a user/organization site), update `base` in `vite.config.ts` to match. Keep `npm run build` passing locally before pushing; the workflow uses `npm ci` to install the exact dependency versions from the lockfile.

## Project structure

```text
src/
  components/      UI for controls, results, and charts
  composables/     reactive state and shared analysis logic
  domain/dice/     dice math, probability rules, and damage analysis
  utils/           utility helpers

docs/
  architecture.md  technical overview of the calculation flow
```

## Architecture

The project is built with Vue 3, TypeScript, Vite, and Chart.js.

- `src/domain/dice/` contains the rules for dice parsing, probability, action analysis, and damage calculations.
- `src/composables/` manages the app state and keeps the URL and charts synchronized.
- `src/components/` renders controls, summaries, and visualizations.

See [docs/architecture.md](./docs/architecture.md) for a deeper explanation of the calculation flow.

## Why this project exists

Dice Analyzer was created to make action planning more transparent. Instead of guessing which options are strongest, you can inspect the real probability distribution behind the numbers and compare outcomes analytically.
