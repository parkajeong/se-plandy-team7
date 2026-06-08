const {
  calculateQuizCorrectRate,
  filterQuizzesBySubject,
  validateQuizCount,
  validateQuizInput,
} = require("../src/utils/quizUtils");

describe("quizUtils", () => {
  const quizzes = [
    { id: "quiz-1", subject_id: "subject-1" },
    { id: "quiz-2", subjectId: "subject-2" },
  ];

  test("퀴즈 문제 수 5는 true를 반환한다", () => {
    expect(validateQuizCount(5)).toBe(true);
  });

  test("퀴즈 문제 수 30은 true를 반환한다", () => {
    expect(validateQuizCount(30)).toBe(true);
  });

  test("퀴즈 문제 수 7은 false를 반환한다", () => {
    expect(validateQuizCount(7)).toBe(false);
  });

  test("퀴즈 문제 수 35는 false를 반환한다", () => {
    expect(validateQuizCount(35)).toBe(false);
  });

  test("noteId, subjectId, count가 있으면 true를 반환한다", () => {
    expect(validateQuizInput("note-1", "subject-1", 10)).toBe(true);
  });

  test("noteId가 없으면 false를 반환한다", () => {
    expect(validateQuizInput("", "subject-1", 10)).toBe(false);
  });

  test("subjectId가 없으면 false를 반환한다", () => {
    expect(validateQuizInput("note-1", "", 10)).toBe(false);
  });

  test("유효하지 않은 count면 false를 반환한다", () => {
    expect(validateQuizInput("note-1", "subject-1", 7)).toBe(false);
  });

  test("과목별 퀴즈를 필터링한다", () => {
    expect(filterQuizzesBySubject(quizzes, "subject-2")).toEqual([quizzes[1]]);
  });

  test("정답률을 계산한다", () => {
    expect(calculateQuizCorrectRate(3, 5)).toBe(60);
  });

  test("전체 문항 수가 0이면 정답률 0을 반환한다", () => {
    expect(calculateQuizCorrectRate(0, 0)).toBe(0);
  });
});
