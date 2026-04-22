使用方法：
1. 创建输入文件 hashes.txt，每行一个commit hash：
abc123def456
fed456cba321
...
2. 运行脚本：
python format_patches.py -i hashes.txt -o ./patches -s 1
参数说明：
- -i/--input: 输入文件路径（必需）
- -o/--output: 输出目录（默认 ./patches）
- -s/--start: patch起始编号（默认 1）