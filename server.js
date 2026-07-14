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

// 1. ⭐ 가상 브라우저(iframe) 안에서 모든 하위 리소스 요청을 안전하게 우회 처리하는 핵심 엔진
app.use('/bypass', (req, res, next) => {
    let encodedUrl = req.query.url;
    const ip = getClientIP(req);

    if (bannedIPs.has(ip)) {
        return res.status(403).send('<h1>[접근 차단] 비밀번호 5회 오류로 인해 이 사이트에 영구적으로 접속할 수 없습니다.</h1>');
    }

    // 만약 이미지나 CSS 같은 하위 리소스가 들어올 때 url 파라미터가 없으면 Referer(이전 주소)를 추적하여 자동 복원합니다.
    if (!encodedUrl && req.headers.referer) {
        const refererUrl = new URL(req.headers.referer);
        encodedUrl = refererUrl.searchParams.get('url');
    }

    if (!encodedUrl) return res.status(400).send('우회할 URL이 없습니다.');

    try {
        const targetUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
        const urlObj = new URL(targetUrl);

        createProxyMiddleware({
            target: urlObj.origin,
            changeOrigin: true,
            followRedirects: true,
            secure: false,
            // 💡 경로 왜곡 방지: 가상 브라우저 내부에서 하위 파일 요청 경로를 원래 타겟 주소와 똑같이 맵핑합니다.
            pathRewrite: (path, req) => {
                return req.originalUrl.replace('/bypass', '') || '/';
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Origin': urlObj.origin,
                'Referer': urlObj.origin
            },
            on: {
                proxyRes: (proxyRes, req, res) => {
                    // 브라우저가 프레임(iframe) 차단을 못 하도록 차단 헤더들을 완전히 박살냅니다.
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', '*');
                    delete proxyRes.headers['x-frame-options'];
                    delete proxyRes.headers['content-security-policy'];
                    delete proxyRes.headers['cross-origin-opener-policy'];
                }
            }
        })(req, res, next);

    } catch (e) {
        return res.status(500).send('주소 해석 중 오류가 발생했습니다.');
    }
});

// 2. 메인 화면 및 가상 브라우저 인터페이스
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
                    margin: 0; padding: 0; overflow: hidden;
                    display: flex; flex-direction: column; height: 100vh;
                }
                /* 상단 검색 바 디자인 */
                .navbar {
                    background: #1e1e1e; padding: 10px 20px;
                    display: flex; gap: 15px; align-items: center;
                    border-bottom: 2px solid #333; z-index: 10;
                }
                .navbar h1 { font-size: 18px; margin: 0; color: #bb86fc; white-space: nowrap; }
                .navbar input {
                    flex: 1; padding: 10px; border: 2px solid #333; border-radius: 6px;
                    background-color: #2a2a2a; color: white; font-size: 14px; outline: none;
                }
                .navbar input:focus { border-color: #bb86fc; }
                .navbar button {
                    padding: 10px 20px; border: none; border-radius: 6px;
                    background-color: #bb86fc; color: #121212; font-size: 14px;
                    font-weight: bold; cursor: pointer; transition: 0.2s;
                }
                .navbar button:hover { background-color: #9965db; }
                
                /* 로그인 전 중앙 박스 */
                .login-container {
                    text-align: center; width: 90%; max-width: 400px;
                    background: #1e1e1e; padding: 40px 30px; border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.5); margin: auto;
                }
                .login-container h1 { margin-bottom: 10px; font-size: 26px; color: #bb86fc; }
                .login-container p { color: #aaa; font-size: 14px; margin-bottom: 25px; }
                .login-container input { width: 100%; margin-bottom: 15px; padding: 15px; box-sizing: border-box; }
                .login-container button { width: 100%; padding: 15px; }
                .error-msg { color: #ff6b6b; margin-top: 15px; font-weight: bold; font-size: 14px; }

                /* 가상 브라우저 화면 영역 */
                #gameFrame {
                    width: 100%; flex: 1; border: none; background: white; display: none;
                }
            </style>
        </head>
        <body>
            <div id="mainView" style="display: flex; flex-direction: column; width: 100%; height: 100%;">
                <!-- 컨텐츠가 스크립트에 의해 동적으로 주입됩니다 -->
            </div>

            <script>
                const mainView = document.getElementById('mainView');

                if (localStorage.getItem('isBanned') === 'true') {
                    document.body.innerHTML = '<h1 style="text-align:center; margin-top:40vh;">[접근 차단] 비밀번호 5회 오류로 인해 이 기기에서는 영구적으로 접속할 수 없습니다.</h1>';
                } else if (sessionStorage.getItem('myProxyAuth') === 'true') {
                    showProxyBrowser();
                } else {
                    showLoginBox();
                }

                function showLoginBox(errorText = '') {
                    mainView.innerHTML = \`
                        <div class="login-container">
                            <h1>보안 관리자 인증</h1>
                            <p>비밀번호를 입력하세요. (5회 실패 시 영구 차단)</p>
                            <input type="password" id="pwInput" placeholder="Password" style="border: 2px solid #333; border-radius: 8px; background-color: #2a2a2a; color: white; font-size: 16px; outline: none;" autofocus>
                            <button onclick="checkPassword()" style="border: none; border-radius: 8px; background-color: #bb86fc; color: #121212; font-size: 16px; font-weight: bold; cursor: pointer;">인증하기</button>
                            <div class="error-msg">\${errorText}</div>
                        </div>
                    \`;
                    document.getElementById('pwInput').addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') checkPassword();
                    });
                }

                function showProxyBrowser() {
                    mainView.innerHTML = \`
                        <div class="navbar">
                            <h1>비밀 브라우저</h1>
                            <input type="text" id="targetUrl" placeholder="https://pokerogue.net">
                            <button onclick="goToBypass()">우회 접속</button>
                        </div>
                        <iframe id="gameFrame"></iframe>
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
                        showProxyBrowser();
                    } else {
                        if (data.banned) {
                            localStorage.setItem('isBanned', 'true');
                            window.location.reload();
                        } else {
                            showLoginBox(\`비밀번호가 틀렸습니다. (현재 \${data.attempts}/5회 실패)\`);
                        }
                    }
                }

                // ⭐ 가상 브라우저(iframe) 안으로 안전하게 격리하여 와이파이 방화벽을 원천 차단하는 마법의 함수
                function goToBypass() {
                    const userInput = document.getElementById('targetUrl').value.trim();
                    if (!userInput) return alert('주소를 입력해 주세요!');
                    if (!userInput.startsWith('http://') && !userInput.startsWith('https://')) {
                        return alert('주소 앞에 https:// 를 꼭 붙여주세요!');
                    }
                    
                    const base64Url = btoa(encodeURIComponent(userInput).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                        return String.fromCharCode('0x' + p1);
                    }));

                    const iframe = document.getElementById('gameFrame');
                    iframe.style.display = "block";
                    // 메인 창 주소는 내 주소로 고정하고, iframe 내부만 우회 주소로 채웁니다.
                    iframe.src = window.location.origin + '/bypass?url=' + base64Url;
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
        }return res.json({ success: false, banned: false, attempts: failedAttempts[ip] });
    }});

app.listen(PORT, () => {
    console.log(Virtual-Browser Proxy Server running on port ${PORT});
});
