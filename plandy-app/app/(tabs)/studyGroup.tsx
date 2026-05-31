import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from "react-native";

import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { getAppUser, subscribeAppUserChange } from "../../src/appSession";

const firebase = require("../../src/firebase");
const db = firebase.db;
const auth = firebase.auth;

type StudyGroup = {
  id: string;
  name: string;
  host_id: string;
  members: string[];
  schedules: any[];
  available_times: Record<string, any>;
  invite_code: string;
  created_at: Date;
};

export default function StudyGroupScreen() {
  const [userId, setUserId] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [groups, setGroups] = useState<StudyGroup[]>([]);

  const getAppUserIdOrNull = useCallback(() => {
    const appUser = getAppUser();

    if (appUser?.uid) {
      return String(appUser.uid);
    }

    if (appUser?.id) {
      return String(appUser.id);
    }

    if (appUser?.user_id) {
      return String(appUser.user_id);
    }

    if (appUser?.userId) {
      return String(appUser.userId);
    }

    return null;
  }, []);

  const syncUserId = useCallback(() => {
    const firebaseUser = auth.currentUser;

    if (firebaseUser) {
      setUserId(firebaseUser.uid);
      return;
    }

    const appUserId = getAppUserIdOrNull();

    if (appUserId) {
      setUserId(appUserId);
      return;
    }

    setUserId(null);
    setGroups([]);
  }, [getAppUserIdOrNull]);

  useEffect(() => {
    const unsubscribeFirebase = onAuthStateChanged(auth, () => {
      syncUserId();
    });

    const unsubscribeAppUser = subscribeAppUserChange(() => {
      syncUserId();
    });

    syncUserId();

    return () => {
      unsubscribeFirebase();
      unsubscribeAppUser();
    };
  }, [syncUserId]);

  const generateInviteCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";

    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }

    return code;
  };

  const handleCreateGroup = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 스터디 그룹을 생성할 수 있습니다.");
      return;
    }

    const trimmedGroupName = groupName.trim();

    if (!trimmedGroupName) {
      Alert.alert("오류", "스터디 그룹 이름을 입력해주세요.");
      return;
    }

    try {
      const newInviteCode = generateInviteCode();

      const groupData = {
        name: trimmedGroupName,
        host_id: userId,
        members: [userId],
        schedules: [],
        available_times: {},
        invite_code: newInviteCode,
        created_at: new Date(),
      };

      const docRef = await addDoc(collection(db, "study_groups"), groupData);

      const createdGroup: StudyGroup = {
        id: docRef.id,
        ...groupData,
      };

      setGroups((prevGroups) => [createdGroup, ...prevGroups]);
      setGroupName("");

      Alert.alert(
        "성공",
        `스터디 그룹이 생성되었습니다.\n초대코드: ${newInviteCode}`
      );
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 그룹 생성 실패");
    }
  };

  const handleJoinGroup = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 스터디 그룹에 참여할 수 있습니다.");
      return;
    }

    const trimmedInviteCode = inviteCode.trim().toUpperCase();

    if (!trimmedInviteCode) {
      Alert.alert("오류", "초대코드를 입력해주세요.");
      return;
    }

    try {
      const q = query(
        collection(db, "study_groups"),
        where("invite_code", "==", trimmedInviteCode)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert("오류", "해당 초대코드의 스터디 그룹을 찾을 수 없습니다.");
        return;
      }

      const targetDoc = querySnapshot.docs[0];
      const targetGroupData = targetDoc.data();

      const members = Array.isArray(targetGroupData.members)
        ? targetGroupData.members
        : [];

      if (members.includes(userId)) {
        Alert.alert("안내", "이미 참여 중인 스터디 그룹입니다.");
        setInviteCode("");
        return;
      }

      const groupRef = doc(db, "study_groups", targetDoc.id);

      await updateDoc(groupRef, {
        members: arrayUnion(userId),
      });

      const joinedGroup: StudyGroup = {
        id: targetDoc.id,
        name: targetGroupData.name,
        host_id: targetGroupData.host_id,
        members: [...members, userId],
        schedules: targetGroupData.schedules || [],
        available_times: targetGroupData.available_times || {},
        invite_code: targetGroupData.invite_code,
        created_at: targetGroupData.created_at,
      };

      setGroups((prevGroups) => {
        const alreadyExists = prevGroups.some(
          (group) => group.id === joinedGroup.id
        );

        if (alreadyExists) {
          return prevGroups;
        }

        return [joinedGroup, ...prevGroups];
      });

      setInviteCode("");

      Alert.alert("성공", "스터디 그룹에 참여했습니다.");
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 그룹 참여 실패");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>스터디 그룹</Text>

      {!userId && (
        <Text style={styles.loginNotice}>
          로그인 후 스터디 그룹을 생성하고 참여할 수 있습니다.
        </Text>
      )}

      <Text style={styles.sectionTitle}>스터디 그룹 생성</Text>

      <TextInput
        style={styles.input}
        placeholder="스터디 그룹 이름"
        value={groupName}
        onChangeText={setGroupName}
      />

      <TouchableOpacity style={styles.button} onPress={handleCreateGroup}>
        <Text style={styles.buttonText}>그룹 생성하기</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>초대코드로 그룹 참여</Text>

      <TextInput
        style={styles.input}
        placeholder="초대코드 입력"
        value={inviteCode}
        onChangeText={(text) => setInviteCode(text.toUpperCase())}
        autoCapitalize="characters"
      />

      <TouchableOpacity style={styles.outlineButton} onPress={handleJoinGroup}>
        <Text style={styles.outlineButtonText}>그룹 참여하기</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>내 스터디 그룹</Text>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>참여 중인 스터디 그룹이 없습니다.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupInfo}>초대코드: {item.invite_code}</Text>
            <Text style={styles.groupInfo}>
              참여 인원: {item.members.length}명
            </Text>

            {item.host_id === userId && (
              <Text style={styles.hostText}>내가 만든 그룹</Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },

  loginNotice: {
    color: "#e53e3e",
    marginBottom: 15,
    fontSize: 15,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
  },

  button: {
    backgroundColor: "#4A90E2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },

  outlineButton: {
    borderWidth: 1,
    borderColor: "#4A90E2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  outlineButtonText: {
    color: "#4A90E2",
    fontSize: 17,
    fontWeight: "bold",
  },

  emptyText: {
    color: "#777",
    marginTop: 10,
    fontSize: 15,
  },

  card: {
    backgroundColor: "#F2F2F2",
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
  },

  groupName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },

  groupInfo: {
    fontSize: 15,
    color: "#555",
    marginTop: 2,
  },

  hostText: {
    marginTop: 8,
    color: "#4A90E2",
    fontWeight: "bold",
  },
});