import OpenAI from 'openai';
import pdf from 'pdf-parse';

// --- 유틸리티 함수 ---
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

// --- AI 핵심 로직 ---
async function handleTrain(request, env) {
    const formData = await request.formData();
    const file = formData.get('document');

    if (!file) {
        return new Response(JSON.stringify({ message: '파일이 업로드되지 않았습니다.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const originalname = file.name;
    console.log(`학습 시작: ${originalname}`);

    const buffer = await file.arrayBuffer();
    const data = await pdf(Buffer.from(buffer));
    const documentText = data.text;

    if (!documentText) {
        return new Response(JSON.stringify({ message: '파일에서 텍스트를 추출할 수 없습니다.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const chunks = chunkText(documentText);
    console.log(`${chunks.length}개의 청크로 분할됨`);

    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunks,
    });

    const documentVectors = embeddingResponse.data.map((embedding, j) => ({
        content: chunks[j],
        vector: embedding.embedding,
    }));

    // AI의 기억을 외부 뇌(KV)에 저장
    await env.DOC_KV.put('learnedFilename', originalname);
    await env.DOC_KV.put('documentText', documentText);
    await env.DOC_KV.put('documentVectors', JSON.stringify(documentVectors));

    console.log(`학습 완료. 총 ${documentVectors.length}개의 벡터가 KV에 저장되었습니다.`);
    return new Response(JSON.stringify({ message: `'${originalname}' 학습 및 임베딩 완료!` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleAsk(request, env) {
    const { question } = await request.json();
    if (!question) {
        return new Response(JSON.stringify({ message: '질문이 없습니다.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    // 외부 뇌(KV)에서 AI의 기억을 불러오기
    const learnedFilename = await env.DOC_KV.get('learnedFilename');
    const documentText = await env.DOC_KV.get('documentText');
    const documentVectorsStr = await env.DOC_KV.get('documentVectors');

    if (!documentText) {
        return new Response(JSON.stringify({ answer: "아직 학습된 문서가 없습니다." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    // 1. AI가 스스로 의도와 언어를 파악
    const interactionDetection = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
             {
                role: "system",
                content: `You are a language and intent detection specialist. Analyze the user's text. Respond with a JSON object with two keys: "language" (e.g., "English", "Korean") and "intent" ("qa" or "summarize"). Examples: 1. "이 문서 요약해줘" -> {"language": "Korean", "intent": "summarize"}. 2. "What is this about?" -> {"language": "English", "intent": "qa"}. 3. "résume en français" -> {"language": "French", "intent": "summarize"}.`
             },
             { role: "user", content: question }
        ],
        response_format: { type: "json_object" },
    });
    const { language, intent } = JSON.parse(interactionDetection.choices[0].message.content);
    console.log(`AI 언어/의도 감지 결과: { language: '${language}', intent: '${intent}' }`);


    // 2. 파악된 의도에 따라 기능 분기
    if (intent === 'summarize') {
        const summaryCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `You are a professional summarizer. Provide a concise summary of the document. The summary MUST be in ${language}.` },
                { role: "user", content: `[DOCUMENT]:\n${documentText}` }
            ],
        });
        const summary = summaryCompletion.choices[0].message.content;
        return new Response(JSON.stringify({ answer: summary }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. (기본값) 다국어 질의응답 처리
    const documentVectors = JSON.parse(documentVectorsStr);
    const questionEmbedding = await openai.embeddings.create({ model: "text-embedding-3-small", input: question });
    const questionVector = questionEmbedding.data[0].embedding;

    const topContexts = documentVectors
        .map(doc => ({ ...doc, similarity: cosineSimilarity(questionVector, doc.vector) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
        .map(ctx => ctx.content)
        .join('\n---\n');
    
    const systemPrompt = `You are a world-class AI expert on the document '${learnedFilename}'. Answer based *only* on the provided context. If the answer is not in the context, say so. **You MUST write your entire response in ${language}.**`;

    const qaCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `[Context]:\n${topContexts}\n\n[Question]:\n${question}` }
        ],
    });
    const answer = qaCompletion.choices[0].message.content;
    return new Response(JSON.stringify({ answer }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}


// --- 라우터 핸들러 ---
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    try {
        // CORS preflight 요청 처리
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            });
        }

        // 요청 경로에 따라 핸들러 분기
        if (url.pathname === '/api/train') {
            return await handleTrain(request, env);
        }
        if (url.pathname === '/api/ask') {
            return await handleAsk(request, env);
        }

        return new Response('Not Found', { status: 404 });

    } catch (error) {
        console.error('Cloudflare Function Error:', error);
        return new Response(JSON.stringify({ message: '서버 처리 중 오류가 발생했습니다.', error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}
