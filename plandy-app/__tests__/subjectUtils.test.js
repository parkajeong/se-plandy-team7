const {
  filterSubjectsByUser,
  findSubjectById,
  validateSubjectTitle,
} = require("../src/utils/subjectUtils");

describe("subjectUtils", () => {
  const subjects = [
    { id: "subject-1", user_id: "user-1", title: "Math" },
    { id: "subject-2", user_id: "user-2", title: "English" },
    { id: "subject-3", userId: "user-1", title: "Science" },
  ];

  test("과목명이 있으면 true를 반환한다", () => {
    expect(validateSubjectTitle("Math")).toBe(true);
  });

  test("과목명이 빈 문자열이면 false를 반환한다", () => {
    expect(validateSubjectTitle("")).toBe(false);
  });

  test("과목명이 공백만 있으면 false를 반환한다", () => {
    expect(validateSubjectTitle("   ")).toBe(false);
  });

  test("subject_id로 과목을 찾으면 해당 과목을 반환한다", () => {
    expect(findSubjectById(subjects, "subject-2")).toEqual(subjects[1]);
  });

  test("없는 subject_id면 null을 반환한다", () => {
    expect(findSubjectById(subjects, "missing")).toBeNull();
  });

  test("user_id 기준으로 해당 사용자의 과목만 필터링한다", () => {
    expect(filterSubjectsByUser(subjects, "user-1")).toEqual([
      subjects[0],
      subjects[2],
    ]);
  });
});
