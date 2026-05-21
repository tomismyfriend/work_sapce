# ZIP异构调度适配改动清单

## 概述

本文档对比 Origin 与 Design 版本的 cipher 模块差异，并列出 ZIP (wd_comp.c) 需要适配的具体改动点。

---

## 一、Origin vs Design 差异总览

| 函数 | Origin版本 | Design版本 | 差异类型 |
|------|------------|------------|----------|
| `wd_xxx_init_nolock` | 2参数 | 3参数(attrs) | **签名修改** |
| `wd_xxx_init` (V1) | 无驱动发现 | 新增驱动发现+绑定 | **新增逻辑** |
| `wd_xxx_uninit` (V1) | 无驱动解绑 | 新增驱动解绑+释放 | **新增逻辑** |
| `wd_xxx_init2_` (V2) | wd_alg_drv_bind | wd_ctx_bind_drivers | **核心改动** |
| `wd_xxx_uninit2` (V2) | wd_alg_drv_unbind | wd_ctx_unbind_drivers | **核心改动** |
| `wd_xxx_alloc_sess` | wd_drv_alg_support(driver) | wd_drv_alg_support(config) + set_param | **核心改动** |

---

## 二、详细改动清单 (6处)

### 改动点1: wd_comp_init_nolock 函数签名

**位置**: `wd_comp.c:142` (Origin) → `wd_comp.c:138` (Design需修改)

**改动内容**: 新增 `attrs` 参数

---

#### Origin版本

```c
static int wd_comp_init_nolock(struct wd_ctx_config *config, struct wd_sched *sched)
{
    int ret;

    ret = wd_set_epoll_en("WD_COMP_EPOLL_EN", &wd_comp_setting.config.epoll_en);
    if (ret < 0)
        return ret;

    wd_comp_setting.config.alg_name = "zlib gzip deflate lz77_zstd lz4 lz77_only";
    ret = wd_init_ctx_config(&wd_comp_setting.config, config);
    if (ret < 0)
        return ret;

    ret = wd_init_sched(&wd_comp_setting.sched, sched);
    if (ret < 0)
        goto out_clear_ctx_config;

    ret = wd_init_async_request_pool(&wd_comp_setting.pool,
                     config, WD_POOL_MAX_ENTRIES,
                     sizeof(struct wd_comp_msg));
    if (ret < 0)
        goto out_clear_sched;

    ret = wd_alg_init_driver(&wd_comp_setting.config, wd_comp_setting.driver);  // ← Origin: 传入driver
    if (ret)
        goto out_clear_pool;

    return 0;

out_clear_pool:
    wd_uninit_async_request_pool(&wd_comp_setting.pool);
out_clear_sched:
    wd_clear_sched(&wd_comp_setting.sched);
out_clear_ctx_config:
    wd_clear_ctx_config(&wd_comp_setting.config);
    return ret;
}
```

---

#### Design版本 (需改成)

```c
static int wd_comp_init_nolock(struct wd_ctx_config *config, struct wd_sched *sched, void *attrs)  // ← 新增attrs参数
{
    struct wd_init_attrs *comp_attrs = (struct wd_init_attrs *)attrs;  // ← 新增
    int ret;

    ret = wd_set_epoll_en("WD_COMP_EPOLL_EN", &wd_comp_setting.config.epoll_en);
    if (ret < 0)
        return ret;

    wd_comp_setting.config.alg_name = "zlib gzip deflate lz77_zstd lz4 lz77_only";
    ret = wd_init_ctx_config(&wd_comp_setting.config, config);
    if (ret < 0)
        return ret;

    ret = wd_init_sched(&wd_comp_setting.sched, sched);
    if (ret < 0)
        goto out_clear_ctx_config;

    ret = wd_init_async_request_pool(&wd_comp_setting.pool,
                     config, WD_POOL_MAX_ENTRIES,
                     sizeof(struct wd_comp_msg));
    if (ret < 0)
        goto out_clear_sched;

    wd_comp_setting.priv = STATUS_ENABLE;  // ← 新增: 用priv标记初始化状态

    // ← 新增: V2路径需要设置ctx_config_internal
    if (comp_attrs)
        comp_attrs->ctx_config_internal = &wd_comp_setting.config;

    return 0;

out_clear_sched:
    wd_clear_sched(&wd_comp_setting.sched);
out_clear_ctx_config:
    wd_clear_ctx_config(&wd_comp_setting.config);
    return ret;
}
```

---

#### 改动原因

1. **V2路径需要传递内部config指针**: `wd_alg_attrs_init` 内部调用 `alg_init`，需要知道内部config在哪里存储drv_array
2. **删除wd_alg_init_driver调用**: 驱动初始化移到Phase 3，由框架统一管理
3. **新增priv标记**: 用于判断初始化状态，与cipher保持一致

---

### 改动点2: wd_comp_init (V1路径)

**位置**: `wd_comp.c:202` (Origin) → `wd_comp.c:194` (Design需修改)

**改动内容**: 新增 Phase 2 驱动发现 + Phase 2.5 驱动绑定 + Phase 3 驱动初始化

---

#### Origin版本

```c
int wd_comp_init(struct wd_ctx_config *config, struct wd_sched *sched)
{
    int ret;

    pthread_atfork(NULL, NULL, wd_comp_clear_status);

    ret = wd_alg_try_init(&wd_comp_setting.status);
    if (ret)
        return ret;

    ret = wd_init_param_check(config, sched);
    if (ret)
        goto out_clear_init;

    ret = wd_comp_open_driver(WD_TYPE_V1);
    if (ret)
        goto out_clear_init;

    ret = wd_comp_init_nolock(config, sched);  // ← 无attrs参数
    if (ret)
        goto out_clear_driver;

    wd_alg_set_init(&wd_comp_setting.status);  // ← 直接完成，无驱动发现

    return 0;

out_clear_driver:
    wd_comp_close_driver(WD_TYPE_V1);
out_clear_init:
    wd_alg_clear_init(&wd_comp_setting.status);
    return ret;
}
```

---

#### Design版本 (需改成)

```c
int wd_comp_init(struct wd_ctx_config *config, struct wd_sched *sched)
{
    __u32 drv_count = 0;  // ← 新增
    int ret;

    pthread_atfork(NULL, NULL, wd_comp_clear_status);

    ret = wd_alg_try_init(&wd_comp_setting.status);
    if (ret)
        return ret;

    ret = wd_init_param_check(config, sched);
    if (ret)
        goto out_clear_init;

    ret = wd_comp_open_driver(WD_TYPE_V1);
    if (ret)
        goto out_clear_init;

    // Phase 1: 内部复制
    ret = wd_comp_init_nolock(config, sched, NULL);  // ← 传NULL
    if (ret)
        goto out_clear_driver;

    // Phase 2: 驱动发现 ← 新增
    ret = wd_get_drv_array("comp", TASK_HW, "hisi_zip",
            &wd_comp_setting.config.drv_array, &drv_count);
    if (ret) {
        WD_ERR("driver discovery failed!\n");
        goto out_uninit_nolock;
    }

    // Phase 2.5: 驱动绑定 ← 新增
    ret = wd_ctx_bind_drivers(&wd_comp_setting.config,
            wd_comp_setting.config.drv_array, drv_count);
    if (ret) {
        WD_ERR("driver binding failed!\n");
        goto out_free_drv_array;
    }

    // Phase 3: 驱动初始化 ← 新增
    ret = wd_alg_init_driver(&wd_comp_setting.config);
    if (ret)
        goto out_unbind_drivers;

    wd_alg_set_init(&wd_comp_setting.status);

    return 0;

out_unbind_drivers:
    wd_ctx_unbind_drivers(&wd_comp_setting.config);
out_free_drv_array:
    wd_put_drv_array(wd_comp_setting.config.drv_array, drv_count);
    wd_comp_setting.config.drv_array = NULL;
out_uninit_nolock:
    wd_comp_uninit_nolock();
out_clear_driver:
    wd_comp_close_driver(WD_TYPE_V1);
out_clear_init:
    wd_alg_clear_init(&wd_comp_setting.status);
    return ret;
}
```

---

#### 改动原因

1. **V1路径需支持异构框架**: 原Origin版本V1路径无驱动发现/绑定，无法支持异构调度
2. **四阶段统一**: V1和V2路径共享相同的Phase 2/2.5/3逻辑
3. **硬编码驱动名**: V1路径用 `"hisi_zip"` 指定驱动名，精确过滤

---

### 改动点3: wd_comp_uninit (V1路径)

**位置**: `wd_comp.c:235` (Origin) → `wd_comp.c:253` (Design需修改)

**改动内容**: 新增驱动解绑和drv_array释放

---

#### Origin版本

```c
void wd_comp_uninit(void)
{
    int ret;

    ret = wd_comp_uninit_nolock();
    if (ret)
        return;

    wd_comp_close_driver(WD_TYPE_V1);
    wd_alg_clear_init(&wd_comp_setting.status);
}
```

---

#### Design版本 (需改成)

```c
void wd_comp_uninit(void)
{
    int ret;

    wd_alg_uninit_driver(&wd_comp_setting.config);  // ← 新增
    wd_ctx_unbind_drivers(&wd_comp_setting.config); // ← 新增

    ret = wd_comp_uninit_nolock();
    if (ret)
        return;

    wd_put_drv_array(wd_comp_setting.config.drv_array,
                 wd_comp_setting.config.drv_count);  // ← 新增
    wd_comp_setting.config.drv_array = NULL;        // ← 新增

    wd_comp_close_driver(WD_TYPE_V1);
    wd_alg_clear_init(&wd_comp_setting.status);
}
```

---

#### 改动原因

1. **反向清理**: init时绑定驱动，uninit时需要解绑
2. **释放drv_array**: init时分配的驱动数组需要释放

---

### 改动点4: wd_comp_init2_ (V2路径)

**位置**: `wd_comp.c:247` (Origin) → `wd_comp.c:272` (Design需修改)

**改动内容**: 删除wd_alg_drv_bind，改用框架内wd_alg_drv_discover，新增Phase 2.5

---

#### Origin版本

```c
int wd_comp_init2_(char *alg, __u32 sched_type, int task_type, struct wd_ctx_params *ctx_params)
{
    struct wd_ctx_nums comp_ctx_num[WD_DIR_MAX] = {0};
    struct wd_ctx_params comp_ctx_params = {0};
    int state, ret = -WD_EINVAL;
    bool flag;

    pthread_atfork(NULL, NULL, wd_comp_clear_status);

    state = wd_alg_try_init(&wd_comp_setting.status);
    if (state)
        return state;

    // ... 参数检查 ...

    state = wd_comp_open_driver(WD_TYPE_V2);
    if (state)
        goto out_uninit;

    while (ret != 0) {
        memset(&wd_comp_setting.config, 0, sizeof(struct wd_ctx_config_internal));

        // ← Origin: 在循环内绑定单个驱动
        wd_comp_setting.driver = wd_alg_drv_bind(task_type, alg);
        if (!wd_comp_setting.driver) {
            WD_ERR("failed to bind %s driver.\n", alg);
            goto out_dlclose;
        }

        comp_ctx_params.ctx_set_num = comp_ctx_num;
        ret = wd_ctx_param_init(&comp_ctx_params, ctx_params,
                    wd_comp_setting.driver,  // ← Origin: 传入driver
                    WD_COMP_TYPE, WD_DIR_MAX);
        if (ret) {
            if (ret == -WD_EAGAIN) {
                wd_disable_drv(wd_comp_setting.driver);
                wd_alg_drv_unbind(wd_comp_setting.driver);  // ← Origin: 解绑
                continue;
            }
            goto out_unbind_drv;
        }

        (void)strcpy(wd_comp_init_attrs.alg, alg);
        wd_comp_init_attrs.sched_type = sched_type;
        wd_comp_init_attrs.driver = wd_comp_setting.driver;  // ← Origin: attrs.driver
        wd_comp_init_attrs.ctx_params = &comp_ctx_params;
        wd_comp_init_attrs.alg_init = wd_comp_init_nolock;
        wd_comp_init_attrs.alg_poll_ctx = wd_comp_poll_ctx;
        ret = wd_alg_attrs_init(&wd_comp_init_attrs);
        if (ret) {
            if (ret == -WD_ENODEV) {
                wd_disable_drv(wd_comp_setting.driver);
                wd_alg_drv_unbind(wd_comp_setting.driver);
                wd_ctx_param_uninit(&comp_ctx_params);
                continue;
            }
            WD_ERR("fail to init alg attrs.\n");
            goto out_params_uninit;
        }
    }

    wd_alg_set_init(&wd_comp_setting.status);  // ← Origin: 无Phase 2.5/3
    wd_ctx_param_uninit(&comp_ctx_params);

    return 0;

out_params_uninit:
    wd_ctx_param_uninit(&comp_ctx_params);
out_unbind_drv:
    wd_alg_drv_unbind(wd_comp_setting.driver);  // ← Origin: 单驱动解绑
out_dlclose:
    wd_comp_close_driver(WD_TYPE_V2);
out_uninit:
    wd_alg_clear_init(&wd_comp_setting.status);
    return ret;
}
```

---

#### Design版本 (需改成)

```c
int wd_comp_init2_(const char *alg, __u32 sched_type, int task_type,
           struct wd_ctx_params *ctx_params)
{
    struct wd_ctx_nums comp_ctx_num[WD_DIR_MAX] = {0};
    struct wd_ctx_params comp_ctx_params = {0};
    int state, ret = -WD_EINVAL;
    bool flag;

    pthread_atfork(NULL, NULL, wd_comp_clear_status);

    state = wd_alg_try_init(&wd_comp_setting.status);
    if (state)
        return state;

    // ... 参数检查 ...

    state = wd_comp_open_driver(WD_TYPE_V2);
    if (state)
        goto out_uninit;

    while (ret != 0) {
        memset(&wd_comp_setting.config, 0, sizeof(struct wd_ctx_config_internal));

        // ← Design: 删除wd_alg_drv_bind，框架内wd_alg_attrs_init会调用wd_alg_drv_discover

        comp_ctx_params.ctx_set_num = comp_ctx_num;
        ret = wd_ctx_param_init(&comp_ctx_params, ctx_params,
                    alg, task_type,  // ← Design: 不传driver，传alg和task_type
                    WD_COMP_TYPE, WD_DIR_MAX);
        if (ret) {
            if (ret == -WD_EAGAIN) {
                continue;
            }
            goto out_dlclose;
        }

        (void)strcpy(wd_comp_init_attrs.alg, alg);
        wd_comp_init_attrs.sched_type = sched_type;
        wd_comp_init_attrs.task_type = task_type;  // ← Design: 新增task_type
        // ← Design: 删除attrs.driver
        wd_comp_init_attrs.ctx_params = &comp_ctx_params;
        wd_comp_init_attrs.alg_init = wd_comp_init_nolock;
        wd_comp_init_attrs.alg_poll_ctx = wd_comp_poll_ctx;

        // Phase 1 + Phase 2
        ret = wd_alg_attrs_init(&wd_comp_init_attrs);  // ← Design: 内部调用wd_alg_drv_discover
        if (ret) {
            if (ret == -WD_ENODEV) {
                wd_ctx_param_uninit(&comp_ctx_params);
                continue;
            }
            WD_ERR("fail to init alg attrs.\n");
            goto out_params_uninit;
        }
    }

    WD_INFO("ctxs numbers: %u.\n", wd_comp_setting.config.ctx_num);

    // Phase 2.5: RR bind drivers ← 新增
    ret = wd_ctx_bind_drivers(&wd_comp_setting.config,
                  wd_comp_init_attrs.drv_array,  // ← Design: 从attrs获取drv_array
                  wd_comp_init_attrs.drv_count);
    if (ret) {
        WD_ERR("driver binding failed!\n");
        goto out_uninit_nolock;
    }

    // Phase 3: Driver initialization ← 新增
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
out_params_uninit:
    wd_ctx_param_uninit(&comp_ctx_params);
out_dlclose:
    wd_comp_close_driver(WD_TYPE_V2);
out_uninit:
    wd_alg_clear_init(&wd_comp_setting.status);
    return ret;
}
```

---

#### 改动原因

1. **删除wd_alg_drv_bind**: Origin版本在循环内绑定单驱动，Design版本由框架统一发现drv_array
2. **新增task_type字段**: attrs需要传递task_type给框架，用于驱动发现过滤
3. **新增Phase 2.5**: wd_alg_attrs_init完成后需要手动调用wd_ctx_bind_drivers
4. **新增Phase 3**: 驱动初始化在绑定后执行

---

### 改动点5: wd_comp_uninit2 (V2路径)

**位置**: `wd_comp.c:333` (Origin) → `wd_comp.c:367` (Design需修改)

**改动内容**: 删除wd_alg_drv_unbind，改用wd_ctx_unbind_drivers

---

#### Origin版本

```c
void wd_comp_uninit2(void)
{
    int ret;

    ret = wd_comp_uninit_nolock();
    if (ret)
        return;

    wd_alg_attrs_uninit(&wd_comp_init_attrs);
    wd_alg_drv_unbind(wd_comp_setting.driver);  // ← Origin: 单驱动解绑
    wd_comp_close_driver(WD_TYPE_V2);
    wd_alg_clear_init(&wd_comp_setting.status);
}
```

---

#### Design版本 (需改成)

```c
void wd_comp_uninit2(void)
{
    int ret;

    wd_alg_uninit_driver(&wd_comp_setting.config);    // ← 新增
    wd_ctx_unbind_drivers(&wd_comp_setting.config);   // ← 新增

    ret = wd_comp_uninit_nolock();
    if (ret)
        return;

    wd_alg_attrs_uninit(&wd_comp_init_attrs);
    // ← Design: 删除wd_alg_drv_unbind
    wd_comp_close_driver(WD_TYPE_V2);
    wd_alg_clear_init(&wd_comp_setting.status);
}
```

---

#### 改动原因

1. **反向清理**: init时执行了Phase 2.5绑定和Phase 3初始化，uninit时需要反向解绑
2. **框架统一管理**: drv_array由框架管理，不需要手动解绑单驱动

---

### 改动点6: wd_comp_alloc_sess

**位置**: `wd_comp.c:452` (Origin) → `wd_comp.c:488` (Design需修改)

**改动内容**: wd_drv_alg_support参数改变 + 新增sched.set_param调用

---

#### Origin版本

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

    ret = wd_mem_ops_init(wd_comp_setting.config.ctxs[0].ctx, &setup->mm_ops, setup->mm_type);
    if (ret) {
        WD_ERR("failed to init memory ops!\n");
        goto sess_err;
    }

    ret = wd_alloc_ctx_buf(&setup->mm_ops, sess);
    if (ret)
        goto sess_err;

    sess->alg_type = setup->alg_type;
    sess->comp_lv = setup->comp_lv;
    sess->win_sz = setup->win_sz;
    sess->stream_pos = WD_COMP_STREAM_NEW;

    sess->mm_type = setup->mm_type;
    memcpy(&sess->mm_ops, &setup->mm_ops, sizeof(struct wd_mm_ops));

    sess->sched_key = (void *)wd_comp_setting.sched.sched_init(
             wd_comp_setting.sched.h_sched_ctx, setup->sched_param);
    if (WD_IS_ERR(sess->sched_key)) {
        WD_ERR("failed to init session schedule key!\n");
        goto sched_err;
    }

    // ← Origin: 无compat检查，无set_param
    return (handle_t)sess;

sched_err:
    wd_free_ctx_buf(&setup->mm_ops, sess);
sess_err:
    free(sess);
    return (handle_t)0;
}
```

---

#### Design版本 (需改成)

```c
handle_t wd_comp_alloc_sess(struct wd_comp_sess_setup *setup)
{
    struct wd_comp_sess *sess;
    struct wd_sched_params params;  // ← 新增
    const char *alg_name;           // ← 新增
    int ret;
    bool drv_support;               // ← 新增

    if (!setup)
        return (handle_t)0;

    ret = wd_comp_check_sess_params(setup);
    if (ret)
        return (handle_t)0;

    // ← 新增: 算法类型越界检查
    if (setup->alg_type >= WD_COMP_ALG_MAX) {
        WD_ERR("invalid: alg_type %u!\n", setup->alg_type);
        return (handle_t)0;
    }

    // ← 新增: 获取算法名并做兼容检查
    alg_name = wd_comp_alg_name[setup->alg_type];
    drv_support = wd_drv_alg_support(alg_name, &wd_comp_setting.config);  // ← Design: 传config，不传driver
    if (!drv_support) {
        WD_ERR("failed to support this algorithm: %s!\n", alg_name);
        return (handle_t)0;
    }

    sess = calloc(1, sizeof(struct wd_comp_sess));
    if (!sess)
        return (handle_t)0;

    ret = wd_mem_ops_init(wd_comp_setting.config.ctxs[0].ctx, &setup->mm_ops, setup->mm_type);
    if (ret) {
        WD_ERR("failed to init memory ops!\n");
        goto sess_err;
    }

    ret = wd_alloc_ctx_buf(&setup->mm_ops, sess);
    if (ret)
        goto sess_err;

    sess->alg_type = setup->alg_type;
    sess->comp_lv = setup->comp_lv;
    sess->win_sz = setup->win_sz;
    sess->stream_pos = WD_COMP_STREAM_NEW;

    sess->mm_type = setup->mm_type;
    memcpy(&sess->mm_ops, &setup->mm_ops, sizeof(struct wd_mm_ops));

    sess->sched_key = (void *)wd_comp_setting.sched.sched_init(
             wd_comp_setting.sched.h_sched_ctx, setup->sched_param);
    if (WD_IS_ERR(sess->sched_key)) {
        WD_ERR("failed to init session schedule key!\n");
        goto sched_err;
    }

    // ← 新增: 设置sched_key参数，触发compat过滤
    memset(&params, 0, sizeof(params));
    params.alg_name = alg_name;
    params.ctxs = wd_comp_setting.config.ctxs;
    wd_comp_setting.sched.set_param(
        wd_comp_setting.sched.h_sched_ctx,
        sess->sched_key, &params);

    return (handle_t)sess;

sched_err:
    wd_free_ctx_buf(&setup->mm_ops, sess);
sess_err:
    free(sess);
    return (handle_t)0;
}
```

---

#### 改动原因

1. **兼容检查**: wd_drv_alg_support 检查config中是否有ctx支持目标算法，参数从driver改为config
2. **参数设置**: sched.set_param 设置 alg_name 和 ctxs，触发 wd_sched_skey_compat_filter 过滤idx_list
3. **异构调度核心**: 这两步确保session的idx_list只包含支持目标算法的ctx索引

---

## 三、改动点总结表

| 改动点 | 函数 | 改动类型 | 改动量 |
|--------|------|----------|--------|
| **1** | wd_comp_init_nolock | 签名+内部逻辑 | ~10行 |
| **2** | wd_comp_init (V1) | 新增驱动发现+绑定 | ~25行 |
| **3** | wd_comp_uninit (V1) | 新增驱动解绑+释放 | ~8行 |
| **4** | wd_comp_init2_ (V2) | 删除drv_bind，新增Phase 2.5/3 | ~20行 |
| **5** | wd_comp_uninit2 (V2) | 新增驱动解绑 | ~3行 |
| **6** | wd_comp_alloc_sess | 新增compat+set_param | ~12行 |

**总改动量**: ~80行代码

---

## 四、改动前后对比图

### Origin版本流程

```
wd_comp_init2_ (Origin)
    │
    ├─ wd_alg_drv_bind(alg) → 单驱动绑定
    │     wd_comp_setting.driver = drv
    │
    ├─ wd_alg_attrs_init(attrs)
    │     attrs.driver = drv
    │
    └─ wd_alg_set_init() → 完成

wd_comp_alloc_sess (Origin)
    │
    ├─ sched.sched_init() → 创建sched_key
    │
    └─ return sess  // 无compat检查
```

### Design版本流程

```
wd_comp_init2_ (Design)
    │
    ├─ wd_alg_attrs_init(attrs)  // Phase 1+2
    │     wd_alg_drv_discover() → drv_array[]
    │     wd_alg_ctx_init() → ctxs[]
    │
    ├─ wd_ctx_bind_drivers(config, drv_array, drv_count)  // Phase 2.5 ← 新增
    │     ctxs[i].drv = drv_array[i % drv_count]
    │     ctxs[i].ctx_type = drv->calc_type
    │
    ├─ wd_alg_init_driver(config)  // Phase 3 ← 新增
    │     drv->init(ctx)
    │
    └─ wd_alg_set_init()

wd_comp_alloc_sess (Design)
    │
    ├─ wd_drv_alg_support(alg, config) ← 新增
    │     遍历ctxs，检查drv支持alg
    │
    ├─ sched.sched_init() → 创建sched_key
    │
    ├─ sched.set_param(h_ctx, sched_key, params) ← 新增
    │     params.alg_name = alg
    │     params.ctxs = ctxs
    │     wd_sched_skey_compat_filter() → 过滤idx_list
    │
    └─ return sess
```

---

## 五、关键差异对比表

| 对比项 | Origin | Design |
|--------|--------|--------|
| **驱动存储** | `wd_comp_setting.driver` (单指针) | `wd_comp_setting.config.drv_array[]` (数组) |
| **驱动绑定时机** | init2_循环开头 wd_alg_drv_bind | Phase 2.5 wd_ctx_bind_drivers |
| **ctx绑定drv** | 无 | ctxs[i].drv = drv_array[i % drv_count] |
| **ctx_type标记** | 无 | ctxs[i].ctx_type = drv->calc_type |
| **compat检查** | wd_drv_alg_support(alg, driver) | wd_drv_alg_support(alg, config) |
| **set_param调用** | 无 | sched.set_param(h_ctx, sched_key, params) |
| **idx_list过滤** | 无 | wd_sched_skey_compat_filter |

---

## 六、注意事项

### 1. 头文件修改 (已完成)

以下头文件已在Design版本中修改，ZIP适配无需额外改动：

- `wd_alg_common.h` - 新增 `wd_sched.set_param` 回调
- `wd_internal.h` - 新增 `drv_array`, `drv_count`, `ctx_type`, `drv` 等字段

### 2. wd_comp_uninit_nolock 改动

需要同步修改 `wd_comp_uninit_nolock`：

```c
static int wd_comp_uninit_nolock(void)
{
    void *priv = wd_comp_setting.priv;

    if (!priv)
        return -WD_EINVAL;

    wd_uninit_async_request_pool(&wd_comp_setting.pool);
    wd_clear_sched(&wd_comp_setting.sched);
    wd_comp_setting.priv = NULL;  // ← 新增

    // ← 删除: wd_alg_uninit_driver调用移到wd_comp_uninit
    return 0;
}
```

### 3. wd_comp_setting结构体

Design版本需要确保 `wd_comp_setting.config` 包含以下字段：
- `drv_array`
- `drv_count`

这些字段已在 `wd_internal.h` 的 `wd_ctx_config_internal` 中定义。

### 4. wd_comp_alg_name数组

需要确保 `wd_comp_alg_name` 数组存在，用于获取算法名：

```c
static const char *wd_comp_alg_name[] = {
    [WD_DEFLATE] = "deflate",
    [WD_ZLIB] = "zlib",
    [WD_GZIP] = "gzip",
    ...
};
```

---

## 七、编译验证步骤

```bash
cd uadk_design
./cleanup.sh
./autogen.sh
./configure
make -j$(nproc)
```

---

## 八、测试验证

执行 STC 测试用例 (STC-01~16)，验证：
- 基础业务功能 (压缩/解压缩)
- drv_count >= 1
- ctxs[i].drv 非空
- sched.set_param 生效
- compat过滤正确