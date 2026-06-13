const {
  filterSchedulesByDate,
  filterSchedulesBySubject,
  validateScheduleInput,
} = require("../src/utils/scheduleUtils");

describe("scheduleUtils", () => {
  const schedules = [
    { id: "schedule-1", subject_id: "subject-1", date: "2026-06-08" },
    { id: "schedule-2", subject_id: "subject-2", start_time: new Date(2026, 5, 8, 10, 0) },
    { id: "schedule-3", subjectId: "subject-1", date: "2026-06-09" },
  ];

  test("제목, 날짜, 과목이 모두 있으면 true를 반환한다", () => {
    expect(validateScheduleInput("시험", "2026-06-08", "subject-1")).toBe(true);
  });

  test("제목이 없으면 false를 반환한다", () => {
    expect(validateScheduleInput("", "2026-06-08", "subject-1")).toBe(false);
  });

  test("날짜가 없으면 false를 반환한다", () => {
    expect(validateScheduleInput("시험", null, "subject-1")).toBe(false);
  });

  test("과목이 없으면 false를 반환한다", () => {
    expect(validateScheduleInput("시험", "2026-06-08", "")).toBe(false);
  });

  test("특정 날짜 일정만 필터링한다", () => {
    expect(filterSchedulesByDate(schedules, "2026-06-08")).toEqual([
      schedules[0],
      schedules[1],
    ]);
  });

  test("Date와 Firestore Timestamp 형태의 날짜도 필터링한다", () => {
    const firestoreDate = { toDate: () => new Date(2026, 5, 10, 9, 0) };
    expect(filterSchedulesByDate([{ start_time: firestoreDate }], new Date(2026, 5, 10))).toEqual([
      { start_time: firestoreDate },
    ]);
  });

  test("날짜가 없는 일정은 날짜 필터링 결과에서 제외한다", () => {
    expect(filterSchedulesByDate([{ id: "schedule-empty" }], "2026-06-08")).toEqual([]);
  });

  test("특정 과목 일정만 필터링한다", () => {
    expect(filterSchedulesBySubject(schedules, "subject-1")).toEqual([
      schedules[0],
      schedules[2],
    ]);
  });
});
