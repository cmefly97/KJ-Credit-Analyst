/* KJ Credit Analyst — Data Bundle (file:// 환경 지원용)
 * 로컬 웹서버 없이 index2.html을 직접 열 수 있도록 JSON을 인라인 임베딩.
 * script2.js의 boot()에서 fetch 실패 시 window.__KJ_DATA를 폴백으로 사용한다.
 */
'use strict';
window.__KJ_DATA = {
  agents: {
    "agents": [
      { "id": "A1", "name": "Document Ingestor", "kor": "자료 정규화", "model": "reg01 v1 + HCX-005 VLM", "icon": "📑", "color": "#1565c0", "stage": 1, "duration_sec": 4, "description": "PDF·HWP·이미지 → 구조화 MD/JSON. OCR/VLM으로 비정형 문서 정규화." },
      { "id": "A2", "name": "Financial Analyst", "kor": "재무 분석", "model": "HCX-007 Thinking", "icon": "📊", "color": "#0277bd", "stage": 2, "duration_sec": 5, "description": "3개년 재무제표·부속명세서·세금계산서 → 추세·KPI·이상치." },
      { "id": "A3", "name": "Accounts Receivable", "kor": "매출채권 검증", "model": "HCX-SEED-32B", "icon": "💰", "color": "#0288d1", "stage": 3, "duration_sec": 4, "description": "매출채권 명세·거래처원장·대손충당금 → 회수·집중도·회전기간." },
      { "id": "A4", "name": "Bank-Loan Aggregator", "kor": "타행 여신 통합", "model": "HCX-SEED-32B", "icon": "🏦", "color": "#039be5", "stage": 4, "duration_sec": 4, "description": "타행거래확인서·운전자금·대출내역 → 통합 익스포저·상환 패턴." },
      { "id": "A5", "name": "Collateral", "kor": "담보 평가", "model": "HCX-007 + Vision", "icon": "🏛", "color": "#03a9f4", "stage": 5, "duration_sec": 4, "description": "등기부·감정평가서 → 감정가·담보가·근저당 순위·LTV." },
      { "id": "A6", "name": "Compliance", "kor": "동일차주 합산", "model": "HCX-007 Thinking + Graph DB", "icon": "⚠️", "color": "#b71c1c", "stage": 6, "duration_sec": 6, "description": "★ 관계회사 자동 식별 + 단기대여 추적 + 한도 위반 검출. KJ의 Killer Feature.", "killer": true },
      { "id": "A7", "name": "Report Writer", "kor": "보고서 작성", "model": "HCX-007 Thinking + RAG", "icon": "📝", "color": "#0d47a1", "stage": 8, "duration_sec": 7, "description": "광주은행 표준 양식 + A1-A6 통합 + 근거 자료 인용 → 승인신청서 + 해설서 초안." }
    ],
    "synthesis": { "id": "Synth", "name": "Risk Synthesis", "kor": "위험 종합", "model": "HCX-007 Thinking", "icon": "🔬", "color": "#1976d2", "stage": 7, "duration_sec": 4, "description": "정량·정성 위험요인 통합 + 가중치 산출 + 근거 자료 인용." }
  },
  stages: {
    "stages": [
      { "no": 1, "title": "차주 식별·법인 검증", "agent": "A1", "inputs": ["사업자등록증·인증서", "정관(마스킹)", "주주명부", "원천징수신고서", "법인등기부등본"], "output": "차주 법인 프로파일", "duration_sec": 4 },
      { "no": 2, "title": "재무 분석", "agent": "A2", "inputs": ["3개년 재무제표(감사)", "부속명세서 ★ god-node", "부가세 과세표준증명원", "매입매출 세금계산서 합계표"], "output": "3개년 추세·KPI·이상치", "duration_sec": 5, "parallel_group": "domain" },
      { "no": 3, "title": "매출채권 검증", "agent": "A3", "inputs": ["매출채권 명세서", "거래처원장", "대손충당금 설정·회수", "계약현황"], "output": "회수 가능성·집중도", "duration_sec": 4, "parallel_group": "domain" },
      { "no": 4, "title": "타행 여신 통합", "agent": "A4", "inputs": ["10.타행거래확인서 ★", "11.운전자금 상환내역", "신한B 대출거래내역서"], "output": "통합 익스포저·상환 패턴", "duration_sec": 4, "parallel_group": "domain" },
      { "no": 5, "title": "담보 평가", "agent": "A5", "inputs": ["담보물건 등기부등본", "소유부동산 등기부등본", "감정평가서"], "output": "감정가·담보가·근저당 순위·LTV", "duration_sec": 4, "parallel_group": "domain" },
      { "no": 6, "title": "★ 동일차주 합산", "agent": "A6", "inputs": ["관계회사 자료 일체", "정관·주주", "부속명세서 단기대여", "Graph DB 자체 조회"], "output": "★ 계열 익스포저 + 한도 위반 플래그", "duration_sec": 6, "killer": true },
      { "no": 7, "title": "위험 종합 분석", "agent": "Synth", "inputs": ["A2-A6 모든 분석 결과", "가중치 산출"], "output": "정량·정성 위험요인 통합", "duration_sec": 4 },
      { "no": 8, "title": "광주은행 표준 양식 작성", "agent": "A7", "inputs": ["광주은행 표준 양식", "A1-A6 통합", "근거 자료 인용"], "output": "승인신청서 + 해설서 초안", "duration_sec": 7 }
    ]
  },
  dataset: {
    "borrower": { "name": "(주)에이치에스티", "biz_no": "678-86-00767", "ceo": "황성태", "industry": "수배전반·태양광·전기공사", "address": "광주광역시 (본점) · 전라남도 나주시 (사업장)", "established": "2018-03", "employees": 32, "certifications": ["ISO 9001", "ISO 14001", "전기공사업"] },
    "application": { "branch": "광주은행 빛가람한전지점", "product": "비즈니스파트너론", "amount_ok": 1710, "term_months": 36, "rate_pct": 5.83, "purpose": "기업시설자금대출일시" },
    "credit_rating": { "internal": "BB+", "internal_date": "2024-01-24", "kcb": 818, "nice": 841 },
    "files": {
      "표준 양식 (1건)": [
        { "name": "여신승인신청서 작성방법_샘플.hwp", "size_mb": 0.4, "type": "양식 가이드" }
      ],
      "신용평가 외부 자료 (2건)": [
        { "name": "(주)에이치에스티_크레탑_총괄.pdf", "size_mb": 0.6, "type": "NICE 신용평가" },
        { "name": "(주)에이치에스티_크레탑_재무제표.pdf", "size_mb": 0.6, "type": "NICE 재무 평가" }
      ],
      "기업 기초 정보 (5건)": [
        { "name": "1.사업자등록증외인증서.pdf", "size_mb": 9.5 },
        { "name": "2.주주명부.pdf", "size_mb": 0.5 },
        { "name": "3.정관(마스킹).pdf", "size_mb": 8.0 },
        { "name": "4.원천징수이행사항신고서.pdf", "size_mb": 3.0 },
        { "name": "7.23년부가세과세표준증명원.pdf", "size_mb": 0.7 }
      ],
      "재무제표·계약 (5건)": [
        { "name": "5.23년재무제표감사의견서포함.pdf", "size_mb": 5.0 },
        { "name": "6.23년재무제표부속명세서.pdf ★", "size_mb": 8.6, "highlight": true, "note": "god-node" },
        { "name": "8.23년매입매출세금계산서합계표.pdf", "size_mb": 12.1 },
        { "name": "9.23년24년계약현황.pdf", "size_mb": 11.9 },
        { "name": "24년계약현황기준일24.1.25.pdf", "size_mb": 0.9 }
      ],
      "매출채권·운전자금 (5건)": [
        { "name": "매출채권명세서22년23년.pdf", "size_mb": 3.6 },
        { "name": "매출채권거래처원장.pdf", "size_mb": 4.0 },
        { "name": "매출채권대손충당금설정내역.pdf", "size_mb": 0.4 },
        { "name": "매출채권대손충당금회수내역.pdf", "size_mb": 5.2 },
        { "name": "단기대여금거래처원장.pdf ★", "size_mb": 0.7, "highlight": true, "note": "동일차주 단서" }
      ],
      "타행 거래·부채 (3건)": [
        { "name": "10.타행금융거래확인서신한국민산업.pdf ★", "size_mb": 3.2, "highlight": true, "note": "god-node" },
        { "name": "11.23년타행운전자금상환내역서.pdf", "size_mb": 2.5 },
        { "name": "신한B대출거래내역서.pdf", "size_mb": 6.5 }
      ],
      "담보 (2건)": [
        { "name": "14.담보물건등기부등본.pdf", "size_mb": 11.1 },
        { "name": "15.소유부동산등기부등본.pdf", "size_mb": 5.1 }
      ],
      "관계회사 자료 (2건)": [
        { "name": "16.(주)에스티건설관련자료.pdf ★", "size_mb": 11.0, "highlight": true, "note": "동일대표 검출" },
        { "name": "17.(주)두원건설관련자료.pdf ★", "size_mb": 28.2, "highlight": true, "note": "100% 자회사 검출" }
      ],
      "사업성 평가 (3건)": [
        { "name": "속초교동주상복합개발사업계획안.pdf", "size_mb": 9.8 },
        { "name": "폐기물처리사업계획적합통보서(주)에이치에스티.pdf", "size_mb": 1.3 },
        { "name": "수배전반제품개발사진.hwp", "size_mb": 14.5, "type": "VLM 분석 대상" }
      ]
    },
    "reference_files": {
      "참고자료 (2건) — 모델 학습·검증용 정답지": [
        { "name": "(주)에이치에스티_승인신청서.pdf", "size_mb": 19.0, "type": "실제 작성된 승인신청서 (정답)" },
        { "name": "(주)에이치에스티_승인신청서_해설서.pdf", "size_mb": 5.1, "type": "각 항목 작성 근거 해설 (정답)" }
      ]
    },
    "stage_results": {
      "1": {
        "title": "차주 법인 프로파일 정규화",
        "summary": "사업자번호 678-86-00767 / 대표 황성태 (38% 지분 8,000주) / 본점 광주광역시 / ISO 인증 3종 / 인력 32명",
        "kpis": [
          { "label": "정규화 자료", "value": "30 파일", "unit": "" },
          { "label": "OCR 평균 신뢰도", "value": 98.7, "unit": "%" },
          { "label": "VLM 처리 이미지 PDF", "value": 12, "unit": "건" },
          { "label": "HWP 파서 처리", "value": 2, "unit": "건" }
        ],
        "facts": [
          { "text": "차주 법인명: (주)에이치에스티 (사업자 678-86-00767)", "source": "1.사업자등록증외인증서.pdf p.1" },
          { "text": "대표이사: 황성태 (40% 지분, 8,000주)", "source": "2.주주명부.pdf" },
          { "text": "주주: 황성태 40% / 정진익 30% / 이규열 20% / 한효원 10%", "source": "2.주주명부.pdf" },
          { "text": "사업목적: 수배전반·신재생에너지·태양광·전기공사", "source": "3.정관(마스킹).pdf 5조" },
          { "text": "ISO 9001/14001/45001 + 전기공사업 인증", "source": "1.사업자등록증외인증서.pdf" }
        ]
      },
      "2": {
        "title": "재무 분석 — 매출 -52% 감소 추세 감지",
        "summary": "★ 매출 2021 163.78억 → 2023 78.78억 (-52%) 급감. 영업이익률 7.6% 안정. 자기자본 10.3억.",
        "kpis": [
          { "label": "2023 매출", "value": "78.78", "unit": "억원", "alert": true },
          { "label": "3년 매출 변화", "value": "-52", "unit": "%", "alert": true },
          { "label": "영업이익률", "value": 7.6, "unit": "%" },
          { "label": "자기자본", "value": "10.3", "unit": "억원" }
        ],
        "trend": { "years": [2021, 2022, 2023], "revenue": [163.78, 92.64, 78.78], "op_profit": [11.2, 7.0, 6.0] },
        "facts": [
          { "text": "2023년 매출 78.78억 (2021년 대비 -52% 급감)", "source": "5.23년재무제표(감사).pdf p.3" },
          { "text": "외상매출금 잔액 42.9억 (2023.12.31)", "source": "6.재무제표부속명세서.pdf p.7" },
          { "text": "단기대여금 70.5억 (관계회사)", "source": "6.재무제표부속명세서.pdf p.5", "highlight": true },
          { "text": "보통예금 잔액 15.6억 (광주·신한·우체·국민·KDB)", "source": "6.재무제표부속명세서.pdf p.4" },
          { "text": "재무제표 매출 89.2억 vs 부가세 89.5억 (편차 0.3% PASS)", "source": "교차검증" }
        ],
        "flags": [
          { "level": "WARN", "msg": "매출 -52% 급감 — 영업현금흐름 악화 우려" },
          { "level": "INFO", "msg": "감사 재무제표·부가세·매입매출 3중 cross-check 일치" }
        ]
      },
      "3": {
        "title": "매출채권 — 거래처 집중도 + 회전기간",
        "summary": "외상매출 42.9억 / 회전기간 116일 (업계 75일 대비 +55%) / 상위 3 거래처 집중도 55.4%",
        "kpis": [
          { "label": "외상매출 잔액", "value": "42.9", "unit": "억원" },
          { "label": "회전기간", "value": 116, "unit": "일", "alert": true },
          { "label": "상위 3 집중도", "value": 55.4, "unit": "%" },
          { "label": "대손충당금 비율", "value": 1.2, "unit": "%" }
        ],
        "concentration": [
          { "name": "(주)파루", "amount_ok": 7.15, "pct": 16.7 },
          { "name": "솔라윅스 주식회사", "amount_ok": 3.78, "pct": 8.8 },
          { "name": "기타 203거래처", "amount_ok": 31.97, "pct": 74.5 }
        ],
        "facts": [
          { "text": "2023년 총 매출 공급가 78.81억 / 매수 871건 / 거래처 205개", "source": "8.매입매출 세금계산서.pdf" },
          { "text": "(주)파루 단일 거래처 7.15억 (16.7%)", "source": "매출채권 거래처원장.pdf" },
          { "text": "회전기간 116일 (업계평균 75일 대비 +55%)", "source": "산업 평균 비교" },
          { "text": "대손충당금 비율 1.2% (보수적)", "source": "대손충당금 설정.pdf" }
        ],
        "flags": [
          { "level": "WARN", "msg": "회전기간 116일 — 매출 증가 대비 운전자금 부담" }
        ]
      },
      "4": {
        "title": "타행 여신 통합 — 약 100억 외부 익스포저",
        "summary": "신한 28.1억 + KDB 65억 (시설운영 6건) + 국민 (미상). 모두 정상거래, 연체 0.",
        "kpis": [
          { "label": "신한 여신", "value": "28.1", "unit": "억원" },
          { "label": "KDB 여신", "value": "65.0", "unit": "억원" },
          { "label": "국민", "value": "확인필요", "unit": "" },
          { "label": "연체 이력", "value": 0, "unit": "건" }
        ],
        "loans": [
          { "bank": "신한은행", "balance_ok": 28.1, "type": "시설·운전자금", "rate_pct": 5.45, "delay": 0 },
          { "bank": "KDB 산업은행", "balance_ok": 65.0, "type": "시설운영자금 (6건)", "rate_pct": 4.20, "delay": 0, "guarantee": "신용보증서 10억" },
          { "bank": "국민은행", "balance_ok": null, "type": "거래확인 필요", "delay": 0 }
        ],
        "facts": [
          { "text": "신한은행 여신 잔액 28.1억 (시설·운전자금)", "source": "10.타행금융거래확인서.pdf" },
          { "text": "KDB 산업은행 여신 65억 (시설운영자금 6건)", "source": "10.타행금융거래확인서.pdf" },
          { "text": "KDB 담보 토지분담금변환청구권 38.7억 + 신용보증서 10억", "source": "10.타행금융거래확인서.pdf" },
          { "text": "전 은행 정상거래·연체 0건", "source": "11.운전자금상환내역.pdf" }
        ]
      },
      "5": {
        "title": "담보 평가 — LTV 49.8%",
        "summary": "나주 혁신산단 1·2공장 / 감정가 50.3억 / 담보가 25.06억 / 1순위 근저당 33.72억 / LTV 49.8%",
        "kpis": [
          { "label": "감정가", "value": "50.3", "unit": "억원" },
          { "label": "담보가", "value": "25.06", "unit": "억원" },
          { "label": "1순위 근저당", "value": "33.72", "unit": "억원" },
          { "label": "LTV", "value": 49.8, "unit": "%" }
        ],
        "collateral": [
          { "asset": "나주 혁신산단 1공장", "appraisal_ok": 28.5, "collateral_ok": 14.25, "rank": 1, "mortgage_ok": 19.2 },
          { "asset": "나주 혁신산단 2공장", "appraisal_ok": 21.8, "collateral_ok": 10.81, "rank": 1, "mortgage_ok": 14.52 },
          { "asset": "태양광 발전소 6개호 (1,274kW)", "appraisal_ok": null, "collateral_ok": null, "note": "부수자산" }
        ],
        "facts": [
          { "text": "담보부동산: 나주 혁신산단 1·2공장", "source": "14.담보물건등기부등본.pdf" },
          { "text": "감정가 합계 50.3억 / 담보가 합계 25.06억", "source": "감정평가서" },
          { "text": "1순위 근저당 합계 33.72억 (광주은행)", "source": "14.담보물건등기부등본.pdf" },
          { "text": "부수자산: 태양광 6개호 1,274kW", "source": "(주)에이치에스티_승인신청서_해설서.pdf" }
        ]
      },
      "6": {
        "title": "★ 동일차주 합산 자동 검출 — 70.5억",
        "summary": "★ HST→두원건설(100% 자회사)→에스티건설(동일대표) 검출. 단기대여 70.5억 = 신청 17.1억의 약 4배 그룹 익스포저",
        "killer": true,
        "kpis": [
          { "label": "신청 금액", "value": "17.1", "unit": "억원" },
          { "label": "★ 동일차주 합산 단기대여", "value": "70.5", "unit": "억원", "alert": true },
          { "label": "그룹 총 외부 여신", "value": "약 180", "unit": "억원", "alert": true },
          { "label": "관계회사 검출 수", "value": 2, "unit": "건" }
        ],
        "graph": {
          "nodes": [
            { "id": "hst", "label": "(주)에이치에스티 (HST)", "type": "borrower", "amount_ok": 17.1 },
            { "id": "doowon", "label": "(주)두원건설", "type": "subsidiary", "relation": "100% 자회사 (속초 본점)", "amount_ok": 37.3 },
            { "id": "stconst", "label": "(주)에스티건설", "type": "related", "relation": "동일대표 황성태", "amount_ok": 33.2 },
            { "id": "ceo", "label": "황성태 (대표)", "type": "ceo" }
          ],
          "edges": [
            { "from": "hst", "to": "doowon", "label": "100% 지분 + 단기대여 37.3억" },
            { "from": "hst", "to": "stconst", "label": "단기대여 33.2억" },
            { "from": "ceo", "to": "hst", "label": "대표 (40% 지분)" },
            { "from": "ceo", "to": "stconst", "label": "동일대표" }
          ]
        },
        "exposure": [
          { "label": "HST 광주은행 신청", "amount_ok": 17.1, "kind": "신청" },
          { "label": "HST 신한", "amount_ok": 28.1, "kind": "외부" },
          { "label": "HST KDB", "amount_ok": 65.0, "kind": "외부" },
          { "label": "HST → 두원건설 단기대여", "amount_ok": 37.3, "kind": "★ 합산", "highlight": true },
          { "label": "HST → 에스티건설 단기대여", "amount_ok": 33.2, "kind": "★ 합산", "highlight": true }
        ],
        "facts": [
          { "text": "(주)두원건설: HST 100% 지분 자회사 (60,000주, 자본금 3억)", "source": "17.두원건설관련자료.pdf p.5" },
          { "text": "(주)에스티건설: 황성태 동일대표", "source": "16.에스티건설관련자료.pdf" },
          { "text": "★ HST → 두원건설 단기대여 37.3억", "source": "6.재무제표부속명세서.pdf p.5", "highlight": true },
          { "text": "★ HST → 에스티건설 단기대여 33.2억", "source": "6.재무제표부속명세서.pdf p.5", "highlight": true },
          { "text": "단기대여 합계 70.5억 = 신청 17.1억의 4.1배", "source": "Compliance Agent 합산" }
        ],
        "flags": [
          { "level": "ALERT", "msg": "★ 동일차주 합산 70.5억 검출 — 신청 17.1억 단독 평가 시 누락 위험" },
          { "level": "ALERT", "msg": "그룹 총 외부 여신 약 180억 — 자기자본 10.3억의 17배 (한도 검토 필요)" }
        ]
      },
      "7": {
        "title": "위험 종합 분석 — 가중치 산출",
        "summary": "주요 위험요인 4개 식별. 매출 감소 (0.42) > 동일차주 (0.31) > 회전기간 (0.18) > LTV (0.09)",
        "kpis": [
          { "label": "총 위험요인", "value": 4, "unit": "건" },
          { "label": "최고 가중치 위험", "value": "매출 감소", "unit": "" },
          { "label": "권고 등급", "value": "BB+", "unit": "" },
          { "label": "권고", "value": "조건부 승인", "unit": "" }
        ],
        "weights": [
          { "factor": "매출 -52% 감소 → 영업현금흐름 악화", "weight": 0.42, "evidence": "Stage 2" },
          { "factor": "동일차주 합산 70.5억 → 유동성 잠김", "weight": 0.31, "evidence": "Stage 6" },
          { "factor": "매출채권 회전기간 116일 → 운전자금 부담", "weight": 0.18, "evidence": "Stage 3" },
          { "factor": "담보 LTV 49.8% (안전 범위)", "weight": 0.09, "evidence": "Stage 5" }
        ],
        "facts": [
          { "text": "정량 위험점수 = Σ(가중치 × 정규화 위험값) = 0.68 (BB+ 구간)", "source": "Risk Synthesis Agent" },
          { "text": "외부 NICE 841점 (BB+) 일치", "source": "크레탑 총괄.pdf" },
          { "text": "당행 신용등급 BB+ (2024-01-24) 갱신 권고", "source": "기업모형 A" }
        ]
      },
      "8": {
        "title": "광주은행 표준 승인신청서 + 해설서 작성",
        "summary": "광주은행 표준 양식 자동 채움 / 모든 항목에 출처 자료 인용 / 84% 일치율",
        "kpis": [
          { "label": "양식 일치율", "value": 84, "unit": "%" },
          { "label": "근거 자료 인용", "value": 28, "unit": "건" },
          { "label": "심사 의견 권고", "value": "조건부 승인", "unit": "" },
          { "label": "총 처리 시간", "value": 35, "unit": "분" }
        ],
        "form_sections": [
          { "section": "차주 개요", "content": "(주)에이치에스티 / 사업자 678-86-00767 / 대표 황성태 / 본점 광주광역시 / 수배전반·태양광·전기공사", "source": "Stage 1" },
          { "section": "신청 요지", "content": "비즈니스파트너론 17.1억원 / 36개월 / 5.83% / 기업시설자금대출일시", "source": "신청서 양식" },
          { "section": "재무 현황", "content": "2023 매출 78.78억 (3년 -52%) / 영업이익 6.0억 / 자기자본 10.3억", "source": "Stage 2" },
          { "section": "신용 평가", "content": "당행 BB+ / KCB 818 / NICE 841 — 외부 등급 BB+ 구간 일치", "source": "Stage 7" },
          { "section": "담보 평가", "content": "나주 혁신산단 1·2공장 / 감정 50.3억 / 담보가 25.06억 / 1순위 근저당 33.72억 / LTV 49.8%", "source": "Stage 5" },
          { "section": "★ 동일차주 합산 검토", "content": "(주)두원건설(100% 자회사) + (주)에스티건설(동일대표 황성태) 검출. 단기대여 70.5억 + 외부 여신 합산 익스포저 약 180억", "source": "Stage 6", "highlight": true },
          { "section": "위험요인", "content": "① 매출 -52% 급감 ② 동일차주 합산 70.5억 ③ 매출채권 회전 116일 ④ 정책자금 KDB 65억 의존", "source": "Stage 7" },
          { "section": "심사 의견 (초안)", "content": "조건부 승인 권고. 조건: (1) 동일차주 합산 한도 별도 검토 (2) 매출 감소 사유 분기별 모니터링 (3) 관계회사 단기대여 회수 계획 제출", "source": "Stage 7-8" }
        ]
      }
    },
    "metrics": {
      "ttft_minutes": 35,
      "form_match_pct": 84,
      "related_party_detected": 2,
      "warning_flags": 5,
      "alert_flags": 2,
      "evidence_refs": 28,
      "token_input": 192000,
      "token_output": 41000,
      "estimated_cost_usd": 3.2,
      "vs_traditional_baseline": "기존 광주은행 평균 3-7일 → 35분"
    }
  }
};
