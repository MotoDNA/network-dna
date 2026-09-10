# 통신판매업 신고번호를 홈페이지 꼬리말에 넣습니다.
#
#   python3 set-mailorder.py "2026-경기파주-1234"
#
# 왜 손으로 안 고치고 스크립트를 두나:
#   꼬리말의 법정 표시는 **네 쪽에 똑같이** 들어 있습니다(index · services ·
#   reservice-guide · recall). 한 군데라도 빠뜨리면 그 쪽만 표시의무 위반입니다.
#   쪽이 늘 때마다 사람이 세어야 하는 일을 안 만들려고 여기서 찾아 넣습니다.
#
# 전자상거래법 제10조 — 통신판매업자는 상호 · 대표자 · 주소 · 전화번호 ·
# 사업자등록번호와 함께 **신고번호**를 사이버몰 초기화면에 표시해야 합니다.
#
# 이미 들어 있으면 값만 바꿉니다. 여러 번 돌려도 안전합니다.
import sys, os, re, io, glob

if len(sys.argv) < 2:
    print('쓰는 법: python3 set-mailorder.py "2026-경기파주-1234"')
    raise SystemExit(1)

번호 = sys.argv[1].strip()
if not 번호:
    print('신고번호가 비어 있습니다'); raise SystemExit(1)

여기 = os.path.dirname(os.path.abspath(__file__))
WEB  = os.path.join(여기, 'web')

# 사업자등록번호 줄 바로 뒤에 붙입니다 — 서류를 보는 사람이 둘을 나란히 찾습니다
닻 = '사업자등록번호 119-37-01707<br>'
새줄 = '사업자등록번호 119-37-01707 ·\n        통신판매업신고 {}<br>'

이미 = re.compile(r'사업자등록번호 119-37-01707 ·\s*\n?\s*통신판매업신고 [^<]*<br>')

넣음, 건너뜀 = 0, []
for p in sorted(glob.glob(os.path.join(WEB, '*.html'))):
    s = io.open(p, encoding='utf-8').read()
    이름 = os.path.basename(p)
    if 이미.search(s):
        s2 = 이미.sub(새줄.format(번호), s)
    elif 닻 in s:
        s2 = s.replace(닻, 새줄.format(번호), 1)
    else:
        건너뜀.append(이름); continue
    if s2 != s:
        io.open(p, 'w', encoding='utf-8').write(s2)
        print('  ✓', 이름)
        넣음 += 1
    else:
        print('  그대로입니다:', 이름)

print('\n  넣은 쪽: %d' % 넣음)
if 건너뜀:
    print('  법정 표시가 없는 쪽(원래 그렇습니다):', ' · '.join(건너뜀))
print('\n  올리기:  cd ~/Desktop/network-dna && git add web/ && git commit && git push')
print('  ⚠ 신고번호를 넣었으면 signup.html 의 SIGNUP_OPEN 도 함께 보세요 —')
print('     결제대행사(PG) 계약까지 끝나야 true 로 바꿀 수 있습니다.')
