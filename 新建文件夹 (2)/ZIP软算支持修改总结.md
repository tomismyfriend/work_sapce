# ZIP 软算支持修改总结

## 概述
为 hisi_zip 驱动添加软算支持，当硬件不支持某些算法或操作时，自动切换到软算实现。

## 修改文件清单

### 新增文件（4个）

#### 1. drv/soft_lz4.h
- LZ4 软算头文件
- 声明 soft_lz4_init/exit/decompress 接口

#### 2. drv/soft_lz4.c
- LZ4 软算实现
- 使用 dlopen 动态加载 liblz4.so.1
- 通过 dlsym 获取 LZ4_decompress_safe 函数指针
- 实现 LZ4 解压缩功能（硬件不支持）

#### 3. drv/soft_lz77_zstd.h
- LZ77-ZSTD 软算头文件
- 声明 soft_lz77_zstd_init/exit/compress/decompress 接口

#### 4. drv/soft_lz77_zstd.c
- LZ77-ZSTD 软算框架（预留实现）
- 当前返回 -WD_ENOTSUP，待后续实现

### 修改文件（2个）

#### 5. drv/hisi_comp.c

**修改点1：添加头文件（第8行）**
```c
#include "soft_lz4.h"
#include "soft_lz77_zstd.h"
```

**修改点2：hisi_zip_init 函数（第1453-1459行）**
- 在函数末尾添加软算库初始化
- 调用 soft_lz4_init() 和 soft_lz77_zstd_init()
- 初始化失败只打印警告，不影响硬件驱动

**修改点3：hisi_zip_exit 函数（第1462-1473行）**
- 在函数开头添加软算库清理
- 调用 soft_lz4_exit() 和 soft_lz77_zstd_exit()

**修改点4：hisi_zip_comp_send 函数（第1527-1559行）**
- 在函数开头添加软算分支检查
- LZ4 解压缩：调用 soft_lz4_decompress()
- LZ77-ZSTD 压缩/解压缩：调用 soft_lz77_zstd_compress/decompress()
- 其他算法：继续使用硬件路径

#### 6. Makefile.am

**修改点1：第32行**
- 添加 libhisi_zip.la 到 uadk_drivers_LTLIBRARIES

**修改点2：第59行后**
- 添加 libhisi_zip_la_SOURCES 定义
- 包含 hisi_comp.c、hisi_qm_udrv.c、soft_lz4.c、soft_lz77_zstd.c

**修改点3：第77行后（WD_STATIC_DRV 分支）**
- 添加 libhisi_zip_la_LIBADD 和 DEPENDENCIES
- 链接 -ldl 用于 dlopen

**修改点4：第101行后（else 分支）**
- 添加 libhisi_zip_la_LIBADD、LDFLAGS 和 DEPENDENCIES
- 链接 -lwd -lwd_crypto -ldl

## 软算支持矩阵

| 算法 | 压缩 | 解压缩 | 说明 |
|------|------|--------|------|
| zlib | 硬件 | 硬件 | 完整支持 |
| gzip | 硬件 | 硬件 | 完整支持 |
| deflate | 硬件 | 硬件 | 完整支持 |
| lz77_only | 硬件 | 硬件 | 完整支持 |
| lz4 | 硬件 | **软算** | 硬件不支持解压缩 |
| lz77_zstd | **软算** | **软算** | 预留框架，待实现 |

## 工作原理

### 1. 初始化阶段
```
hisi_zip_init()
  ├─ 硬件初始化（分配 qp 等）
  ├─ soft_lz4_init()
  │   └─ dlopen("liblz4.so.1")
  │       └─ dlsym("LZ4_decompress_safe")
  └─ soft_lz77_zstd_init()
      └─ 打印框架初始化信息
```

### 2. 请求处理阶段
```
hisi_zip_comp_send(ctx, msg)
  ├─ 检查 alg_type 和 op_type
  │
  ├─ if (LZ4 && DECOMPRESS)
  │   └─ soft_lz4_decompress(msg)
  │       └─ g_decompress_fn(...)  // 调用 liblz4
  │
  ├─ if (LZ77_ZSTD)
  │   └─ soft_lz77_zstd_compress/decompress(msg)
  │       └─ 返回 -WD_ENOTSUP（待实现）
  │
  └─ else
      └─ 硬件路径（fill_zip_comp_sqe + hisi_qm_send）
```

### 3. 清理阶段
```
hisi_zip_exit()
  ├─ soft_lz4_exit()
  │   └─ dlclose(g_lz4_handle)
  ├─ soft_lz77_zstd_exit()
  └─ 硬件清理（释放 qp 等）
```

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
- liblz4.so.1（LZ4 软算）
- libzstd.so.1（LZ77-ZSTD 软算，待实现）

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

## 优势

1. **不修改框架**：不需要修改 wd_util.c 等框架代码
2. **不新增驱动**：不需要新增 libsoft_lz4.so
3. **自动切换**：send 函数自动检测并切换到软算
4. **对用户透明**：用户无需关心硬件是否支持
5. **易于维护**：所有代码在 hisi_zip 驱动内部
6. **编译保证**：代码已通过编译检查

## 后续工作

1. 实现 soft_lz77_zstd 的压缩和解压缩功能
2. 添加 SGL buffer 支持（当前只支持 flat buffer）
3. 性能测试和优化
4. 添加更多软算算法支持

## 注意事项

1. liblz4.so.1 必须在系统中可用
2. 软算性能不如硬件，仅作为 fallback
3. LZ77-ZSTD 当前返回错误，待实现
4. 异步模式下的软算需要额外处理（当前只支持同步）





软算测试调试打印代码
1. soft_lz4.c 的调试打印
int soft_lz4_decompress(struct wd_comp_msg *msg)
{
	int ret;

	WD_INFO("soft_lz4_decompress: enter\n");

	if (!g_decompress_fn) {
		WD_ERR("soft_lz4: not initialized!\n");
		return -WD_EINVAL;
	}

	if (msg->req.src_len == 0) {
		WD_ERR("soft_lz4: src_len is zero!\n");
		return -WD_EINVAL;
	}

	WD_INFO("soft_lz4_decompress: src=%p, dst=%p, src_len=%u, dst_len=%u\n",
		msg->req.src, msg->req.dst, msg->req.src_len, msg->req.dst_len);

	ret = g_decompress_fn(
		(const char *)msg->req.src,
		(char *)msg->req.dst,
		msg->req.src_len,
		msg->req.dst_len);

	WD_INFO("soft_lz4_decompress: LZ4_decompress_safe returned %d\n", ret);

	if (ret < 0) {
		WD_ERR("soft_lz4: decompress failed, ret=%d\n", ret);
		return -WD_EINVAL;
	}

	msg->produced = ret;
	msg->in_cons = msg->req.src_len;
	
	WD_INFO("soft_lz4_decompress: success, produced=%u, in_cons=%u\n",
		msg->produced, msg->in_cons);
	
	return 0;
}
2. hisi_comp.c 的调试打印
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
		WD_INFO("before soft_lz4_decompress: src=%p, dst=%p, src_len=%u, dst_len=%u\n",
			msg->req.src, msg->req.dst, msg->req.src_len, msg->req.dst_len);
		
		ret = soft_lz4_decompress(msg);
		
		WD_INFO("after soft_lz4_decompress: ret=%d, status=%u\n", ret, msg->req.status);
		
		if (ret) {
			msg->req.status = WD_IN_EPARA;
			return ret;
		}
		msg->req.status = 0;
		return 0;
	}

	// ... 后续硬件处理代码 ...
}


修改 drv/hisi_comp.c（在调用 soft_lz4_decompress 之前加打印）：
if (msg->alg_type == WD_LZ4 && msg->req.op_type == WD_DIR_DECOMPRESS) {
    printf("[HISI_COMP] lz4 decompress: use soft_lz4 fallback\n");
    printf("[HISI_COMP] src=%p, dst=%p, src_len=%u, dst_len=%u\n",
           msg->req.src, msg->req.dst, msg->req.src_len, msg->req.dst_len);
    fflush(stdout);
    
    ret = soft_lz4_decompress(msg);
    
    printf("[HISI_COMP] after soft_lz4_decompress: ret=%d\n", ret);
    fflush(stdout);
    // ...
}
修改 drv/soft_lz4.c（在调用 LZ4 之前加打印）：
int soft_lz4_decompress(struct wd_comp_msg *msg)
{
    printf("[SOFT_LZ4] enter\n");
    fflush(stdout);
    
    // ... 前面的检查 ...
    
    printf("[SOFT_LZ4] calling LZ4_decompress_safe(src_len=%u, dst_len=%u)...\n",
           msg->req.src_len, msg->req.dst_len);
    fflush(stdout);
    
    ret = g_decompress_fn(
        (const char *)msg->req.src,
        (char *)msg->req.dst,
        msg->req.src_len,
        msg->req.dst_len);
        
    printf("[SOFT_LZ4] returned %d\n", ret);
    fflush(stdout);
    // ...
}