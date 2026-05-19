# ZIP 异构调度程序流程图

## 一、整体架构流程图（初始化 → Session → 运行）

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           用户调用 wd_comp_init2_("zlib", ...)                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Phase 1: 驱动发现 (wd_alg_drv_discover → wd_get_drv_array)                          │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  输入: alg="zlib", task_type=TASK_HW                                                │
│  操作: 遍历 alg_registry 链表                                                        │
│        ├─ 匹配 alg_type="comp"                                                       │
│        ├─ 过滤 calc_type==UADK_ALG_HW                                                │
│        ├─ 检查 available 标志                                                        │
│  输出: drv_array[0]=hisi_zip_drv, drv_count=1                                       │
│                                                                                      │
│  [异构适配点]: 支持多驱动数组，预留 drv_array 空间                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Phase 2: ctx 分配 (wd_alg_attrs_init → wd_init_ctx_config)                          │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  输入: ctx_params (sync-comp:4@0, async-decomp:4@0)                                 │
│  操作: 调用 wd_request_ctx() → /dev/hisi_zip                                        │
│        分配 ctxs[0..7] 数组                                                          │
│        初始化 spinlock                                                               │
│  输出: config.ctxs[8], config.ctx_num=8                                             │
│                                                                                      │
│  关键变量: ctxs[i].ctx (handle_t), ctxs[i].op_type, ctxs[i].ctx_mode                 │
│                                                                                      │
│  [异构适配点]: ctx 结构体新增 drv 字段（此时为 NULL，待 Phase 2.5 绑定）              │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Phase 2.5: 驱动绑定 (wd_ctx_bind_drivers)                                           │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  输入: drv_array[1], drv_count=1, ctxs[8]                                           │
│  操作: Round-Robin 绑定                                                              │
│        for (i=0; i<8; i++) {                                                         │
│            ctxs[i].drv = drv_array[0];  // hisi_zip_drv                             │
│            ctxs[i].ctx_type = UADK_ALG_HW;                                           │
│        }                                                                             │
│  输出: 所有 ctx 绑定同一驱动（drv_count=1）                                           │
│                                                                                      │
│  关键变量: ctxs[i].drv (wd_alg_driver*), ctxs[i].ctx_type (UADK_ALG_HW)              │
│                                                                                      │
│  [异构适配点]: ⭐ 新增 Phase 2.5，ctx 绑定驱动（Origin 版本无此阶段）                  │
│                ⭐ RR 规则：ctxs[i].drv = drv_array[i % drv_count]                    │
│                ⭐ 多驱动时自动异构分布（ZIP drv_count=1，暂未生效）                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Phase 3: 驱动初始化 (wd_alg_init_driver → drv->init)                                │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  输入: config.ctxs[8] (已绑定 drv)                                                   │
│  操作: for each ctx:                                                                 │
│        ├─ drv->init(config, priv)                                                    │
│        ├─ hisi_zip_init: 创建驱动私有数据                                            │
│        ├─ fallback = wd_request_drv("zlib", ALG_DRV_SOFT)                           │
│  输出: drv->drv_data, drv->init_state=1                                              │
│                                                                                      │
│  [异构适配点]: 遍历 ctx 时读取 ctxs[i].drv，支持多驱动初始化                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  调度器实例创建 (wd_sched_rr_instance)                                                │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  输入: sched_params (numa_id=0, type=COMP, mode=SYNC, begin=0, end=3)               │
│  操作: 创建 domain (region_id=0, mode=SYNC, op_type=COMP, prop=HW)                  │
│        添加 segment [0,3] 到 domain.segments                                        │
│        domain.valid = true                                                           │
│  输出: hash_table 中 domain 节点                                                     │
│                                                                                      │
│  关键变量: domain.region_id, domain.mode, domain.op_type, domain.prop               │
│            domain.segments→begin, end                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                            【初始化完成，等待用户创建 Session】
```

---

## 二、Session 创建流程（wd_comp_alloc_sess）

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                   用户调用 wd_comp_alloc_sess(&setup)                                │
│                   setup.alg_type=WD_ZLIB, setup.op_type=WD_DIR_COMPRESS              │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Step 1: 参数检查 + 驱动兼容性验证                                                    │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  输入: setup, wd_comp_setting.config                                                 │
│  操作: alg_name = wd_comp_alg_name[WD_ZLIB] = "zlib"                                │
│        drv_support = wd_drv_alg_support("zlib", &config)                            │
│        ├─ 遍历 ctxs[0..7]                                                            │
│        ├─ 检查 ctxs[i].drv 是否支持 "zlib"                                           │
│        ├─ 查询 alg_registry 中 drv 的 algs[] 数组                                    │
│        ├─ 找到 algs[j].alg_name=="zlib" && available==true                          │
│  输出: drv_support=true                                                              │
│                                                                                      │
│  [异构适配点]: ⭐ 新增 wd_drv_alg_support 检查                                        │
│                ⭐ 确保 session 算法与 ctx 绑定驱动兼容                                │
│                ⭐ 多驱动场景下过滤不兼容的 ctx                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                drv_support == true?
                                        │
                                        ▼ Yes
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Step 2: sched_key 初始化 (sched->sched_init)                                        │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  调用: wd_comp_setting.sched.sched_init(h_sched_ctx, setup->sched_param)            │
│        └─→ round_robin_sched_init                                                    │
│                                                                                      │
│  操作:                                                                               │
│  ① 分配 skey 内存                                                                    │
│  ② 设置 skey->region_id=0, skey->type=COMP                                          │
│  ③ session_sched_domain_init(sched_ctx, skey)                                       │
│     ├─ sync_ctx = session_sched_init_ctx(..., SCHED_MODE_SYNC)                      │
│     │   └─ 从 domain[region=0, mode=SYNC, op=COMP, prop=HW] 取 ctx_idx             │
│     │   └─ wd_sched_domain_get_next_rr → 返回 ctx_idx=0                             │
│     ├─ async_ctx = session_sched_init_ctx(..., SCHED_MODE_ASYNC)                    │
│     │   └─ 从 domain[region=0, mode=ASYNC, op=COMP, prop=HW] 取 ctx_idx=4           │
│     ├─ wd_sched_skey_domain_init(&skey->sync_domain, sync_ctx=0)                    │
│     │   └─ idx_cache.idx_list[0] = 0                                                │
│     │   └─ idx_cache.valid_count = 1                                                │
│     ├─ wd_sched_skey_domain_init(&skey->async_domain, async_ctx=4)                  │
│     │   └─ idx_cache.idx_list[0] = 4                                                │
│     │   └─ idx_cache.valid_count = 1                                                │
│                                                                                      │
│  输出: skey 指针                                                                      │
│                                                                                      │
│  关键变量: skey->sync_domain.idx_cache.idx_list[0] = {0}                            │
│            skey->async_domain.idx_cache.idx_list[0] = {4}                           │
│                                                                                      │
│  数据流: domain.segments[0,3] ──→ sync_ctx=0 ──→ skey.sync_domain.idx_list          │
│          domain.segments[4,7] ──→ async_ctx=4 ──→ skey.async_domain.idx_list        │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Step 3: set_param 调用（动态 compat 过滤）                                           │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  调用: wd_comp_setting.sched.set_param(h_sched_ctx, skey, &params)                  │
│        └─→ wd_sched_set_param                                                        │
│                                                                                      │
│  输入: params.alg_name="zlib", params.ctxs=config.ctxs                              │
│  操作:                                                                               │
│  ① 存储参数到 skey:                                                                  │
│     skey->alg_name = "zlib"                                                          │
│     skey->ctxs = config.ctxs                                                         │
│                                                                                      │
│  ② compat 过滤（多驱动场景生效）：                                                    │
│     wd_sched_skey_compat_filter(sched_ctx, skey, &skey->sync_domain, SYNC)          │
│     ├─ for (i=0; i<idx_cache.valid_count; i++) {                                     │
│     │     ctx_idx = idx_cache.idx_list[i];  // ctx_idx=0                            │
│     │     drv = ctxs[ctx_idx].drv;         // hisi_zip_drv                          │
│     │     if (!wd_alg_match_drv(drv, "zlib")) {                                      │
│     │         // 不兼容，从 domain 找替代 ctx                                         │
│     │         new_ctx = session_sched_init_ctx(..., skey);                          │
│     │         idx_cache.idx_list[i] = new_ctx;                                      │
│     │     }                                                                          │
│     │  }                                                                             │
│     └─ ZIP drv_count=1，hisi_zip 支持 zlib，过滤无变化                               │
│                                                                                      │
│  输出: skey->alg_name, skey->ctxs                                                    │
│                                                                                      │
│  [异构适配点]: ⭐ 新增 set_param 回调                                                 │
│                ⭐ 动态过滤 idx_list（session 阶段感知算法）                           │
│                ⭐ 确保调度 ctx 都支持目标算法                                          │
│                ⭐ cipher drv_count≥2 时此步骤生效                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Step 4: 返回 session handle                                                         │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  输出: sess->sched_key = skey                                                        │
│        return (handle_t)sess                                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、运行时调度流程（wd_do_comp_sync）

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                用户调用 wd_do_comp_sync(sess, &req)                                  │
│                req.op_type=WD_DIR_COMPRESS, req.src, req.dst                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  参数检查 + msg 填充                                                                  │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  操作: wd_comp_check_params(sess, req, CTX_MODE_SYNC)                               │
│        fill_comp_msg(sess, &msg, req)                                                │
│        msg.alg_type=WD_ZLIB, msg.comp_lv=..., msg.ctx_buf=sess->ctx_buf             │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  调度器选择 ctx (wd_comp_sync_job)                                                    │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  调用: wd_comp_setting.sched.pick_next_ctx(h_sched_ctx, skey, CTX_MODE_SYNC)        │
│        └─→ round_robin_pick_next_ctx                                                 │
│                                                                                      │
│  操作:                                                                               │
│  ① 选择 domain: domain = &skey->sync_domain                                         │
│  ② RR 选择: ctx_idx = atomic_fetch_add(&cache.rr_ptr, 1) % valid_count              │
│             └─ ctx_idx = 0 % 1 = 0                                                   │
│  ③ 取 ctx: min_ctx = cache.idx_list[ctx_idx] = idx_list[0] = 0                      │
│                                                                                      │
│  输出: idx = 0                                                                        │
│                                                                                      │
│  数据流: skey.sync_domain.idx_cache ──→ idx=0 ──→ ctxs[0]                           │
│                                                                                      │
│  关键变量: idx_cache.rr_ptr (原子计数器), idx_cache.idx_list[0]=0                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  获取 ctx 和驱动                                                                      │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  操作: ctx = config.ctxs + idx;  // ctxs[0]                                         │
│        drv = ctx->drv;           // hisi_zip_drv (Phase 2.5 绑定)                   │
│                                                                                      │
│  关键变量: ctx->drv (驱动指针), ctx->ctx (设备句柄)                                   │
│                                                                                      │
│  [异构适配点]: ctx->drv 决定使用哪个驱动                                              │
│                多驱动时，不同 idx 对应不同 drv                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  调用驱动发送 (drv->send)                                                             │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  操作: pthread_spin_lock(&ctx->lock)                                                │
│        ret = ctx->drv->send(ctx->ctx, &msg)                                         │
│        └─→ hisi_zip_send(dev_ctx, msg)                                              │
│        pthread_spin_unlock(&ctx->lock)                                              │
│                                                                                      │
│  数据流: msg ──→ drv->send ──→ 硬件队列                                               │
│                                                                                      │
│  [异构适配点]: ctx->drv 动态选择驱动                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  调用驱动接收 (drv->recv)                                                             │
│  ────────────────────────────────────────────────────────────────────────────────── │
│  操作: ret = ctx->drv->recv(ctx->ctx, &resp_msg)                                    │
│        └─→ hisi_zip_recv(dev_ctx, &resp_msg)                                        │
│        req->src_len = msg.in_cons                                                   │
│        req->dst_len = msg.produced                                                   │
│                                                                                      │
│  数据流: 硬件队列 ──→ drv->recv ──→ resp_msg                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                            【同步操作完成，返回用户】
```

---

## 四、关键数据流走向图

```
                        ┌──────────────────────┐
                        │   alg_registry       │
                        │   (全局驱动注册链表)   │
                        │                      │
                        │   head → hisi_zip    │
                        │          ├─ drv      │
                        │          ├─ algs[]   │
                        │          │   [0]="zlib"    │
                        │          │   available=true│
                        │          └─ calc_type=HW   │
                        └──────────────────────┘
                                    │
                                    │ wd_get_drv_array
                                    ▼
                        ┌──────────────────────┐
                        │   drv_array[1]       │
                        │   [0]=hisi_zip_drv   │
                        └──────────────────────┘
                                    │
                                    │ Phase 2.5 绑定
                                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                     config.ctxs[8]                             │
    │  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐       │
    │  │[0]  │[1]  │[2]  │[3]  │[4]  │[5]  │[6]  │[7]  │     │       │
    │  │drv  │drv  │drv  │drv  │drv  │drv  │drv  │drv  │     │       │
    │  │=zip │=zip │=zip │=zip │=zip │=zip │=zip │=zip │     │       │
    │  │ctx  │ctx  │ctx  │ctx  │ctx  │ctx  │ctx  │ctx  │     │       │
    │  │=h0  │=h1  │=h2  │=h3  │=h4  │=h5  │=h6  │=h7  │     │       │
    │  └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘       │
    │   ↑                                                           │
    │   │ Phase 2: wd_request_ctx                                   │
    │   │ 调用 /dev/hisi_zip                                         │
    └───────────────────────────────────────────────────────────────┘
                                    │
                                    │ wd_sched_rr_instance
                                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                domain_hash_table                               │
    │                                                                │
    │  bucket[hash(region=0, mode=SYNC, op=COMP, prop=HW)]           │
    │    └─→ domain                                                  │
    │         ├─ segments → [begin=0, end=3]                        │
    │         ├─ valid=true                                          │
    │         └─ current_pos=0                                       │
    │                                                                │
    │  bucket[hash(region=0, mode=ASYNC, op=COMP, prop=HW)]          │
    │    └─→ domain                                                  │
    │         ├─ segments → [begin=4, end=7]                        │
    │         ├─ valid=true                                          │
    │         └─ current_pos=4                                       │
    └───────────────────────────────────────────────────────────────┘
                                    │
                                    │ sched_init (session_sched_init_ctx)
                                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                       skey (sched_key)                         │
    │                                                                │
    │  sync_domain                                                    │
    │    └─ idx_cache                                                │
    │         ├─ idx_list[0] = 0     ←─ 从 domain 取 ctx_idx         │
    │         ├─ load_values[0] = 0                                  │
    │         ├─ valid_count = 1                                     │
    │         └─ rr_ptr = 0                                          │
    │                                                                │
    │  async_domain                                                   │
    │    └─ idx_cache                                                │
    │         ├─ idx_list[0] = 4                                     │
    │         ├─ load_values[0] = 0                                  │
    │         ├─ valid_count = 1                                     │
    │         └─ rr_ptr = 0                                          │
    │                                                                │
    │  alg_name = "zlib"     ←─ set_param 设置                       │
    │  ctxs = config.ctxs    ←─ 指向全局 ctx 数组                    │
    └───────────────────────────────────────────────────────────────┘
                                    │
                                    │ pick_next_ctx (运行时)
                                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    idx_cache.idx_list                          │
    │                                                                │
    │  idx = rr_ptr % valid_count                                    │
    │      = 0 % 1                                                   │
    │      = 0                                                       │
    │                                                                │
    │  ctx_idx = idx_list[idx]                                       │
    │          = idx_list[0]                                         │
    │          = 0                                                   │
    │                                                                │
    │  ctx = config.ctxs[ctx_idx]                                    │
    │      = ctxs[0]                                                 │
    │                                                                │
    │  drv = ctx->drv                                                │
    │      = hisi_zip_drv                                            │
    └───────────────────────────────────────────────────────────────┘
                                    │
                                    │ drv->send / drv->recv
                                    ▼
                        ┌──────────────────────┐
                        │      硬件设备         │
                        │   /dev/hisi_zip       │
                        │                      │
                        │   ctx->ctx = h0       │
                        │   drv->send(msg)      │
                        │   drv->recv(resp)     │
                        └──────────────────────┘
```

---

## 五、异构适配关键点总结

### Origin 版本 vs Design 版本对比

| 流程阶段 | Origin 版本 | Design 版本 | 异构适配点 |
|---------|-------------|-------------|-----------|
| **Phase 1** | 无驱动发现阶段 | wd_alg_drv_discover | ⭐ 支持多驱动数组 |
| **Phase 2** | wd_init_ctx_config | wd_init_ctx_config (相同) | ctx 结构体预留 drv 字段 |
| **Phase 2.5** | **无此阶段** | wd_ctx_bind_drivers | ⭐ **新增：ctx 绑定驱动** |
| **Phase 3** | wd_alg_init_driver (单驱动) | wd_alg_init_driver (遍历 ctx) | 读取 ctxs[i].drv |
| **Session init** | wd_comp_alloc_sess (无 compat 检查) | wd_drv_alg_support + set_param | ⭐ **新增：算法兼容验证** |
| **sched_init** | sched_init (无 compat 过滤) | session_sched_init_ctx (带 skey) | ⭐ **新增：compat 过滤** |
| **运行时** | ctxs[idx].drv (硬编码) | ctxs[idx].drv (动态绑定) | drv 来源：Phase 2.5 |

### ZIP 特殊情况

```
┌─────────────────────────────────────────────────────────────────┐
│  ZIP drv_count = 1 (只有 hisi_zip)                              │
│                                                                 │
│  影响：                                                          │
│  ├─ Phase 2.5: 所有 ctx 绑定同一驱动                             │
│  ├─ set_param compat 过滤：无变化（hisi_zip 支持 zlib）          │
│  ├─ idx_list 过滤：无需替换                                      │
│  └─ 异构调度框架已适配，但未实际生效                              │
│                                                                 │
│  对比 cipher:                                                    │
│  ├─ cipher drv_count ≥ 2 (hisi_sec + isa_ce + isa_sve)         │
│  ├─ Phase 2.5: ctx 异构分布到不同驱动                            │
│  ├─ set_param 过滤：替换不兼容 idx                               │
│  └─ 异构调度真正生效                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 六、多驱动异构场景流程（cipher 作为参考）

假设 cipher drv_count=3 (hisi_sec, isa_ce, isa_sve)，ctx_num=12：

```
Phase 2.5 绑定 (wd_ctx_bind_drivers):
┌─────────────────────────────────────────────────────────┐
│  ctxs[0].drv  = drv_array[0] = hisi_sec_drv             │
│  ctxs[1].drv  = drv_array[1] = isa_ce_drv               │
│  ctxs[2].drv  = drv_array[2] = isa_sve_drv              │
│  ctxs[3].drv  = drv_array[0] = hisi_sec_drv             │
│  ctxs[4].drv  = drv_array[1] = isa_ce_drv               │
│  ...                                                     │
│  ctxs[11].drv = drv_array[2] = isa_sve_drv              │
│                                                          │
│  RR 规则: ctxs[i].drv = drv_array[i % drv_count]        │
└─────────────────────────────────────────────────────────┘

Session 创建 (wd_cipher_alloc_sess):
┌─────────────────────────────────────────────────────────┐
│  alg_name = "cbc(aes)"                                   │
│                                                          │
│  sched_init:                                              │
│  ├─ sync_ctx = session_sched_init_ctx(..., skey)        │
│  │   ├─ 从 domain 遍历 ctxs                              │
│  │   ├─ ctx_idx=0, drv=hisi_sec                         │
│  │   ├─ wd_alg_match_drv(hisi_sec, "cbc(aes)") → true   │
│  │   └─ 返回 ctx_idx=0                                   │
│  │                                                       │
│  ├─ idx_cache.idx_list[0] = 0                            │
│  │                                                       │
│  set_param compat 过滤:                                   │
│  ├─ skey->alg_name = "cbc(aes)"                          │
│  ├─ wd_sched_skey_compat_filter                          │
│  │   ├─ idx_list[0]=0, drv=hisi_sec → 支持 → 保留       │
│  │                                                       │
│  如果 session 算法是 "sm4" (hisi_sec 不支持):            │
│  ├─ idx_list[0]=0, drv=hisi_sec → 不支持                 │
│  ├─ 从 domain 找替代：                                    │
│  │   ├─ ctx_idx=1, drv=isa_ce → 支持 sm4                │
│  │   └─ idx_list[0] = 1 (替换为 CE ctx)                  │
└─────────────────────────────────────────────────────────┘

运行时调度:
┌─────────────────────────────────────────────────────────┐
│  idx = rr_ptr % valid_count                              │
│  ctx_idx = idx_list[idx]                                 │
│                                                          │
│  场景1: idx_list = {0, 3, 6, 9} (全是 hisi_sec ctx)      │
│  └─ drv = ctxs[0].drv = hisi_sec_drv                    │
│                                                          │
│  场景2: idx_list = {1, 4, 7} (全是 isa_ce ctx)           │
│  └─ drv = ctxs[1].drv = isa_ce_drv                      │
│                                                          │
│  异构调度生效：不同 session 使用不同驱动                   │
└─────────────────────────────────────────────────────────┘
```

---

## 七、代码执行路径图（调用链）

```
wd_comp_init2_("zlib", SCHED_POLICY_RR, TASK_HW, NULL)
    │
    ├─ wd_comp_open_driver(WD_TYPE_V2)
    │   └─ wd_dlopen_drv → dlopen("libhisi_zip.so")
    │       └─ hisi_zip_probe() [GCC constructor]
    │           └─ wd_alg_driver_register(&hisi_zip_driver)
    │               └─ 添加到 alg_registry 链表
    │
    ├─ wd_alg_attrs_init(&wd_comp_init_attrs)
    │   ├─ wd_alg_drv_discover(&attrs)
    │   │   └─ wd_get_drv_array("comp", TASK_HW, NULL, ...)
    │   │       └─ 返回 drv_array[1], drv_count=1
    │   │
    │   ├─ wd_comp_init_nolock(config, sched, attrs)
    │   │   ├─ wd_init_ctx_config(&config, config)
    │   │   │   └─ ctxs = calloc(8, sizeof(ctx_internal))
    │   │   │   └─ wd_request_ctx → /dev/hisi_zip → ctxs[i].ctx
    │   │   │
    │   │   ├─ wd_init_sched(&sched, sched)
    │   │   │   └─ sched.sched_init = round_robin_sched_init
    │   │   │   └─ sched.pick_next_ctx = round_robin_pick_next_ctx
    │   │   │   └─ sched.set_param = wd_sched_set_param
    │   │   │
    │   │   └─ wd_init_async_request_pool
    │   │
    │   └ wd_sched_rr_instance(sched, param) [循环调用]
    │   │   └─ wd_sched_hash_table_insert(region=0, mode=SYNC, op=COMP, prop=HW)
    │   │       └─ domain.segments → [0,3]
    │   │   └ wd_sched_hash_table_insert(region=0, mode=ASYNC, op=COMP, prop=HW)
    │   │       └─ domain.segments → [4,7]
    │   │
    │   └─ 返回 attrs.ctx_config_internal = &config
    │
    ├─ wd_ctx_bind_drivers(&config, drv_array, drv_count=1)
    │   └─ for (i=0; i<8; i++)
    │       ctxs[i].drv = drv_array[0]  // hisi_zip_drv
    │       ctxs[i].ctx_type = UADK_ALG_HW
    │   └ wd_alg_drv_ref_inc(drv_array, drv_count)
    │
    ├─ wd_alg_init_driver(&config)
    │   └─ for each ctx:
    │       drv->init(config, priv)
    │       └─ hisi_zip_init
    │
    └ wd_alg_set_init(&wd_comp_setting.status)


wd_comp_alloc_sess(&setup)
    │
    ├─ wd_drv_alg_support("zlib", &config)
    │   └─ 遍历 ctxs，检查 drv 是否支持 zlib
    │
    ├─ wd_comp_setting.sched.sched_init(h_sched_ctx, sched_param)
    │   └─ round_robin_sched_init
    │       ├─ sched_session_common_init → alloc skey
    │       ├─ session_sched_domain_init(sched_ctx, skey)
    │       │   ├─ session_sched_init_ctx(..., SCHED_MODE_SYNC, skey)
    │       │   │   └ wd_sched_hash_table_lookup → domain
    │       │   │   └ wd_sched_domain_get_next_rr → ctx_idx=0
    │       │   │   └ wd_alg_match_drv(ctxs[0].drv, "zlib") → true
    │       │   │   └─ 返回 sync_ctx=0
    │       │   │
    │       │   ├─ wd_sched_skey_domain_init(&skey->sync_domain, ctx_idx=0)
    │       │   │   └─ idx_cache.idx_list[0] = 0
    │       │   │
    │       │   └─ session_sched_init_ctx(..., SCHED_MODE_ASYNC, skey)
    │       │       └─ async_ctx=4, idx_cache.idx_list[0]=4
    │       │
    │       └ sched_skey_param_init(sched_ctx, skey)
    │       └─ 注册 skey 到 sched_ctx.skey[]
    │
    ├─ wd_comp_setting.sched.set_param(h_sched_ctx, skey, &params)
    │   └ wd_sched_set_param
    │   ├─ skey->alg_name = "zlib"
    │   ├─ skey->ctxs = config.ctxs
    │   ├─ wd_sched_skey_compat_filter(skey, &skey->sync_domain)
    │   │   └─ idx_list[0]=0, drv=hisi_zip → 支持 → 保留
    │   │
    │   └ wd_sched_skey_compat_filter(skey, &skey->async_domain)
    │       └─ idx_list[0]=4, drv=hisi_zip → 支持 → 保留
    │
    └─ return sess


wd_do_comp_sync(sess, &req)
    │
    ├─ wd_comp_sync_job(sess, req, &msg)
    │   ├─ wd_comp_setting.sched.pick_next_ctx(h_sched_ctx, skey, CTX_MODE_SYNC)
    │   │   └ round_robin_pick_next_ctx
    │   │   ├─ domain = &skey->sync_domain
    │   │   ├─ idx = atomic_fetch_add(&cache.rr_ptr, 1) % 1 = 0
    │   │   └─ return cache.idx_list[0] = 0
    │   │
    │   ├─ ctx = config.ctxs[0]
    │   │   drv = ctx->drv = hisi_zip_drv
    │   │
    │   ├─ pthread_spin_lock(&ctx->lock)
    │   ├─ drv->send(ctx->ctx, &msg)
    │   │   └─ hisi_zip_send(dev_ctx, msg)
    │   │
    │   ├─ drv->recv(ctx->ctx, &resp_msg)
    │   │   └─ hisi_zip_recv(dev_ctx, resp_msg)
    │   │
    │   └ pthread_spin_unlock(&ctx->lock)
    │
    └─ req->src_len = msg.in_cons
        req->dst_len = msg.produced
        return 0
```

---

## 八、总结：ZIP 异构调度适配要点

1. **框架统一**：ZIP 与 cipher 使用相同的四阶段初始化流程
2. **预留扩展**：ZIP drv_count=1，异构调度框架已适配，未来新增驱动即可生效
3. **关键变量**：
   - `drv_array[]` - 驱动数组（Phase 1 发现）
   - `ctxs[i].drv` - ctx 绑定的驱动指针（Phase 2.5 绑定）
   - `idx_list[]` - session 可用的 ctx 索引（sched_init + compat 过滤）
   - `skey->alg_name` - session 算法名称（set_param 设置）

4. **数据流核心路径**：
   ```
   alg_registry → drv_array → ctxs[].drv → skey.idx_list → pick_next_ctx → drv->send/recv
   ```

5. **多驱动生效条件**：
   - drv_count ≥ 2
   - ctxs 异构分布（Phase 2.5）
   - session compat 过滤生效（set_param）