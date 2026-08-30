#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# catalog.json 하나를 원본으로 두고, 그것을 보는 두 곳에 내려보냅니다.
#
#   web/catalog.json                     정적 사이트가 fetch 로 읽습니다
#   supabase/functions/_shared/catalog.ts  서버가 import 로 읽습니다
#
# 왜 이렇게 하나 —
# 요금이 화면과 서버에서 다르면 그대로 결제 사고입니다.
# 값을 두 군데에 적어 두면 언젠가 반드시 어긋나므로,
# 원본은 하나만 두고 나머지는 만들어 냅니다.
#
# 만들어진 파일은 직접 고치지 마세요. 다음 실행 때 덮어씁니다.
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

SRC="catalog.json"
[ -f "$SRC" ] || { echo "‼ $SRC 이 없습니다"; exit 1; }

# 원본이 성한지부터
python3 -c "import json,io,sys; json.load(io.open('$SRC',encoding='utf-8'))" \
  || { echo "‼ $SRC 이 올바른 JSON 이 아닙니다"; exit 1; }

mkdir -p web supabase/functions/_shared

cp "$SRC" web/catalog.json
echo "  → web/catalog.json"

python3 - <<'PY'
import json, io
c = json.load(io.open('catalog.json', encoding='utf-8'))
body = json.dumps(c, ensure_ascii=False, indent=2)
out = '''/* 이 파일은 만들어진 것입니다. 직접 고치지 마세요.
   원본은 저장소 루트의 catalog.json 이고,
   sync-catalog.sh 를 돌리면 이 파일이 다시 만들어집니다. */

export const CATALOG = ''' + body + ''' as const;

/* 인원 수에 맞는 요금제. 화면(web/catalog.js)의 planForSeats 와
   같은 규칙이어야 합니다. personal 은 1인 전용이라 제외합니다. */
export function planForSeats(seats: number) {
  if (!Number.isInteger(seats) || seats < 1) return null;
  for (const [key, p] of Object.entries(CATALOG.plans)) {
    if (key === '_' || key === 'personal') continue;
    const q = p as any;
    if (seats >= q.seatMin && (q.seatMax === null || seats <= q.seatMax)) {
      return { key, ...q };
    }
  }
  return null;
}

/* 표시 순서대로. '_' 설명 항목은 걸러냅니다.
   web/catalog.js 의 planList 와 같은 규칙입니다. */
export function planList() {
  return Object.entries(CATALOG.plans)
    .filter(([k]) => k !== '_')
    .map(([key, p]) => ({ key, ...(p as any) }));
}

export function plan(key: string) {
  if (key === '_') return null;
  const p = (CATALOG.plans as any)[key];
  return p ? { key, ...p } : null;
}

export function seatsFit(p: any, seats: number) {
  if (!p || !Number.isInteger(seats)) return false;
  return seats >= p.seatMin && (p.seatMax === null || seats <= p.seatMax);
}

/* 업종 등급. C 는 가입을 막습니다. */
export function gradeOf(id: string): 'A' | 'B' | 'C' | null {
  for (const g of ['A', 'B', 'C'] as const) {
    if ((CATALOG.industries as any)[g].some((i: any) => i.id === id)) return g;
  }
  return null;
}
'''
io.open('supabase/functions/_shared/catalog.ts','w',encoding='utf-8').write(out)
PY
echo "  → supabase/functions/_shared/catalog.ts"

REV=$(python3 -c "import json,io;print(json.load(io.open('catalog.json',encoding='utf-8'))['revision'])")
echo "✓ catalog 판 $REV 을 두 곳에 내려보냈습니다"
echo
echo "   cors.ts 나 요금이 바뀌었다면 서버 함수도 다시 배포하세요:"
echo "     supabase functions deploy signup --project-ref izrtclsqhsgkuwsffifn"
