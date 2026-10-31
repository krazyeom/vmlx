# M4 맥북에서 로컬 LLM 돌리려다 vMLX 소스코드 뜯어고친 이야기

> "GUI 앱이라면서 모델 다운로드는 터미널에서 하라니… 다운받은 이미지 모델은 왜 목록에 안 뜨는 건데?"  
> 쓰다 보니 답답해서 직접 Electron과 MLX 코드를 뜯어고치며 보낸 하루의 기록.

---

Apple Silicon 맥을 쓰면서 가장 큰 축복 중 하나는 바로 **통합 메모리(UMA)**다. CPU와 GPU가 램을 통째로 공유하니, 수십 기가바이트짜리 거대 언어 모델(LLM)이나 이미지 생성 모델을 로컬에서 꽤 쾌적하게 굴릴 수 있다. 

이 환경을 제대로 활용해보려고 찾은 게 바로 **vMLX(구 MLX Studio)**였다. Apple MLX 프레임워크와 mflux를 감싸서 챗봇 세션도 만들고 로컬 이미지 생성 서버까지 띄워주는 오픈소스 Electron 앱이다.

구조 자체는 참 매력적이었다. 그런데 막상 설치해서 이것저것 만져보다 보니, 개발자 입장에서 "어? 이건 좀 아닌데…" 싶은 완성도 부족과 버그들이 하나둘씩 눈에 밟히기 시작했다. 

그냥 참고 쓸까 하다가, 어차피 오픈소스인데 손수 고쳐서 쓰기로 마음먹었다. 오늘 하루 동안 vMLX를 내 입맛대로 개조한 작업기를 남겨본다.

---

## 1. "다운로드는 터미널에서 알아서 하세요?" 원클릭 다운로드로 개조하기

가장 먼저 당황했던 순간은 세션을 만들 때였다. 

목록에서 추천 모델을 골랐더니 친절하게 안내 문구가 떴다.
```text
모델을 다운로드하려면 터미널에서 실행하세요:
huggingface-cli download mlx-community/Llama-3.2-3B-Instruct-4bit --local-dir ~/.cache/huggingface/hub/...
```

데스크톱 GUI 앱을 표방하면서, 정작 모델을 받으려면 터미널을 열고 명령어를 복사해 붙여넣어야 한다니. 다운로드가 끝날 때까지 터미널 창을 멍하니 지켜보는 것도 썩 유쾌한 경험은 아니었다.

이건 무조건 앱 안에서 해결해야 했다.

### 어떻게 바꿨나?
앱 내부를 살펴보니 이미 Hugging Face 다운로드 워커와 IPC 이벤트 버스가 갖춰져 있었다. 모델 생성 폼(`CreateSession.tsx`)과 다운로드 탭의 라이프사이클이 연결되어 있지 않았을 뿐이다.

메인 프로세스의 다운로드 채널(`models:startDownload`)을 폼 버튼에 바로 물렸다. 그리고 진행률(`models:onDownloadProgress`) 이벤트를 구독해서 다운로드 상태 머신을 만들었다.

```tsx
// 버튼 클릭 한 번으로 백그라운드 다운로드 시작
const handleStartDownload = async (repoId: string) => {
  try {
    const res = await window.api.models.startDownload(repoId)
    setInlineDownload({
      jobId: res.jobId,
      repoId,
      status: 'downloading',
      progress: 0,
      speed: '',
      eta: ''
    })
  } catch (err) {
    alert(t('common.error'))
  }
}
```

이제 번거롭게 터미널을 띄울 필요가 없다. 버튼을 누르면 그 자리에서 다운로드가 시작되고, 실시간 프로그레스 바와 남은 시간, 속도가 표시된다. 다운로드가 끝나면 자동으로 세션 설정 단계로 넘어간다.

---

## 2. "이거 내 맥에서 돌아갈까?" 모델 적합도 사전 진단 엔진 탑재

로컬에서 오픈소스 모델을 만지다 보면 누구나 한 번쯤 겪는 악몽이 있다. 

기껏 수십 기가바이트짜리 모델을 한참 걸려 받아놨는데, 로드 버튼을 누르는 순간 메모리가 터지며 맥이 뻗어버리거나(OOM) 앱이 튕기는 일이다.

Apple Silicon 맥은 통합 메모리라 여유가 있는 편이지만, macOS 기본 정책상 GPU가 쓸 수 있는 램 한도는 전체 램의 약 75% 수준이다. 게다가 모델 파일 크기가 30GB라고 해서 램도 딱 30GB만 먹는 게 아니다. 추론할 때 생기는 KV 캐시와 컨텍스트 메모리까지 고려하면 훨씬 더 많은 여유 공간이 필요하다.

"다운로드 버튼을 누르기 전에, 내 맥에서 쾌적하게 돌아갈지 미리 알 수는 없을까?"

이 물음에서 출발해 **하드웨어 맞춤형 모델 적합도(Memory Fit) 진단 시스템**을 붙였다.

### 어떻게 진단하나?
메인 프로세스에서 현재 Mac의 칩셋(`chipFamily`, `chipTier`)과 전체 통합 메모리 용량(`totalRamGb`)을 실시간으로 읽어온다. 그리고 모델별 가중치 크기와 컨텍스트 버퍼, 혹은 사전 검증된 실 서빙 풋프린트(`KNOWN_MODEL_MEMORY_REQUIREMENTS`)를 대조해 4단계 뱃지와 친절한 안내를 띄우도록 설계했다.

- **✓ 추천 (쾌적)**: 기본 GPU 메모리 한도(~75%) 안에서 아주 부드럽게 돌아감
- **⚠ 주의 (겨우 들어감)**: 가용 메모리 경계에 아슬아슬하게 걸침. 컨텍스트 길이를 줄이거나 시스템 GPU 한도를 늘려야 함
- **✕ 실행 불가**: 현재 맥의 전체 메모리를 넘어서는 크기. 다운로드받아도 어차피 뻗으니 시간 낭비하지 말라고 빨간 뱃지로 차단
- **메모리 미확인**: 메타데이터가 부족한 경우

```typescript
// 내 Mac 스펙과 모델 요구량을 대조해 안전성을 판정하는 로직
export function evaluateModelFit(model: ScannedModel, specs: MacHardwareSpecs): ModelFitEvaluation {
  const needsGb = estimateModelNeedsGb(model)
  
  if (needsGb <= specs.gpuDefaultLimitGb) {
    return { status: 'runs_well', badgeColor: 'emerald', badgeLabel: `✓ 추천 (${needsGb} GB · 쾌적)` }
  } else if (needsGb <= specs.gpuMaxLimitGb) {
    return { status: 'tight', badgeColor: 'amber', badgeLabel: `⚠ 주의 (${needsGb} GB · 겨우 들어감)` }
  } else {
    return { status: 'too_big', badgeColor: 'rose', badgeLabel: `✕ 실행 불가 (${needsGb} GB 필요)` }
  }
}
```

여기에 더해, 다운로드 화면 상단에 내 맥 스펙(`Apple M4 Max · 128 GB Unified Memory`)을 바로 보여주는 배너를 올렸다. 

그리고 모델 피드 정렬 기준에 **'내 램에 가장 가득 찬 순(가용 범위 내 대형 모델 우선)'**과 **'쾌적 순'** 필터를 추가했다. 이제 내 맥이 가진 잠재력을 끝까지 쥐어짜고 싶을 때, 돌아가지도 않는 모델을 받느라 헛걸음할 일이 사라졌다.

---

## 3. 3.8GB를 받았는데 어디 갔지? mflux 이미지 모델 실종 사건

다운로드 기능과 적합도 체크를 손보고 나서, 가볍고 빠르다는 FLUX.2 Klein 4B 모델(`Audante/FLUX.2-klein-4B-mflux-q4`)을 다운로드 탭에서 받았다. 3.8GB를 다 받고 상태도 초록색 **"Downloaded"**로 바뀌었다.

기쁜 마음으로 이미지 생성 탭(`Image`)의 "Choose an image model" 화면을 열었다.

그런데 목록이 휑했다. 방금 받은 모델은 온데간데없고, 덩그러니 커스텀 폴더 경로 입력창과 '찾아보기' 버튼만 나를 반겼다.

"분명 방금 다운로드가 끝났는데, 숨겨진 `~/.cache/huggingface/hub` 폴더를 직접 찾아 경로를 복사해 넣으라고?"

### 원인 추적: 스캔 경로 누락과 UI의 부재
코드를 열어 원인을 쫓아갔다. 문제는 두 군데에서 터져 있었다.

1. **메인 프로세스의 스캔 경로 누락 (`models.ts`)**  
   텍스트 모델 스캔 경로에는 `~/.cache/huggingface/hub`가 잘 들어가 있었는데, 이미지 모델 스캔 경로(`BUILTIN_IMAGE_PATHS`)에는 `.mlxstudio/models/image` 같은 경로만 덩그러니 적혀 있었다. Hugging Face 캐시 디렉토리는 아예 스캔 대상조차 아니었던 것이다.

2. **렌더러의 UI 컴포넌트 부재 (`ImageModelPicker.tsx`)**  
   더 놀라운 건, 이미지 선택 화면 컴포넌트 자체에 로컬 다운로드 모델을 스캔해서 리스트로 렌더링해주는 UI 코드가 단 한 줄도 없었다. 사용자가 직접 경로를 치거나 폴더를 선택해야만 동작하는 반쪽짜리 구조였다.

### 해결 과정
먼저 `models.ts`에 허브 캐시 경로를 추가했다. 이때 텍스트 모델 스캔과 엉키지 않도록 디렉토리 필터링도 함께 다듬었다.

```typescript
const BUILTIN_IMAGE_PATHS = [
  join(homedir(), ".mlxstudio/models/image"),
  join(homedir(), ".mlxstudio/models/xcreates"),
  join(homedir(), ".cache/huggingface/hub"), // HF 캐시 허브 추가
];
```

그다음 `ImageModelPicker.tsx`에 다운로드된 모델 카드 목록 섹션을 새로 만들었다. 컴포넌트가 마운트될 때 `window.api.models.scan('image')`를 호출해 로컬 모델들을 불러오고, 카드를 클릭하면 경로와 양자화 설정이 자동으로 채워지도록 구현했다.

여기에 더해 `-mflux-q4` 같은 비표준 양자화 접미사가 붙은 디렉토리 이름도 정규식을 보강해 `FLUX.2-klein-4B`(`Flux2Klein`)로 깔끔하게 인식되도록 맞췄다.

앱을 다시 빌드하고 켜보니, 상단에 방금 다운받은 모델 카드가 단정하게 나타났다. 카드를 클릭하자마자 아키텍처 분석이 끝나며 곧바로 이미지 생성 준비가 완료됐다.

---

## 4. 사소하지만 참기 힘들었던 UI 줄바꿈 참사들

기능 버그를 잡고 나니 이번엔 레이아웃 디테일들이 거슬렸다.

- **디렉토리 버튼 밀림**: 사이드바 상단에서 디렉토리 아이콘과 텍스트의 너비가 좁아, 글자가 다음 줄로 툭 떨어져 모양새가 망가져 있었다. `flex-row`와 `whitespace-nowrap`을 주어 단정한 한 줄로 정렬했다.
- **채팅 기록 상단의 줄바꿈 엉킴**: "채팅 1개 • Shift를 누른 채 ×를 클릭하면 확인 생략" 안내 문구와 "모두 지우기" 버튼이 좁은 영역에 가로로 꾸역꾸역 들어가 글자가 찌그러지고 있었다. 둘을 상하 2단(`flex-col`)으로 시원하게 갈라놓았다.
- **세션 대시보드 설명문**: 중요한 퀵스타트 팁 문장이 어중간한 너비 제한(`max-w-xl`) 때문에 두 줄로 보기 싫게 꺾이던 것도 컨테이너 폭을 넓혀 깔끔하게 폈다.

화면이 한결 숨통이 트였다. 매일 마주하는 도구일수록 이런 작은 정렬과 여백이 주는 쾌적함이 크다.

---

## 5. 한국어 우선 배치와 11개 언어팩 정비

다국어 지원도 손봤다. 글로벌 오픈소스 앱이라 여러 언어를 지원하긴 하는데, 언어 선택 메뉴에서 한국어가 끄트머리에 처박혀 있었다. 내가 쓸 거니까 한국어(`ko`)를 당당하게 배열 맨 위로 끌어올렸다.

손을 댄 김에 언어팩도 대폭 보강했다. 프랑스어, 독일어, 러시아어, 포르투갈어, 이탈리아어, 베트남어까지 6개 언어를 새로 짰다. 

vMLX는 테스트 슈트에서 i18n 무결성을 매우 깐깐하게 검증한다. 키 하나라도 비거나 플레이스홀더(`{repo}`, `{error}` 등)가 누락되면 빌드가 바로 터진다. 스크립트를 짜서 11개 언어 파일 전체의 2,319개 키를 1:1로 정확하게 맞추고 테스트를 통과시켰다.

---

## 6. 빌드부터 설치까지 한 번에 끝내기

모든 수정을 마치고 실제 Mac 애플리케이션으로 패키징했다.

```bash
# 1. 프론트엔드/메인 번들링
cd panel && npx electron-vite build

# 2. 번들 파이썬 무결성 체크 및 macOS 앱 패키징
VMLX_ALLOW_MISSING_JANG_SOURCE_HASH=1 npx electron-builder --mac --dir -c.mac.identity=null

# 3. Ad-hoc 코드서명 갱신
codesign --force --deep --sign - release/mac-arm64/vMLX.app

# 4. /Applications 디렉토리에 동기화 설치
rsync -a --delete release/mac-arm64/vMLX.app/ /Applications/vMLX.app/
```

`/Applications/vMLX.app`에 깔끔하게 들어갔다. 앱을 실행해 모델을 내려받고 이미지를 뽑아보니 군더더기 없이 매끄럽게 돌아간다.

---

## 마치며

기성 소프트웨어가 내 마음에 100% 들기는 어렵다. 하지만 소스코드가 공개된 오픈소스라면 이야기가 다르다. 

불편한 점이 보일 때 투덜거리는 대신, 직접 에디터를 열어 코드를 뜯어보고 내 손으로 해결할 수 있다는 것. 이것이야말로 개발자로서 누릴 수 있는 가장 순수한 즐거움이 아닐까 싶다.

혹시 M시리즈 맥에서 로컬 AI 모델을 가볍게 돌리고 싶다면, 내 손길이 닿은 vMLX 커스텀 빌드를 한번 써보는 것도 나쁘지 않은 선택이 될 것이다.
