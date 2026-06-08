function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getSubjectId(item) {
  return item?.subject_id ?? item?.subjectId ?? null;
}

function getUserId(item) {
  return item?.user_id ?? item?.userId ?? item?.uid ?? null;
}

function calculateRate(partCount, totalCount) {
  if (totalCount === 0) {
    return 0;
  }

  return Math.round((partCount / totalCount) * 100);
}

module.exports = {
  calculateRate,
  getSubjectId,
  getUserId,
  hasText,
};
