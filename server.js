const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 8080;

// Body-parser 및 쿠키 처리를 위한 미들웨어 설정 (Express 내장 기능 사용)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [보안 설정 값] - 요청하신 비밀번호 2개를 안전한 배열 구조로 등록했습니다.
var CORRECT_PASSWORD = ["mw1357911?", "zxcvasdfqwer1234"]; 

// 서버 메모리에 틀린 횟수와 차단 목록 임시 저장
const failedAttempts = {}; // { ip: 횟수 }
const bannedIPs = new Set(); // 차단된 IP 목록

// 사용자의 실제 IP를 가져오는 함수 (Render/Cloudflare 환경 대응)
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

// 1. 우회 요청 처리 API (비밀번호를 통과해서 검색창에 주소를 쳤을 때만 작동)
app.get('/bypass', (req, res, next) => {
    const targetUrl = req.query.url;
    const ip = getClientIP(req);

    // IP가 차단되어 있다면 원천 거부
    if (bannedIPs.has(ip)) {
        return res.status(403).send('<h1>[접근 차단] 비밀번호 5회 오류로 인해 이 사이트에 영구적으로 접속할 수 없습니다.</h1>');
    }

    if (!targetUrl) return res.status(400).send('우회할 URL이 주어지지 않았습니다.');

    createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        followRedirects: true,
        pathRewrite: { '^/bypass': '' },
    })(req, res, next);
});

// 2. 메인 페이지 (비밀번호 입력창 화면 또는 로그인 성공 시 검색창 화면)
app.get('/', (req, res) => {
    const ip = getClientIP(req);

    // 이미 IP가 차단된 유저인 경우
    if (bannedIPs.has(ip)) {
        return res.status(403).send('<h1>[접근 차단] 비밀번호 5회 오류로 인해 이 사이트에 영구적으로 접속할 수 없습니다.</h1>');
    }

    // HTML 화면 렌더링
    res.send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>보안 구역</title>
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
                    background: #1e1e1e;
                    padding: 40px 30px;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                }
                h1 { margin-bottom: 10px; font-size: 26px; color: #bb86fc; }
                p { color: #aaa; font-size: 14px; margin-bottom: 25px; }
                input {
                    width: 100%;
                    padding: 15px;
                    border: 2px solid #333;
                    border-radius: 8px;
                    background-color: #2a2a2a;
                    color: white;
                    font-size: 16px;
                    box-sizing: border-box;
                    margin-bottom: 15px;
                    outline: none;
                }
                input:focus { border-color: #bb86fc; }
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
                .error-msg { color: #ff6b6b; margin-top: 15px; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container" id="box">
                <!-- 자바스크립트가 로그인 여부(세션스토리지)를 판단하여 화면을 동적으로 그려줍니다 -->
            </div>

            <script>
                // 기기 자체에 영구 차단(BANNED) 표식이 심어져 있는지 확인
                if (localStorage.getItem('isBanned') === 'true') {
                    document.body.innerHTML = '<h1>[접근 차단] 비밀번호 5회 오류로 인해 이 기기에서는 영구적으로 접속할 수 없습니다.</h1>';
                } else if (sessionStorage.getItem('myProxyAuth') === 'true') {
                    // [로그인 성공 상태] 우회 검색창 보여주기
                    showSearchBox();
                } else {
                    // [로그인 전 상태] 비밀번호 입력창 보여주기
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
                        <h1>Private Address Jammer</h1>
                        <p>접속할 주소를 입력하세요.</p>
                        <input type="text" id="targetUrl" placeholder="https://example.com" autofocus>
                        <button onclick="goToBypass()">우회 접속하기</button>
                    \`;
                    document.getElementById('targetUrl').addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') goToBypass();
                    });
                }

                // 비밀번호 체크 로직 (서버와 통신)
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
                        // 로그인 성공 시 세션에 기록하고 검색창 전환
                        sessionStorage.setItem('myProxyAuth', 'true');
                        showSearchBox();
                    } else {
                        if (data.banned) {
                            // 5번 틀려서 영구 차단된 경우 기기에 주홍글씨 낙인 장착
                            localStorage.setItem('isBanned', 'true');
                            window.location.reload();
                        } else {
                            showLoginBox(\`비밀번호가 틀렸습니다. (현재 \${data.attempts}/5회 실패)\`);
                        }
                    }
                }

                function goToBypass() {
                    const userInput = document.getElementById('targetUrl').value.trim();
                    if (!userInput) return alert('주소를 입력해 주세요!');
                    if (!userInput.startsWith('http://') && !userInput.startsWith('https://')) {
                        return alert('주소 앞에 https:// 나 http:// 를 꼭 붙여주세요!');
                    }
                    window.location.href = window.location.origin + '/bypass?url=' + encodeURIComponent(userInput);
                }
            </script>
        </body>
        </html>
    `);
});

// 3. 비밀번호 확인 API (틀린 횟수 카운트 및 다중 비밀번호 포함 확인 처리)
app.post('/auth-check', (req, res) => {
    const { password } = req.body;
    const ip = getClientIP(req);

    // 이미 차단된 IP인 경우
    if (bannedIPs.has(ip)) {
        return res.json({ success: false, banned: true });
    }

    // ⭐ 입력한 비번이 배열에 포함되어 있는지 체크하는 완벽한 로직입니다.
    if (CORRECT_PASSWORD.includes(password)) {
        failedAttempts[ip] = 0; // 성공 시 카운트 리셋
        return res.json({ success: true });
    } else {
        // 틀린 경우 카운트 증가
        failedAttempts[ip] = (failedAttempts[ip] || 0) + 1;

        if (failedAttempts[ip] >= 5) {
            bannedIPs.add(ip); // 서버 메모리에 IP 차단 등록
            return res.json({ success: false, banned: true, attempts: failedAttempts[ip] });
        }

        return res.json({ success: false, banned: false, attempts: failedAttempts[ip] });
    }
});

app.listen(PORT, () => {
    console.log(`Secured Multi-PW Server running on port ${PORT}`);
});
