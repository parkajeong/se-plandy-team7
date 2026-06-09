import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function NoteDetailScreen() {
  const { noteTitle, noteContent, updatedAt } = useLocalSearchParams<{
    noteTitle: string;
    noteContent: string;
    updatedAt: string;
  }>();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{noteTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updatedAt}>마지막 수정: {updatedAt}</Text>
        <Text style={styles.content}>{noteContent}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  scrollView: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 60 },
  updatedAt: { fontSize: 12, color: COLORS.subText, marginBottom: 16 },
  content: { fontSize: 16, color: COLORS.text, lineHeight: 26 },
});
