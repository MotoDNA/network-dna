# 홈페이지 "서비스 둘러보기" 에 넣을 **앱 화면 한 컷씩**을 만듭니다.
#
# 세 웹서비스(Re:Bind·Re:Call·Re:Store)는 build-shots.sh 가 앱을 직접 띄워
# 찍습니다. 앱 일곱은 그럴 수가 없습니다 — 폰에서 도는 것이라 여기서 못 띄웁니다.
# 대신 각 프로젝트에 이미 있는 **스토어 제출용 원본 화면**을 가져다 씁니다.
#
# 원본은 1200~1400px 인데 홈페이지에서는 폰 그림 안에 170px 안팎으로 보입니다.
# 그대로 올리면 일곱 장에 3MB 가 넘습니다. 460px 로 줄이고 128색으로 낮춥니다.
#
#   python3 build-appshots.py        → web/app-*.png
import os, io
from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
집  = os.path.expanduser('~')
폭  = 460

# 스토어에 올린 **꾸민 그림**(글자·기기 테두리가 얹힌 것)이 아니라
# 실제 화면 그대로인 것을 골랐습니다. 우리가 폰 그림을 따로 씌우기 때문에
# 테두리가 두 겹이 되면 지저분해집니다.
앱 = [
    ('motodna', '~/motodna-app/docs/captures/phone/01_home.png'),
    ('growi',   '~/hanppeom/docs/store/screenshots/raw/01_home.png'),
    ('hanpan',  '~/mini_arcade/docs/store/screenshots/ios/01-home.png'),
    ('study',   '~/study-quest/release/screenshots/play/01-home.png'),
    ('pet',     '~/pet-id-photo/docs/captures/play/screenshot-1-id-photo.png'),
    ('solo',    '~/seoulmate/Marketing/AppStoreScreenshots/01-home.png'),
    # 동행 — 아직 스토어용 화면이 없습니다. 앱 마크로 대신합니다.
    ('donghaeng', '~/donghaeng/assets/logo/app_icon_master.png'),
]

전, 후 = 0, 0
for 이름, 원본 in 앱:
    p = os.path.expanduser(원본)
    if not os.path.exists(p):
        print('  건너뜁니다 (없음):', 이름, 원본)
        continue
    im = Image.open(p).convert('RGB')
    전 += os.path.getsize(p)
    im = im.resize((폭, round(im.height * 폭 / im.width)), Image.LANCZOS)
    나갈곳 = os.path.join(여기, 'web', 'app-%s.png' % 이름)
    im.quantize(colors=128, method=Image.FASTOCTREE).save(나갈곳, optimize=True)
    후 += os.path.getsize(나갈곳)
    print('  ✓ web/app-%s.png  %dx%d  (%dK)' % (이름, *im.size, os.path.getsize(나갈곳)/1024))

print('  줄였습니다: %dKB → %dKB' % (전/1024, 후/1024))
