const { getSubjectId, hasText } = require("./commonUtils");

function validateScheduleInput(title, date, subjectId) {
  return hasText(title) && Boolean(date) && hasText(subjectId);
}

function getDateKey(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = value instanceof Date ? value : value?.toDate?.();
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function filterSchedulesByDate(schedules = [], date) {
  const targetDate = getDateKey(date);
  return schedules.filter(
    (schedule) => getDateKey(schedule.date ?? schedule.start_time) === targetDate
  );
}

function filterSchedulesBySubject(schedules = [], subjectId) {
  return schedules.filter((schedule) => getSubjectId(schedule) === subjectId);
}

module.exports = {
  filterSchedulesByDate,
  filterSchedulesBySubject,
  validateScheduleInput,
};
