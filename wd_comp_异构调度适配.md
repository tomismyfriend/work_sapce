# wd_comp.c 异构调度适配修改文档

## 概述

本文档记录了 `wd_comp.c` 从单驱动模式适配到多驱动异构调度框架的6处关键修改。

**修改目标**：使ZIP模块支持多驱动异构调度，与cipher模块使用相同的框架架构。

**核心变化**：
- 单驱动 `wd_comp_setting.driver` → 多驱动 `wd_comp_setting.config.drv_array[]`
- 驱动绑定从初始化时一次性绑定 → Phase 2.5 RR绑定到各ctx
- session创建时增加算法兼容性检查和set_param调用

---

## Phase 初始化流程对比

### Origin版本（单驱动）
```
Phase 1: 驱动发现 → wd_alg_drv_bind(task_type, alg) 绑定单个驱动
Phase 2: ctx初始化 → wd_alg_init_driver(config, driver) 驱动初始化
```

### Design版本（多驱动异构）
```
Phase 1: 驱动发现 → wd_get_drv_array() 获取所有兼容驱动数组
Phase 2: ctx初始化 → wd_alg_attrs_init() 内部完成ctx分配
Phase 2.5: 驱动绑定 → wd_ctx_bind_drivers() RR绑定驱动到ctx
Phase 3: 驱动初始化 → wd_alg_init_driver() 初始化每个ctx的驱动
```

---

## 修改点详解

### 修改点1: wd_comp_init_nolock 函数签名变更

**位置**：`wd_comp.c:138-176`

**修改内容**：
- 新增 `struct wd_init_attrs *attrs` 参数
- 删除 `wd_alg_init_driver()` 调用（移到外层调用者）
- 新增 V2路径支持：`attrs->ctx_config_internal` 回传

**Origin代码**：
```c
static int wd_comp_init_nolock(struct wd_ctx_config *config, struct wd_sched *sched)
{
    // ... ctx初始化 ...
    ret = wd_init_async_request_pool(...);
    if (ret < 0)
        goto out_clear_sched;

    ret = wd_alg_init_driver(&wd_comp_setting.config,
                            wd_comp_setting.driver);  // 单驱动初始化
    if (ret)
        goto out_clear_pool;
    return 0;
    // ... error handling ...
}
```

**Design代码**：
```c
static int wd_comp_init_nolock(struct wd_ctx_config *config, struct wd_sched *sched,
                              struct wd_init_attrs *attrs)
{
    struct wd_init_attrs *comp_attrs = attrs;
    // ... ctx初始化 ...
    ret = wd_init_async_request_pool(...);
    if (ret < 0)
        goto out_clear_sched;

    wd_comp_setting.priv = STATUS_ENABLE;

    /* V2 path: let framework know where the internal config is */
    if (comp_attrs)
        comp_attrs->ctx_config_internal = &wd_comp_setting.config;  // 回传config指针

    return 0;
    // ... error handling (删除了wd_alg_init_driver) ...
}
```

**修改原因**：
1. V1路径：驱动初始化移到 `wd_comp_init()` 中统一处理
2. V2路径：`wd_alg_attrs_init()` 需要获取 `config` 指针用于后续Phase 2.5/3

---

### 修改点2: wd_comp_init (V1路径) 新增Phase 1/2.5/3

**位置**：`wd_comp.c:196-262`

**修改内容**：
- 删除 `wd_ctx_drv_config()` 调用
- 新增 Phase 1: `wd_get_drv_array()` 驱动发现
- 新增 Phase 2.5: `wd_ctx_bind_drivers()` 驱动绑定
- 新增 Phase 3: `wd_alg_init_driver()` 驱动初始化
- 新增错误处理路径

**Origin代码**：
```c
int wd_comp_init(struct wd_ctx_config *config, struct wd_sched *sched)
{
    int ret;
    // ...
    ret = wd_comp_open_driver(WD_TYPE_V1);
    if (ret)
        goto out_clear_init;

    ret = wd_comp_init_nolock(config, sched);  // 内部调用wd_alg_init_driver
    if (ret)
        goto out_clear_driver;

    wd_alg_set_init(&wd_comp_setting.status);
    return 0;
    // ...
}
```

**Design代码**：
```c
int wd_comp_init(struct wd_ctx_config *config, struct wd_sched *sched)
{
    __u32 drv_count = 0;
    int ret;
    // ...
    ret = wd_comp_open_driver(WD_TYPE_V1);
    if (ret)
        goto out_clear_init;

    /* ═══ Phase 2: Internal copy (existing common_init) ═══ */
    ret = wd_comp_init_nolock(config, sched, NULL);  // attrs=NULL表示V1路径
    if (ret)
        goto out_clear_driver;

    /* ═══ Phase 1: Driver discovery ═══ */
    ret = wd_get_drv_array("comp", TASK_HW, NULL,
            &wd_comp_setting.config.drv_array, &drv_count);
    if (ret) {
        WD_ERR("driver discovery failed!\n");
        goto out_uninit_nolock;
    }
    WD_INFO("discovered %u unique drivers\n", drv_count);

    wd_comp_setting.config.drv_count = drv_count;

    /* ═══ Phase 2.5: RR bind drivers to internal ctxs ═══ */
    ret = wd_ctx_bind_drivers(&wd_comp_setting.config,
            wd_comp_setting.config.drv_array, drv_count);
    if (ret) {
        WD_ERR("driver binding failed!\n");
        goto out_free_drv_array;
    }

    /* ═══ Phase 3: Driver initialization ═══ */
    ret = wd_alg_init_driver(&wd_comp_setting.config);
    if (ret) {
        WD_ERR("driver init failed!\n");
        goto out_unbind_drivers;
    }

    wd_alg_set_init(&wd_comp_setting.status);
    return 0;

out_unbind_drivers:
    wd_ctx_unbind_drivers(&wd_comp_setting.config);
out_free_drv_array:
    wd_put_drv_array(wd_comp_setting.config.drv_array, drv_count);
    wd_comp_setting.config.drv_array = NULL;
out_uninit_nolock:
    wd_comp_uninit_nolock();
    // ...
}
```

**修改原因**：
1. V1路径原本依赖 `wd_comp_open_driver()` 中获取的单驱动指针
2. 现在需要支持多驱动，改为通过 `wd_get_drv_array()` 获取驱动数组
3. Phase 2.5 负责将驱动RR绑定到各个ctx
4. Phase 3 负责初始化每个ctx绑定的驱动

---

### 修改点3: wd_comp_uninit (V1路径) 新增驱动解绑

**位置**：`wd_comp.c:264-281`

**修改内容**：
- 新增 `wd_alg_uninit_driver()` 调用
- 新增 `wd_ctx_unbind_drivers()` 调用
- 新增 `wd_put_drv_array()` 释放驱动数组

**Origin代码**：
```c
void wd_comp_uninit(void)
{
    int ret;

    ret = wd_comp_uninit_nolock();  // 内部调用wd_alg_uninit_driver
    if (ret)
        return;

    wd_comp_close_driver(WD_TYPE_V1);
    wd_alg_clear_init(&wd_comp_setting.status);
}
```

**Design代码**：
```c
void wd_comp_uninit(void)
{
    int ret;

    wd_alg_uninit_driver(&wd_comp_setting.config);     // Phase 3逆操作
    wd_ctx_unbind_drivers(&wd_comp_setting.config);    // Phase 2.5逆操作

    wd_put_drv_array(wd_comp_setting.config.drv_array,
                     wd_comp_setting.config.drv_count);  // Phase 1逆操作
    wd_comp_setting.config.drv_array = NULL;

    ret = wd_comp_uninit_nolock();
    if (ret)
        return;

    wd_comp_close_driver(WD_TYPE_V1);
    wd_alg_clear_init(&wd_comp_setting.status);
}
```

**修改原因**：
- uninit顺序与init相反
- 先释放驱动资源，再解绑驱动，最后释放驱动数组

---

### 修改点4: wd_comp_init2_ (V2路径) 新增Phase 2.5/3

**位置**：`wd_comp.c:283-379`

**修改内容**：
- 删除 `wd_alg_drv_bind()` 单驱动绑定
- 删除 `wd_alg_drv_unbind()` 相关错误处理
- 删除 `wd_ctx_drv_config()` 调用
- 新增 `wd_init_attrs.task_type` 字段
- 新增 Phase 2.5: `wd_ctx_bind_drivers()`
- 新增 Phase 3: `wd_alg_init_driver()`
- 新增错误处理路径

**Origin代码**：
```c
int wd_comp_init2_(char *alg, __u32 sched_type, int task_type, struct wd_ctx_params *ctx_params)
{
    // ...
    while (ret != 0) {
        memset(&wd_comp_setting.config, 0, sizeof(struct wd_ctx_config_internal));

        /* Get alg driver and dev name */
        wd_comp_setting.driver = wd_alg_drv_bind(task_type, alg);  // 单驱动绑定
        if (!wd_comp_setting.driver) {
            WD_ERR("failed to bind %s driver.\n", alg);
            goto out_dlclose;
        }

        comp_ctx_params.ctx_set_num = comp_ctx_num;
        ret = wd_ctx_param_init(&comp_ctx_params, ctx_params,
                                wd_comp_setting.driver, WD_COMP_TYPE, WD_DIR_MAX);  // 使用单驱动
        // ...
        wd_comp_init_attrs.driver = wd_comp_setting.driver;  // 设置单驱动
        ret = wd_alg_attrs_init(&wd_comp_init_attrs);
        // ...
    }
    // ...
}
```

**Design代码**：
```c
int wd_comp_init2_(const char *alg, __u32 sched_type, int task_type,
                   struct wd_ctx_params *ctx_params)
{
    // ...
    while (ret != 0) {
        memset(&wd_comp_setting.config, 0, sizeof(struct wd_ctx_config_internal));

        /* Init ctx param and prepare for ctx request */
        comp_ctx_params.ctx_set_num = comp_ctx_num;
        ret = wd_ctx_param_init(&comp_ctx_params, ctx_params,
                                alg, task_type, WD_COMP_TYPE, WD_DIR_MAX);  // 传入alg而非driver
        // ...
        (void)strcpy(wd_comp_init_attrs.alg, alg);
        wd_comp_init_attrs.sched_type = sched_type;
        wd_comp_init_attrs.task_type = task_type;  // 新增task_type字段
        wd_comp_init_attrs.ctx_params = &comp_ctx_params;
        wd_comp_init_attrs.alg_init = wd_comp_init_nolock;
        wd_comp_init_attrs.alg_poll_ctx = wd_comp_poll_ctx;
        ret = wd_alg_attrs_init(&wd_comp_init_attrs);  // 内部完成Phase 1+2
        // ...
    }

    WD_INFO("ctxs numbers: %u.\n", wd_comp_setting.config.ctx_num);

    /* ═══ Phase 2.5: RR bind drivers ═══ */
    ret = wd_ctx_bind_drivers(&wd_comp_setting.config,
                              wd_comp_init_attrs.drv_array,
                              wd_comp_init_attrs.drv_count);
    if (ret) {
        WD_ERR("driver binding failed!\n");
        goto out_uninit_nolock;
    }

    /* ═══ Phase 3: Driver initialization ═══ */
    ret = wd_alg_init_driver(&wd_comp_setting.config);
    if (ret) {
        WD_ERR("driver init failed!\n");
        goto out_unbind_drivers;
    }

    wd_alg_set_init(&wd_comp_setting.status);
    wd_ctx_param_uninit(&comp_ctx_params);
    return 0;

out_unbind_drivers:
    wd_ctx_unbind_drivers(&wd_comp_setting.config);
out_uninit_nolock:
    wd_comp_uninit_nolock();
    wd_alg_attrs_uninit(&wd_comp_init_attrs);
    // ...
}
```

**修改原因**：
1. V2路径中，`wd_alg_attrs_init()` 内部调用 `wd_get_drv_array()` 完成Phase 1
2. Phase 2.5 在 `wd_alg_attrs_init()` 返回后执行
3. Phase 3 在Phase 2.5完成后执行
4. 错误处理需要逆向释放资源

---

### 修改点5: wd_comp_uninit2 (V2路径) 新增驱动解绑

**位置**：`wd_comp.c:381-395`

**修改内容**：
- 新增 `wd_alg_uninit_driver()` 调用
- 新增 `wd_ctx_unbind_drivers()` 调用
- 删除 `wd_alg_drv_unbind()` 单驱动解绑

**Origin代码**：
```c
void wd_comp_uninit2(void)
{
    int ret;

    ret = wd_comp_uninit_nolock();  // 内部调用wd_alg_uninit_driver
    if (ret)
        return;

    wd_alg_attrs_uninit(&wd_comp_init_attrs);
    wd_alg_drv_unbind(wd_comp_setting.driver);  // 单驱动解绑
    wd_comp_close_driver(WD_TYPE_V2);
    wd_alg_clear_init(&wd_comp_setting.status);
}
```

**Design代码**：
```c
void wd_comp_uninit2(void)
{
    int ret;

    wd_alg_uninit_driver(&wd_comp_setting.config);    // Phase 3逆操作
    wd_ctx_unbind_drivers(&wd_comp_setting.config);   // Phase 2.5逆操作

    ret = wd_comp_uninit_nolock();
    if (ret)
        return;

    wd_alg_attrs_uninit(&wd_comp_init_attrs);         // Phase 1+2逆操作
    wd_comp_close_driver(WD_TYPE_V2);
    wd_alg_clear_init(&wd_comp_setting.status);
}
```

**修改原因**：
- uninit顺序与init相反
- `wd_alg_attrs_uninit()` 内部会调用 `wd_put_drv_array()` 释放驱动数组

---

### 修改点6: wd_comp_alloc_sess 新增算法兼容检查和set_param

**位置**：`wd_comp.c:502-572`

**修改内容**：
- 新增 `alg_name` 变量获取算法名
- 新增 `wd_drv_alg_support()` 检查驱动是否支持算法
- 新增 `wd_sched_params` 结构体设置
- 新增 `sched.set_param()` 调用

**Origin代码**：
```c
handle_t wd_comp_alloc_sess(struct wd_comp_sess_setup *setup)
{
    struct wd_comp_sess *sess;
    int ret;

    if (!setup)
        return (handle_t)0;

    ret = wd_comp_check_sess_params(setup);
    if (ret)
        return (handle_t)0;

    sess = calloc(1, sizeof(struct wd_comp_sess));
    if (!sess)
        return (handle_t)0;

    /* Memory type set */
    ret = wd_mem_ops_init(wd_comp_setting.config.ctxs[0].ctx, &setup->mm_ops, setup->mm_type);
    // ...
    sess->sched_key = (void *)wd_comp_setting.sched.sched_init(
                 wd_comp_setting.sched.h_sched_ctx, setup->sched_param);
    if (WD_IS_ERR(sess->sched_key)) {
        WD_ERR("failed to init session schedule key!\n");
        goto sched_err;
    }

    return (handle_t)sess;
    // ...
}
```

**Design代码**：
```c
handle_t wd_comp_alloc_sess(struct wd_comp_sess_setup *setup)
{
    struct wd_comp_sess *sess;
    struct wd_sched_params params;  // 新增
    const char *alg_name;           // 新增
    int ret;
    bool drv_support;               // 新增

    if (!setup)
        return (handle_t)0;

    ret = wd_comp_check_sess_params(setup);
    if (ret)
        return (handle_t)0;

    if (setup->alg_type >= WD_COMP_ALG_MAX) {
        WD_ERR("invalid: alg_type %u!\n", setup->alg_type);
        return (handle_t)0;
    }

    /* ═══ 新增：算法兼容性检查 ═══ */
    alg_name = wd_comp_alg_name[setup->alg_type];
    drv_support = wd_drv_alg_support(alg_name, &wd_comp_setting.config);
    if (!drv_support) {
        WD_ERR("failed to support this algorithm: %s!\n", alg_name);
        return (handle_t)0;
    }

    sess = calloc(1, sizeof(struct wd_comp_sess));
    if (!sess)
        return (handle_t)0;

    ret = wd_mem_ops_init(wd_comp_setting.config.ctxs[0].ctx, &setup->mm_ops, setup->mm_type);
    // ...
    sess->sched_key = (void *)wd_comp_setting.sched.sched_init(
                 wd_comp_setting.sched.h_sched_ctx, setup->sched_param);
    if (WD_IS_ERR(sess->sched_key)) {
        WD_ERR("failed to init session schedule key!\n");
        goto sched_err;
    }

    /* ═══ 新增：调度器set_param调用 ═══ */
    memset(&params, 0, sizeof(params));
    params.alg_name = alg_name;
    params.ctxs = wd_comp_setting.config.ctxs;
    wd_comp_setting.sched.set_param(
        wd_comp_setting.sched.h_sched_ctx,
        sess->sched_key, &params);

    return (handle_t)sess;
    // ...
}
```

**修改原因**：
1. `wd_drv_alg_support()` 检查ctx绑定的驱动是否支持该算法
2. `sched.set_param()` 根据算法名过滤可用ctx列表（idx_list）
3. 支持异构调度：不同算法可能使用不同驱动子集

---

## 与cipher适配的差异点

| 对比项 | cipher | comp (本次修改) |
|--------|--------|-----------------|
| V1路径 | 完整支持 | 完整支持 |
| V2路径 | 完整支持 | 完整支持 |
| open_driver | 保留单驱动dlopen逻辑 | 保留单驱动dlopen逻辑 |
| close_driver | 保留单驱动dlclose逻辑 | 保留单驱动dlclose逻辑 |
| wd_comp_setting结构 | 无driver字段 | 删除driver字段 |
| 驱动数组存储 | config.drv_array | config.drv_array |
| 算法检查 | alg_type检查已有 | 新增alg_type边界检查 |

---

## 数据结构变更

### wd_comp_setting 结构体

**Origin版本**：
```c
struct wd_comp_setting {
    enum wd_status status;
    struct wd_ctx_config_internal config;
    struct wd_sched sched;
    struct wd_async_msg_pool pool;
    struct wd_alg_driver *driver;  // 单驱动指针
    void *dlhandle;
    void *dlh_list;
} wd_comp_setting;
```

**Design版本**：
```c
struct wd_comp_setting {
    enum wd_status status;
    struct wd_ctx_config_internal config;  // 内含drv_array/drv_count
    struct wd_sched sched;
    struct wd_async_msg_pool pool;
    void *priv;           // 替代driver字段
    void *dlhandle;
    void *dlh_list;
} wd_comp_setting;
```

---

## 测试验证点

### 1. 编译验证
```bash
cd uadk_design
./autogen.sh && ./configure && make -j$(nproc)
```

### 2. 单元测试
- V1路径：`wd_comp_init()` → `wd_comp_do_comp_sync()` → `wd_comp_uninit()`
- V2路径：`wd_comp_init2_()` → `wd_comp_do_comp_sync()` → `wd_comp_uninit2()`

### 3. 异构调度测试
- 多驱动场景：hisi_zip + isa_ce 同时可用
- 算法过滤：zlib只用hisi_zip，某些算法只用isa_ce
- set_param验证：idx_list正确过滤

### 4. 错误路径测试
- 驱动发现失败：`wd_get_drv_array()` 返回错误
- 驱动绑定失败：`wd_ctx_bind_drivers()` 返回错误
- 驱动初始化失败：`wd_alg_init_driver()` 返回错误
- uninit时资源正确释放

---

## 关键函数调用链

### V1路径初始化
```
wd_comp_init()
  ├─ wd_comp_open_driver(WD_TYPE_V1)
  ├─ wd_comp_init_nolock()           [Phase 2]
  │    └─ wd_init_ctx_config()
  │    └─ wd_init_sched()
  │    └─ wd_init_async_request_pool()
  ├─ wd_get_drv_array()              [Phase 1]
  ├─ wd_ctx_bind_drivers()           [Phase 2.5]
  └─ wd_alg_init_driver()            [Phase 3]
```

### V2路径初始化
```
wd_comp_init2_()
  ├─ wd_comp_open_driver(WD_TYPE_V2)
  ├─ wd_alg_attrs_init()             [Phase 1+2 内部完成]
  │    ├─ wd_get_drv_array()         [Phase 1]
  │    └─ wd_alg_ctx_init()          [Phase 2]
  │         └─ wd_init_ctx_config()
  │         └─ wd_sched_rr_instance()
  ├─ wd_ctx_bind_drivers()           [Phase 2.5]
  └─ wd_alg_init_driver()            [Phase 3]
```

### Session创建
```
wd_comp_alloc_sess()
  ├─ wd_drv_alg_support()            [算法兼容检查]
  ├─ sched.sched_init()              [创建sched_key]
  └─ sched.set_param()               [过滤idx_list]
```

---

## 总结

本次适配将ZIP模块从单驱动模式改造为多驱动异构调度模式，核心变化：

1. **驱动管理**：单指针 → 数组，支持多驱动并存
2. **驱动绑定**：初始化时绑定 → Phase 2.5 RR绑定到ctx
3. **算法过滤**：无 → `wd_drv_alg_support()` + `set_param()`
4. **架构统一**：与cipher模块使用相同的初始化流程

所有修改点均参照 `wd_cipher.c` 已适配模板实现，保证框架一致性。