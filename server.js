const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [보안 설정 값]
var CORRECT_PASSWORD = ["mw1357911?", "zxcvasdfqwer1234"]; 

const failedAttempts = {}; 
const bannedIPs = new Set(); 

function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

// 1. [핵심 수정] 외계어로 인코딩된 주소를 받아서 우회 처리하는 라우트
app.get('/bypass', (req, res, next) => {
    const encodedUrl = req.query.url;
    const ip = getClientIP(req);

    if (bannedIPs.has(ip)) {
        return res.status(403).send('<h1>[접근 차단] 비밀번호 5회 오류로 인해 이 사이트에 영구적으로 접속할 수 없습니다.</h1>');
    }

    if (!encodedUrl) return res.status(400).send('우회할 URL이 없습니다.');

    try {
        // 암호화된 외계어 주소를 원래 주소(https://...)로 복원(디코딩)합니다.
        const targetUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
        
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            return res.status(400).send('올바른 URL 구조가 아닙니다.');
        }

        createProxyMiddleware({
            target: targetUrl,
            changeOrigin: true,
            followRedirects: true,
            pathRewrite: (path, req) => {
                return ''; // 타겟 서버로 갈 때 경로 초기화
            },
        })(req, res, next);

    } catch (e) {
        return res.status(500).send('주소 해석 중 오류가 발생했습니다.');
    }
});

// 2. 메인 화면 및 검색창 (프론트엔드 내장)
app.get('/', (req, res) => {
    const ip = getClientIP(req);
    if (bannedIPs.has(ip)) {
        return res.status(403).send('<h1>[접근 차단] 비밀번호 5회 오류로 인해 이 사이트에 영구적으로 접속할 수 없습니다.</h1>');
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>보안 구역 - 나만의 프록시</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #121212; color: #ffffff;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    height: 100vh; margin: 0;
                }
                .container {
                    text-align: center; width: 90%; max-width: 500px;
                    background: #1e1e1e; padding: 40px 30px; border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                }
                h1 { margin-bottom: 10px; font-size: 26px; color: #bb86fc; }
                p { color: #aaa; font-size: 14px; margin-bottom: 25px; }
                input {
                    width: 100%; padding: 15px; border: 2px solid #333; border-radius: 8px;
                    background-color: #2a2a2a; color: white; font-size: 16px;
                    box-sizing: border-box; margin-bottom: 15px; outline: none;
                }
                input:focus { border-color: #bb86fc; }
                button {
                    width: 100%; padding: 15px; border: none; border-radius: 8px;
                    background-color: #bb86fc; color: #121212; font-size: 16px;
                    font-weight: bold; cursor: pointer; transition: 0.2s;
                }
                button:hover { background-color: #9965db; }
                .error-msg { color: #ff6b6b; margin-top: 15px; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container" id="box"></div>

            <script>
                if (localStorage.getItem('isBanned') === 'true') {
                    document.body.innerHTML = '<h1>[접근 차단] 비밀번호 5회 오류로 인해 이 기기에서는 영구적으로 접속할 수 없습니다.</h1>';
                } else if (sessionStorage.getItem('myProxyAuth') === 'true') {
                    showSearchBox();
                } else {
                    showLoginBox();
                }

                function showLoginBox(errorText = '') {
                    document.getElementById('box').innerHTML = \`
                        <h1>보안 관리자 인증</h1>
                        <p>비밀번호를 입력하세요. (5회 실패 시 영구 차단)</p>
                        <input type="password" id="pwInput" placeholder="Password" autofocus>
                        <button onclick="checkPassword()">인증하기</button>
                        <div class="error-msg">\${errorText}</div>
                    \`;
                    document.getElementById('pwInput').addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') checkPassword();
                    });
                }

                function showSearchBox() {
                    document.getElementById('box').innerHTML = \`
                        <h1>비밀 우회 검색창</h1>
                        <p>접속할 주소를 입력하세요.</p>
                        <input type="text" id="targetUrl" placeholder="https://example.com" autofocus>
                        <button onclick="goToBypass()">우회 접속하기</button>
                    \`;
                    document.getElementById('targetUrl').addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') goToBypass();
                    });
                }

                async function checkPassword() {
                    const pw = document.getElementById('pwInput').value;
                    if (!pw) return;

                    const res = await fetch('/auth-check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: pw })
                    });
                    const data = await res.json();

                    if (data.success) {
                        sessionStorage.setItem('myProxyAuth', 'true');
                        showSearchBox();
                    } else {
                        if (data.banned) {
                            localStorage.setItem('isBanned', 'true');
                            window.location.reload();
                        } else {
                            showLoginBox(\`비밀번호가 틀렸습니다. (현재 \${data.attempts}/5회 실패)\`);
                        }
                    }
                }

                // ⭐ 주소를 외계어(Base64)로 변환해서 와이파이 방화벽을 뚫는 함수입니다.
                function goToBypass() {
                    const userInput = document.getElementById('targetUrl').value.trim();
                    if (!userInput) return alert('주소를 입력해 주세요!');
                    if (!userInput.startsWith('http://') && !userInput.startsWith('https://')) {
                        return alert('주소 앞에 https:// 를 꼭 붙여주세요!');
                    }
                    
                    // 주소를 안전하게 인코딩(외계어화) 처리합니다
                    const base64Url = btoa(encodeURIComponent(userInput).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                        return String.fromCharCode('0x' + p1);
                    }));

                    window.location.href = window.location.origin + '/bypass?url=' + base64Url;
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/auth-check', (req, res) => {
    const { password } = req.body;
    const ip = getClientIP(req);

    if (bannedIPs.has(ip)) {
        return res.json({ success: false, banned: true });
    }

    if (CORRECT_PASSWORD.includes(password)) {
        failedAttempts[ip] = 0;
        return res.json({ success: true });
    } else {
        failedAttempts[ip] = (failedAttempts[ip] || 0) + 1;
        if (failedAttempts[ip] >= 5) {
            bannedIPs.add(ip);
            return res.json({ success: false, banned: true, attempts: failedAttempts[ip] });
        }
        return res.json({ success: false, banned: false, attempts: failedAttempts[ip] });
    }
});

app.listen(PORT, () => {
    console.log(`Bypass Pro Server running on port ${PORT}`);
});
