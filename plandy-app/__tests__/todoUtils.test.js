const {
  calculateTodoCompletionRate,
  filterTodosBySubject,
  isTodoCompleted,
  validateTodoInput,
} = require("../src/utils/todoUtils");

describe("todoUtils", () => {
  const todos = [
    { id: "todo-1", subject_id: "subject-1", is_completed: true },
    { id: "todo-2", subject_id: "subject-1", is_completed: false },
    { id: "todo-3", subjectId: "subject-2", isCompleted: true },
  ];

  test("제목과 과목이 있으면 true를 반환한다", () => {
    expect(validateTodoInput("과제 제출", "subject-1")).toBe(true);
  });

  test("제목이 없으면 false를 반환한다", () => {
    expect(validateTodoInput("", "subject-1")).toBe(false);
  });

  test("과목이 없으면 false를 반환한다", () => {
    expect(validateTodoInput("과제 제출", "")).toBe(false);
  });

  test("완료된 Todo는 true를 반환한다", () => {
    expect(isTodoCompleted(todos[0])).toBe(true);
  });

  test("미완료 Todo는 false를 반환한다", () => {
    expect(isTodoCompleted(todos[1])).toBe(false);
  });

  test("isCompleted 필드가 true인 Todo도 완료로 판단한다", () => {
    expect(isTodoCompleted(todos[2])).toBe(true);
  });

  test("과목별 Todo를 필터링한다", () => {
    expect(filterTodosBySubject(todos, "subject-1")).toEqual([
      todos[0],
      todos[1],
    ]);
  });

  test("Todo 완료율을 계산한다", () => {
    expect(calculateTodoCompletionRate(todos)).toBe(67);
  });

  test("Todo가 0개이면 완료율 0을 반환한다", () => {
    expect(calculateTodoCompletionRate([])).toBe(0);
  });
});
