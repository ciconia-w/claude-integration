// claude-integration/src/claude-client.ts
import Anthropic from '@anthropic-ai/sdk';

export interface Tool {
  name: string;
  description: string;
  input_schema: any;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class ClaudeClient {
  private anthropic: Anthropic;
  private tools: Tool[];
  private conversationHistory: Message[];
  private model: string;
  private maxTokens: number;

  constructor(apiKey: string, tools: Tool[] = [], baseURL?: string, model?: string, maxTokens?: number) {
    console.log('ClaudeClient constructor - baseURL:', baseURL);

    // Disable SSL certificate verification for custom endpoints
    if (baseURL && baseURL !== 'https://api.anthropic.com') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      console.log('Disabled SSL certificate verification for custom endpoint');
    }

    this.anthropic = new Anthropic({
      apiKey,
      baseURL: baseURL || 'https://api.anthropic.com',
      defaultHeaders: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });
    console.log('Anthropic client initialized with baseURL:', baseURL || 'https://api.anthropic.com');
    this.tools = tools;
    this.conversationHistory = [];
    this.model = model || 'claude-3-5-sonnet-20241022';
    this.maxTokens = maxTokens || 4096;
    console.log('Model:', this.model, 'MaxTokens:', this.maxTokens);
  }

  async sendMessage(message: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: message });

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: this.conversationHistory,
      tools: this.tools.length > 0 ? this.tools : undefined
    });

    const textContent = response.content.find(c => c.type === 'text');
    const text = textContent ? textContent.text : '';

    this.conversationHistory.push({ role: 'assistant', content: text });
    return text;
  }

  async *streamMessage(message: string): AsyncGenerator<string> {
    this.conversationHistory.push({ role: 'user', content: message });

    console.log('Sending request to API with model:', this.model);
    console.log('Message:', message);
    console.log('Tools count:', this.tools.length);
    console.log('History length:', this.conversationHistory.length);

    try {
      const stream = await this.anthropic.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: this.conversationHistory,
        tools: this.tools.length > 0 ? this.tools : undefined
      });

      let currentToolName = '';
      let currentToolId = '';
      let fullText = '';

      for await (const chunk of stream) {
        // 检测工具调用开始
        if (chunk.type === 'content_block_start' &&
            chunk.content_block.type === 'tool_use') {
          currentToolName = chunk.content_block.name;
          currentToolId   = chunk.content_block.id;
          yield `__TOOL_USE__${JSON.stringify({
            name: currentToolName,
            id: currentToolId,
            status: 'started'
          })}`;
          continue;
        }
        // 检测工具调用结束
        if (chunk.type === 'content_block_stop' && currentToolName) { // currentToolName is set only for tool blocks
          yield `__TOOL_USE__${JSON.stringify({
            name: currentToolName,
            id: currentToolId,
            status: 'completed'
          })}`;
          currentToolName = '';
          currentToolId   = '';
          continue;
        }
        // 普通文本
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text;
          yield chunk.delta.text;
        }
      }

      this.conversationHistory.push({ role: 'assistant', content: fullText });
    } catch (error: any) {
      console.error('API Error:', error);
      console.error('Error status:', error.status);
      console.error('Error message:', error.message);
      console.error('Error response:', JSON.stringify(error.error, null, 2));
      throw error;
    }
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  loadConversationHistory(history: Message[]): void {
    this.conversationHistory = [...history];
    console.log('Loaded conversation history:', history.length, 'messages');
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}
