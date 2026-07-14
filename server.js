const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 8080;

// CORS 설정: 내 프론트엔드 사이트(태블릿 포함)에서 이 API를 자유롭게 호출할 수 있게 허용
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// 우회 요청 처리 엔드포인트
app.get('/bypass', (req, res, next) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('우회할 URL이 주어지지 않았습니다 (?url=주소 형태여야 합니다).');

    createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        followRedirects: true,
        pathRewrite: { '^/bypass': '' },
    })(req, res, next);
});

// 서버가 정상 작동하는지 확인용 메인 화면
app.get('/', (req, res) => {
    res.send('Bypass Proxy API Server is Active.');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
