import React, { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  completeTodo,
  createTodo,
  deleteTodo,
  fetchSubjects,
  fetchTodos,
  reopenTodo,
  updateTodo,
} from '../../src/todoService';
import SubjectDropdown from '../../components/SubjectDropdown';

type TodoCategory = '시험' | '과제' | '복습' | '기타';

type Subject = {
  id: string;
  user_id: string;
  title: string;
  goal: string;
  created_at: string;
};

type Todo = {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  is_completed: boolean;
  deadline: string;
  priority: number;
  created_at: string;
  description: string;
  category: TodoCategory;
};

type TodoForm = {
  title: string;
  subject_id: string;
  category: TodoCategory;
  deadline: Date | null;
  priority: string;
  description: string;
};

const TODO_CATEGORIES: TodoCategory[] = ['시험', '과제', '복습', '기타'];

const initialForm: TodoForm = {
  title: '',
  subject_id: '',
  category: '과제',
  deadline: null,
  priority: '3',
  description: '',
};

function formatDateForStorage(date: Date | null) {
  if (!date) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateFromString(dateString: string) {
  if (!dateString) {
    return null;
  }

  const [year, month, day] = dateString.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function getCalendarDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const firstDayOfWeek = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days: (number | null)[] = [];

  for (let i = 0; i < firstDayOfWeek; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(day);
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function getCalendarWeeks(currentMonth: Date) {
  const days = getCalendarDays(currentMonth);
  const weeks: (number | null)[][] = [];

  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return weeks;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '알 수 없는 오류가 발생했습니다.';
}

function confirmOnWeb(message: string) {
  if (Platform.OS !== 'web') {
    return false;
  }

  return window.confirm(message);
}

export default function TodoScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState<TodoForm>(initialForm);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);

  const [isTodoModalVisible, setIsTodoModalVisible] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const subjectTitleMap = useMemo(() => {
    return subjects.reduce<Record<string, string>>((acc, subject) => {
      acc[subject.id] = subject.title;
      return acc;
    }, {});
  }, [subjects]);

  const calendarWeeks = useMemo(() => {
    return getCalendarWeeks(currentMonth);
  }, [currentMonth]);

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) {
      errors.title = '할 일 제목을 입력해주세요.';
    }

    if (!form.subject_id) {
      errors.subject_id = '과목을 선택해주세요.';
    }

    if (!form.category) {
      errors.category = '유형을 선택해주세요.';
    }

    if (!form.deadline) {
      errors.deadline = '마감일을 선택해주세요.';
    }

    const priority = Number(form.priority);
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
      errors.priority = '우선순위를 선택해주세요.';
    }

    return errors;
  };

  const clearValidationError = (fieldName: string) => {
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  };

  const loadData = useCallback(async () => {
    try {
      const [subjectList, todoList] = await Promise.all([
        fetchSubjects(),
        fetchTodos(),
      ]);

      setSubjects(subjectList);
      setTodos(todoList);
    } catch (error) {
      Alert.alert('조회 실패', getErrorMessage(error));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function init() {
        setIsLoading(true);
        await loadData();
        if (isActive) {
          setIsLoading(false);
        }
      }

      init();

      return () => {
        isActive = false;
      };
    }, [loadData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const openCreateModal = () => {
    setEditingTodoId(null);
    setForm({
      ...initialForm,
      subject_id: subjects[0]?.id || '',
    });
    setCurrentMonth(new Date());
    setValidationErrors({});
    setIsTodoModalVisible(true);
  };

  const openEditModal = (todo: Todo) => {
    const parsedDeadline = parseDateFromString(todo.deadline);

    setEditingTodoId(todo.id);
    setForm({
      title: todo.title,
      subject_id: todo.subject_id,
      category: todo.category || '기타',
      deadline: parsedDeadline,
      priority: String(todo.priority),
      description: todo.description || '',
    });
    setCurrentMonth(parsedDeadline || new Date());
    setValidationErrors({});
    setIsTodoModalVisible(true);
  };

  const closeTodoModal = () => {
    if (isSaving) {
      return;
    }

    setIsTodoModalVisible(false);
    setIsCalendarVisible(false);
    setEditingTodoId(null);
    setForm(initialForm);
    setValidationErrors({});
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
    });
  };

  const handleSelectDate = (day: number) => {
    const selectedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    setForm((prev) => ({
      ...prev,
      deadline: selectedDate,
    }));
    setIsCalendarVisible(false);
  };

  const handleSaveTodo = async () => {
    if (subjects.length === 0) {
      Alert.alert('과목 필요', '먼저 과목을 등록해주세요.');
      return;
    }

    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      Alert.alert('필수 입력 항목 확인', '필수 입력 항목을 모두 채워주세요.');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        title: form.title,
        subject_id: form.subject_id,
        category: form.category,
        deadline: formatDateForStorage(form.deadline),
        priority: form.priority,
        description: form.description,
      };

      if (editingTodoId) {
        await updateTodo(editingTodoId, payload);
      } else {
        await createTodo(payload);
      }

      await loadData();
      closeTodoModal();
    } catch (error) {
      Alert.alert('저장 실패', getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleComplete = async (todo: Todo) => {
    try {
      if (todo.is_completed) {
        await reopenTodo(todo.id);
      } else {
        await completeTodo(todo.id);
      }

      await loadData();
    } catch (error) {
      Alert.alert('상태 변경 실패', getErrorMessage(error));
    }
  };

  const performDeleteTodo = async (todoId: string) => {
    if (!todoId) {
      const error = new Error('Todo id is missing. Cannot delete todo.');
      Alert.alert('삭제 실패', getErrorMessage(error));
      return;
    }

    const previousTodos = todos;

    try {
      setTodos((currentTodos) =>
        currentTodos.filter((item) => item.id !== todoId)
      );

      await deleteTodo(todoId);
      await loadData();
    } catch (error) {
      setTodos(previousTodos);
      Alert.alert('삭제 실패', getErrorMessage(error));
    }
  };

  const handleDeleteTodo = (todo: Todo) => {
    const todoId = todo.id;

    if (Platform.OS === 'web') {
      if (confirmOnWeb('이 할 일을 삭제할까요?')) {
        void performDeleteTodo(todoId);
      }
      return;
    }

    Alert.alert('할 일 삭제', '이 할 일을 삭제할까요?', [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await performDeleteTodo(todoId);
        },
      },
    ]);
  };

  const handleGoToSubjects = () => {
    closeTodoModal();
    router.push('/subjects');
  };

  const renderTodoItem = ({ item }: { item: Todo }) => {
    const subjectTitle = subjectTitleMap[item.subject_id] || '과목 정보 없음';

    return (
      <View style={styles.todoCard}>
        <View style={styles.todoHeader}>
          <Pressable
            style={[
              styles.checkBox,
              item.is_completed && styles.checkBoxCompleted,
            ]}
            onPress={() => handleToggleComplete(item)}
          >
            <Text style={styles.checkBoxText}>
              {item.is_completed ? '✓' : ''}
            </Text>
          </Pressable>

          <View style={styles.todoTitleArea}>
            <Text
              style={[
                styles.todoTitle,
                item.is_completed && styles.completedText,
              ]}
            >
              {item.title}
            </Text>

            <Text style={styles.todoMeta}>
              {subjectTitle} · {item.category} · 우선순위 {item.priority}
            </Text>
          </View>
        </View>

        {!!item.description && (
          <Text style={styles.todoDescription}>{item.description}</Text>
        )}

        <View style={styles.todoInfoRow}>
          <View style={styles.deadlineBadge}>
            <Text style={styles.deadlineText}>
              마감일: {item.deadline || '미설정'}
            </Text>
          </View>
          <Text style={styles.todoStatus}>
            {item.is_completed ? '완료' : '진행 중'}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, styles.editButton]}
            onPress={() => openEditModal(item)}
          >
            <Text style={styles.actionButtonText}>수정</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteTodo(item)}
          >
            <Text style={styles.actionButtonText}>삭제</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>할 일을 불러오는 중입니다.</Text>
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient
      colors={['#FFFFFF', '#EDF2F7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>TodoList</Text>
          <Text style={styles.screenSubtitle}>
            과목별 학습 할 일을 관리하세요
          </Text>
        </View>

        <Pressable style={styles.addButton} onPress={openCreateModal}>
          <Text style={styles.addButtonText}>+ 등록</Text>
        </Pressable>
      </View>

      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        renderItem={renderTodoItem}
        contentContainerStyle={[
          styles.listContent,
          todos.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>등록된 할 일이 없습니다.</Text>
            <Text style={styles.emptyDescription}>
              과제, 시험 준비, 복습 일정을 등록해보세요.
            </Text>
          </View>
        }
      />

      <Modal
        visible={isTodoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (isCalendarVisible) {
            setIsCalendarVisible(false);
            return;
          }

          closeTodoModal();
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.todoModalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.todoModalScrollContent}
            >
              <Text style={styles.modalTitle}>
                {editingTodoId ? '할 일 수정' : '할 일 등록'}
              </Text>

              <Text style={styles.inputLabel}>
                할 일 제목
                {validationErrors.title ? <Text style={styles.requiredMark}> *</Text> : null}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  validationErrors.title && styles.inputError,
                ]}
                placeholder="예: 소프트웨어공학 과제 제출"
                value={form.title}
                onChangeText={(text) => {
                  setForm((prev) => ({ ...prev, title: text }));
                  if (validationErrors.title) {
                    clearValidationError('title');
                  }
                }}
              />
              {validationErrors.title ? (
                <Text style={styles.validationText}>{validationErrors.title}</Text>
              ) : null}

              <Text style={styles.inputLabel}>
                과목명
                {validationErrors.subject_id ? <Text style={styles.requiredMark}> *</Text> : null}
              </Text>
              {subjects.length > 0 ? (
                <>
                  <SubjectDropdown
                    subjects={subjects}
                    selectedSubjectId={form.subject_id}
                    placeholder="과목 선택"
                    onSelect={(subject) => {
                      setForm((prev) => ({
                        ...prev,
                        subject_id: subject.id,
                      }));
                      if (validationErrors.subject_id) {
                        clearValidationError('subject_id');
                      }
                    }}
                    hasError={!!validationErrors.subject_id}
                  />
                  {validationErrors.subject_id ? (
                    <Text style={styles.validationText}>{validationErrors.subject_id}</Text>
                  ) : null}
                </>
              ) : (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    먼저 과목을 등록해주세요. Todo를 만들려면 과목이 필요합니다.
                  </Text>
                  <Pressable
                    style={styles.warningButton}
                    onPress={handleGoToSubjects}
                  >
                    <Text style={styles.warningButtonText}>
                      과목 등록하러 가기
                    </Text>
                  </Pressable>
                </View>
              )}

              <Text style={styles.inputLabel}>
                유형
                {validationErrors.category ? <Text style={styles.requiredMark}> *</Text> : null}
              </Text>
              <View
                style={[
                  styles.chipWrapContainer,
                  validationErrors.category && styles.selectionGroupError,
                ]}
              >
                <View style={styles.chipWrap}>
                  {TODO_CATEGORIES.map((category) => {
                    const selected = form.category === category;

                    return (
                      <Pressable
                        key={category}
                        style={[
                          styles.chipButton,
                          selected && styles.chipButtonSelected,
                        ]}
                        onPress={() => {
                          setForm((prev) => ({
                            ...prev,
                            category,
                          }));
                          if (validationErrors.category) {
                            clearValidationError('category');
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.chipButtonText,
                            selected && styles.chipButtonTextSelected,
                          ]}
                        >
                          {category}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {validationErrors.category ? (
                <Text style={styles.validationText}>{validationErrors.category}</Text>
              ) : null}

              <Text style={styles.inputLabel}>
                마감일
                {validationErrors.deadline ? <Text style={styles.requiredMark}> *</Text> : null}
              </Text>
              <Pressable
                style={[
                  styles.dateSelectButton,
                  validationErrors.deadline && styles.inputError,
                ]}
                onPress={() => {
                  setIsCalendarVisible(true);
                  if (validationErrors.deadline) {
                    clearValidationError('deadline');
                  }
                }}
              >
                <Text
                  style={[
                    styles.dateSelectText,
                    !form.deadline && styles.placeholderText,
                  ]}
                >
                  {form.deadline
                    ? formatDateForStorage(form.deadline)
                    : '달력에서 날짜 선택'}
                </Text>
              </Pressable>
              {validationErrors.deadline ? (
                <Text style={styles.validationText}>{validationErrors.deadline}</Text>
              ) : null}

              <Text style={styles.inputLabel}>
                우선순위
                {validationErrors.priority ? <Text style={styles.requiredMark}> *</Text> : null}
              </Text>
              <Text style={styles.helperText}>
                1이 가장 중요하고, 5가 가장 낮은 중요도입니다.
              </Text>
              <View
                style={[
                  styles.chipWrapContainer,
                  validationErrors.priority && styles.selectionGroupError,
                ]}
              >
                <View style={styles.chipWrap}>
                  {['1', '2', '3', '4', '5'].map((priority) => {
                    const selected = form.priority === priority;

                    return (
                      <Pressable
                        key={priority}
                        style={[
                          styles.priorityButton,
                          selected && styles.chipButtonSelected,
                        ]}
                        onPress={() => {
                          setForm((prev) => ({
                            ...prev,
                            priority,
                          }));
                          if (validationErrors.priority) {
                            clearValidationError('priority');
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.chipButtonText,
                            selected && styles.chipButtonTextSelected,
                          ]}
                        >
                          {priority}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {validationErrors.priority ? (
                <Text style={styles.validationText}>{validationErrors.priority}</Text>
              ) : null}

              <Text style={styles.inputLabel}>할 일 내용</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="예: 5장까지 읽고 연습문제 정리"
                value={form.description}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, description: text }))
                }
                multiline
                textAlignVertical="top"
              />

              <View style={styles.modalActionRow}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeTodoModal}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.modalButton,
                    styles.saveButton,
                    (subjects.length === 0 || !form.subject_id) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleSaveTodo}
                  disabled={isSaving || subjects.length === 0 || !form.subject_id}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? '저장 중...' : '저장'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>

          {isCalendarVisible && (
            <View style={styles.calendarModalBackground}>
              <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
                  <Pressable onPress={handlePrevMonth}>
                    <Text style={styles.monthButton}>‹</Text>
                  </Pressable>

                  <Text style={styles.monthTitle}>
                    {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                  </Text>

                  <Pressable onPress={handleNextMonth}>
                    <Text style={styles.monthButton}>›</Text>
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {['일', '월', '화', '수', '목', '금', '토'].map((weekDay) => (
                    <Text key={weekDay} style={styles.weekText}>
                      {weekDay}
                    </Text>
                  ))}
                </View>

                <View style={styles.daysContainer}>
                  {calendarWeeks.map((week, weekIndex) => (
                    <View key={weekIndex} style={styles.dayRow}>
                      {week.map((day, dayIndex) => {
                        const isSelected =
                          !!day &&
                          !!form.deadline &&
                          form.deadline.getFullYear() ===
                            currentMonth.getFullYear() &&
                          form.deadline.getMonth() === currentMonth.getMonth() &&
                          form.deadline.getDate() === day;

                        return (
                          <Pressable
                            key={`${weekIndex}-${dayIndex}`}
                            style={[
                              styles.dayBox,
                              isSelected && styles.selectedDayBox,
                            ]}
                            disabled={day === null}
                            onPress={() => day && handleSelectDate(day)}
                          >
                            <Text
                              style={[
                                styles.dayText,
                                isSelected && styles.selectedDayText,
                              ]}
                            >
                              {day || ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>

                <Pressable
                  style={styles.closeCalendarButton}
                  onPress={() => setIsCalendarVisible(false)}
                >
                  <Text style={styles.closeCalendarButtonText}>닫기</Text>
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8FA',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2B2B2B',
  },
  screenSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  addButtonText: {
    color: COLORS.buttonText,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B2B2B',
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  todoCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkBoxCompleted: {
    backgroundColor: COLORS.secondary,
  },
  checkBoxText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  todoTitleArea: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2B2B',
  },
  completedText: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  todoMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  todoDescription: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
  },
  todoInfoRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  deadlineBadge: {
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8F8FA',
  },
  deadlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  todoStatus: {
    flexShrink: 0,
    fontSize: 13,
    color: '#6B7280',
  },
  actionRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editButton: {
    backgroundColor: '#F8F8FA',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2B2B2B',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  todoModalContent: {
    maxHeight: '82%',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#ffffff',
  },
  todoModalScrollContent: {
    paddingBottom: 48,
  },
  modalTitle: {
    marginBottom: 18,
    fontSize: 22,
    fontWeight: '800',
    color: '#2B2B2B',
  },
  inputLabel: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  helperText: {
    marginTop: -2,
    marginBottom: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  input: {
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    fontSize: 15,
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 90,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chipButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#ffffff',
  },
  priorityButton: {
    width: 44,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  chipButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  chipButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  chipButtonTextSelected: {
    color: '#ffffff',
  },
  warningBox: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
  },
  warningText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#9a3412',
  },
  warningButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ea580c',
  },
  warningButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  dateSelectButton: {
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  dateSelectText: {
    fontSize: 15,
    color: '#2B2B2B',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  modalActionRow: {
    marginTop: 8,
    marginBottom: 28,
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F8FA',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  cancelButtonText: {
    fontWeight: '800',
    color: '#6B7280',
  },
  saveButtonText: {
    fontWeight: '800',
    color: COLORS.buttonText,
  },
  calendarModalBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthButton: {
    fontSize: 32,
    fontWeight: 'bold',
    paddingHorizontal: 15,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekText: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#6B7280',
  },
  daysContainer: {
    width: '100%',
  },
  dayRow: {
    flexDirection: 'row',
  },
  dayBox: {
    flex: 1,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  selectedDayBox: {
    backgroundColor: COLORS.primary,
  },
  dayText: {
    fontSize: 16,
    color: '#2B2B2B',
  },
  selectedDayText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  closeCalendarButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeCalendarButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requiredMark: {
    color: '#EF4444',
    fontWeight: '800',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  validationText: {
    marginTop: -10,
    marginBottom: 12,
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  chipWrapContainer: {
    marginBottom: 14,
  },
  selectionGroupError: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 8,
  },
});
