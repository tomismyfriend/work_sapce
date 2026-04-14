# UADK Tool 代码框架深度解析

基于官方代码仓库 `uadk-official/uadk_tool` 进行深度解析。

---

## 一、代码目录结构

```
uadk_tool/
│
├── uadk_tool.c                 # 主入口文件（命令解析、子模块分发）
│
├── benchmark/                  # 性能测试模块
│   ├── uadk_benchmark.c        # benchmark 核心框架（参数解析、调度、统计）
│   ├── uadk_benchmark.h        # 核心头文件（数据结构、枚举定义）
│   │
│   ├── sec_uadk_benchmark.c    # SEC UADK 接口测试（SVA模式）
│   ├── sec_wd_benchmark.c      # SEC WD 接口测试（No-SVA模式）
│   ├── sec_soft_benchmark.c    # SEC 软件模式测试（OpenSSL）
│   │
│   ├── hpre_uadk_benchmark.c   # HPRE UADK 接口测试
│   ├── hpre_wd_benchmark.c     # HPRE WD 接口测试
│   │
│   ├── zip_uadk_benchmark.c    # ZIP UADK 接口测试
│   ├── zip_wd_benchmark.c      # ZIP WD 接口测试
│   │
│   └── include/fse.h           # FSE 相关头文件
│
├── dfx/                        # 诊断调试模块
│   ├── uadk_dfx.c              # dfx 功能实现
│   ├── uadk_dfx.h              # dfx 头文件
│
└── test/                       # 正确性测试模块
    ├── uadk_test.c             # test 入口
    ├── test_sec.c              # SEC 正确性测试
    ├── comp_main.c             # ZIP 压缩测试
    ├── comp_lib.c              # ZIP 库函数
```

---

## 二、主入口流程分析 (uadk_tool.c)

### 2.1 入口函数

```c
int main(int argc, char **argv)
{
    struct acc_option option = {0};
    int index = 1;
    
    if (argc > index) {
        if (!strcmp("dfx", argv[index])) {
            dfx_cmd_parse(argc, argv);          // → dfx 模块
        } else if (!strcmp("benchmark", argv[index])) {
            acc_cmd_parse(argc, argv, &option); // 解析参数
            acc_option_convert(&option);        // 参数校验转换
            acc_benchmark_run(&option);         // → benchmark 模块
        } else if (!strcmp("test", argv[index])) {
            acc_test_run(argc, argv);           // → test 模块
        } else {
            print_tool_help();                  // 显示帮助
        }
    }
    return 0;
}
```

### 2.2 命令分发流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           main(argc, argv)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   "dfx" 分支    │   │ "benchmark" 分支│   │   "test" 分支   │
│                 │   │                 │   │                 │
│ dfx_cmd_parse() │   │ acc_cmd_parse() │   │ acc_test_run()  │
│                 │   │ acc_option_conv │   │                 │
│                 │   │ acc_benchmark_  │   │                 │
│                 │   │    run()        │   │                 │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 三、Benchmark 核心框架分析

### 3.1 核心数据结构

#### acc_option（测试参数配置）

```c
struct acc_option {
    char algname[64];      // 算法名称：aes-128-cbc
    char algclass[64];     // 算法类别：cipher/digest/aead
    char engine[64];       // OpenSSL引擎名
    char device[64];       // 设备名称：hisi_sec2-0
    
    u32 algtype;           // 算法枚举值：AES_128_CBC
    u32 modetype;          // 运行模式：SVA_MODE/NOSVA_MODE/SOFT_MODE
    u32 optype;            // 操作类型：加密/解密/签名/验签
    u32 syncmode;          // 同步/异步：SYNC_MODE/ASYNC_MODE
    u32 pktlen;            // 数据包长度
    u32 times;             // 测试时长（秒）
    u32 threads;           // 线程数
    u32 multis;            // 进程数
    u32 ctxnums;           // 上下文数量（QP数量）
    u32 prefetch;          // 预取标志
    u32 winsize;           // 窗口大小（流压缩）
    u32 complevel;         // 压缩级别
    u32 inittype;          // 初始化类型：INIT_TYPE/INIT2_TYPE
    bool latency;          // 延迟测试标志
    u32 sched_type;        // 调度策略
    int task_type;         // 任务类型：TASK_HW/TASK_INSTR
    int mem_type;          // 内存模式：UADK_AUTO/UADK_MANUAL/UADK_PROXY
    u32 data_fmt;          // 数据格式：WD_FLAT_BUF/WD_SGL_BUF
};
```

#### 算法类型枚举

```c
enum alg_type {
    DEFAULT_TYPE,
    CIPHER_TYPE,      // 对称加密
    AEAD_TYPE,        // 认证加密
    DIGEST_TYPE,      // 哈希摘要
    RSA_TYPE,         // RSA
    DH_TYPE,          // DH
    ECDH_TYPE,        // ECDH
    ECDSA_TYPE,       // ECDSA
    SM2_TYPE,         // SM2
    X25519_TYPE,      // X25519
    X448_TYPE,        // X448
    CIPHER_INSTR_TYPE,// 指令模式加密
};
```

#### 运行模式枚举

```c
enum test_type {
    SVA_MODE      = 0x1,  // SVA模式（硬件支持虚拟化地址）
    NOSVA_MODE    = 0x2,  // No-SVA模式（传统DMA）
    SOFT_MODE     = 0x4,  // 纯软件模式（OpenSSL）
    SVA_SOFT      = 0x5,  // SVA+软件
    NOSVA_SOFT    = 0x6,  // No-SVA+软件
    INSTR_MODE    = 0x7,  // 指令模式（CPU指令加速）
    MULTIBUF_MODE = 0x8,  // 多缓冲模式
};
```

### 3.2 Benchmark 主流程

```c
int acc_benchmark_run(struct acc_option *option)
{
    // 1. 设置默认调度策略
    option->sched_type = SCHED_POLICY_RR;
    option->task_type = TASK_HW;
    
    // 2. 解析算法参数，确定 acctype/subtype
    parse_alg_param(option);
    
    // 3. 多进程模式：fork 子进程
    if (option->multis > 1) {
        for (i = 0; i < option->multis; i++) {
            pid = fork();
            if (pid == 0) {
                exit(benchmark_run(option));  // 子进程执行测试
            }
        }
        // 父进程等待子进程完成
        waitpid(pid, &status, 0);
    } else {
        // 单进程模式
        ret = benchmark_run(option);
    }
    
    return ret;
}
```

### 3.3 benchmark_run 核心逻辑

```c
static int benchmark_run(struct acc_option *option)
{
    switch(option->acctype) {
    case SEC_TYPE:
        if (option->modetype == SVA_MODE)
            ret = sec_uadk_benchmark(option);   // UADK SVA
        else if (option->modetype == NOSVA_MODE)
            ret = sec_wd_benchmark(option);     // WD No-SVA
        #ifdef HAVE_CRYPTO
        if (option->modetype == SOFT_MODE)
            ret = sec_soft_benchmark(option);   // OpenSSL
        #endif
        break;
        
    case HPRE_TYPE:
        if (option->modetype == SVA_MODE)
            ret = hpre_uadk_benchmark(option);
        else if (option->modetype == NOSVA_MODE)
            ret = hpre_wd_benchmark(option);
        break;
        
    case ZIP_TYPE:
        if (option->modetype == SVA_MODE)
            ret = zip_uadk_benchmark(option);
        else if (option->modetype == NOSVA_MODE)
            ret = zip_wd_benchmark(option);
        break;
    }
    return ret;
}
```

---

## 四、SEC UADK Benchmark 详细分析

### 4.1 核心数据结构

```c
// BD（Buffer Descriptor）结构
struct uadk_bd {
    u8 *src;    // 源数据地址
    u8 *dst;    // 目标数据地址
    u8 *mac;    // MAC/AEAD 认证标签
};

// BD池结构（每个线程一个）
struct bd_pool {
    struct uadk_bd *bds;  // BD数组
};

// 线程池结构
struct thread_pool {
    struct bd_pool *pool;  // BD池数组（每线程一个池）
    u8 **iv;               // IV数组（每线程一个）
    u8 **key;              // Key数组（每线程一个）
    u8 **hash;             // Hash数组（HMAC用）
    void *rsv_pool;        // 预留内存池（No-SVA模式）
} g_uadk_pool;

// 线程参数
typedef struct uadk_thread_res {
    u32 subtype;     // 子类型：CIPHER/AEAD/DIGEST
    u32 alg;         // 算法：WD_CIPHER_AES
    u32 mode;        // 模式：WD_CIPHER_CBC
    u32 keysize;     // 密钥长度
    u32 ivsize;      // IV长度
    u32 optype;      // 操作类型
    u32 td_id;       // 线程ID
    bool is_union;   // 是否组合模式（cipher+digest）
    u32 dalg;        // 摘要算法
    u32 dmode;       // 摘要模式
    u32 d_outbytes;  // 摘要输出长度
    int mm_type;     // 内存类型
} thread_data;
```

### 4.2 主测试流程

```c
int sec_uadk_benchmark(struct acc_option *options)
{
    // ========== 1. 初始化阶段 ==========
    
    // 1.1 设置全局变量
    g_thread_num = options->threads;
    g_pktlen = options->pktlen;
    g_ctxnum = options->ctxnums;
    g_prefetch = options->prefetch;
    g_alg = options->subtype;
    g_optype = options->optype;
    
    // 1.2 初始化上下文配置
    if (options->inittype == INIT2_TYPE)
        ret = init_ctx_config2(options);   // init2 方式
    else
        ret = init_ctx_config(options);    // init 方式
    
    // 1.3 初始化数据缓冲池
    if (options->mem_type == UADK_AUTO)
        ret = init_uadk_bd_pool();         // SVA 模式（普通malloc）
    else
        ret = init_uadk_rsv_pool(options); // No-SVA 模式（wd_mem_alloc）
    
    // ========== 2. 执行阶段 ==========
    
    // 2.1 启动计时器
    get_pid_cpu_time(&ptime);
    time_start(options->times);   // 设置 alarm 定时
    
    // 2.2 创建线程执行测试
    if (options->syncmode)
        ret = sec_uadk_async_threads(options);  // 异步模式
    else
        ret = sec_uadk_sync_threads(options);   // 同步模式
    
    // 2.3 计算性能数据
    cal_perfermance_data(options, ptime);
    
    // ========== 3. 清理阶段 ==========
    
    // 3.1 释放缓冲池
    if (options->mem_type == UADK_AUTO)
        free_uadk_bd_pool();
    else
        free_uadk_rsv_pool(options);
    
    // 3.2 反初始化上下文
    if (options->inittype == INIT2_TYPE)
        uninit_ctx_config2(options->subtype);
    else
        uninit_ctx_config(options->subtype);
    
    return 0;
}
```

### 4.3 上下文初始化流程

```c
static int init_ctx_config(struct acc_option *options)
{
    // 1. 分配上下文配置结构
    g_ctx_cfg.ctx_num = g_ctxnum;
    g_ctx_cfg.ctxs = calloc(g_ctxnum, sizeof(struct wd_ctx));
    
    // 2. 申请设备上下文
    if (strlen(options->device) != 0)
        ret = specified_device_request_ctx(options);   // 指定设备
    else
        ret = non_specified_device_request_ctx(options); // 自动选择
    
    // 3. 创建调度器
    switch(subtype) {
    case CIPHER_TYPE:
        g_sched = wd_sched_rr_alloc(SCHED_POLICY_RR, ...);
        break;
    case AEAD_TYPE:
        g_sched = wd_sched_rr_alloc(SCHED_POLICY_RR, ...);
        break;
    case DIGEST_TYPE:
        g_sched = wd_sched_rr_alloc(SCHED_POLICY_RR, ...);
        break;
    }
    
    // 4. 配置调度参数
    param.numa_id = 0;
    param.type = 0;
    param.mode = mode;
    param.begin = 0;
    param.end = g_ctxnum - 1;
    wd_sched_rr_instance(g_sched, &param);
    
    // 5. 初始化算法框架
    switch(subtype) {
    case CIPHER_TYPE:
        ret = wd_cipher_init(&g_ctx_cfg, g_sched);
        break;
    case AEAD_TYPE:
        ret = wd_aead_init(&g_ctx_cfg, g_sched);
        break;
    case DIGEST_TYPE:
        ret = wd_digest_init(&g_ctx_cfg, g_sched);
        break;
    }
    
    return 0;
}
```

### 4.4 同步模式线程执行

```c
static void *sec_uadk_cipher_sync(void *arg)
{
    thread_data *pdata = (thread_data *)arg;
    struct wd_cipher_sess_setup cipher_setup = {0};
    struct wd_cipher_req creq;
    handle_t h_sess;
    u32 count = 0;
    
    // 1. 配置会话参数
    cipher_setup.alg = pdata->alg;        // WD_CIPHER_AES
    cipher_setup.mode = pdata->mode;      // WD_CIPHER_CBC
    cipher_setup.sched_param = &sc_param;
    cipher_setup.mm_type = pdata->mm_type;
    
    // 2. 创建会话
    h_sess = wd_cipher_alloc_sess(&cipher_setup);
    wd_cipher_set_key(h_sess, priv_key, pdata->keysize);
    
    // 3. 配置请求参数
    creq.op_type = pdata->optype;         // 加密/解密
    creq.iv = priv_iv;
    creq.iv_bytes = pdata->ivsize;
    creq.in_bytes = g_pktlen;
    creq.out_bytes = g_pktlen;
    creq.data_fmt = g_data_fmt;
    
    // 4. 循环执行加密操作
    while(1) {
        i = count % MAX_POOL_LENTH;
        creq.src = uadk_pool->bds[i].src;
        creq.dst = uadk_pool->bds[i].dst;
        
        ret = wd_do_cipher_sync(h_sess, &creq);
        count++;
        
        if (get_run_state() == 0)  // 定时结束
            break;
    }
    
    // 5. 统计数据、释放资源
    cal_avg_latency(count);
    add_recv_data(count, g_pktlen);
    wd_cipher_free_sess(h_sess);
    
    return NULL;
}
```

### 4.5 异步模式线程执行

```c
static void *sec_uadk_cipher_async(void *arg)
{
    // ... 初始化会话（与同步模式相同） ...
    
    // 循环发送异步请求
    while(1) {
        if (get_run_state() == 0)
            break;
        
        creq.src = uadk_pool->bds[i].src;
        creq.dst = uadk_pool->bds[i].dst;
        
        // 发送异步请求（返回前不等待完成）
        ret = wd_do_cipher_async(h_sess, &creq);
        if (ret < 0) {
            usleep(SEND_USLEEP);
            continue;
        }
        count++;
    }
    
    // 等待 poll 线程完成
    while (get_recv_time() != g_ctxnum) {
        usleep(SEND_USLEEP);
    }
    
    wd_cipher_free_sess(h_sess);
    add_send_complete();
    
    return NULL;
}
```

### 4.6 异步 Poll 线程

```c
static void *sec_uadk_poll(void *data)
{
    typedef int (*poll_ctx)(__u32 idx, __u32 expt, __u32 *count);
    poll_ctx uadk_poll_ctx = NULL;
    u32 count = 0;
    u32 recv = 0;
    
    // 选择 poll 函数
    switch(pdata->subtype) {
    case CIPHER_TYPE:
        uadk_poll_ctx = wd_cipher_poll_ctx;
        break;
    case AEAD_TYPE:
        uadk_poll_ctx = wd_aead_poll_ctx;
        break;
    case DIGEST_TYPE:
        uadk_poll_ctx = wd_digest_poll_ctx;
        break;
    }
    
    // 循环 poll 完成结果
    while (last_time) {
        ret = uadk_poll_ctx(id, expt, &recv);
        count += recv;
        recv = 0;
        
        if (get_run_state() == 0)
            last_time--;
    }
    
    add_recv_data(count, g_pktlen);
    
    return NULL;
}
```

---

## 五、线程模型分析

### 5.1 同步模式线程模型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         同步模式线程模型                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Main Thread                                                                │
│      │                                                                      │
│      ├─ pthread_create → Thread 0                                          │
│      │      └─ wd_do_cipher_sync() ← 阻塞等待硬件完成                       │
│      │      └ count++, 统计                                                │
│      │                                                                      │
│      ├─ pthread_create → Thread 1                                          │
│      │      └─ wd_do_cipher_sync() ← 阻塞等待硬件完成                       │
│      │                                                                      │
│      ├─ pthread_create → Thread 2                                          │
│      │      └─ ...                                                         │
│      │                                                                      │
│      └─ pthread_join() 等待所有线程结束                                     │
│                                                                             │
│  特点：每个线程独立执行，发送请求后阻塞等待硬件返回                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 异步模式线程模型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         异步模式线程模型                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Main Thread                                                                │
│      │                                                                      │
│      ├─ pthread_create → Poll Thread 0                                     │
│      │      └─ wd_cipher_poll_ctx() ← 不断 poll 完成结果                    │
│      │      └ add_recv_data(count)                                         │
│      │                                                                      │
│      ├─ pthread_create → Poll Thread 1                                     │
│      │      └─ wd_cipher_poll_ctx()                                        │
│      │                                                                      │
│      ├─ pthread_create → Worker Thread 0                                   │
│      │      └ wd_do_cipher_async() ← 发送请求后立即返回                     │
│      │       count++                                                        │
│      │                                                                      │
│      ├─ pthread_create → Worker Thread 1                                   │
│      │      └ wd_do_cipher_async()                                         │
│      │                                                                      │
│      └─ pthread_join() 等待所有线程结束                                     │
│                                                                             │
│  特点：Worker线程只发送，Poll线程专门收割结果，实现异步流水线                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、数据缓冲池管理

### 6.1 SVA 模式缓冲池（malloc）

```c
static int init_uadk_bd_pool(void)
{
    // 1. 分配 IV/Key/Hash
    init_ivkey_source();
    
    // 2. 分配线程池结构
    g_uadk_pool.pool = malloc(g_thread_num * sizeof(struct bd_pool));
    
    // 3. 为每个线程分配 BD 数组
    for (i = 0; i < g_thread_num; i++) {
        g_uadk_pool.pool[i].bds = malloc(MAX_POOL_LENTH * sizeof(struct uadk_bd));
        
        // 4. 为每个 BD 分配 src/dst/mac 缓冲区
        for (j = 0; j < MAX_POOL_LENTH; j++) {
            g_uadk_pool.pool[i].bds[j].src = malloc(step);
            g_uadk_pool.pool[i].bds[j].dst = malloc(step);
            g_uadk_pool.pool[i].bds[j].mac = malloc(SEC_MAX_MAC_LEN);
            
            // 填充随机数据
            get_rand_data(g_uadk_pool.pool[i].bds[j].src, g_pktlen);
        }
    }
    
    return 0;
}
```

### 6.2 No-SVA 模式缓冲池（wd_mem_alloc）

```c
static int init_uadk_rsv_pool(struct acc_option *option)
{
    handle_t h_ctx;
    
    // 1. 获取上下文
    h_ctx = wd_find_ctx(alg);
    
    // 2. 创建内存池
    pool_setup.block_size = step;
    pool_setup.block_num = g_thread_num * MAX_POOL_LENTH * 8;
    pool_setup.align_size = SQE_SIZE;
    g_uadk_pool.rsv_pool = wd_mempool_alloc(h_ctx, &pool_setup);
    
    // 3. 从内存池分配 IV/Key
    init_rsv_ivkey(h_ctx, g_uadk_pool.rsv_pool);
    
    // 4. 从内存池分配 src/dst/mac
    for (i = 0; i < g_thread_num; i++) {
        for (j = 0; j < MAX_POOL_LENTH; j++) {
            g_uadk_pool.pool[i].bds[j].src = wd_mem_alloc(g_uadk_pool.rsv_pool, len);
            g_uadk_pool.pool[i].bds[j].dst = wd_mem_alloc(g_uadk_pool.rsv_pool, len);
            g_uadk_pool.pool[i].bds[j].mac = wd_mem_alloc(g_uadk_pool.rsv_pool, SEC_MAX_MAC_LEN);
        }
    }
    
    return 0;
}
```

---

## 七、性能统计机制

### 7.1 全局统计变量

```c
static struct _recv_data {
    double pkg_len;      // 平均包长度
    u64 send_cnt;        // 发送计数
    u64 recv_cnt;        // 接收计数
    u32 send_times;      // 发送次数
    u32 recv_times;      // 接收次数
} g_recv_data;

static pthread_mutex_t acc_mutex = PTHREAD_MUTEX_INITIALIZER;
```

### 7.2 统计函数

```c
void add_recv_data(u32 cnt, u32 pkglen)
{
    pthread_mutex_lock(&acc_mutex);
    g_recv_data.recv_cnt += cnt;
    g_recv_data.pkg_len = (pkglen + g_recv_data.pkg_len) / 2;  // 平均值
    g_recv_data.recv_times++;
    pthread_mutex_unlock(&acc_mutex);
}

void cal_perfermance_data(struct acc_option *option, u32 sttime)
{
    // 计算吞吐量
    perfdata = g_recv_data.pkg_len * g_recv_data.recv_cnt / 1024.0;
    perfermance = perfdata / option->times;  // KiB/s
    
    // 计算操作速率
    perfops = g_recv_data.recv_cnt / 1000.0;
    ops = perfops / option->times;  // Kops
    
    // 计算CPU占用率
    cpu_rate = (double)ptime / option->times;
    
    printf("algname:\tlength:\tperf:\tiops:\tCPU_rate:\n"
           "%s\t%uBytes\t%.2fKiB/s\t%.1fKops\t%.2f%%\n", ...);
}
```

---

## 八、计时控制机制

### 8.1 Alarm 定时器

```c
static void alarm_end(int sig, siginfo_t *info, void *context)
{
    if (sig == SIGALRM) {
        set_run_state(0);   // 设置结束标志
        alarm(0);           // 取消 alarm
    }
}

void time_start(u32 seconds)
{
    struct sigaction sa = {
        .sa_sigaction = alarm_end,
        .sa_flags = SA_SIGINFO | SA_RESETHAND
    };
    sigaction(SIGALRM, &sa, NULL);
    
    set_run_state(1);       // 设置运行状态
    init_recv_data();       // 清零统计数据
    alarm(seconds);         // 设置定时器
}
```

### 8.2 运行状态检查

```c
static unsigned int g_run_state = 1;  // 1=运行，0=停止

int get_run_state(void)
{
    return g_run_state;
}

void set_run_state(int state)
{
    g_run_state = state;
}

// 线程中检查
while(1) {
    if (get_run_state() == 0)  // 定时结束
        break;
    // ... 执行操作 ...
}
```

---

## 九、HPRE/ZIP Benchmark 结构对比

### 9.1 HPRE 结构特点

```c
// HPRE 线程参数
typedef struct uadk_thread_res {
    u32 subtype;    // RSA_TYPE/DH_TYPE/ECDH_TYPE/ECDSA_TYPE/SM2_TYPE
    u32 keybits;    // 密钥长度：1024/2048/3072/4096
    u32 kmode;      // 密钥模式：CRT/非CRT
    u32 optype;     // 操作：keygen/sharekey/enc/dec/sign/verify
    u32 td_id;
    u32 algtype;
    int mm_type;
} thread_data;

// RSA 密钥结构
struct hpre_rsa_key_in {
    void *e;        // 公钥指数
    void *p;        // 素数 p（CRT模式）
    void *q;        // 素数 q（CRT模式）
    u32 e_size;
    u32 p_size;
    u32 q_size;
};

// DH 参数结构
struct hpre_dh_param {
    const void *x;          // 私钥
    const void *p;          // 素数
    const void *g;          // 生成元
    const void *pub_key;    // 公钥
    const void *share_key;  // 共享密钥
    u32 key_bits;
    u32 optype;             // WD_DH_PHASE1/WD_DH_PHASE2
};

// ECC 参数结构
struct hpre_ecc_setup {
    void *except_pub_key;   // ECDH phase2 用
    const void *pub_key;    // ECDH phase1 用
    const void *share_key;  // ECDH phase2 用
    const void *digest;     // ECDSA sign 用
    const void *sign;       // 签名结果
    const void *priv_key;   // 私钥
    u32 key_size;
    u32 key_bits;
    u32 curve_id;           // 曲线 ID
};
```

### 9.2 ZIP 结构特点

```c
// ZIP BD 结构
struct uadk_bd {
    u8 *src;
    u8 *dst;
    u32 src_len;    // 源长度
    u32 dst_len;    // 目标长度（压缩后）
};

// ZIP 线程参数
typedef struct uadk_thread_res {
    u32 alg;        // zlib/gzip/deflate/lz4
    u32 mode;       // BLOCK_MODE/STREAM_MODE
    u32 optype;     // WD_DIR_COMPRESS/WD_DIR_DECOMPRESS
    u32 td_id;
    u32 win_sz;     // 窗口大小
    u32 comp_lv;    // 压缩级别
    u32 send_cnt;
} thread_data;

// ZIP 异步标签
struct zip_async_tag {
    handle_t sess;
    u32 td_id;
    u32 bd_idx;
    u32 cm_len;     // 压缩长度
    u32 recv_cnt;
};
```

---

## 十、关键调用链总结

### 10.1 SEC 同步模式完整调用链

```
uadk_tool benchmark --alg aes-128-cbc --mode sva --sync
    │
    ▼
main() → acc_benchmark_run() → benchmark_run() → sec_uadk_benchmark()
    │
    ├─ init_ctx_config()
    │     ├─ wd_request_ctx()          // 申请设备上下文
    │     ├─ wd_sched_rr_alloc()       // 创建调度器
    │     └─ wd_cipher_init()          // 初始化 Cipher 框架
    │
    ├─ init_uadk_bd_pool()
    │     └─ malloc()                  // 分配数据缓冲区
    │
    ├─ time_start()                    // 启动定时器
    │
    ├─ sec_uadk_sync_threads()
    │     └─ pthread_create() → sec_uadk_cipher_sync()
    │           ├─ wd_cipher_alloc_sess()     // 创建会话
    │           ├─ wd_cipher_set_key()        // 设置密钥
    │           └─ while(1) wd_do_cipher_sync() // 循环加密
    │                 └─ [硬件执行，阻塞等待]
    │
    ├─ cal_perfermance_data()          // 计算性能
    │
    ├─ free_uadk_bd_pool()
    │
    └─ uninit_ctx_config()
         ├─ wd_cipher_uninit()
         ├─ wd_release_ctx()
         └─ wd_sched_rr_release()
```

### 10.2 SEC 异步模式完整调用链

```
uadk_tool benchmark --alg aes-128-cbc --mode sva --async
    │
    ▼
sec_uadk_benchmark() → sec_uadk_async_threads()
    │
    ├─ pthread_create() → sec_uadk_poll()        // Poll 线程
    │     └─ while(1) wd_cipher_poll_ctx()       // 收割完成结果
    │           └─ [从设备读取完成队列]
    │           └─ add_recv_data()
    │
    ├─ pthread_create() → sec_uadk_cipher_async() // Worker 线程
    │     ├─ wd_cipher_alloc_sess()
    │     ├─ wd_cipher_set_key()
    │     └─ while(1) wd_do_cipher_async()       // 发送请求
    │           └─ [写入设备请求队列，立即返回]
    │           └ count++
    │
    └─ pthread_join()                           // 等待线程结束
```

---

## 十一、代码分层架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              应用层                                          │
│  uadk_tool.c - 命令解析、子模块分发                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            测试框架层                                        │
│  uadk_benchmark.c - 参数解析、线程管理、性能统计                              │
│  sec_uadk_benchmark.c - SEC 测试逻辑                                         │
│  hpre_uadk_benchmark.c - HPRE 测试逻辑                                       │
│  zip_uadk_benchmark.c - ZIP 测试逻辑                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            UADK 核心库层                                     │
│  wd_cipher.c   - wd_cipher_init/alloc_sess/do_cipher_sync/async              │
│  wd_digest.c   - wd_digest_init/alloc_sess/do_digest_sync/async              │
│  wd_aead.c     - wd_aead_init/alloc_sess/do_aead_sync/async                  │
│  wd_rsa.c      - wd_rsa_init/alloc_sess/do_rsa                              │
│  wd_dh.c       - wd_dh_init/alloc_sess/do_dh                                │
│  wd_ecc.c      - wd_ecc_init/alloc_sess/do_ecc                              │
│  wd_comp.c     - wd_comp_init/alloc_sess/do_comp_sync/async                  │
│  wd_sched.c    - wd_sched_rr_alloc/instance                                 │
│  wd.c          - wd_request_ctx/release_ctx                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            内核驱动层                                        │
│  hisi_qm.ko   - QM 框架驱动（队列管理、中断、DMA）                            │
│  hisi_sec.ko  - SEC 加密驱动                                                 │
│  hisi_hpre.ko - HPRE 公钥驱动                                                │
│  hisi_zip.ko  - ZIP 压缩驱动                                                 │
│  uacce.ko     - 用户态加速框架                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            硬件层                                            │
│  hisi_sec2   - SEC 加密引擎                                                  │
│  hisi_hpre   - HPRE 公钥引擎                                                 │
│  hisi_zip    - ZIP 压缩引擎                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 十二、关键设计模式总结

### 12.1 数据结构设计

| 结构 | 作用 | 设计特点 |
|------|------|----------|
| `acc_option` | 参数配置 | 集中管理所有测试参数 |
| `uadk_bd` | 数据缓冲 | src/dst/mac 分离，便于 DMA |
| `bd_pool` | BD池 | 每线程独立池，避免竞争 |
| `thread_pool` | 线程池 | 全局池管理所有线程资源 |
| `thread_data` | 线程参数 | 传递给线程的参数结构 |

### 12.2 并发模型

| 模式 | 特点 | 适用场景 |
|------|------|----------|
| 同步模式 | 单线程阻塞执行 | 低延迟场景 |
| 异步模式 | Worker+Poll 双线程 | 高吞吐场景 |
| 多进程 | fork 子进程 | 多 NUMA 节点 |

### 12.3 内存管理

| 模式 | 内存来源 | 特点 |
|------|----------|------|
| SVA 模式 | malloc() | 简单，硬件支持虚拟地址 |
| No-SVA 模式 | wd_mem_alloc() | 需手动 DMA 映射 |

---

> 文档编写日期：2026/04/14
> 基于代码仓库：uadk-official（官方版本）