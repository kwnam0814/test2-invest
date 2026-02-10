# 클라우드 AI Q&A 서비스 (Cloudflare & Serverless)

**프로젝트의 모든 의도, 아키텍처, 그리고 문제 해결 과정을 담은 총괄 문서입니다. 이 문서 하나로 프로젝트의 전체 맥락을 파악할 수 있습니다.**

---

## 1. 🎯 프로젝트 목표 (Project Goal)

이 프로젝트는 사내 문서를 업로드하고, 해당 문서의 내용에 대해 AI에게 자유롭게 질문하며 답변을 얻을 수 있는 **RAG(검색 증강 생성) 기반의 Q&A 비서**를 구축하는 것을 목표로 합니다. 특히, 전 세계 어디서든 빠르고 안정적으로 접속할 수 있도록 **Cloudflare의 서버리스(Serverless) 인프라**에 배포하고 운영합니다.

## 2. 🏛️ 아키텍처 및 기술 스택 (Architecture & Tech Stack)

이 서비스는 특정 서버 없이 동작하는 서버리스 아키텍처로 구축되어, 극도의 확장성, 안정성, 그리고 비용 효율성을 자랑합니다.

-   **Frontend:** `Pure HTML, CSS, Vanilla JavaScript`
-   **Backend:** `Cloudflare Pages Functions (Serverless)`
    -   기존의 Node.js 서버(`server.js`)를 완전히 제거하고, 전 세계에 분산된 Cloudflare의 엣지 네트워크에서 직접 실행되는 Pages Functions를 통해 백엔드 로직을 구현했습니다.
-   **AI Core: RAG & Vector Search:** `OpenAI API (Embeddings & GPT-4o-mini)`
    -   **RAG (검색 증강 생성)** 아키텍처를 통해 **문서에 기반한 사실적인 답변**을 생성합니다.
    -   **작동 원리:**
        1.  **벡터화 (Vector Embedding):** 문서 텍스트를 의미 단위(Chunk)로 분할하고, OpenAI 임베딩 모델을 통해 각각을 의미가 압축된 **벡터(Vector)**로 변환합니다.
        2.  **검색 (Retrieval):** 사용자 질문 또한 벡터로 변환하여, 벡터들 중 의미적으로 가장 유사한 것들을 **벡터 검색(Vector Search)**으로 찾아냅니다.
        3.  **증강 및 생성 (Augmented Generation):** AI는 검색된 문서 조각들을 **'참고 자료'**로 삼아, 사용자의 질문에 대한 최종 답변을 생성합니다. 이를 통해 환각(Hallucination)을 방지하고 사실 기반의 정확한 답변을 제공합니다.
-   **AI Memory (Database):** `Cloudflare KV`
    -   서버리스 환경에서는 메모리가 유지되지 않는 문제를 해결하기 위해, Cloudflare의 Key-Value 스토리지인 **KV를 AI의 '외부 뇌(영구 기억 장치)'로 사용**합니다. 학습된 문서의 텍스트, 벡터 데이터, 파일명 등 AI의 모든 기억은 KV에 영구적으로 저장됩니다.

## 3. 💡 핵심 기능 및 구현 과정

### 주요 기능

-   **[진화] 진정한 다국어 질의응답:** **AI가 사용자의 질문 언어를 자동으로 감지**하여, 영어 질문에는 영어로, 프랑스어 질문에는 프랑스어로 답변하는 등 **사용자의 언어로 실시간 소통**합니다.
-   **[진화] 대화형 다국어 요약:** "영어로 요약해줘", "résume en français" 와 같이, **AI와의 대화를 통해 문서 전체의 내용을 원하는 전 세계 언어**로 간결하게 요약 받습니다.
-   **서버리스 아키텍처:** 특정 서버 없이 Cloudflare의 글로벌 네트워크에서 동작하여, 유지보수 비용 없이 무한한 확장성을 가집니다.

### 주요 문제 해결 과정 (Key Challenges & Solutions)

1.  **문제: 서버리스 환경에서의 데이터 영속성 부재**
    -   **현상:** 서버리스 함수는 실행될 때마다 새로운 환경에서 시작되므로, 이전 실행에서 학습시킨 문서 데이터를 기억할 수 없었습니다. 즉, AI가 '기억상실증'에 걸리는 문제가 발생했습니다.
    -   **해결: 외부 기억 장치(Cloudflare KV) 도입**
        -   Cloudflare의 Key-Value 스토리지인 **KV를 AI의 '영구 기억 장치'로 활용**했습니다.
        -   문서 학습(`train`)이 완료되면, 생성된 텍스트와 벡터 데이터를 모두 직렬화(Serialize)하여 KV에 저장합니다.
        -   사용자가 질문(`ask`)을 하면, KV에서 이 데이터들을 다시 불러와 AI의 기억을 복원한 후 답변을 생성하도록 아키텍처를 완전히 재설계했습니다.
        -   이를 통해 서버리스 환경의 한계를 극복하고, AI가 자신의 기억을 영구적으로 유지할 수 있게 되었습니다.

2.  **문제: 복합적인 명령 인식 불가 및 단일 언어 응답의 한계**
    -   **해결: 'AI 기반 언어/의도 감지기' 탑재**
        -   사용자의 질문을 OpenAI API에 먼저 보내, 질문에 담긴 **핵심 '의도'와 사용된 '언어'를 AI가 스스로 분석하여 JSON 형식으로 반환**하게 만들었습니다.
        -   이를 통해 AI가 "영어로 요약해줘"와 같은 복합적인 명령을 완벽하게 이해하고, 사용자의 언어로 직접 소통하는 진정한 다국어 소통 능력을 갖추게 되었습니다.

## 4. 🚀 Cloudflare 배포 방법 (Deployment)

이 프로젝트는 `wrangler` CLI를 통해 Cloudflare에 직접 배포합니다.

### 사전 준비 (Prerequisites)

1.  **Cloudflare 계정 및 `wrangler` 설치**가 필요합니다. (`npm install -g wrangler`)
2.  터미널에서 `wrangler login` 명령어로 Cloudflare 계정에 로그인합니다.

### 배포 절차

1.  **저장소 복제 및 의존성 설치**
    ```bash
    git clone https://github.com/kwnam0814/test2-invest.git
    cd test2-invest
    npm install
    ```

2.  **[중요] KV 네임스페이스 생성 (AI의 기억 장소 만들기)**
    -   AI의 기억을 저장할 KV 네임스페이스를 생성합니다. 아래 명령어에서 `DOC_KV`는 원하는 이름으로 변경할 수 있습니다.
    ```bash
    wrangler kv:namespace create "DOC_KV"
    ```
    -   **명령어 실행 후 출력되는 `id` 값을 복사해 두세요.**

3.  **`wrangler.toml` 파일 생성 및 설정**
    -   프로젝트 루트에 `wrangler.toml` 파일을 생성하고, 아래 내용을 붙여넣습니다.
    -   `YOUR_ACCOUNT_ID`는 Cloudflare 대시보드에서 확인, `YOUR_KV_ID`는 위 2번 단계에서 복사한 `id` 값을 붙여넣습니다.

    ```toml
    name = "vibe-qna-ai" # 원하는 프로젝트 이름
    main = "public/index.html" # 이 부분은 wrangler v3에서 사용되지 않을 수 있음
    compatibility_date = "2023-11-21"
    account_id = "YOUR_ACCOUNT_ID"

    [[kv_namespaces]]
    binding = "DOC_KV" # 코드(functions/api/[[path]].js)에서 사용할 이름. 반드시 "DOC_KV"로 유지!
    id = "YOUR_KV_ID"

    [vars]
    # OPENAI_API_KEY는 아래 4번 단계에서 설정합니다.
    ```

4.  **Cloudflare에 OpenAI API 키 등록 (보안)**
    -   보안을 위해 API 키는 코드가 아닌 Cloudflare에 직접 등록합니다.
    ```bash
    wrangler secret put OPENAI_API_KEY
    ```
    -   위 명령어를 실행하고 터미널에 자신의 OpenAI API 키를 입력합니다.

5.  **배포 실행**
    ```bash
    npm run deploy
    ```
    -   배포가 완료되면 출력되는 `.pages.dev` 주소로 접속하여 AI 서비스를 이용할 수 있습니다.

## 5. 📂 파일 구조 (File Structure)

```
/
├── functions/             # 서버리스 백엔드 로직
│   └── api/
│       └── [[path]].js    # API 라우팅 및 핸들러
├── public/                # 프론트엔드 (HTML/CSS/JS)
│   ├── index.html
│   ├── style.css
│   └── main.js
├── package.json           # 프로젝트 정보 및 의존성
├── wrangler.toml          # Cloudflare 배포 설정 파일
└── README.md              # 프로젝트 총괄 문서
```
