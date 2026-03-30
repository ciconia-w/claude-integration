// claude-integration/server-demo.ts
import express from 'express';

const app = express();
const PORT = process.env.PORT || 8001;

app.use(express.json());

// 健康检查端点
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage().heapUsed / 1024 / 1024;
  res.json({
    status: 'ok',
    uptime: Math.floor(uptime),
    memory: Math.floor(memory)
  });
});

// 模拟流式响应端点
app.post('/stream', (req, res) => {
  const { message } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 模拟 Claude 的响应
  const responses = [
    '你好！',
    '我是 Claude，',
    '一个由 Anthropic 开发的 AI 助手。',
    '\n\n',
    '这是一个演示模式，',
    '不需要真实的 API Key。',
    '\n\n',
    '你的消息是：',
    message,
    '\n\n',
    '在真实模式下，',
    '我可以帮你完成各种任务，',
    '包括编程、写作、分析等。',
    '\n\n',
    '要使用真实的 Claude，',
    '请访问 https://console.anthropic.com/ ',
    '获取你的 API Key。'
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (index < responses.length) {
      const data = JSON.stringify({
        type: 'text',
        data: responses[index]
      });
      res.write(`event: text\ndata: ${data}\n\n`);
      index++;
    } else {
      const doneData = JSON.stringify({
        type: 'done',
        data: JSON.stringify({ sessionId: 'demo-session-' + Date.now() })
      });
      res.write(`event: done\ndata: ${doneData}\n\n`);
      res.end();
      clearInterval(interval);
    }
  }, 100);

  req.on('close', () => {
    clearInterval(interval);
  });
});

app.listen(PORT, () => {
  console.log(`Claude integration DEMO server running on port ${PORT}`);
  console.log('This is a demo mode - no API key required!');
});
