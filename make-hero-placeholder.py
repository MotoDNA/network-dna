# 첫 화면 배경에 깔 **임시** 영상을 만듭니다.
#
# ⚠ 이건 자리를 보여 주려고 만든 것입니다. 진짜는 Deevid 으로 만들어
#   web/hero.mp4 를 덮어쓰면 됩니다. 프롬프트와 규격은 RECALL.md 7.5장에.
#
# 왜 임시본을 굳이 만드나:
#   "배경이 움직이면 어떤가" 는 정지 화면으로 판단할 수가 없습니다.
#   글씨가 읽히는지, 어지럽지 않은지는 움직이는 걸 봐야 압니다.
#
# 잉크가 종이에 천천히 번지는 느낌으로 만듭니다 — 제본소 앱을 만드는
# 회사라 종이·잉크가 뜬금없지 않고, 무엇보다 **배경은 눈에 안 띄어야** 합니다.
#
#   python3 make-hero-placeholder.py
import math, os, subprocess, tempfile
from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
나갈곳 = os.path.join(여기, 'web', 'hero.mp4')
포스터 = os.path.join(여기, 'web', 'hero-poster.jpg')

W, H = 960, 540          # 배경이라 크게 만들 이유가 없습니다. 흐리게 깔립니다.
초, FPS = 8, 24
칸 = 초 * FPS

# 홈페이지 색을 씁니다 — 배경만 딴 세상이면 안 됩니다
종이 = (247, 249, 251)
잉크 = (49, 130, 246)     # --blue


def 결(x, y, t):
    """느리게 도는 소용돌이 두 겹. 무늬가 완전히 반복되지는 않지만
       느려서 눈에 안 띕니다. 진짜 영상이 오면 사라질 코드입니다."""
    a = math.sin(x * 2.1 + t * 1.7) * math.cos(y * 1.7 - t * 1.1)
    b = math.sin((x + a * .35) * 3.3 - t * .9) * math.cos((y - a * .3) * 2.9 + t * 1.3)
    return (a * .6 + b * .4 + 1) / 2      # 0~1


with tempfile.TemporaryDirectory() as 임시:
    for i in range(칸):
        # 한 바퀴 돌아 처음으로 돌아오게 — 이어 붙였을 때 안 튀도록
        t = 2 * math.pi * i / 칸
        작게 = Image.new('RGB', (W // 8, H // 8))
        px = 작게.load()
        w, h = 작게.size
        for y in range(h):
            for x in range(w):
                v = 결(x / w * 2.2, y / h * 1.4, t)
                v = v ** 2.2 * .34                      # 옅게 — 배경이니까
                px[x, y] = tuple(round(종이[c] + (잉크[c] - 종이[c]) * v) for c in range(3))
        # 작게 그려서 크게 늘립니다. 부드럽게 번진 것처럼 보입니다.
        작게.resize((W, H), Image.BICUBIC).save(os.path.join(임시, '%04d.png' % i))
        if i == 0:
            작게.resize((W, H), Image.BICUBIC).save(포스터, quality=82)

    subprocess.run([
        'ffmpeg', '-y', '-loglevel', 'error',
        '-framerate', str(FPS), '-i', os.path.join(임시, '%04d.png'),
        # yuv420p 라야 사파리·아이폰에서 재생됩니다
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30',
        # 소리 트랙이 있으면 아이폰이 자동재생을 막습니다. 아예 안 넣습니다.
        '-an',
        # 첫 조각만 받아도 재생이 시작되게 머리말을 앞으로
        '-movflags', '+faststart',
        나갈곳,
    ], check=True)

print('  ✓ web/hero.mp4        %5.0f KB' % (os.path.getsize(나갈곳) / 1024))
print('  ✓ web/hero-poster.jpg %5.0f KB' % (os.path.getsize(포스터) / 1024))
print('  ⚠ 임시본입니다. Deevid 으로 만든 것으로 덮어쓰세요.')
