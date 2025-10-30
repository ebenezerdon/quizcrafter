# QuizCrafter

QuizCrafter is a delightful study quiz maker that turns simple CSV files into randomized quizzes with automatic score tracking. Built by [Teda.dev](https://teda.dev), the AI app builder for everyday problems.

## Features
- Import CSV via upload or paste (commas, semicolons, or tabs)
- Supports multiple-choice and short-answer questions
- Randomize questions and answer choices each run
- Limit question count for quick drills
- Track attempts and best scores locally (no account needed)
- Responsive, accessible design with keyboard and touch support

## CSV Format
- Multiple choice: question, answer, option1, option2, option3
- Short answer: question, answer
- Use quotes for commas inside fields. You can provide synonyms for answers using `|` or `/`, for example: `USA|United States`.

## Getting Started
1. Open `index.html` for the landing page.
2. Click Open App or go to `app.html`.
3. Import a CSV (or paste) and name your quiz.
4. Save, then start taking the quiz with your preferred options.

A sample CSV is included at `assets/sample.csv`.

## Tech Stack
- Tailwind CSS (Play CDN)
- jQuery 3.7.x
- Modular JavaScript with a single `window.App` namespace
- LocalStorage for persistence

## Development Notes
- Scripts are organized as `scripts/helpers.js`, `scripts/ui.js`, and `scripts/main.js`.
- `app.html` includes scripts in the required order and initializes the app via `App.init()` then `App.render()`.
- All UI interactions use jQuery; logic is split across helper utilities and UI orchestration.

## Accessibility
- Keyboard navigable controls with visible focus
- High-contrast color choices
- Reduced motion respected via `prefers-reduced-motion`

## Privacy
All data is stored locally in your browser using localStorage. Nothing is uploaded.
