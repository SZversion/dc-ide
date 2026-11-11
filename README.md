# workspace (IDE처럼 보이는 디시인사이드 클라이언트)

실제 `gall.dcinside.com` PC 사이트를 IntelliJ 같은 개발 도구 창 안에 띄우는 데스크톱 앱(Electron)입니다.
진짜 사이트를 그대로 쓰기 때문에 로그인, 글쓰기, 사진·영상 올리기, 댓글, 추천이 평소처럼 됩니다.
레딧 r/pathofexile도 같은 모양으로 읽을 수 있습니다.

## 1. 준비물

- **Windows PC**
- **Node.js** (18 이상, LTS 권장) — https://nodejs.org 에서 "LTS"를 내려받아 기본값으로 설치합니다.
  설치 확인: 명령 프롬프트에서 `node -v`를 쳐서 버전이 나오면 됩니다.
- **이 저장소 파일**
  - git이 있으면: `git clone https://github.com/SZversion/dc-ide.git`
  - git이 없으면: GitHub 저장소 페이지에서 **Code › Download ZIP**으로 받아 압축을 풉니다.
- 레딧을 보려면 **레딧 계정** (로그인해야 열립니다)

## 2. 실행

**`실행.bat`을 더블클릭**하면 됩니다.
처음 한 번은 필요한 파일(Electron)을 자동으로 설치하느라 1~2분 걸리고, 그다음부터는 바로 켜집니다.

명령어로 하고 싶다면 저장소 폴더에서:

```
npm install   # 처음 한 번
npm start     # 실행
npm test      # (개발용) 주소 규칙 테스트
```

## 3. 처음 5분 따라하기

1. **디시 로그인** — 왼쪽 프로젝트 트리 맨 아래 **External Libraries › Auth: session-config**를 클릭합니다.
   "GitLab 계정 로그인" 창이 뜨면 **사용자 = 디시 아이디, 토큰 = 비밀번호**를 넣고 로그인합니다.
2. **갤러리 추가** — **Shift를 두 번** 누르거나(또는 Ctrl+N) 상단 돋보기를 눌러 갤러리 이름을 검색합니다.
   - Enter = 열기, Ctrl+Enter = 새 탭에서 열기, **Alt+Enter = 프로젝트 트리에 추가**
   - 갤러리 목록을 보고 있을 때 프로젝트 창 위쪽 **+** 버튼을 눌러도 지금 갤러리가 트리에 추가됩니다.
   - 추가된 갤러리는 `com.workspace.modules` 아래에 `○○Repository.java`로 보입니다.
     펼치면 `findAll()` = 전체글, `findRecommended()` = 개념글, `save()` = 글쓰기입니다.
3. **글 읽기** — 목록에서 제목을 클릭합니다. 사진·영상은 `<<<<<<< HEAD:image_1.png` 한 줄로 접혀 있고, 그 줄을 누르면 펼쳐집니다.
4. **레딧 로그인(처음 한 번)** — **External Libraries › Auth: rd-session-config**를 클릭해 레딧 계정으로 로그인합니다.
   아이디/비밀번호 또는 구글·애플 로그인을 쓸 수 있습니다(구글·애플은 작은 팝업 창이 뜹니다).
5. **레딧 보기** — `com.workspace.modules › RdPathofexileRepository`를 클릭합니다.

## 4. 화면 대응표

| IDE 화면 | 실제 디시 |
|---|---|
| 에디터 탭 (`ProgrammingRepository.java`, `…Entity1234.java`, `…Command.java`) | 갤러리 목록 / 글 / 글쓰기 화면 |
| 프로젝트 트리 › `com.workspace.modules` | 직접 추가한 갤러리 (`findAll()` = 목록, `findRecommended()` = 개념글, `save()` = 글쓰기) |
| `com.workspace.cache` | 최근 방문한 갤러리 |
| 북마크 (왼쪽 ★) | 저장한 글 |
| 주소창 ("Search Everywhere") | 주소, 갤러리 id(예: `programming`), 또는 검색어 |
| 알림 (왼쪽 🔔, 아래 패널, 말풍선) | 내 글·댓글에 달린 디시 댓글/답글 알림 |

실제 갤러리 이름은 마우스를 올렸을 때 툴팁으로만 보입니다.

### 글 목록 = Git Log
IntelliJ의 Git › Log 창처럼 보입니다: 커밋 그래프, 제목 = 커밋 메시지, 댓글 수 = `(#N)`, 사진/영상 글 = `assets`/`media` 라벨,
작성자, `Today 14:39` 형식 날짜, 글 번호는 7자리 가짜 커밋 해시(마우스를 올리면 진짜 번호).
조회수·추천 칸, IP, 닉콘, 공지/광고/설문 줄, 오른쪽 위젯은 숨깁니다(공지는 **Pinned** 탭에서 보입니다).
탭: All commits = 전체글, Starred = 개념글, Pinned = 공지, Commit… = 글쓰기.
창을 좁혀도 제목은 한글 약 20자까지 보이고, 작성자·날짜·해시 칸이 먼저 줄어듭니다.

### 글 화면 = 커밋 상세 + 코드 리뷰
- 머리: `commit <해시>  origin/<갤러리>`, 제목, `Author:` / `Date:`, `+183`(조회) · `★ 0`(추천) · `12 comments`.
- 본문은 `CHANGELOG.md` 패널 안에 들어 있습니다.
- 추천 / 비추천 → **✓ Approve** / **✗ Request changes** (같은 버튼, 같은 숫자).
- 댓글 → 리뷰 스레드, 답글은 들여쓰기. 입력칸 "Leave a review comment…",
  버튼: Comment / Comment & approve / Emoji(디시콘) / Snippets(글자콘).
- 프로필 사진(아바타)은 어디에도 표시하지 않습니다.
- IP, 닉콘, 실베추/펌/공유/스크랩/신고 줄과 광고는 숨깁니다. 이름이 바뀐 버튼에 마우스를 올리면 원래 이름이 보입니다.

### 로그인 = "GitLab 계정 로그인" 창
프로젝트 트리 **External Libraries › Auth: session-config** (또는 오른쪽 계정 상자)에서 엽니다.
- 사용자 = 디시 식별 코드(아이디), 토큰 = 비밀번호
- 사용자 이름 기억 = 식별 코드 저장, 생성... = 비밀번호 찾기, 취소/✕ = 원래 페이지로 돌아가기
실제 로그인 입력칸과 버튼을 그대로 쓰므로 사이트에서와 똑같이 로그인됩니다.

### 계정 상자 & 갤로그
- 오른쪽 로그인 상자 → "GitLab · gitlab.workspace.dev" 패널.
  갤로그 = Profile, 즐겨찾기 = Favorites, 운영 = Admin, 스크랩 = Stash, 알림 = Notifications, 로그아웃 = Log out.
- 갤로그 → 프로필/활동 화면: `@아이디 · gitlab.workspace.dev`,
  메뉴 홈/게시물/댓글/스크랩/방명록 = Overview/Commits/Review comments/Stash/Discussions.
  상단 링크 줄, 방문자 수, 달력, 프로필 사진은 숨깁니다.

### 레딧 r/pathofexile (RdPathofexileRepository)
레딧 r/pathofexile을 `old.reddit.com`으로 똑같이 꾸며서 읽기 전용으로 보여줍니다(레딧 로그인 필요).
- 프로젝트 트리 › `com.workspace.modules` › **RdPathofexileRepository**
  - `findAll()` = 최신순(New), `findActive()` = 지금 반응 좋은 순(Hot), `findRecommended()` = 이번 주 추천순(Top)
  - 목록 탭: All commits / Active / Starred. 고정글은 숨깁니다.
  - 탭 이름: `RdPathofexileRepository.java` / `…QueryDsl.java` / `…Entity<글ID>.java`. 실제 이름은 툴팁으로만 보입니다.
- 목록 = Git Log, 글 = 커밋 + 리뷰 댓글. 광고, 사이드바, 배너, 썸네일, 투표 화살표, 댓글/투표/저장/신고 버튼은 처음부터 숨깁니다.
- 사진·영상은 아래 "사진·영상" 설정을 따릅니다(Fold면 `<<<<<<< HEAD:` 줄, 로딩 중에도 안 보임).
- 로그인: **External Libraries › Auth: rd-session-config**가 "GitLab 계정 로그인" 창으로 열립니다.
  캡차·2단계 인증이 나오거나 로그인 버튼을 누르고 5초쯤 지나도 그대로면 레딧 원래 로그인 화면으로 바뀝니다(거기서 로그인하면 됩니다).
- **Shift+T** (입력칸 밖에서): 제목·본문·댓글을 한국어로 번역하고, 다시 누르면 원문으로 돌아옵니다.
  구글 번역의 비공식 주소를 쓰므로 글 내용이 구글로 전송되고, 구글이 막으면 동작하지 않을 수 있습니다.

### 외부 링크
앱 안에서는 디시, `old.reddit.com`, 레딧·구글·애플 로그인 화면만 열립니다. 다른 `www.reddit.com` 링크는 `old.reddit.com`으로 바꿔 엽니다.
그 밖의 외부 링크는 눌러도 아무 일이 없습니다(주소창이나 트리에서 열려고 하면 "Blocked" 말풍선이 뜹니다).
외부 링크는 주소를 복사해서 다른 브라우저로 여세요.

## 5. 알림
디시 PC 페이지는 약 60초마다 알림을 확인해 팝업을 띄웁니다. 앱은 그 팝업을 숨기고 IDE 말풍선 + 알림 목록으로 다시 보여줍니다
(설정에서 켜면 "Build completed" 윈도우 알림도 뜹니다).
조건: **디시에 로그인되어 있을 것**, 탭이 하나 이상 열려 있을 것, 디시 알림 설정이 켜져 있을 것.
로그인하지 않고 쓴 글·댓글에는 알림이 오지 않습니다.

## 6. 단축키
- **Shift 두 번** 또는 **Ctrl+N** (또는 상단 돋보기): 갤러리 검색.
  Enter 열기, Ctrl+Enter 새 탭, Alt+Enter 프로젝트 트리에 추가. 마지막 줄 = 전체 글 검색.
- **Ctrl+Shift+F12** (어디서나) 또는 **Esc 두 번**: 보스 모드 → 가짜 `OrderService.java` 화면, 소리 끔, 말풍선 숨김
- Ctrl+T / Ctrl+W / Ctrl+Tab: 새 탭 / 탭 닫기 / 다음 탭
- Ctrl+L: 주소창 · Alt+←/→: 뒤로/앞으로 · F5: 새로고침 · Alt+1: 프로젝트 창 열고 닫기
- **Shift+T** (레딧 화면, 입력칸 밖): 한국어 번역 켜기/끄기

## 7. 설정 (왼쪽 아래 ⚙)
- 사진·영상 (Images & videos), 셋 중 하나:
  - **Dim until hover**: 흐리게 보이다가 마우스를 올리면 선명하게
  - **Fold** (기본): 본문의 사진/GIF/영상(유튜브 포함)과 디시콘이 `<<<<<<< HEAD:image_1.png (click to resolve)` 한 줄로 접힙니다.
    그 줄을 누르면 사이트 그대로 펼쳐지고, 사진을 누르면(유튜브는 줄을 다시 누르면) 다시 접힙니다. 나머지 이미지는 흐리게 보입니다.
    사진별 댓글 버튼(댓글 열기 / 이미지 댓글 ON)은 숨기지만 이미지 댓글 자체는 보입니다.
  - **Show as is**: 원래대로
- 창에서 포커스가 벗어나면 코드 화면으로 바꾸기
- 알림을 윈도우 알림으로도 보내기
- 페이지 소리 끄기 (기본 켜짐)

## 8. 알려진 제약
- **디시 로그인은 앱을 껐다 켜면 풀립니다.** 다시 Auth: session-config에서 로그인하세요(레딧 로그인은 유지됩니다).
- 레딧은 로그인해야 열립니다. 로그아웃 상태면 로그인 창이 뜹니다.
- Shift+T 번역은 글자 조각 단위라 링크·굵은 글씨가 섞인 문장은 어색하게 번역될 수 있습니다.
- 디시·레딧이 화면 구조를 바꾸면 위장이 일부 깨질 수 있습니다. 그때는 `skin/` 폴더의 CSS를 고치면 됩니다.

## 파일
- `실행.bat` – 더블클릭 실행 (처음엔 자동 설치)
- `main.js` – 창, 웹뷰 보안, UA, 보스 키, 번역 요청
- `renderer/` – IDE 화면 (탭, 트리, 알림, 보스 모드)
- `webview-preload.js` – 디시·레딧 페이지 안에서 실행: 스킨 주입, 위장, 사진 접기, 알림·단축키 전달
- `skin/dc-skin.css` – 디시 페이지용 다크 스킨 (사이트 구조가 바뀌면 여기를 수정)
- `skin/reddit-skin.css` – old.reddit.com 페이지용 스킨
- `url-rules.js` – 어떤 주소를 열고, 바꾸고, 막을지 (`npm test`로 검사)

로그인 쿠키와 설정은 `%APPDATA%\workspace-ide`에 저장됩니다.
