const { calculateRate, getSubjectId, hasText } = require("./commonUtils");

function validateTodoInput(title, subjectId) {
  return hasText(title) && hasText(subjectId);
}

function isTodoCompleted(todo) {
  return todo?.is_completed === true || todo?.isCompleted === true;
}

function filterTodosBySubject(todos = [], subjectId) {
  return todos.filter((todo) => getSubjectId(todo) === subjectId);
}

function calculateTodoCompletionRate(todos = []) {
  const completedCount = todos.filter(isTodoCompleted).length;
  return calculateRate(completedCount, todos.length);
}

module.exports = {
  calculateTodoCompletionRate,
  filterTodosBySubject,
  isTodoCompleted,
  validateTodoInput,
};
