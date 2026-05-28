# hisi_zip.ko insmod 崩溃分析报告

## 1. 崩溃概要

| 项目 | 值 |
|------|-----|
| **触发操作** | `insmod hisi_zip.ko` |
| **错误类型** | Unable to handle kernel paging request (Data Abort) |
| **崩溃地址** | `ffff0800007f0028` (虚拟地址, level 1 translation fault) |
| **ESR** | `0x96000005` (EC=0x25 DABT, FSC=0x05 level 1 translation fault) |
| **崩溃PC** | `hisi_zip_acomp_cb+0x38/0x1a8 [hisi_zip]` |
| **崩溃LR** | `qm_work_process+0x13c/0x2d8 [hisi_qm]` |
| **CPU/PID** | CPU: 1, PID: 4297 |
| **进程名** | `kworker/u12:0` (内核工作队列线程) |
| **硬件平台** | Hi1650FPGA 1P TA (鲲鹏 ARM64) |
| **内核版本** | 6.6.0 (openEuler) |
| **Tainted** | G OEL |
| **崩溃Workqueue** | `0000:1d:00.0 qm_work_process [hisi_qm]` |
| **模块状态** | `hisi_zip(E+)` — E=正在加载, +=已加载 |

---

## 2. 完整调用栈 (从底到顶)

```
ret_from_fork+0x10/0x20              # 内核线程入口
  └─ kthread+0xec/0x100              # 内核线程主函数
      └─ worker_thread+0x234/0x3b8   # workqueue 工作线程
          └─ process_one_work+0x16c/0x3c0  # 执行单个work item
              └─ qm_work_process+0x13c/0x2d8 [hisi_qm]  # QM轮询处理
                  └─ qm_poll_req_cb (内联)               # 轮询CQ完成
                      └─ hisi_zip_acomp_cb+0x38/0x1a8 [hisi_zip]  # ★ 崩溃点
```

---

## 3. 业务执行流程通路 (函数执行顺序)

### 3.1 模块加载阶段 (insmod 触发)

```
insmod hisi_zip.ko
  │
  ├─① hisi_zip_init()                          [zip_main.c:1652]  module_init
  │    ├─ hisi_qm_init_list(&zip_devices)       初始化设备链表
  │    ├─ hisi_zip_register_debugfs()           注册debugfs根目录
  │    └─ pci_register_driver(&hisi_zip_pci_driver)  注册PCI驱动
  │
  ├─② hisi_zip_probe(pdev, id)                 [zip_main.c:1499]  PCI probe
  │    ├─ devm_kzalloc() → hisi_zip             分配设备结构体
  │    ├─ set_bit(QM_DRIVER_DOWN, ...)          标记驱动正在加载
  │    │
  │    ├─③ hisi_zip_qm_init(qm, pdev)          [zip_main.c:1399]  QM初始化
  │    │    ├─ 设置 qm->pdev, mode, sqe_size, dev_name, fun_type
  │    │    ├─ hisi_qm_init(qm)                 QM基础初始化
  │    │    │    ├─ 分配 EQ/AEQ/CQ/SQ DMA内存
  │    │    │    ├─ INIT_WORK(&poll_data[i].work, qm_work_process)  ★ 初始化work
  │    │    │    ├─ alloc_workqueue()            创建工作队列
  │    │    │    └─ 注册中断 (EQ中断 qm_eq_irq)
  │    │    ├─ zip_pre_store_cap_reg(qm)        预存能力寄存器
  │    │    ├─ hisi_qm_set_algs()               设置支持的算法
  │    │    └─ hisi_dae_set_alg(qm)             DAE算法配置
  │    │
  │    ├─④ hisi_zip_probe_init(hisi_zip)       [zip_main.c:1467]  探测初始化
  │    │    └─ hisi_zip_pf_probe_init()         [zip_main.c:1349]
  │    │         ├─ hisi_zip_set_user_domain_and_cache(qm)  配置用户域和缓存
  │    │         ├─ hisi_zip_debug_regs_clear()             清除调试寄存器
  │    │         └─ hisi_zip_show_last_regs_init()          初始化寄存器快照
  │    │
  │    ├─⑤ hisi_qm_start(qm)                   启动QM
  │    │    ├─ 启动EQ中断
  │    │    └─ 使能设备 (此时硬件开始工作, 可能产生中断!)
  │    │
  │    ├─ clear_bit(QM_DRIVER_DOWN, ...)        清除加载标记
  │    │
  │    ├─⑥ hisi_zip_debugfs_init(qm)           初始化debugfs
  │    │
  │    ├─⑦ hisi_qm_add_list(qm, &zip_devices)  加入设备链表
  │    │
  │    ├─⑧ hisi_qm_alg_register()              注册到crypto子系统
  │    │    └─ hisi_zip_register_to_crypto()    [zip_crypto.c:665]
  │    │         └─ hisi_zip_register_deflate() 注册deflate算法
  │    │              └─ crypto_register_acomp() 注册异步压缩算法
  │    │
  │    ├─⑨ qm_register_uacce(qm)               注册UACCE
  │    │
  │    └─⑩ hisi_qm_pm_init(qm)                 电源管理初始化
  │
  └─ 模块加载完成
```

### 3.2 中断/完成事件处理路径 (崩溃发生的路径)

```
硬件完成一个QP操作 → 产生完成中断
  │
  ├─① qm_eq_irq(irq, data)                    [qm.c:1140]  EQ中断处理
  │    └─ qm_get_complete_eqe_num(qm)           [qm.c:1098]
  │         ├─ 遍历EQ, 收集完成的QP ID
  │         ├─ poll_data->eqe_num = eqe_num
  │         └─ queue_work(qm->wq, &poll_data->work)  ★ 入队work
  │
  ├─② kworker线程被唤醒
  │    └─ process_one_work()                    内核workqueue框架
  │         └─ qm_work_process(work)            [qm.c:1074]
  │              ├─ 遍历完成的QP
  │              ├─ 检查 QP_STOP 标志
  │              └─ qp->req_cb 非空时:
  │                   └─③ qm_poll_req_cb(qp)    [qm.c:1052]
  │                        ├─ 遍历CQ中的完成项
  │                        ├─ cqe = qp->cqe + qp->qp_status.cq_head
  │                        ├─ sqe_index = le16_to_cpu(cqe->sq_head)
  │                        └─④ qp->req_cb(qp, qp->sqe + sqe_size * sqe_index)
  │                             即 hisi_zip_acomp_cb(qp, sqe_data)
  │
  └─⑤ hisi_zip_acomp_cb(qp, data)             [zip_crypto.c:309]  ★ 崩溃
       ├─ sqe = data                            [zip_crypto.c:311]
       ├─ req = GET_REQ_FROM_SQE(sqe)           [zip_crypto.c:312]
       │    └─ 从 sqe->dw26/dw27 提取 req 指针
       ├─ qp_ctx = req->qp_ctx                  [zip_crypto.c:313]  ★★ 崩溃点
       │    └─ 访问 req + 0x28 → 地址 ffff0800007f0028
       │       pud=0x0000000000000000 → 页表无效!
       │
       ├─ (未执行) ops->get_status(sqe)
       ├─ (未执行) hisi_acc_sg_buf_unmap()
       ├─ (未执行) acomp_request_complete()
       └─ (未执行) hisi_zip_remove_req()
```

---

## 4. 崩溃根因分析

### 4.1 直接原因

`hisi_zip_acomp_cb()` 在 `zip_crypto.c:313` 处解引用了一个**无效的指针**:

```c
// zip_crypto.c:309-315
static void hisi_zip_acomp_cb(struct hisi_qp *qp, void *data)
{
    struct hisi_zip_sqe *sqe = data;                           // sqe = ffff0800007f0000
    struct hisi_zip_req *req = GET_REQ_FROM_SQE(sqe);          // 从sqe->dw26/dw27提取
    struct hisi_zip_qp_ctx *qp_ctx = req->qp_ctx;              // ★ 崩溃: req=ffff0800007f0000
    ...                                                         //   访问 +0x28 偏移
}
```

寄存器 `x20 = ffff0800007f0000` 是 `sqe` 指针, 从中提取的 `req` 指针也是 `ffff0800007f0000` (或附近), 访问 `req->qp_ctx` (偏移 0x28) 得到 `ffff0800007f0028`, 该地址**没有有效的页表映射** (pud=0)。

### 4.2 根本原因: 残留中断/竞态条件

**时序问题**: 模块加载过程中, `hisi_qm_start()` 启动了硬件和中断, 但此时 crypto 上下文尚未完全初始化:

```
时间线:
  hisi_qm_start()           ← 硬件开始工作, EQ中断使能
       │
       │  ← 此时硬件可能产生残留/虚假完成事件
       │  ← EQ中断触发 → qm_eq_irq → queue_work
       │
  hisi_qm_alg_register()    ← crypto注册 (req_cb 此时才可能被设置)
       │
  kworker 执行 qm_work_process
       │
       └─ 调用 qp->req_cb → hisi_zip_acomp_cb
            └─ SQE中的 dw26/dw27 未初始化 → 提取到垃圾指针 → 崩溃
```

关键证据:
- `hisi_zip(E+)` — `E` 标志表示模块正在加载中
- `[last unloaded: hisi_zip(E)]` — 之前有一次加载失败/卸载
- SQE 的 `dw26`/`dw27` 本应存储 `hisi_zip_req` 指针 (由 `hisi_zip_fill_tag()` 在压缩请求时写入), 但此时没有实际的压缩请求被提交过
- `req` 指针值 `ffff0800007f0000` 不是合法的 `hisi_zip_req` 结构体地址

### 4.3 `hisi_zip_req` 结构体偏移验证

```c
struct hisi_zip_req {
    struct acomp_req *req;           // +0x00  (8 bytes)
    struct hisi_acc_hw_sgl *hw_src;  // +0x08  (8 bytes)
    struct hisi_acc_hw_sgl *hw_dst;  // +0x10  (8 bytes)
    dma_addr_t dma_src;              // +0x18  (8 bytes)
    dma_addr_t dma_dst;              // +0x20  (8 bytes)
    struct hisi_zip_qp_ctx *qp_ctx;  // +0x28  ← 崩溃访问的偏移!
    u16 req_id;                      // +0x30
};
```

崩溃地址 `ffff0800007f0028` = `req_base(ffff0800007f0000)` + `offset(0x28)` = `req->qp_ctx`, 完全吻合。

---

## 5. 涉及的关键数据结构关系

```
hisi_zip (PCI设备)
  └─ hisi_qm (队列管理器)
       ├─ qp_array[] (QP数组)
       │    └─ hisi_qp
       │         ├─ sqe (提交队列元素, DMA内存)
       │         ├─ cqe (完成队列元素, DMA内存)
       │         ├─ req_cb → hisi_zip_acomp_cb  (完成回调)
       │         └─ qm → 回指 hisi_qm
       │
       ├─ poll_data[] (轮询数据)
       │    └─ hisi_qm_poll_data
       │         ├─ work → qm_work_process
       │         ├─ qm → 回指 hisi_qm
       │         └─ qp_finish_id[] (完成的QP ID)
       │
       ├─ eqe (事件队列元素)
       ├─ wq (工作队列)
       └─ err_ini → hisi_zip_err_ini (错误处理)

hisi_zip_ctx (crypto上下文, per tfm)
  ├─ qp_ctx[0] (压缩)
  │    └─ hisi_zip_qp_ctx
  │         ├─ qp → hisi_qp
  │         ├─ req_q (请求队列)
  │         ├─ sgl_pool (SGL池)
  │         ├─ zip_dev → hisi_zip
  │         └─ ctx → hisi_zip_ctx
  │
  └─ qp_ctx[1] (解压)
       └─ (同上)
```

---

## 6. 完整函数执行顺序 (按时间线)

### 正常加载流程:

| 序号 | 函数 | 文件:行 | 说明 |
|------|------|---------|------|
| 1 | `hisi_zip_init` | zip_main.c:1652 | 模块入口 (module_init) |
| 2 | `hisi_qm_init_list` | qm.c | 初始化全局设备链表 |
| 3 | `hisi_zip_register_debugfs` | zip_main.c:1639 | 注册debugfs |
| 4 | `pci_register_driver` | zip_main.c:1659 | 注册PCI驱动, 触发probe |
| 5 | `hisi_zip_probe` | zip_main.c:1499 | PCI probe 入口 |
| 6 | `hisi_zip_qm_init` | zip_main.c:1399 | QM子系统初始化 |
| 7 | `hisi_qm_init` | qm.c | QM基础初始化(DMA/中断/workqueue) |
| 8 | `zip_pre_store_cap_reg` | zip_main.c:1375 | 预存能力寄存器 |
| 9 | `hisi_qm_set_algs` | qm.c | 设置算法支持 |
| 10 | `hisi_zip_probe_init` | zip_main.c:1467 | PF探测初始化 |
| 11 | `hisi_zip_pf_probe_init` | zip_main.c:1349 | 配置用户域/缓存/时钟门控 |
| 12 | `hisi_zip_set_user_domain_and_cache` | zip_main.c:587 | 硬件配置 |
| 13 | **`hisi_qm_start`** | qm.c | **启动QM, 使能中断** |
| 14 | `hisi_zip_debugfs_init` | zip_main.c:982 | 初始化debugfs |
| 15 | `hisi_qm_add_list` | qm.c | 加入设备链表 |
| 16 | `hisi_qm_alg_register` | qm.c | 注册crypto算法 |
| 17 | `hisi_zip_register_to_crypto` | zip_crypto.c:665 | 注册deflate |
| 18 | `qm_register_uacce` | qm.c | 注册UACCE |
| 19 | `hisi_qm_pm_init` | qm.c | 电源管理初始化 |

### 崩溃路径 (异步, 由中断触发):

| 序号 | 函数 | 文件:行 | 说明 |
|------|------|---------|------|
| A1 | `qm_eq_irq` | qm.c:1140 | EQ中断处理 (硬中断上下文) |
| A2 | `qm_get_complete_eqe_num` | qm.c:1098 | 收集完成事件, queue_work |
| A3 | `process_one_work` | kernel/workqueue.c | kworker执行work |
| A4 | `qm_work_process` | qm.c:1074 | 遍历完成QP |
| A5 | `qm_poll_req_cb` | qm.c:1052 | 轮询CQ, 调用req_cb |
| A6 | **`hisi_zip_acomp_cb`** | zip_crypto.c:309 | **★ 崩溃: 解引用无效req指针** |

---

## 7. 修复建议

### 方案一: 在 `hisi_zip_acomp_cb` 中增加防御性检查

```c
static void hisi_zip_acomp_cb(struct hisi_qp *qp, void *data)
{
    struct hisi_zip_sqe *sqe = data;
    struct hisi_zip_req *req = (struct hisi_zip_req *)GET_REQ_FROM_SQE(sqe);

    /* 防御性检查: 验证 req 指针合法性 */
    if (!req || !virt_addr_valid(req)) {
        dev_err(&qp->qm->pdev->dev,
                "invalid req pointer %p in sqe, skip\n", req);
        return;
    }

    struct hisi_zip_qp_ctx *qp_ctx = req->qp_ctx;
    ...
}
```

### 方案二: 确保 req_cb 在硬件启动后才注册 (推荐)

调整 `hisi_zip_probe()` 中的初始化顺序, 确保 `hisi_qm_start()` 在 `req_cb` 注册之后执行, 或者在 `qm_poll_req_cb` 中增加对驱动状态的检查:

```c
static void qm_poll_req_cb(struct hisi_qp *qp)
{
    ...
    while (QM_CQE_PHASE(cqe) == qp->qp_status.cqc_phase) {
        dma_rmb();
        /* 增加驱动状态检查 */
        if (test_bit(QM_DRIVER_DOWN, &qp->qm->misc_ctl))
            break;
        qp->req_cb(qp, qp->sqe + qm->sqe_size * le16_to_cpu(cqe->sq_head));
        ...
    }
}
```

### 方案三: 在 `qm_work_process` 中增加 QM_DRIVER_DOWN 检查

```c
static void qm_work_process(struct work_struct *work)
{
    ...
    for (i = eqe_num - 1; i >= 0; i--) {
        qp = &qm->qp_array[poll_data->qp_finish_id[i]];
        if (unlikely(atomic_read(&qp->qp_status.flags) == QP_STOP))
            continue;
        /* 增加: 驱动未就绪时跳过处理 */
        if (test_bit(QM_DRIVER_DOWN, &qm->misc_ctl))
            continue;
        ...
    }
}
```

---

## 8. 总结

这是一个**模块加载期间的竞态条件**导致的内核崩溃。`hisi_qm_start()` 启动硬件后, 硬件产生了完成事件 (可能是残留的或虚假的), 触发了 EQ 中断。中断处理将 work 入队, kworker 线程执行 `qm_work_process` → `qm_poll_req_cb` → `hisi_zip_acomp_cb`。在回调中, 从 SQE 的 `dw26`/`dw27` 字段提取的 `req` 指针是无效的 (SQE 内存未初始化或包含垃圾数据), 导致解引用 `req->qp_ctx` 时发生 page fault。
