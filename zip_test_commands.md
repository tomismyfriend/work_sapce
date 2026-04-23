# uadk_tool zip模块测试命令汇总

## 测试环境
- **服务器**: 192.168.90.37
- **OpenSSL版本**: 3.0.12
- **测试日期**: 2026-04-23

---

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --self | 自检测试 | 关闭 |
| --alg | 算法类型: 0=deflate, 1=zlib, 2=gzip, 3=lz77_zstd | 2(gzip) |
| --stream | 流式模式 | block模式 |
| --inf | 解压模式 | 压缩模式 |
| --verify | 验证模式(压缩后解压+MD5校验) | 关闭 |
| --sgl | SGL链表缓冲区 | pbuffer平坦缓冲区 |
| --mode | 0=同步, 1=异步 | 0(同步) |
| --thread | 线程数 | 1 |
| --qnum | 队列数 | 1 |
| --loop | 循环次数 | 1 |
| --size | 数据大小 | 10*blksize |
| --blksize | 块大小 | 128000 |
| --in | 输入文件 | - |
| --out | 输出文件 | - |
| --env | 启用环境变量配置 | 关闭 |
| --sformat | 输出格式: none/pretty/csv | 默认格式 |
| --option | p=prefault, t=hugepages, c=软件zlib | - |
| --fork | 子进程数 | 0 |
| --kill | 进程终止测试: b/t/w | - |

---

## 测试结果汇总

### 状态标识
- ✅ **PASS**: 测试通过
- ❌ **FAIL**: 测试失败
- ⚠️ **WARN**: 有警告/部分失败
- ⏱️ **HANG**: 卡住/超时

---

## 一、基础模式测试

### 1. --self 自检测试
```bash
uadk_tool test --m zip --self
```
| 状态 | 说明 |
|------|------|
| ⚠️ WARN | 大部分测试通过，16线程STREAM inflate有少量-22错误 |

**任务**: 自动运行全部自检项目，包括BLOCK/STREAM、SYNC/ASYNC、各种线程数、SW/HW混合测试

---

### 2. --alg 算法类型测试

#### alg=0 (deflate)
```bash
uadk_tool test --m zip --alg 0 --size 1024 --blksize 1024
uadk_tool test --m zip --alg 0 --size 1024 --inf
```
| 模式 | 状态 | 说明 |
|------|------|------|
| block 压缩 | ✅ PASS | 纯deflate流，无头部 |
| block 解压 | ✅ PASS | 正常 |
| stream 压缩 | ❌ FAIL | 返回-22错误 |
| stream 解压 | 未测试 | 压缩失败无法测试 |

**任务**: 测试原始deflate算法(无zlib/gzip头部)

#### alg=1 (zlib)
```bash
uadk_tool test --m zip --alg 1 --size 1024 --blksize 1024
uadk_tool test --m zip --alg 1 --size 1024 --stream
uadk_tool test --m zip --alg 1 --size 1024 --stream --inf
```
| 模式 | 状态 | 说明 |
|------|------|------|
| block 压缩 | ✅ PASS | zlib格式(带zlib头部) |
| block 解压 | ✅ PASS | 正常 |
| stream 压缩 | ✅ PASS | 正常 |
| stream 解压 | ✅ PASS | 正常 |

**任务**: 测试zlib格式压缩/解压

#### alg=2 (gzip) - **推荐使用**
```bash
uadk_tool test --m zip --alg 2 --size 10240
uadk_tool test --m zip --alg 2 --size 10240 --stream
uadk_tool test --m zip --alg 2 --size 10240 --inf
uadk_tool test --m zip --alg 2 --size 10240 --stream --inf
```
| 模式 | 状态 | 说明 |
|------|------|------|
| block 压缩 | ✅ PASS | gzip格式，可用gzip命令解压 |
| block 解压 | ✅ PASS | 正常 |
| stream 压缩 | ✅ PASS | **推荐** |
| stream 解压 | ✅ PASS | **推荐** |

**任务**: 测试gzip格式压缩/解压，兼容标准gzip命令

#### alg=3 (lz77_zstd)
```bash
uadk_tool test --m zip --alg 3 --size 1024 --blksize 1024
```
| 状态 | 说明 |
|------|------|
| ❌ FAIL | 硬件不支持此算法 |

**任务**: 测试lz77_zstd算法(需特定硬件支持)

---

### 3. --stream vs block 模式

```bash
# block模式(默认)
uadk_tool test --m zip --alg 2 --size 10240

# stream模式
uadk_tool test --m zip --alg 2 --size 10240 --stream
```
| 模式 | 状态 | 说明 |
|------|------|------|
| block | ✅ PASS | 分块处理，适合大文件 |
| stream | ✅ PASS | 流式处理，状态保持 |

**区别**:
- **block**: 每块独立，无状态依赖
- **stream**: 有状态流，需处理流结束标志

---

### 4. --inf 解压模式

```bash
uadk_tool test --m zip --alg 2 --size 10240 --inf
uadk_tool test --m zip --alg 2 --size 10240 --stream --inf
```
| 模式 | 状态 | 说明 |
|------|------|------|
| block 解压 | ✅ PASS | 硬件block解压 |
| stream 解压 | ✅ PASS | 硬件stream解压(已修复) |

**任务**: 硬件解压测试，将压缩数据还原

---

### 5. --verify 验证模式

```bash
uadk_tool test --m zip --alg 2 --size 10240 --verify
uadk_tool test --m zip --alg 2 --size 10240 --stream --verify
uadk_tool test --m zip --alg 2 --size 10240 --inf --verify
uadk_tool test --m zip --alg 2 --size 10240 --stream --inf --verify
```
| 模式 | 状态 | 说明 |
|------|------|------|
| block 压缩+SW解压验证 | ✅ PASS | HW压缩→SW解压→MD5验证 |
| stream 压缩+SW解压验证 | ✅ PASS | HW压缩→SW解压→MD5验证 |
| SW压缩+block HW解压验证 | ✅ PASS | SW压缩→HW解压→MD5验证 |
| SW压缩+stream HW解压验证 | ✅ PASS | SW压缩→HW解压→MD5验证 |

**任务**: 验证压缩/解压数据完整性

---

## 二、高级模式测试

### 6. --sgl SGL缓冲区

```bash
uadk_tool test --m zip --alg 2 --size 10240 --sgl
uadk_tool test --m zip --alg 2 --size 10240 --stream --sgl
uadk_tool test --m zip --alg 2 --size 10240 --inf --sgl
uadk_tool test --m zip --alg 2 --size 10240 --stream --inf --sgl
```
| 模式 | 状态 | 说明 |
|------|------|------|
| block 压缩 | ✅ PASS | SGL链表缓冲区 |
| stream 压缩 | ❌ FAIL | 返回-22错误 |
| block 解压 | ✅ PASS | 正常 |
| stream 解压 | ❌ FAIL | 返回-22错误 |

**任务**: 测试分散/聚集链表缓冲区模式

---

### 7. --mode 同步/异步模式

```bash
# 同步模式(默认)
uadk_tool test --m zip --alg 2 --size 10240 --mode 0

# 异步模式
uadk_tool test --m zip --alg 2 --size 10240 --mode 1
uadk_tool test --m zip --alg 2 --size 10240 --stream --mode 1
```
| 模式 | 状态 | 说明 |
|------|------|------|
| sync block | ✅ PASS | 同步分块处理 |
| async block | ✅ PASS | 异步分块处理 |
| async stream | ⏱️ HANG | 卡住，无法完成 |

**任务**: 
- **sync**: 调用后等待完成
- **async**: 提交请求，轮询获取结果

---

### 8. --thread 多线程

```bash
uadk_tool test --m zip --alg 2 --size 10240 --thread 2
uadk_tool test --m zip --alg 2 --size 10240 --thread 4
uadk_tool test --m zip --alg 2 --size 10240 --thread 8
uadk_tool test --m zip --alg 2 --size 10240 --stream --thread 4
```
| 状态 | 说明 |
|------|------|
| ✅ PASS | 2/4/8线程均正常 |

**任务**: 多线程并行压缩，提高吞吐量

---

### 9. --qnum 队列数

```bash
uadk_tool test --m zip --alg 2 --size 10240 --qnum 2
uadk_tool test --m zip --alg 2 --size 10240 --qnum 4
```
| 状态 | 说明 |
|------|------|
| ✅ PASS | 多队列正常 |

**任务**: 使用多个硬件队列

---

### 10. --loop 循环次数

```bash
uadk_tool test --m zip --alg 2 --size 1024 --loop 3
```
| 状态 | 说明 |
|------|------|
| ❌ FAIL | 返回-22错误 |

**任务**: 重复测试N次

---

### 11. --in/--out 文件模式 - **推荐生产使用**

```bash
# 压缩文件
dd if=/dev/urandom of=input.bin bs=10240 count=1
uadk_tool test --m zip --alg 2 --stream --in input.bin --out output.gz

# 解压文件
uadk_tool test --m zip --alg 2 --stream --inf --in output.gz --out output.bin

# 验证MD5
md5sum input.bin output.bin
```
| 状态 | 说明 |
|------|------|
| ✅ PASS | 文件读写正常，MD5匹配 |

**任务**: 
- **压缩**: 从文件读取→硬件压缩→写入.gz文件
- **解压**: 从.gz文件读取→硬件解压→写入原始文件

---

## 三、其他参数测试

### 12. --option 特殊选项

```bash
# prefault预分配
uadk_tool test --m zip --alg 2 --size 1024 --option p

# hugepages大页
uadk_tool test --m zip --alg 2 --size 1024 --option t

# 软件zlib
uadk_tool test --m zip --alg 2 --size 1024 --option c
```
| 选项 | 状态 | 说明 |
|------|------|------|
| p (prefault) | ✅ PASS | 预分配输出页 |
| t (hugepages) | ❌ FAIL | MADV_HUGEPAGE失败 |
| c (软件zlib) | ✅ PASS | 使用CPU软件压缩 |

---

### 13. --sformat 输出格式

```bash
uadk_tool test --m zip --alg 2 --size 1024 --sformat pretty
uadk_tool test --m zip --alg 2 --size 1024 --sformat csv
uadk_tool test --m zip --alg 2 --size 1024 --sformat none
```
| 状态 | 说明 |
|------|------|
| ✅ PASS | 三种格式均正常 |

**任务**: 控制统计信息输出格式

---

### 14. --env 环境变量配置

```bash
WD_COMP_CTX_NUM='sync-comp:2@0' uadk_tool test --m zip --alg 2 --size 1024 --env
```
| 状态 | 说明 |
|------|------|
| ✅ PASS | 环境变量配置生效 |

**任务**: 通过环境变量配置上下文数量和类型

---

### 15. --fork 子进程

```bash
uadk_tool test --m zip --alg 2 --size 1024 --fork 2
```
| 状态 | 说明 |
|------|------|
| ✅ PASS | 创建2个子进程并行测试 |

**任务**: 多进程并行测试

---

### 16. --kill 进程终止测试

```bash
# 未测试，可能影响系统稳定性
uadk_tool test --m zip --alg 2 --size 1024 --kill b
```
| 状态 | 说明 |
|------|------|
| ⚠️ 未测试 | 可能导致进程异常终止 |

**任务**: 测试异常情况下的行为(b=bind后终止, t=访问未映射缓冲区, w=工作时终止)

---

## 四、组合参数推荐

### 生产环境推荐配置

```bash
# 压缩文件(推荐)
uadk_tool test --m zip --alg 2 --stream --in input.bin --out output.gz

# 解压文件(推荐)
uadk_tool test --m zip --alg 2 --stream --inf --in output.gz --out output.bin

# 高吞吐量压缩(多线程)
uadk_tool test --m zip --alg 2 --stream --thread 8 --in input.bin --out output.gz

# 验证模式(测试完整性)
uadk_tool test --m zip --alg 2 --stream --verify
```

### 性能测试推荐

```bash
# 自检测试
uadk_tool test --m zip --self

# 单线程性能
uadk_tool test --m zip --alg 2 --size 1048576 --blksize 1048576 --stream

# 多线程性能
uadk_tool test --m zip --alg 2 --size 1048576 --stream --thread 8
```

---

## 五、问题汇总

### 已知问题

| 问题 | 影响 | 原因 |
|------|------|------|
| deflate + stream | ❌ FAIL | 纯deflate流式模式失败 |
| lz77_zstd | ❌ FAIL | 硬件不支持此算法 |
| sgl + stream | ❌ FAIL | SGL链表流式模式失败 |
| async stream | ⏱️ HANG | 异步流式模式卡住 |
| --loop | ❌ FAIL | 循环测试失败 |
| --option t | ❌ FAIL | 系统不支持MADV_HUGEPAGE |
| 16线程stream inflate | ⚠️ WARN | self测试有少量失败 |

### 已修复问题

| 问题 | 状态 | 修复说明 |
|------|------|------|
| gzip stream 解压 | ✅ 已修复 | wd_comp.c stream end detection |
| gzip stream 压缩 | ✅ 已修复 | last标志设置 |

---

## 六、测试状态总览

| 功能 | 状态 | 备注 |
|------|------|------|
| gzip block 压缩/解压 | ✅ PASS | 推荐 |
| gzip stream 压缩/解压 | ✅ PASS | 推荐 |
| zlib block 压缩/解压 | ✅ PASS | 正常 |
| zlib stream 压缩/解压 | ✅ PASS | 正常 |
| deflate block 压缩/解压 | ✅ PASS | 无头部格式 |
| deflate stream | ❌ FAIL | 不支持 |
| lz77_zstd | ❌ FAIL | 硬件不支持 |
| verify模式 | ✅ PASS | 推荐 |
| 文件模式 | ✅ PASS | 推荐生产使用 |
| 多线程 | ✅ PASS | 推荐 |
| 多队列 | ✅ PASS | 正常 |
| async block | ✅ PASS | 正常 |
| async stream | ⏱️ HANG | 不推荐 |
| sgl block | ✅ PASS | 正常 |
| sgl stream | ❌ FAIL | 不支持 |