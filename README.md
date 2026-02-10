# 사내 문서 Q&A AI 서비스

**프로젝트의 모든 의도, 아키텍처, 그리고 문제 해결 과정을 담은 총괄 문서입니다. 이 문서 하나로 프로젝트의 전체 맥락을 파악할 수 있습니다.**

---

## 1. 🎯 프로젝트 목표 (Project Goal)

이 프로젝트는 사내 문서를 업로드하고, 해당 문서의 내용에 대해 AI에게 자유롭게 질문하며 답변을 얻을 수 있는 **RAG(검색 증강 생성) 기반의 Q&A 비서**를 구축하는 것을 목표로 합니다. 사용자는 복잡한 매뉴얼이나 보고서를 직접 읽는 대신, AI와의 대화를 통해 필요한 정보를 빠르고 정확하게 얻을 수 있습니다.

## 2. 🏛️ 아키텍처 및 기술 스택 (Architecture & Tech Stack)

이 서비스는 순수 웹 기술(Vanilla Stack)과 Node.js를 기반으로 구축되어, 특정 프레임워크에 대한 종속성 없이 가볍고 빠른 성능을 자랑합니다.

-   **Frontend:** `Pure HTML, CSS, Vanilla JavaScript`
    -   별도의 프레임워크 없이 웹 표준 기술만으로 사용자 인터페이스를 구축하여 경량성과 유지보수성을 극대화했습니다.
-   **Backend:** `Node.js & Express`
    -   파일 업로드, AI 연동 등 비동기 I/O 처리에 강점을 가진 Node.js와 Express 프레임워크를 사용하여 백엔드 서버를 구현했습니다.
-   **AI Core: RAG & Vector Search:** `OpenAI API (Embeddings & GPT-4)`
    -   이 프로젝트는 단순히 AI에 질문을 던지는 것을 넘어, **RAG (Retrieval-Augmented Generation, 검색 증강 생성)** 아키텍처를 통해 **문서에 기반한 사실적인 답변**을 생성합니다.
    -   **작동 원리:**
        1.  **벡터화 (Vector Embedding):** 사용자가 문서를 업로드하면, 내부 텍스트를 의미 있는 단위(Chunk)로 분할합니다. 그리고 OpenAI의 임베딩 모델을 사용해 각 텍스트 조각을 '의미가 압축된 숫자들의 배열', 즉 **벡터(Vector)**로 변환합니다.
        2.  **검색 (Retrieval):** 사용자가 질문을 입력하면, 이 질문 또한 같은 방식으로 벡터로 변환됩니다. 시스템은 이 '질문 벡터'와 가장 가까운 의미를 가진(유사도가 높은) '문서 조각 벡터'들을 찾아냅니다. 이것이 바로 **벡터 검색(Vector Search)**입니다.
        3.  **증강 및 생성 (Augmented Generation):** AI는 검색된 문서 조각들(가장 관련성 높은 정보)을 **'참고 자료'**로 삼아, 사용자의 질문과 함께 최종적으로 답변을 생성합니다. 이를 통해 AI가 환각(Hallucination)에 빠져 사실이 아닌 내용을 지어내는 것을 방지하고, 오직 제공된 문서의 내용에만 근거하여 정확한 답변을 하도록 유도합니다.
-   **File Handling:** `Multer` & `pdf-parse`
    -   `multer`를 통해 안정적인 파일 업로드 기능을 구현하고, `pdf-parse`로 PDF 문서의 텍스트를 추출합니다.
-   **Security:** `dotenv` & `.gitignore`
    -   API 키와 같은 민감 정보는 `.env` 파일을 통해 안전하게 관리하며, `.gitignore`를 통해 Git 저장소에 노출되지 않도록 원천 차단합니다.

## 3. 💡 핵심 기능 및 구현 과정

### 주요 기능
-   **문서 업로드:** 사용자는 로컬 컴퓨터에서 PDF 파일을 선택하여 서버에 업로드할 수 있습니다.
-   **AI 기반 Q&A:** 업로드된 문서의 내용을 기반으로, 사용자는 AI와 자유롭게 대화하며 질문에 대한 답변을 얻습니다.
-   **다국어 파일명 지원:** 한글, 일본어, 프랑스어 등 전 세계 모든 언어로 된 파일명을 깨짐 없이 완벽하게 처리합니다.

### 주요 문제 해결 과정 (Key Challenges & Solutions)

1.  **문제: 비영어권 파일명 인코딩 깨짐 현상**
    -   **현상:** 브라우저에서 '졸업논문.pdf'와 같이 한글로 된 파일을 업로드하면, 서버(multer)에서는 `ë¨ê±´ì..` 와 같이 깨진 글자로 인식되는 문제가 발생했습니다.
    -   **원인:** 브라우저는 파일명을 국제 표준인 `UTF-8`로 인코딩하여 전송하지만, 서버 미들웨어는 이를 구형 `latin1` 방식으로 잘못 해석하여 발생한 문제입니다.
    -   **해결:** Express 서버에서 `multer`가 파일을 처리하기 직전에, `latin1`으로 잘못 해석된 파일명을 다시 원본 바이트(Buffer)로 되돌린 후, 올바른 `UTF-8`로 재해석하는 로직을 추가하여 문제를 해결했습니다. 이 방식은 한글뿐만 아니라 모든 비영어권 언어에 동일하게 적용됩니다.
    '''javascript
    // server.js
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    '''

2.  **문제: 민감 정보(API 키)의 보안 관리**
    -   **현상:** OpenAI API 키가 소스 코드에 하드코딩될 경우, Git 저장소에 그대로 노출되어 심각한 보안 사고로 이어질 수 있습니다.
    -   **해결:** `dotenv` 라이브러리를 도입하여, API 키를 `.env`라는 별도의 환경 변수 파일에 격리시켰습니다. 그리고 모든 OS, 프레임워크, 언어에서 발생할 수 있는 잠재적 보안 위협 파일을 총망라한 `.gitignore` 파일을 작성하여 `.env` 파일이 Git 추적에서 원천적으로 제외되도록 조치했습니다.

## 4. 🚀 설치 및 실행 방법 (Setup & Run)

1.  **저장소 복제 (Clone)**
    '''bash
    git clone https://github.com/kwnam0814/test2-invest.git
    cd test2-invest
    '''

2.  **의존성 설치 (Install Dependencies)**
    '''bash
    npm install
    '''

3.  **환경 변수 설정 (Environment Variables)**
    -   프로젝트 루트에 `.env` 파일을 생성합니다.
    -   아래 내용을 복사하여 파일에 붙여넣고, 자신의 OpenAI API 키를 입력합니다.
    '''
    # .env
    OPENAI_API_KEY="sk-..."
    '''

4.  **서버 실행 (Run Server)**
    '''bash
    node server.js
    '''

5.  **서비스 접속 (Access Service)**
    -   웹 브라우저를 열고 `http://localhost:3000` 주소로 접속합니다.

## 5. 📂 파일 구조 (File Structure)

'''
/
├── public/                # 프론트엔드 (HTML/CSS/JS)
│   ├── index.html         # 메인 페이지
│   ├── style.css          # 스타일시트
│   └── main.js            # 클라이언트 로직
├── server.js              # 백엔드 서버 (Express)
├── api.js                 # OpenAI API 연동 로직
├── package.json           # 프로젝트 정보 및 의존성
├── .gitignore             # Git 추적 제외 목록 (보안)
└── README.md              # 프로젝트 총괄 문서
'''
