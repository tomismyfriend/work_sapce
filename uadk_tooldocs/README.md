# UADK Tool 文档索引

本目录包含 UADK Tool 的完整技术文档，涵盖架构解析、使用指南、性能测试等内容。

---

## 一、文档导航

### 1.1 快速入门

| 文档 | 说明 | 适用场景 |
|------|------|----------|
| [uadk_tool_quick_reference.md](uadk_tool_quick_reference.md) | **指令速查表** | 日常使用、命令查阅 |
| [uadk_tool_architecture.md](uadk_tool_architecture.md) | **架构分析** | 深入理解、二次开发 |

### 1.2 官方文档

| 文档 | 说明 |
|------|------|
| [ReleaseNotes.md](ReleaseNotes.md) | 版本发布说明 |
| [wd_design.md](wd_design.md) | UADK 框架设计文档 |
| [wd_alg_init2.md](wd_alg_init2.md) | init2 接口说明 |
| [wd_environment_variable](wd_environment_variable) | 环境变量配置 |
| [perf.rst](perf.rst) | 性能测试指南 |
| [sanity_test.md](sanity_test.md) | 正确性测试说明 |
| [maintenance.md](maintenance.md) | 维护指南 |

---

## 二、UADK Tool 快速概览

### 2.1 工具定位

UADK Tool 是华为 Kunpeng 硬件加速器的用户态测试工具，用于：
- **性能测试** (benchmark)：评估加速器吞吐量、延迟、CPU 占用
- **正确性测试** (test)：验证算法实现正确性
- **诊断调试** (dfx)：查看版本、环境、设备状态

### 2.2 命令结构

```
uadk_tool <子命令> [参数]

子命令:
  dfx       - 诊断/调试信息
  benchmark - 性能测试
  test      - 正确性测试
```

### 2.3 加速器类型

| 加速器 | 算法类别 | 典型算法 |
|--------|----------|----------|
| SEC | 对称加密、摘要、AEAD | AES, SM4, SHA, SM3 |
| HPRE | 非对称加密、签名 | RSA, DH, ECDSA, SM2 |
| ZIP | 数据压缩 | zlib, gzip, lz4 |

---

## 三、常用命令速查

### 3.1 性能测试

```bash
# SEC AES 加密
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --pktlen 1024 --seconds 10 --thread 4

# HPRE RSA 签名
uadk_tool benchmark --alg rsa-2048 --mode sva --opt 4 --sync --seconds 10

# ZIP 压缩
uadk_tool benchmark --alg gzip --mode sva --opt 0 --sync --pktlen 16384

# 查看支持的算法列表
uadk_tool benchmark --alglist
```

### 3.2 诊断调试

```bash
# 查看版本
uadk_tool dfx --version

# 查看 SEC 环境变量
uadk_tool dfx --env sec

# 查看设备利用率
uadk_tool dfx --usage --device hisi_sec2-0 --alg cipher --op_type 0

# 查看上下文计数
uadk_tool dfx --count
```

### 3.3 正确性测试

```bash
uadk_tool test --m sec    # SEC 测试
uadk_tool test --m hpre   # HPRE 测试
uadk_tool test --m zip    # ZIP 测试
```

---

## 四、文档详细说明

### 4.1 uadk_tool_architecture.md - 架构分析

**内容概要**：
- 整体架构图（入口 → 子模块 → 加速器 → 硬件）
- 三大模块详解（dfx / benchmark / test）
- 核心数据结构 `struct acc_option`
- 运行模式说明（sva / nosva / soft / instr）
- 支持的完整算法列表
- 操作类型详解
- 典型使用示例

**适合人群**：需要深入理解工具内部机制的开发者

### 4.2 uadk_tool_quick_reference.md - 指令速查

**内容概要**：
- 基本语法和必选参数
- 可选参数完整列表
- 常用命令模板（按加速器分类）
- 算法名称速查表
- 操作类型速查表
- 模式速查表
- 快速诊断命令

**适合人群**：日常使用工具进行测试的用户

---

## 五、环境配置

### 5.1 设备检查

```bash
# 查看 uacce 设备
ls /dev/uacce/

# 查看设备属性
cat /sys/class/uacce/hisi_sec2-0/device/attrs

# 检查内核模块
lsmod | grep hisi
```

### 5.2 环境变量

```bash
# 设置上下文数量
export WD_CIPHER_CTX_NUM=8
export WD_DIGEST_CTX_NUM=4

# 设置 epoll 模式
export WD_CIPHER_EPOLL_EN=1
```

详细说明见 [wd_environment_variable](wd_environment_variable)。

---

## 六、性能指标解读

benchmark 输出示例：

```
algname:        length:         perf:           iops:           CPU_rate:
aes-128-cbc     1024Bytes       1234.56KiB/s    123.4Kops       15.23%
```

| 指标 | 说明 |
|------|------|
| perf | 吞吐量（KiB/s），越高越好 |
| iops | 每秒操作数（Kops），越高越好 |
| CPU_rate | CPU 占用率，越低越好（硬件加速优势） |

---

## 七、进阶阅读

- **框架设计**：[wd_design.md](wd_design.md) - 理解 UADK 整体架构
- **init2 接口**：[wd_alg_init2.md](wd_alg_init2.md) - 新版初始化方式
- **性能测试**：[perf.rst](perf.rst) - 详细性能测试方法
- **正确性测试**：[sanity_test.md](sanity_test.md) - 测试用例说明

---

## 八、常见问题

**Q: SVA 模式和 No-SVA 模式有什么区别？**

A: SVA 模式需要硬件支持虚拟化地址，可以直接使用用户态地址；No-SVA 模式需要手动 DMA 映射。SVA 性能更好，但需要硬件支持。

**Q: 如何选择 ctxnum 参数？**

A: ctxnum 决定队列对（QP）数量，影响并发能力。一般建议与 thread 数量匹配或略大，如 `--thread 4 --ctxnum 8`。

**Q: prefetch 什么时候使用？**

A: prefetch 在 SVA 模式下可以减少缺页异常，提升性能。建议在长时测试或大数据包测试时启用。

---

> 文档编写日期：2026/04/14
> 基于代码仓库：uadk-official（官方版本）