# se-plandy-team7

## 협업 가이드

### 1. 커밋 메시지 형식

커밋 메시지는 아래 형식을 따른다.

```text
타입: 작업 내용
```

예시:

```text
feat: 로그인 기능 구현
fix: 퀴즈 저장 오류 수정
docs: README 수정
```

### 2. 커밋 타입

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 작성 또는 수정
- `style`: 코드 포맷 또는 UI 스타일 수정
- `refactor`: 코드 구조 개선
- `test`: 테스트 코드 작성 또는 수정
- `chore`: 설정, 패키지, 기타 작업

### 3. 커밋 규칙

- 커밋 메시지는 한글로 작성한다.
- 하나의 커밋에는 하나의 작업만 포함한다.
- 작업 내용을 짧고 명확하게 작성한다.
- 실행되지 않는 코드는 커밋하지 않는다.
- `.env`, 비밀번호, API Key 등 민감한 정보는 커밋하지 않는다.
- 커밋 전 변경 파일을 확인한다.

```bash
git status
```

### 4. 브랜치 전략

#### 브랜치 구조

```text
main
develop
feature/*
fix/*
docs/*
```

#### 브랜치 설명

- `main`: 최종 제출용 안정 버전
- `develop`: 개발 기능을 통합하는 브랜치
- `feature/*`: 새로운 기능 개발
- `fix/*`: 버그 수정
- `docs/*`: 문서 작업

### 5. 브랜치 규칙

- `main` 브랜치에는 직접 커밋하지 않는다.
- 모든 기능 개발은 `develop` 브랜치에서 새 브랜치를 만들어 진행한다.
- 작업 완료 후 Pull Request를 생성해 `develop` 브랜치로 병합한다.
- 기능 통합 후 정상 실행되면 `develop` 브랜치를 `main` 브랜치로 병합한다.
- Pull Request는 최소 1명 이상 확인 후 병합한다.

### 6. 브랜치 이름 예시

```text
feature/login
feature/quiz

fix/login-error
fix/quiz-save-error

docs/readme
docs/final-report
```

### 7. 작업 흐름

#### 1. develop 최신화

```bash
git checkout develop
git pull origin develop
```

#### 2. 작업 브랜치 생성

```bash
git checkout -b feature/login
```

#### 3. 커밋

```bash
git add .
git commit -m "feat: 로그인 기능 구현"
```

#### 4. 원격 브랜치에 push

```bash
git push origin feature/login
```

#### 5. Pull Request 생성

```text
feature/login → develop
```

### 8. Pull Request 규칙

- PR 제목은 작업 내용을 간단히 작성한다.
- PR은 `develop` 브랜치로 보낸다.
- 병합 전 실행 여부를 확인한다.

예시:

```text
[FEAT] 로그인 기능 구현
[FIX] 퀴즈 저장 오류 수정
[DOCS] README 수정
```

### 9. 협업 시 주의사항

- 작업 시작 전 항상 `develop` 최신 코드를 받는다.
- 같은 파일을 여러 명이 동시에 수정하지 않도록 작업 범위를 나눈다.
- 큰 기능은 작은 단위로 나누어 커밋한다.
- 병합 후 사용하지 않는 브랜치는 삭제한다.
- 최종 제출 전에는 `main` 브랜치가 정상 실행되는지 확인한다.
