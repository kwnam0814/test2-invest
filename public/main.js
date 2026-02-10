document.addEventListener('DOMContentLoaded', () => {
    // ==================================================
    //                 요소 및 상수 선언
    // ==================================================
    const questionForm = document.getElementById('question-form');
    const questionInput = document.getElementById('question-input');
    const submitButton = document.getElementById('submit-button');
    const qaLog = document.getElementById('qa-log');
    const loadingIndicator = document.getElementById('loading-indicator');
    const mainContent = document.querySelector('main');
    
    const trainingForm = document.getElementById('training-form');
    const documentFile = document.getElementById('document-file');
    const trainingStatus = document.getElementById('training-status');

    const API_ENDPOINT_ASK = '/api/ask';
    const API_ENDPOINT_TRAIN = '/api/train';
    const TYPING_SPEED = 30; // 타이핑 속도 (ms)

    // ==================================================
    //                 이벤트 리스너 설정
    // ==================================================

    trainingForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const file = documentFile.files[0];
        if (!file) {
            trainingStatus.textContent = '학습할 파일을 선택해주세요.';
            trainingStatus.style.color = 'var(--error-color)';
            return;
        }

        const formData = new FormData();
        formData.append('document', file);

        trainingStatus.textContent = `\'${file.name}\' 파일 학습을 시작합니다...`;
        trainingStatus.style.color = 'var(--secondary-text)';
        qaLog.innerHTML = '';

        try {
            const response = await fetch(API_ENDPOINT_TRAIN, { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || `서버 오류: ${response.status}`);
            trainingStatus.textContent = result.message;
            trainingStatus.style.color = 'var(--success-color)';
            trainingForm.reset();
        } catch (error) {
            console.error('학습 요청 오류:', error);
            trainingStatus.textContent = error.message || '파일 학습 중 오류가 발생했습니다.';
            trainingStatus.style.color = 'var(--error-color)';
        }
    });

    questionInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submitButton.click();
        }
    });

    questionForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const question = questionInput.value.trim();
        if (!question) return;

        await addBubble(question, 'question');
        questionInput.value = '';
        questionInput.focus();
        toggleLoading(true);

        try {
            const response = await fetch(API_ENDPOINT_ASK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question }),
            });
            if (!response.ok) {
                 const errorResult = await response.json();
                 throw new Error(errorResult.message || `서버 오류: ${response.status}`);
            }
            const data = await response.json();
            await addBubble(data.answer, 'answer'); // 타이핑 효과가 끝날 때까지 기다림
        } catch (error) {
            console.error('API 요청 오류:', error);
            await addBubble(`죄송합니다. 답변 생성 중에 오류가 발생했습니다: ${error.message}`, 'error');
        } finally {
            toggleLoading(false);
        }
    });

    // ==================================================
    //                 헬퍼(Helper) 함수
    // ==================================================

    // 텍스트를 타이핑 효과로 출력하는 함수
    function typewriterEffect(element, text) {
        return new Promise((resolve) => {
            let i = 0;
            function typing() {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    scrollToBottom(); // 한 글자씩 스크롤
                    setTimeout(typing, TYPING_SPEED);
                } else {
                    resolve(); // 타이핑 완료
                }
            }
            typing();
        });
    }

    // 말풍선을 추가하고 타이핑 효과를 적용하는 비동기 함수
    async function addBubble(text, type) {
        const bubble = document.createElement('div');
        bubble.classList.add('qa-bubble', type);
        qaLog.appendChild(bubble);
        
        if (type === 'question' || type === 'error') {
            bubble.textContent = text;
        } else {
            await typewriterEffect(bubble, text);
        }
        
        scrollToBottom();
    }

    function toggleLoading(isLoading) {
        if (isLoading) {
            qaLog.appendChild(loadingIndicator);
            loadingIndicator.style.display = 'flex';
        } else {
            if (loadingIndicator.parentNode === qaLog) {
                 qaLog.removeChild(loadingIndicator);
            }
            loadingIndicator.style.display = 'none';
        }
        scrollToBottom();
    }

    function scrollToBottom() {
        mainContent.scrollTop = mainContent.scrollHeight;
    }
});
