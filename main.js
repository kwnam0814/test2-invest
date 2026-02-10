// ==================================================
//                변수 및 DOM 요소 선택
// ==================================================

const qaLog = document.getElementById('qa-log');
const questionForm = document.getElementById('question-form');
const questionInput = document.getElementById('question-input');
const loadingIndicator = document.getElementById('loading-indicator');

// FastAPI 서버의 엔드포인트 URL
// 실제 배포 시에는 환경에 맞게 변경해야 할 수 있습니다.
const API_ENDPOINT = '/api/ask';

// ==================================================
//                 이벤트 리스너 설정
// ==================================================

/**
 * 질문 제출 폼의 submit 이벤트를 처리합니다.
 * @param {Event} event - 폼 제출 이벤트 객체
 */
questionForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // 폼의 기본 제출 동작(페이지 새로고침)을 막습니다.

    const question = questionInput.value.trim(); // 입력된 질문의 양쪽 공백을 제거합니다.

    // 질문이 없으면 아무것도 하지 않습니다.
    if (!question) {
        return;
    }

    // 사용자의 질문을 화면에 표시합니다.
    addBubble(question, 'question');

    // 입력창을 비우고, 다음 질문을 위해 포커스를 유지합니다.
    questionInput.value = '';
    questionInput.focus();

    // 로딩 인디케이터를 표시합니다.
    toggleLoading(true);

    try {
        // FastAPI 서버에 질문을 전송하고 답변을 받습니다.
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 요청 본문에 질문을 JSON 형식으로 담아 보냅니다.
            body: JSON.stringify({ question: question }),
        });

        // 서버 응답이 성공적이지 않은 경우 에러를 처리합니다.
        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
        }

        // 응답 본문을 JSON으로 파싱합니다.
        const data = await response.json();
        const answer = data.answer; // 백엔드에서 'answer' 키로 답변을 보내준다고 가정

        // 받은 답변을 화면에 표시합니다.
        addBubble(answer, 'answer');

    } catch (error) {
        // 네트워크 오류 또는 서버 응답 오류 발생 시 에러 메시지를 화면에 표시합니다.
        console.error('API 요청 오류:', error);
        addBubble('죄송합니다. 답변을 생성하는 중에 오류가 발생했습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.', 'error');
    } finally {
        // 성공/실패 여부와 관계없이 로딩 인디케이터를 숨깁니다.
        toggleLoading(false);
    }
});

// ==================================================
//                 헬퍼(Helper) 함수
// ==================================================

/**
 * Q&A 로그에 새로운 말풍선을 추가합니다.
 * @param {string} text - 말풍선에 표시될 텍스트
 * @param {'question' | 'answer' | 'error'} type - 말풍선의 종류
 */
function addBubble(text, type) {
    const bubble = document.createElement('div');
    bubble.classList.add('qa-bubble', type);
    bubble.textContent = text;

    // Q&A 로그의 맨 위에 새 말풍선을 추가합니다.
    // `flex-direction: column-reverse` 때문에 위쪽에 추가해야 맨 아래에 보입니다.
    qaLog.prepend(bubble);
}

/**
 * 로딩 인디케이터의 표시 여부를 제어합니다.
 * @param {boolean} isLoading - 로딩 중인지 여부
 */
function toggleLoading(isLoading) {
    loadingIndicator.style.display = isLoading ? 'flex' : 'none';
}
