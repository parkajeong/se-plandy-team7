const {
  calculateRate,
  getSubjectId,
  getUserId,
  hasText,
} = require("../src/utils/commonUtils");

describe("commonUtils", () => {
  test("문자열이 아니면 hasText는 false를 반환한다", () => {
    expect(hasText(null)).toBe(false);
  });

  test("subject_id와 subjectId를 읽는다", () => {
    expect(getSubjectId({ subject_id: "subject-1" })).toBe("subject-1");
    expect(getSubjectId({ subjectId: "subject-2" })).toBe("subject-2");
    expect(getSubjectId({})).toBeNull();
  });

  test("여러 user id 필드명을 읽는다", () => {
    expect(getUserId({ user_id: "user-1" })).toBe("user-1");
    expect(getUserId({ userId: "user-2" })).toBe("user-2");
    expect(getUserId({ uid: "user-3" })).toBe("user-3");
    expect(getUserId({})).toBeNull();
  });

  test("비율을 반올림하고 전체 수가 0이면 0을 반환한다", () => {
    expect(calculateRate(1, 3)).toBe(33);
    expect(calculateRate(0, 0)).toBe(0);
  });
});
