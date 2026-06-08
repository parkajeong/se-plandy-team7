const {
  filterStudyGroupsByUser,
  isStudyMember,
  validateStudyGroupInput,
} = require("../src/utils/studyUtils");

describe("studyUtils", () => {
  const studyGroups = [
    { id: "group-1", name: "알고리즘", subject_id: "subject-1", members: ["user-1", "user-2"] },
    { id: "group-2", name: "영어", subject_id: "subject-2", members: [{ user_id: "user-3" }] },
    { id: "group-3", name: "운영체제", subject_id: "subject-3", members: [] },
  ];

  test("스터디 그룹명과 과목이 있으면 true를 반환한다", () => {
    expect(validateStudyGroupInput("알고리즘", "subject-1")).toBe(true);
  });

  test("그룹명이 없으면 false를 반환한다", () => {
    expect(validateStudyGroupInput("", "subject-1")).toBe(false);
  });

  test("과목이 없으면 false를 반환한다", () => {
    expect(validateStudyGroupInput("알고리즘", "")).toBe(false);
  });

  test("사용자가 스터디 멤버이면 true를 반환한다", () => {
    expect(isStudyMember(studyGroups[0], "user-1")).toBe(true);
  });

  test("객체 멤버의 userId, uid, id 필드도 멤버로 판단한다", () => {
    expect(isStudyMember({ members: [{ userId: "user-4" }] }, "user-4")).toBe(true);
    expect(isStudyMember({ members: [{ uid: "user-5" }] }, "user-5")).toBe(true);
    expect(isStudyMember({ members: [{ id: "user-6" }] }, "user-6")).toBe(true);
  });

  test("멤버가 아니면 false를 반환한다", () => {
    expect(isStudyMember(studyGroups[0], "user-9")).toBe(false);
  });

  test("members가 배열이 아니면 false를 반환한다", () => {
    expect(isStudyMember({}, "user-1")).toBe(false);
  });

  test("사용자가 속한 스터디 그룹만 필터링한다", () => {
    expect(filterStudyGroupsByUser(studyGroups, "user-3")).toEqual([studyGroups[1]]);
  });
});
