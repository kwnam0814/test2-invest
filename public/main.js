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
    
    // 새로 추가된 학습 관련 요소
    const trainingForm = document.getElementById('training-form');
    const documentFile = document.getElementById('document-file');
    const trainingStatus = document.getElementById('training-status');

    const API_ENDPOINT_ASK = '/api/ask';
    const API_ENDPOINT_TRAIN = '/api/train';

    // ==================================================
    //                 이벤트 리스너 설정
    // ==================================================

    // --- 문서 학습 폼 이벤트 리스너 ---
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

        try {
            const response = await fetch(API_ENDPOINT_TRAIN, {
                method: 'POST',
                body: formData, // FormData를 직접 body에 넣습니다.
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `서버 오류: ${response.status}`);
            }

            trainingStatus.textContent = result.message;
            trainingStatus.style.color = 'var(--success-color)';
            trainingForm.reset(); // 폼 리셋

        } catch (error) {
            console.error('학습 요청 오류:', error);
            trainingStatus.textContent = error.message || '파일 학습 중 오류가 발생했습니다.';
            trainingStatus.style.color = 'var(--error-color)';
        }
    });


    // --- 질문 제출 폼 이벤트 리스너 ---
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

        addBubble(question, 'question');
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
                throw new Error(`서버 오류: ${response.status}`);
            }

            const data = await response.json();
            addBubble(data.answer, 'answer');

        } catch (error) {
            console.error('API 요청 오류:', error);
            addBubble('죄송합니다. 답변 생성 중에 오류가 발생했습니다.', 'error');
        } finally {
            toggleLoading(false);
        }
    });

    // ==================================================
    //                 헬퍼(Helper) 함수
    // ==================================================

    function addBubble(text, type) {
        const bubble = document.createElement('div');
        bubble.classList.add('qa-bubble', type);
        bubble.textContent = text;
        qaLog.appendChild(bubble);
        scrollToBottom();
    }

    function toggleLoading(isLoading) {
        if (isLoading) {
            // 로딩 인디케이터를 qaLog의 자식으로 추가하여 정렬 문제를 해결
            qaLog.appendChild(loadingIndicator);
            loadingIndicator.style.display = 'flex';
        } else {
            loadingIndicator.style.display = 'none';
        }
        scrollToBottom();
    }

    function scrollToBottom() {
        mainContent.scrollTop = mainContent.scrollHeight;
    }
});
