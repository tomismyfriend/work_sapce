# UADK Tool 架构分析

基于官方代码仓库 `uadk-official/uadk_tool` 进行架构解析。

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              uadk_tool                                       │
│                           (统一工具入口)                                     │
│                              uadk_tool.c                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│     dfx 模块    │   │  benchmark 模块 │   │    test 模块    │
│  (诊断/调试)    │   │   (性能测试)    │   │  (正确性测试)   │
│  uadk_dfx.c     │   │ uadk_benchmark.c│   │   uadk_test.c   │
└─────────────────┘   └─────────────────┘   └─────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   SEC 加密模块   │   │  HPRE 公钥模块  │   │   ZIP 压缩模块  │
│ sec_*_benchmark │   │hpre_*_benchmark │   │zip_*_benchmark  │
│     (对称加密)   │   │   (非对称加密)  │   │    (数据压缩)   │
│     (哈希摘要)   │   │                 │   │                 │
│     (AEAD认证)   │   │                 │   │                 │
└─────────────────┘   └─────────────────┘   └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UADK 核心库 (libwd)                               │
│                                                                             │
│   wd.c            - 基础初始化                                              │
│   wd_cipher.c     - 对称加密                                                │
│   wd_digest.c     - 哈希摘要                                                │
│   wd_aead.c       - AEAD认证加密                                            │
│   wd_rsa.c        - RSA算法                                                 │
│   wd_dh.c         - DH算法                                                  │
│   wd_ecc.c        - ECC算法                                                 │
│   wd_comp.c       - 数据压缩                                                │
│   wd_sched.c      - 任务调度                                                │
│   wd_util.c       - 工具函数                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         硬件加速器 (通过 uacce)                             │
│                                                                             │
│   hisi_sec2  - SEC 加密引擎                                                 │
│   hisi_hpre  - HPRE 公钥引擎                                                │
│   hisi_zip   - ZIP 压缩引擎                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、模块详解

### 2.1 主入口 (uadk_tool.c)

**功能**：统一工具入口，解析命令参数，分发到对应子模块。

**代码结构**：
```c
int main(int argc, char **argv)
{
    if (!strcmp("dfx", argv[index]))
        dfx_cmd_parse(argc, argv);       // → dfx 模块
    else if (!strcmp("benchmark", argv[index]))
        acc_benchmark_run(&option);      // → benchmark 模块
    else if (!strcmp("test", argv[index]))
        acc_test_run(argc, argv);        // → test 模块
    else
        print_tool_help();
}
```

---

### 2.2 dfx 模块 (诊断/调试)

**功能**：显示库信息、环境变量、设备使用率等诊断数据。

**子命令**：

| 命令 | 功能 | 说明 |
|------|------|------|
| `--version` | 显示库版本 | 调用 `wd_get_version()` |
| `--dir` | 显示可执行路径 | 调用 `readlink("/proc/self/exe")` |
| `--env <module>` | 显示环境变量 | 显示 sec/hpre/zip 的环境配置 |
| `--count` | 显示上下文计数 | 从共享内存读取 ctx 计数 |
| `--usage` | 显示设备利用率 | 调用 `wd_get_dev_usage()` |

**环境变量映射**：

```c
// sec 模块
WD_CIPHER_CTX_NUM, WD_CIPHER_EPOLL_EN
WD_AEAD_CTX_NUM,   WD_AEAD_EPOLL_EN
WD_DIGEST_CTX_NUM, WD_DIGEST_EPOLL_EN

// hpre 模块
WD_DH_CTX_NUM, WD_DH_EPOLL_EN
WD_RSA_CTX_NUM, WD_RSA_EPOLL_EN
WD_ECC_CTX_NUM, WD_ECC_EPOLL_EN

// zip 模块
WD_COMP_CTX_NUM, WD_COMP_EPOLL_EN
```

---

### 2.3 benchmark 模块 (性能测试)

**功能**：测试 UADK 加速器的性能，支持多算法、多模式、多线程。

#### 核心数据结构

```c
struct acc_option {
    char algname[64];      // 算法名称，如 aes-128-cbc
    char algclass[64];     // 算法类别，如 cipher/digest/aead
    u32  algtype;          // 算法枚举值
    u32  modetype;         // 运行模式：SVA/NOSVA/SOFT/INSTR
    u32  optype;           // 操作类型：加密/解密/签名/验签等
    u32  syncmode;         // 同步/异步模式
    u32  pktlen;           // 数据包长度
    u32  times;            // 测试时长（秒）
    u32  threads;          // 线程数
    u32  multis;           // 进程数
    u32  ctxnums;          // 上下文数量（QP数量）
    u32  prefetch;         // 是否预取（减少缺页）
    u32  latency;          // 是否测试延迟
    char device[64];       // 设备名称
};
```

#### 运行模式

| 模式 | 说明 | 接口层 |
|------|------|--------|
| `sva` | SVA 模式（硬件支持虚拟化） | UADK API (`wd_*`) |
| `nosva` | No-SVA 模式（传统 DMA） | Warpdrive API |
| `soft` | 纯软件模式（OpenSSL） | OpenSSL ENGINE |
| `instr` | 指令模式（CPU指令加速） | UADK 指令接口 |
| `multibuff` | 多缓冲模式 | 特殊优化模式 |

#### 加速器类型

| 类型 | 枚举 | 支持算法 |
|------|------|----------|
| SEC | `SEC_TYPE` | AES, SM4, DES3, SHA, SM3, MD5, AEAD |
| HPRE | `HPRE_TYPE` | RSA, DH, ECDH, ECDSA, SM2, X25519, X448 |
| ZIP | `ZIP_TYPE` | zlib, gzip, deflate, lz77_zstd, lz4 |

#### benchmark 调用链

```
acc_benchmark_run(option)
    │
    ├─ parse_alg_param(option)     // 解析算法参数，确定 acctype/subtype
    │
    └─ benchmark_run(option)
        │
        ├─ SEC_TYPE:
        │   ├─ SVA_MODE  → sec_uadk_benchmark(option)
        │   ├─ NOSVA_MODE → sec_wd_benchmark(option)
        │   └─ SOFT_MODE  → sec_soft_benchmark(option)
        │
        ├─ HPRE_TYPE:
        │   ├─ SVA_MODE  → hpre_uadk_benchmark(option)
        │   └─ NOSVA_MODE → hpre_wd_benchmark(option)
        │
        └─ ZIP_TYPE:
            ├─ SVA_MODE  → zip_uadk_benchmark(option)
            └─ NOSVA_MODE → zip_wd_benchmark(option)
```

---

### 2.4 test 模块 (正确性测试)

**功能**：验证加速器算法的正确性。

**子模块**：

| 命令 | 功能 |
|------|------|
| `--m hpre` | HPRE 公钥算法正确性测试 |
| `--m sec` | SEC 加密算法正确性测试 |
| `--m zip` | ZIP 压缩算法正确性测试 |

---

## 三、命令行参数详解

### 3.1 benchmark 命令参数

```bash
uadk_tool benchmark [参数]
```

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `--alg <name>` | 必选 | 算法名称 | `--alg aes-128-cbc` |
| `--mode <type>` | 必选 | 运行模式 | `--mode sva` |
| `--sync` | 可选 | 同步模式 | `--sync` |
| `--async` | 可选 | 异步模式 | `--async` |
| `--opt <n>` | 可选 | 操作类型 | `--opt 0` (加密) |
| `--pktlen <n>` | 可选 | 数据长度 | `--pktlen 1024` |
| `--seconds <n>` | 可选 | 测试时长 | `--seconds 10` |
| `--thread <n>` | 可选 | 线程数 | `--thread 4` |
| `--multi <n>` | 可选 | 进程数 | `--multi 2` |
| `--ctxnum <n>` | 可选 | 上下文数 | `--ctxnum 8` |
| `--prefetch` | 可选 | 启用预取 | `--prefetch` |
| `--latency` | 可选 | 测试延迟 | `--latency` |
| `--device <name>` | 可选 | 指定设备 | `--device hisi_sec2-0` |
| `--engine <name>` | 可选 | OpenSSL引擎 | `--engine uadk_engine` |
| `--init2` | 可选 | 使用init2接口 | `--init2` |
| `--alglist` | 可选 | 列出所有算法 | `--alglist` |
| `--help` | 可选 | 显示帮助 | `--help` |

### 3.2 dfx 命令参数

```bash
uadk_tool dfx [参数]
```

| 参数 | 说明 | 示例 |
|------|------|------|
| `--version` | 显示库版本 | `uadk_tool dfx --version` |
| `--dir` | 显示路径 | `uadk_tool dfx --dir` |
| `--env <module>` | 显示环境变量 | `uadk_tool dfx --env sec` |
| `--count` | 显示ctx计数 | `uadk_tool dfx --count` |
| `--usage` | 显示利用率 | `uadk_tool dfx --usage --device hisi_sec2-0 --alg cipher --op_type 0` |

### 3.3 test 命令参数

```bash
uadk_tool test --m <module>
```

| 参数 | 说明 | 示例 |
|------|------|------|
| `--m hpre` | HPRE测试 | `uadk_tool test --m hpre` |
| `--m sec` | SEC测试 | `uadk_tool test --m sec` |
| `--m zip` | ZIP测试 | `uadk_tool test --m zip` |

---

## 四、操作类型详解 (optype)

### 4.1 SEC 操作类型

| optype | 操作 | 说明 |
|--------|------|------|
| 0 | encryption | 加密 |
| 1 | decryption | 解密 |

**Digest/AEAD 特殊**：
| optype | 操作 |
|--------|------|
| 0 | normal |
| 1 | hmac |

### 4.2 HPRE 操作类型

| optype | 操作 | 说明 |
|--------|------|------|
| 0 | keygen | 密钥生成 |
| 1 | key compute | 密钥计算 |
| 2 | Enc | 加密 |
| 3 | Dec | 解密 |
| 4 | Sign | 签名 |
| 5 | Verify | 验签 |

### 4.3 ZIP 操作类型

| optype | 操作 | 说明 |
|--------|------|------|
| 0 | block compression | 块压缩 |
| 1 | block decompression | 块解压 |
| 2 | stream compression | 流压缩 |
| 3 | stream decompression | 流解压 |

---

## 五、支持的算法列表

### 5.1 SEC 算法

#### Cipher (对称加密)

| 算法 | 名称 |
|------|------|
| AES-ECB | aes-128-ecb, aes-192-ecb, aes-256-ecb |
| AES-CBC | aes-128-cbc, aes-192-cbc, aes-256-cbc |
| AES-CBC-CS | aes-128-cbc-cs1/cs2/cs3, aes-192-..., aes-256-... |
| AES-CTR | aes-128-ctr, aes-192-ctr, aes-256-ctr |
| AES-OFB | aes-128-ofb, aes-192-ofb, aes-256-ofb |
| AES-CFB | aes-128-cfb, aes-192-cfb, aes-256-cfb |
| AES-XTS | aes-256-xts, aes-512-xts |
| DES3 | 3des-128-ecb, 3des-192-ecb, 3des-128-cbc, 3des-192-cbc |
| SM4 | sm4-128-ecb, sm4-128-cbc, sm4-128-ctr, sm4-128-xts 等 |

#### AEAD (认证加密)

| 算法 | 名称 |
|------|------|
| AES-CCM | aes-128-ccm, aes-192-ccm, aes-256-ccm |
| AES-GCM | aes-128-gcm, aes-192-gcm, aes-256-gcm |
| SM4-CCM | sm4-128-ccm |
| SM4-GCM | sm4-128-gcm |
| 组合模式 | aes-128-cbc-sha256-hmac, sm4-cbc-sm3-hmac 等 |

#### Digest (哈希摘要)

| 算法 | 名称 |
|------|------|
| SM3 | sm3 |
| MD5 | md5 |
| SHA1 | sha1 |
| SHA2 | sha224, sha256, sha384, sha512 |
| SHA3 | sha512-224, sha512-256 |

### 5.2 HPRE 算法

| 类型 | 算法 |
|------|------|
| RSA | rsa-1024, rsa-2048, rsa-3072, rsa-4096 |
| RSA-CRT | rsa-1024-crt, rsa-2048-crt, rsa-3072-crt, rsa-4096-crt |
| DH | dh-768, dh-1024, dh-1536, dh-2048, dh-3072, dh-4096 |
| ECDH | ecdh-256, ecdh-384, ecdh-521 |
| ECDSA | ecdsa-256, ecdsa-384, ecdsa-521 |
| SM2 | sm2 |
| X25519 | x25519 |
| X448 | x448 |

### 5.3 ZIP 算法

| 算法 | 说明 |
|------|------|
| zlib | zlib 格式压缩 |
| gzip | gzip 格式压缩 |
| deflate | deflate 原始格式 |
| lz77_zstd | LZ77+ZSTD |
| lz4 | LZ4 算法 |
| lz77_only | 仅 LZ77 |

---

## 六、典型使用示例

### 6.1 性能测试示例

```bash
# SEC AES-128-CBC 加密性能测试（SVA模式，同步）
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --pktlen 1024 --seconds 10 --thread 4 --ctxnum 8

# SEC SHA256 摘要性能测试
uadk_tool benchmark --alg sha256 --mode sva --opt 0 --sync \
    --pktlen 4096 --seconds 5 --thread 1

# HPRE RSA-2048 签名性能测试
uadk_tool benchmark --alg rsa-2048 --mode sva --opt 4 --sync \
    --seconds 10 --thread 1

# ZIP gzip 压缩性能测试
uadk_tool benchmark --alg gzip --mode sva --opt 0 --sync \
    --pktlen 16384 --seconds 5

# 多进程测试
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --pktlen 1024 --seconds 10 --multi 4 --thread 2

# 指定设备测试
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --device hisi_sec2-0

# 测试延迟
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --latency --seconds 5
```

### 6.2 DFX 诊断示例

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

### 6.3 正确性测试示例

```bash
# SEC 算法正确性测试
uadk_tool test --m sec

# ZIP 算法正确性测试
uadk_tool test --m zip
```

---

## 七、性能指标输出

benchmark 输出格式：

```
algname:        length:         perf:           iops:           CPU_rate:
aes-128-cbc     1024Bytes       1234.56KiB/s    123.4Kops       15.23%
```

| 指标 | 说明 |
|------|------|
| algname | 算法名称 |
| length | 数据包长度 |
| perf | 吞吐量（KiB/s） |
| iops | 操作速率（Kops） |
| CPU_rate | CPU 占用率 |

---

## 八、注意事项

1. **SVA 模式需要硬件支持**：需要设备支持 SVA（Shared Virtual Address）
2. **prefetch 功能**：在 SVA 模式下启用可减少缺页，提升性能
3. **ctxnum 与 QP 数量**：ctxnum 决定队列对数量，影响并发能力
4. **多进程/多线程**：`--multi` 创建多进程，`--thread` 在进程内创建多线程
5. **设备指定**：`--device` 可指定具体设备，格式如 `hisi_sec2-0`
6. **init2 接口**：新版初始化接口，仅支持 SVA 模式

---

> 文档编写日期：2026/04/14
> 基于代码仓库：uadk-official (官方版本)