import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from local_api_proxy import list_output_videos


class OutputVideosTest(unittest.TestCase):
    def test_scan_survives_recreation_and_finds_new_files_without_exposing_symlinks(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "output"
            video = output / "video"
            video.mkdir(parents=True)
            (video / "婚礼.mp4").write_bytes(b"old video")
            (video / "empty.mp4").touch()
            (video / "model.safetensors").write_bytes(b"model")
            outside = root / "private"
            outside.mkdir()
            (outside / "secret.mp4").write_bytes(b"private")
            (video / "linked.mp4").symlink_to(outside / "secret.mp4")
            (output / "linked-directory").symlink_to(outside, target_is_directory=True)
            first = list_output_videos(output)
            self.assertEqual([asset["name"] for asset in first], ["婚礼.mp4"])
            self.assertEqual(first[0]["user_metadata"]["subfolder"], "video")
            self.assertEqual(list_output_videos(Path(str(output))), first)
            second_folder = output / "other"
            second_folder.mkdir()
            (second_folder / "婚礼.mp4").write_bytes(b"new video")
            second = list_output_videos(output)
            self.assertEqual(len(second), 2)
            self.assertEqual(len({asset["id"] for asset in second}), 2)
            (video / "婚礼.mp4").unlink()
            self.assertEqual(len(list_output_videos(output)), 1)
