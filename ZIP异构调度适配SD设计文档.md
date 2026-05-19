# ZIP模块异构调度适配软件设计文档 (SD)

## 文档信息

| 项目 | 内容 |
|------|------|
| 项目名称 | UADK ZIP模块异构调度适配 |
| 文档类型 | 软件设计文档 (SD) |
| 版本 | V1.0 |
| 日期 | 2025-01-19 |
| 适用模块 | wd_comp.c (ZIP压缩模块) |
| 参考模块 | wd_cipher.c (已适配模板) |

---

## 一、功能介绍

### 1.1 功能概述

ZIP模块异构调度适配的目标是将Origin版本的单驱动模式改为Design版本的多驱动异构调度框架，实现：

| 功能 | Origin版本 | Design版本 |
|------|------------|------------|
| **驱动管理** | 单驱动指针 `driver` | 多驱动数组 `drv_array[]` |
| **ctx绑定驱动** | 无 | ctx绑定drv，标记ctx_type |
| **兼容检查** | 检查单个驱动 | 遍历ctx检查drv支持 |
| **调度过滤** | 无过滤 | idx_list只存兼容ctx索引 |
| **初始化流程** | 分散逻辑 | 四阶段统一流程 |

### 1.2 异构调度核心能力

```
┌─────────────────────────────────────────────────────────────────┐
│  异构调度四个核心能力                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① 多驱动管理                                                   │
│     drv_array[] 存储多个驱动指针                                │
│     支持 HW/CE/SVE/SOFT 四种驱动类型                            │
│                                                                 │
│  ② 驱动区域映射                                                 │
│     drv_region 记录每个驱动对应的ctx范围                        │
│     调度器感知ctx归属                                           │
│                                                                 │
│  ③ 兼容过滤                                                     │
│     wd_drv_alg_support 检查ctx是否支持目标算法                  │
│     wd_sched_skey_compat_filter 过滤idx_list                   │
│                                                                 │
│  ④ 调度参数传递                                                 │
│     sched.set_param 设置 alg_name 和 ctxs                      │
│     触发compat过滤填充sched_domain                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 ZIP模块现状说明

| 对比项 | Cipher模块 | ZIP模块 |
|--------|------------|---------|
| 驱动数量 | drv_count ≥ 2 (hisi_sec + isa_ce + isa_sve) | drv_count = 1 (hisi_zip) |
| 异构生效 | ✓ 真正生效 | 框架适配，未实际生效 |
| 适配意义 | 功能验证 | 框架统一 + 预留扩展接口 |

**说明**: ZIP只有hisi_zip硬件驱动，无CE/SVE指令集支持。适配后框架统一，未来添加ZIP指令集驱动时异构调度自动生效。

---

## 二、数据结构描述

### 2.1 修改的数据结构清单

| 结构体 | 文件位置 | 修改类型 | 关键变化 |
|--------|----------|----------|----------|
| `wd_init_attrs` | `wd_alg_common.h:202` | 修改 | 删除driver，新增drv_array/drv_count/task_type |
| `wd_ctx_config_internal` | `wd_internal.h:45` | 修改 | 新增drv_array/drv_count |
| `wd_ctx_internal` | `wd_internal.h:32` | 修改 | 新增drv/ctx_type/drv_priv |
| `wd_sched` | `wd_alg_common.h:181` | 修改 | 新增set_param回调 |
| `wd_sched_params` | `wd_internal.h:64` | 新增 | compat过滤参数 |
| `wd_ctx` | `wd_alg_common.h:91` | 修改 | 新增ctx_type |
| `wd_ctx_nums` | `wd_alg_common.h:142` | 修改 | 新增ctx_prop/ctx_begin |

---

### 2.2 wd_init_attrs 结构体

**文件位置**: `include/wd_alg_common.h:202`

**用途**: 初始化属性传递，V1和V2路径共享

#### Origin版本定义

```c
struct wd_init_attrs {
    __u32 sched_type;
    char alg[CRYPTO_MAX_ALG_NAME];
    struct wd_alg_driver *driver;        // ← 单驱动指针（已删除）
    struct wd_sched *sched;
    struct wd_ctx_params *ctx_params;
    struct wd_ctx_config *ctx_config;
    wd_alg_init alg_init;
    wd_alg_poll_ctx alg_poll_ctx;
};
```

#### Design版本定义（修改后）

```c
struct wd_init_attrs {
    __u32 sched_type;
    __u32 task_type;                     // ← 新增：任务类型过滤
    char alg[CRYPTO_MAX_ALG_NAME];
    struct wd_sched *sched;
    struct wd_ctx_params *ctx_params;
    struct wd_ctx_config *ctx_config;
    wd_alg_init alg_init;
    wd_alg_poll_ctx alg_poll_ctx;
    
    struct wd_ctx_config_internal *ctx_config_internal;  // ← 新增：内部config指针
    struct wd_alg_driver **drv_array;    // ← 新增：驱动数组
    __u32 drv_count;                     // ← 新增：驱动数量
};
```

#### 新增字段说明

| 字段 | 类型 | 用途 |
|------|------|------|
| `task_type` | `__u32` | 驱动发现过滤条件：TASK_HW/TASK_INSTR/TASK_MIX |
| `ctx_config_internal` | `wd_ctx_config_internal*` | V2路径传递内部config指针 |
| `drv_array` | `wd_alg_driver**` | Phase 1发现的驱动数组 |
| `drv_count` | `__u32` | 驱动数量 |

---

### 2.3 wd_ctx_config_internal 结构体

**文件位置**: `include/wd_internal.h:45`

**用途**: 内部ctx配置，存储ctx数组、驱动数组、drv_region

#### Origin版本定义

```c
struct wd_ctx_config_internal {
    __u32 ctx_num;
    int shmid;
    struct wd_ctx_internal *ctxs;
    void *priv;
    bool epoll_en;
    unsigned long *msg_cnt;
    char *alg_name;
};
```

#### Design版本定义（修改后）

```c
struct wd_ctx_config_internal {
    __u32 ctx_num;
    int shmid;
    struct wd_ctx_internal *ctxs;
    void *priv;
    bool epoll_en;
    unsigned long *msg_cnt;
    char *alg_name;
    
    struct wd_alg_driver **drv_array;    // ← 新增：驱动数组
    __u32 drv_count;                     // ← 新增：驱动数量
};
```

#### 新增字段说明

| 字段 | 类型 | 用途 |
|------|------|------|
| `drv_array` | `wd_alg_driver**` | 缓存驱动数组，Phase 2.5绑定时使用 |
| `drv_count` | `__u32` | 驱动数量，用于RR绑定 |

---

### 2.4 wd_ctx_internal 结构体

**文件位置**: `include/wd_internal.h:32`

**用途**: 内部ctx结构，绑定驱动指针

#### Origin版本定义

```c
struct wd_ctx_internal {
    handle_t ctx;
    __u8 op_type;
    __u8 ctx_mode;
    __u16 sqn;
    pthread_spinlock_t lock;
};
```

#### Design版本定义（修改后）

```c
struct wd_ctx_internal {
    __u8 op_type;
    __u8 ctx_mode;
    __u8 ctx_type;                       // ← 新增：ctx类型标记
    __u8 ctx_used;                       // ← 新增：使用标记
    handle_t ctx;
    __u16 sqn;
    pthread_spinlock_t lock;
    struct wd_alg_driver *drv;           // ← 新增：绑定的驱动指针
    void *drv_priv;                      // ← 新增：驱动私有数据
    void *extend_ops;                    // ← 新增：扩展操作
};
```

#### 新增字段说明

| 字段 | 类型 | 用途 |
|------|------|------|
| `ctx_type` | `__u8` | ctx类型：HW=0, CE=1, SVE=2, SOFT=3 |
| `ctx_used` | `__u8` | 使用标记 |
| `drv` | `wd_alg_driver*` | **核心字段**：ctx绑定的驱动指针 |
| `drv_priv` | `void*` | 驱动私有数据 |
| `extend_ops` | `void*` | 扩展操作 |

---

### 2.5 wd_sched 结构体

**文件位置**: `include/wd_alg_common.h:181`

**用途**: 调度器定义，新增set_param回调

#### Origin版本定义

```c
struct wd_sched {
    const char *name;
    int sched_policy;
    handle_t (*sched_init)(handle_t h_sched_ctx, void *sched_param);
    __u32 (*pick_next_ctx)(handle_t h_sched_ctx, void *sched_key, const int sched_mode);
    int (*poll_policy)(handle_t h_sched_ctx, __u32 expect, __u32 *count);
    handle_t h_sched_ctx;
};
```

#### Design版本定义（修改后）

```c
struct wd_sched {
    const char *name;
    int sched_policy;
    handle_t (*sched_init)(handle_t h_sched_ctx, void *sched_param);
    __u32 (*pick_next_ctx)(handle_t h_sched_ctx, void *sched_key, const int sched_mode);
    int (*poll_policy)(handle_t h_sched_ctx, __u32 expect, __u32 *count);
    void (*set_param)(handle_t h_sched_ctx, void *sched_key, struct wd_sched_params *params);  // ← 新增
    handle_t h_sched_ctx;
};
```

#### 新增字段说明

| 字段 | 类型 | 用途 |
|------|------|------|
| `set_param` | 回调函数 | 设置sched_key参数，触发compat过滤 |

---

### 2.6 wd_sched_params 结构体（新增）

**文件位置**: `include/wd_internal.h:64`

**用途**: sched.set_param 的参数结构，传递算法名和ctx数组

#### Design版本定义（新增结构体）

```c
struct wd_sched_params {
    __u32 pkt_size;
    __u16 data_mode;
    __u16 prio_mode;
    const char *alg_name;                // ← 新增：目标算法名
    struct wd_ctx_internal *ctxs;        // ← 新增：ctx数组
};
```

#### 字段说明

| 字段 | 类型 | 用途 |
|------|------|------|
| `alg_name` | `const char*` | compat过滤的目标算法名 |
| `ctxs` | `wd_ctx_internal*` | ctx数组，用于遍历检查drv支持 |

---

### 2.7 wd_sched_key 结构体（调度域核心）

**文件位置**: `wd_sched.c:200`

**用途**: session级调度key，包含sync_domain和async_domain

#### 结构体定义

```c
struct wd_sched_key {
    int region_id;
    __u8 type;
    __u8 mode;
    __u32 dev_id;
    __u8 ctx_prop;
    __u16 is_stream;
    __u16 prio_mode;
    __u32 pkt_size;
    
    struct wd_sched_key_domain sync_domain;    // ← 同步调度域
    struct wd_sched_key_domain async_domain;   // ← 异步调度域
    
    pthread_mutex_t lock;
    
    const char *alg_name;                      // ← compat过滤参数
    struct wd_ctx_internal *ctxs;              // ← ctx数组
};
```

#### 字段说明

| 字段 | 类型 | 用途 |
|------|------|------|
| `sync_domain` | `wd_sched_key_domain` | **同步调度域**：存储同步ctx索引 |
| `async_domain` | `wd_sched_key_domain` | **异步调度域**：存储异步ctx索引 |
| `alg_name` | `const char*` | 目标算法名，compat过滤依据 |
| `ctxs` | `wd_ctx_internal*` | ctx数组引用 |

---

### 2.8 wd_sched_key_domain 结构体（调度域 sd）

**文件位置**: `wd_sched.c:180`

**用途**: sd核心结构，存储idx_list（兼容ctx索引数组）

#### 结构体定义

```c
struct wd_sched_key_domain {
    struct wd_sched_domain_idx_cache idx_cache;  // ← ctx索引缓存
    pthread_mutex_t lock;
    __u32 expanded_count;
};

struct wd_sched_domain_idx_cache {
    __u32 idx_list[SKEY_CTX_MAX_NUM];           // ← 兼容ctx索引数组
    __u32 valid_count;                           // ← 有效ctx数量
    atomic_uint load_values[SKEY_CTX_MAX_NUM];  // ← 负载计数
    atomic_uint rr_ptr;                          // ← RR轮询指针
    atomic_uint min_load_idx;                    // ← 最小负载索引
    atomic_uint op_counter;                      // ← 操作计数
    __u8 policy;                                 // ← 调度策略
    pthread_mutex_t cache_lock;
};
```

#### 字段说明

| 字段 | 类型 | 用途 |
|------|------|------|
| `idx_list` | `__u32[]` | **核心**：兼容ctx索引数组 |
| `valid_count` | `__u32` | idx_list中有效ctx数量 |
| `load_values` | `atomic_uint[]` | 每个ctx的负载计数 |
| `rr_ptr` | `atomic_uint` | RR轮询指针 |
| `policy` | `__u8` | 调度策略：RR/HUNGRY等 |

---

### 2.9 数据结构关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│  wd_comp_setting                                                    │
│  ├── config (wd_ctx_config_internal)                                │
│  │   ├── ctx_num = 16                                               │
│  │   ├── ctxs[0-15] (wd_ctx_internal)                               │
│  │   │   ├── ctx = 硬件队列句柄                                     │
│  │   │   ├── drv = drv_array[x] ← 绑定驱动                          │
│  │   │   ├── ctx_type = HW/CE/SVE ← 类型标记                        │
│  │   │   └── op_type/ctx_mode                                       │
│  │   ├── drv_array[0] = hisi_zip                                    │
│  │   └── drv_count = 1                                              │
│  └── sched (wd_sched)                                               │
│  │   ├── sched_policy = SCHED_POLICY_RR                             │
│  │   ├── pick_next_ctx()                                            │
│  │   ├── set_param() ← 新增回调                                     │
│  │   └── h_sched_ctx → wd_sched_ctx                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  wd_comp_sess                                                       │
│  ├── alg_type = WD_ZLIB                                             │
│  └── sched_key (wd_sched_key)                                       │
│  │   ├── alg_name = "zlib" ← 目标算法                               │
│  │   ├── ctxs → config.ctxs                                         │
│  │   ├── sync_domain (wd_sched_key_domain) ← 同步调度域(sd)         │
│  │   │   └── idx_cache                                              │
│  │   │       ├── idx_list[0-7] = {0,1,2,...} ← 兼容ctx索引          │
│  │   │       ├── valid_count = 8                                    │
│  │   │       ├── load_values[0-7]                                   │
│  │   │       └── rr_ptr                                             │
│  │   └── async_domain (wd_sched_key_domain) ← 异步调度域(sd)         │
│  │   │   └── idx_cache                                              │
│  │   │       ├── idx_list[8-15]                                     │
│  │   │       └── valid_count = 8                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、函数功能描述

### 3.1 修改的函数清单

| 函数 | 文件位置 | 改动类型 | 改动内容 |
|------|----------|----------|----------|
| `wd_comp_init_nolock` | `wd_comp.c:138` | 签名+内部逻辑 | 新增attrs参数，删除wd_alg_init_driver |
| `wd_comp_uninit_nolock` | `wd_comp.c:176` | 内部逻辑 | 删除wd_alg_uninit_driver，用priv标记 |
| `wd_comp_init` | `wd_comp.c:194` | 新增逻辑 | V1路径新增Phase 2/2.5/3 |
| `wd_comp_uninit` | `wd_comp.c:253` | 新增逻辑 | V1路径新增驱动解绑+释放 |
| `wd_comp_init2_` | `wd_comp.c:272` | 核心改动 | 删除wd_alg_drv_bind，新增Phase 2.5/3 |
| `wd_comp_uninit2` | `wd_comp.c:367` | 新增逻辑 | V2路径新增驱动解绑 |
| `wd_comp_alloc_sess` | `wd_comp.c:488` | 核心改动 | 新增compat检查+set_param |

---

### 3.2 wd_comp_init_nolock 函数

**文件位置**: `wd_comp.c:138`

**改动类型**: 签名修改 + 内部逻辑修改

#### 函数签名

**Origin版本**:
```c
static int wd_comp_init_nolock(struct wd_ctx_config *config, struct wd_sched *sched)
```

**Design版本**:
```c
static int wd_comp_init_nolock(struct wd_ctx_config *config, struct wd_sched *sched, void *attrs)
```

#### 入参说明

| 参数 | 类型 | 用途 |
|------|------|------|
| `config` | `wd_ctx_config*` | 用户ctx配置 |
| `sched` | `wd_sched*` | 用户调度器配置 |
| `attrs` | `void*` | **新增**：初始化属性指针，V2路径传递 |

#### 返回值

| 返回值 | 含义 |
|--------|------|
| `0` | 成功 |
| `<0` | 失败，错误码 |

#### 函数功能

**功能描述**:
1. 复制外部config到内部config
2. 复制外部sched到内部sched
3. 初始化异步请求池
4. **新增**：V2路径设置 `attrs->ctx_config_internal`

**关键改动**:
- **删除**: `wd_alg_init_driver` 调用（移到Phase 3）
- **新增**: `attrs` 参数
- **新增**: `wd_comp_setting.priv = STATUS_ENABLE`
- **新增**: `comp_attrs->ctx_config_internal = &wd_comp_setting.config`

---

### 3.3 wd_comp_uninit_nolock 函数

**文件位置**: `wd_comp.c:176`

**改动类型**: 内部逻辑修改

#### 函数签名

```c
static int wd_comp_uninit_nolock(void)
```

#### 入参说明

无入参

#### 返回值

| 返回值 | 含义 |
|--------|------|
| `0` | 成功 |
| `-WD_EINVAL` | 未初始化状态 |

#### 函数功能

**功能描述**:
1. 检查priv标记判断初始化状态
2. 清理异步请求池
3. 清理sched

**关键改动**:
- **删除**: `wd_alg_uninit_driver` 调用（移到wd_comp_uninit）
- **新增**: 用 `priv` 标记判断初始化状态

---

### 3.4 wd_comp_init 函数 (V1路径)

**文件位置**: `wd_comp.c:194`

**改动类型**: 新增逻辑

#### 函数签名

```c
int wd_comp_init(struct wd_ctx_config *config, struct wd_sched *sched)
```

#### 入参说明

| 参数 | 类型 | 用途 |
|------|------|------|
| `config` | `wd_ctx_config*` | 用户ctx配置 |
| `sched` | `wd_sched*` | 用户调度器配置 |

#### 返回值

| 返回值 | 含义 |
|--------|------|
| `0` | 成功 |
| `<0` | 失败，错误码 |

#### 函数功能

**功能描述**（四阶段流程）:
```
Phase 1: wd_comp_init_nolock → 内部复制
Phase 2: wd_get_drv_array → 驱动发现
Phase 2.5: wd_ctx_bind_drivers → 驱动绑定
Phase 3: wd_alg_init_driver → 驱动初始化
```

**新增逻辑**:

```c
// Phase 2: 驱动发现
ret = wd_get_drv_array("comp", TASK_HW, "hisi_zip",
        &wd_comp_setting.config.drv_array, &drv_count);

// Phase 2.5: 驱动绑定
ret = wd_ctx_bind_drivers(&wd_comp_setting.config,
        wd_comp_setting.config.drv_array, drv_count);

// Phase 3: 驱动初始化
ret = wd_alg_init_driver(&wd_comp_setting.config);
```

---

### 3.5 wd_comp_uninit 函数 (V1路径)

**文件位置**: `wd_comp.c:253`

**改动类型**: 新增逻辑

#### 函数签名

```c
void wd_comp_uninit(void)
```

#### 入参说明

无入参

#### 返回值

无返回值

#### 函数功能

**功能描述**（反向清理）:
```
1. wd_alg_uninit_driver → 驱动反初始化
2. wd_ctx_unbind_drivers → 驱动解绑
3. wd_comp_uninit_nolock → 内部清理
4. wd_put_drv_array → 释放驱动数组
```

**新增逻辑**:

```c
wd_alg_uninit_driver(&wd_comp_setting.config);
wd_ctx_unbind_drivers(&wd_comp_setting.config);
wd_put_drv_array(wd_comp_setting.config.drv_array,
             wd_comp_setting.config.drv_count);
wd_comp_setting.config.drv_array = NULL;
```

---

### 3.6 wd_comp_init2_ 函数 (V2路径)

**文件位置**: `wd_comp.c:272`

**改动类型**: 核心改动

#### 函数签名

```c
int wd_comp_init2_(const char *alg, __u32 sched_type, int task_type, struct wd_ctx_params *ctx_params)
```

#### 入参说明

| 参数 | 类型 | 用途 |
|------|------|------|
| `alg` | `const char*` | 算法名：zlib/gzip/deflate |
| `sched_type` | `__u32` | 调度策略：SCHED_POLICY_RR等 |
| `task_type` | `int` | 任务类型：TASK_HW/TASK_INSTR/TASK_MIX |
| `ctx_params` | `wd_ctx_params*` | ctx参数配置 |

#### 返回值

| 返回值 | 含义 |
|--------|------|
| `0` | 成功 |
| `<0` | 失败，错误码 |

#### 函数功能

**功能描述**（四阶段流程）:

| 阶段 | 调用函数 | 作用 |
|------|----------|------|
| Phase 1 | `wd_alg_attrs_init` 内部调用 `wd_alg_drv_discover` | 发现驱动数组 |
| Phase 2 | `wd_alg_attrs_init` 内部调用 `wd_alg_ctx_init` | 分配ctx |
| Phase 2.5 | `wd_ctx_bind_drivers` | **新增**：驱动绑定ctx |
| Phase 3 | `wd_alg_init_driver` | **新增**：驱动初始化 |

**关键改动**:

```c
// 删除: wd_alg_drv_bind(task_type, alg)
// 删除: wd_comp_setting.driver = drv
// 删除: wd_comp_init_attrs.driver = drv

// 新增: wd_comp_init_attrs.task_type = task_type

// 新增 Phase 2.5:
wd_ctx_bind_drivers(&wd_comp_setting.config,
          wd_comp_init_attrs.drv_array,
          wd_comp_init_attrs.drv_count);

// 新增 Phase 3:
wd_alg_init_driver(&wd_comp_setting.config);
```

---

### 3.7 wd_comp_uninit2 函数 (V2路径)

**文件位置**: `wd_comp.c:367`

**改动类型**: 新增逻辑

#### 函数签名

```c
void wd_comp_uninit2(void)
```

#### 入参说明

无入参

#### 返回值

无返回值

#### 函数功能

**功能描述**（反向清理）:
```
1. wd_alg_uninit_driver → 驱动反初始化
2. wd_ctx_unbind_drivers → 驱动解绑
3. wd_comp_uninit_nolock → 内部清理
4. wd_alg_attrs_uninit → attrs清理
```

**关键改动**:

```c
// 删除: wd_alg_drv_unbind(wd_comp_setting.driver)

// 新增:
wd_alg_uninit_driver(&wd_comp_setting.config);
wd_ctx_unbind_drivers(&wd_comp_setting.config);
```

---

### 3.8 wd_comp_alloc_sess 函数

**文件位置**: `wd_comp.c:488`

**改动类型**: 核心改动

#### 函数签名

```c
handle_t wd_comp_alloc_sess(struct wd_comp_sess_setup *setup)
```

#### 入参说明

| 参数 | 类型 | 用途 |
|------|------|------|
| `setup` | `wd_comp_sess_setup*` | session配置参数 |

#### 返回值

| 返回值 | 含义 |
|--------|------|
| 有效handle | 成功 |
| `(handle_t)0` | 失败 |

#### 函数功能

**功能描述**:
1. 参数校验
2. **新增**：获取算法名并做兼容检查
3. 初始化内存操作
4. 创建sched_key
5. **新增**：调用sched.set_param，触发compat过滤

**关键改动**:

```c
// 新增: 获取算法名
alg_name = wd_comp_alg_name[setup->alg_type];

// 新增: 兼容检查 (参数从driver改为config)
drv_support = wd_drv_alg_support(alg_name, &wd_comp_setting.config);
if (!drv_support)
    return (handle_t)0;

// 新增: 设置sched_key参数，触发compat过滤
memset(&params, 0, sizeof(params));
params.alg_name = alg_name;
params.ctxs = wd_comp_setting.config.ctxs;
wd_comp_setting.sched.set_param(
    wd_comp_setting.sched.h_sched_ctx,
    sess->sched_key, &params);
```

---

### 3.9 新增的框架函数（非ZIP独有）

以下函数在Design版本框架中新增，ZIP适配时调用：

| 函数 | 文件位置 | 用途 |
|------|----------|------|
| `wd_get_drv_array` | `wd_alg.c:682` | 发现驱动数组 |
| `wd_put_drv_array` | `wd_alg.c:651` | 释放驱动数组 |
| `wd_ctx_bind_drivers` | `wd_util.c:2229` | ctx绑定驱动 |
| `wd_ctx_unbind_drivers` | `wd_util.c` | 驱动解绑 |
| `wd_alg_init_driver` | `wd_util.c` | 驱动初始化 |
| `wd_alg_uninit_driver` | `wd_util.c` | 驱动反初始化 |
| `wd_drv_alg_support` | `wd_alg.c:463` | 兼容检查（遍历ctx） |
| `wd_sched_set_param` | `wd_sched.c:1795` | sched参数设置 |
| `wd_sched_skey_compat_filter` | `wd_sched.c:939` | compat过滤idx_list |

---

### 3.10 wd_get_drv_array 函数

**文件位置**: `wd_alg.c:682`

**函数签名**:

```c
int wd_get_drv_array(const char *alg_type, int task_type, char *drv_name,
                     struct wd_alg_driver ***drv_array, __u32 *drv_count)
```

#### 入参说明

| 参数 | 类型 | 用途 |
|------|------|------|
| `alg_type` | `const char*` | 算法类型：comp/cipher/digest |
| `task_type` | `int` | 任务类型：TASK_HW/TASK_INSTR/TASK_MIX |
| `drv_name` | `char*` | 驱动名提示：hisi_zip/hisi_sec2（可为NULL） |
| `drv_array` | `wd_alg_driver***` | 输出：驱动数组指针 |
| `drv_count` | `__u32*` | 输出：驱动数量 |

#### 返回值

| 返回值 | 含义 |
|--------|------|
| `0` | 成功 |
| `<0` | 失败 |

#### 函数功能

**功能描述**:
1. 遍历全局驱动注册链表 `alg_list_head`
2. 按 `alg_type` 和 `task_type` 过滤驱动
3. 按 `drv_name` 精确过滤（V1路径）
4. 去重，返回驱动数组

---

### 3.11 wd_ctx_bind_drivers 函数

**文件位置**: `wd_util.c:2229`

**函数签名**:

```c
int wd_ctx_bind_drivers(struct wd_ctx_config_internal *config,
                        struct wd_alg_driver **drv_array, __u32 drv_count)
```

#### 入参说明

| 参数 | 类型 | 用途 |
|------|------|------|
| `config` | `wd_ctx_config_internal*` | 内部ctx配置 |
| `drv_array` | `wd_alg_driver**` | 驱动数组 |
| `drv_count` | `__u32` | 驱动数量 |

#### 返回值

| 返回值 | 含义 |
|--------|------|
| `0` | 成功 |
| `<0` | 失败 |

#### 函数功能

**功能描述**:
```
for (i = 0; i < config->ctx_num; i++) {
    config->ctxs[i].drv = drv_array[i % drv_count];      // RR绑定驱动
    config->ctxs[i].ctx_type = drv->calc_type;           // 标记ctx类型
}
config->drv_array = drv_array;                           // 缓存驱动数组
config->drv_count = drv_count;
wd_alg_drv_ref_inc(drv_array, drv_count);               // 增加引用计数
```

---

### 3.12 wd_drv_alg_support 函数

**文件位置**: `wd_alg.c:463`

**函数签名**:

```c
bool wd_drv_alg_support(const char *alg_name, void *param)
```

#### 入参说明

| 参数 | 类型 | 用途 |
|------|------|------|
| `alg_name` | `const char*` | 目标算法名 |
| `param` | `void*` | wd_ctx_config_internal* 指针 |

#### 返回值

| 返回值 | 含义 |
|--------|------|
| `true` | 有ctx支持该算法 |
| `false` | 无ctx支持该算法 |

#### 函数功能

**功能描述**:
```
遍历 config->ctxs[0..ctx_num-1]
    drv = ctxs[i].drv
    wd_alg_match_drv(drv, alg_name)  // 检查drv是否支持alg_name
    如果支持 → 返回 true
全部不支持 → 返回 false
```

---

### 3.13 wd_sched_set_param 函数

**文件位置**: `wd_sched.c:1795`

**函数签名**:

```c
static void wd_sched_set_param(handle_t h_sched_ctx, void *sched_key,
                               struct wd_sched_params *params)
```

#### 入参说明

| 参数 | 类型 | 用途 |
|------|------|------|
| `h_sched_ctx` | `handle_t` | 调度器句柄 |
| `sched_key` | `void*` | sched_key指针 |
| `params` | `wd_sched_params*` | 参数结构 |

#### 返回值

无返回值

#### 函数功能

**功能描述**:
```
skey->alg_name = params->alg_name
skey->ctxs = params->ctxs

wd_sched_skey_compat_filter(sched_ctx, skey, &skey->sync_domain, SYNC)  // 过滤sync_domain
wd_sched_skey_compat_filter(sched_ctx, skey, &skey->async_domain, ASYNC) // 过滤async_domain
```

---

### 3.14 wd_sched_skey_compat_filter 函数

**文件位置**: `wd_sched.c:939`

**函数签名**:

```c
static void wd_sched_skey_compat_filter(struct wd_sched_ctx *sched_ctx,
    struct wd_sched_key *skey, struct wd_sched_key_domain *domain, int sched_mode)
```

#### 入参说明

| 参数 | 类型 | 用途 |
|------|------|------|
| `sched_ctx` | `wd_sched_ctx*` | 调度器上下文 |
| `skey` | `wd_sched_key*` | sched_key指针 |
| `domain` | `wd_sched_key_domain*` | 目标调度域（sync/async） |
| `sched_mode` | `int` | 调度模式：SYNC/ASYNC |

#### 返回值

无返回值

#### 函数功能

**功能描述**（compat过滤核心）:
```
for (i = 0; i < domain->idx_cache.valid_count; i++) {
    ctx_idx = idx_list[i]
    drv = ctxs[ctx_idx].drv
    
    if (!wd_alg_match_drv(drv, skey->alg_name)) {
        // 不兼容，替换为兼容ctx
        new_ctx = session_sched_init_ctx(..., skey)
        idx_list[i] = new_ctx
    }
}

结果: idx_list 只包含支持 alg_name 的ctx索引
```

---

## 四、流程设计

### 4.1 V1路径初始化流程

```
wd_comp_init(config, sched)
    │
    ├─ Phase 1: wd_comp_init_nolock(config, sched, NULL)
    │     wd_init_ctx_config → 复制config
    │     wd_init_sched → 复制sched
    │     wd_init_async_request_pool → 创建请求池
    │
    ├─ Phase 2: wd_get_drv_array("comp", TASK_HW, "hisi_zip")
    │     遍历全局链表 → drv_array[0]=hisi_zip
    │     drv_count = 1
    │
    ├─ Phase 2.5: wd_ctx_bind_drivers(config, drv_array, drv_count)
    │     ctxs[0-15].drv = drv_array[0]
    │     ctxs[0-15].ctx_type = HW
    │
    ├─ Phase 3: wd_alg_init_driver(config)
    │     drv->init(ctx)
    │
    └─ wd_alg_set_init → 标记初始化完成
```

---

### 4.2 V2路径初始化流程

```
wd_comp_init2_("zlib", SCHED_POLICY_RR, TASK_HW, ctx_params)
    │
    ├─ wd_alg_attrs_init(attrs)
    │     ├─ Phase 1: wd_alg_drv_discover(attrs)
    │     │     wd_get_drv_array("comp", TASK_HW, NULL)
    │     │     attrs.drv_array[0] = hisi_zip
    │     │     attrs.drv_count = 1
    │     │
    │     ├─ Phase 2: wd_alg_ctx_init(attrs)
    │     │     wd_ctxs_unified_alloc → 分配ctx
    │     │     wd_sched_rr_alloc → 创建调度器
    │     │     wd_comp_init_nolock(attrs)
    │     │         attrs.ctx_config_internal = &config
    │     │
    │     └ wd_alg_drv_undiscover(attrs)
    │
    ├─ Phase 2.5: wd_ctx_bind_drivers(config, drv_array, drv_count)
    │     ctxs[i].drv = drv_array[i % drv_count]
    │     ctxs[i].ctx_type = drv->calc_type
    │
    ├─ Phase 3: wd_alg_init_driver(config)
    │     drv->init(ctx)
    │
    └─ wd_alg_set_init → 标记初始化完成
```

---

### 4.3 Session创建流程

```
wd_comp_alloc_sess(setup)
    │
    ├─ 获取算法名
    │     alg_name = wd_comp_alg_name[setup->alg_type]
    │
    ├─ 兼容检查
    │     wd_drv_alg_support(alg_name, config)
    │         for (i=0; i<ctx_num; i++)
    │             drv = ctxs[i].drv
    │             wd_alg_match_drv(drv, alg_name)
    │         → 有兼容ctx返回true
    │
    ├─ 创建sched_key
    │     sched.sched_init(h_sched_ctx, setup.sched_param)
    │     → 预填充idx_list (全部ctx)
    │
    ├─ 参数设置 (触发compat过滤)
    │     params.alg_name = alg_name
    │     params.ctxs = config.ctxs
    │     sched.set_param(h_sched_ctx, sched_key, params)
    │         wd_sched_skey_compat_filter(sync_domain)
    │         wd_sched_skey_compat_filter(async_domain)
    │         → idx_list只含兼容ctx
    │
    └─ 返回sess
```

---

### 4.4 业务执行流程

```
wd_do_comp_sync(sess, req)
    │
    ├─ 选择ctx
    │     sched.pick_next_ctx(h_sched_ctx, sched_key, CTX_MODE_SYNC)
    │         domain = sync_domain
    │         idx = idx_list[rr_ptr % valid_count]
    │         → ctx_pos = idx
    │
    ├─ 执行压缩
    │     ctx = ctxs[ctx_pos].ctx
    │     drv = ctxs[ctx_pos].drv
    │     drv->send(ctx, msg)
    │     drv->recv(ctx, msg) → 阻塞等待
    │
    └─ 返回结果
```

---

## 五、总结

### 5.1 改动总结

| 改动类型 | 数量 | 涉及内容 |
|----------|------|----------|
| **结构体修改** | 7个 | 新增drv_array、drv、ctx_type、set_param等字段 |
| **结构体新增** | 1个 | wd_sched_params |
| **函数签名修改** | 2个 | wd_comp_init_nolock、wd_comp_alloc_sess |
| **函数逻辑修改** | 6个 | init/uninit/init2_/uninit2/alloc_sess/uninit_nolock |
| **新增调用** | 6个 | wd_get_drv_array、wd_ctx_bind_drivers、wd_alg_init_driver等 |

**总改动量**: ~80行代码

---

### 5.2 异构调度核心逻辑

```
Init阶段:
  驱动发现 → drv_array[]
  ctx分配 → ctxs[]
  驱动绑定 → ctxs[i].drv (静态绑定)
  
Session阶段:
  兼容检查 → wd_drv_alg_support
  参数设置 → sched.set_param
  compat过滤 → idx_list (动态过滤)
  
业务阶段:
  选择ctx → pick_next_ctx(idx_list)
  执行任务 → drv->send/recv
```

---

### 5.3 关键概念映射

| 概念 | 数据结构 | 作用 |
|------|----------|------|
| **驱动数组** | drv_array[] | 多驱动管理 |
| **ctx绑定drv** | ctxs[i].drv | 静态绑定，init时完成 |
| **ctx类型** | ctxs[i].ctx_type | HW/CE/SVE标记 |
| **调度域(sd)** | sync_domain/async_domain | 存储兼容ctx索引 |
| **idx_list** | sd.idx_cache.idx_list[] | **核心**：兼容ctx索引数组 |
| **compat过滤** | wd_sched_skey_compat_filter | 过滤idx_list |
| **四阶段流程** | Phase 1→2→2.5→3 | 统一初始化流程 |

---

### 5.4 验收标准

| 验收项 | 标准 |
|--------|------|
| drv_count | ≥ 1 |
| ctxs[i].drv | 非空 |
| ctxs[i].ctx_type | HW=0 |
| idx_list valid_count | > 0 |
| 基础业务 | 压缩/解压缩正常 |
| 性能 | 不低于Origin版本 |


迭代涉及结构体：
类别	数量	结构体
核心修改	5	wd_init_attrs, wd_ctx_config_internal, wd_ctx_internal, wd_sched, wd_sched_params
调度域(sd)	3	wd_sched_key, wd_sched_key_domain, wd_sched_domain_idx_cache
ctx标记	2	wd_ctx, wd_ctx_nums
驱动	1	wd_alg_driver
用户接口	2	wd_comp_sess_setup, wd_comp_sess
配置参数	2	wd_ctx_params, wd_ctx_config
框架内部	2	wd_sched_ctx, wd_sched_ctx_domain