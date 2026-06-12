function getRecommendationLevel(completionRate) {
  if (completionRate >= 80) {
    return "good";
  }

  if (completionRate >= 50) {
    return "normal";
  }

  return "low";
}

function generateTodoRecommendationMessage(completionRate) {
  if (completionRate < 50) {
    return "Todo 완료율이 낮습니다. 오늘 학습량을 조금씩 늘려보세요.";
  }

  if (completionRate < 80) {
    return "좋은 흐름입니다. 남은 Todo를 꾸준히 마무리해보세요.";
  }

  return "Todo 완료율이 높습니다. 현재 학습 흐름을 유지해보세요.";
}

function getResultCorrectRate(result) {
  return result?.correct_rate ?? 0;
}

function getWeakQuizSubjects(quizResults = [], threshold = 60) {
  return quizResults.filter((result) => getResultCorrectRate(result) < threshold);
}

module.exports = {
  generateTodoRecommendationMessage,
  getRecommendationLevel,
  getWeakQuizSubjects,
};
