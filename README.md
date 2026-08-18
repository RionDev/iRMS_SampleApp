# iRMS 샘플 App

악성 샘플 조회 앱. photon-db 의 샘플 메타데이터를 sample-service(BE) 를 통해
검색/조회하고 샘플 파일을 다운로드한다. (vt_metadata 웹서비스 이식)

## 기능

- **샘플 검색**: SHA256/MD5 해시 또는 진단명(전방/부분일치) 검색 + 포맷/카테고리/풀/
  로케일/소스/태그/라벨/진단율/등록일 필터, cursor 기반 이전/다음 페이지네이션
- **샘플 상세**: 해시 3종(SHA256/MD5/SSDEEP) 복사, 파일 타입 상세, 진단율 게이지,
  벤더별 진단명 테이블, 태그/라벨, 파일 다운로드 (미보관 시 비활성)
- **멀티 검색**: 해시 최대 500개 붙여넣기 → 일치/불일치 분리, 최대 50개 선택
  배치 다운로드 (AES ZIP, 비밀번호 `infected`)
- **통계**: 전체/최근 등록 KPI, 풀 비율, 일별 추이, 포맷·카테고리·로케일·진단율
  분포, 벤더별 TOP 진단명

## 기술 스택

React 18 + TypeScript, Vite, ECharts, Zustand/Axios (common 제공), Vitest + RTL

## 라우트

| 경로 | 페이지 | 설명 |
| --- | --- | --- |
| `/sample/` | SearchPage | 검색바 + 필터 + 결과 테이블 |
| `/sample/samples/:hash` | DetailPage | 샘플 상세 + 다운로드 |
| `/sample/multi` | MultiSearchPage | 멀티 해시 검색 + 배치 다운로드 |
| `/sample/stats` | StatsPage | 샘플 통계 대시보드 |

## 연동 BE API

Base `/api/sample` (sample-service, 게이트웨이 경유). 계약 SoT:
`iRMS_BE/docs/plan/vt-sample-service.md` → 구현 후 `/api/sample/docs` Swagger.

기본 설정은 실제 BE를 사용한다. UI 단독 개발이 필요할 때만 `.env`의
`VITE_USE_MOCK=1`을 설정한다.

## 개발

```bash
npm install
npm run dev
```

기본 포트: 3005, 경로: `/sample/`

## 사전 준비

```bash
git submodule update --init --recursive
```
