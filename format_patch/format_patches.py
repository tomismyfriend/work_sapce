#!/usr/bin/env python3
"""
根据输入的git commit hash列表，按顺序format patch文件
"""

import argparse
import os
import subprocess
import sys


def read_hash_file(file_path):
    """从文件读取commit hash列表"""
    if not os.path.exists(file_path):
        print(f"错误: 文件 '{file_path}' 不存在")
        sys.exit(1)
    
    with open(file_path, 'r', encoding='utf-8') as f:
        hashes = [line.strip() for line in f if line.strip()]
    
    return hashes


def format_patches(hashes, output_dir, start_number=1):
    """按顺序format patch文件"""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    for idx, commit_hash in enumerate(hashes):
        patch_number = start_number + idx
        
        cmd = [
            'git', 'format-patch',
            '--start-number', str(patch_number),
            '-1', commit_hash,
            '-o', output_dir
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            patch_file = result.stdout.strip()
            print(f"[{idx + 1}/{len(hashes)}] {commit_hash[:8]} -> {os.path.basename(patch_file)}")
        except subprocess.CalledProcessError as e:
            print(f"错误: 无法format commit {commit_hash}")
            print(f"  {e.stderr}")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='根据commit hash列表按顺序生成patch文件')
    parser.add_argument('-i', '--input', required=True, help='包含commit hash的输入文件路径')
    parser.add_argument('-o', '--output', default='./patches', help='输出目录 (默认: ./patches)')
    parser.add_argument('-s', '--start', type=int, default=1, help='patch起始编号 (默认: 1)')
    
    args = parser.parse_args()
    
    hashes = read_hash_file(args.input)
    
    if not hashes:
        print("错误: 输入文件为空")
        sys.exit(1)
    
    print(f"读取到 {len(hashes)} 个commit hash")
    print(f"输出目录: {args.output}")
    print(f"起始编号: {args.start}")
    print("-" * 40)
    
    format_patches(hashes, args.output, args.start)
    
    print("-" * 40)
    print(f"完成! 共生成 {len(hashes)} 个patch文件")


if __name__ == '__main__':
    main()