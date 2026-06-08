# Jest Test Guide

This project uses Jest to test pure utility logic for the PlanDi Expo/React Native app.

## Covered Utility Files

- `src/utils/commonUtils.js`
- `src/utils/subjectUtils.js`
- `src/utils/todoUtils.js`
- `src/utils/scheduleUtils.js`
- `src/utils/noteUtils.js`
- `src/utils/studyUtils.js`
- `src/utils/quizUtils.js`
- `src/utils/recommendationUtils.js`

Screen files, Expo Router files, Firebase configuration, and direct Auth/Firestore/Functions calls are excluded from these unit tests. The test scope focuses on deterministic calculation and validation functions that do not require external services.

## Run Tests

```bash
npm test
```

## Run Coverage

```bash
npm run test:coverage
```

The coverage table reports Statements, Branches, Functions, and Lines for files under `src/utils`.
