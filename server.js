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

app.post('/api/train', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
    }

    try {
        // [수정됨] 한글 파일명 인코딩 문제 해결
        const originalnameInUtf8 = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        console.log(`학습 시작: ${originalnameInUtf8}`);

        let text = '';

        if (req.file.mimetype === 'application/pdf') {
            const options = { max: 0 };
            const data = await pdf(req.file.buffer, options);
            text = data.text;
            console.log(`PDF 파일에서 텍스트 추출 완료. 총 ${data.numpages} 페이지.`);
        } else {
            text = req.file.buffer.toString('utf8');
            console.log('일반 텍스트 파일 처리.');
        }

        if (!text) {
            return res.status(400).json({ message: '파일에서 텍스트를 추출할 수 없습니다.' });
        }

        const chunks = chunkText(text);
        console.log(`${chunks.length}개의 청크로 분할됨`);

        documentVectors = [];
        const batchSize = 100;

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batchChunks = chunks.slice(i, i + batchSize);
            console.log(`처리 중: ${i + batchChunks.length} / ${chunks.length} 청크...`);

            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: batchChunks,
            });

            const batchVectors = embeddingResponse.data.map((embedding, j) => ({
                content: batchChunks[j],
                vector: embedding.embedding,
            }));
            documentVectors.push(...batchVectors);
        }

        // [수정됨] 올바르게 인코딩된 파일명 사용
        learnedFilename = originalnameInUtf8;
        console.log(`학습 완료. 총 ${documentVectors.length}개의 벡터가 생성되었습니다.`);

        res.status(200).json({
            message: `'${originalnameInUtf8}' 학습 및 임베딩 완료!`
        });

    } catch (error) {
        console.error('학습 중 오류:', error);
        res.status(500).json({ message: '문서 학습 중 API 오류가 발생했습니다. 오류 로그를 확인하세요.' });
    }
});

app.post('/api/ask', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ message: '질문이 없습니다.' });
    }
    if (documentVectors.length === 0) {
        return res.json({ answer: "아직 학습된 문서가 없습니다. 먼저 문서를 학습시켜 주세요." });
    }

    try {
        const questionEmbedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: question,
        });
        const questionVector = questionEmbedding.data[0].embedding;

        const similarities = documentVectors.map(doc => ({
            content: doc.content,
            similarity: cosineSimilarity(questionVector, doc.vector),
        }));

        const topContexts = similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3)
            .map(ctx => ctx.content)
            .join('\n---\n');

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `당신은 \'${learnedFilename}\' 문서의 내용을 기반으로 질문에 답변하는 전문 AI 어시스턴트입니다. 제공된 컨텍스트를 최우선으로 참고하여, 질문에 대해 정확하고 친절하게 답변해주세요. 만약 컨텍스트에 답변의 근거가 없다면, \"문서의 내용만으로는 답변하기 어렵습니다.\"라고 솔직하게 말해주세요.`
                },
                {
                    role: "user",
                    content: `아래 컨텍스트를 바탕으로 다음 질문에 답변해주세요.\n\n[컨텍스트]:\n${topContexts}\n\n[질문]:\n${question}`
                }
            ],
            temperature: 0.5,
        });

        const answer = completion.choices[0].message.content;
        res.json({ answer });

    } catch (error) {
        console.error('답변 생성 중 오류:', error);
        res.status(500).json({ message: '답변 생성 중 OpenAI API 오류가 발생했습니다.' });
    }
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
