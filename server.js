const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 8080;

// CORS 설정
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// 1. 우회 요청을 처리하는 내부 API 경로
app.get('/bypass', (req, res, next) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('우회할 URL이 주어지지 않았습니다.');

    createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        followRedirects: true,
        pathRewrite: { '^/bypass': '' },
    })(req, res, next);
});

// 2. 렌더 사이트 메인에 접속했을 때 뜨는 '우회 검색창 화면' HTML
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>나만의 비밀 우회 프록시</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #121212;
                    color: #ffffff;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    width: 90%;
                    max-width: 500px;
                }
                h1 { margin-bottom: 25px; font-size: 28px; color: #bb86fc; }
                input[type="text"] {
                    width: 100%;
                    padding: 15px;
                    border: 2px solid #333;
                    border-radius: 8px;
                    background-color: #1e1e1e;
                    color: white;
                    font-size: 16px;
                    box-sizing: border-box;
                    margin-bottom: 15px;
                    outline: none;
                }
                input[type="text"]:focus { border-color: #bb86fc; }
                button {
                    width: 100%;
                    padding: 15px;
                    border: none;
                    border-radius: 8px;
                    background-color: #bb86fc;
                    color: #121212;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: 0.2s;
                }
                button:hover { background-color: #9965db; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>나만의 비밀 우회 검색창</h1>
                <input type="text" id="targetUrl" placeholder="우회할 주소를 입력하세요 (https:// 필수)">
                <button onclick="goToBypass()">우회 접속하기</button>
            </div>

            <script>
                function goToBypass() {
                    const userInput = document.getElementById('targetUrl').value.trim();
                    if (!userInput) {
                        alert('주소를 입력해 주세요!');
                        return;
                    }
                    if (!userInput.startsWith('http://') && !userInput.startsWith('https://')) {
                        alert('반드시 주소 앞에 https:// 나 http:// 를 붙여야 우회가 작동합니다!');
                        return;
                    }
                    // 현재 내 사이트 주소 뒤에 /bypass?url=입력값 구조로 자동 전환합니다.
                    window.location.href = window.location.origin + '/bypass?url=' + encodeURIComponent(userInput);
                }
                // 엔터키 쳤을 때도 작동하게 만들기
                document.getElementById('targetUrl').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') goToBypass();
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
