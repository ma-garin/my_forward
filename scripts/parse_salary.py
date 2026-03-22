#!/usr/bin/env python3
"""
給与明細・賞与明細・源泉徴収票 PDF → salaryData.json / withholdingData.json
使い方: python3 scripts/parse_salary.py
"""

import pdfplumber, os, re, json

SALARY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../salary')
_BASE = os.path.dirname(os.path.abspath(__file__))
OUT_SALARY      = os.path.join(_BASE, '../src/utils/salaryData.json')
OUT_WITHHOLDING = os.path.join(_BASE, '../src/utils/withholdingData.json')


def dedup(text):
    """PDFの二重文字（差差引引…）を正規化"""
    result = []; i = 0
    while i < len(text):
        c = text[i]
        if ord(c) < 256 or c in ' \n':
            result.append(c); i += 1
        else:
            if i + 1 < len(text) and text[i+1] == c:
                result.append(c); i += 2
            else:
                result.append(c); i += 1
    return ''.join(result)


def get_text(text, label):
    m = re.search(re.escape(label) + r'\s*([\d,]+)', text)
    return int(m.group(1).replace(',', '')) if m else None


def parse_salary_pdf(path, fname):
    """給与明細・賞与明細をパース"""
    with pdfplumber.open(path) as p:
        raw = p.pages[0].extract_text()
    text = dedup(raw)
    is_bonus = '賞与' in fname
    m_year  = re.search(r'(\d{4})年', fname)
    m_month = re.search(r'(\d+)月', fname)
    ot_h = re.search(r'時間外勤務\s*([\d.]+)', text)
    return {
        'year':          int(m_year.group(1))  if m_year  else None,
        'month':         int(m_month.group(1)) if m_month else None,
        'type':          'bonus' if is_bonus else 'salary',
        'takeHome':      get_text(text, '差引支給額'),
        'totalPay':      get_text(text, '支給額合計'),
        'totalDed':      get_text(text, '控除額合計'),
        'overtime':      get_text(text, '時間外手当'),
        'overtimeHours': float(ot_h.group(1)) if ot_h else None,
        'basePay':       get_text(text, '基本給') or get_text(text, '職能給'),
        'health':        get_text(text, '健康保険'),
        'pension':       get_text(text, '厚生年金保険'),
        'employment':    get_text(text, '雇用保険'),
        'income':        get_text(text, '所得税'),
        'resident':      get_text(text, '住民税'),
        'union':         get_text(text, '組合費'),
        'workDays':      get_text(text, '勤務日数'),
    }


def parse_withholding_pdf(path, fname):
    """源泉徴収票をパース（座標ベース）"""
    with pdfplumber.open(path) as p:
        page  = p.pages[0]
        raw   = page.extract_text()
        words = page.extract_words()

    text = dedup(raw)

    # 令和N年 → 西暦
    reiwa_m = re.search(r'令和(\d+)年', text)
    if reiwa_m:
        year = 2018 + int(reiwa_m.group(1))
    else:
        m_year = re.search(r'(\d{4})年', fname)
        year = int(m_year.group(1)) if m_year else None

    # 座標 y≈187 の数値群を x 順に取得
    row187 = sorted(
        [w for w in words if 180 <= round(w['top']) <= 200 and re.match(r'^[\d,]+$', w['text'].replace(',', ''))],
        key=lambda w: w['x0']
    )
    vals187 = [int(w['text'].replace(',', '')) for w in row187]

    # 座標 y≈287 の社会保険料
    row287 = sorted(
        [w for w in words if 278 <= round(w['top']) <= 300 and re.match(r'^[\d,]+$', w['text'].replace(',', ''))],
        key=lambda w: w['x0']
    )
    vals287 = [int(w['text'].replace(',', '')) for w in row287]

    # y=187: [支払金額, 給与所得控除後の金額, 所得控除の額の合計額, 源泉徴収税額]
    return {
        'year':              year,
        'totalPay':          vals187[0] if len(vals187) > 0 else None,
        'afterDeduction':    vals187[1] if len(vals187) > 1 else None,
        'deductionTotal':    vals187[2] if len(vals187) > 2 else None,
        'incomeTax':         vals187[3] if len(vals187) > 3 else None,
        'socialInsurance':   vals287[0] if len(vals287) > 0 else None,
    }


def collect_pdfs(root_dir):
    """ルート直下 + 年サブフォルダの全PDFを収集"""
    found = []
    for entry in sorted(os.listdir(root_dir)):
        full = os.path.join(root_dir, entry)
        if os.path.isfile(full) and entry.endswith('.pdf'):
            found.append((full, entry))
        elif os.path.isdir(full):
            for fname in sorted(os.listdir(full)):
                if fname.endswith('.pdf'):
                    found.append((os.path.join(full, fname), fname))
    return found


def main():
    salaries    = []
    withholding = []
    errors      = []

    for path, fname in collect_pdfs(SALARY_DIR):
        try:
            if '源泉徴収票' in fname:
                rec = parse_withholding_pdf(path, fname)
                withholding.append(rec)
                print(f'  [源泉] {fname} → year={rec["year"]} totalPay={rec["totalPay"]}')
            else:
                rec = parse_salary_pdf(path, fname)
                salaries.append(rec)
                print(f'  [給与] {fname} → {rec["year"]}/{rec["month"]} take={rec["takeHome"]}')
        except Exception as e:
            errors.append(fname)
            print(f'  [ERROR] {fname}: {e}')

    salaries.sort(key=lambda x: (x['year'] or 0, x['month'] or 0, x['type']))
    withholding.sort(key=lambda x: x['year'] or 0)

    with open(OUT_SALARY, 'w', encoding='utf-8') as f:
        json.dump(salaries, f, ensure_ascii=False, indent=2)

    with open(OUT_WITHHOLDING, 'w', encoding='utf-8') as f:
        json.dump(withholding, f, ensure_ascii=False, indent=2)

    print(f'\n✅ 給与明細: {len(salaries)}件 → salaryData.json')
    print(f'✅ 源泉徴収票: {len(withholding)}件 → withholdingData.json')
    if errors:
        print(f'⚠️  エラー: {errors}')


if __name__ == '__main__':
    main()
