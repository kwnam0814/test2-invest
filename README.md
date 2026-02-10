# 사내 문서 Q&A AI 서비스

**프로젝트의 모든 의도, 아키텍처, 그리고 문제 해결 과정을 담은 총괄 문서입니다. 이 문서 하나로 프로젝트의 전체 맥락을 파악할 수 있습니다.**

---

## 1. 🎯 프로젝트 목표 (Project Goal)

이 프로젝트는 사내 문서를 업로드하고, 해당 문서의 내용에 대해 AI에게 자유롭게 질문하며 답변을 얻을 수 있는 **RAG(검색 증강 생성) 기반의 Q&A 비서**를 구축하는 것을 목표로 합니다. 사용자는 복잡한 매뉴얼이나 보고서를 직접 읽는 대신, AI와의 대화를 통해 필요한 정보를 빠르고 정확하게 얻을 수 있습니다.

## 2. 🏛️ 아키텍처 및 기술 스택 (Architecture & Tech Stack)

이 서비스는 순수 웹 기술(Vanilla Stack)과 Node.js를 기반으로 구축되어, 특정 프레임워크에 대한 종속성 없이 가볍고 빠른 성능을 자랑합니다.

-   **Frontend:** `Pure HTML, CSS, Vanilla JavaScript`
-   **Backend:** `Node.js & Express`
-   **AI Core: RAG & Vector Search:** `OpenAI API (Embeddings & GPT-4o-mini)`
    -   이 프로젝트는 **RAG (검색 증강 생성)** 아키텍처를 통해 **문서에 기반한 사실적인 답변**을 생성합니다.
    -   **작동 원리:**
        1.  **벡터화 (Vector Embedding):** 문서를 의미 있는 단위(Chunk)로 분할하고, OpenAI 임베딩 모델을 통해 각각을 의미가 압축된 숫자 배열, 즉 **벡터(Vector)**로 변환합니다.
        2.  **검색 (Retrieval):** 사용자의 질문 또한 벡터로 변환하여, 문서 조각 벡터들 중 의미적으로 가장 유사한 것들을 **벡터 검색(Vector Search)**으로 찾아냅니다.
        3.  **증강 및 생성 (Augmented Generation):** AI는 검색된 문서 조각들을 **'참고 자료'**로 삼아, 사용자의 질문에 대한 최종 답변을 생성합니다. 이를 통해 환각(Hallucination)을 방지하고 사실 기반의 정확한 답변을 제공합니다.
-   **File Handling:** `Multer` & `pdf-parse`
-   **Security:** `dotenv` & `.gitignore`

## 3. 💡 핵심 기능 및 구현 과정

### 주요 기능

-   **문서 업로드:** PDF, TXT 등 다양한 형식의 문서를 학습시킬 수 있습니다.
-   **[진화] 진정한 다국어 질의응답:** **AI가 사용자의 질문 언어를 자동으로 감지**하여, 영어 질문에는 영어로, 프랑스어 질문에는 프랑스어로 답변하는 등 **사용자의 언어로 실시간 소통**합니다.
-   **[진화] 대화형 다국어 요약:** "영어로 요약해줘", "résume en français" 와 같이, **AI와의 대화를 통해 문서 전체의 내용을 원하는 전 세계 언어**로 간결하게 요약 받습니다.
-   **동적 타이핑 효과:** AI의 답변이 실시간으로 타이핑되는 것처럼 표시되어, 생동감 있는 대화 경험을 제공합니다.
-   **다국어 파일명 지원:** 전 세계 모든 언어로 된 파일명을 깨짐 없이 완벽하게 처리합니다.

### 주요 문제 해결 과정 (Key Challenges & Solutions)

1.  **문제: 복합적인 명령 인식 불가 및 단일 언어 응답의 한계**
    -   **현상:** 초기 버전의 AI는 "요약"과 같은 단일 의도는 파악했지만, "영어로 요약해줘"처럼 **'의도'와 '조건'이 결합된 복합적인 명령을 이해하지 못했습니다.** 또한, 사용자가 어떤 언어로 질문하든 항상 '한국어'로만 답변하는 명백한 한계가 있었습니다.
    -   **해결: 'AI 기반 언어/의도 감지기' 탑재 및 답변 언어 동기화**
        -   `server.js`에 `detectInteraction` 함수를 새롭게 구현했습니다. 이 함수는 사용자의 질문을 OpenAI API에 먼저 보내, 질문에 담긴 **핵심 '의도'(질의, 요약 등)와 사용된 '언어'를 AI가 스스로 분석하여 JSON 형식으로 반환**하게 만듭니다.
        -   질의응답 시, 감지된 사용자의 언어에 맞춰 **AI에게 내리는 시스템 프롬프트(System Prompt)를 동적으로 변경**합니다. (예: `You MUST write your entire response in English.`)
        -   이를 통해, AI가 스스로 사용자의 언어와 의도를 파악하고 그에 맞춰 답변 언어까지 완벽하게 전환하는 **진정한 의미의 다국어 소통 능력**을 갖추게 되었습니다.
        ```javascript
        // server.js - AI 언어/의도 감지기 핵심 로직
        async function detectInteraction(question) {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [/* ... */],
                response_format: { type: "json_object" },
            });
            return JSON.parse(completion.choices[0].message.content);
        }
        ```

2.  **문제: 사용자 경험(UX) 고도화 - 정적인 답변의 한계**
    -   **해결:** `main.js`에 `typewriterEffect` 함수를 구현하여, AI의 답변이 실시간으로 타이핑되는 것처럼 한 글자씩 나타나도록 변경하고 사용자의 몰입감을 극대화했습니다.

3.  **문제: 비영어권 파일명 인코딩 깨짐 현상**
    -   **해결:** `multer`가 파일을 처리하기 전에, `latin1`으로 잘못 해석된 파일명을 올바른 `UTF-8`로 재해석하는 로직을 추가하여 문제를 해결했습니다.

## 4. 🚀 설치 및 실행 방법 (Setup & Run)

```bash
# 1. 저장소 복제
git clone https://github.com/kwnam0814/test2-invest.git
cd test2-invest

# 2. 의존성 설치
npm install

# 3. .env 파일 생성 및 API 키 설정
# OPENAI_API_KEY="Your_API_Key_Here"

# 4. 서버 실행
npm start
```
- 웹 브라우저에서 `http://localhost:3000` 주소로 접속합니다.

## 5. 📂 파일 구조 (File Structure)

```
/
├── public/                # 프론트엔드 (HTML/CSS/JS)
│   ├── index.html
│   ├── style.css
│   └── main.js
├── server.js              # 백엔드 서버 (Express, AI 로직)
├── package.json
├── .gitignore
└── README.md              # 프로젝트 총괄 문서
```
