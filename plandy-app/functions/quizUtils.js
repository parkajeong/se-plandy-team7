const DEFAULT_QUESTION_COUNT = 5;
const ALLOWED_QUESTION_COUNTS = [5, 10, 15, 20, 25, 30];

const parseQuestionCount = (value) => {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_QUESTION_COUNT;
  }

  const questionCount =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!ALLOWED_QUESTION_COUNTS.includes(questionCount)) {
    throw new Error("questionCount must be one of 5, 10, 15, 20, 25, 30.");
  }

  return questionCount;
};

const stripJsonFence = (text) =>
  String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

const extractJsonValue = (text) => {
  const clean = stripJsonFence(text);
  const starts = [clean.indexOf("{"), clean.indexOf("[")].filter(
    (index) => index >= 0
  );

  if (!starts.length) {
    throw new Error("Gemini response does not contain JSON.");
  }

  const start = Math.min(...starts);
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < clean.length; index += 1) {
    const char = clean[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack.pop() !== expected) {
        throw new Error("Gemini response contains malformed JSON.");
      }
      if (!stack.length) return clean.slice(start, index + 1);
    }
  }

  throw new Error("Gemini response contains incomplete JSON.");
};

const extractJsonArray = (text) => {
  const value = JSON.parse(extractJsonValue(text));

  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.questions)) return value.questions;

  throw new Error("Gemini response does not contain a questions array.");
};

const parseGeminiQuizJson = (text) => {
  const clean = stripJsonFence(text);

  if (!clean) {
    throw new Error("Gemini response is empty.");
  }

  const value = JSON.parse(extractJsonValue(clean));
  return Array.isArray(value) ? { questions: value } : value;
};

const validateQuestions = (questions) => {
  if (!Array.isArray(questions)) {
    throw new Error("questions must be an array.");
  }

  questions.forEach((item, index) => {
    if (!item || typeof item.question !== "string" || !item.question.trim()) {
      throw new Error(`questions[${index}].question must be a non-empty string.`);
    }

    if (
      !Array.isArray(item.options) ||
      item.options.length !== 4 ||
      !item.options.every((option) => typeof option === "string" && option.trim())
    ) {
      throw new Error(`questions[${index}].options must be four strings.`);
    }

    if (
      typeof item.answer !== "number" ||
      !Number.isInteger(item.answer) ||
      item.answer < 0 ||
      item.answer > 3
    ) {
      throw new Error(`questions[${index}].answer must be an integer from 0 to 3.`);
    }

    if (typeof item.explanation !== "string" || !item.explanation.trim()) {
      throw new Error(`questions[${index}].explanation must be a non-empty string.`);
    }
  });

  return questions.map((item) => ({
    question: item.question.trim(),
    options: item.options.map((option) => option.trim()),
    answer: item.answer,
    explanation: item.explanation.trim(),
  }));
};

const validateQuizPayload = (
  payload,
  { questionCount = DEFAULT_QUESTION_COUNT } = {}
) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Gemini response JSON must be an object.");
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : "AI 노트 퀴즈";

  const questions = validateQuestions(payload.questions);

  if (questions.length < questionCount) {
    throw new Error(
      `Gemini returned ${questions.length} questions, expected ${questionCount}.`
    );
  }

  return {
    title,
    questions: questions.slice(0, questionCount),
  };
};

const assertNoteContent = (content) => {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Note content is empty.");
  }

  return content.trim();
};

const buildQuizPrompt = ({
  noteTitle,
  noteContent,
  questionCount = DEFAULT_QUESTION_COUNT,
}) => `
아래 노트 내용을 바탕으로 객관식 4지선다 퀴즈를 정확히 ${questionCount}개 생성해라.

조건:
- 문제 수는 정확히 ${questionCount}개입니다.
- 각 문제는 4지선다 객관식입니다.
- answer는 정답 보기의 0부터 시작하는 인덱스입니다.
- explanation은 짧고 이해하기 쉽게 작성하세요.
- 반드시 아래 JSON 형식만 반환하세요.
- JSON 외의 설명 문장, 마크다운 코드블록, 주석은 절대 포함하지 마세요.

{
  "title": "퀴즈 제목",
  "questions": [
    {
      "question": "문제 내용",
      "options": ["보기1", "보기2", "보기3", "보기4"],
      "answer": 0,
      "explanation": "해설"
    }
  ]
}

노트 제목: ${noteTitle || "제목 없음"}
노트 본문:
${noteContent}
`;

module.exports = {
  ALLOWED_QUESTION_COUNTS,
  assertNoteContent,
  buildQuizPrompt,
  DEFAULT_QUESTION_COUNT,
  extractJsonArray,
  extractJsonValue,
  parseGeminiQuizJson,
  parseQuestionCount,
  validateQuestions,
  validateQuizPayload,
};
