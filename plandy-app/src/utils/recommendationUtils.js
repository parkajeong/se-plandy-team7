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
  const correctRate = Number(result?.correct_rate);
  if (Number.isFinite(correctRate)) return correctRate;

  const totalCount = Number(result?.total_count);
  const correctCount = Number(result?.correct_count ?? result?.score);
  if (
    Number.isFinite(totalCount) &&
    totalCount > 0 &&
    Number.isFinite(correctCount)
  ) {
    return Math.round((correctCount / totalCount) * 100);
  }

  return 0;
}

function getWeakQuizSubjects(quizResults = [], threshold = 60) {
  return quizResults.filter((result) => getResultCorrectRate(result) < threshold);
}

function getSubjectTitle(subject) {
  return typeof subject?.title === "string" && subject.title.trim()
    ? subject.title.trim()
    : null;
}

function getResultTime(result) {
  const value = result?.solved_at || result?.created_at;
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function buildWeakSubjectItems(
  quizResults = [],
  quizzes = [],
  subjects = [],
  threshold = 60
) {
  const subjectIdByQuizId = new Map();
  quizzes.forEach((quiz) => {
    [quiz?.id, quiz?.documentId, quiz?.dataId].forEach((quizId) => {
      if (quizId && quiz?.subject_id) {
        subjectIdByQuizId.set(quizId, quiz.subject_id);
      }
    });
  });

  const subjectById = new Map();
  subjects.forEach((subject) => {
    [subject?.id, subject?.documentId, subject?.dataId].forEach((subjectId) => {
      if (subjectId) subjectById.set(subjectId, subject);
    });
  });

  const latestResultBySubjectId = new Map();

  quizResults.forEach((result, index) => {
    const subjectId = subjectIdByQuizId.get(result?.quiz_id);
    if (!subjectId || !subjectById.has(subjectId)) return;

    const current = latestResultBySubjectId.get(subjectId);
    const resultTime = getResultTime(result);

    if (
      !current ||
      resultTime > current.resultTime ||
      (resultTime === current.resultTime && index > current.index)
    ) {
      latestResultBySubjectId.set(subjectId, { index, result, resultTime });
    }
  });

  return Array.from(latestResultBySubjectId.entries())
    .filter(([, { result }]) => getResultCorrectRate(result) < threshold)
    .map(([subjectId, { result, index }]) => {
      const subject = subjectById.get(subjectId);
      const subjectTitle = getSubjectTitle(subject);
      if (!subjectTitle) return null;

      const correctRate = getResultCorrectRate(result);
      const resultId =
        result?.id || result?.documentId || result?.quiz_id || index;

      return {
        itemKey: `${subjectId || "unknown"}-${resultId}`,
        subjectId,
        subjectTitle,
        correctRate,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.correctRate - b.correctRate);
}

module.exports = {
  buildWeakSubjectItems,
  generateTodoRecommendationMessage,
  getRecommendationLevel,
  getWeakQuizSubjects,
};
