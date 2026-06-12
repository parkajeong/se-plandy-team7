const {
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
});
