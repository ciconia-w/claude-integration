#!/usr/bin/env node
// claude-integration/cli-test.js
const http = require('http');
const readline = require('readline');

const PORT = 8002;

let rl = null;

function createReadline() {
  if (rl) {
    rl.close();
  }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

console.log('='.repeat(60));
console.log('Claude Chat CLI - 测试版');
console.log('='.repeat(60));
console.log('服务器: http://localhost:' + PORT);
console.log('配置: 使用 config.json 中的 API Key');
console.log('输入 "exit" 退出');
console.log('='.repeat(60));
console.log('');

function sendMessage(message) {
  const data = JSON.stringify({ message });

  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/stream',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  let responseDone = false;

  const req = http.request(options, (res) => {
    console.log('\nClaude: ');

    res.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.type === 'text') {
              process.stdout.write(data.data);
            } else if (data.type === 'done') {
              console.log('\n');
              if (!responseDone) {
                responseDone = true;
                askQuestion();
              }
            } else if (data.type === 'error') {
              console.log('\n错误:', data.data);
              if (!responseDone) {
                responseDone = true;
                askQuestion();
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    });

    res.on('end', () => {
      // Stream ended - if no done/error event was received, prompt again
      if (!responseDone) {
        responseDone = true;
        console.log('\n');
        askQuestion();
      }
    });
  });

  req.on('error', (error) => {
    console.error('\n连接错误:', error.message);
    if (!responseDone) {
      responseDone = true;
      askQuestion();
    }
  });

  req.write(data);
  req.end();
}

function askQuestion() {
  if (!rl || rl.closed) {
    createReadline();
  }

  rl.question('\n你: ', (answer) => {
    if (answer.toLowerCase() === 'exit') {
      console.log('再见！');
      rl.close();
      process.exit(0);
    }

    if (answer.trim()) {
      sendMessage(answer);
    } else {
      askQuestion();
    }
  });
}

// 检查服务器是否运行
createReadline();
http.get(`http://localhost:${PORT}/health`, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('✅ 服务器状态:', data);
    console.log('');
    askQuestion();
  });
}).on('error', (err) => {
  console.error('❌ 无法连接到服务器:', err.message);
  console.error('请确保服务器正在运行: npm start');
  if (rl) rl.close();
  process.exit(1);
});
