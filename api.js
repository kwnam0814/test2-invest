require('dotenv').config();
const express = require('express');
// path 모듈을 추가하여 파일 경로를 더 안전하게 처리합니다.
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// JSON 요청 본문을 파싱하기 위한 미들웨어
app.use(express.json());

// 프론트엔드 정적 파일 제공 (public 폴더)
// __dirname은 현재 실행 중인 파일(api.js)의 디렉토리 경로입니다.
app.use(express.static(path.join(__dirname, 'public')));

// API 엔드포인트: /api/ask
app.post('/api/ask', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: '질문이 없습니다.' });
    }

    try {
        // OpenAI API 호출
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: question },
            ],
        });

        const answer = completion.choices[0].message.content;
        res.json({ answer: answer });

    } catch (error) {
        console.error('OpenAI API 오류:', error);
        res.status(500).json({ error: 'OpenAI API와 통신하는 중 오류가 발생했습니다.' });
    }
});

// SPA (Single Page Application)를 위한 라우팅 처리
// 위에서 정의되지 않은 모든 GET 요청에 대해 index.html을 제공합니다.
// 이렇게 하면 새로고침 시에도 React/Vue/Angular 등의 클라이언트 사이드 라우터가 제대로 동작합니다.
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
