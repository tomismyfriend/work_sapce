LZ4软算独立驱动库方案 - 修改文件清单
一、新增文件（2个）
文件1：drv/soft_lz4.h
/* SPDX-License-Identifier: Apache-2.0 */
#ifndef __SOFT_LZ4_H
#define __SOFT_LZ4_H

#include "wd_drv.h"
#include "wd_comp_drv.h"

#ifdef __cplusplus
extern "C" {
#endif

#define SOFT_LZ4_ACCELERATION  1

typedef int (*lz4_compress_fast_ext_fn)(void*, const char*, char*, int, int, int);
typedef int (*lz4_decompress_safe_fn)(const char*, char*, int, int);
typedef int (*lz4_compress_bound_fn)(int);
typedef int (*lz4_sizeof_state_fn)(void);

struct soft_lz4_ctx {
    struct wd_soft_ctx base;
    void *workspace;
    lz4_compress_fast_ext_fn compress_fn;
    lz4_decompress_safe_fn decompress_fn;
    lz4_compress_bound_fn compress_bound_fn;
    lz4_sizeof_state_fn sizeof_state_fn;
};

#ifdef __cplusplus
}
#endif

#endif
文件2：drv/soft_lz4.c
/* SPDX-License-Identifier: Apache-2.0 */
#include <string.h>
#include <dlfcn.h>
#include "soft_lz4.h"

static void *g_lz4_handle = NULL;

static int soft_lz4_load_library(void)
{
    if (g_lz4_handle)
        return 0;
    
    g_lz4_handle = dlopen("liblz4.so.1", RTLD_NOW | RTLD_GLOBAL);
    if (!g_lz4_handle) {
        WD_ERR("soft_lz4: failed to load liblz4.so.1: %s\n", dlerror());
        return -WD_ENODEV;
    }
    
    WD_INFO("soft_lz4: loaded liblz4.so.1 successfully\n");
    return 0;
}

static void soft_lz4_unload_library(void)
{
    if (g_lz4_handle) {
        dlclose(g_lz4_handle);
        g_lz4_handle = NULL;
    }
}

static int soft_lz4_alloc_ctx(char *alg_name, void *params, handle_t *ctx)
{
    struct soft_lz4_ctx *lz4_ctx;
    
    if (!params || !ctx) {
        WD_ERR("soft_lz4: invalid parameters!\n");
        return -WD_EINVAL;
    }
    
    if (!g_lz4_handle) {
        WD_ERR("soft_lz4: library not loaded!\n");
        return -WD_ENODEV;
    }
    
    lz4_ctx = calloc(1, sizeof(struct soft_lz4_ctx));
    if (!lz4_ctx) {
        WD_ERR("soft_lz4: failed to alloc ctx!\n");
        return -WD_ENOMEM;
    }
    
    lz4_ctx->base.fd = -1;
    pthread_spin_init(&lz4_ctx->base.slock, PTHREAD_PROCESS_SHARED);
    pthread_spin_init(&lz4_ctx->base.rlock, PTHREAD_PROCESS_SHARED);
    
    lz4_ctx->sizeof_state_fn = dlsym(g_lz4_handle, "LZ4_sizeofState");
    lz4_ctx->compress_fn = dlsym(g_lz4_handle, "LZ4_compress_fast_extState");
    lz4_ctx->decompress_fn = dlsym(g_lz4_handle, "LZ4_decompress_safe");
    lz4_ctx->compress_bound_fn = dlsym(g_lz4_handle, "LZ4_compressBound");
    
    if (!lz4_ctx->compress_fn || !lz4_ctx->decompress_fn ||
        !lz4_ctx->sizeof_state_fn || !lz4_ctx->compress_bound_fn) {
        WD_ERR("soft_lz4: failed to get LZ4 symbols!\n");
        free(lz4_ctx);
        return -WD_ENODEV;
    }
    
    *ctx = (handle_t)lz4_ctx;
    
    WD_INFO("soft_lz4: ctx allocated, alg=%s\n", alg_name);
    return 0;
}

static void soft_lz4_free_ctx(handle_t ctx)
{
    struct soft_lz4_ctx *lz4_ctx = (struct soft_lz4_ctx *)ctx;
    
    if (!lz4_ctx)
        return;
    
    if (lz4_ctx->workspace) {
        free(lz4_ctx->workspace);
        lz4_ctx->workspace = NULL;
    }
    
    pthread_spin_destroy(&lz4_ctx->base.slock);
    pthread_spin_destroy(&lz4_ctx->base.rlock);
    free(lz4_ctx);
    
    WD_INFO("soft_lz4: ctx released\n");
}

static int soft_lz4_init(void *conf, void *priv)
{
    struct soft_lz4_ctx *ctx = (struct soft_lz4_ctx *)priv;
    
    if (!ctx || !ctx->sizeof_state_fn) {
        WD_ERR("soft_lz4: ctx not initialized!\n");
        return -WD_EINVAL;
    }
    
    ctx->workspace = malloc(ctx->sizeof_state_fn());
    if (!ctx->workspace) {
        WD_ERR("soft_lz4: failed to alloc workspace!\n");
        return -WD_ENOMEM;
    }
    
    WD_INFO("soft_lz4: init ok, workspace=%p\n", ctx->workspace);
    return 0;
}

static void soft_lz4_exit(void *priv)
{
    struct soft_lz4_ctx *ctx = (struct soft_lz4_ctx *)priv;
    
    if (ctx && ctx->workspace) {
        free(ctx->workspace);
        ctx->workspace = NULL;
    }
    
    WD_INFO("soft_lz4: exit ok\n");
}

static int soft_lz4_compress(struct soft_lz4_ctx *ctx, struct wd_comp_msg *msg)
{
    int ret;
    int bound;
    
    if (msg->req.src_len == 0) {
        WD_ERR("soft_lz4: src_len is zero!\n");
        return -WD_EINVAL;
    }
    
    bound = ctx->compress_bound_fn(msg->req.src_len);
    if ((int)msg->req.dst_len < bound) {
        WD_ERR("soft_lz4: dst_len too small! need %d, got %u\n",
               bound, msg->req.dst_len);
        return -WD_EINVAL;
    }
    
    ret = ctx->compress_fn(
        ctx->workspace,
        (const char *)msg->req.src,
        (char *)msg->req.dst,
        msg->req.src_len,
        msg->req.dst_len,
        SOFT_LZ4_ACCELERATION);
    
    if (ret <= 0) {
        WD_ERR("soft_lz4: compress failed, ret=%d\n", ret);
        return -WD_EINVAL;
    }
    
    msg->produced = ret;
    msg->in_cons = msg->req.src_len;
    return 0;
}

static int soft_lz4_decompress(struct soft_lz4_ctx *ctx, struct wd_comp_msg *msg)
{
    int ret;
    
    if (msg->req.src_len == 0) {
        WD_ERR("soft_lz4: src_len is zero!\n");
        return -WD_EINVAL;
    }
    
    ret = ctx->decompress_fn(
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

static int soft_lz4_send(handle_t ctx, void *comp_msg)
{
    struct soft_lz4_ctx *lz4_ctx = (struct soft_lz4_ctx *)ctx;
    struct wd_comp_msg *msg = (struct wd_comp_msg *)comp_msg;
    int ret;
    
    if (!ctx || !msg) {
        WD_ERR("soft_lz4: invalid parameters!\n");
        return -WD_EINVAL;
    }
    
    if (!lz4_ctx->workspace) {
        WD_ERR("soft_lz4: ctx not initialized!\n");
        return -WD_EINVAL;
    }
    
    if (msg->data_fmt == WD_SGL_BUF) {
        WD_ERR("soft_lz4: SGL buffer not supported!\n");
        return -WD_EINVAL;
    }
    
    pthread_spin_lock(&lz4_ctx->base.slock);
    
    if (msg->req.op_type == WD_DIR_COMPRESS)
        ret = soft_lz4_compress(lz4_ctx, msg);
    else
        ret = soft_lz4_decompress(lz4_ctx, msg);
    
    msg->req.status = ret ? WD_IN_EPARA : 0;
    
    pthread_spin_unlock(&lz4_ctx->base.slock);
    return ret;
}

static int soft_lz4_recv(handle_t ctx, void *comp_msg)
{
    return 0;
}

static int soft_lz4_get_usage(void *param)
{
    return 0;
}

static struct wd_alg_driver soft_lz4_driver = {
    .drv_name = "soft_lz4",
    .alg_name = "lz4",
    .calc_type = UADK_ALG_SOFT,
    .priority = 50,
    .priv_size = sizeof(struct soft_lz4_ctx),
    .queue_num = 1,
    .op_type_num = 2,
    .fallback = 0,
    .init_state = 0,
    .init = soft_lz4_init,
    .exit = soft_lz4_exit,
    .send = soft_lz4_send,
    .recv = soft_lz4_recv,
    .get_usage = soft_lz4_get_usage,
    .alloc_ctx = soft_lz4_alloc_ctx,
    .free_ctx = soft_lz4_free_ctx,
};

#ifdef WD_STATIC_DRV
void soft_lz4_probe(void)
#else
static void __attribute__((constructor)) soft_lz4_probe(void)
#endif
{
    int ret;
    
    WD_INFO("Info: register SOFT LZ4 driver!\n");
    
    ret = soft_lz4_load_library();
    if (ret) {
        WD_ERR("soft_lz4: failed to load liblz4, skip registration\n");
        return;
    }
    
    ret = wd_alg_driver_register(&soft_lz4_driver);
    if (ret && ret != -WD_ENODEV)
        WD_ERR("Error: register SOFT LZ4 failed! ret=%d\n", ret);
}

#ifdef WD_STATIC_DRV
void soft_lz4_remove(void)
#else
static void __attribute__((destructor)) soft_lz4_remove(void)
#endif
{
    WD_INFO("Info: unregister SOFT LZ4 driver!\n");
    wd_alg_driver_unregister(&soft_lz4_driver);
    soft_lz4_unload_library();
}
二、修改文件（1个）
文件3：Makefile.am
修改位置：在 uadk_drivers_LTLIBRARIES 定义后添加
# 添加 libsoft_lz4.la 到驱动库列表
uadk_drivers_LTLIBRARIES += libsoft_lz4.la

libsoft_lz4_la_SOURCES = drv/soft_lz4.c drv/soft_lz4.h
libsoft_lz4_la_CFLAGS = $(AM_CFLAGS) -I$(top_srcdir)/include
libsoft_lz4_la_LIBADD = -lwd -lwd_comp -ldl
libsoft_lz4_la_LDFLAGS = $(UADK_VERSION)
libsoft_lz4_la_DEPENDENCIES = libwd.la libwd_comp.la
三、修改文件清单
操作	文件路径
新增	drv/soft_lz4.h
新增	drv/soft_lz4.c
修改	Makefile.am
四、编译和验证
# 1. 安装liblz4运行时库
sudo apt install liblz4-1

# 2. 编译
cd uadk_design
./cleanup.sh
./autogen.sh
./configure
make -j$(nproc)
sudo make install
sudo ldconfig

# 3. 验证驱动库
ls /usr/lib64/uadk/ | grep -E "hisi_zip|soft_lz4"
# 预期输出:
# libhisi_zip.so
# libsoft_lz4.so

# 4. 测试LZ4压缩（硬件）
sudo uadk_tool benchmark --alg lz4 --mode sva --opt 0 --sync \
    --pktlen 4096 --seconds 5 --init2

# 5. 测试LZ4解压（软算）
sudo uadk_tool benchmark --alg lz4 --mode sva --opt 1 --sync \
    --pktlen 4096 --seconds 5 --init2
五、方案优势
✅ 零代码耦合：不需要修改任何现有代码（hisi_comp.c等）  
✅ 自动发现：UADK框架自动发现并加载libsoft_lz4.so  
✅ 架构一致：与hisi_zip、hisi_sec完全一致的驱动架构  
✅ 易于扩展：添加其他软算只需新增.so文件  
✅ 故障隔离：软算失败不影响硬件驱动



Makefile.am 修改位置详解
一、完整修改位置
需要修改 4个位置：
位置1：第32行 - 添加驱动库声明
修改前：
uadk_drivers_LTLIBRARIES=libhisi_sec.la libisa_ce.la libisa_sve.la
修改后：
uadk_drivers_LTLIBRARIES=libhisi_sec.la libisa_ce.la libisa_sve.la libsoft_lz4.la
位置2：第58行之后 - 添加源文件定义
在第58行（libisa_sve_la_SOURCES 定义结束）之后，第59行（endif）之前添加：
libsoft_lz4_la_SOURCES=drv/soft_lz4.c drv/soft_lz4.h \
		drv/wd_drv.h drv/wd_drv.c
位置3：第77行之后 - 添加静态库配置
在第77行（libisa_sve_la_DEPENDENCIES）之后，第79行（else）之前添加：
libsoft_lz4_la_LIBADD = $(libwd_la_OBJECTS) $(libwd_crypto_la_OBJECTS)
libsoft_lz4_la_DEPENDENCIES = libwd.la libwd_crypto.la
位置4：第101行之后 - 添加动态库配置
在第101行（libisa_sve_la_DEPENDENCIES）之后，第103行（endif）之前添加：
libsoft_lz4_la_LIBADD= -lwd -lwd_crypto -ldl
libsoft_lz4_la_LDFLAGS=$(UADK_VERSION)
libsoft_lz4_la_DEPENDENCIES= libwd.la libwd_crypto.la
二、完整修改后的 Makefile.am 片段
# 第32行
uadk_drivers_LTLIBRARIES=libhisi_sec.la libisa_ce.la libisa_sve.la libsoft_lz4.la

libwd_la_SOURCES=wd.c wd_mempool.c wd_bmm.c wd_bmm.h wd.h wd_alg.c wd_alg.h	\
		lib/crypto/aes.c lib/crypto/sm4.c lib/crypto/galois.c

libwd_crypto_la_SOURCES=wd_cipher.c wd_cipher.h wd_cipher_drv.h \
			wd_aead.c wd_aead.h wd_aead_drv.h \
			wd.c wd.h wd_alg.h \
			wd_util.c wd_util.h \
			wd_sched.c wd_sched.h

libhisi_sec_la_SOURCES=drv/hisi_sec.c drv/hisi_qm_udrv.c \
		lib/crypto/aes.c lib/crypto/sm4.c lib/crypto/galois.c \
		hisi_qm_udrv.h wd_cipher_drv.h wd_aead_drv.h aes.h sm4.h galois.h \
		drv/wd_drv.h drv/wd_drv.c

if ARCH_ARM64
libisa_ce_la_SOURCES=arm_arch_ce.h drv/isa_ce_sm3.c drv/isa_ce_sm3_armv8.S isa_ce_sm3.h \
		drv/isa_ce_sm4.c drv/isa_ce_sm4_armv8.S drv/isa_ce_sm4.h wd_util.c wd_util.h \
		drv/wd_drv.h drv/wd_drv.c

libisa_sve_la_SOURCES=drv/hash_mb/hash_mb.c wd_digest_drv.h drv/hash_mb/hash_mb.h \
		drv/hash_mb/sm3_sve_common.S drv/hash_mb/sm3_mb_asimd_x1.S \
		drv/hash_mb/sm3_mb_asimd_x4.S drv/hash_mb/sm3_mb_sve.S \
		drv/hash_mb/md5_sve_common.S drv/hash_mb/md5_mb_asimd_x1.S \
		drv/hash_mb/md5_mb_asimd_x4.S drv/hash_mb/md5_mb_sve.S \
		drv/wd_drv.h drv/wd_drv.c

# 位置2：在这里添加（第58行之后）
libsoft_lz4_la_SOURCES=drv/soft_lz4.c drv/soft_lz4.h \
		drv/wd_drv.h drv/wd_drv.c
endif

if WD_STATIC_DRV
AM_CFLAGS += -DWD_STATIC_DRV -fPIC
AM_CFLAGS += -DWD_NO_LOG

libwd_la_LIBADD = $(libwd_la_OBJECTS) -ldl -lnuma

libwd_crypto_la_LIBADD = -lwd -ldl -lnuma -lm -lpthread
libwd_crypto_la_DEPENDENCIES = libwd.la

libhisi_sec_la_LIBADD = $(libwd_la_OBJECTS) $(libwd_crypto_la_OBJECTS)
libhisi_sec_la_DEPENDENCIES = libwd.la libwd_crypto.la

libisa_ce_la_LIBADD = $(libwd_la_OBJECTS) $(libwd_crypto_la_OBJECTS)
libisa_ce_la_DEPENDENCIES = libwd.la libwd_crypto.la

libisa_sve_la_LIBADD = $(libwd_la_OBJECTS) $(libwd_crypto_la_OBJECTS)
libisa_sve_la_DEPENDENCIES = libwd.la libwd_crypto.la

# 位置3：在这里添加（第77行之后）
libsoft_lz4_la_LIBADD = $(libwd_la_OBJECTS) $(libwd_crypto_la_OBJECTS)
libsoft_lz4_la_DEPENDENCIES = libwd.la libwd_crypto.la

else
UADK_WD_SYMBOL= -Wl,--version-script,$(top_srcdir)/libwd.map
UADK_CRYPTO_SYMBOL= -Wl,--version-script,$(top_srcdir)/libwd_crypto.map
UADK_V1_SYMBOL= -Wl,--version-script,$(top_srcdir)/v1/libwd.map

libwd_la_LDFLAGS=$(UADK_VERSION) $(UADK_WD_SYMBOL) $(UADK_V1_SYMBOL)
libwd_la_LIBADD= -ldl -lnuma

libwd_crypto_la_LIBADD= -lwd -ldl -lnuma
libwd_crypto_la_LDFLAGS=$(UADK_VERSION) $(UADK_CRYPTO_SYMBOL) -lpthread
libwd_crypto_la_DEPENDENCIES= libwd.la

libhisi_sec_la_LIBADD= -lwd -lwd_crypto
libhisi_sec_la_LDFLAGS=$(UADK_VERSION)
libhisi_sec_la_DEPENDENCIES= libwd.la libwd_crypto.la

libisa_ce_la_LIBADD= -lwd -lwd_crypto
libisa_ce_la_LDFLAGS=$(UADK_VERSION)
libisa_ce_la_DEPENDENCIES= libwd.la libwd_crypto.la

libisa_sve_la_LIBADD= -lwd -lwd_crypto
libisa_sve_la_LDFLAGS=$(UADK_VERSION)
libisa_sve_la_DEPENDENCIES= libwd.la libwd_crypto.la

# 位置4：在这里添加（第101行之后）
libsoft_lz4_la_LIBADD= -lwd -lwd_crypto -ldl
libsoft_lz4_la_LDFLAGS=$(UADK_VERSION)
libsoft_lz4_la_DEPENDENCIES= libwd.la libwd_crypto.la

endif	# WD_STATIC_DRV
三、修改总结
位置	行号	添加内容
位置1	第32行	libsoft_lz4.la 到 uadk_drivers_LTLIBRARIES
位置2	第58行后	libsoft_lz4_la_SOURCES 定义
位置3	第77行后	静态库的 LIBADD 和 DEPENDENCIES
位置4	第101行后	动态库的 LIBADD、LDFLAGS 和 DEPENDENCIES
四、注意事项
1. 位置2必须在 if ARCH_ARM64 和 endif 之间，因为 soft_lz4 不依赖 ARM64 架构，也可以放在 endif 之后
2. 位置3和位置4分别在 if WD_STATIC_DRV 的两个分支中，确保静态和动态编译都能工作
3. 动态库需要 -ldl，因为 soft_lz4 使用 dlopen 加载 liblz4.so.1