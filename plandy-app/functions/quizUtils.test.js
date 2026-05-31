const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertNoteContent,
  parseGeminiQuizJson,
  parseQuestionCount,
  validateQuizPayload,
} = require("./quizUtils");

const validQuestion = {
  question: "HTTP의 기본 포트는?",
  options: ["80", "443", "22", "53"],
  answer: 0,
  explanation: "HTTP는 기본적으로 80번 포트를 사용합니다.",
};

const makeQuestions = (count) =>
  Array.from({ length: count }, (_, index) => ({
    ...validQuestion,
    question: `${validQuestion.question} ${index + 1}`,
  }));

test("parseGeminiQuizJson parses fenced JSON", () => {
  const parsed = parseGeminiQuizJson(
    '```json\n{"title":"테스트","questions":[]}\n```'
  );

  assert.equal(parsed.title, "테스트");
  assert.deepEqual(parsed.questions, []);
});

test("parseQuestionCount defaults to 5 and accepts allowed values", () => {
  assert.equal(parseQuestionCount(undefined), 5);
  assert.equal(parseQuestionCount("10"), 10);
  assert.equal(parseQuestionCount(30), 30);
});

test("parseQuestionCount rejects invalid values", () => {
  assert.throws(() => parseQuestionCount(7), /questionCount/);
  assert.throws(() => parseQuestionCount(35), /questionCount/);
});

test("validateQuizPayload accepts expected question count", () => {
  const quiz = validateQuizPayload(
    {
      title: "네트워크 퀴즈",
      questions: makeQuestions(5),
    },
    { questionCount: 5 }
  );

  assert.equal(quiz.title, "네트워크 퀴즈");
  assert.equal(quiz.questions.length, 5);
  assert.equal(quiz.questions[0].answer, 0);
});

test("validateQuizPayload trims extra questions", () => {
  const quiz = validateQuizPayload(
    {
      title: "네트워크 퀴즈",
      questions: makeQuestions(7),
    },
    { questionCount: 5 }
  );

  assert.equal(quiz.questions.length, 5);
});

test("validateQuizPayload rejects too few questions", () => {
  assert.throws(
    () =>
      validateQuizPayload(
        {
          title: "네트워크 퀴즈",
          questions: makeQuestions(4),
        },
        { questionCount: 5 }
      ),
    /expected 5/
  );
});

test("assertNoteContent rejects empty note content", () => {
  assert.throws(() => assertNoteContent("   "), /empty/);
});

test("validateQuizPayload rejects invalid answer index", () => {
  assert.throws(
    () =>
      validateQuizPayload(
        {
          title: "잘못된 퀴즈",
          questions: [{ ...validQuestion, answer: 4 }],
        },
        { questionCount: 1 }
      ),
    /answer/
  );
});
