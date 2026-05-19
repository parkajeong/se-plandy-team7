import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  completeTodo,
  createTodo,
  deleteTodo,
  fetchTodos,
  reopenTodo,
  updateTodo,
} from '../../src/todoService';

type TodoStatus = 'pending' | 'completed';
type TodoType = 'assignment' | 'exam' | 'review' | 'etc';

type Todo = {
  id: string;
  title: string;
  description?: string;
  courseName?: string;
  type: TodoType;
  dueDate?: string;
  status: TodoStatus;
};

export default function TodoScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const [title, setTitle] = useState('');
  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [type, setType] = useState<TodoType>('assignment');

  const loadTodos = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchTodos();
      setTodos(result);
    } catch (error) {
      console.error(error);
      Alert.alert('오류', '할 일 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const resetForm = () => {
    setEditingTodo(null);
    setTitle('');
    setCourseName('');
    setDescription('');
    setDueDate('');
    setType('assignment');
  };

  const openCreateModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (todo: Todo) => {
    setEditingTodo(todo);
    setTitle(todo.title);
    setCourseName(todo.courseName || '');
    setDescription(todo.description || '');
    setDueDate(todo.dueDate || '');
    setType(todo.type || 'assignment');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('확인', '할 일 제목을 입력해주세요.');
      return;
    }

    try {
      if (editingTodo) {
        await updateTodo(editingTodo.id, {
          title: title.trim(),
          courseName: courseName.trim(),
          description: description.trim(),
          dueDate: dueDate.trim(),
          type,
        });
      } else {
        await createTodo({
          title: title.trim(),
          courseName: courseName.trim(),
          description: description.trim(),
          dueDate: dueDate.trim(),
          type,
        });
      }

      setModalVisible(false);
      resetForm();
      await loadTodos();
    } catch (error) {
      console.error(error);
      Alert.alert('오류', '할 일 저장 중 문제가 발생했습니다.');
    }
  };

  const handleToggleComplete = async (todo: Todo) => {
    try {
      if (todo.status === 'completed') {
        await reopenTodo(todo.id);
      } else {
        await completeTodo(todo.id);
      }

      await loadTodos();
    } catch (error) {
      console.error(error);
      Alert.alert('오류', '완료 상태 변경 중 문제가 발생했습니다.');
    }
  };

  const handleDelete = (todo: Todo) => {
    Alert.alert('삭제 확인', '이 할 일을 삭제하시겠습니까?', [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTodo(todo.id);
            await loadTodos();
          } catch (error) {
            console.error(error);
            Alert.alert('오류', '할 일 삭제 중 문제가 발생했습니다.');
          }
        },
      },
    ]);
  };

  const renderTodoItem = ({ item }: { item: Todo }) => {
    const isCompleted = item.status === 'completed';

    return (
      <View style={styles.todoCard}>
        <View style={styles.todoHeader}>
          <Text style={[styles.todoTitle, isCompleted && styles.completedText]}>
            {item.title}
          </Text>

          <Text style={styles.statusBadge}>
            {isCompleted ? '완료' : '진행중'}
          </Text>
        </View>

        <Text style={styles.todoMeta}>분류: {getTypeLabel(item.type)}</Text>

        {!!item.courseName && (
          <Text style={styles.todoMeta}>과목: {item.courseName}</Text>
        )}

        {!!item.dueDate && (
          <Text style={styles.todoMeta}>마감일: {item.dueDate}</Text>
        )}

        {!!item.description && (
          <Text style={styles.todoDescription}>{item.description}</Text>
        )}

        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleToggleComplete(item)}
          >
            <Text style={styles.actionButtonText}>
              {isCompleted ? '미완료' : '완료'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => openEditModal(item)}
          >
            <Text style={styles.actionButtonText}>수정</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.actionButtonText}>삭제</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>TodoList</Text>

        <Pressable style={styles.addButton} onPress={openCreateModal}>
          <Text style={styles.addButtonText}>+ 할 일 등록</Text>
        </Pressable>
      </View>

      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        renderItem={renderTodoItem}
        refreshing={loading}
        onRefresh={loadTodos}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>등록된 할 일이 없습니다.</Text>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            {editingTodo ? '할 일 수정' : '할 일 등록'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="할 일 제목"
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={styles.input}
            placeholder="과목명"
            value={courseName}
            onChangeText={setCourseName}
          />

          <TextInput
            style={styles.input}
            placeholder="마감일 예: 2026-05-20"
            value={dueDate}
            onChangeText={setDueDate}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="상세 내용"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View style={styles.typeRow}>
            {(['assignment', 'exam', 'review', 'etc'] as TodoType[]).map(
              (todoType) => (
                <Pressable
                  key={todoType}
                  style={[
                    styles.typeButton,
                    type === todoType && styles.typeButtonSelected,
                  ]}
                  onPress={() => setType(todoType)}
                >
                  <Text style={styles.typeButtonText}>
                    {getTypeLabel(todoType)}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          <View style={styles.modalActionRow}>
            <Pressable
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
            >
              <Text style={styles.modalButtonText}>취소</Text>
            </Pressable>

            <Pressable style={styles.modalButton} onPress={handleSave}>
              <Text style={styles.modalButtonText}>저장</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function getTypeLabel(type: TodoType) {
  switch (type) {
    case 'assignment':
      return '과제';
    case 'exam':
      return '시험';
    case 'review':
      return '복습';
    case 'etc':
      return '기타';
    default:
      return '기타';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop:
      Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 28 : 28,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  screenTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  todoCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  todoHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  todoTitle: {
    color: '#111827',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  completedText: {
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  statusBadge: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  todoMeta: {
    color: '#4b5563',
    marginTop: 6,
  },
  todoDescription: {
    color: '#111827',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6b7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop:
      Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 28 : 28,
  },
  modalTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  input: {
    borderColor: '#d1d5db',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  typeButton: {
    borderColor: '#d1d5db',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeButtonSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },
  typeButtonText: {
    color: '#111827',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    flex: 1,
    padding: 14,
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});