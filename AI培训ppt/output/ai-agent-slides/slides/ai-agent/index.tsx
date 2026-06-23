import type { DesignSystem, Page, SlideMeta } from '@open-slide/core';

export const design: DesignSystem = {
  palette: {
    bg: '#0a0f1c',
    text: '#ffffff',
    muted: '#9ca3af',
    accent: '#00ffcc',
    surface: '#111827',
    border: '#1f2937',
  },
  fonts: {
    display: '"Orbitron", sans-serif',
    body: '"Rajdhani", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  typeScale: {
    display: 96,
    h1: 72,
    h2: 56,
    h3: 40,
    body: 28,
    small: 20,
  },
  radius: { sm: 8, md: 16, lg: 24 },
};

const palette = {
  bg: design.palette.bg,
  text: design.palette.text,
  muted: design.palette.muted,
  accent: design.palette.accent,
  surface: design.palette.surface,
  border: design.palette.border,
  surfaceHi: '#1a2332',
  surfaceMax: '#243044',
  textSoft: '#d1d5db',
  dim: '#4b5563',
  accentSoft: '#66ffd9',
  accent2: '#0ea5e9',
  warn: '#f59e0b',
  error: '#ef4444',
  success: '#10b981',
};

const font = {
  display: design.fonts.display,
  body: design.fonts.body,
  mono: design.fonts.mono,
};

const fill: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'var(--osd-bg)',
  color: 'var(--osd-text)',
  fontFamily: 'var(--osd-font-body)',
  letterSpacing: '-0.01em',
  overflow: 'hidden',
  position: 'relative',
};

const styles = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50%      { opacity: 1; }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px ${palette.accent}22; }
    50%      { box-shadow: 0 0 40px ${palette.accent}44; }
  }
  .fadeUp { opacity: 0; animation: fadeUp 0.8s cubic-bezier(.2,.7,.2,1) forwards; }
  .fadeIn { opacity: 0; animation: fadeIn 1s ease forwards; }
`;

const Styles = () => <style>{styles}</style>;

const GridBg = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backgroundImage:
        'linear-gradient(rgba(0,255,204,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.03) 1px, transparent 1px)',
      backgroundSize: '80px 80px',
      maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 70%)',
      WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 70%)',
    }}
  />
);

const Eyebrow = ({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) => (
  <div
    className={className}
    style={{
      fontFamily: font.mono,
      fontSize: 20,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: palette.accent,
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <h2
    className="fadeUp"
    style={{
      fontFamily: `var(--osd-font-display)`,
      fontSize: 'var(--osd-size-h1)',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1.05,
      margin: 0,
      marginTop: 16,
      animationDelay: `${delay}s`,
    }}
  >
    {children}
  </h2>
);

const Card = ({
  children,
  style,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  className?: string;
}) => (
  <div
    className={className || 'fadeUp'}
    style={{
      background: palette.surface,
      border: `1px solid ${palette.border}`,
      borderRadius: 'var(--osd-radius-md)',
      padding: '28px 32px',
      animationDelay: `${delay}s`,
      ...style,
    }}
  >
    {children}
  </div>
);

const Badge = ({ children, color = palette.accent }: { children: React.ReactNode; color?: string }) => (
  <span
    style={{
      fontFamily: font.mono,
      fontSize: 16,
      color,
      background: `${color}16`,
      border: `1px solid ${color}40`,
      padding: '4px 12px',
      borderRadius: 6,
      fontWeight: 500,
    }}
  >
    {children}
  </span>
);

const PageNum = ({ num, total = 15 }: { num: number; total?: number }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 40,
      right: 60,
      fontFamily: font.mono,
      fontSize: 18,
      color: palette.dim,
    }}
  >
    {String(num).padStart(2, '0')} / {String(total).padStart(2, '0')}
  </div>
);

// ─── Slide 1: Cover ──────────────────────────────────────────────────────────
const Cover: Page = () => (
  <div style={fill}>
    <Styles />
    <GridBg />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '120px 140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Eyebrow className="fadeUp" style={{ animationDelay: '0.05s' }}>
          AI Agent Development
        </Eyebrow>
        <div
          className="fadeUp"
          style={{
            animationDelay: '0.05s',
            fontFamily: font.mono,
            fontSize: 18,
            color: palette.muted,
            border: `1px solid ${palette.border}`,
            padding: '8px 16px',
            borderRadius: 999,
          }}
        >
          2026
        </div>
      </div>

      <div>
        <h1
          className="fadeUp"
          style={{
            fontFamily: 'var(--osd-font-display)',
            fontSize: 'var(--osd-size-display)',
            lineHeight: 1.0,
            fontWeight: 700,
            margin: 0,
            letterSpacing: '-0.04em',
            animationDelay: '0.15s',
          }}
        >
          AI Agent 开发
          <br />
          <span
            style={{
              background: `linear-gradient(90deg, ${palette.accentSoft}, var(--osd-accent))`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            与智能编程工具实战
          </span>
        </h1>
        <p
          className="fadeUp"
          style={{
            marginTop: 40,
            maxWidth: 900,
            fontSize: 'var(--osd-size-body)',
            lineHeight: 1.4,
            color: palette.textSoft,
            animationDelay: '0.3s',
          }}
        >
          从大语言模型原理到 Agent 架构设计，从 Function Calling 到 MCP 协议，
          全面掌握 AI Agent 开发核心技术。
        </p>
      </div>

      <div
        className="fadeUp"
        style={{
          animationDelay: '0.5s',
          display: 'flex',
          gap: 40,
          fontFamily: font.mono,
          fontSize: 20,
          color: palette.muted,
        }}
      >
        <span>
          <span style={{ color: palette.accent }}>01</span> 原理篇
        </span>
        <span>
          <span style={{ color: palette.accent }}>02</span> 架构篇
        </span>
        <span>
          <span style={{ color: palette.accent }}>03</span> 实战篇
        </span>
      </div>
    </div>
    <PageNum num={1} />
  </div>
);

// ─── Slide 2: Agenda ─────────────────────────────────────────────────────────
const Agenda: Page = () => {
  const sections = [
    {
      num: '01',
      title: '原理篇：理解 LLM',
      items: ['大语言模型工作原理', 'Token 与计费模型', 'LLM 能力边界'],
    },
    {
      num: '02',
      title: '架构篇：Agent 核心',
      items: ['感知 · 行动 · 记忆', 'Agent Loop 设计', 'MCP 协议'],
    },
    {
      num: '03',
      title: '实战篇：工具落地',
      items: ['智能编程工具对比', 'Cursor / Copilot / Windsurf', '最佳实践'],
    },
  ];

  return (
    <div style={fill}>
      <Styles />
      <GridBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '100px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: 48,
        }}
      >
        <div className="fadeUp">
          <Eyebrow>Agenda</Eyebrow>
          <SectionTitle>课程大纲</SectionTitle>
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 32,
            minHeight: 0,
          }}
        >
          {sections.map((s, i) => (
            <Card key={s.num} delay={0.15 + i * 0.12} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div
                style={{
                  fontFamily: font.mono,
                  fontSize: 48,
                  fontWeight: 700,
                  color: palette.accent,
                  lineHeight: 1,
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  fontSize: 'var(--osd-size-h3)',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                {s.title}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {s.items.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 'var(--osd-size-body)',
                      color: palette.textSoft,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: palette.accent,
                        flexShrink: 0,
                      }}
                    />
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <PageNum num={2} />
    </div>
  );
};

// ─── Slide 3: Why AI Agent ───────────────────────────────────────────────────
const WhyAgent: Page = () => {
  const timeline = [
    { year: '2020', label: 'GPT-3', desc: '大语言模型时代开启' },
    { year: '2022', label: 'ChatGPT', desc: 'AI 走进千家万户' },
    { year: '2023', label: 'GPT-4 + Plugins', desc: 'Agent 概念萌芽' },
    { year: '2024', label: 'Claude / MCP', desc: 'Agent 生态爆发' },
    { year: '2025', label: 'AI Coding', desc: '智能编程工具成熟' },
  ];

  return (
    <div style={fill}>
      <Styles />
      <GridBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '100px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        <div className="fadeUp">
          <Eyebrow>01 / Why AI Agent</Eyebrow>
          <SectionTitle>为什么需要 AI Agent?</SectionTitle>
        </div>

        <div
          className="fadeUp"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 0,
            animationDelay: '0.2s',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              padding: '0 20px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 20,
                right: 20,
                top: '50%',
                height: 2,
                background: `linear-gradient(90deg, ${palette.accent}, ${palette.accent2})`,
                opacity: 0.3,
              }}
            />
            {timeline.map((t, i) => (
              <div
                key={t.year}
                className="fadeUp"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                  position: 'relative',
                  animationDelay: `${0.3 + i * 0.12}s`,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: i === timeline.length - 1 ? palette.accent : palette.surface,
                    border: `2px solid ${palette.accent}`,
                    zIndex: 1,
                    boxShadow: i === timeline.length - 1 ? `0 0 20px ${palette.accent}66` : 'none',
                  }}
                />
                <div
                  style={{
                    fontFamily: font.mono,
                    fontSize: 22,
                    color: palette.accent,
                    fontWeight: 600,
                  }}
                >
                  {t.year}
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  {t.label}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    color: palette.muted,
                    textAlign: 'center',
                    maxWidth: 180,
                  }}
                >
                  {t.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}
        >
          <Card delay={0.6}>
            <div style={{ fontSize: 22, color: palette.muted, marginBottom: 12, fontFamily: font.mono }}>
              传统自动化
            </div>
            <div style={{ fontSize: 26, color: palette.textSoft, lineHeight: 1.5 }}>
              固定流程 · 硬编码规则 · 无法处理异常 · 需要人工干预
            </div>
          </Card>
          <Card delay={0.7} style={{ borderColor: `${palette.accent}40` }}>
            <div style={{ fontSize: 22, color: palette.accent, marginBottom: 12, fontFamily: font.mono }}>
              AI Agent
            </div>
            <div style={{ fontSize: 26, color: palette.textSoft, lineHeight: 1.5 }}>
              自主决策 · 动态规划 · 工具调用 · 持续学习
            </div>
          </Card>
        </div>
      </div>
      <PageNum num={3} />
    </div>
  );
};

// ─── Slide 4: What is Agent ──────────────────────────────────────────────────
const WhatIsAgent: Page = () => {
  const features = [
    { icon: '🧠', title: '自主推理', desc: '基于 LLM 进行复杂推理与决策' },
    { icon: '👁', title: '环境感知', desc: '通过 API 和工具感知外部环境' },
    { icon: '🔧', title: '工具使用', desc: '调用外部工具完成具体任务' },
    { icon: '💾', title: '记忆管理', desc: '维护短期与长期记忆上下文' },
    { icon: '🔄', title: '循环迭代', desc: '感知-思考-行动-反馈闭环' },
  ];

  return (
    <div style={fill}>
      <Styles />
      <GridBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '100px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        <div className="fadeUp">
          <Eyebrow>02 / What is Agent</Eyebrow>
          <SectionTitle>什么是 AI Agent?</SectionTitle>
          <p
            className="fadeUp"
            style={{
              marginTop: 16,
              fontSize: 'var(--osd-size-body)',
              color: palette.textSoft,
              maxWidth: 1100,
              animationDelay: '0.2s',
            }}
          >
            AI Agent = LLM + 感知 + 记忆 + 工具 + 规划，能够自主完成复杂任务的智能体。
          </p>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: 24,
            minHeight: 0,
          }}
        >
          {features.map((f, i) => (
            <Card
              key={f.title}
              delay={0.15 + i * 0.1}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                textAlign: 'center',
                padding: '32px 20px',
              }}
            >
              <div style={{ fontSize: 56 }}>{f.icon}</div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                }}
              >
                {f.title}
              </div>
              <div
                style={{
                  fontSize: 22,
                  color: palette.muted,
                  lineHeight: 1.4,
                }}
              >
                {f.desc}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <PageNum num={4} />
    </div>
  );
};

// ─── Slide 5: Architecture ───────────────────────────────────────────────────
const Architecture: Page = () => (
  <div style={fill}>
    <Styles />
    <GridBg />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '100px 140px',
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      <div className="fadeUp">
        <Eyebrow>03 / Architecture</Eyebrow>
        <SectionTitle>Agent 系统架构</SectionTitle>
      </div>

      <div
        className="fadeUp"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animationDelay: '0.2s',
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '200px 1fr 200px',
            gap: 32,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {['用户输入', '环境信号', 'API 请求'].map((label, i) => (
              <div
                key={label}
                className="fadeUp"
                style={{
                  animationDelay: `${0.3 + i * 0.1}s`,
                  padding: '20px 24px',
                  background: `${palette.accent2}22`,
                  border: `1px solid ${palette.accent2}55`,
                  borderRadius: 12,
                  textAlign: 'center',
                  fontSize: 24,
                  fontWeight: 500,
                  color: palette.accent2,
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div
            className="fadeUp"
            style={{
              animationDelay: '0.4s',
              background: palette.surface,
              border: `2px solid ${palette.accent}40`,
              borderRadius: 24,
              padding: '48px 40px',
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
              boxShadow: `0 0 60px ${palette.accent}11`,
            }}
          >
            <div
              style={{
                textAlign: 'center',
                fontFamily: font.mono,
                fontSize: 20,
                color: palette.accent,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              AI Agent Core
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { label: 'LLM 大脑', sub: '推理 · 规划 · 决策' },
                { label: '记忆系统', sub: '短期 · 长期 · 向量' },
                { label: '感知模块', sub: '输入解析 · 上下文' },
                { label: '行动模块', sub: '工具调用 · API' },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    padding: '20px 24px',
                    background: palette.surfaceHi,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 18, color: palette.muted }}>{m.sub}</div>
                </div>
              ))}
            </div>
            <div
              style={{
                textAlign: 'center',
                fontFamily: font.mono,
                fontSize: 22,
                color: palette.accentSoft,
                padding: '12px 0',
                border: `1px dashed ${palette.accent}40`,
                borderRadius: 12,
              }}
            >
              Agent Loop: Perceive → Think → Act → Reflect
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {['文件系统', 'Web API', '数据库'].map((label, i) => (
              <div
                key={label}
                className="fadeUp"
                style={{
                  animationDelay: `${0.5 + i * 0.1}s`,
                  padding: '20px 24px',
                  background: `${palette.warn}22`,
                  border: `1px solid ${palette.warn}55`,
                  borderRadius: 12,
                  textAlign: 'center',
                  fontSize: 24,
                  fontWeight: 500,
                  color: palette.warn,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    <PageNum num={5} />
  </div>
);

// ─── Slide 6: LLM ────────────────────────────────────────────────────────────
const LLM: Page = () => (
  <div style={fill}>
    <Styles />
    <GridBg />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '100px 140px',
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      <div className="fadeUp">
        <Eyebrow>04 / LLM</Eyebrow>
        <SectionTitle>大语言模型：Token 预测器</SectionTitle>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 40,
          minHeight: 0,
        }}
      >
        <Card delay={0.2} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.accent, letterSpacing: '0.1em' }}>
            核心原理
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.3 }}>
            下一个 Token 预测
          </div>
          <div
            style={{
              padding: '24px',
              background: palette.bg,
              borderRadius: 12,
              fontFamily: font.mono,
              fontSize: 24,
              lineHeight: 1.8,
              color: palette.textSoft,
            }}
          >
            <span style={{ color: palette.muted }}>Input:</span> "今天天气"
            <br />
            <span style={{ color: palette.accent }}>Output:</span> P("很好") = 0.72
            <br />
            <span style={{ color: palette.accent }}>Output:</span> P("不错") = 0.15
          </div>
          <div style={{ fontSize: 24, color: palette.muted, lineHeight: 1.5 }}>
            本质是一个超大规模的条件概率模型，通过海量文本训练出对语言规律的深度理解。
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card delay={0.3} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.accent2, letterSpacing: '0.1em' }}>
              训练三阶段
            </div>
            {[
              { stage: 'Pre-training', desc: '海量文本无监督学习' },
              { stage: 'SFT', desc: '监督微调，学习对话格式' },
              { stage: 'RLHF / DPO', desc: '人类偏好对齐' },
            ].map((s, i) => (
              <div
                key={s.stage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 20px',
                  background: palette.surfaceHi,
                  borderRadius: 10,
                  border: `1px solid ${palette.border}`,
                }}
              >
                <span
                  style={{
                    fontFamily: font.mono,
                    fontSize: 18,
                    color: palette.accent,
                    fontWeight: 600,
                    width: 30,
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{s.stage}</div>
                  <div style={{ fontSize: 20, color: palette.muted }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </Card>

          <Card delay={0.4} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.warn, letterSpacing: '0.1em' }}>
              关键参数
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { k: '参数量', v: '175B+' },
                { k: '上下文', v: '128K' },
                { k: 'Temperature', v: '0~2' },
                { k: 'Top-P', v: '0~1' },
              ].map((p) => (
                <div
                  key={p.k}
                  style={{
                    padding: '12px 16px',
                    background: palette.surfaceHi,
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 18, color: palette.muted }}>{p.k}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: palette.accent, fontFamily: font.mono }}>
                    {p.v}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
    <PageNum num={6} />
  </div>
);

// ─── Slide 7: Token ──────────────────────────────────────────────────────────
const Token: Page = () => (
  <div style={fill}>
    <Styles />
    <GridBg />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '100px 140px',
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      <div className="fadeUp">
        <Eyebrow>05 / Token</Eyebrow>
        <SectionTitle>Token：LLM 的计量单位</SectionTitle>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 40,
          minHeight: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card delay={0.2} style={{ flex: 1 }}>
            <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.accent, marginBottom: 20, letterSpacing: '0.1em' }}>
              什么是 Token?
            </div>
            <div style={{ fontSize: 26, color: palette.textSoft, lineHeight: 1.6, marginBottom: 20 }}>
              Token 是 LLM 处理文本的最小单元。不等于字或词，而是介于两者之间的子词片段。
            </div>
            <div
              style={{
                padding: '20px 24px',
                background: palette.bg,
                borderRadius: 12,
                fontFamily: font.mono,
                fontSize: 22,
                lineHeight: 2,
              }}
            >
              <div>
                <span style={{ color: palette.muted }}>"Hello World"</span> →{' '}
                <span style={{ color: palette.accent }}>["Hello", " World"]</span> = 2 tokens
              </div>
              <div>
                <span style={{ color: palette.muted }}>"你好世界"</span> →{' '}
                <span style={{ color: palette.accent }}>["你", "好", "世", "界"]</span> = 4 tokens
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card delay={0.3} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.warn, letterSpacing: '0.1em' }}>
              计费模型
            </div>
            {[
              { model: 'GPT-4o', input: '$2.50', output: '$10.00', unit: '/1M tokens' },
              { model: 'Claude 3.5', input: '$3.00', output: '$15.00', unit: '/1M tokens' },
              { model: 'DeepSeek V3', input: '$0.27', output: '$1.10', unit: '/1M tokens' },
            ].map((m) => (
              <div
                key={m.model}
                style={{
                  padding: '16px 20px',
                  background: palette.surfaceHi,
                  borderRadius: 10,
                  border: `1px solid ${palette.border}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 24, fontWeight: 600 }}>{m.model}</span>
                  <span style={{ fontFamily: font.mono, fontSize: 16, color: palette.muted }}>{m.unit}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 24,
                    marginTop: 8,
                    fontFamily: font.mono,
                    fontSize: 20,
                  }}
                >
                  <span style={{ color: palette.accent2 }}>Input: {m.input}</span>
                  <span style={{ color: palette.warn }}>Output: {m.output}</span>
                </div>
              </div>
            ))}
          </Card>

          <Card delay={0.4}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontSize: 24,
                color: palette.textSoft,
              }}
            >
              <span style={{ fontSize: 32 }}>💡</span>
              <span>中文大约 1 个字 ≈ 1-2 个 Token，英文大约 1 个词 ≈ 1-1.5 个 Token</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
    <PageNum num={7} />
  </div>
);

// ─── Slide 8: LLM Limitations ────────────────────────────────────────────────
const LLMLimits: Page = () => {
  const limits = [
    { icon: '📅', title: '知识截止', desc: '训练数据有截止日期，无法获取实时信息' },
    { icon: '🔢', title: '数学薄弱', desc: '复杂计算和精确数学运算容易出错' },
    { icon: '🎭', title: '幻觉问题', desc: '可能生成看似合理但完全错误的内容' },
    { icon: '📏', title: '上下文限制', desc: 'Token 窗口有限，长文本会丢失信息' },
    { icon: '🔌', title: '无法行动', desc: '只能生成文本，不能直接操作外部系统' },
  ];

  return (
    <div style={fill}>
      <Styles />
      <GridBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '100px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        <div className="fadeUp">
          <Eyebrow>06 / LLM Limitations</Eyebrow>
          <SectionTitle>LLM 的五大局限</SectionTitle>
          <p
            className="fadeUp"
            style={{
              marginTop: 16,
              fontSize: 'var(--osd-size-body)',
              color: palette.textSoft,
              animationDelay: '0.15s',
            }}
          >
            正是这些局限，催生了 Agent 的诞生。
          </p>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            justifyContent: 'center',
          }}
        >
          {limits.map((l, i) => (
            <div
              key={l.title}
              className="fadeUp"
              style={{
                animationDelay: `${0.2 + i * 0.1}s`,
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                padding: '24px 36px',
                background: palette.surface,
                border: `1px solid ${palette.border}`,
                borderRadius: 16,
              }}
            >
              <div style={{ fontSize: 44, flexShrink: 0 }}>{l.icon}</div>
              <div
                style={{
                  fontFamily: font.mono,
                  fontSize: 22,
                  color: palette.error,
                  fontWeight: 600,
                  width: 40,
                  flexShrink: 0,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 30, fontWeight: 600, marginBottom: 4 }}>{l.title}</div>
                <div style={{ fontSize: 24, color: palette.muted }}>{l.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <PageNum num={8} />
    </div>
  );
};

// ─── Slide 9: Perception ─────────────────────────────────────────────────────
const Perception: Page = () => {
  const methods = [
    { title: '文本输入', desc: '用户自然语言指令', icon: '📝' },
    { title: '文件读取', desc: '解析文档、代码、数据', icon: '📄' },
    { title: 'API 调用', desc: '获取外部系统数据', icon: '🌐' },
    { title: '视觉感知', desc: '图片、截图理解', icon: '👁' },
    { title: '环境反馈', desc: '工具执行结果回调', icon: '🔄' },
  ];

  return (
    <div style={fill}>
      <Styles />
      <GridBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '100px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        <div className="fadeUp">
          <Eyebrow>07 / Perception</Eyebrow>
          <SectionTitle>感知：Agent 的眼睛和耳朵</SectionTitle>
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 24,
            minHeight: 0,
            alignItems: 'center',
          }}
        >
          {methods.map((m, i) => (
            <Card
              key={m.title}
              delay={0.15 + i * 0.1}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                textAlign: 'center',
                padding: '40px 20px',
                minHeight: 280,
              }}
            >
              <div style={{ fontSize: 64 }}>{m.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{m.title}</div>
              <div style={{ fontSize: 22, color: palette.muted, lineHeight: 1.4 }}>{m.desc}</div>
            </Card>
          ))}
        </div>

        <Card delay={0.7} style={{ borderColor: `${palette.accent}30` }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              fontSize: 26,
              color: palette.textSoft,
            }}
          >
            <Badge>关键</Badge>
            <span>
              感知质量直接决定 Agent 的决策质量 ——{' '}
              <span style={{ color: palette.accent }}>Garbage in, Garbage out</span>
            </span>
          </div>
        </Card>
      </div>
      <PageNum num={9} />
    </div>
  );
};

// ─── Slide 10: Action (Function Calling) ─────────────────────────────────────
const Action: Page = () => (
  <div style={fill}>
    <Styles />
    <GridBg />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '100px 140px',
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      <div className="fadeUp">
        <Eyebrow>08 / Action</Eyebrow>
        <SectionTitle>行动：Function Calling</SectionTitle>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 40,
          minHeight: 0,
        }}
      >
        <Card delay={0.2} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.accent, letterSpacing: '0.1em' }}>
            工作流程
          </div>
          {[
            { step: '1', label: 'LLM 分析意图', desc: '判断需要调用哪个工具' },
            { step: '2', label: '生成结构化调用', desc: '输出 JSON 格式的参数' },
            { step: '3', label: '执行工具', desc: '系统执行函数并获取结果' },
            { step: '4', label: '返回结果', desc: '将结果反馈给 LLM 继续推理' },
          ].map((s) => (
            <div
              key={s.step}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                background: palette.surfaceHi,
                borderRadius: 10,
                border: `1px solid ${palette.border}`,
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: `${palette.accent}22`,
                  border: `1px solid ${palette.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: font.mono,
                  fontSize: 18,
                  color: palette.accent,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {s.step}
              </span>
              <div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 20, color: palette.muted }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </Card>

        <Card delay={0.3} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.accent2, letterSpacing: '0.1em' }}>
            代码示例
          </div>
          <div
            style={{
              flex: 1,
              padding: '24px',
              background: palette.bg,
              borderRadius: 12,
              fontFamily: font.mono,
              fontSize: 20,
              lineHeight: 1.7,
              color: palette.textSoft,
              overflow: 'hidden',
            }}
          >
            <div style={{ color: palette.muted }}>{'// Function Calling 示例'}</div>
            <div>
              <span style={{ color: palette.accent2 }}>tools</span>: [
            </div>
            <div style={{ paddingLeft: 20 }}>
              {'{'}
            </div>
            <div style={{ paddingLeft: 40 }}>
              <span style={{ color: palette.warn }}>name</span>: <span style={{ color: palette.success }}>"get_weather"</span>,
            </div>
            <div style={{ paddingLeft: 40 }}>
              <span style={{ color: palette.warn }}>parameters</span>: {'{'}
            </div>
            <div style={{ paddingLeft: 60 }}>
              <span style={{ color: palette.warn }}>city</span>: {'{'} <span style={{ color: palette.accent2 }}>type</span>: <span style={{ color: palette.success }}>"string"</span> {'}'},
            </div>
            <div style={{ paddingLeft: 40 }}>{'}'}</div>
            <div style={{ paddingLeft: 20 }}>{'}'}</div>
            <div>]</div>
            <div style={{ height: 16 }} />
            <div style={{ color: palette.muted }}>{'// LLM 返回:'}</div>
            <div>
              {'{'} <span style={{ color: palette.warn }}>tool</span>: <span style={{ color: palette.success }}>"get_weather"</span>,
            </div>
            <div style={{ paddingLeft: 20 }}>
              <span style={{ color: palette.warn }}>args</span>: {'{'} <span style={{ color: palette.success }}>"city"</span>: <span style={{ color: palette.success }}>"北京"</span> {'}'}
            </div>
            <div>{'}'}</div>
          </div>
        </Card>
      </div>
    </div>
    <PageNum num={10} />
  </div>
);

// ─── Slide 11: Memory ────────────────────────────────────────────────────────
const Memory: Page = () => {
  const types = [
    {
      title: '短期记忆',
      sub: 'Working Memory',
      desc: '当前对话上下文，存在 Token 窗口限制内',
      items: ['对话历史', '当前任务状态', '中间推理结果'],
      color: palette.accent2,
    },
    {
      title: '长期记忆',
      sub: 'Long-term Memory',
      desc: '持久化存储的知识，跨会话保留',
      items: ['用户偏好', '历史经验', '知识库'],
      color: palette.accent,
    },
    {
      title: '向量记忆',
      sub: 'Vector Store',
      desc: '通过 Embedding 实现语义检索',
      items: ['RAG 检索', '相似度匹配', '文档索引'],
      color: palette.warn,
    },
  ];

  return (
    <div style={fill}>
      <Styles />
      <GridBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '100px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        <div className="fadeUp">
          <Eyebrow>09 / Memory</Eyebrow>
          <SectionTitle>记忆：Agent 的大脑</SectionTitle>
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 32,
            minHeight: 0,
          }}
        >
          {types.map((t, i) => (
            <Card
              key={t.title}
              delay={0.15 + i * 0.12}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                borderColor: `${t.color}30`,
              }}
            >
              <div
                style={{
                  fontFamily: font.mono,
                  fontSize: 18,
                  color: t.color,
                  letterSpacing: '0.1em',
                }}
              >
                {t.sub}
              </div>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{t.title}</div>
              <div style={{ fontSize: 24, color: palette.muted, lineHeight: 1.5 }}>{t.desc}</div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {t.items.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 16px',
                      background: palette.surfaceHi,
                      borderRadius: 8,
                      fontSize: 22,
                      color: palette.textSoft,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: t.color,
                        flexShrink: 0,
                      }}
                    />
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <PageNum num={11} />
    </div>
  );
};

// ─── Slide 12: Agent Loop ────────────────────────────────────────────────────
const AgentLoop: Page = () => (
  <div style={fill}>
    <Styles />
    <GridBg />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '100px 140px',
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      <div className="fadeUp">
        <Eyebrow>10 / Agent Loop</Eyebrow>
        <SectionTitle>Agent Loop：核心循环</SectionTitle>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: 40,
          minHeight: 0,
        }}
      >
        <Card delay={0.2} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.accent, letterSpacing: '0.1em', marginBottom: 8 }}>
            伪代码
          </div>
          <div
            style={{
              flex: 1,
              padding: '24px',
              background: palette.bg,
              borderRadius: 12,
              fontFamily: font.mono,
              fontSize: 22,
              lineHeight: 1.8,
              color: palette.textSoft,
            }}
          >
            <div>
              <span style={{ color: palette.accent2 }}>while</span> (!task_complete) {'{'}
            </div>
            <div style={{ paddingLeft: 24 }}>
              <span style={{ color: palette.muted }}>{'// 感知'}</span>
            </div>
            <div style={{ paddingLeft: 24 }}>
              context = <span style={{ color: palette.warn }}>perceive</span>(env)
            </div>
            <div style={{ height: 8 }} />
            <div style={{ paddingLeft: 24 }}>
              <span style={{ color: palette.muted }}>{'// 思考'}</span>
            </div>
            <div style={{ paddingLeft: 24 }}>
              plan = <span style={{ color: palette.warn }}>llm.think</span>(context)
            </div>
            <div style={{ height: 8 }} />
            <div style={{ paddingLeft: 24 }}>
              <span style={{ color: palette.muted }}>{'// 行动'}</span>
            </div>
            <div style={{ paddingLeft: 24 }}>
              result = <span style={{ color: palette.warn }}>execute</span>(plan)
            </div>
            <div style={{ height: 8 }} />
            <div style={{ paddingLeft: 24 }}>
              <span style={{ color: palette.muted }}>{'// 反思'}</span>
            </div>
            <div style={{ paddingLeft: 24 }}>
              <span style={{ color: palette.warn }}>reflect</span>(result)
            </div>
            <div>{'}'}</div>
          </div>
        </Card>

        <div
          className="fadeUp"
          style={{
            animationDelay: '0.3s',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 0,
          }}
        >
          {[
            { label: '感知 Perceive', desc: '收集环境信息，更新上下文', color: palette.accent2 },
            { label: '思考 Think', desc: 'LLM 分析当前状态，制定计划', color: palette.accent },
            { label: '行动 Act', desc: '调用工具执行具体操作', color: palette.warn },
            { label: '反思 Reflect', desc: '评估结果，决定是否继续', color: palette.error },
          ].map((step, i) => (
            <div
              key={step.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '28px 32px',
                position: 'relative',
              }}
            >
              {i < 3 && (
                <div
                  style={{
                    position: 'absolute',
                    left: 51,
                    top: '70%',
                    width: 2,
                    height: '60%',
                    background: palette.border,
                  }}
                />
              )}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: `${step.color}22`,
                  border: `2px solid ${step.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: font.mono,
                  fontSize: 20,
                  color: step.color,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 30, fontWeight: 600, marginBottom: 4 }}>{step.label}</div>
                <div style={{ fontSize: 24, color: palette.muted }}>{step.desc}</div>
              </div>
            </div>
          ))}
          <div
            style={{
              marginTop: 16,
              padding: '16px 32px',
              textAlign: 'center',
              fontFamily: font.mono,
              fontSize: 22,
              color: palette.accent,
              border: `1px dashed ${palette.accent}40`,
              borderRadius: 12,
            }}
          >
            ↻ 循环直到任务完成或达到最大迭代次数
          </div>
        </div>
      </div>
    </div>
    <PageNum num={12} />
  </div>
);

// ─── Slide 13: MCP ───────────────────────────────────────────────────────────
const MCP: Page = () => (
  <div style={fill}>
    <Styles />
    <GridBg />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '100px 140px',
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      <div className="fadeUp">
        <Eyebrow>11 / MCP Protocol</Eyebrow>
        <SectionTitle>MCP：AI 世界的 USB-C</SectionTitle>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 40,
          minHeight: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card delay={0.2} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.accent, letterSpacing: '0.1em' }}>
              Model Context Protocol
            </div>
            <div style={{ fontSize: 26, color: palette.textSoft, lineHeight: 1.6 }}>
              由 Anthropic 提出的开放协议，为 AI 模型提供统一的外部工具和数据源接入标准。
            </div>
            <div
              style={{
                padding: '20px 24px',
                background: palette.bg,
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {[
                { label: 'Tools', desc: '可调用的函数' },
                { label: 'Resources', desc: '可读取的数据' },
                { label: 'Prompts', desc: '预定义的提示模板' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    fontSize: 24,
                  }}
                >
                  <Badge>{item.label}</Badge>
                  <span style={{ color: palette.muted }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card delay={0.3} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontFamily: font.mono, fontSize: 20, color: palette.accent2, letterSpacing: '0.1em' }}>
            USB-C 类比
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 24,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: 20,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  padding: '24px',
                  background: palette.surfaceHi,
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 8 }}>🔌</div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>AI 模型</div>
                <div style={{ fontSize: 18, color: palette.muted }}>Claude / GPT</div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 3,
                    background: `linear-gradient(90deg, ${palette.accent2}, ${palette.accent})`,
                    borderRadius: 2,
                  }}
                />
                <div
                  style={{
                    fontFamily: font.mono,
                    fontSize: 16,
                    color: palette.accent,
                    fontWeight: 600,
                  }}
                >
                  MCP
                </div>
                <div
                  style={{
                    width: 80,
                    height: 3,
                    background: `linear-gradient(90deg, ${palette.accent}, ${palette.accent2})`,
                    borderRadius: 2,
                  }}
                />
              </div>
              <div
                style={{
                  padding: '24px',
                  background: palette.surfaceHi,
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 8 }}>🛠</div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>外部工具</div>
                <div style={{ fontSize: 18, color: palette.muted }}>DB / API / FS</div>
              </div>
            </div>
            <div
              style={{
                padding: '16px 24px',
                background: `${palette.accent}11`,
                border: `1px solid ${palette.accent}30`,
                borderRadius: 12,
                fontSize: 24,
                color: palette.textSoft,
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              一个协议，连接所有 —— 就像 USB-C 统一了充电接口
            </div>
          </div>
        </Card>
      </div>
    </div>
    <PageNum num={13} />
  </div>
);

// ─── Slide 14: Coding Tools ──────────────────────────────────────────────────
const CodingTools: Page = () => {
  const tools = [
    {
      name: 'GitHub Copilot',
      type: '代码补全',
      pros: '集成度高，VS Code 原生',
      model: 'GPT-4 / Codex',
      color: palette.accent2,
    },
    {
      name: 'Cursor',
      type: 'AI IDE',
      pros: 'Agent 模式，全项目理解',
      model: '多模型支持',
      color: palette.accent,
    },
    {
      name: 'Windsurf',
      type: 'AI IDE',
      pros: 'Cascade 流式编辑',
      model: '自研 + Claude',
      color: palette.warn,
    },
    {
      name: 'Claude Code',
      type: 'CLI Agent',
      pros: '终端原生，深度代码理解',
      model: 'Claude 3.5/4',
      color: palette.success,
    },
  ];

  return (
    <div style={fill}>
      <Styles />
      <GridBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '100px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        <div className="fadeUp">
          <Eyebrow>12 / Coding Tools</Eyebrow>
          <SectionTitle>智能编程工具对比</SectionTitle>
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 24,
            minHeight: 0,
            alignItems: 'center',
          }}
        >
          {tools.map((t, i) => (
            <Card
              key={t.name}
              delay={0.15 + i * 0.1}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                borderColor: `${t.color}30`,
                padding: '32px 28px',
              }}
            >
              <Badge color={t.color}>{t.type}</Badge>
              <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{t.name}</div>
              <div style={{ fontSize: 22, color: palette.muted, lineHeight: 1.5 }}>{t.pros}</div>
              <div style={{ flex: 1 }} />
              <div
                style={{
                  fontFamily: font.mono,
                  fontSize: 18,
                  color: palette.dim,
                  paddingTop: 12,
                  borderTop: `1px solid ${palette.border}`,
                }}
              >
                {t.model}
              </div>
            </Card>
          ))}
        </div>

        <Card delay={0.6} style={{ borderColor: `${palette.accent}30` }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 26,
            }}
          >
            <span style={{ color: palette.textSoft }}>
              趋势：从代码补全 → AI IDE → <span style={{ color: palette.accent, fontWeight: 600 }}>Agent 自主编程</span>
            </span>
            <Badge>2025 趋势</Badge>
          </div>
        </Card>
      </div>
      <PageNum num={14} />
    </div>
  );
};

// ─── Slide 15: Summary ───────────────────────────────────────────────────────
const Summary: Page = () => {
  const takeaways = [
    { num: '01', text: 'LLM 是 Agent 的大脑，理解 Token 和上下文是关键' },
    { num: '02', text: 'Agent = 感知 + 推理 + 行动 + 记忆 的闭环系统' },
    { num: '03', text: 'Function Calling 让 LLM 从文本生成走向实际行动' },
    { num: '04', text: 'MCP 协议统一了 AI 与外部工具的连接标准' },
    { num: '05', text: '智能编程工具正在从辅助走向自主，改变开发范式' },
  ];

  return (
    <div style={fill}>
      <Styles />
      <GridBg />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '120px 140px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <Eyebrow className="fadeUp">Summary</Eyebrow>
          <h2
            className="fadeUp"
            style={{
              fontFamily: 'var(--osd-font-display)',
              fontSize: 'var(--osd-size-display)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1.0,
              margin: 0,
              marginTop: 16,
              animationDelay: '0.1s',
            }}
          >
            核心
            <span
              style={{
                background: `linear-gradient(90deg, ${palette.accentSoft}, var(--osd-accent))`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              要点回顾
            </span>
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {takeaways.map((t, i) => (
            <div
              key={t.num}
              className="fadeUp"
              style={{
                animationDelay: `${0.2 + i * 0.1}s`,
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '22px 32px',
                background: palette.surface,
                border: `1px solid ${palette.border}`,
                borderRadius: 16,
              }}
            >
              <span
                style={{
                  fontFamily: font.mono,
                  fontSize: 24,
                  color: palette.accent,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {t.num}
              </span>
              <span style={{ fontSize: 28, color: palette.textSoft }}>{t.text}</span>
            </div>
          ))}
        </div>

        <div
          className="fadeUp"
          style={{
            animationDelay: '0.7s',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: font.mono,
            fontSize: 22,
            color: palette.muted,
          }}
        >
          <span>
            <span style={{ color: palette.accent }}>Next Step:</span> 动手构建你的第一个 Agent
          </span>
          <span>Thank you</span>
        </div>
      </div>
      <PageNum num={15} />
    </div>
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const meta: SlideMeta = {
  title: 'AI Agent 开发与智能编程工具实战',
};

export default [
  Cover,
  Agenda,
  WhyAgent,
  WhatIsAgent,
  Architecture,
  LLM,
  Token,
  LLMLimits,
  Perception,
  Action,
  Memory,
  AgentLoop,
  MCP,
  CodingTools,
  Summary,
] satisfies Page[];
