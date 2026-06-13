const {
  buildWeakSubjectItems,
  generateTodoRecommendationMessage,
  getRecommendationLevel,
  getWeakQuizSubjects,
} = require("../src/utils/recommendationUtils");

describe("recommendationUtils", () => {
  test("완료율 80 이상이면 good을 반환한다", () => {
    expect(getRecommendationLevel(80)).toBe("good");
  });

  test("완료율 50 이상 80 미만이면 normal을 반환한다", () => {
    expect(getRecommendationLevel(65)).toBe("normal");
  });

  test("완료율 50 미만이면 low를 반환한다", () => {
    expect(getRecommendationLevel(49)).toBe("low");
  });

  test("완료율이 낮으면 학습 독려 메시지를 반환한다", () => {
    expect(generateTodoRecommendationMessage(30)).toContain("낮습니다");
  });

  test("완료율이 보통이면 꾸준한 마무리 메시지를 반환한다", () => {
    expect(generateTodoRecommendationMessage(60)).toContain("꾸준히");
  });

  test("완료율이 높으면 유지 메시지를 반환한다", () => {
    expect(generateTodoRecommendationMessage(90)).toContain("유지");
  });

  test("퀴즈 정답률이 threshold보다 낮은 과목만 약점 과목으로 반환한다", () => {
    const quizResults = [
      { subject_id: "subject-1", correct_rate: 80 },
      { subject_id: "subject-2", correct_rate: 40 },
      { subject_id: "subject-3", correct_count: 2, total_count: 5 },
      { subject_id: "subject-4", correct_count: 0, total_count: 0 },
    ];

    expect(getWeakQuizSubjects(quizResults, 50)).toEqual([
      quizResults[1],
      quizResults[2],
      quizResults[3],
    ]);
  });

  test("정답률 정보가 없으면 0으로 보고 약점 과목에 포함한다", () => {
    const quizResults = [{ subject_id: "subject-5" }];
    expect(getWeakQuizSubjects(quizResults, 50)).toEqual(quizResults);
  });

  test("약점 과목에 subject title을 포함한다", () => {
    const items = buildWeakSubjectItems(
      [{ id: "result-1", quiz_id: "quiz-1", correct_rate: 40 }],
      [{ id: "quiz-1", subject_id: "subject-1" }],
      [{ id: "subject-1", title: "수학" }],
      60
    );

    expect(items).toEqual([
      {
        itemKey: "subject-1-result-1",
        subjectId: "subject-1",
        subjectTitle: "수학",
        correctRate: 40,
      },
    ]);
  });

  test("과목 title이 비어 있으면 약점 목록에서 제외한다", () => {
    const items = buildWeakSubjectItems(
      [{ id: "result-1", quiz_id: "quiz-1", correct_rate: 30 }],
      [{ id: "quiz-1", subject_id: "stored-subject-id" }],
      [{ dataId: "stored-subject-id", documentId: "subject-doc-1", title: "  " }],
      60
    );

    expect(items).toEqual([]);
  });

  test("퀴즈 또는 과목이 매핑되지 않으면 약점 목록에서 제외한다", () => {
    const items = buildWeakSubjectItems(
      [{ id: "result-1", quiz_id: "missing-quiz", correct_rate: 20 }],
      [],
      [{ id: "subject-1", title: "수학" }],
      60
    );

    expect(items).toEqual([]);
  });

  test("과목별 가장 최근 퀴즈 결과만 약점 판단에 사용한다", () => {
    const items = buildWeakSubjectItems(
      [
        {
          id: "old-result",
          quiz_id: "quiz-1",
          correct_rate: 20,
          solved_at: new Date("2026-06-01"),
        },
        {
          id: "latest-result",
          quiz_id: "quiz-2",
          correct_rate: 80,
          solved_at: new Date("2026-06-10"),
        },
      ],
      [
        { id: "quiz-1", subject_id: "subject-1" },
        { id: "quiz-2", subject_id: "subject-1" },
      ],
      [{ id: "subject-1", title: "수학" }],
      60
    );

    expect(items).toEqual([]);
  });

  test("created_at을 fallback으로 사용해 가장 최근 결과를 선택한다", () => {
    const items = buildWeakSubjectItems(
      [
        {
          id: "old-result",
          quiz_id: "quiz-1",
          correct_rate: 90,
          created_at: { seconds: 100 },
        },
        {
          id: "latest-result",
          quiz_id: "quiz-2",
          correct_rate: 30,
          created_at: { seconds: 200 },
        },
      ],
      [
        { id: "quiz-1", subject_id: "subject-1" },
        { id: "quiz-2", subject_id: "subject-1" },
      ],
      [{ id: "subject-1", title: "수학" }],
      60
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      itemKey: "subject-1-latest-result",
      subjectTitle: "수학",
      correctRate: 30,
    });
  });

  test("최신 결과 선택 시 solved_at을 created_at보다 우선한다", () => {
    const items = buildWeakSubjectItems(
      [
        {
          id: "actually-latest",
          quiz_id: "quiz-1",
          correct_rate: 20,
          solved_at: new Date("2026-06-10"),
          created_at: new Date("2026-06-01"),
        },
        {
          id: "created-later",
          quiz_id: "quiz-2",
          correct_rate: 90,
          solved_at: new Date("2026-06-05"),
          created_at: new Date("2026-06-20"),
        },
      ],
      [
        { id: "quiz-1", subject_id: "subject-1" },
        { id: "quiz-2", subject_id: "subject-1" },
      ],
      [{ id: "subject-1", title: "수학" }],
      60
    );

    expect(items[0]).toMatchObject({
      itemKey: "subject-1-actually-latest",
      correctRate: 20,
    });
  });

  test("퀴즈 문서 ID와 저장된 id를 모두 subject_id 매핑에 사용한다", () => {
    const items = buildWeakSubjectItems(
      [
        { id: "result-1", quiz_id: "stored-quiz-id", correct_rate: 40 },
        { id: "result-2", quiz_id: "quiz-doc-id", correct_rate: 20 },
      ],
      [
        {
          id: "quiz-doc-id",
          documentId: "quiz-doc-id",
          dataId: "stored-quiz-id",
          subject_id: "subject-1",
        },
      ],
      [{ id: "subject-1", title: "수학" }],
      60
    );

    expect(items).toHaveLength(1);
    expect(items[0].subjectTitle).toBe("수학");
  });

  test("약점 과목은 정답률이 낮은 순서로 정렬한다", () => {
    const items = buildWeakSubjectItems(
      [
        { id: "result-1", quiz_id: "quiz-1", correct_rate: 50 },
        { id: "result-2", quiz_id: "quiz-2", correct_rate: 10 },
        { id: "result-3", quiz_id: "quiz-3", correct_rate: 30 },
      ],
      [
        { id: "quiz-1", subject_id: "subject-1" },
        { id: "quiz-2", subject_id: "subject-2" },
        { id: "quiz-3", subject_id: "subject-3" },
      ],
      [
        { id: "subject-1", title: "과목 1" },
        { id: "subject-2", title: "과목 2" },
        { id: "subject-3", title: "과목 3" },
      ],
      60
    );

    expect(items.map((item) => item.correctRate)).toEqual([10, 30, 50]);
  });

  test("quiz_id 매핑 결과를 quiz_result의 subject_id보다 우선한다", () => {
    const items = buildWeakSubjectItems(
      [
        {
          id: "result-1",
          quiz_id: "quiz-1",
          subject_id: "wrong-subject",
          correct_rate: 20,
        },
      ],
      [{ id: "quiz-1", subject_id: "subject-1" }],
      [{ id: "subject-1", title: "수학" }],
      60
    );

    expect(items[0]).toMatchObject({
      subjectId: "subject-1",
      subjectTitle: "수학",
    });
  });

  test("같은 과목의 서로 다른 퀴즈 결과는 최신 결과 하나로 그룹화한다", () => {
    const items = buildWeakSubjectItems(
      [
        {
          id: "result-1",
          quiz_id: "quiz-1",
          correct_rate: 10,
          solved_at: new Date("2026-06-01"),
        },
        {
          id: "result-2",
          quiz_id: "quiz-2",
          correct_rate: 40,
          solved_at: new Date("2026-06-10"),
        },
      ],
      [
        { id: "quiz-1", subject_id: "subject-1" },
        { id: "quiz-2", subject_id: "subject-1" },
      ],
      [{ id: "subject-1", title: "알고리즘" }],
      60
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      subjectTitle: "알고리즘",
      correctRate: 40,
    });
  });

  test("correct_rate가 없으면 점수와 전체 문제 수로 정답률을 계산한다", () => {
    const items = buildWeakSubjectItems(
      [{ id: "result-1", quiz_id: "quiz-1", score: 2, total_count: 5 }],
      [{ id: "quiz-1", subject_id: "subject-1" }],
      [{ id: "subject-1", title: "수학" }],
      60
    );

    expect(items[0].correctRate).toBe(40);
  });
});
