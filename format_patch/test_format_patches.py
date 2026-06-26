#!/usr/bin/env python3
"""Unit tests for format_patches.py"""

import os
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch, MagicMock, call

# Add parent directory to path so we can import the module
sys.path.insert(0, os.path.dirname(__file__))
import format_patches


class TestReadHashFile(unittest.TestCase):
    """Tests for read_hash_file()"""

    def test_reads_hashes_from_file(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("abc123\ndef456\nghi789\n")
            f.flush()
            try:
                result = format_patches.read_hash_file(f.name)
                self.assertEqual(result, ["abc123", "def456", "ghi789"])
            finally:
                os.unlink(f.name)

    def test_skips_blank_lines(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("abc123\n\ndef456\n\n")
            f.flush()
            try:
                result = format_patches.read_hash_file(f.name)
                self.assertEqual(result, ["abc123", "def456"])
            finally:
                os.unlink(f.name)

    def test_strips_whitespace(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("  abc123  \n  def456\n")
            f.flush()
            try:
                result = format_patches.read_hash_file(f.name)
                self.assertEqual(result, ["abc123", "def456"])
            finally:
                os.unlink(f.name)

    def test_empty_file_returns_empty_list(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("")
            f.flush()
            try:
                result = format_patches.read_hash_file(f.name)
                self.assertEqual(result, [])
            finally:
                os.unlink(f.name)

    def test_nonexistent_file_exits(self):
        with self.assertRaises(SystemExit) as ctx:
            format_patches.read_hash_file("/nonexistent/path/file.txt")
        self.assertEqual(ctx.exception.code, 1)

    def test_single_hash(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("abc123\n")
            f.flush()
            try:
                result = format_patches.read_hash_file(f.name)
                self.assertEqual(result, ["abc123"])
            finally:
                os.unlink(f.name)


class TestFormatPatches(unittest.TestCase):
    """Tests for format_patches()"""

    def test_creates_output_dir_if_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = os.path.join(tmpdir, "new_subdir")
            self.assertFalse(os.path.exists(output_dir))

            with patch('format_patches.subprocess.run') as mock_run:
                mock_run.return_value = MagicMock(
                    stdout="new_subdir/0001-test.patch\n"
                )
                format_patches.format_patches(["abc123"], output_dir)

            self.assertTrue(os.path.exists(output_dir))

    def test_calls_git_format_patch_with_correct_args(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch('format_patches.subprocess.run') as mock_run:
                mock_run.return_value = MagicMock(
                    stdout=f"{tmpdir}/0001-test.patch\n"
                )
                format_patches.format_patches(["abc123"], tmpdir, start_number=1)

                mock_run.assert_called_once_with(
                    ['git', 'format-patch', '--start-number', '1',
                     '-1', 'abc123', '-o', tmpdir],
                    capture_output=True, text=True, check=True
                )

    def test_multiple_hashes_increment_patch_number(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch('format_patches.subprocess.run') as mock_run:
                mock_run.return_value = MagicMock(
                    stdout=f"{tmpdir}/0001-test.patch\n"
                )
                hashes = ["aaa", "bbb", "ccc"]
                format_patches.format_patches(hashes, tmpdir, start_number=5)

                calls = mock_run.call_args_list
                self.assertEqual(len(calls), 3)
                # Check --start-number increments for each hash
                self.assertEqual(calls[0][0][0][3], '5')
                self.assertEqual(calls[1][0][0][3], '6')
                self.assertEqual(calls[2][0][0][3], '7')

    def test_custom_start_number(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch('format_patches.subprocess.run') as mock_run:
                mock_run.return_value = MagicMock(
                    stdout=f"{tmpdir}/0010-test.patch\n"
                )
                format_patches.format_patches(["abc123"], tmpdir, start_number=10)

                args = mock_run.call_args[0][0]
                self.assertEqual(args[3], '10')

    def test_git_error_exits(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch('format_patches.subprocess.run') as mock_run:
                mock_run.side_effect = subprocess.CalledProcessError(
                    1, 'git', stderr="fatal: bad object"
                )
                with self.assertRaises(SystemExit) as ctx:
                    format_patches.format_patches(["badcommit"], tmpdir)
                self.assertEqual(ctx.exception.code, 1)

    def test_uses_existing_output_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch('format_patches.subprocess.run') as mock_run:
                mock_run.return_value = MagicMock(
                    stdout=f"{tmpdir}/0001-test.patch\n"
                )
                format_patches.format_patches(["abc123"], tmpdir)
                mock_run.assert_called_once()


class TestMain(unittest.TestCase):
    """Tests for main() argument parsing and orchestration"""

    @patch('format_patches.format_patches')
    @patch('format_patches.read_hash_file')
    def test_main_with_required_args(self, mock_read, mock_fmt):
        mock_read.return_value = ["abc123"]
        with patch('sys.argv', ['format_patches.py', '-i', 'hashes.txt']):
            format_patches.main()
        mock_read.assert_called_once_with('hashes.txt')
        mock_fmt.assert_called_once_with(["abc123"], './patches', 1)

    @patch('format_patches.format_patches')
    @patch('format_patches.read_hash_file')
    def test_main_with_all_args(self, mock_read, mock_fmt):
        mock_read.return_value = ["abc123", "def456"]
        with patch('sys.argv', ['format_patches.py', '-i', 'in.txt',
                                '-o', '/tmp/out', '-s', '5']):
            format_patches.main()
        mock_read.assert_called_once_with('in.txt')
        mock_fmt.assert_called_once_with(["abc123", "def456"], '/tmp/out', 5)

    @patch('format_patches.read_hash_file')
    def test_main_exits_on_empty_hashes(self, mock_read):
        mock_read.return_value = []
        with patch('sys.argv', ['format_patches.py', '-i', 'empty.txt']):
            with self.assertRaises(SystemExit) as ctx:
                format_patches.main()
            self.assertEqual(ctx.exception.code, 1)

    def test_main_exits_without_input_arg(self):
        with patch('sys.argv', ['format_patches.py']):
            with self.assertRaises(SystemExit) as ctx:
                format_patches.main()
            self.assertNotEqual(ctx.exception.code, 0)


if __name__ == '__main__':
    unittest.main()
