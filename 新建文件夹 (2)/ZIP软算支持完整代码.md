# ZIP 软算支持 - 完整代码修改文档

## 文件1：drv/soft_lz4.h（新增）

```c
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2024 Huawei Technologies Co.,Ltd. All rights reserved. */

#ifndef __SOFT_LZ4_H
#define __SOFT_LZ4_H

#include "wd_comp_drv.h"

#ifdef __cplusplus
extern "C" {
#endif

int soft_lz4_init(void);
void soft_lz4_exit(void);
int soft_lz4_decompress(struct wd_comp_msg *msg);

#ifdef __cplusplus
}
#endif

#endif /* __SOFT_LZ4_H */
```

---

## 文件2：drv/soft_lz4.c（新增）

```c
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2024 Huawei Technologies Co.,Ltd. All rights reserved. */

#include <string.h>
#include <dlfcn.h>
#include "soft_lz4.h"

typedef int (*lz4_decompress_safe_fn)(const char*, char*, int, int);

static void *g_lz4_handle = NULL;
static lz4_decompress_safe_fn g_decompress_fn = NULL;

int soft_lz4_init(void)
{
	if (g_lz4_handle)
		return 0;

	g_lz4_handle = dlopen("liblz4.so.1", RTLD_NOW | RTLD_GLOBAL);
	if (!g_lz4_handle) {
		WD_ERR("soft_lz4: failed to load liblz4.so.1: %s\n", dlerror());
		return -WD_ENODEV;
	}

	g_decompress_fn = dlsym(g_lz4_handle, "LZ4_decompress_safe");
	if (!g_decompress_fn) {
		WD_ERR("soft_lz4: failed to get LZ4_decompress_safe symbol!\n");
		dlclose(g_lz4_handle);
		g_lz4_handle = NULL;
		return -WD_ENODEV;
	}

	WD_INFO("soft_lz4: loaded liblz4.so.1 successfully\n");
	return 0;
}

void soft_lz4_exit(void)
{
	if (g_lz4_handle) {
		dlclose(g_lz4_handle);
		g_lz4_handle = NULL;
		g_decompress_fn = NULL;
	}
}

int soft_lz4_decompress(struct wd_comp_msg *msg)
{
	int ret;

	if (!g_decompress_fn) {
		WD_ERR("soft_lz4: not initialized!\n");
		return -WD_EINVAL;
	}

	if (msg->req.src_len == 0) {
		WD_ERR("soft_lz4: src_len is zero!\n");
		return -WD_EINVAL;
	}

	ret = g_decompress_fn(
		(const char *)msg->req.src,
		(char *)msg->req.dst,
		msg->req.src_len,
		msg->req.dst_len);

	if (ret < 0) {
		WD_ERR("soft_lz4: decompress failed, ret=%d\n", ret);
		return -WD_EINVAL;
	}

	msg->produced = ret;
	msg->in_cons = msg->req.src_len;
	return 0;
}
```

---

## 文件3：drv/soft_lz77_zstd.h（新增）

```c
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2024 Huawei Technologies Co.,Ltd. All rights reserved. */

#ifndef __SOFT_LZ77_ZSTD_H
#define __SOFT_LZ77_ZSTD_H

#include "wd_comp_drv.h"

#ifdef __cplusplus
extern "C" {
#endif

int soft_lz77_zstd_init(void);
void soft_lz77_zstd_exit(void);
int soft_lz77_zstd_compress(struct wd_comp_msg *msg);
int soft_lz77_zstd_decompress(struct wd_comp_msg *msg);

#ifdef __cplusplus
}
#endif

#endif /* __SOFT_LZ77_ZSTD_H */
```

---

## 文件4：drv/soft_lz77_zstd.c（新增）

```c
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2024 Huawei Technologies Co.,Ltd. All rights reserved. */

#include "soft_lz77_zstd.h"

int soft_lz77_zstd_init(void)
{
	WD_INFO("soft_lz77_zstd: framework initialized (implementation pending)\n");
	return 0;
}

void soft_lz77_zstd_exit(void)
{
	WD_INFO("soft_lz77_zstd: exited\n");
}

int soft_lz77_zstd_compress(struct wd_comp_msg *msg)
{
	WD_ERR("soft_lz77_zstd: compress not implemented yet!\n");
	return -WD_ENOTSUP;
}

int soft_lz77_zstd_decompress(struct wd_comp_msg *msg)
{
	WD_ERR("soft_lz77_zstd: decompress not implemented yet!\n");
	return -WD_ENOTSUP;
}
```

---

## 文件5：drv/hisi_comp.c（修改）

### 修改点1：添加头文件（第8行后）

**原代码：**
```c
#include <linux/types.h>
#include "drv/wd_comp_drv.h"
#include "drv/hisi_comp_huf.h"
#include "hisi_qm_udrv.h"
```

**修改后：**
```c
#include <linux/types.h>
#include "drv/wd_comp_drv.h"
#include "drv/hisi_comp_huf.h"
#include "hisi_qm_udrv.h"
#include "soft_lz4.h"
#include "soft_lz77_zstd.h"
```

---

### 修改点2：hisi_zip_init 函数（第1453行后）

**原代码：**
```c
	hisi_zip_sqe_ops_adapt(h_qp);

	return 0;
out:
	for (j = 0; j < i; j++) {
		h_qp = (handle_t)wd_ctx_get_priv(config->ctxs[j].ctx);
		hisi_qm_free_qp(h_qp);
	}
	return -WD_EINVAL;
}
```

**修改后：**
```c
	hisi_zip_sqe_ops_adapt(h_qp);

	/* Initialize software fallback libraries */
	if (soft_lz4_init() != 0) {
		WD_WARN("soft_lz4: init failed, lz4 decompress will not work\n");
	}

	if (soft_lz77_zstd_init() != 0) {
		WD_WARN("soft_lz77_zstd: init failed, lz77_zstd will not work\n");
	}

	return 0;
out:
	for (j = 0; j < i; j++) {
		h_qp = (handle_t)wd_ctx_get_priv(config->ctxs[j].ctx);
		hisi_qm_free_qp(h_qp);
	}
	return -WD_EINVAL;
}
```

---

### 修改点3：hisi_zip_exit 函数（第1462行）

**原代码：**
```c
static void hisi_zip_exit(void *priv)
{
	struct hisi_zip_ctx *zip_ctx = (struct hisi_zip_ctx *)priv;
	struct wd_ctx_config_internal *config = &zip_ctx->config;
	handle_t h_qp;
	__u32 i;

	for (i = 0; i < config->ctx_num; i++) {
		h_qp = (handle_t)wd_ctx_get_priv(config->ctxs[i].ctx);
		hisi_qm_free_qp(h_qp);
	}
}
```

**修改后：**
```c
static void hisi_zip_exit(void *priv)
{
	struct hisi_zip_ctx *zip_ctx = (struct hisi_zip_ctx *)priv;
	struct wd_ctx_config_internal *config = &zip_ctx->config;
	handle_t h_qp;
	__u32 i;

	/* Cleanup software fallback libraries */
	soft_lz4_exit();
	soft_lz77_zstd_exit();

	for (i = 0; i < config->ctx_num; i++) {
		h_qp = (handle_t)wd_ctx_get_priv(config->ctxs[i].ctx);
		hisi_qm_free_qp(h_qp);
	}
}
```

---

### 修改点4：hisi_zip_comp_send 函数（第1527行）

**原代码：**
```c
static int hisi_zip_comp_send(handle_t ctx, void *comp_msg)
{
	struct hisi_qp *qp = wd_ctx_get_priv(ctx);
	struct wd_comp_msg *msg = comp_msg;
	handle_t h_qp = (handle_t)qp;
	struct hisi_zip_sqe sqe = {0};
	__u16 count = 0;
	int ret;

	/* Skip hardware, if the store buffer need to be copied to output */
	ret = check_store_buf(msg);
	if (ret)
		return 0;

	hisi_set_msg_id(h_qp, &msg->tag);
	ret = fill_zip_comp_sqe(qp, msg, &sqe);
	if (unlikely(ret < 0)) {
		if (ret != -WD_EBUSY)
			WD_ERR("failed to fill zip sqe, ret = %d!\n", ret);
		return ret;
	}
	ret = hisi_qm_send(h_qp, &sqe, 1, &count);
	if (unlikely(ret < 0)) {
		if (msg->req.data_fmt == WD_SGL_BUF)
			free_hw_sgl(h_qp, &msg->c_sgl, msg->mm_ops);
		if (ret != -WD_EBUSY)
			WD_ERR("failed to send to hardware, ret = %d!\n", ret);

		return ret;
	}

	return 0;
}
```

**修改后：**
```c
static int hisi_zip_comp_send(handle_t ctx, void *comp_msg)
{
	struct hisi_qp *qp = wd_ctx_get_priv(ctx);
	struct wd_comp_msg *msg = comp_msg;
	handle_t h_qp = (handle_t)qp;
	struct hisi_zip_sqe sqe = {0};
	__u16 count = 0;
	int ret;

	/* Check if software fallback is needed */
	if (msg->alg_type == WD_LZ4 && msg->req.op_type == WD_DIR_DECOMPRESS) {
		/* LZ4 hardware does not support decompression, use software */
		WD_INFO("lz4 decompress: use soft_lz4 fallback\n");
		ret = soft_lz4_decompress(msg);
		if (ret) {
			msg->req.status = WD_IN_EPARA;
			return ret;
		}
		msg->req.status = 0;
		return 0;
	}

	if (msg->alg_type == WD_LZ77_ZSTD) {
		/* LZ77-ZSTD use software implementation */
		WD_INFO("lz77_zstd: use soft_lz77_zstd\n");
		if (msg->req.op_type == WD_DIR_COMPRESS) {
			ret = soft_lz77_zstd_compress(msg);
		} else {
			ret = soft_lz77_zstd_decompress(msg);
		}
		if (ret) {
			msg->req.status = WD_IN_EPARA;
			return ret;
		}
		msg->req.status = 0;
		return 0;
	}

	/* Skip hardware, if the store buffer need to be copied to output */
	ret = check_store_buf(msg);
	if (ret)
		return 0;

	hisi_set_msg_id(h_qp, &msg->tag);
	ret = fill_zip_comp_sqe(qp, msg, &sqe);
	if (unlikely(ret < 0)) {
		if (ret != -WD_EBUSY)
			WD_ERR("failed to fill zip sqe, ret = %d!\n", ret);
		return ret;
	}
	ret = hisi_qm_send(h_qp, &sqe, 1, &count);
	if (unlikely(ret < 0)) {
		if (msg->req.data_fmt == WD_SGL_BUF)
			free_hw_sgl(h_qp, &msg->c_sgl, msg->mm_ops);
		if (ret != -WD_EBUSY)
			WD_ERR("failed to send to hardware, ret = %d!\n", ret);

		return ret;
	}

	return 0;
}
```

---

## 文件6：Makefile.am（修改）

### 修改点1：第32行

**原代码：**
```makefile
uadk_driversdir=$(libdir)/uadk
uadk_drivers_LTLIBRARIES=libhisi_sec.la libisa_ce.la libisa_sve.la
```

**修改后：**
```makefile
uadk_driversdir=$(libdir)/uadk
uadk_drivers_LTLIBRARIES=libhisi_sec.la libhisi_zip.la libisa_ce.la libisa_sve.la
```

---

### 修改点2：第59行后（endif之前）

**原代码：**
```makefile
libisa_sve_la_SOURCES=drv/hash_mb/hash_mb.c wd_digest_drv.h drv/hash_mb/hash_mb.h \
		drv/hash_mb/sm3_sve_common.S drv/hash_mb/sm3_mb_asimd_x1.S \
		drv/hash_mb/sm3_mb_asimd_x4.S drv/hash_mb/sm3_mb_sve.S \
		drv/hash_mb/md5_sve_common.S drv/hash_mb/md5_mb_asimd_x1.S \
		drv/hash_mb/md5_mb_asimd_x4.S drv/hash_mb/md5_mb_sve.S \
		drv/wd_drv.h drv/wd_drv.c
endif
```

**修改后：**
```makefile
libisa_sve_la_SOURCES=drv/hash_mb/hash_mb.c wd_digest_drv.h drv/hash_mb/hash_mb.h \
		drv/hash_mb/sm3_sve_common.S drv/hash_mb/sm3_mb_asimd_x1.S \
		drv/hash_mb/sm3_mb_asimd_x4.S drv/hash_mb/sm3_mb_sve.S \
		drv/hash_mb/md5_sve_common.S drv/hash_mb/md5_mb_asimd_x1.S \
		drv/hash_mb/md5_mb_asimd_x4.S drv/hash_mb/md5_mb_sve.S \
		drv/wd_drv.h drv/wd_drv.c

libhisi_zip_la_SOURCES=drv/hisi_comp.c drv/hisi_qm_udrv.c \
		drv/hisi_comp_huf.c drv/hisi_comp_huf.h \
		hisi_qm_udrv.h wd_comp_drv.h \
		drv/soft_lz4.c drv/soft_lz4.h \
		drv/soft_lz77_zstd.c drv/soft_lz77_zstd.h
endif
```

---

### 修改点3：第77行后（WD_STATIC_DRV分支）

**原代码：**
```makefile
libisa_sve_la_LIBADD = $(libwd_la_OBJECTS) $(libwd_crypto_la_OBJECTS)
libisa_sve_la_DEPENDENCIES = libwd.la libwd_crypto.la

else
```

**修改后：**
```makefile
libisa_sve_la_LIBADD = $(libwd_la_OBJECTS) $(libwd_crypto_la_OBJECTS)
libisa_sve_la_DEPENDENCIES = libwd.la libwd_crypto.la

libhisi_zip_la_LIBADD = $(libwd_la_OBJECTS) $(libwd_crypto_la_OBJECTS) -ldl
libhisi_zip_la_DEPENDENCIES = libwd.la libwd_crypto.la

else
```

---

### 修改点4：第101行后（else分支）

**原代码：**
```makefile
libisa_sve_la_LDFLAGS=$(UADK_VERSION)
libisa_sve_la_DEPENDENCIES= libwd.la libwd_crypto.la

endif	# WD_STATIC_DRV
```

**修改后：**
```makefile
libisa_sve_la_LDFLAGS=$(UADK_VERSION)
libisa_sve_la_DEPENDENCIES= libwd.la libwd_crypto.la

libhisi_zip_la_LIBADD= -lwd -lwd_crypto -ldl
libhisi_zip_la_LDFLAGS=$(UADK_VERSION)
libhisi_zip_la_DEPENDENCIES= libwd.la libwd_crypto.la

endif	# WD_STATIC_DRV
```

---

## 编译和测试

### 编译步骤
```bash
cd uadk_design
./cleanup.sh
./autogen.sh
./configure
make -j$(nproc)
sudo make install
sudo ldconfig
```

### 依赖库
```bash
sudo apt install liblz4-1
```

### 测试命令

**测试 LZ4 解压缩（软算）**
```bash
sudo uadk_tool benchmark --alg lz4 --mode sva --opt 1 --sync \
    --pktlen 4096 --seconds 5 --init2
```

**测试 LZ4 压缩（硬件）**
```bash
sudo uadk_tool benchmark --alg lz4 --mode sva --opt 0 --sync \
    --pktlen 4096 --seconds 5 --init2
```

**测试其他算法（硬件）**
```bash
sudo uadk_tool benchmark --alg zlib --mode sva --opt 0 --sync \
    --pktlen 4096 --seconds 5 --init2
```

---

## 修改总结

| 文件 | 操作 | 说明 |
|------|------|------|
| drv/soft_lz4.h | 新增 | LZ4软算头文件 |
| drv/soft_lz4.c | 新增 | LZ4软算实现 |
| drv/soft_lz77_zstd.h | 新增 | LZ77-ZSTD软算头文件 |
| drv/soft_lz77_zstd.c | 新增 | LZ77-ZSTD软算框架 |
| drv/hisi_comp.c | 修改 | 添加软算分支 |
| Makefile.am | 修改 | 添加编译配置 |
