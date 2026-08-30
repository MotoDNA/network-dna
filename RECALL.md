# Re:Call — 한 장으로 보는 전부

명함을 찍으면 고객카드가 되는 **고객관리** 앱입니다.
만난 기록을 남기고, 다음에 할 일을 놓치지 않게 합니다.

이 문서는 **지금 상태**만 적습니다. 유료 전환 과정과 그때그때의 판단은
[이어서-하기.md](이어서-하기.md)에, 홈페이지 배포는 [dnalabs-배포.md](dnalabs-배포.md)에 있습니다.

*기준 2026-08-30*

---

## 1. 어디에 있나

| | |
|---|---|
| 운영 | **https://dnalabs.kr/call** (권장) · https://recall.dnalabs.kr/ (옛 주소, 살아 있음) |
| 회사 홈페이지 | **https://dnalabs.kr** — 이 저장소의 `web/` 폴더 (Vercel) |
| 저장소 | https://github.com/MotoDNA/network-dna — GitHub Pages, `main` push 후 1~2분 |
| 폴더 | `~/Desktop/network-dna` |

**옛 주소를 끄지 마세요.** `dnalabs.kr/call` 은 그 주소에서 내용을
**가져다 비추는 것**(Vercel rewrite)이라 끄면 새 주소도 함께 멈춥니다.

---

## 2. 형제 서비스 셋

DNA Labs 서비스가 셋이고 **같은 Supabase 프로젝트·같은 계정 목록**을 씁니다.

| 서비스 | 하는 일 | 새 주소 | 옛 주소 | 폴더 |
|---|---|---|---|---|
| Re:Bind | 프로젝트별 공정 관리 | `dnalabs.kr/bind` | `rebind.dnalabs.kr` | `~/Desktop/Rebind` |
| **Re:Call** | **고객관리** | `dnalabs.kr/call` | `recall.dnalabs.kr` | `~/Desktop/network-dna` |
| Re:Store | 가맹점 발주·정산 | `dnalabs.kr/store` | `restore.dnalabs.kr` | `~/Desktop/Restore` |

⚠ **셋이 얽혀 있어 하나만 보고 고치면 다른 쪽이 멈추는 것 셋**
1. `ALLOWED_ORIGIN` (6장) — **이 저장소가 홈페이지도 갖고 있어 특히 조심**
2. `companies.apps` (5장)
3. 로그인 화면의 서비스 토글 — 세 앱이 같은 차례·같은 문구

**Re:Call 이 형제 중 맏이입니다.** `0001_init.sql` 에서 만든 도우미 함수
(`current_company_id()` · `is_admin()`)를 셋이 다 씁니다.
계정을 만드는 `admin-user` 함수와 `setup-admin.sh` 도 여기 있습니다.

---

## 3. 파일 구조

```
network-dna.html         앱 전부. 파일 하나입니다 (4,827줄)
index.html               network-dna.html 로 넘겨 주기만 합니다
catalog.json             ★ 요금제와 업종 판정의 단일 출처
sync-catalog.sh          catalog.json → web/ 과 서버용 catalog.ts 로 복사
setup-admin.sh           회사와 관리자 계정을 함께 만듭니다 (bootstrap)
build-og.sh              공유 이미지(1200×630) 두 장을 만듭니다 (크롬 필요)
build-privacy.sh         개인정보 처리방침 PDF

supabase/migrations/
  0001_init.sql              ★ 회사·사람·고객·활동 + 도우미 함수 (형제 공통)
  recall_0002_visibility.sql 고객카드 공개 범위
  recall_0003_billing.sql    ★ 구독·좌석제한·회사코드 자동발급
  recall_0004_card_limits.sql 명함 인식 한도 세기
  rebind_0003_works_realtime.sql

supabase/functions/
  read-card/     명함 사진을 읽어 고객카드를 채웁니다
  admin-user/    계정 만들기·비밀번호 재발급 (--no-verify-jwt)
  signup/        ★ 회원가입 — 업종 판정·요금제 확정·회사코드 발급
  subscription/  ★ 요금제 변경·해지·해지 취소
  _shared/       cors.ts · catalog.ts(sync-catalog.sh 가 만듭니다)

web/                     ★ 회사 홈페이지 (dnalabs.kr, Vercel)
  index.html               회사 소개
  recall.html              Re:Call 소개·요금·업종
  signup.html              회원가입 (업종→요금제→정보→약관→결제→발급)
  terms.html refund.html privacy.html    이용약관·환불정책·처리방침
  404.html catalog.js pg.js style.css
  favicon.svg logo.png og-*.png robots.txt sitemap.xml
  vercel.json            ★ /bind · /call · /store rewrite
  bind.webmanifest store.webmanifest
```

### 화면 넷 · 시트 아홉

| 탭 | id | |
|---|---|---|
| 고객 | `p-list` | 목록·검색·그룹칩·통계 |
| 새 고객 | `p-new` | 명함 촬영 → 자동 인식 → 저장 |
| 팀 | `p-team` | 오늘/이번 주/이번 달 팀 활동 |
| 설정 | `p-set` | 계정·팀원·그룹·인식·**요금제** |

시트: `sheet` `assignSheet` `pwSheet` **`planSheet`** `visSheet` `ocrSheet`
`userSheet` `shareSheet` `askSheet`

고객 상세는 덮는 화면(`#detail`).

**오프라인에 대비해 IndexedDB 에 사본을 둡니다.** 로그아웃할 때 지웁니다 —
남의 폰에 고객 자료를 두고 나가지 않도록.

---

## 4. 데이터 모양

| 표 | |
|---|---|
| `customers` | 고객카드. `name` `company_name` `title` `phone`/`phone_digits` `email` `addr` `groups` `photo_path` `last_at` **`visibility`** `owner_id` `shared_ids` |
| `activities` | 만난 기록·할 일. `customer_id` `kind` `body` `at` `due` `done` `by_id` |

`phone_digits` 는 숫자만 남긴 사본입니다 — 하이픈을 어떻게 적든 검색되게 하려고.

### 고객카드 공개 범위 (`customers.visibility`)

| `company` | 회사 전체가 봅니다 |
|---|---|
| `shared` | 담당자와 공유 대상만 (기본값) |
| `private` | 담당자만 |

`shared_ids` 로 사람을 지정합니다. 관리자는 다 봅니다.

### 그 밖

`companies`(`code` `name` **`apps`** `industry_id` `industry_grade` `contact_*`) ·
`profiles`(`login_id` `name` `role` `disabled`) · `company_settings` · `audit_log`

보관함: **`cards`**(비공개). 경로가 곧 권한 — `{회사id}/{고객id}.jpg`

---

## 5. 누가 무엇을 볼 수 있나

### 회사 단위 — 어느 서비스를 샀나 (`companies.apps`)

```
apps text[]   {rebind} · {recall} · {restore} · 여러 개 가능
```

**비어 있으면 아무 데도 못 들어갑니다.** 새 회사를 만들 때 꼭 함께 넣으세요.

지금: `ACTIVA {rebind,recall}` · `BKT {rebind}` · `9DORO {restore}`

**화면이 아니라 데이터베이스가 막습니다.**
`company_for_app('recall')` 이 산 서비스면 회사 id, 아니면 null 을 돌려주고,
정책들이 `company_id = company_for_app('recall')` 로 비교합니다.
null 과의 비교는 참이 되지 않아 그대로 닫힙니다.
(`~/Desktop/Rebind/sql/0019_apps.sql` 에 있습니다 — 저장소가 달라도 같은 데이터베이스입니다)

| Re:Call 의 표 | `customers` · `activities` |
|---|---|
| Re:Bind 의 표 | `projects` · `project_steps` · `project_money` · `client_favorites` |
| Re:Store 의 표 | `stores` · `supply_items` · `orders` · `order_lines` |
| 공용 | `companies` · `profiles` · `company_settings` · `audit_log` |

### 결제 표는 더 닫혀 있습니다

| `subscriptions` | 읽기만 회사 사람에게 열려 있습니다. **고치는 정책이 없어** 서버 함수만 바꿉니다 — 직원이 자기 회사 `seat_limit` 을 늘리면 안 됩니다 |
|---|---|
| `billing_methods` | **정책이 하나도 없습니다.** RLS 가 켜져 있고 정책이 없으면 로그인한 사람은 한 줄도 못 봅니다. **의도한 것이니 지우지 마세요** |
| `signup_attempts` | 마찬가지. 서버 함수만 씁니다 |

---

## 6. 접속과 서버

```
Project ref  izrtclsqhsgkuwsffifn
회사코드 ACTIVA / admin   ← 고객 2건
```

```bash
cd ~/Desktop/Rebind          # supabase CLI 가 link 된 폴더
supabase db query --linked "select ..."
cd ~/Desktop/network-dna
supabase functions deploy read-card    --project-ref izrtclsqhsgkuwsffifn
supabase functions deploy admin-user   --no-verify-jwt --project-ref izrtclsqhsgkuwsffifn
supabase functions deploy signup       --no-verify-jwt --project-ref izrtclsqhsgkuwsffifn
supabase functions deploy subscription --project-ref izrtclsqhsgkuwsffifn
```

`admin-user` 와 `signup` 은 `--no-verify-jwt` 가 필요합니다 —
계정을 **만들기 전**에 부르는 함수라 로그인이 있을 수 없습니다.

### ⚠ ALLOWED_ORIGIN — 가장 자주 어긋나는 것

**네 주소가 함께 쓰는 값 하나입니다.** 실제로 두 번 어긋났습니다.
한 번은 값이 안 들어갔고, 한 번은 `restore` 를 넣으면서 `dnalabs.kr` 이 빠졌습니다.
**틀려도 조용합니다** — 화면은 뜨고 로그인도 되는데 서버 함수만 막힙니다.

```bash
supabase secrets set ALLOWED_ORIGIN="https://rebind.dnalabs.kr,https://recall.dnalabs.kr,https://restore.dnalabs.kr,https://dnalabs.kr" \
  --project-ref izrtclsqhsgkuwsffifn
```

바꾼 뒤 **함수를 모두 다시 배포**해야 반영됩니다 —
`read-card` `admin-user` `signup` `subscription` (여기) ·
`share-view` `read-order` (Re:Bind) · `store-gate` (Re:Store).

**넣고 끝내지 말고 되읽어 확인하세요.**

```bash
curl -s -o /dev/null -D - -X OPTIONS \
  https://izrtclsqhsgkuwsffifn.supabase.co/functions/v1/read-card \
  -H "Origin: https://dnalabs.kr" -H "Access-Control-Request-Method: POST" \
  | grep -i access-control-allow-origin
# → 부른 주소가 그대로 돌아오면 통과
```

### 함수 넷

| `read-card` | 명함 사진을 Claude 로 읽습니다. **한도는 `catalog.json` 이 정합니다** — 하루/한 달, 한국시간 달력 기준 |
|---|---|
| `admin-user` | 계정 만들기·비밀번호 재발급. 로그인 아이디는 `아이디@회사코드.ndna.invalid` 로 만듭니다. `.invalid` 는 규격상 존재할 수 없는 도메인이라 메일이 나갈 일이 없습니다 |
| `signup` | 회원가입. **화면이 보낸 값을 하나도 믿지 않습니다** — 업종 등급·요금제·좌석 수를 여기서 `catalog` 를 보고 다시 정합니다 |
| `subscription` | 요금제 변경·해지. **돈 계산은 전부 여기서** 합니다. 화면에서 계산하면 사용자가 그 값을 바꿔 보낼 수 있고 그대로 결제 사고입니다 |

---

## 7. 결제 — 지은 것과 안 지은 것

### 값은 `catalog.json` 한 군데에만 있습니다

홈페이지·가입 화면·서버가 모두 이 파일을 봅니다. 고치면:

```bash
./sync-catalog.sh      # web/catalog.json 과 서버용 _shared/catalog.ts 를 다시 만듭니다
```

숫자를 두 군데 적으면 "화면엔 49,000원인데 실제론 99,000원이 빠지는" 일이 납니다.
**데이터베이스에도 요금을 적지 않았습니다** — DB 는 `seat_limit`(자리 수)만 압니다.

| 열쇠 | 이름 | 월 요금 | 자리 | 무료체험 |
|---|---|---|---|---|
| `personal` | Personal | 19,000원 | 1 | 30일 |
| `business5` | Business 5 | 49,000원 | 1~5 | — |
| `business20` | Business 20 | 99,000원 | 6~20 | — |
| `business49` | Business 49 | 249,000원 | 21~49 | — |
| `enterprise` | Enterprise | 문의 | 50~ | — |

명함 인식 한도도 요금제마다 붙어 있습니다(`cardDailyLimit`/`cardMonthlyLimit`).
**영업용 숫자가 아니라 사고 방지선입니다 — 요금표에 적지 마세요.**

`catalog.json` 에는 **업종 판정**도 있습니다.
`A` 바로 가능 · `B` 확인 후 가능 · `C` 가입 불가.

### 데이터베이스 (`recall_0003_billing.sql`, 적용 끝)

| `subscriptions` | 회사당 한 줄. `plan_key` `plan_name` `price` `seat_limit` `status`(trialing/active/past_due/canceled) `trial_ends_at` `period_start/end` `canceled_at` + `pending_*`(하위 요금제 예약) |
|---|---|
| `billing_methods` | **카드번호는 없습니다.** 결제대행사에서 받은 `billing_key` 와 카드 뒷 4자리만 |
| `signup_attempts` | 가입 시도 제한 (같은 IP 한 시간 안에 몇 번) |

**판 시점의 이름과 금액을 그대로 박아 둡니다.** `catalog.json` 을 보면 되지 않느냐 싶지만
요금은 나중에 바뀝니다. 그때 이 회사에 무엇을 얼마에 팔았는지가 남아 있어야
청구서가 정직해지고 요금 인상 고지도 이 값을 기준으로 합니다.

**좌석 제한은 트리거로 막습니다.** 앱에도 같은 검사가 있지만 앱을 거치지 않고
들어오는 길이 있으므로 마지막 방어선을 데이터베이스에 둡니다.
정지된 계정은 세지 않습니다 — 사람이 나갔는데 자리를 차지하면 요금을 더 냅니다.

**하위 요금제로 내리는 것은 다음 결제일부터**입니다(환불정책 제5조).
`pending_*` 에 담아 두고 `apply_due_plan_changes()` 가 적용합니다.
⚠ **그 함수를 주기적으로 불러 주는 것이 아직 없습니다.** 지금은 앱이 구독 정보를
읽을 때 한 번 부릅니다. 매월 요금을 걷는 작업을 만들 때 **걷기 전에 반드시 먼저**
부르세요 — 순서가 바뀌면 내려 달라고 한 사람에게 옛 금액을 청구합니다.

### 지은 것

| | 어디 |
|---|---|
| 회사 홈페이지 | `web/index.html` |
| Re:Call 소개·요금·업종 | `web/recall.html` |
| 회원가입 (업종→요금제→정보→약관→결제→발급) | `web/signup.html` |
| 가입 처리 서버 | `supabase/functions/signup/` (**배포됨**, v6) |
| 해지·요금제 변경 서버 | `supabase/functions/subscription/` (**배포됨**, v6) |
| 앱 요금제 화면 (상태·남은 자리·해지·변경) | `network-dna.html` 설정 탭 (`planSheet`) |
| 이용약관·환불정책·처리방침 | `web/terms.html` · `refund.html` · `privacy.html` |

**약관에만 있고 화면에는 없는 기능은 거짓말이 됩니다.**
`subscription` 함수는 이용약관 제10조와 환불정책 제4·5조를 그대로 구현한 것입니다.

### 아직 안 된 것

| 할 일 | 왜 막혀 있나 |
|---|---|
| **결제대행사(PG) 계약** | 계약 전이라 `web/pg.js` 가 **스텁**입니다. 가입 화면에 "테스트 모드" 띠가 뜨고 실제 돈은 안 움직입니다. 계약 후 `pg.js` · `signup` 의 `pgAuthorizeZero` · `subscription` 의 `pgChargeOnce` **셋**을 채우면 됩니다 |
| **통신판매업 신고** | 구매안전서비스 확인증 심사 대기. ⚠ 신고 후 **꼬리말에 신고번호를 넣어야** 합니다 — 자리표시자를 뺐기 때문에 알림이 안 뜹니다 |
| **회원가입 잠금 해제** | 지금 `SIGNUP_OPEN = false` 로 닫혀 있습니다. PG 계약 · 신고번호 둘이 되면 `true` 로 |
| **가입 안내 메일** | 안 만들었습니다. 그래서 화면에서 "메일로 보내 드립니다" 문구를 뺐고, 지금은 비밀번호를 화면에서 한 번만 보여 줍니다 |
| **매월 요금 걷기** | 없습니다. `apply_due_plan_changes()` 를 먼저 부르는 순서를 지켜야 합니다 |
| **DKIM** | 안 켰습니다. 보낸 메일이 스팸함으로 갑니다 |

**결제 표 셋(`subscriptions` `billing_methods` `signup_attempts`)은 다 비어 있습니다.**
아직 아무도 유료로 가입하지 않았습니다.

### 회사 메일 — hello@dnalabs.kr (가비아 하이웍스)

⚠ **SPF 는 도메인당 한 줄만 유효합니다.** 나중에 발신 메일(Resend 등)을 붙일 때
새 TXT 줄을 만들면 둘 다 깨집니다. 기존 줄에 `include:` 를 **덧붙이세요.**

---

## 8. 로그인 화면

세 서비스 토글. 세 앱이 **같은 차례·같은 문구**를 씁니다.

```js
const APPS     = ['rebind','recall','restore'];
const ONE_ROOF = {rebind:'/bind', recall:'/call', restore:'/store'};
const underOneRoof = ONE_ROOF[APP_KEY] === location.pathname.replace(/\/+$/,'');
```

서비스가 늘면 **세 파일에서 이 표에 한 줄씩** 더합니다.

| `dnalabs.kr/call` | 로그인 칸이 그대로. 여기서 로그인하고 그쪽으로 넘어갑니다 |
|---|---|
| `recall.dnalabs.kr` | 칸을 감추고 이동 단추만 — **엉뚱한 앱에 비밀번호를 치면 안 됩니다** |

**로그인 정보는 세 서비스가 똑같습니다.** 보관 자리도 셋 다 `ndna-auth` 라
한 지붕(`dnalabs.kr/*`)에서는 한 번 로그인하면 산 것이 다 열립니다.

PC(가로 1000px 이상)에서는 고객 목록이 두 단, 시트가 화면 가운데 모달로 뜹니다.
상세·팀·설정·새 고객은 **두 단으로 안 했습니다** — "제목 → 목록 → 설명 → 단추"
처럼 순서가 있는 흐름이라 칸으로 쪼개면 읽는 순서가 끊깁니다.

---

## 9. 고칠 때 지키는 것

**1. 문법 검사만으로는 부족합니다.** 한 파일이라 초기화 순서 오류(TDZ)는 안 걸러집니다.

```bash
python3 -c "
import io,re
s=io.open('network-dna.html',encoding='utf-8').read()
io.open('/tmp/app.js','w',encoding='utf-8').write(re.findall(r'<script>(.*?)</script>',s,re.S)[-1])
" && node --check /tmp/app.js
```

**2. 반드시 브라우저로 열어 보고 콘솔까지 봅니다.**
한 지붕 동작을 볼 때는 `/bind`·`/call`·`/store` 를 한 주소에서 내려 주는
작은 서버를 띄웁니다(그래야 `underOneRoof` 가 켜집니다).

**3. 올린 뒤에도 열어 봅니다.** GitHub Pages 는 1~2분, **브라우저가 옛 파일을
한동안 보여 줍니다** — 안 바뀐 것 같으면 주소 뒤에 `?v=2`.

**4. 파이썬으로 고칩니다.** `assert old in s` 로 자리를 확인하고 `replace(old,new,1)`.

**5. `catalog.json` 을 고쳤으면 `./sync-catalog.sh` 를 꼭 돌리세요.**

---

## 10. 배포

| 무엇 | 어떻게 |
|---|---|
| 앱 | `git push` → GitHub Pages 1~2분 |
| 서버 함수 | `supabase functions deploy …` (6장) |
| SQL | `supabase db query --linked -f supabase/migrations/….sql` |
| **홈페이지 · rewrite** | `npx vercel --prod --scope chhanj40-5991s-projects` |
| 공유 이미지 | `./build-og.sh` (크롬 필요) |
| 로고 | `python3 ~/Desktop/Rebind/make-logo.py` → 세 앱과 홈페이지 파비콘까지 |

`--scope` 를 빼면 `Not authorized` — `.vercel/project.json` 의 `orgId` 와
로그인 계정의 팀 이름이 다릅니다.

`dnalabs.kr/call` 은 rewrite 라 **GitHub Pages 만 반영되면 함께 바뀝니다.**

---

## 11. 함정 모음

| | |
|---|---|
| `ALLOWED_ORIGIN` | 넷을 다 적고 **되읽어 확인**. 틀려도 조용합니다 |
| `catalog.json` | 고치면 `./sync-catalog.sh`. 안 돌리면 화면과 서버 값이 어긋납니다 |
| `billing_methods` 정책 | **없는 게 맞습니다.** 만들지 마세요 |
| `apply_due_plan_changes()` | 요금 걷기 **전에** 부르세요. 순서가 바뀌면 옛 금액을 청구합니다 |
| `companies` 조인 | 그냥 붙이면 후보가 둘(`client_favorites` 때문)이라 300 이 돌아옵니다. `companies!profiles_company_id_fkey` 로 못 박습니다 |
| `setup-admin.sh` | **이미 있는 회사 코드를 거부합니다.** 회사를 SQL 로 먼저 만들면 계정을 못 만듭니다 — **계정 먼저** |
| 새 회사 | `apps` 를 꼭 함께 넣으세요 |
| SPF | 도메인당 한 줄. 새 줄을 만들면 둘 다 깨집니다 |
| 네임서버 | Vercel 로 바꾸면 `recall`·`rebind`·`restore` 가 죽습니다. **A 레코드만** 넣습니다 |

---

## 12. 아직 안 한 것

- **결제 실물** (7장) — PG 계약·통신판매업 신고·가입 잠금 해제
- **저장소 정리** — 8월 27일 Re:Bind 분리분(`bindery.html` 삭제 등)이 아직 커밋 안 됨.
  `web/` 과 `signup`/`subscription` 함수도 **커밋 안 된 채**입니다
- **고객사 실명 공개 동의** — 홈페이지 사례에 액티바코리아를 실명으로 안 넣었습니다
- **한 회사 안에서 사람마다 서비스를 가르는 것** — 사람 단위 칸이 하나 더 있어야 합니다

---

## 13. 말투

한국어로 씁니다. **무엇을 했는지가 아니라 왜 그렇게 했는지**를 적습니다.
과장하지 않고, 안 된 것은 안 됐다고 적습니다.
사용자는 개발자가 아닙니다 — 전문 용어는 한 줄로 풀어 줍니다.
