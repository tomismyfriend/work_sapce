# AI Agent 开发与智能编程工具实战

## 封面
- 标题: AI Agent 开发与智能编程工具实战
- 副标题: 从原理到落地，理解 AI Agent 如何独立完成任务

## 议程
- 总：整体认知 AI Agent
- 分：逐个展开核心原理
- 实战：AI 编程工具与最佳实践

## 为什么关注 AI Agent
- 2023: ChatGPT → 对话式AI
- 2024: Copilot/Cursor → AI编程
- 2025-26: AI Agent → 自主完成任务
- 传统AI只能告诉你方法，Agent直接帮你完成

## 什么是 AI Agent
- AI Agent = LLM + 感知 + 行动 + 记忆 + 规划 + 循环
- LLM = 被关在房间里的天才（只能思考）
- Agent = 有手有脚的智能助手（能执行）
- 五大特征：感知、行动、记忆、规划、循环

## Agent 系统架构
- 编排层（Agent Loop）→ 循环执行
- 感知层（Perception）→ 文件读取、Shell命令、API调用
- 工具执行器（Action）→ MCP、代码执行、浏览器
- 记忆管理器（Memory）→ 消息历史、向量数据库
- 规划器（Planner）→ 任务拆解、自我反思
- 大脑（LLM）→ 推理与决策

## 什么是 LLM
- 本质：下一个词预测器
- 训练三阶段：预训练→监督微调→偏好对齐
- 三大能力：通用推理、上下文学习、指令遵循
- LLM只会生成文本，没有手脚没有记忆

## 什么是 Token
- Token = 词表中一个条目的ID = 文本片段的数字编号
- 常见汉字1字≈1token，英文1词≈1token
- API按Token计费，中文比英文贵1.5-2倍
- 省钱策略：选对模型、精简Prompt、缓存、Batch API

## 为什么 LLM 不能操作
- LLM是纯函数：f(text_in) → text_out
- 无IO能力、无状态、无执行环境、单次输出
- 像计算器能算数但不能写进Excel
- 需要Agent框架作为"外壳程序"

## 感知能力 Perception
- 实现模块：感知层
- 5种感知方式：文件系统、Shell命令、API调用、网页爬取、事件监听
- 固定步骤模式 vs 动态决策模式 vs 混合模式
- 让Agent从"纸上谈兵"变成"实地考察"

## 行动能力 Action
- 实现模块：工具执行器（MCP是标准化接入方式）
- 文件操作、代码执行、API调用、浏览器操作
- Function Calling：LLM输出结构化调用指令，框架负责执行
- LLM只负责决策，框架负责执行

## 记忆系统 Memory
- 实现模块：记忆管理器
- 短期记忆：messages数组（当前对话历史）
- 长期记忆：向量数据库（语义检索，跨任务）
- 工作记忆：scratchpad（任务进度追踪）
- 短期记忆用摘要压缩，长期记忆用Embedding+向量检索

## 任务规划 Planning
- 实现模块：规划器
- ReAct模式：思考→行动→观察→再思考
- Plan-and-Execute：先规划再执行
- 自我反思：结果验证、自我评估、多路径探索

## 循环执行 Agent Loop
- 实现模块：编排层
- 核心：while循环 + LLM决策 + 工具执行
- LLM输出tool_calls→执行工具→结果喂回→继续循环
- LLM无tool_calls→任务完成→返回结果

## MCP 协议
- AI工具的"USB-C接口"
- 标准化协议，让所有AI模型通用连接外部工具
- 解决N×M集成问题，变成N+M
- MCP Server暴露Tools/Resources/Prompts

## 任务完成判断
- LLM自己决定：无tool_calls = 任务完成
- 防护：最大步数限制、结果验证、强制继续
- 模型越强判断越准

## 结果验证
- 程序化验证（代码/测试/API状态码）
- LLM自我评估（LLM-as-Judge）
- 双模型交叉验证（高风险场景）

## 代码实现
- 50行Python代码实现完整Agent
- 定义工具→实现执行逻辑→Agent主循环
- Agent就是胶水代码：连接LLM决策和真实工具

## 自我纠错
- 遇到错误→理解错误→调整策略→重试
- 三种反思模式：结果验证、自我评估、多路径探索
- 从"一次性生成"进化为"迭代优化"

## AI 编程工具
- Copilot: IDE插件，生态最广
- Cursor: 独立IDE，Agent模式
- OpenCode: CLI工具，灵活可配置
- 编程工具本质上也是Agent

## 使用技巧
- 提供上下文、分步请求、始终Review
- Rules文件统一团队规范
- 根据场景选择最合适的工具

## 总结
- LLM = 下一个词预测器，只能输出文本
- Token = 词表条目ID，计费单位
- Agent = LLM + 5个功能模块
- 选对模型 + 精简输入 + 缓存 = 成本降低50-80%
