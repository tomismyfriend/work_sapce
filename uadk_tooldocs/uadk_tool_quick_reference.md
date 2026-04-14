# UADK Tool 指令速查表

## 一、命令概览

```bash
uadk_tool <子命令> [参数]

子命令:
  dfx       - 诊断/调试信息
  benchmark - 性能测试
  test      - 正确性测试
```

---

## 二、benchmark 指令速查

### 2.1 基本语法

```bash
uadk_tool benchmark --alg <算法> --mode <模式> [其他参数]
```

### 2.2 必选参数

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `--alg` | 算法名称 | aes-128-cbc, rsa-2048, gzip |
| `--mode` | 运行模式 | sva, nosva, soft, instr |

### 2.3 可选参数

| 参数 | 说明 | 默认值 | 范围 |
|------|------|--------|------|
| `--sync` | 同步模式 | sync | - |
| `--async` | 异步模式 | - | - |
| `--opt <n>` | 操作类型 | 0 | 0-5 |
| `--pktlen <n>` | 数据长度 | 16 | 16-15M |
| `--seconds <n>` | 测试时长(秒) | 3 | 1-128 |
| `--thread <n>` | 线程数 | 3 | 1-64 |
| `--multi <n>` | 进程数 | 1 | 1-32 |
| `--ctxnum <n>` | 上下文数 | 1 | 1-64 |
| `--device <name>` | 设备名 | 自动 | hisi_sec2-0 |
| `--prefetch` | 启用预取 | 否 | - |
| `--latency` | 测试延迟 | 否 | - |
| `--init2` | init2接口 | 否 | - |
| `--alglist` | 列出算法 | - | - |

---

## 三、常用命令模板

### SEC 加密测试

```bash
# AES-CBC 加密（最常用）
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --pktlen 1024 --seconds 10 --thread 4

# AES-GCM 认证加密
uadk_tool benchmark --alg aes-128-gcm --mode sva --opt 0 --sync \
    --pktlen 4096 --seconds 5

# SM4 国密算法
uadk_tool benchmark --alg sm4-128-cbc --mode sva --opt 0 --sync \
    --pktlen 1024 --seconds 10

# SHA256 摘要
uadk_tool benchmark --alg sha256 --mode sva --opt 0 --sync \
    --pktlen 4096 --seconds 5

# SM3 国密摘要
uadk_tool benchmark --alg sm3 --mode sva --opt 0 --sync \
    --pktlen 4096 --seconds 5
```

### HPRE 公钥测试

```bash
# RSA-2048 签名
uadk_tool benchmark --alg rsa-2048 --mode sva --opt 4 --sync \
    --seconds 10 --thread 1

# RSA-2048 验签
uadk_tool benchmark --alg rsa-2048 --mode sva --opt 5 --sync \
    --seconds 10 --thread 1

# RSA 密钥生成
uadk_tool benchmark --alg rsa-2048 --mode sva --opt 0 --sync \
    --seconds 10

# SM2 国密算法
uadk_tool benchmark --alg sm2 --mode sva --opt 4 --sync \
    --seconds 10

# ECDH 密钥协商
uadk_tool benchmark --alg ecdh-256 --mode sva --opt 0 --sync \
    --seconds 10

# X25519
uadk_tool benchmark --alg x25519 --mode sva --opt 0 --sync \
    --seconds 10
```

### ZIP 压缩测试

```bash
# zlib 块压缩
uadk_tool benchmark --alg zlib --mode sva --opt 0 --sync \
    --pktlen 16384 --seconds 5

# gzip 块压缩
uadk_tool benchmark --alg gzip --mode sva --opt 0 --sync \
    --pktlen 16384 --seconds 5

# deflate 块压缩
uadk_tool benchmark --alg deflate --mode sva --opt 0 --sync \
    --pktlen 16384 --seconds 5

# zlib 解压
uadk_tool benchmark --alg zlib --mode sva --opt 1 --sync \
    --pktlen 16384 --seconds 5

# LZ4 压缩
uadk_tool benchmark --alg lz4 --mode sva --opt 0 --sync \
    --pktlen 16384 --seconds 5
```

### 高级用法

```bash
# 多进程+多线程
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --multi 4 --thread 4 --ctxnum 16 --seconds 10

# 指定设备
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --device hisi_sec2-0

# 启用预取（提升SVA性能）
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --prefetch --pktlen 4096

# 测试延迟
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --latency --seconds 10

# 使用 init2 接口
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --sync \
    --init2

# 异步模式
uadk_tool benchmark --alg aes-128-cbc --mode sva --opt 0 --async \
    --seconds 10

# No-SVA 模式
uadk_tool benchmark --alg aes-128-cbc --mode nosva --opt 0 --sync \
    --pktlen 1024

# 纯软件模式（对比基准）
uadk_tool benchmark --alg aes-128-cbc --mode soft --opt 0 --sync \
    --pktlen 1024 --engine uadk_engine

# NUMA 绑定
numactl --cpubind=0 --membind=0,1 uadk_tool benchmark \
    --alg aes-128-cbc --mode sva --opt 0 --sync --pktlen 1024
```

---

## 四、dfx 指令速查

```bash
# 查看版本
uadk_tool dfx --version

# 查看安装路径
uadk_tool dfx --dir

# 查看 SEC 环境变量
uadk_tool dfx --env sec

# 查看 HPRE 环境变量
uadk_tool dfx --env hpre

# 查看 ZIP 环境变量
uadk_tool dfx --env zip

# 查看上下文计数
uadk_tool dfx --count

# 查看设备利用率
uadk_tool dfx --usage --device hisi_sec2-0 --alg cipher --op_type 0
uadk_tool dfx --usage --device hisi_hpre-0 --alg rsa --op_type 0
uadk_tool dfx --usage --device hisi_zip-0 --alg zlib --op_type 0
```

---

## 五、test 指令速查

```bash
# SEC 正确性测试
uadk_tool test --m sec

# HPRE 正确性测试
uadk_tool test --m hpre

# ZIP 正确性测试
uadk_tool test --m zip
```

---

## 六、算法名称速查

### Cipher (对称加密)

```
aes-128-ecb      aes-192-ecb      aes-256-ecb
aes-128-cbc      aes-192-cbc      aes-256-cbc
aes-128-ctr      aes-192-ctr      aes-256-ctr
aes-128-ofb      aes-192-ofb      aes-256-ofb
aes-128-cfb      aes-192-cfb      aes-256-cfb
aes-256-xts      aes-512-xts
3des-128-ecb     3des-192-ecb     3des-128-cbc     3des-192-cbc
sm4-128-ecb      sm4-128-cbc      sm4-128-ctr      sm4-128-xts
```

### AEAD (认证加密)

```
aes-128-ccm      aes-192-ccm      aes-256-ccm
aes-128-gcm      aes-192-gcm      aes-256-gcm
sm4-128-ccm      sm4-128-gcm
```

### Digest (摘要)

```
sm3              md5              sha1
sha224           sha256           sha384           sha512
sha512-224       sha512-256
```

### HPRE (公钥)

```
rsa-1024         rsa-2048         rsa-3072         rsa-4096
rsa-1024-crt     rsa-2048-crt     rsa-3072-crt     rsa-4096-crt
dh-768           dh-1024          dh-1536          dh-2048
ecdh-256         ecdh-384         ecdh-521
ecdsa-256        ecdsa-384        ecdsa-521
sm2              x25519           x448
```

### ZIP (压缩)

```
zlib             gzip             deflate
lz77_zstd        lz4              lz77_only
```

---

## 七、操作类型速查

### SEC (optype)

```
0: encryption    (加密)
1: decryption    (解密)

Digest/AEAD:
0: normal
1: hmac
```

### HPRE (optype)

```
0: keygen        (密钥生成)
1: key compute   (密钥计算)
2: Enc           (加密)
3: Dec           (解密)
4: Sign          (签名)
5: Verify        (验签)
```

### ZIP (optype)

```
0: block compression    (块压缩)
1: block decompression  (块解压)
2: stream compression   (流压缩)
3: stream decompression (流解压)
```

---

## 八、模式速查

| 模式 | 说明 |
|------|------|
| sva | SVA 模式，硬件支持虚拟化地址 |
| nosva | No-SVA 模式，传统 DMA |
| soft | 纯软件，使用 OpenSSL |
| instr | 指令模式，CPU 指令加速 |
| multibuff | 多缓冲模式 |

---

## 九、快速诊断命令

```bash
# 查看所有支持的算法
uadk_tool benchmark --alglist

# 快速测试默认配置
uadk_tool benchmark

# 查看 UADK 版本信息
uadk_tool dfx --version

# 查看设备列表
ls /dev/uacce/

# 查看设备信息
cat /sys/class/uacce/hisi_sec2-0/device/attrs

# 检查模块加载
lsmod | grep hisi

# 查看 uacce 设备详情
cat /sys/class/uacce/hisi_sec2-0/api
```

---

> 编写日期：2026/04/14