const express = require('express');
const path = require('path');
const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 3000; // ← Railway will provide PORT

// Hardcoded API key - replace with your actual key
const HARDCODED_API_KEY = "sk-"; // Replace this with your actual OpenAI API key

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' })); // Increased limit for large CSV files

// Initialize default OpenAI client with hardcoded key
const defaultOpenAI = new OpenAI({
    apiKey: HARDCODED_API_KEY,
});

app.post('/evaluate', async (req, res) => {
    const { problemStatement, userCode, llmSettings } = req.body;

    try {
        let apiKey = HARDCODED_API_KEY; // Use hardcoded key as default
        let model = "gpt-4-turbo";
        let baseURL = null;

        // Use settings from frontend if provided (this allows override if needed)
        if (llmSettings) {
            if (llmSettings.apiKey && llmSettings.apiKey.trim()) {
                apiKey = llmSettings.apiKey; // Allow frontend to override if key is provided
            }
            if (llmSettings.model) {
                model = llmSettings.model;
            }
            if (llmSettings.customEndpoint) {
                baseURL = llmSettings.customEndpoint;
            }
        }

        if (!apiKey || apiKey === "sk-your-openai-api-key-here") {
            return res.status(400).json({
                error: 'Please set your actual OpenAI API key in the server.js file (HARDCODED_API_KEY variable).'
            });
        }

        // Create OpenAI client with current settings
        const openai = new OpenAI({
            apiKey: apiKey,
            ...(baseURL && { baseURL: baseURL })
        });

        // Determine the prompt based on provider
        let systemPrompt;
        if (llmSettings && llmSettings.provider === 'claude') {
            // Adjust prompt for Claude if needed
            systemPrompt = `あなたはC言語の優秀で細かいプログラマーです．　以下の問題文に対して，回答文が挿入位置に入るコードとして相応しいかどうか,とても細かくチェックの上，結果を以下の通りに返してください．相応しい場合は：PERFECT!　相応しくない場合は：INCOMPLETE!，Compile：OK|ERROR，ERROR場合はエラーメッセージも必ず返してください．そして，正解までの最低距離Qualityを5（近い）~1（遠い）スケールで返してください．後は，参考のために，プログラムが未完成な理由についてもお知らせください\n 結果はJsonフォーマットに沿って，Result・Compile・Reason・Error_msg・Qualityの5つフィールドを挿入の上返してください．Reasonは必ず日本語で返してください．は手順としては，まずは，問題文内のソースコードの挿入位置の直後に回答文を追加することで，問題文と回答文を正しく組み合わせること！．次に，出来上がった新しいソースコードを評価の対象にしてください．絶対に間違いを見落としてはいけないので，丁寧に手順通りに対応してください．　修正コードは不要です！`;
        } else {
            // Default prompt for OpenAI
            systemPrompt = `あなたはC言語の優秀で細かいプログラマーです．　以下の問題文に対して，回答文が挿入位置に入るコードとして相応しいかどうか,とても細かくチェックの上，結果を以下の通りに返してください．相応しい場合は：PERFECT!　相応しくない場合は：INCOMPLETE!，Compile：OK|ERROR，ERROR場合はエラーメッセージも必ず返してください．そして，正解までの最低距離Qualityを5（近い）~1（遠い）スケールで返してください．後は，参考のために，プログラムが未完成な理由についてもお知らせください\n 結果はJsonフォーマットに沿って，Result・Compile・Reason・Error_msg・Qualityの5つフィールドを挿入の上返してください．Reasonは必ず日本語で返してください．は手順としては，まずは，問題文内のソースコードの挿入位置の直後に回答文を追加することで，問題文と回答文を正しく組み合わせること！．次に，出来上がった新しいソースコードを評価の対象にしてください．絶対に間違いを見落としてはいけないので，丁寧に手順通りに対応してください．　修正コードは不要です！`;
        }

        const response = await openai.chat.completions.create({
            model: model,
            response_format: { type: "json_object" },
            messages: [
                {
                    "role": "system",
                    "content": systemPrompt
                },
                {
                    "role": "user",
                    "content": `問題文：${problemStatement}\n回答文：\n${userCode}`
                },
            ],
            temperature: 0,
            max_tokens: 512,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });

        console.log("Response: ", response.choices[0].message.content);
        console.log("Used Model: ", model);
        console.log("Provider: ", llmSettings?.provider || 'openai');

        res.json({ output: response.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error);

        // Provide more specific error messages
        if (error.message.includes('API key')) {
            res.status(401).json({ error: 'Invalid API key. Please check the hardcoded API key in server.js.' });
        } else if (error.message.includes('model')) {
            res.status(400).json({ error: 'Invalid model selection. Please check your model settings.' });
        } else if (error.message.includes('quota')) {
            res.status(429).json({ error: 'API quota exceeded. Please check your API usage limits.' });
        } else {
            res.status(500).json({ error: 'An error occurred while evaluating the code: ' + error.message });
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        hasApiKey: HARDCODED_API_KEY !== "sk-your-openai-api-key-here",
        environment: process.env.NODE_ENV || 'development'
    });
});

// Root endpoint for testing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🔑 Hardcoded API Key: ${HARDCODED_API_KEY !== "sk-your-openai-api-key-here" ? 'Configured ✅' : 'Please set your API key ❌'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});



// git add .
// git commit -m "Add OpenAI API key or whatever"
// git push
