#!/bin/bash
# Claude Chat CLI 测试工具启动脚本

cd "$(dirname "$0")"

echo "正在检查服务器状态..."
if ! curl -s http://localhost:8002/health > /dev/null 2>&1; then
    echo "服务器未运行，正在启动..."
    npm start > /tmp/claude-server.log 2>&1 &
    sleep 3
fi

echo "启动 CLI 测试工具..."
node cli-test.js
