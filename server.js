require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const OpenAI = require('openai');
const pdf = require('pdf-parse');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const port = 3000;

let documentVectors = [];
let learnedFilename = null;
let documentText = ''; 

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function chunkText(text, chunkSize = 1000, overlap = 100) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.substring(i, i + chunkSize));
        i += chunkSize - overlap;
    }
    return chunks;
}

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
}

// --- [업그레이드] AI 기반 언어 및 의도 감지기 ---
async function detectInteraction(question) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a language and intent detection specialist. Analyze the user's text. Respond with a JSON object with two keys: "language" (the language the user is communicating in, e.g., "English", "Korean", "French") and "intent" ("qa" for a general question, or "summarize" for a summarization request). If the user asks for a summary in a specific language, use that language. Otherwise, the response language is the same as the user's question language. Examples: 1. "이 문서 요약해줘" -> {"language": "Korean", "intent": "summarize"}. 2. "What is this about?" -> {"language": "English", "intent": "qa"}. 3. "résume ce document en français" -> {"language": "French", "intent": "summarize"}.`
                },
                {
                    role: "user",
                    content: question
                }
            ],
            response_format: { type: "json_object" },
        });
        const result = JSON.parse(completion.choices[0].message.content);
        console.log("AI 언어/의도 감지 결과:", result);
        if (result.language && result.intent) return result;
        return { language: 'Korean', intent: 'qa' }; // 실패 시 기본값
    } catch (error) {
        console.error("AI 언어/의도 감지 실패:", error);
        return { language: 'Korean', intent: 'qa' }; // 오류 발생 시 기본값
    }
}

// --- 지능형 요약 로직 (다국어 지원) ---
async function getSummary(language = 'Korean') {
    if (!documentText) throw new Error('요약할 문서가 없습니다.');
    console.log(`'${learnedFilename}' 문서 요약 요청 (언어: ${language})`);
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: `You are an expert summarizer. Provide a concise summary of the document. The summary MUST be in ${language}.` },
            { role: "user", content: `[DOCUMENT]:\n${documentText}` }
        ],
        temperature: 0.5,
    });
    return completion.choices[0].message.content;
}

// 문서 학습 API (변경 없음)
app.post('/api/train', upload.single('document'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
    try {
        const originalnameInUtf8 = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        learnedFilename = originalnameInUtf8;
        console.log(`학습 시작: ${originalnameInUtf8}`);
        
        documentText = (req.file.mimetype === 'application/pdf') 
            ? (await pdf(req.file.buffer, { max: 0 })).text 
            : req.file.buffer.toString('utf8');

        const chunks = chunkText(documentText);
        documentVectors = [];
        const batchSize = 100;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batchChunks = chunks.slice(i, i + batchSize);
            const embeddingResponse = await openai.embeddings.create({ model: "text-embedding-3-small", input: batchChunks });
            documentVectors.push(...embeddingResponse.data.map((e, j) => ({ content: batchChunks[j], vector: e.embedding })));
        }
        console.log(`학습 완료. 총 ${documentVectors.length}개의 벡터 생성.`);
        res.status(200).json({ message: `\'${originalnameInUtf8}\' 학습 및 임베딩 완료!` });
    } catch (error) {
        console.error('학습 중 오류:', error);
        res.status(500).json({ message: '문서 학습 중 오류가 발생했습니다.' });
    }
});


// --- [최종 진화] 진정한 다국어 통합 API ---
app.post('/api/ask', async (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ message: '질문이 없습니다.' });
    if (!documentText) return res.json({ answer: "아직 학습된 문서가 없습니다." });

    try {
        // 1. AI가 스스로 의도와 언어를 파악
        const { language, intent } = await detectInteraction(question);

        // 2. 파악된 의도에 따라 기능 분기
        if (intent === 'summarize') {
            const summary = await getSummary(language);
            return res.json({ answer: summary });
        }

        // 3. (기본값) 다국어 질의응답 처리
        const questionEmbedding = await openai.embeddings.create({ model: "text-embedding-3-small", input: question });
        const questionVector = questionEmbedding.data[0].embedding;

        const topContexts = documentVectors
            .map(doc => ({ ...doc, similarity: cosineSimilarity(questionVector, doc.vector) }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5)
            .map(ctx => ctx.content)
            .join('\n---\n');

        // 4. [핵심] AI의 답변 언어를 질문의 언어와 동기화
        const systemPrompt = `You are a world-class AI expert on the document '${learnedFilename}'. Your task is to provide a comprehensive and insightful answer based *only* on the provided context. If the answer is not in the context, say so. **You MUST write your entire response in ${language}.**`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `[Context]:\n${topContexts}\n\n[Question]:\n${question}` }
            ],
            temperature: 0.7,
        });

        res.json({ answer: completion.choices[0].message.content });

    } catch (error) {
        console.error('처리 중 오류:', error);
        res.status(500).json({ message: '요청 처리 중 오류가 발생했습니다.' });
    }
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
