# 토스페이먼츠 심사 제출용 결제경로 PPT.
# 그림은 운영 중인 dnalabs.kr 을 그대로 찍은 것입니다 (shoot-pg.mjs).
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from PIL import Image

W, H = Inches(13.333), Inches(7.5)
남색 = RGBColor(0x0B, 0x1B, 0x33)
파랑 = RGBColor(0x31, 0x82, 0xF6)
흐림 = RGBColor(0x6B, 0x74, 0x84)
흰색 = RGBColor(0xFF, 0xFF, 0xFF)

기본 = os.environ['SHOTS']
장 = [
    ('1-메인',      '① 메인 화면',        'dnalabs.kr',
     '회사 홈페이지입니다. 위쪽 차림표의 「요금」으로 들어갑니다.'),
    ('1b-사업자정보','② 사업자 정보 (홈페이지 하단)', 'dnalabs.kr — 홈페이지 하단',
     '상호·대표자·사업자등록번호·통신판매업신고번호·사업장 주소·대표번호·이메일·개인정보 보호책임자와 '
     '이용약관·개인정보 처리방침·환불정책 링크를 홈페이지와 서비스 안내·요금·가입(결제) 화면 하단에 표시합니다.'),
    ('2-요금안내',  '③ 요금 안내',        'dnalabs.kr/reservice',
     '서비스와 인원 구간에 따른 월 요금을 공개합니다. 부가세 별도임을 함께 적습니다.'),
    ('3-요금제선택','④ 요금제 선택',      'dnalabs.kr/signup',
     '업종을 고른 뒤 요금제를 고릅니다. 고른 요금제의 월 금액과 첫 청구 시점을 그 자리에서 보여 줍니다.'),
    ('4-정보입력',  '⑤ 가입 정보 입력',   'dnalabs.kr/signup',
     '상호·담당자·이메일·연락처를 받습니다. 다음 화면에서 이용약관·개인정보·환불정책에 동의를 받습니다.'),
    ('4b-결제화면하단','⑥ 결제 직전 화면 (하단)', 'dnalabs.kr/signup',
     '약관 동의와 카드 등록 단추가 있는 결제 직전 화면입니다. 이 화면 하단에도 같은 사업자 정보를 표시합니다.'),
    ('5-토스결제창','⑦ 토스페이먼츠 결제창', 'js.tosspayments.com',
     '카드 정보는 토스페이먼츠 결제창에서만 입력받습니다. 당사는 카드번호를 받지도, 저장하지도 않습니다. 빌링키만 돌려받습니다.'),
    ('6-가입완료',  '⑧ 가입 완료',        'dnalabs.kr/signup',
     '회사코드·아이디·비밀번호를 발급합니다. 무료 기간 종료일과 해지 방법을 함께 안내합니다.'),
]

p = Presentation()
p.slide_width, p.slide_height = W, H
빈장 = p.slide_layouts[6]

def 글(칸, 내용, 크기, 색, 굵게=False, 정렬=PP_ALIGN.LEFT):
    tf = 칸.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    para = tf.paragraphs[0]; para.alignment = 정렬
    r = para.add_run(); r.text = 내용
    r.font.size = Pt(크기); r.font.color.rgb = 색; r.font.bold = 굵게
    r.font.name = 'Apple SD Gothic Neo'
    return para

# ── 표지 ──
s = p.slides.add_slide(빈장)
bg = s.background.fill; bg.solid(); bg.fore_color.rgb = 남색
글(s.shapes.add_textbox(Inches(1.1), Inches(2.5), Inches(11), Inches(1.0)),
   '결제 경로 안내', 40, 흰색, True)
글(s.shapes.add_textbox(Inches(1.1), Inches(3.5), Inches(11), Inches(0.6)),
   'Re:Service — 정기결제(자동결제) 가입 흐름', 20, RGBColor(0x9A, 0xC4, 0xFF))
글(s.shapes.add_textbox(Inches(1.1), Inches(4.5), Inches(11), Inches(1.6)),
   '상호  디엔에이랩스 (DNA Labs)\n'
   '서비스  dnalabs.kr\n'
   '결제수단  카드 자동결제(빌링) · 토스페이먼츠\n'
   '아래 화면은 운영 중인 사이트를 그대로 찍은 것입니다.',
   14, RGBColor(0xC7, 0xD6, 0xEA))

for 파일, 제목, 주소, 설명 in 장:
    s = p.slides.add_slide(빈장)
    글(s.shapes.add_textbox(Inches(0.6), Inches(0.35), Inches(9.5), Inches(0.5)),
       제목, 24, 남색, True)
    글(s.shapes.add_textbox(Inches(0.62), Inches(0.92), Inches(9.5), Inches(0.35)),
       주소, 12, 파랑)
    글(s.shapes.add_textbox(Inches(0.62), Inches(6.62), Inches(12.1), Inches(0.7)),
       설명, 13, 흐림)

    길 = os.path.join(기본, 파일 + '.png')
    iw, ih = Image.open(길).size
    칸w, 칸h = Inches(12.1), Inches(5.1)
    배 = min(칸w / iw, 칸h / ih)
    w, h = Emu(int(iw * 배)), Emu(int(ih * 배))
    s.shapes.add_picture(길, Emu(int((W - w) / 2)), Inches(1.35), w, h)


# ── 같은 내용을 PDF 로도 ──
# 토스 심사팀이 "내용 확인 가능한 결제경로 파일"을 다시 달라고 했습니다(2026-10).
# PPT 는 열리지 않거나 화면이 작게 줄어 글이 안 읽힐 수 있습니다. PDF 는 한 장에
# 화면 하나를 거의 원래 크기로 넣어, 어떤 기기에서 열어도 글자가 읽히게 합니다.
from PIL import ImageDraw, ImageFont
글꼴길 = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
def 글꼴(크기, 굵게=False):
    # ttc 안의 순서: 0 Regular … 굵은 것은 6(Bold). 없으면 0 을 씁니다.
    try: return ImageFont.truetype(글꼴길, 크기, index=6 if 굵게 else 0)
    except Exception: return ImageFont.truetype(글꼴길, 크기, index=0)

PW, PH, 여백 = 2400, 1800, 90
def 줄바꿈(그리기, 내용, 글, 폭):
    줄들, 지금 = [], ''
    for 낱말 in 내용.split(' '):
        시험 = (지금 + ' ' + 낱말).strip()
        if 그리기.textlength(시험, font=글) <= 폭: 지금 = 시험
        else: 줄들.append(지금); 지금 = 낱말
    if 지금: 줄들.append(지금)
    return 줄들

쪽들 = []
표지 = Image.new('RGB', (PW, PH), (0x0B, 0x1B, 0x33)); d = ImageDraw.Draw(표지)
d.text((180, 620), '결제 경로 안내', font=글꼴(110, True), fill=(255, 255, 255))
d.text((184, 780), 'Re:Service — 정기결제(자동결제) 가입 흐름', font=글꼴(52), fill=(0x9A, 0xC4, 0xFF))
for i, 줄 in enumerate(['상호  디엔에이랩스 (DNA Labs) · 사업자등록번호 119-37-01707',
                       '서비스  https://dnalabs.kr',
                       '결제수단  카드 자동결제(빌링) · 토스페이먼츠',
                       '아래 화면은 운영 중인 사이트를 그대로 찍은 것입니다.']):
    d.text((184, 960 + i * 72), 줄, font=글꼴(40), fill=(0xC7, 0xD6, 0xEA))
쪽들.append(표지)

for 파일, 제목, 주소, 설명 in 장:
    쪽 = Image.new('RGB', (PW, PH), (255, 255, 255)); d = ImageDraw.Draw(쪽)
    d.text((여백, 60), 제목, font=글꼴(64, True), fill=(0x0B, 0x1B, 0x33))
    d.text((여백 + 4, 150), 주소, font=글꼴(36), fill=(0x31, 0x82, 0xF6))
    설명줄 = 줄바꿈(d, 설명, 글꼴(38), PW - 여백 * 2)
    아래칸 = 60 + len(설명줄) * 54
    그림 = Image.open(os.path.join(기본, 파일 + '.png')).convert('RGB')
    칸w, 칸h = PW - 여백 * 2, PH - 230 - 아래칸 - 40
    배 = min(칸w / 그림.width, 칸h / 그림.height)
    그림 = 그림.resize((int(그림.width * 배), int(그림.height * 배)), Image.LANCZOS)
    x, y = (PW - 그림.width) // 2, 230
    쪽.paste(그림, (x, y))
    d.rectangle([x - 1, y - 1, x + 그림.width, y + 그림.height], outline=(0xE3, 0xE7, 0xEB), width=2)
    for i, 줄 in enumerate(설명줄):
        d.text((여백, PH - 아래칸 + i * 54), 줄, font=글꼴(38), fill=(0x4E, 0x59, 0x68))
    쪽들.append(쪽)

pdf = os.environ.get('PDF_OUT')
if pdf:
    쪽들[0].save(pdf, save_all=True, append_images=쪽들[1:], resolution=200)
    print('PDF →', pdf, os.path.getsize(pdf) // 1024, 'KB ·', len(쪽들), '쪽')

out = os.environ['OUT']
p.save(out)
print('만들었습니다 →', out, os.path.getsize(out) // 1024, 'KB ·', len(p.slides.__iter__.__self__._sldIdLst), '장')
