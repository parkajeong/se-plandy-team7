const {
  filterNotesBySubject,
  validateNoteForQuiz,
  validateNoteInput,
} = require("../src/utils/noteUtils");

describe("noteUtils", () => {
  const notes = [
    { id: "note-1", subject_id: "subject-1", title: "개념", content: "내용" },
    { id: "note-2", subjectId: "subject-2", title: "문제", content: "풀이" },
  ];

  test("제목, 내용, 과목이 모두 있으면 true를 반환한다", () => {
    expect(validateNoteInput("개념", "내용", "subject-1")).toBe(true);
  });

  test("제목이 없으면 false를 반환한다", () => {
    expect(validateNoteInput("", "내용", "subject-1")).toBe(false);
  });

  test("내용이 없으면 false를 반환한다", () => {
    expect(validateNoteInput("개념", "", "subject-1")).toBe(false);
  });

  test("내용이 공백만 있으면 false를 반환한다", () => {
    expect(validateNoteInput("개념", "   ", "subject-1")).toBe(false);
  });

  test("과목이 없으면 false를 반환한다", () => {
    expect(validateNoteInput("개념", "내용", "")).toBe(false);
  });

  test("퀴즈 생성용 노트 내용이 있으면 true를 반환한다", () => {
    expect(validateNoteForQuiz("퀴즈로 만들 내용")).toBe(true);
  });

  test("빈 노트는 false를 반환한다", () => {
    expect(validateNoteForQuiz("")).toBe(false);
  });

  test("과목별 노트를 필터링한다", () => {
    expect(filterNotesBySubject(notes, "subject-2")).toEqual([notes[1]]);
  });
});
